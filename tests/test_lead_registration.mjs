import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/lead.js';

test('storage failure rejects intake before email or Telegram dispatch', async () => {
  const keys = ['UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN'];
  const previous = keys.map(key => process.env[key]);
  const originalFetch = globalThis.fetch;
  let calls = 0, status, data;
  try {
    for (const key of keys) delete process.env[key];
    globalThis.fetch = async () => { calls++; throw new Error('Unexpected outbound request'); };
    const res = { setHeader() {}, status(code) { status = code; return this; }, json(value) { data = value; } };
    await handler({ method: 'POST', headers: {}, socket: { remoteAddress: 'unit-storage-failure' },
      body: { email: 'qa@example.com', companyName: 'QA', painPoint: 'Solicitud de cotización de prueba' } }, res);
    assert.equal(status, 503);
    assert.equal(data.success, false);
    assert.equal(data.registration.status, 'FAILED');
    assert.equal(calls, 0);
  } finally {
    globalThis.fetch = originalFetch;
    keys.forEach((key, index) => { if (previous[index] === undefined) delete process.env[key]; else process.env[key] = previous[index]; });
  }
});
