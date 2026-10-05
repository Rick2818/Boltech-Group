import crypto from 'node:crypto';
import { request as httpsRequest } from 'node:https';
import { redisCommand } from './rsi_handoff_store.js';

const QUEUE = 'boltech:crm:due';
const BLOCKED = 'boltech:crm:blocked';
const jobKey = id => `boltech:crm:job:${id}`;
const leaseKey = id => `boltech:crm:lease:${id}`;
const fail = (code, retryable = false, retryAfterMs = 0) => { throw Object.assign(new Error(code), { code, retryable, retryAfterMs }); };
export function normalizeContact(lead = {}) {
  if (!lead || typeof lead !== 'object' || Array.isArray(lead)) fail('CRM_INVALID_CONTACT');
  const email = typeof lead.email === 'string' ? lead.email.trim().toLowerCase() : '';
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail('CRM_INVALID_EMAIL');
  const properties = { email };
  for (const [key, value] of Object.entries({ company: lead.companyName || lead.company, firstname: lead.firstname, lastname: lead.lastname, phone: lead.phone })) {
    if (value === undefined || value === '') continue;
    if (typeof value !== 'string' || value.length > 500 || /[\x00-\x1f\x7f]/.test(value)) fail('CRM_INVALID_CONTACT');
    if (value.trim()) properties[key] = value.trim();
  }
  return properties;
}


// Keep provider transport independent of runtime fetch instrumentation.
// Read the complete bounded response before constructing its JSON reader.
export async function hubspotHttpFetch(url, options) {
  const destination = new URL(url);
  if (destination.protocol !== 'https:' || destination.hostname !== 'api.hubapi.com' ||
      destination.port || destination.username || destination.password ||
      !/^\/crm\/v3\/objects\/contacts(?:\/|$)/.test(destination.pathname) ||
      !['GET', 'POST', 'PATCH'].includes(options.method))
    fail('HUBSPOT_INVALID_DESTINATION');
  return new Promise((resolve, reject) => {
    const req = httpsRequest(url, {
      method: options.method, signal: options.signal,
      headers: { ...options.headers, 'Accept-Encoding': 'identity' }
    }, res => {
      const chunks = []; let size = 0;
      res.on('data', chunk => {
        size += chunk.length;
        if (size > 1048576) { res.destroy(new Error('HUBSPOT_RESPONSE_TOO_LARGE')); return; }
        chunks.push(chunk);
      });
      res.on('error', reject);
      res.on('aborted', () => reject(new Error('HUBSPOT_RESPONSE_INCOMPLETE')));
      res.on('end', () => {
        try {
          if (!res.complete) throw new Error('HUBSPOT_RESPONSE_INCOMPLETE');
          const headers = {};
          for (const [key, value] of Object.entries(res.headers))
            if (value !== undefined) headers[key] = Array.isArray(value) ? value.join(', ') : String(value);
          const body = Buffer.concat(chunks);
          resolve(new Response([204, 205, 304].includes(res.statusCode) ? null : body, { status: res.statusCode, headers }));
        } catch (error) { reject(error); }
      });
    });
    req.on('error', reject);
    req.end(options.body);
  });
}

// Reads by email before creating. A lost create response can be recovered on retry.
// Only explicitly supplied fields are updated; no lifecycle downgrade or invented deal.
export async function syncHubSpotContact(properties, fetcher = hubspotHttpFetch) {
  const token = String(process.env.HUBSPOT_ACCESS_TOKEN || process.env.HUBSPOT_API_KEY || '').trim();
  if (!token) fail('HUBSPOT_NOT_CONFIGURED');
  const base = 'https://api.hubapi.com/crm/v3/objects/contacts';
  async function call(url, method = 'GET', body) {
    let response;
    try { response = await fetcher(url, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(8000) }); }
    catch { fail('HUBSPOT_NETWORK_ERROR', true); }
    const retryHeader = response.headers?.get('retry-after');
    const seconds = retryHeader && /^\d+(?:\.\d+)?$/.test(retryHeader.trim()) ? Number(retryHeader) : NaN;
    const retryAfter = Number.isFinite(seconds) ? seconds * 1000
      : retryHeader ? Date.parse(retryHeader) - Date.now() : NaN;
    if (response.status === 429) fail('HUBSPOT_RATE_LIMIT', true, Number.isFinite(retryAfter) ? Math.min(86400000, Math.max(0, retryAfter)) : 60000);
    if (response.status >= 500) fail('HUBSPOT_UNAVAILABLE', true);
    if (response.status === 401 || response.status === 403) fail('HUBSPOT_AUTH_REQUIRED');
    if (response.status === 404 || response.status === 409) return { status: response.status };
    if (!response.ok) fail('HUBSPOT_INVALID_REQUEST');
    let data;
    try { data = await response.json(); } catch {
      // A successful write can return an empty or unreadable body. Confirm it
      // with a separate provider read rather than repeating the mutation.
      if (method === 'GET') {
        console.warn('[CRM_PROVIDER_RESPONSE]', JSON.stringify({ method, status: response.status, contentType: response.headers.get('content-type'), reason: 'INVALID_JSON' }));
        fail('HUBSPOT_INVALID_RESPONSE', true);
      }
      return { status: response.status };
    }
    if (method === 'GET' && data?.archived === true) fail('HUBSPOT_CONTACT_ARCHIVED');
    if (method === 'GET' && !data?.id) {
      console.warn('[CRM_PROVIDER_RESPONSE]', JSON.stringify({ method, status: response.status, contentType: response.headers.get('content-type'), reason: data?.archived === true ? 'ARCHIVED' : 'MISSING_ID', keys: data && typeof data === 'object' ? Object.keys(data).slice(0, 12) : [], hasResults: Array.isArray(data?.results) }));
      fail('HUBSPOT_INVALID_RESPONSE', true);
    }
    return { status: response.status, data };
  }
  const fields = Object.keys(properties).join(',');
  const lookup = `${base}/${encodeURIComponent(properties.email)}?idProperty=email&properties=${encodeURIComponent(fields)}`;
  function validateIdentity(contact) {
    if (contact?.archived === true) fail('HUBSPOT_CONTACT_ARCHIVED');
    if (!/^[1-9]\d*$/.test(String(contact?.id || '')) ||
        String(contact.properties?.email || '').trim().toLowerCase() !== properties.email)
      fail('HUBSPOT_IDENTITY_MISMATCH');
  }
  async function readContact() {
    try {
      const found = await call(lookup);
      if (found.status !== 404) validateIdentity(found.data);
      return found;
    }
    catch (error) {
      if (error.code !== 'HUBSPOT_INVALID_RESPONSE') throw error;
      // A malformed successful GET is not evidence that the contact is absent.
      // Confirm by the documented batch read before considering another write.
      const batch = await call(`${base}/batch/read`, 'POST', {
        idProperty: 'email', properties: Object.keys(properties),
        inputs: [{ id: properties.email }]
      });
      if (!Array.isArray(batch.data?.results) || batch.data.results.length !== 1)
        fail('HUBSPOT_BATCH_READ_UNCONFIRMED', true);
      const contact = batch.data.results[0];
      if (!/^[1-9]\d*$/.test(String(contact?.id || '')) || contact.archived === true ||
          String(contact.properties?.email || '').trim().toLowerCase() !== properties.email)
        fail('HUBSPOT_BATCH_READ_UNCONFIRMED', true);
      return { status: 200, data: contact };
    }
  }
  let existing = await readContact();
  let result;
  if (existing.status === 404) {
    result = await call(base, 'POST', { properties });
    if (result.status === 409) {
      existing = await readContact();
      if (!existing.data?.id) fail('HUBSPOT_CONFLICT_UNRESOLVED', true);
      result = await call(`${base}/${encodeURIComponent(existing.data.id)}`, 'PATCH', { properties });
    }
  } else result = await call(`${base}/${encodeURIComponent(existing.data.id)}`, 'PATCH', { properties });
  const confirmed = await readContact();
  if (!confirmed.data?.id || confirmed.data.archived === true) fail('HUBSPOT_INVALID_RESPONSE', true);
  const expectedId = existing.data?.id || result.data?.id;
  if (expectedId && String(confirmed.data.id) !== String(expectedId)) fail('HUBSPOT_IDENTITY_MISMATCH', true);
  for (const [key, value] of Object.entries(properties)) {
    const actual = confirmed.data.properties?.[key];
    const matches = key === 'email'
      ? typeof actual === 'string' && actual.trim().toLowerCase() === value
      : actual === value;
    if (!matches) fail('HUBSPOT_READBACK_MISMATCH', true);
  }
  return { success: true, synced: true, contactId: String(confirmed.data.id), status: 'SYNCED_PROVIDER_CONFIRMED' };
}

export const ENQUEUE_SCRIPT = `if redis.call('EXISTS', KEYS[1]) == 1 then return 'EXISTS' end
redis.call('SET', KEYS[1], ARGV[1])
redis.call('ZADD', KEYS[2], ARGV[2], ARGV[3])
redis.call('SET', KEYS[3], ARGV[3])
return 'OK'`;
export const FINISH_SCRIPT = `if redis.call('GET', KEYS[2]) ~= ARGV[1] then return 'LEASE_LOST' end
redis.call('SET', KEYS[1], ARGV[2])
if ARGV[3] == 'DONE' then redis.call('ZREM', KEYS[3], ARGV[4]) else redis.call('ZADD', KEYS[3], ARGV[3], ARGV[4]) end
if ARGV[5] == 'BLOCKED' then redis.call('ZADD', KEYS[4], 0, ARGV[4]) else redis.call('ZREM', KEYS[4], ARGV[4]) end
redis.call('DEL', KEYS[2])
return 'OK'`;

export function createCrmRecovery({ command = redisCommand, sync = syncHubSpotContact, now = Date.now, uuid = crypto.randomUUID } = {}) {
  const latestKey = job => `boltech:crm:latest:${crypto.createHash('sha256').update(job.properties.email).digest('hex')}`;
  async function read(id) {
    if (!/^[a-f0-9]{64}$/.test(id || '')) fail('CRM_INVALID_JOB_ID');
    const raw = await command(['GET', jobKey(id)]);
    return raw ? JSON.parse(raw) : null;
  }
  async function enqueue(lead) {
    const properties = normalizeContact(lead);
    const request = {};
    for (const key of ['painPoint', 'message', 'service', 'domain']) {
      if (lead[key] === undefined || lead[key] === '') continue;
      if (typeof lead[key] !== 'string' || lead[key].length > 2000) fail('CRM_INVALID_REQUEST');
      request[key] = lead[key].trim();
    }
    const hasRequest = Object.keys(request).length > 0;
    const id = crypto.createHash('sha256').update(JSON.stringify(hasRequest ? { properties, request } : properties)).digest('hex');
    const timestamp = now();
    const job = { id, properties, ...(hasRequest ? { request } : {}), state: 'PENDING', attempts: 0, createdAt: timestamp, updatedAt: timestamp, history: [] };
    const result = await command(['EVAL', ENQUEUE_SCRIPT, 3, jobKey(id), QUEUE, latestKey(job), JSON.stringify(job), timestamp, id]);
    if (!['OK', 'EXISTS'].includes(result)) fail('CRM_STORAGE_FAILED');
    return { created: result === 'OK', job: await read(id) };
  }
  async function run(id) {
    const initial = await read(id);
    if (!initial) fail('CRM_JOB_NOT_FOUND');
    const lockKey = leaseKey(crypto.createHash('sha256').update(initial.properties.email).digest('hex'));
    const lease = uuid();
    // Lease outlives the bounded provider requests; compare token before committing.
    if (await command(['SET', lockKey, lease, 'NX', 'PX', 90000]) !== 'OK') return { id, state: 'BUSY' };
    let job;
    try {
      job = await read(id);
      if (!job) fail('CRM_JOB_NOT_FOUND');
      if (['COMPLETED', 'BLOCKED', 'SUPERSEDED'].includes(job.state)) return { id, state: job.state };
      if (job.nextAttemptAt > now()) return { id, state: 'WAITING_RETRY' };
      const attempt = job.attempts + 1;
      let result, state, code, nextAttemptAt;
      try {
        if (await command(['GET', latestKey(job)]) !== id) state = 'SUPERSEDED';
        else { result = await sync(job.properties); if (result?.success !== true || !result.contactId) fail('CRM_UNCONFIRMED_RESULT', true); state = 'COMPLETED'; }
      }
      catch (error) {
        code = /^[A-Z_]+$/.test(error.code || '') ? error.code : 'CRM_PROVIDER_ERROR';
        state = error.retryable && attempt < 5 ? 'RETRY_PENDING' : 'BLOCKED';
        nextAttemptAt = now() + Math.max(Math.min(3600000, 60000 * 2 ** (attempt - 1)), error.retryAfterMs || 0);
      }
      const timestamp = now();
      const next = { ...job, state, attempts: attempt, updatedAt: timestamp, ...(result ? { result } : {}), ...(code ? { code } : {}), ...(state === 'RETRY_PENDING' ? { nextAttemptAt } : {}), history: [...job.history, { timestamp, state, ...(code ? { code } : {}) }] };
      const committed = await command(['EVAL', FINISH_SCRIPT, 4, jobKey(id), lockKey, QUEUE, BLOCKED, lease, JSON.stringify(next), state === 'RETRY_PENDING' ? nextAttemptAt : 'DONE', id, state]);
      if (committed !== 'OK') fail('CRM_LEASE_LOST');
      return { id, state, attempts: attempt, ...(code ? { code } : {}) };
    } finally {
      // Never delete a lease acquired by another worker after expiry.
      await command(['EVAL', "if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) end return 0", 1, lockKey, lease]);
    }
  }
  async function drain() {
    const ids = await command(['ZRANGEBYSCORE', QUEUE, '-inf', now(), 'LIMIT', 0, 1]);
    if (!Array.isArray(ids)) fail('CRM_STORAGE_FAILED');
    return Promise.all(ids.map(run));
  }
  async function resume(id) {
    const job = await read(id);
    const resumable = value => value && (value.state === 'BLOCKED' || (value.state === 'RETRY_PENDING' && ['HUBSPOT_INVALID_RESPONSE', 'HUBSPOT_BATCH_READ_UNCONFIRMED'].includes(value.code)));
    if (!resumable(job)) fail('CRM_NOT_BLOCKED');
    const key = leaseKey(crypto.createHash('sha256').update(job.properties.email).digest('hex'));
    const lease = uuid();
    if (await command(['SET', key, lease, 'NX', 'PX', 90000]) !== 'OK') fail('CRM_JOB_BUSY');
    try {
      const current = await read(id);
      if (!resumable(current)) fail('CRM_NOT_BLOCKED');
      if (current.history.length >= 100) fail('CRM_HISTORY_LIMIT');
      const next = { ...current, state: 'RETRY_PENDING', attempts: 0, nextAttemptAt: now(), history: [...current.history, { timestamp: now(), state: 'MANUAL_RESUME' }] };
      const result = await command(['EVAL', FINISH_SCRIPT, 4, jobKey(id), key, QUEUE, BLOCKED, lease, JSON.stringify(next), now(), id, next.state]);
      if (result !== 'OK') fail('CRM_LEASE_LOST');
      return { id, state: next.state };
    } finally { await command(['EVAL', "if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) end return 0", 1, key, lease]); }
  }
  async function status() {
    const results = await Promise.all([command(['ZCARD', QUEUE]), command(['ZCARD', BLOCKED])]);
    if (results.some(v => !Number.isSafeInteger(Number(v)) || Number(v) < 0)) fail('CRM_STORAGE_FAILED');
    const blockedJobIds = await command(['ZRANGE', BLOCKED, 0, 19]);
    if (!Array.isArray(blockedJobIds)) fail('CRM_STORAGE_FAILED');
    return { queued: Number(results[0]), blocked: Number(results[1]), blockedJobIds, hubspotConfigured: Boolean(String(process.env.HUBSPOT_ACCESS_TOKEN || process.env.HUBSPOT_API_KEY || '').trim()) };
  }
  return { enqueue, read, run, drain, resume, status };
}

export async function queueContactSync(lead) {
  const store = createCrmRecovery();
  const { job } = await store.enqueue(lead);
  return { success: false, synced: false, status: job.state === 'COMPLETED' ? 'SYNCED_PROVIDER_CONFIRMED' : job.state, jobId: job.id, ...(job.state === 'COMPLETED' ? { ...job.result } : {}) };
}
