import test from 'node:test';
import assert from 'node:assert/strict';
import {freeOperationalReply} from '../lib/telegram_free_operations.js';
import {processCloudTelegramUpdate} from '../lib/telegram_cloud_processor.js';
test('free commercial commands use real injected reads and fail without invented totals',async()=>{assert.match(await freeOperationalReply('/ventas',{sales:async()=>({paidOrders:0,cashCollectedUsd:0})}),/USD0/);assert.match(await freeOperationalReply('/ventas',{sales:async()=>{throw Error('DOWN');}}),/No pude verificar/);assert.match(await freeOperationalReply('/mercadeo',{marketing:async()=>({requested:3,accepted:3,used:0,resultsVerified:0,pendingAcceptance:0,pendingUse:3})}),/0 con uso comprobado/);});

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';
const baseEnv = { TELEGRAM_BOT_TOKEN: 'fixture', TELEGRAM_AUTHORIZED_USER_ID: '7' };
const update = (body) => ({ message: { chat: { type: 'private', id: 7 }, from: { id: 7 }, ...body } });

// Simula Telegram y Gemini; registra cada llamada para poder afirmar qué se invocó.
function mockNetwork({ geminiStatus = 200, geminiText = 'Respuesta de prueba' } = {}) {
  const original = globalThis.fetch, calls = [];
  globalThis.fetch = async (url, options = {}) => {
    const u = String(url);
    calls.push({ url: u, options });
    if (u.startsWith('https://api.telegram.org/') && u.includes('/getFile')) return Response.json({ ok: true, result: { file_path: 'voice/a.oga' } });
    if (u.startsWith('https://api.telegram.org/file/')) return new Response(Buffer.from('audio-fixture'));
    if (u.startsWith('https://api.telegram.org/')) return Response.json({ ok: true, result: { message_id: 1 } });
    if (u.startsWith(GEMINI_URL)) {
      if (geminiStatus !== 200) return Response.json({ error: { message: 'x' } }, { status: geminiStatus });
      return Response.json({ candidates: [{ content: { parts: [{ text: geminiText }] } }] });
    }
    throw new Error('Unexpected network call: ' + u);
  };
  return { calls, restore: () => { globalThis.fetch = original; } };
}
const sentTexts = (calls) => calls.filter(c => c.url.includes('/sendMessage')).map(c => JSON.parse(c.options.body).text);
const geminiCalls = (calls) => calls.filter(c => c.url.startsWith(GEMINI_URL));

test('free text is answered by Gemini 2.5 Flash when a key is present; key travels in a header, never in the URL', async () => {
  const net = mockNetwork();
  try {
    const r = await processCloudTelegramUpdate(update({ text: 'Necesito ayuda con mi empresa' }), { ...baseEnv, GEMINI_API_KEY: 'fixture-key' });
    assert.equal(r.delivered, true);
    assert.equal(r.action, 'GEMINI_REPLY');
    assert.equal(r.modelCalls, 1);
    const g = geminiCalls(net.calls);
    assert.equal(g.length, 1);
    assert.doesNotMatch(g[0].url, /key=/);
    assert.equal(g[0].options.headers['x-goog-api-key'], 'fixture-key');
    const body = JSON.parse(g[0].options.body);
    assert.equal(body.generationConfig.thinkingConfig.thinkingBudget, 0);
    assert.equal(body.generationConfig.thinkingConfig.thinkingLevel, undefined);
    assert.deepEqual(sentTexts(net.calls), ['Respuesta de prueba']);
    assert.equal(net.calls.some(c => /sendDocument|sendVoice/.test(c.url)), false, 'no voice note unless TELEGRAM_VOICE_REPLIES=1');
  } finally { net.restore(); }
});

test('greetings and commands never call Gemini, even with a key', async () => {
  const net = mockNetwork();
  try {
    const r = await processCloudTelegramUpdate(update({ text: 'hola' }), { ...baseEnv, GEMINI_API_KEY: 'fixture-key' });
    assert.equal(r.delivered, true);
    assert.equal(r.modelCalls, 0);
    assert.equal(geminiCalls(net.calls).length, 0);
  } finally { net.restore(); }
});

test('without a key, or with TELEGRAM_GEMINI_DISABLED=1, no model is called and the user is told the truth', async () => {
  for (const env of [{ ...baseEnv }, { ...baseEnv, GEMINI_API_KEY: 'fixture-key', TELEGRAM_GEMINI_DISABLED: '1' }]) {
    const net = mockNetwork();
    try {
      const r = await processCloudTelegramUpdate(update({ text: 'Necesito ayuda con mi empresa' }), env);
      assert.equal(r.delivered, true);
      assert.equal(r.modelCalls, 0);
      assert.equal(geminiCalls(net.calls).length, 0);
      const v = await processCloudTelegramUpdate(update({ voice: { file_id: 'f' } }), env);
      assert.equal(v.action, 'VOICE_REQUIRES_GEMINI');
      assert.equal(geminiCalls(net.calls).length, 0);
    } finally { net.restore(); }
  }
});

test('a Gemini HTTP error produces an honest fallback and is still delivered', async () => {
  const net = mockNetwork({ geminiStatus: 403 });
  try {
    const r = await processCloudTelegramUpdate(update({ text: 'Necesito ayuda con mi empresa' }), { ...baseEnv, GEMINI_API_KEY: 'fixture-key' });
    assert.equal(r.delivered, true);
    assert.equal(r.action, 'DEFENSIVE_FALLBACK');
    assert.match(sentTexts(net.calls)[0], /servicio de IA no está disponible/);
    assert.match(sentTexts(net.calls)[0], /No he ejecutado ni registrado una tarea/);
  } finally { net.restore(); }
});

test('voice notes are transcribed and answered by Gemini when a key is present', async () => {
  const net = mockNetwork({ geminiText: 'quiero ayuda con mi empresa' });
  try {
    const r = await processCloudTelegramUpdate(update({ voice: { file_id: 'f' } }), { ...baseEnv, GEMINI_API_KEY: 'fixture-key' });
    assert.equal(r.delivered, true);
    assert.equal(r.action, 'GEMINI_REPLY');
    assert.equal(r.modelCalls, 2);
    assert.equal(geminiCalls(net.calls).length, 2);
  } finally { net.restore(); }
});
