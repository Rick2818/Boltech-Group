import test from 'node:test';
import assert from 'node:assert/strict';
import { createHandoffStore, redisCommand } from '../lib/rsi_handoff_store.js';

function storage() {
  const data = new Map();
  const command = async ([op, ...args]) => {
    if (op === 'GET') return data.get(args[0]) || null;
    if (op === 'SET') { if (data.has(args[0])) return null; data.set(args[0], args[1]); return 'OK'; }
    if (op === 'EVAL') {
      const [, , key, version, next] = args;
      if (!data.has(key)) return 'MISSING';
      if (JSON.parse(data.get(key)).version !== Number(version)) return 'CONFLICT';
      data.set(key, next); return 'OK';
    }
    throw new Error('Unexpected command');
  };
  return command;
}
const input = { handoffId: 'qa-001', opportunityId: 'qa-opportunity', from: 'RSI-01', to: 'RSI-02', owner: 'RSI-02', reason: 'QA transfer', evidenceRef: 'qa-evidence' };
const change = (version, state) => ({ handoffId: input.handoffId, expectedVersion: version, state, owner: 'RSI-02', evidenceRef: 'qa-result' });

test('restart preserves handoff, owner, origin and event history', async () => {
  const command = storage();
  await createHandoffStore(command).create(input);
  const restarted = createHandoffStore(command);
  await restarted.transition(change(1, 'ACCEPTED'));
  const record = await createHandoffStore(command).transition(change(2, 'COMPLETED'));
  assert.equal(record.opportunityId, input.opportunityId);
  assert.equal(record.from, input.from);
  assert.deepEqual(record.events.map(e => e.state), ['PENDING', 'ACCEPTED', 'COMPLETED']);
});
test('concurrent creation produces one record; changed payload conflicts', async () => {
  const store = createHandoffStore(storage());
  const results = await Promise.all([store.create(input), store.create(input)]);
  assert.equal(results.filter(r => r.created).length, 1);
  await assert.rejects(store.create({ ...input, opportunityId: 'other' }), { code: 'RSI_IDEMPOTENCY_CONFLICT' });
});
test('two concurrent transitions cannot overwrite each other', async () => {
  const store = createHandoffStore(storage()); await store.create(input);
  const results = await Promise.allSettled([store.transition(change(1, 'ACCEPTED')), store.transition(change(1, 'CANCELLED'))]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal((await store.read(input.handoffId)).events.length, 2);
});
test('blocked work can resume; completed work cannot be reopened', async () => {
  const store = createHandoffStore(storage()); await store.create(input);
  await store.transition(change(1, 'ACCEPTED')); await store.transition(change(2, 'BLOCKED'));
  await store.transition(change(3, 'ACCEPTED')); await store.transition(change(4, 'COMPLETED'));
  await assert.rejects(store.transition(change(5, 'ACCEPTED')), { code: 'RSI_INVALID_TRANSITION' });
});
test('invalid route, missing evidence, wrong owner and stale version are rejected', async () => {
  const store = createHandoffStore(storage());
  await assert.rejects(store.create({ ...input, to: 'RSI-01' }), { code: 'RSI_INVALID_ROUTE' });
  await assert.rejects(store.create({ ...input, evidenceRef: '' }), { code: 'RSI_INVALID_INPUT' });
  await store.create(input);
  await assert.rejects(store.transition({ ...change(1, 'ACCEPTED'), owner: 'RSI-03' }), { code: 'RSI_OWNER_MISMATCH' });
  await assert.rejects(store.transition(change(2, 'ACCEPTED')), { code: 'RSI_VERSION_CONFLICT' });
});
test('lost mutation response recovers with same id without creating a duplicate', async () => {
  const underlying = storage(); let lost = true;
  const store = createHandoffStore(async args => { const result = await underlying(args); if (args[0] === 'SET' && lost) { lost = false; throw new Error('connection lost'); } return result; });
  await assert.rejects(store.create(input));
  assert.equal((await store.create(input)).created, false);
});
test('unavailable storage never acknowledges success', async () => {
  const store = createHandoffStore(async () => { throw new Error('unavailable'); });
  await assert.rejects(store.create(input)); await assert.rejects(store.read(input.handoffId));
});
test('missing Redis configuration fails closed', async () => {
  const previous = process.env.UPSTASH_REDIS_REST_TOKEN;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
  try { await assert.rejects(redisCommand(['GET', 'qa']), { code: 'RSI_STORAGE_NOT_CONFIGURED', statusCode: 503 }); }
  finally { if (previous !== undefined) process.env.UPSTASH_REDIS_REST_TOKEN = previous; }
});

import partners from '../api/partners.js';
test('handoff API rejects unauthorized reads and mutations before storage access', async t => {
  const keys = ['PARTNER_API_TOKEN', 'COCKPIT_ACCESS_TOKEN'];
  const old = Object.fromEntries(keys.map(k => [k, process.env[k]]));
  const originalFetch = globalThis.fetch; let calls = 0;
  process.env.PARTNER_API_TOKEN = 'qa-only'; delete process.env.COCKPIT_ACCESS_TOKEN;
  globalThis.fetch = async () => { calls++; throw new Error('unexpected fetch'); };
  t.after(() => { globalThis.fetch = originalFetch; for (const [k,v] of Object.entries(old)) { if(v === undefined) delete process.env[k]; else process.env[k] = v; } });
  for (const method of ['GET', 'POST', 'PATCH']) {
    const res = { setHeader(){}, status(n){this.code=n;return this;}, json(body){this.body=body;return this;} };
    await partners({ method, url: '/api/partners?action=rsi-handoff', headers: {} }, res);
    assert.equal(res.code, 401);
  }
  assert.equal(calls, 0);
});
