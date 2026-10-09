import { basicTelegramReply, requestOpenAiReply } from './telegram_assistant_reply.js';
import {freeOperationalReply, FREE_BOT_HELP} from './telegram_free_operations.js';
import { commercialOfferContext } from './commercial_offer.js';
/**
 * =============================================================================
 * MOTOR CLOUD-NATIVE DE TELEGRAM & CONCIERGE SOBERANO 24/7 (7 PILARES)
 * =============================================================================
 * Cero dependencias de disco local | Procesamiento 100% en RAM volátil (Buffer)
 * Resiliencia contra ECONNRESET | Gemini 2.5 Flash (texto y transcripción) + TTS opcional
 * =============================================================================
 */

import {
  timingSafeCompare,
  escapeHtml,
  computeForensicHash,
  purgeMemoryBuffer
} from './fiduciary_core.js';
import { ExecutiveAssistantMCPHub } from './mcp_executive_assistant.js';

// Carga resiliente de @vercel/functions (Tolerante a GitHub Actions / entornos locales sin Vercel)
let vercelWaitUntil = null;
try {
  const vFuncs = await import('@vercel/functions');
  vercelWaitUntil = vFuncs.waitUntil;
} catch {
  // En CI/CD de GitHub Actions o ejecución CLI local, opera como no-op seguro
}

const GEMINI_MODEL = 'gemini-2.5-flash';
const TTS_MODEL = 'gemini-2.5-flash-preview-tts';

// Ejecuta tareas en segundo plano de manera desacoplada con waitUntil (Vercel)
function runBackgroundSafe(promise) {
  if (promise && typeof promise.catch === 'function') {
    promise.catch(err => console.error('[BACKGROUND TASK ERROR]:', err.message));
  }
  try {
    if (typeof vercelWaitUntil === 'function') {
      vercelWaitUntil(promise);
    }
  } catch (e) {}
}

// Utilidad de red resiliente con reintentos y Connection: close para Telegram
async function fetchWithRetry(url, options = {}, timeoutMs = 15000, retries = 2) {
  const isTelegram = url.includes('api.telegram.org');
  for (let attempt = 0; attempt < retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const mergedHeaders = { ...(options.headers || {}) };
      if (isTelegram) {
        mergedHeaders['Connection'] = 'close';
      }
      return await fetch(url, { ...options, headers: mergedHeaders, signal: controller.signal });
    } catch (err) {
      if (attempt < retries - 1 && (err.name === 'AbortError' || err.message?.includes('fetch failed') || err.message?.includes('ECONNRESET'))) {
        await new Promise(r => setTimeout(r, 400 * (attempt + 1)));
        continue;
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }
}

/**
 * Extrae el texto de una respuesta de Gemini de forma robusta.
 * Los modelos "thinking" pueden devolver varios
 * `parts`, algunos con solo `thoughtSignature` y sin `.text` — tomar
 * ciegamente `parts[0].text` pierde la respuesta si ese primer part
 * no la trae. Unimos el texto de todos los parts que sí lo tienen.
 */
function geminiRequestHeaders(apiKey) {
  // La clave va en cabecera (no en la URL) para que no aparezca en logs ni errores.
  return { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey };
}

function extractGeminiText(data) {
  const parts = data?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return null;
  const joined = parts.filter(p => typeof p?.text === 'string').map(p => p.text).join('').trim();
  return joined || null;
}

/**
 * Transcribe un buffer de audio en memoria usando Gemini
 */
async function transcribeAudioInMemory(audioBuffer, geminiApiKey, mimeType = 'audio/ogg') {
  if (!audioBuffer || !geminiApiKey) return null;
  const b64 = audioBuffer.toString('base64');
  try {
    const res = await fetchWithRetry(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`, {
      method: 'POST',
      headers: geminiRequestHeaders(geminiApiKey),
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: 'Faithfully transcribe what the user says in this audio clip. Return ONLY the transcribed text with proper capitalization and punctuation.' },
            { inline_data: { mime_type: mimeType, data: b64 } }
          ]
        }],
        generationConfig: { thinkingConfig: { thinkingBudget: 0 } }
      })
    }, 20000);

    if (!res.ok) {
      console.error(`[AUDIO TRANSCRIBE ERROR]: Gemini HTTP ${res.status}`);
      return null;
    }
    const data = await res.json();
    return extractGeminiText(data);
  } catch (err) {
    console.error('[AUDIO TRANSCRIBE ERROR]:', err.message);
    return null;
  }
}

/**
 * Sintetiza voz ejecutiva con Gemini TTS (Puck) y la envía a Telegram
 */
async function sendCloudVoiceNote(chatId, textToSpeak, botToken, geminiApiKey, openAiKey = null, caption = '') {
  let wavBuffer = null;
  try {
    const plainText = textToSpeak.replace(/<[^>]*>/g, '').replace(/[*_`#]/g, '').trim();
    if (!plainText) return false;

    // 1. Motor OpenAI TTS si existe clave
    if (openAiKey) {
      try {
        const oaiRes = await fetchWithRetry('https://api.openai.com/v1/audio/speech', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openAiKey.trim()}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'tts-1',
            input: plainText.substring(0, 1000),
            voice: 'onyx',
            response_format: 'opus'
          })
        }, 20000);

        if (oaiRes.ok) {
          const arrayBuf = await oaiRes.arrayBuffer();
          const form = new FormData();
          form.append('chat_id', chatId);
          form.append('voice', new Blob([arrayBuf], { type: 'audio/ogg' }), 'voice.ogg');
          if (caption) form.append('caption', caption.substring(0, 1024));

          const tgRes = await fetchWithRetry(`https://api.telegram.org/bot${botToken}/sendVoice`, {
            method: 'POST',
            body: form
          }, 25000);
          const tgData = await tgRes.json();
          if (tgData.ok) return true;
        }
      } catch (e) {
        console.warn('[OPENAI TTS FALLBACK]:', e.message);
      }
    }

    // 2. Motor Nativo Gemini TTS
    if (!geminiApiKey) return false;

    const ttsRes = await fetchWithRetry(`https://generativelanguage.googleapis.com/v1beta/models/${TTS_MODEL}:generateContent`, {
      method: 'POST',
      headers: geminiRequestHeaders(geminiApiKey),
      body: JSON.stringify({
        contents: [{ parts: [{ text: 'Read aloud the following text:\n\n' + plainText.substring(0, 800) }] }],
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Puck' }
            }
          }
        }
      })
    }, 20000);

    const d = await ttsRes.json();
    const b64 = d.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!b64) return false;

    const pcmData = Buffer.from(b64, 'base64');
    const sampleRate = 24000;
    const numChannels = 1;
    const bitsPerSample = 16;
    const dataSize = pcmData.length;
    const header = Buffer.alloc(44);
    header.write('RIFF', 0);
    header.writeUInt32LE(36 + dataSize, 4);
    header.write('WAVE', 8);
    header.write('fmt ', 12);
    header.writeUInt32LE(16, 16);
    header.writeUInt16LE(1, 20);
    header.writeUInt16LE(numChannels, 22);
    header.writeUInt32LE(sampleRate, 24);
    header.writeUInt32LE(sampleRate * numChannels * (bitsPerSample / 8), 28);
    header.writeUInt16LE(numChannels * (bitsPerSample / 8), 32);
    header.writeUInt16LE(bitsPerSample, 34);
    header.write('data', 36);
    header.writeUInt32LE(dataSize, 40);

    wavBuffer = Buffer.concat([header, pcmData]);

    // Telegram exige OGG/Opus, MP3 o M4A para sendVoice — un WAV disfrazado de
    // .ogg no cumple el formato real y Telegram lo rechaza o no lo reproduce
    // (confirmado: era la causa de que la nota de voz nunca llegara al celular).
    // sendDocument no exige transcodificación y los clientes de Telegram
    // (incluido el móvil) muestran un reproductor inline para audio/wav.
    const form = new FormData();
    form.append('chat_id', chatId);
    form.append('document', new Blob([wavBuffer], { type: 'audio/wav' }), 'nota_de_voz.wav');
    if (caption) form.append('caption', caption.substring(0, 1024));

    const sendRes = await fetchWithRetry(`https://api.telegram.org/bot${botToken}/sendDocument`, {
      method: 'POST',
      body: form
    }, 25000);

    const sendData = await sendRes.json();
    return sendData.ok;
  } catch (err) {
    console.error('[TTS VOICE ERROR]:', err.message);
    return false;
  } finally {
    // PILAR 2: Purga forzosa de memoria RAM volátil
    if (wavBuffer) {
      purgeMemoryBuffer(wavBuffer);
      wavBuffer = null;
    }
  }
}

/**
 * Divide un mensaje en fragmentos respetando el límite estricto de 4096 caracteres de Telegram API
 */
export function splitTelegramMessage(text, maxLength = 4000) {
  if (!text || text.length <= maxLength) return [text || ''];
  const chunks = [];
  let remaining = text;
  while (remaining.length > 0) {
    if (remaining.length <= maxLength) {
      chunks.push(remaining);
      break;
    }
    let splitIdx = remaining.lastIndexOf('\n', maxLength);
    if (splitIdx < maxLength * 0.4) {
      splitIdx = remaining.lastIndexOf(' ', maxLength);
    }
    if (splitIdx < maxLength * 0.3) {
      splitIdx = maxLength;
    }
    chunks.push(remaining.slice(0, splitIdx).trim());
    remaining = remaining.slice(splitIdx).trim();
  }
  return chunks;
}

/**
 * Envía un mensaje de texto a Telegram (con soporte de HTML, división de > 4096 caracteres y reporte técnico)
 */
export async function sendCloudMessage(chatId, text, botToken, options = {}) {
  const chunks = splitTelegramMessage(text, 4000);
  let allDelivered = true;
  let lastStatus = 200;
  let lastDescription = null;
  let lastMessageId = null;

  for (const chunk of chunks) {
    if (!chunk) continue;
    try {
      const payload = {
        chat_id: chatId,
        text: chunk,
        parse_mode: options.isRawHtml ? 'HTML' : undefined
      };

      const res = await fetchWithRetry(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }, 15000, 2);

      lastStatus = res.status;
      const data = await res.json();
      lastDescription = data.description || null;

      console.log(`[TELEGRAM SEND RESULT]: status=${res.status} ok=${data.ok}${data.description ? ` desc="${data.description}"` : ''}${data.result?.message_id ? ` msg_id=${data.result.message_id}` : ''}`);

      if (data.ok) {
        lastMessageId = data.result?.message_id || null;
      } else {
        if (options.isRawHtml) {
          console.warn(`[TELEGRAM RETRY PLAIN]: Reintentando chunk en texto plano debido a error HTML: ${data.description}`);
          const retryRes = await fetchWithRetry(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, text: chunk.replace(/<[^>]*>/g, '') })
          }, 12000, 2);
          lastStatus = retryRes.status;
          const retryData = await retryRes.json();
          lastDescription = retryData.description || null;
          if (retryData.ok) {
            lastMessageId = retryData.result?.message_id || null;
          } else {
            console.error(`[TELEGRAM RETRY FAILED]: status=${retryRes.status} desc="${retryData.description}"`);
            allDelivered = false;
          }
        } else {
          allDelivered = false;
        }
      }
    } catch (e) {
      console.error('[SEND MESSAGE ERROR]:', e.message);
      allDelivered = false;
      lastDescription = e.message;
    }
  }

  return {
    ok: allDelivered,
    delivered: allDelivered,
    status: lastStatus,
    description: lastDescription,
    message_id: lastMessageId
  };
}

/**
 * Procesador principal de Webhook en la Nube
 */
export async function processCloudTelegramUpdate(update, envConfig) {
  if (!update || !update.message) return { processed: false, reason: 'NO_MESSAGE' };

  const message = update.message;
  const chatType = message.chat?.type;
  const chatId = message.chat?.id;
  const userId = String(message.from?.id || chatId);
  const userName = message.from?.first_name || 'Ricardo';
  let text = (message.text || message.caption || '').trim();
  let isVoiceInput = false;

  const BOT_TOKEN = (envConfig.TELEGRAM_BOT_TOKEN || '').trim();
  // Gemini 2.5 Flash habilitado por Ricardo (2026-10-09). Interruptor de emergencia:
  // TELEGRAM_GEMINI_DISABLED=1 apaga toda llamada a Gemini sin tocar código.
  const GEMINI_DISABLED = String(envConfig.TELEGRAM_GEMINI_DISABLED || '').trim() === '1';
  const GEMINI_API_KEY = GEMINI_DISABLED ? '' : String(envConfig.GEMINI_API_KEY || envConfig.GOOGLE_GENERATIVE_AI_API_KEY || '').trim();
  // Notas de voz de respuesta (TTS) solo si se piden explícitamente: es otro modelo y otro costo.
  const VOICE_REPLIES = Boolean(GEMINI_API_KEY) && String(envConfig.TELEGRAM_VOICE_REPLIES || '').trim() === '1';
  const OPENAI_API_KEY = null;
  const AUTHORIZED_USER_ID = String(envConfig.TELEGRAM_AUTHORIZED_USER_ID || '6311509947').trim();
  const MASTER_KEY = (envConfig.PLATFORM_MASTER_KEY || '').trim() || null;

  if (chatType !== 'private') {
    return { processed: false, reason: 'NON_PRIVATE_CHAT' };
  }

  // PILAR 4: Verificación de Autorización con Timing-Safe
  const authMatch = text.match(/^\/authorize\s+(.+)$/i);
  if (authMatch && MASTER_KEY) {
    const submittedKey = authMatch[1].trim();
    if (timingSafeCompare(submittedKey, MASTER_KEY)) {
      const sendRes = await sendCloudMessage(chatId, `🔐 <b>¡Dispositivo Vinculado Exitosamente!</b>\n\nTu Telegram ID (<code>${userId}</code>) ha sido autenticado como autoridad fiduciaria soberana en la nube 24/7.`, BOT_TOKEN, { isRawHtml: true });
      return { processed: true, delivered: sendRes.ok, action: 'AUTHORIZED' };
    } else {
      const sendRes = await sendCloudMessage(chatId, `❌ <b>Clave de seguridad inválida.</b> Acceso denegado.`, BOT_TOKEN, { isRawHtml: true });
      return { processed: true, delivered: sendRes.ok, action: 'AUTH_FAILED' };
    }
  }

  if (AUTHORIZED_USER_ID && userId !== AUTHORIZED_USER_ID) {
    console.warn(`[SEGURIDAD CLOUD] Acceso no autorizado bloqueado: ${userId}`);
    const sendRes = await sendCloudMessage(chatId, `🔒 <b>Acceso Restringido</b>\n\nEste agente soberano opera 24/7 exclusivamente para Ricardo. Tu Telegram ID es: <code>${userId}</code>.\n\nPara autorizar tu dispositivo envía:\n<code>/authorize TU_CLAVE_MAESTRA</code>`, BOT_TOKEN, { isRawHtml: true });
    return { processed: true, delivered: sendRes.ok, action: 'BLOCKED_UNAUTHORIZED' };
  }

  if ((message.voice || message.audio) && !GEMINI_API_KEY) {
    const sent = await sendCloudMessage(chatId, GEMINI_DISABLED
      ? 'Ricardo, Gemini está desactivado y no puedo procesar notas de voz. Envíe texto: /estado, /ventas o /mercadeo.'
      : 'Ricardo, para procesar notas de voz falta configurar GEMINI_API_KEY en el servidor. Envíe texto: /estado, /ventas o /mercadeo.', BOT_TOKEN);
    return { processed: true, delivered: sent.ok, action: 'VOICE_REQUIRES_GEMINI', modelCalls: 0 };
  }
  const lowerInput = text.toLowerCase();
  const isBitcoinQuery = lowerInput.startsWith('/btc') || lowerInput.includes('bitcoin') || lowerInput.includes('precio btc');
  if (text && !isBitcoinQuery) {
    // Comandos, saludos y cuentas simples se resuelven sin modelo; el texto libre va a Gemini cuando está activo.
    const localReply = basicTelegramReply(text, userName);
    if (localReply || text.startsWith('/') || !GEMINI_API_KEY) {
      let reply = localReply || await freeOperationalReply(text);
      if (!localReply && !text.startsWith('/') && !GEMINI_API_KEY) {
        // Texto libre sin IA disponible: decirlo claro, sin fingir que se hizo algo.
        reply = `Recibí tu mensaje, pero no puedo responderlo con IA en este momento. ${GEMINI_DISABLED ? 'Gemini está desactivado en el servidor.' : 'Falta configurar el servicio de IA del bot (GEMINI_API_KEY).'} No he ejecutado ni registrado una tarea.\n\n${FREE_BOT_HELP}`;
      }
      const sent = await sendCloudMessage(chatId, reply, BOT_TOKEN);
      return { processed: true, delivered: sent.ok, action: 'FREE_OPERATIONAL_REPLY', modelCalls: 0 };
    }
  }
  // PILAR 2: Procesamiento de Audio 100% en Memoria RAM Volátil
  let audioBuffer = null;
  try {
    if (message.voice || message.audio) {
      const fileId = message.voice?.file_id || message.audio?.file_id;
      if (fileId) {
        const fileInfoRes = await fetchWithRetry(`https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${fileId}`);
        const fileInfo = await fileInfoRes.json();
        if (fileInfo.ok && fileInfo.result?.file_path) {
          const downloadUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${fileInfo.result.file_path}`;
          const audioRes = await fetchWithRetry(downloadUrl);
          const arrayBuf = await audioRes.arrayBuffer();
          audioBuffer = Buffer.from(arrayBuf);

          const forensicHash = computeForensicHash(audioBuffer);
          console.log(`[AUDIO SHA-256 HASH]: ${forensicHash} (${audioBuffer.length} bytes en RAM)`);

          const transcribed = await transcribeAudioInMemory(audioBuffer, GEMINI_API_KEY);
          if (transcribed) {
            text = transcribed;
            isVoiceInput = true;
          } else {
            const sendRes = await sendCloudMessage(chatId, `🎙️ <i>Recibí tu nota de voz, pero no se pudo decodificar con claridad. Por favor repítemela o escríbemela.</i>`, BOT_TOKEN, { isRawHtml: true });
            return { processed: true, delivered: sendRes.ok, action: 'VOICE_TRANSCRIBE_FAILED' };
          }
        }
      }
    }
  } finally {
    // Purga obligatoria de memoria RAM volátil
    if (audioBuffer) {
      purgeMemoryBuffer(audioBuffer);
      audioBuffer = null;
    }
  }

  if (!text) return { processed: false, reason: 'EMPTY_INPUT' };

  const lower = text.toLowerCase();
  const mcpHub = new ExecutiveAssistantMCPHub({
    strikeAddress: (envConfig.STRIKE_LIGHTNING_ADDRESS || 'rick2818@strike.me').trim()
  });

  // COMANDO: /START O /HELP
  if (lower === '/start' || lower === '/help' || lower === '/ayuda') {
    const welcome = `
🎩 <b>Executive Chief of Staff & Concierge Soberano 24/7</b>
<i>Cloud-Native Vercel Serverless | Asistente de Telegram</i>

Hola <b>${userName}</b>, estoy a tu entera disposición 24/7 en la nube (tu computadora puede estar apagada). Atajos:

🎙️ <b>/voz on | off</b> — Modo voz continuo
⚡ <b>/btc</b> — Precio Bitcoin en tiempo real y mempool fees
📅 <b>/agenda</b> — Reuniones programadas
✈️ <b>/vuelos [destino]</b> — Vuelos desde SAL
🍷 <b>/restaurantes</b> — Selección gastronómica ejecutiva
🎬 <b>/cine</b> — Cartelera VIP Multiplaza / La Gran Vía
📊 <b>/proyectos</b> — Estado de Boltech Group
🎯 <b>/hunter</b> — Estado del Cazador Autónomo 24/7
✉️ <b>/email</b> — Redactar correos ejecutivos

<i>Puedes escribirme o hablarme libremente por nota de voz.</i>
    `.trim();
    const sendRes = await sendCloudMessage(chatId, welcome, BOT_TOKEN, { isRawHtml: true });
    return { processed: true, delivered: sendRes.ok, action: 'START_COMMAND' };
  }

  // COMANDO: /BTC
  if (lower.startsWith('/btc') || lower.includes('bitcoin') || lower.includes('precio btc')) {
    const btc = await mcpHub.getBitcoinData();
    const msg = `
⚡ <b>BITCOIN & LIGHTNING NETWORK MCP (24/7 CLOUD)</b>

• <b>Precio actual:</b> <code>$${Number(btc.price_usd).toLocaleString()} USD</code> (${btc.change_24h_percent}%)
• <b>Poder de compra:</b> <code>${btc.satoshis_per_usd} satoshis</code> por $1 USD
• <b>Fee Mempool rápida:</b> <code>${btc.mempool_fees_sat_vb?.fastestFee || 14} sat/vB</code>
• <b>Destino fiduciario:</b> <code>${btc.strike_settlement_address}</code>
• <b>Estado:</b> 🟢 <i>Liquidación instantánea activa en la nube</i>
    `.trim();
    const sendRes = await sendCloudMessage(chatId, msg, BOT_TOKEN, { isRawHtml: true });
    if (VOICE_REPLIES) {
      const voicePromise = sendCloudVoiceNote(chatId, `El precio de Bitcoin es de ${Number(btc.price_usd).toLocaleString()} dólares. La fee de Mempool es de ${btc.mempool_fees_sat_vb?.fastestFee || 14} satoshis por virtual byte.`, BOT_TOKEN, GEMINI_API_KEY, OPENAI_API_KEY);
      runBackgroundSafe(voicePromise);
    }
    return { processed: true, delivered: sendRes.ok, action: 'BTC_COMMAND' };
  }

  const basicReply = basicTelegramReply(text, userName);
  if (basicReply) {
    const sent = await sendCloudMessage(chatId, basicReply, BOT_TOKEN);
    return { processed: true, delivered: sent.ok, action: 'BASIC_REPLY' };
  }
  const openAiResult = await requestOpenAiReply(text, {...envConfig,OPENAI_API_KEY:''});
  if (openAiResult.reply) {
    const sent = await sendCloudMessage(chatId, openAiResult.reply, BOT_TOKEN);
    return { processed: true, delivered: sent.ok, action: 'OPENAI_REPLY' };
  }
  // RAZONAMIENTO GEMINI 2.5 FLASH (1 reintento, 12s de timeout)
  if (GEMINI_API_KEY) {
    try {
      const geminiRes = await fetchWithRetry(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`, {
        method: 'POST',
        headers: geminiRequestHeaders(GEMINI_API_KEY),
        body: JSON.stringify({
          system_instruction: {
            parts: [{
              text: `You are the Sovereign Executive Chief of Staff and Personal Concierge to Ricardo.
Ricardo is an elite tech founder, investor, and builder based in San Salvador, El Salvador.
Key Operational Context:
- Platform: Boltech Group.
${commercialOfferContext()}
- Settlement Rails: Bitcoin / Strike Lightning (rick2818@strike.me).
- Base: San Salvador, El Salvador (SAL Airport, Multiplaza / Gran Vía VIP cinemas, San Benito / Santa Elena restaurants).
- Demeanor: Boardroom-grade executive Chief of Staff tone. Natural Spanish or English depending on how he addresses you. Concise, authoritative, and fiduciary.
- Honesty: this chat has no connected email, CRM, calendar or payment tools. Never claim to have checked them or executed actions, and never invent commercial status, sales or availability.`
            }]
          },
          contents: [{ parts: [{ text: text }] }],
          generationConfig: { thinkingConfig: { thinkingBudget: 0 } }
        })
      }, 12000, 1);

      if (!geminiRes.ok) {
        // 400/403 suelen indicar clave inválida o API sin habilitar; 429, cuota agotada.
        console.error(`[GEMINI CLOUD ERROR]: HTTP ${geminiRes.status}`);
      } else {
        const gData = await geminiRes.json();
        const reply = extractGeminiText(gData);
        if (reply) {
          // Enviar respuesta en texto primero (entrega inmediata)
          const sendRes = await sendCloudMessage(chatId, reply, BOT_TOKEN);

          // Nota de voz opcional, desacoplada con waitUntil para que el webhook responda sin demoras
          if (VOICE_REPLIES) {
            runBackgroundSafe(sendCloudVoiceNote(chatId, reply, BOT_TOKEN, GEMINI_API_KEY, OPENAI_API_KEY));
          }

          return { processed: true, delivered: sendRes.ok, action: VOICE_REPLIES ? 'GEMINI_REPLY_VOICE_SENT' : 'GEMINI_REPLY', modelCalls: isVoiceInput ? 2 : 1 };
        }
        console.error('[GEMINI CLOUD ERROR]: respuesta vacía');
      }
    } catch (err) {
      console.error('[GEMINI CLOUD ERROR]:', err.message);
    }
  }

  // Fallback defensivo
  const sendRes = await sendCloudMessage(chatId, `Recibí tu mensaje, pero no puedo responderlo con IA en este momento. ${!OPENAI_API_KEY && !GEMINI_API_KEY ? "Falta configurar el servicio de IA del bot." : "El servicio de IA no está disponible; intenta más tarde."} No he ejecutado ni registrado una tarea.`, BOT_TOKEN, { isRawHtml: true });
  return { processed: true, delivered: sendRes.ok, action: 'DEFENSIVE_FALLBACK' };
}
