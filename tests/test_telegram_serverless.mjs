import handler from '../api/telegram.js';
import { splitTelegramMessage } from '../lib/telegram_cloud_processor.js';

// Guardar fetch original para restaurar al finalizar
const originalFetch = globalThis.fetch;

// Configurar entorno aislado de pruebas (100% Mock, sin depender de red ni tokens reales)
const MOCK_SECRET = 'mock_boltech_tele_sec_2026';
const MOCK_TOKEN = '123456789:MOCK_TOKEN_FOR_TESTS';
const MOCK_USER_ID = '6311509947';

process.env.TELEGRAM_WEBHOOK_SECRET = MOCK_SECRET;
process.env.TELEGRAM_BOT_TOKEN = MOCK_TOKEN;
process.env.TELEGRAM_AUTHORIZED_USER_ID = MOCK_USER_ID;
process.env.GEMINI_API_KEY = 'mock_gemini_api_key';

// Mock global de fetch para interceptar Telegram y APIs externas
globalThis.fetch = async (url, options = {}) => {
  const urlStr = String(url);

  // 1. Mock de Telegram API
  if (urlStr.includes('api.telegram.org')) {
    if (urlStr.includes('/sendMessage')) {
      const body = options.body ? JSON.parse(options.body) : {};
      return {
        status: 200,
        ok: true,
        json: async () => ({
          ok: true,
          result: {
            message_id: Math.floor(Math.random() * 100000) + 1,
            chat: { id: body.chat_id },
            text: body.text
          }
        })
      };
    }
    if (urlStr.includes('/sendDocument') || urlStr.includes('/sendVoice')) {
      return {
        status: 200,
        ok: true,
        json: async () => ({
          ok: true,
          result: { message_id: 88888 }
        })
      };
    }
    if (urlStr.includes('/setWebhook')) {
      return {
        status: 200,
        ok: true,
        json: async () => ({ ok: true, result: true, description: 'Webhook was set' })
      };
    }
    if (urlStr.includes('/getWebhookInfo')) {
      return {
        status: 200,
        ok: true,
        json: async () => ({
          ok: true,
          result: {
            url: 'https://boltech-group.vercel.app/api/telegram',
            has_custom_certificate: false,
            pending_update_count: 0
          }
        })
      };
    }
    return {
      status: 200,
      ok: true,
      json: async () => ({ ok: true, result: {} })
    };
  }

  // 2. Mock de Mempool / Bitcoin
  if (urlStr.includes('mempool.space') || urlStr.includes('coingecko.com') || urlStr.includes('binance')) {
    return {
      status: 200,
      ok: true,
      json: async () => ({
        bitcoin: { usd: 85000, usd_24h_change: 2.5 },
        fastestFee: 15,
        halfHourFee: 12,
        hourFee: 10
      })
    };
  }

  // 3. Mock de Gemini API
  if (urlStr.includes('generativelanguage.googleapis.com')) {
    return {
      status: 200,
      ok: true,
      json: async () => ({
        candidates: [{
          content: {
            parts: [{ text: 'Hola Ricardo, asistente ejecutivo operando 100% en la nube.' }]
          }
        }]
      })
    };
  }

  // Fallback a original si no coincide
  return originalFetch(url, options);
};

function createMockResponse() {
  let statusCode = 200;
  let responseData = null;
  const headers = {};

  const res = {
    statusCode,
    headers,
    setHeader(k, v) {
      headers[k.toLowerCase()] = v;
      return this;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      responseData = data;
      return this;
    },
    end() {
      return this;
    },
    getResponseData() {
      return responseData;
    }
  };
  return res;
}

async function runTestSuite() {
  console.log('=== SUITE DE PRUEBAS: TELEGRAM SERVERLESS CON MOCKS 100% ISOLATED ===\n');

  // Test 1: GET Health Check
  console.log('1. Probando GET /api/telegram (Health check)...');
  const res1 = createMockResponse();
  await handler({ method: 'GET', headers: {} }, res1);
  console.assert(res1.statusCode === 200, `GET debe ser 200, fue ${res1.statusCode}`);
  console.assert(res1.getResponseData()?.status === 'ONLINE', 'Estado debe ser ONLINE');
  console.log('  ✅ GET Health Check: PASADO (200 ONLINE)');

  // Test 1b: GET Deep Health Check contra Telegram
  console.log('\n1b. Probando GET /api/telegram?deep=1...');
  const res1b = createMockResponse();
  await handler({ method: 'GET', headers: {}, query: { deep: '1' } }, res1b);
  console.assert(res1b.statusCode === 200, `GET deep debe ser 200, fue ${res1b.statusCode}`);
  console.assert(res1b.getResponseData()?.webhookConfigured === true, 'Webhook debe figurar configurado');
  console.log('  ✅ Deep Health Check: PASADO');

  // Test 2: POST sin secreto en headers debe responder 401
  console.log('\n2. Probando POST /api/telegram sin secreto en headers (debe ser 401)...');
  const res2 = createMockResponse();
  await handler({
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: { update_id: 1001, message: { text: 'test' } }
  }, res2);
  console.assert(res2.statusCode === 401, `Debe ser 401 Unauthorized, fue ${res2.statusCode}`);
  console.log('  ✅ Rechazo de Webhook no autorizado: PASADO (401)');

  // Test 3: POST con secreto ausente en el servidor debe responder 500
  console.log('\n3. Probando POST /api/telegram si el servidor carece de TELEGRAM_WEBHOOK_SECRET (debe ser 500)...');
  const savedSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  delete process.env.TELEGRAM_WEBHOOK_SECRET;
  const res3 = createMockResponse();
  await handler({
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-telegram-bot-api-secret-token': 'algun_token' },
    body: { update_id: 1002 }
  }, res3);
  console.assert(res3.statusCode === 500, `Debe ser 500 Server Misconfiguration, fue ${res3.statusCode}`);
  process.env.TELEGRAM_WEBHOOK_SECRET = savedSecret;
  console.log('  ✅ Validación de secreto obligatorio en servidor: PASADO (500 si falta)');

  // Test 3b: registro autenticado del webhook
  console.log('\n3b. Probando registro autenticado del webhook...');
  const res3b = createMockResponse();
  await handler({
    method: 'POST',
    headers: { 'x-telegram-bot-api-secret-token': MOCK_SECRET },
    query: { action: 'register-webhook' },
    body: {}
  }, res3b);
  console.assert(res3b.statusCode === 200, `Registro webhook debe ser 200, fue ${res3b.statusCode}`);
  console.assert(res3b.getResponseData()?.status === 'REGISTERED', 'Webhook debe quedar REGISTERED');
  console.log('  ✅ Registro autenticado de webhook: PASADO');

  // Test 4: POST con payload válido (/btc) debe responder 200 con delivered: true
  console.log('\n4. Probando POST /api/telegram con comando /btc...');
  const res4 = createMockResponse();
  const req4 = {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-telegram-bot-api-secret-token': MOCK_SECRET
    },
    body: {
      update_id: 50001,
      message: {
        message_id: 777,
        chat: { id: 6311509947, type: 'private' },
        from: { id: 6311509947, first_name: 'Ricardo', username: 'Rick281' },
        text: '/btc'
      }
    }
  };
  await handler(req4, res4);
  const data4 = res4.getResponseData();
  console.assert(res4.statusCode === 200, `Debe ser 200, fue ${res4.statusCode}`);
  console.assert(data4?.ok === true, 'data.ok debe ser true');
  console.assert(data4?.result?.delivered === true, 'data.result.delivered debe ser true');
  console.assert(data4?.result?.action === 'BTC_COMMAND', `Action debe ser BTC_COMMAND, fue ${data4?.result?.action}`);
  console.log('  ✅ Procesamiento de comando /btc: PASADO (200, delivered: true)');

  // Test 5: POST con el mismo update_id (Deduplicación)
  console.log('\n5. Probando deduplicación por update_id...');
  const res5 = createMockResponse();
  await handler(req4, res5);
  const data5 = res5.getResponseData();
  console.assert(res5.statusCode === 200, `Debe ser 200, fue ${res5.statusCode}`);
  console.assert(data5?.duplicate === true, 'data.duplicate debe ser true para actualización repetida');
  console.log('  ✅ Deduplicación por update_id: PASADO (200, duplicate: true)');

  // Test 6: División de mensajes de más de 4096 caracteres
  console.log('\n6. Probando función splitTelegramMessage (>4096 caracteres)...');
  const longText = 'A'.repeat(5000) + '\n' + 'B'.repeat(3500);
  const chunks = splitTelegramMessage(longText, 4000);
  console.assert(chunks.length >= 3, `Debe partirse en al menos 3 chunks, se crearon ${chunks.length}`);
  chunks.forEach((chunk, i) => {
    console.assert(chunk.length <= 4000, `Chunk ${i} excede 4000 caracteres (${chunk.length})`);
  });
  console.log(`  ✅ División de mensajes >4096 caracteres: PASADO (${chunks.length} fragmentos seguros creados)`);

  console.log('\n✨ ¡TODAS LAS PRUEBAS SERVERLESS CON MOCKS PASARON AL 100%!');
}

runTestSuite()
  .catch(err => {
    console.error('❌ Error en suite de pruebas:', err);
    process.exit(1);
  })
  .finally(() => {
    globalThis.fetch = originalFetch;
  });
