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
    const mime = [`From: Boltech Group <${SDR_SENDER}>`, `To: ${header(job.email)}`, `Subject: =?UTF-8?B?${Buffer.from(header(job.subject)).toString('base64')}?=`, `Message-ID: <${header(job.rfcMessageId)}>`, 'MIME-Version: 1.0', 'Content-Type: text/plain; charset=UTF-8', 'Content-Transfer-Encoding: base64', '', Buffer.from(job.text).toString('base64').match(/.{1,76}/g).join('\r\n')].join('\r\n');
    const p = await call('messages/send', { method: 'POST', body: JSON.stringify({ raw: Buffer.from(mime).toString('base64url') }) });
    if (!p.id || !p.threadId) fail('GMAIL_SEND_UNKNOWN');
    return { messageId: p.id, threadId: p.threadId };
  }
  return { verify, search, send };
}
export const sdrJobId = account => crypto.createHash('sha256').update('boltech:initial:' + account).digest('hex');
