// Owner access only. Provider tokens and the owner key never enter the cookie.
export const OWNER_COOKIE = '__Host-leo_owner';
export const OWNER_SESSION_SECONDS = 30 * 24 * 60 * 60;
const PREFIX = 'leo:owner-session:v1:';
const json = (data, status = 200, headers = {}) => Response.json(data, {status, headers: {
  'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', ...headers
}});
const cookie = value => `${OWNER_COOKIE}=${value}; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=${value ? OWNER_SESSION_SECONDS : 0}`;
const configured = env => typeof env.LEO_PLATFORM_TOKEN === 'string' && env.LEO_PLATFORM_TOKEN.length >= 24;
const ready = env => !!(env.COMMERCE?.get && env.COMMERCE?.put);
const sameOrigin = request => request.headers.get('Origin') === new URL(request.url).origin
  && !['cross-site', 'same-site'].includes(request.headers.get('Sec-Fetch-Site'));
const digest = async value => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))))
  .map(b => b.toString(16).padStart(2, '0')).join('');
const version = env => digest('leo:owner-key:v1:' + env.LEO_PLATFORM_TOKEN);
function sessionId(request) {
  const values = (request.headers.get('Cookie') || '').split(';').map(s => s.trim()).filter(s => s.startsWith(OWNER_COOKIE + '='));
  if (values.length !== 1) return null;
  const id = values[0].slice(OWNER_COOKIE.length + 1);
  return /^[a-f0-9]{64}$/.test(id) ? id : null;
}
async function lookup(request, env) {
  const id = sessionId(request);
  if (!id || !configured(env) || !ready(env)) return null;
  const key = PREFIX + await digest(id);
  const raw = await env.COMMERCE.get(key, {cacheTtl: 30});
  if (!raw) return null;
  let record;
  try { record = JSON.parse(raw); } catch { return null; }
  const now = Date.now();
  if (record.revoked || record.origin !== new URL(request.url).origin || record.version !== await version(env)
    || !Number.isFinite(record.expiresAt) || !Number.isFinite(record.createdAt)
    || record.createdAt > now || record.expiresAt <= now
    || record.expiresAt - record.createdAt !== OWNER_SESSION_SECONDS * 1000) return null;
  return {key, record};
}
// Adapt a valid browser session to the existing private handlers in this Worker.
// This header is internal; never send the owner key to a third-party provider.
export async function ownerRequest(request, env) {
  if (!sessionId(request)) return request;
  // A supplied Bearer credential retains its existing validation semantics.
  if (request.headers.has('Authorization')) return request;
  if (!sameOrigin(request)) return json({success: false, error: 'ORIGIN_NOT_ALLOWED'}, 403);
  try {
    if (!await lookup(request, env)) return json({success: false, error: 'OWNER_ACCESS_REQUIRED'}, 401);
    const headers = new Headers(request.headers);
    headers.set('Authorization', 'Bearer ' + env.LEO_PLATFORM_TOKEN);
    return new Request(request, {headers});
  } catch { return json({success: false, error: 'OWNER_SESSION_UNAVAILABLE'}, 503); }
}
export function withoutOwnerCookie(headers) {
  const value = (headers.get('Cookie') || '').split(';').map(s => s.trim())
    .filter(s => s && !s.startsWith(OWNER_COOKIE + '=')).join('; ');
  if (value) headers.set('Cookie', value); else headers.delete('Cookie');
}
export async function handleOwnerSession(request, env, authorize) {
  const method = request.method;
  if (!['GET', 'POST', 'DELETE'].includes(method)) return json({success: false, error: 'METHOD_NOT_ALLOWED'}, 405);
  if (method !== 'GET' && !sameOrigin(request)) return json({success: false, error: 'ORIGIN_NOT_ALLOWED'}, 403);
  if (!configured(env) || !ready(env)) return json({success: false, error: 'OWNER_SESSION_NOT_CONFIGURED'}, 503);
  try {
    if (method === 'GET') {
      const current = await lookup(request, env);
      return json({success: true, authenticated: !!current, expiresAt: current?.record.expiresAt}, 200,
        current || !sessionId(request) ? {} : {'Set-Cookie': cookie('')});
    }
    if (method === 'DELETE') {
      const current = await lookup(request, env);
      if (current) await env.COMMERCE.put(current.key, JSON.stringify({...current.record, revoked: true}),
        {expirationTtl: Math.max(60, Math.ceil((current.record.expiresAt - Date.now()) / 1000))});
      return json({success: true, authenticated: false}, 200, {'Set-Cookie': cookie('')});
    }
    if (!authorize(request, env)) return json({success: false, error: 'OWNER_ACCESS_REQUIRED'}, 401);
    // Replace the prior browser session rather than accepting a caller-chosen ID.
    const current = await lookup(request, env);
    if (current) await env.COMMERCE.put(current.key, JSON.stringify({...current.record, revoked: true}),
      {expirationTtl: Math.max(60, Math.ceil((current.record.expiresAt - Date.now()) / 1000))});
    const id = Array.from(crypto.getRandomValues(new Uint8Array(32))).map(b => b.toString(16).padStart(2, '0')).join('');
    const createdAt = Date.now();
    const record = {createdAt, expiresAt: createdAt + OWNER_SESSION_SECONDS * 1000,
      origin: new URL(request.url).origin, version: await version(env)};
    await env.COMMERCE.put(PREFIX + await digest(id), JSON.stringify(record), {expirationTtl: OWNER_SESSION_SECONDS});
    return json({success: true, authenticated: true, expiresAt: record.expiresAt}, 200, {'Set-Cookie': cookie(id)});
  } catch { return json({success: false, error: 'OWNER_SESSION_UNAVAILABLE'}, 503); }
}
