import test from 'node:test';
import assert from 'node:assert/strict';
import { basicTelegramReply, requestOpenAiReply } from '../lib/telegram_assistant_reply.js';
import { processCloudTelegramUpdate } from '../lib/telegram_cloud_processor.js';
test('Direct answers do not pretend to execute tasks', () => {
  assert.match(basicTelegramReply('hola'), /Hola, Ricardo/);
  assert.equal(basicTelegramReply('Cuanto es 2*2'), '2 * 2 = 4');
  assert.equal(basicTelegramReply('¿Cuánto es 10/0?'), 'No se puede dividir entre cero.');
  assert.equal(basicTelegramReply('envía un correo'), null);
});
test('Missing credentials and provider failures are explicit', async () => {
  assert.equal((await requestOpenAiReply('test', {})).reason, 'AI_NOT_CONFIGURED');
  assert.equal((await requestOpenAiReply('test', { OPENAI_API_KEY: 'test' }, async () => new Response('{}', { status: 401 }))).reason, 'AI_AUTH_FAILED');
  const result = await requestOpenAiReply('test', { OPENAI_API_KEY: 'test' }, async (url, options) => {
    assert.equal(url, 'https://api.openai.com/v1/chat/completions');
    assert.equal(options.headers.Authorization, 'Bearer test');
    return Response.json({ choices: [{ message: { content: 'Respuesta concreta' } }] });
  });
  assert.equal(result.reply, 'Respuesta concreta');
});
test('Authorized Telegram message delivers an answer or a truthful service notice', async () => {
  const original = globalThis.fetch, messages = [];
  globalThis.fetch = async (url, options) => {
    assert.match(String(url), /\/sendMessage$/);
    messages.push(JSON.parse(options.body).text);
    return Response.json({ ok: true, result: { message_id: 123 } });
  };
  try {
    const env = { TELEGRAM_BOT_TOKEN: 'test', TELEGRAM_AUTHORIZED_USER_ID: '7' };
    const update = text => ({ message: { chat: { id: 7, type: 'private' }, from: { id: 7, first_name: 'Ricardo' }, text } });
    assert.equal((await processCloudTelegramUpdate(update('Cuanto es 2*2'), env)).delivered, true);
    assert.equal(messages[0], '2 * 2 = 4');
    await processCloudTelegramUpdate(update('Revisa mis correos'), env);
    assert.match(messages[1], /Falta configurar/);
    assert.doesNotMatch(messages[1], /Instrucción registrada|operando 24\/7/);
  } finally { globalThis.fetch = original; }
});
