import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/telegram.js';

test('Telegram repair requires admin auth and refuses another integration', async () => {
  const originalFetch = globalThis.fetch;
  const keys = ['PARTNER_API_TOKEN', 'TELEGRAM_BOT_TOKEN', 'TELEGRAM_WEBHOOK_SECRET'];
  const previous = Object.fromEntries(keys.map(k => [k, process.env[k]]));
  Object.assign(process.env, { PARTNER_API_TOKEN: 'admin-unit', TELEGRAM_BOT_TOKEN: 'bot-unit', TELEGRAM_WEBHOOK_SECRET: 'secret-unit' });
  let existingUrl = 'https://other.example/webhook', setCalls = 0;
  globalThis.fetch = async (url, options = {}) => {
    if (url.endsWith('/getWebhookInfo')) return new Response(JSON.stringify({ ok: true, result: { url: existingUrl } }), { status: 200 });
    setCalls++;
    const body = JSON.parse(options.body);
    assert.equal(body.drop_pending_updates, false);
    assert.equal(body.secret_token, 'secret-unit');
    assert.equal(body.url, 'https://boltech-group.vercel.app/api/telegram');
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  };
  async function request(auth) {
    let status, data;
    const res = { setHeader() {}, status(n) { status = n; return this; }, json(p) { data = p; return this; } };
    await handler({ method: 'POST', query: { action: 'repair-webhook' }, headers: { authorization: auth } }, res);
    return { status, data };
  }
  try {
    assert.equal((await request('')).status, 401);
    assert.equal((await request('Bearer admin-unit')).data.code, 'TELEGRAM_OTHER_WEBHOOK_PRESENT');
    assert.equal(setCalls, 0);
    existingUrl = '';
    assert.equal((await request('Bearer admin-unit')).data.code, 'TELEGRAM_WEBHOOK_RESTORED');
    assert.equal(setCalls, 1);
  } finally {
    globalThis.fetch = originalFetch;
    for (const key of keys) if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key];
  }
});
