import test from 'node:test';
import assert from 'node:assert/strict';
import { isFreeGeminiEnabled, requestFreeGeminiReply, resetFreeGeminiUsageForTests } from '../lib/telegram_free_gemini.js';
import { processCloudTelegramUpdate } from '../lib/telegram_cloud_processor.js';

const on = { TELEGRAM_FREE_GEMINI_ENABLED: 'true', TELEGRAM_FREE_GEMINI_API_KEY: 'fixture-free-key' };

test('free Gemini is off unless explicitly enabled with its own key', () => {
  assert.equal(isFreeGeminiEnabled({}), false);
  assert.equal(isFreeGeminiEnabled({ GEMINI_API_KEY: 'old', OPENAI_API_KEY: 'old' }), false);
  assert.equal(isFreeGeminiEnabled({ TELEGRAM_FREE_GEMINI_ENABLED: 'true' }), false);
  assert.equal(isFreeGeminiEnabled({ TELEGRAM_FREE_GEMINI_API_KEY: 'k' }), false);
  assert.equal(isFreeGeminiEnabled(on), true);
});

test('free Gemini sends the key in a header, never in the URL, and honours the daily cap', async () => {
  resetFreeGeminiUsageForTests();
  const calls = [];
  const fetcher = async (url, options) => {
    calls.push({ url: String(url), headers: options.headers });
    return Response.json({ candidates: [{ content: { parts: [{ text: 'Respuesta' }] } }] });
  };
  const env = { ...on, TELEGRAM_FREE_GEMINI_DAILY_LIMIT: '2' };
  assert.equal((await requestFreeGeminiReply('a', env, fetcher)).reply, 'Respuesta');
  assert.equal((await requestFreeGeminiReply('b', env, fetcher)).reply, 'Respuesta');
  assert.equal((await requestFreeGeminiReply('c', env, fetcher)).reason, 'AI_DAILY_LIMIT');
  assert.equal(calls.length, 2);
  assert.ok(!calls[0].url.includes('key='));
  assert.equal(calls[0].headers['x-goog-api-key'], 'fixture-free-key');
  resetFreeGeminiUsageForTests();
});

test('provider failures fall back to the free command help without inventing an answer', async () => {
  resetFreeGeminiUsageForTests();
  const original = globalThis.fetch, texts = [];
  globalThis.fetch = async (url, options) => {
    if (String(url).startsWith('https://api.telegram.org/')) {
      texts.push(JSON.parse(options.body).text);
      return Response.json({ ok: true, result: { message_id: 1 } });
    }
    return new Response('{}', { status: 429 });
  };
  try {
    const env = { TELEGRAM_BOT_TOKEN: 'fixture', TELEGRAM_AUTHORIZED_USER_ID: '7', ...on };
    const update = text => ({ message: { chat: { type: 'private', id: 7 }, from: { id: 7 }, text } });
    const r = await processCloudTelegramUpdate(update('Necesito ayuda con mi empresa'), env);
    assert.equal(r.delivered, true);
    assert.equal(r.modelCalls, 0);
    assert.match(texts[0], /\/estado/);
  } finally { globalThis.fetch = original; resetFreeGeminiUsageForTests(); }
});

test('enabled bot answers free text with Gemini but keeps commands model-free', async () => {
  resetFreeGeminiUsageForTests();
  const original = globalThis.fetch, texts = [];
  let geminiCalls = 0;
  globalThis.fetch = async (url, options) => {
    if (String(url).startsWith('https://api.telegram.org/')) {
      texts.push(JSON.parse(options.body).text);
      return Response.json({ ok: true, result: { message_id: 1 } });
    }
    geminiCalls += 1;
    return Response.json({ candidates: [{ content: { parts: [{ text: 'Plan en tres pasos.' }] } }] });
  };
  try {
    const env = { TELEGRAM_BOT_TOKEN: 'fixture', TELEGRAM_AUTHORIZED_USER_ID: '7', ...on };
    const update = text => ({ message: { chat: { type: 'private', id: 7 }, from: { id: 7 }, text } });
    const free = await processCloudTelegramUpdate(update('Dame un plan para vender'), env);
    assert.equal(free.action, 'FREE_GEMINI_REPLY');
    assert.equal(free.modelCalls, 1);
    assert.equal(texts[0], 'Plan en tres pasos.');
    const help = await processCloudTelegramUpdate(update('/start'), env);
    assert.equal(help.modelCalls, 0);
    assert.equal(geminiCalls, 1);
  } finally { globalThis.fetch = original; resetFreeGeminiUsageForTests(); }
});
