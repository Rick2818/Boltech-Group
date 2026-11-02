import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/a2a-outbound.js';
import { buildOutboundMessage, loadOutboundTarget } from '../lib/a2a_outbound_client.js';

// Offline protocol tests only: all peer HTTP and Redis calls are mocked.
const OPERATOR = 'a2a-local-test-operator-token-32-characters-minimum';
const peer = {
  approved: true, partnershipIntakeVerified: true, organization: 'Synthetic Partner',
  cardUrl: 'https://agents.synthetic-vendor.dev/.well-known/agent-card.json',
  endpoint: 'https://agents.synthetic-vendor.dev/a2a'
};
const card = {
  name: 'Synthetic partnership intake',
  provider: { organization: peer.organization },
  supportedInterfaces: [{ url: peer.endpoint, protocolBinding: 'JSONRPC', protocolVersion: '1.0' }]
};
function request(body = {}) {
  return { method: 'POST', headers: { authorization: 'Bearer ' + OPERATOR }, body: {
    operation: 'send', targetId: 'synthetic-vendor', intentId: 'boltech-intent-0001',
    subject: 'Boltech Group partnership', message: 'Institutional introduction for an authorized agent.',
    ...body
  } };
}
async function call(req) {
  const res = { headers: {}, setHeader(k,v) { this.headers[k] = v; },
    status(n) { this.statusCode = n; return this; }, json(v) { this.body = v; return this; } };
  await handler(req, res); return res;
}
function fixture(t, { cardMismatch = false, peerReply = null, transportFails = false, redisUnavailable = false } = {}) {
  const old = { ...process.env }; const oldFetch = globalThis.fetch;
  process.env.A2A_OUTBOUND_ENABLED = '1';
  process.env.A2A_OUTBOUND_OPERATOR_TOKEN = OPERATOR;
  process.env.A2A_OUTBOUND_TARGETS_JSON = JSON.stringify({ 'synthetic-vendor': peer });
  process.env.UPSTASH_REDIS_REST_URL = 'https://redis.synthetic-vendor.dev';
  process.env.UPSTASH_REDIS_REST_TOKEN = 'fake-only';
  const redis = new Map(), calls = [], requests = [], accepted = [];
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    if (String(url).startsWith('https://redis.synthetic-vendor.dev')) {
      if (redisUnavailable) return Response.json({ error: 'unavailable' }, { status: 503 });
      const p = JSON.parse(options.body || '[]');
      if (p[0] === 'GET') return Response.json({ result: redis.get(p[1]) || null });
      if (p[0] === 'SET') {
        if (p[3] === 'NX' && redis.has(p[1])) return Response.json({ result: null });
        redis.set(p[1], p[2]); return Response.json({ result: 'OK' });
      }
      throw Error('Unexpected Redis mock operation');
    }
    if (String(url) === peer.cardUrl) {
      return Response.json(cardMismatch ? { ...card, provider: { organization: 'Wrong Organization' } } : card);
    }
    if (String(url) === peer.endpoint) {
      const payload = JSON.parse(options.body);
      requests.push(payload);
      if (transportFails) throw Error('network timeout');
      if (peerReply) return Response.json(peerReply(payload));
      if (payload.method === 'SendMessage') {
        accepted.push(payload.params.message.messageId);
        return Response.json({ jsonrpc: '2.0', id: payload.id, result: { task: {
          id: 'remote-task-001', status: { state: 'TASK_STATE_SUBMITTED' }
        } } });
      }
      if (payload.method === 'GetTask') return Response.json({ jsonrpc: '2.0', id: payload.id, result: {
        id: payload.params.id, status: { state: 'TASK_STATE_COMPLETED' }
      } });
      throw Error('Unexpected peer mock RPC');
    }
    throw Error('Unexpected external request: ' + url);
  };
  t.after(() => {
    globalThis.fetch = oldFetch;
    for (const k of Object.keys(process.env)) if (!(k in old)) delete process.env[k];
    Object.assign(process.env, old);
  });
  return { redis, calls, requests, accepted };
}
test('A2A v1 creates deterministic IDs and SendMessage envelope', () => {
  const args = { targetId: 'synthetic-vendor', intentId: 'boltech-intent-0001', subject: 'Hello', message: 'Body' };
  const one = buildOutboundMessage(args), two = buildOutboundMessage(args);
  assert.deepEqual(one, two);
  assert.equal(one.method, 'SendMessage');
  assert.equal(one.params.message.role, 'ROLE_USER');
  assert.equal(one.params.message.parts[0].text, 'Hello\n\nBody');
  assert.ok(one.params.message.messageId.startsWith('boltech-'));
});
test('requires activation, approved target and HTTPS-only pinned hosts', () => {
  assert.throws(() => loadOutboundTarget('synthetic-vendor', {}), e => e.code === 'OUTBOUND_DISABLED');
  assert.throws(() => loadOutboundTarget('nonexistent', {
    A2A_OUTBOUND_ENABLED: '1', A2A_OUTBOUND_TARGETS_JSON: '{}'
  }), e => e.code === 'TARGET_NOT_APPROVED');
  for (const endpoint of [
    'http://agents.synthetic-vendor.dev/a2a', 'https://127.0.0.1/a2a',
    'https://localhost/a2a', 'https://agents.synthetic-vendor.dev:8443/a2a',
    'https://agents.synthetic-vendor.dev/a2a#fragment'
  ]) {
    const env = { A2A_OUTBOUND_ENABLED: '1', A2A_OUTBOUND_TARGETS_JSON: JSON.stringify({
      'synthetic-vendor': { ...peer, endpoint }
    }) };
    assert.throws(() => loadOutboundTarget('synthetic-vendor', env), e => e.code === 'UNSAFE_TARGET');
  }
});
test('operator secret prevents unauthenticated network and state access', async t => {
  const f = fixture(t);
  assert.equal((await call({ ...request(), headers: {} })).statusCode, 401);
  assert.equal((await call({ ...request(), headers: { authorization: 'Bearer wrong' } })).statusCode, 401);
  assert.equal(f.calls.length, 0);
});
test('verified card, durable claim, provider receipt and idempotent replay', async t => {
  const f = fixture(t);
  const one = await call(request());
  assert.equal(one.statusCode, 200);
  assert.equal(one.body.status, 'REMOTE_ACKNOWLEDGED');
  assert.equal(one.body.receipt.remoteTaskId, 'remote-task-001');
  assert.equal(f.accepted.length, 1);
  assert.equal(f.requests[0].method, 'SendMessage');
  assert.equal(f.calls.filter(c => c.url === peer.cardUrl).length, 1);
  const again = await call(request());
  assert.equal(again.statusCode, 200);
  assert.equal(again.body.replay, true);
  assert.equal(f.accepted.length, 1);
  assert.equal(f.calls.filter(c => c.url === peer.cardUrl).length, 1);
  const receipt = await call(request({ operation: 'receipt' }));
  assert.equal(receipt.statusCode, 200);
  assert.equal(receipt.body.receipt.remoteTaskId, 'remote-task-001');
  const task = await call(request({ operation: 'get-task' }));
  assert.equal(task.statusCode, 200);
  assert.equal(task.body.remoteState, 'TASK_STATE_COMPLETED');
  assert.equal(f.requests[1].method, 'GetTask');
});
test('intent cannot be reused with different message content', async t => {
  const f = fixture(t);
  assert.equal((await call(request())).statusCode, 200);
  const result = await call(request({ message: 'changed message' }));
  assert.equal(result.statusCode, 409);
  assert.equal(result.body.status, 'INTENT_CONFLICT');
  assert.equal(f.accepted.length, 1);
});
test('mismatched peer organization blocks outbound before claim', async t => {
  const f = fixture(t, { cardMismatch: true });
  const result = await call(request());
  assert.equal(result.statusCode, 409);
  assert.equal(result.body.status, 'CARD_MISMATCH');
  assert.equal(f.requests.length, 0);
  assert.equal(f.redis.size, 0);
});
test('disabled outbound prevents sends and receipt reads', async t => {
  const f = fixture(t);
  delete process.env.A2A_OUTBOUND_ENABLED;
  assert.equal((await call(request())).statusCode, 503);
  assert.equal((await call(request({ operation: 'receipt' }))).statusCode, 503);
  assert.equal(f.calls.length, 0);
});
test('Redis not ready prevents network send', async t => {
  const f = fixture(t, { redisUnavailable: true });
  assert.equal((await call(request())).statusCode, 503);
  assert.equal(f.accepted.length, 0);
  assert.equal(f.requests.length, 0);
});
test('uncertain transport cannot accidentally resend the same intent', async t => {
  const f = fixture(t, { transportFails: true });
  assert.equal((await call(request())).statusCode, 502);
  const retry = await call(request());
  assert.equal(retry.statusCode, 409);
  assert.equal(retry.body.status, 'DELIVERY_UNCERTAIN');
  assert.equal(f.requests.length, 1);
});
test('provider rejections are not treated as delivered', async t => {
  const f = fixture(t, { peerReply: p => ({
    jsonrpc: '2.0', id: p.id, error: { code: -32601, message: 'Unsupported skill' }
  }) });
  const result = await call(request());
  assert.equal(result.statusCode, 422);
  assert.equal(result.body.status, 'REMOTE_REJECTED');
  assert.equal(f.accepted.length, 0);
  const again = await call(request());
  assert.equal(again.statusCode, 422);
  assert.equal(again.body.status, 'REMOTE_REJECTED');
  assert.equal(again.body.receipt.state, 'REMOTE_REJECTED');
  assert.equal(f.requests.length, 1);
});
test('unknown target and invalid request fail before fetch', async t => {
  const f = fixture(t);
  const missing = await call(request({ targetId: 'langflow' }));
  assert.equal(missing.statusCode, 403);
  const malformed = await call(request({ subject: '', message: 'ok' }));
  assert.equal(malformed.statusCode, 400);
  assert.equal(f.requests.length, 0);
});

test('Langflow A2A 0.3 compatibility: legacy roles/methods, x-api-key and task lookup', async t => {
  const f = fixture(t);
  const target = { ...peer, protocolVersion: '0.3.0', authType: 'api-key',
    credentialEnv: 'A2A_PEER_LANGFLOW_TOKEN' };
  process.env.A2A_OUTBOUND_TARGETS_JSON = JSON.stringify({ 'synthetic-vendor': target });
  process.env.A2A_PEER_LANGFLOW_TOKEN = 'langflow-local-fake-token';
  const oldFetch = globalThis.fetch;
  globalThis.fetch = async (url, options = {}) => {
    if (String(url) === peer.cardUrl) return Response.json({
      name: card.name, provider: card.provider, protocolVersion: '0.3.0',
      preferredTransport: 'JSONRPC', url: peer.endpoint,
      security: [{ apiKey: [] }]
    });
    if (String(url) === peer.endpoint) {
      const p = JSON.parse(options.body);
      f.requests.push(p);
      assert.equal(options.headers['x-api-key'], 'langflow-local-fake-token');
      assert.equal(options.headers.Authorization, undefined);
      if (p.method === 'message/send') return Response.json({
        jsonrpc: '2.0', id: p.id, result: { id: 'langflow-task-123',
          status: { state: 'completed' }, artifacts: [{ parts: [{ kind: 'text',
            text: 'Thanks Boltech, proposal acknowledged for review.' }] }] }
      });
      if (p.method === 'tasks/get') return Response.json({
        jsonrpc:'2.0', id:p.id, result: { id:'langflow-task-123',
          status:{state:'completed'}, artifacts:[{parts:[{kind:'text',text:'Reviewed'}]}] }
      });
      throw Error('Unknown method');
    }
    return oldFetch(url, options);
  };
  const one = await call(request());
  assert.equal(one.statusCode, 200);
  assert.equal(one.body.receipt.remoteTaskId, 'langflow-task-123');
  assert.match(one.body.receipt.replyText, /proposal acknowledged/);
  assert.equal(f.requests[0].method, 'message/send');
  assert.equal(f.requests[0].params.message.role, 'user');
  assert.deepEqual(f.requests[0].params.message.parts, [{
    kind: 'text', text: 'Boltech Group partnership\n\nInstitutional introduction for an authorized agent.'
  }]);
  const task = await call(request({ operation: 'get-task' }));
  assert.equal(task.statusCode, 200);
  assert.equal(f.requests[1].method, 'tasks/get');
  assert.equal(task.body.replyText, 'Reviewed');
});
