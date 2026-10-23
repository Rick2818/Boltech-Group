import crypto from 'node:crypto';

export const SDR_SENDER = 'ricardo.boltechgroup@gmail.com';
export function gmailReadiness(env = process.env) {
  const required = ['GMAIL_OAUTH_CLIENT_ID', 'GMAIL_OAUTH_CLIENT_SECRET', 'GMAIL_OAUTH_REFRESH_TOKEN'];
  return { configured: required.every(k => !!env[k]?.trim()), missing: required.filter(k => !env[k]?.trim()), sender: SDR_SENDER };
}
const fail = code => { throw Object.assign(new Error(code), { code }); };
// Emit only fixed categories and a public-client fingerprint, never Google's
// free-form description, credentials, response bodies, or account information.
export function googleOauthDiagnostic(data = {}, clientId = '', httpStatus = 0) {
  const error = ['invalid_grant', 'invalid_client', 'unauthorized_client', 'admin_policy_enforced'].includes(data?.error) ? data.error : 'unclassified';
  const description = typeof data?.error_description === 'string' ? data.error_description : '';
  const reauthentication = data?.error_subtype === 'invalid_rapt';
  const category = reauthentication ? 'REAUTHENTICATION_REQUIRED'
    : error === 'invalid_grant' && /token has been expired or revoked/i.test(description) ? 'TOKEN_EXPIRED_OR_REVOKED'
    : error === 'invalid_client' ? 'CLIENT_AUTHENTICATION_REJECTED'
    : error === 'unauthorized_client' ? 'CLIENT_NOT_AUTHORIZED'
    : error === 'admin_policy_enforced' ? 'ADMIN_POLICY_BLOCKED'
    : 'CAUSE_UNDETERMINED';
  return { stage: 'REFRESH_TOKEN_EXCHANGE', error, category,
    ...(reauthentication ? { subtype: 'invalid_rapt' } : {}),
    httpStatus: Number.isInteger(httpStatus) && httpStatus >= 100 && httpStatus <= 599 ? httpStatus : 0,
    clientFingerprint: crypto.createHash('sha256').update(String(clientId).trim()).digest('hex').slice(0, 16) };
}
export function createSdrGmail(fetcher = fetch, env = process.env) {
  let token, expires = 0;
  async function access() {
    if (!gmailReadiness(env).configured) fail('GMAIL_OAUTH_NOT_CONFIGURED');
    const clientId = env.GMAIL_OAUTH_CLIENT_ID.trim();
    const clientSecret = env.GMAIL_OAUTH_CLIENT_SECRET.trim();
    const refreshToken = env.GMAIL_OAUTH_REFRESH_TOKEN.trim();
    if (refreshToken.endsWith('.apps.googleusercontent.com')) fail('GMAIL_OAUTH_REFRESH_TOKEN_IS_CLIENT_ID');
    if (token && expires > Date.now()) return token;
    let res;
    try { res = await fetcher('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'refresh_token', client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken }).toString(), signal: AbortSignal.timeout(10000) }); }
    catch { fail('GMAIL_OAUTH_NETWORK_ERROR'); }
    if (!res.ok) {
      let data;
      try { data = await res.json(); } catch {}
      const diagnostic = googleOauthDiagnostic(data, env.GMAIL_OAUTH_CLIENT_ID, res.status);
      console.error('[GMAIL_OAUTH_DIAGNOSTIC]', JSON.stringify(diagnostic));
      const reason = diagnostic.error;
      if (reason === 'invalid_grant') fail('GMAIL_OAUTH_INVALID_GRANT');
      if (reason === 'invalid_client') fail('GMAIL_OAUTH_INVALID_CLIENT');
      if (reason === 'unauthorized_client') fail('GMAIL_OAUTH_UNAUTHORIZED_CLIENT');
      fail('GMAIL_OAUTH_AUTH_FAILED');
    }
    const data = await res.json();
    if (!data.access_token) fail('GMAIL_OAUTH_INVALID_RESPONSE');
    token = data.access_token; expires = Date.now() + Math.max(0, Number(data.expires_in || 60) - 30) * 1000;
    return token;
  }
  async function call(path, options = {}) {
    const sending = options.method === 'POST';
    const stage = path === 'profile' ? 'PROFILE' : path.startsWith('threads/') ? 'THREAD_READ' : path.startsWith('messages/send') ? 'SEND' : path.startsWith('messages?') ? 'SEARCH' : 'MESSAGE_READ';
    for (let attempt = 0; attempt < 2; attempt++) {
      const bearer = await access();
      let res;
      try { res = await fetcher('https://gmail.googleapis.com/gmail/v1/users/me/' + path, { ...options, headers: { Authorization: `Bearer ${bearer}`, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(12000) }); }
      catch {
        if (!sending && attempt === 0) continue;
        fail(sending ? 'GMAIL_SEND_UNKNOWN' : 'GMAIL_READ_UNAVAILABLE');
      }
      if (!res.ok) {
        let data; try { data = await res.json(); } catch {}
        const allowed = ['rateLimitExceeded','userRateLimitExceeded','dailyLimitExceeded','quotaExceeded','insufficientPermissions','authError','backendError','notFound','invalidArgument','forbidden'];
        const reason = data?.error?.errors?.[0]?.reason;
        const diagnostic = { stage, httpStatus: res.status, reason: allowed.includes(reason) ? reason : 'UNCLASSIFIED' };
        // Only reads can be retried. POST outcomes are never replayed here.
        if (!sending && attempt === 0 && (res.status === 401 || res.status === 429 || res.status >= 500)) {
          if (res.status === 401) { token = undefined; expires = 0; }
          else await new Promise(resolve => setTimeout(resolve, 500));
          continue;
        }
        const code = sending && res.status >= 500 ? 'GMAIL_SEND_UNKNOWN' : res.status === 429 ? 'GMAIL_RATE_LIMITED' : 'GMAIL_API_REJECTED';
        throw Object.assign(new Error(code), { code, diagnostic });
      }
      try { return await res.json(); } catch { fail(sending ? 'GMAIL_SEND_UNKNOWN' : 'GMAIL_INVALID_RESPONSE'); }
    }
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
