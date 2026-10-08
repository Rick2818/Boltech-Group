import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/telegram.js';
test('A failed reply remains retryable; only a successful reply is deduplicated', async () => {
  const originalFetch = globalThis.fetch;
  const keys = ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_WEBHOOK_SECRET', 'TELEGRAM_AUTHORIZED_USER_ID'];
  const previous = Object.fromEntries(keys.map(k => [k, process.env[k]]));
  Object.assign(process.env, { TELEGRAM_BOT_TOKEN: 'test', TELEGRAM_WEBHOOK_SECRET: 'test-secret', TELEGRAM_AUTHORIZED_USER_ID: '7' });
  let delivered = false, attempts = 0;
  globalThis.fetch = async () => { attempts++; return Response.json({ ok: delivered, result: { message_id: 123 } }, { status: delivered ? 200 : 503 }); };
  const request = async () => {
    let status, body;
    const res = { setHeader() {}, status(n) { status = n; return this; }, json(data) { body = data; return this; } };
    await handler({ method: 'POST', headers: { 'x-telegram-bot-api-secret-token': 'test-secret' }, body: { update_id: 987654321, message: { chat: { type: 'private', id: 7 }, from: { id: 7 }, text: 'hola' } } }, res);
    return { status, body };
  };
  try {
    assert.equal((await request()).status, 502);
    delivered = true;
    assert.equal((await request()).body.result.delivered, true);
    assert.equal((await request()).body.duplicate, true);
    assert.equal(attempts, 2);
  } finally {
    globalThis.fetch = originalFetch;
    for (const key of keys) if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key];
  }
});
