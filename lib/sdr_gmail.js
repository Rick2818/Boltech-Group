import crypto from 'node:crypto';

export const SDR_SENDER = 'ricardo.boltechgroup@gmail.com';
export function gmailReadiness(env = process.env) {
  const required = ['GMAIL_OAUTH_CLIENT_ID', 'GMAIL_OAUTH_CLIENT_SECRET', 'GMAIL_OAUTH_REFRESH_TOKEN'];
  return { configured: required.every(k => !!env[k]?.trim()), missing: required.filter(k => !env[k]?.trim()), sender: SDR_SENDER };
}
const fail = code => { throw Object.assign(new Error(code), { code }); };
export function createSdrGmail(fetcher = fetch, env = process.env) {
  let token, expires = 0;
  async function access() {
    if (!gmailReadiness(env).configured) fail('GMAIL_OAUTH_NOT_CONFIGURED');
    if (token && expires > Date.now()) return token;
    let res;
    try { res = await fetcher('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'refresh_token', client_id: env.GMAIL_OAUTH_CLIENT_ID, client_secret: env.GMAIL_OAUTH_CLIENT_SECRET, refresh_token: env.GMAIL_OAUTH_REFRESH_TOKEN }).toString(), signal: AbortSignal.timeout(10000) }); }
    catch { fail('GMAIL_OAUTH_NETWORK_ERROR'); }
    if (!res.ok) fail('GMAIL_OAUTH_AUTH_FAILED');
    const data = await res.json();
    if (!data.access_token) fail('GMAIL_OAUTH_INVALID_RESPONSE');
    token = data.access_token; expires = Date.now() + Math.max(0, Number(data.expires_in || 60) - 30) * 1000;
    return token;
  }
  async function call(path, options = {}) {
    const bearer = await access();
    let res;
    try { res = await fetcher('https://gmail.googleapis.com/gmail/v1/users/me/' + path, { ...options, headers: { Authorization: `Bearer ${bearer}`, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(12000) }); }
    catch { fail(options.method === 'POST' ? 'GMAIL_SEND_UNKNOWN' : 'GMAIL_READ_UNAVAILABLE'); }
    if (!res.ok) fail(options.method === 'POST' && res.status >= 500 ? 'GMAIL_SEND_UNKNOWN' : res.status === 429 ? 'GMAIL_RATE_LIMITED' : 'GMAIL_API_REJECTED');
    try { return await res.json(); } catch { fail(options.method === 'POST' ? 'GMAIL_SEND_UNKNOWN' : 'GMAIL_INVALID_RESPONSE'); }
  }
  async function verify() {
    const p = await call('profile');
    if (p.emailAddress?.toLowerCase() !== SDR_SENDER) fail('GMAIL_SENDER_MISMATCH');
    return { verified: true, sender: SDR_SENDER };
  }
  async function search(q) {
    const messages = []; let pageToken;
    const seen = new Set();
    do {
      const params = new URLSearchParams({ q, maxResults: '100', includeSpamTrash: 'true', ...(pageToken ? { pageToken } : {}) });
      const page = await call('messages?' + params);
      if (!Array.isArray(page.messages || [])) fail('GMAIL_INVALID_RESPONSE');
      messages.push(...(page.messages || [])); pageToken = page.nextPageToken;
      if (pageToken && seen.has(pageToken)) fail('GMAIL_PAGINATION_INVALID');
      seen.add(pageToken);
      if (seen.size > 20) fail('GMAIL_HISTORY_TOO_LARGE');
    } while (pageToken);
    return messages;
  }
  async function send(job) {
    const header = v => { if (typeof v !== 'string' || /[\r\n\x00]/.test(v)) fail('SDR_INVALID_HEADER'); return v; };
    const mime = [`From: Boltech Group <${SDR_SENDER}>`, `To: ${header(job.email)}`, `Subject: =?UTF-8?B?${Buffer.from(header(job.subject)).toString('base64')}?=`, `Message-ID: <${header(job.rfcMessageId)}>`, ...(job.inReplyTo?[`In-Reply-To: ${header(job.inReplyTo)}`,`References: ${header(job.inReplyTo)}`]:[]), 'MIME-Version: 1.0', 'Content-Type: text/plain; charset=UTF-8', 'Content-Transfer-Encoding: base64', '', Buffer.from(job.text).toString('base64').match(/.{1,76}/g).join('\r\n')].join('\r\n');
    if(job.threadId && !/^[a-zA-Z0-9_-]{1,120}$/.test(job.threadId)) fail('SDR_INVALID_HEADER');
    const p = await call('messages/send', { method: 'POST', body: JSON.stringify({ raw: Buffer.from(mime).toString('base64url'), ...(job.threadId?{threadId:job.threadId}:{}) }) });
    if (!p.id || !p.threadId) fail('GMAIL_SEND_UNKNOWN');
    return { messageId: p.id, threadId: p.threadId };
  }
  const decode = m => {
    const headers=Object.fromEntries((m.payload?.headers||[]).map(h=>[h.name.toLowerCase(),h.value]));
    const parts=p=>[...(p.mimeType==='text/plain'&&p.body?.data?[Buffer.from(p.body.data,'base64url').toString('utf8')]:[]),...(p.parts||[]).flatMap(parts)];
    const from=headers.from?.match(/<([^<>]+)>/)?.[1]||headers.from||'';
    return {id:m.id,threadId:m.threadId,from:from.trim().toLowerCase(),to:headers.to||'',subject:headers.subject||'',rfcMessageId:headers['message-id']||'',receivedAt:new Date(Number(m.internalDate)).toISOString(),text:parts(m.payload||{}).join('\n'),sent:(m.labelIds||[]).includes('SENT'),automatic:!!(headers['auto-submitted']&&headers['auto-submitted'].toLowerCase()!=='no')||/auto_reply|bulk|list/i.test(headers.precedence||'')};
  };
  async function message(id){if(!/^[a-zA-Z0-9_-]{1,120}$/.test(id||''))fail('GMAIL_INVALID_MESSAGE_ID');return decode(await call(`messages/${id}?format=full`));}
  async function thread(id){if(!/^[a-zA-Z0-9_-]{1,120}$/.test(id||''))fail('GMAIL_INVALID_THREAD_ID');const data=await call(`threads/${id}?format=full`);if(!Array.isArray(data.messages)||data.messages.length>200)fail('GMAIL_THREAD_REVIEW_REQUIRED');return data.messages.map(decode);}
  return { verify, search, send, message, thread };
}
export const sdrJobId = account => crypto.createHash('sha256').update('boltech:initial:' + account).digest('hex');
