import crypto from 'node:crypto';

const routes = new Set(['RSI-01:RSI-02', 'RSI-03:RSI-02', 'RSI-02:RSI-03', 'RSI-03:RSI-01']);
const transitions = { PENDING: ['ACCEPTED', 'CANCELLED'], ACCEPTED: ['COMPLETED', 'BLOCKED'], BLOCKED: ['ACCEPTED', 'CANCELLED'] };
function fail(code, statusCode = 400) { throw Object.assign(new Error(code), { code, statusCode }); }
function text(value, max = 160) {
  if (typeof value !== 'string' || !value.trim() || value.length > max) fail('RSI_INVALID_INPUT');
  return value.trim();
}
function id(value) { const v = text(value); if (!/^[a-zA-Z0-9_.:-]+$/.test(v)) fail('RSI_INVALID_ID'); return v; }
const key = value => `boltech:rsi:handoff:${id(value)}`;

// Atomic version comparison and event append. No TTL: handoffs survive restarts.
export const CAS_SCRIPT = `local raw = redis.call('GET', KEYS[1])
if not raw then return 'MISSING' end
local current = cjson.decode(raw)
if current.version ~= tonumber(ARGV[1]) then return 'CONFLICT' end
redis.call('SET', KEYS[1], ARGV[2])
return 'OK'`;

export async function redisCommand(args) {
  const url = String(process.env.UPSTASH_REDIS_REST_URL || '').trim();
  const token = String(process.env.UPSTASH_REDIS_REST_TOKEN || '').trim();
  if (!/^https:\/\//.test(url) || !token) fail('RSI_STORAGE_NOT_CONFIGURED', 503);
  // Retry only GET. An uncertain mutation is recovered by reading its id/version.
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(args), signal: AbortSignal.timeout(5000) });
      if (!response.ok) fail('RSI_STORAGE_UNAVAILABLE', 503);
      const payload = await response.json();
      if (payload.error) fail('RSI_STORAGE_UNAVAILABLE', 503);
      return payload.result;
    } catch {
      if (args[0] !== 'GET' || attempt === 2) fail('RSI_STORAGE_UNAVAILABLE', 503);
      await new Promise(resolve => setTimeout(resolve, 100 * 2 ** attempt));
    }
  }
}

export function createHandoffStore(command = redisCommand, now = () => new Date().toISOString()) {
  async function read(handoffId) {
    const raw = await command(['GET', key(handoffId)]);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { fail('RSI_STORAGE_CORRUPT', 503); }
  }
  async function create(input) {
    const handoffId = id(input.handoffId), opportunityId = id(input.opportunityId);
    const from = text(input.from), to = text(input.to), owner = id(input.owner);
    if (!routes.has(`${from}:${to}`)) fail('RSI_INVALID_ROUTE');
    const reason = text(input.reason, 500), evidenceRef = id(input.evidenceRef);
    const fingerprint = crypto.createHash('sha256').update(JSON.stringify({ opportunityId, from, to, owner, reason, evidenceRef })).digest('hex');
    const timestamp = now();
    const record = { handoffId, opportunityId, from, to, owner, reason, evidenceRef, fingerprint, state: 'PENDING', version: 1, updatedAt: timestamp, events: [{ state: 'PENDING', owner, evidenceRef, timestamp }] };
    const result = await command(['SET', key(handoffId), JSON.stringify(record), 'NX']);
    if (result === 'OK') return { created: true, record };
    const existing = await read(handoffId);
    if (!existing || existing.fingerprint !== fingerprint) fail('RSI_IDEMPOTENCY_CONFLICT', 409);
    return { created: false, record: existing };
  }
  async function transition(input) {
    if (!Number.isSafeInteger(input.expectedVersion) || input.expectedVersion < 1) fail('RSI_INVALID_VERSION');
    const record = await read(input.handoffId);
    if (!record) fail('RSI_HANDOFF_NOT_FOUND', 404);
    if (record.version !== input.expectedVersion) fail('RSI_VERSION_CONFLICT', 409);
    const owner = id(input.owner), evidenceRef = id(input.evidenceRef);
    if (owner !== record.owner) fail('RSI_OWNER_MISMATCH', 409);
    if (!transitions[record.state]?.includes(input.state)) fail('RSI_INVALID_TRANSITION', 409);
    if (record.events.length >= 100) fail('RSI_EVENT_LIMIT', 409);
    const timestamp = now();
    const next = { ...record, state: input.state, version: record.version + 1, updatedAt: timestamp, events: [...record.events, { state: input.state, owner, evidenceRef, timestamp }] };
    const result = await command(['EVAL', CAS_SCRIPT, 1, key(input.handoffId), String(input.expectedVersion), JSON.stringify(next)]);
    if (result !== 'OK') fail('RSI_VERSION_CONFLICT', 409);
    return next;
  }
  return { read, create, transition };
}
