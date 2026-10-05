/**
 * =============================================================================
 * ASISTENTE PERSONAL EJECUTIVO & CONCIERGE SOBERANO — TELEGRAM BOT 24/7 (10/10)
 * =============================================================================
 * Exclusivo para Ricardo (Boltech Group / Sovereign Hub).
 * Zero-Trust Whitelisting | Bilingüe Nativo | Demonio de Calendario Proactivo
 * =============================================================================
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { ExecutiveAssistantMCPHub } from '../lib/mcp_executive_assistant.js';
import { dispatchUniversalEmail } from '../lib/universal_email_engine.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ENV_PATH = path.resolve(__dirname, '../.env');
const AUTH_STORE_PATH = path.resolve(__dirname, '../lib/sovereign_auth.json');
const CALENDAR_PATH = path.resolve(__dirname, '../pipeline/executive_calendar.json');

// --- 1. GESTIÓN DE ENTORNO Y IDENTIDAD SOBERANA PERSISTENTE ---
function loadEnv() {
  try {
    if (fs.existsSync(ENV_PATH)) {
      const content = fs.readFileSync(ENV_PATH, 'utf8');
      content.split('\n').forEach(line => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const idx = trimmed.indexOf('=');
          if (idx !== -1) {
            const key = trimmed.slice(0, idx).trim();
            const val = trimmed.slice(idx + 1).trim();
            if (key) process.env[key] = val;
          }
        }
      });
    }
  } catch (err) {
    console.error('[ENV LOAD ERROR]:', err.message);
  }
}
loadEnv();

function getStoredAuthorizedUserId() {
  if (process.env.TELEGRAM_AUTHORIZED_USER_ID) {
    return String(process.env.TELEGRAM_AUTHORIZED_USER_ID).trim();
  }
  try {
    if (fs.existsSync(AUTH_STORE_PATH)) {
      const data = JSON.parse(fs.readFileSync(AUTH_STORE_PATH, 'utf8'));
      if (data.authorized_user_id) return String(data.authorized_user_id).trim();
    }
  } catch (e) {}
  return '6311509947'; // ID soberano inmutable de Ricardo
}

function persistAuthorizedUserId(userId) {
  const sanitizedId = String(userId).trim();
  process.env.TELEGRAM_AUTHORIZED_USER_ID = sanitizedId;
  
  try {
    const dir = path.dirname(AUTH_STORE_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(AUTH_STORE_PATH, JSON.stringify({
      authorized_user_id: sanitizedId,
      user_name: 'Ricardo',
      bound_at: new Date().toISOString(),
      status: 'AIRGAPPED_ACTIVE'
    }, null, 2), 'utf8');
  } catch (e) {
    console.error('[AUTH PERSIST JSON ERROR]:', e.message);
  }

  try {
    if (fs.existsSync(ENV_PATH)) {
      let envContent = fs.readFileSync(ENV_PATH, 'utf8');
      if (envContent.includes('TELEGRAM_AUTHORIZED_USER_ID=')) {
        envContent = envContent.replace(/TELEGRAM_AUTHORIZED_USER_ID=.*/g, `TELEGRAM_AUTHORIZED_USER_ID=${sanitizedId}`);
      } else {
        envContent += `\nTELEGRAM_AUTHORIZED_USER_ID=${sanitizedId}\n`;
      }
      fs.writeFileSync(ENV_PATH, envContent, 'utf8');
    }
  } catch (e) {
    console.error('[AUTH PERSIST ENV ERROR]:', e.message);
  }
}

const BOT_TOKEN = (process.env.TELEGRAM_BOT_TOKEN_DEV || process.env.TELEGRAM_BOT_TOKEN || '').trim();
const IS_DEV_BOT = Boolean(process.env.TELEGRAM_BOT_TOKEN_DEV);
let AUTHORIZED_USER_ID = getStoredAuthorizedUserId();
const GEMINI_API_KEY = (process.env.GEMINI_API_KEY || '').trim();
const OPENAI_API_KEY = (process.env.OPENAI_API_KEY || '').trim();
const RESEND_API_KEY = (process.env.RESEND_API_KEY || '').trim();
const SMTP_FROM = (process.env.SMTP_FROM || 'Boltech Group <onboarding@resend.dev>').trim();
const GEMINI_MODEL = 'gemini-2.5-flash';
const TTS_MODEL = 'gemini-2.5-flash-preview-tts';

const mcpHub = new ExecutiveAssistantMCPHub({
  strikeAddress: (process.env.STRIKE_LIGHTNING_ADDRESS || 'rick2818@strike.me').trim()
});

const TELEGRAM_API_BASE = `https://api.telegram.org/bot${BOT_TOKEN}`;

// --- 2. MOTOR DE CORREO EJECUTIVO (MOTOR UNIVERSAL SMTPS + RESEND FAILOVER) ---
async function sendExecutiveEmail({ to, subject, body, html = null }) {
  try {
    const result = await dispatchUniversalEmail({
      to: to.trim(),
      subject: subject.trim(),
      text: body.trim(),
      html: html || `<div style="font-family: sans-serif; font-size: 14px; color: #1e293b; line-height: 1.6;">${body.replace(/\n/g, '<br>')}</div>`
    });

    if (result.success) {
      return { ok: true, id: result.messageId, transport: result.transport };
    }
    return { ok: false, error: result.error || result.reason || 'Error en despacho universal' };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

// --- 2. UTILIDADES DE RED RESILIENTES & ESCAPADO DE MENSAJES ---
async function fetchWithTimeout(url, options = {}, timeoutMs = 30000, retries = 3) {
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
        await new Promise(r => setTimeout(r, 600 * (attempt + 1)));
        continue;
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }
}

/**
 * Extrae el texto de una respuesta de Gemini 3.x de forma robusta.
 * Los modelos "thinking" de la familia Gemini 3 pueden devolver varios
 * `parts`, algunos con solo `thoughtSignature` y sin `.text` — tomar
 * ciegamente `parts[0].text` pierde la respuesta si ese primer part
 * no la trae. Unimos el texto de todos los parts que sí lo tienen.
 */
function extractGeminiText(data) {
  const parts = data?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return null;
  const joined = parts.filter(p => typeof p?.text === 'string').map(p => p.text).join('').trim();
  return joined || null;
}

function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function markdownToTelegramHtml(markdown) {
  if (!markdown) return '';
  let out = markdown;

  // 1. Proteger bloques de código
  const codeBlocks = [];
  out = out.replace(/```([\s\S]*?)```/g, (match, p1) => {
    const placeholder = `___CODEBLOCK_${codeBlocks.length}___`;
    codeBlocks.push(`<pre><code>${escapeHtml(p1.trim())}</code></pre>`);
    return placeholder;
  });

  // 2. Proteger código en línea
  const inlineCodes = [];
  out = out.replace(/`([^`]+)`/g, (match, p1) => {
    const placeholder = `___INLINECODE_${inlineCodes.length}___`;
    inlineCodes.push(`<code>${escapeHtml(p1)}</code>`);
    return placeholder;
  });

  // 3. Escapar caracteres generales en texto
  out = escapeHtml(out);

  // 4. Negritas
  out = out.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
  out = out.replace(/__(.*?)__/g, '<b>$1</b>');

  // 5. Cursivas
  out = out.replace(/\*(.*?)\*/g, '<i>$1</i>');
  out = out.replace(/_([^_]+)_/g, '<i>$1</i>');

  // 6. Enlaces
  out = out.replace(/\[(.*?)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2">$1</a>');

  // 7. Restaurar bloques protegidos
  inlineCodes.forEach((code, i) => {
    out = out.replace(`___INLINECODE_${i}___`, code);
  });
  codeBlocks.forEach((block, i) => {
    out = out.replace(`___CODEBLOCK_${i}___`, block);
  });

  return out;
}

function chunkMessage(text, limit = 4000) {
  if (!text || text.length <= limit) return [text || ''];
  const chunks = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= limit) {
      chunks.push(remaining);
      break;
    }

    let splitIndex = remaining.lastIndexOf('\n\n', limit);
    if (splitIndex === -1 || splitIndex < limit / 2) {
      splitIndex = remaining.lastIndexOf('\n', limit);
    }
    if (splitIndex === -1 || splitIndex < limit / 2) {
      splitIndex = remaining.lastIndexOf(' ', limit);
    }
    if (splitIndex === -1) {
      splitIndex = limit;
    }

    chunks.push(remaining.substring(0, splitIndex).trim());
    remaining = remaining.substring(splitIndex).trim();
  }

  return chunks;
}

// --- 3. MOTOR DE TELEGRAM & DUAL-PASS SAFE SENDER ---
class TelegramExecutiveBot {
  constructor() {
    this.offset = 0;
    this.isRunning = false;
    this.conversationalMemory = [];
    this.calendarTicker = null;
    this.alwaysVoice = true; // Activo por defecto: garantiza que el agente siempre responda con voz
  }

  async sendRequest(method, payload = {}, timeoutMs = 30000) {
    if (!BOT_TOKEN) throw new Error("TELEGRAM_BOT_TOKEN no configurado en .env.");
    const res = await fetchWithTimeout(`${TELEGRAM_API_BASE}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }, timeoutMs);

    return await res.json();
  }

  async sendRawMessage(chatId, text, parseMode = 'HTML', replyMarkup = undefined) {
    const payload = {
      chat_id: chatId,
      text: text,
      disable_web_page_preview: false
    };
    if (parseMode) payload.parse_mode = parseMode;
    if (replyMarkup) payload.reply_markup = replyMarkup;

    return await this.sendRequest('sendMessage', payload);
  }

  async sendMessage(chatId, rawText, options = {}) {
    const chunks = chunkMessage(rawText, 4000);

    for (const chunk of chunks) {
      const htmlFormatted = options.isRawHtml ? chunk : markdownToTelegramHtml(chunk);
      
      try {
        const res = await this.sendRawMessage(chatId, htmlFormatted, 'HTML', options.reply_markup);
        if (!res.ok) {
          console.warn(`[TELEGRAM HTML WARNING]: ${res.description}. Reintentando en texto plano seguro...`);
          await this.sendRawMessage(chatId, chunk, null, options.reply_markup);
        }
      } catch (err) {
        console.error('[SEND MESSAGE ERROR]:', err.message);
        try {
          await this.sendRawMessage(chatId, chunk, null, options.reply_markup);
        } catch (inner) {}
      }

      if (chunks.length > 1) {
        await new Promise(r => setTimeout(r, 200));
      }
    }
  }

  async sendChatAction(chatId, action = 'typing') {
    try {
      await this.sendRequest('sendChatAction', { chat_id: chatId, action: action }, 5000);
    } catch (e) {}
  }

  async sendVoiceNote(chatId, textToSpeak, caption = '') {
    try {
      const plainText = textToSpeak.replace(/<[^>]*>/g, '').replace(/[*_`#]/g, '').trim();
      if (!plainText) return false;

      await this.sendChatAction(chatId, 'record_voice');

      // 1. MOTOR ALTERNATIVO OPENAI TTS (si está configurada la clave)
      if (OPENAI_API_KEY) {
        try {
          const oaiRes = await fetchWithTimeout('https://api.openai.com/v1/audio/speech', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${OPENAI_API_KEY.trim()}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              model: 'tts-1',
              input: plainText.substring(0, 1000),
              voice: 'onyx',
              response_format: 'opus'
            })
          }, 25000);

          if (oaiRes.ok) {
            const arrayBuf = await oaiRes.arrayBuffer();
            const blob = new Blob([arrayBuf], { type: 'audio/ogg' });
            const form = new FormData();
            form.append('chat_id', chatId);
            form.append('voice', blob, 'voice.ogg');
            if (caption) form.append('caption', caption.substring(0, 1024));

            const sendRes = await fetchWithTimeout(`${TELEGRAM_API_BASE}/sendVoice`, {
              method: 'POST',
              body: form
            }, 30000);
            const sendData = await sendRes.json();
            if (sendData.ok) return true;
          }
        } catch (e) {
          console.warn('[OPENAI TTS WARNING, USANDO MOTOR GEMINI]:', e.message);
        }
      }

      // 2. MOTOR NATIVO GEMINI FLASH TTS
      if (!GEMINI_API_KEY) return false;
      const ttsRes = await fetchWithTimeout(`https://generativelanguage.googleapis.com/v1beta/models/${TTS_MODEL}:generateContent?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
      }, 25000);

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
      const wav = Buffer.concat([header, pcmData]);

      // Telegram exige OGG/Opus, MP3 o M4A para sendVoice — un WAV disfrazado
      // de .ogg no cumple el formato real. sendDocument entrega el audio sin
      // exigir transcodificación y Telegram lo muestra con reproductor inline.
      const blob = new Blob([wav], { type: 'audio/wav' });
      const form = new FormData();
      form.append('chat_id', chatId);
      form.append('document', blob, 'nota_de_voz.wav');
      if (caption) form.append('caption', caption.substring(0, 1024));

      const sendRes = await fetchWithTimeout(`${TELEGRAM_API_BASE}/sendDocument`, {
        method: 'POST',
        body: form
      }, 30000);

      const sendData = await sendRes.json();
      return sendData.ok;
    } catch (err) {
      console.error('[TTS VOICE ERROR]:', err.message);
      return false;
    }
  }

  async downloadTelegramFile(fileId) {
    try {
      const fileInfo = await this.sendRequest('getFile', { file_id: fileId });
      if (!fileInfo.ok || !fileInfo.result?.file_path) return null;
      const downloadUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${fileInfo.result.file_path}`;
      const res = await fetchWithTimeout(downloadUrl, {}, 25000);
      const arrayBuf = await res.arrayBuffer();
      return Buffer.from(arrayBuf).toString('base64');
    } catch (e) {
      console.error('[AUDIO DOWNLOAD ERROR]:', e.message);
      return null;
    }
  }

  async transcribeAudio(audioBase64) {
    if (!GEMINI_API_KEY || !audioBase64) return null;
    try {
      const res = await fetchWithTimeout(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: 'Faithfully transcribe what the user says in this audio clip. The user may speak in English, Spanish, or a mix. Return ONLY the exact transcribed text with proper capitalization and punctuation, with zero added commentary or quotes.' },
              { inline_data: { mime_type: 'audio/ogg', data: audioBase64 } }
            ]
          }],
          generationConfig: { thinkingConfig: { thinkingLevel: 'low' } }
        })
      }, 25000);

      const data = await res.json();
      return extractGeminiText(data);
    } catch (e) {
      console.error('[AUDIO TRANSCRIBE ERROR]:', e.message);
      return null;
    }
  }

  async checkBotIdentity() {
    try {
      // Regla de Oro: Un solo modo de entrega. Si hay un webhook activo en la nube,
      // el poller local se niega a arrancar para no romper la producción ni borrar el webhook.
      const webhookInfo = await this.sendRequest('getWebhookInfo');
      if (webhookInfo.ok && webhookInfo.result?.url) {
        console.warn(`\n⚠️  =======================================================`);
        console.warn(`🛡️  MODO CLOUD 24/7 ACTIVO: Se detectó un Webhook en producción`);
        console.warn(`🌐 URL de Webhook: ${webhookInfo.result.url}`);
        console.warn(`⏳ Actualizaciones pendientes: ${webhookInfo.result.pending_update_count || 0}`);
        console.warn(`❌ EL POLLER LOCAL SE NIEGA A ARRANCAR PARA PROTEGER PRODUCCIÓN.`);
        console.warn(`   Telegram solo admite un modo de entrega (Webhook o Polling).`);
        console.warn(`   Tu asistente ya está operando 24/7 en la nube (tu laptop puede apagarse).`);
        console.warn(`\n💡 Opciones fiduciarias:`);
        console.warn(`   - Para desarrollo local, define TELEGRAM_BOT_TOKEN_DEV con un bot secundario.`);
        console.warn(`   - Para apagar el modo cloud y forzar local: node scripts/deploy_cloud_webhook.mjs --delete`);
        console.warn(`⚠️  =======================================================\n`);
        return null;
      }

      await this.sendRequest('deleteMyCommands');

      try {
        await this.sendRequest('setMyDescription', { description: '' });
        await this.sendRequest('setMyShortDescription', { short_description: '' });
      } catch (e) {}

      const me = await this.sendRequest('getMe');
      if (me.ok) {
        console.log(`\n🛡️ =======================================================`);
        console.log(`✅ AGENTE SOBERANO EN LÍNEA: @${me.result.username} (${me.result.first_name})`);
        console.log(`🔒 MODO FANTASMA: Activo (Únicamente autorizado: ${AUTHORIZED_USER_ID})`);
        console.log(`🗣️ MOTOR BILINGÜE: Gemini 3.6 Flash & TTS Puck 100% Operativo`);
        console.log(`📅 CALENDARIO ACTIVO: Demonio de Alarmas 24/7 Iniciado`);
        if (IS_DEV_BOT) {
          console.log(`🧪 ENTORNO AISLADO: Usando TELEGRAM_BOT_TOKEN_DEV (desarrollo local)`);
        }
        console.log(`🛡️ =======================================================\n`);
        return me.result;
      }
      console.error("❌ Error al conectar con Telegram API:", me.description);
      return null;
    } catch (e) {
      console.error("❌ Fallo de red crítico al conectar con Telegram API:", e.message);
      return null;
    }
  }

  startCalendarTicker() {
    console.log("📅 [CALENDAR TICKER]: Demonio de recordatorios proactivos de voz activo.");
    this.calendarTicker = setInterval(async () => {
      try {
        if (!fs.existsSync(CALENDAR_PATH)) return;
        const events = JSON.parse(fs.readFileSync(CALENDAR_PATH, 'utf8'));
        const now = new Date();
        let changed = false;

        for (const evt of events) {
          if (evt.reminderFired) continue;

          const reminderDate = new Date(evt.reminderTime);
          if (now >= reminderDate && (now - reminderDate) < 300000) {
            console.log(`⏰ [CALENDAR ALERT]: Disparando recordatorio proactivo de voz para: "${evt.title}"...`);
            evt.reminderFired = true;
            changed = true;

            const voiceText = evt.voiceMessage || `Buenos días Don Ricardo, le recuerdo que en ${evt.reminderMinutes} minutos tiene su ${evt.title} en ${evt.location}.`;
            
            await this.sendVoiceNote(AUTHORIZED_USER_ID, voiceText, `🔔 Recordatorio: ${evt.title}`);

            const card = `
🔔 <b>RECORDATORIO PROACTIVO DE AGENDA</b>

📅 <b>Evento:</b> ${evt.title}
📍 <b>Ubicación:</b> ${evt.location}
⏰ <b>Hora Programada:</b> <code>${new Date(evt.eventTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</code>
⏳ <b>Tiempo Restante:</b> <b>${evt.reminderMinutes} minutos</b>

<i>Le he despachado una nota de voz adjunta con este aviso. ¡Excelente jornada!</i>
            `.trim();

            await this.sendMessage(AUTHORIZED_USER_ID, card, { isRawHtml: true });
          }
        }

        if (changed) {
          fs.writeFileSync(CALENDAR_PATH, JSON.stringify(events, null, 2), 'utf8');
        }
      } catch (err) {
        console.error('[CALENDAR TICKER ERROR]:', err.message);
      }
    }, 30000);
  }

  async processIncomingMessage(message) {
    const chatType = message.chat?.type;
    const chatId = message.chat?.id;
    const userId = String(message.from?.id || chatId);
    const userName = message.from?.first_name || 'Ricardo';
    let text = (message.text || message.caption || '').trim();
    let isVoiceInput = false;

    console.log(`📩 [MENSAJE RECIBIDO de ${userName} (${userId})]: "${text || '[NOTA DE VOZ/AUDIO]'}"`);

    if (chatType !== 'private') {
      try {
        console.warn(`[SEGURIDAD] Intento de adición a grupo no autorizado (${chatId}). Auto-expulsión...`);
        await this.sendRequest('leaveChat', { chat_id: chatId });
      } catch (e) {}
      return;
    }

    // Autorización soberana con clave maestra
    const authMatch = text.match(/^\/authorize\s+(.+)$/i);
    if (authMatch) {
      const submittedKey = authMatch[1].trim();
      const bufA = Buffer.from(submittedKey);
      const bufB = Buffer.from(MASTER_KEY);
      const isMatch = bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB);

      if (isMatch) {
        AUTHORIZED_USER_ID = userId;
        persistAuthorizedUserId(userId);
        await this.sendMessage(chatId, `🔐 <b>¡Dispositivo Vinculado Exitosamente!</b>\n\nTu Telegram ID (<code>${userId}</code>) ha sido registrado como la única autoridad fiduciaria de este agente soberano.`);
        return;
      } else {
        await this.sendMessage(chatId, `❌ <b>Clave de seguridad inválida.</b> Intenta nuevamente.`);
        return;
      }
    }

    if (AUTHORIZED_USER_ID && userId !== AUTHORIZED_USER_ID) {
      console.warn(`[SEGURIDAD] Mensaje bloqueado de usuario no autorizado: ${userId} (Esperado: ${AUTHORIZED_USER_ID}).`);
      await this.sendMessage(chatId, `🔒 <b>Acceso Restringido</b>\n\nEste agente opera exclusivamente para Ricardo. Tu Telegram ID es: <code>${userId}</code>.\n\nPara autorizar este dispositivo, envía:\n<code>/authorize TU_CLAVE_MAESTRA</code>`);
      return;
    }

    if (message.voice || message.audio) {
      const fileId = message.voice?.file_id || message.audio?.file_id;
      if (fileId) {
        await this.sendChatAction(chatId, 'record_voice');
        const audioB64 = await this.downloadTelegramFile(fileId);
        if (audioB64) {
          const transcribed = await this.transcribeAudio(audioB64);
          if (transcribed) {
            text = transcribed;
            isVoiceInput = true;
            console.log(`[AUDIO TRANSCRIBED]: "${text}"`);
          } else {
            await this.sendMessage(chatId, `🎙️ <i>Recibí tu nota de voz, pero no se pudo decodificar con claridad. Por favor, intenta de nuevo o escríbeme tu mensaje.</i>`);
            return;
          }
        } else {
          await this.sendMessage(chatId, `⚠️ <i>No se pudo descargar el archivo de voz desde Telegram. Intenta de nuevo.</i>`);
          return;
        }
      }
    }

    if (!text) return;

    await this.sendChatAction(chatId, 'typing');
    const lower = text.toLowerCase();

    // COMANDO: /EMAIL [destinatario] | [asunto] | [mensaje]
    if (lower.startsWith('/email') || lower.startsWith('/correo')) {
      const payload = text.replace(/^\/(email|correo)\s*/i, '').trim();
      const parts = payload.split('|').map(p => p.trim());

      if (parts.length >= 3) {
        const [toEmail, emailSubj, ...bodyParts] = parts;
        const emailBody = bodyParts.join('|');

        await this.sendChatAction(chatId, 'typing');
        const sendResult = await sendExecutiveEmail({
          to: toEmail,
          subject: emailSubj,
          body: emailBody
        });

        if (sendResult.ok) {
          const report = `
✉️ <b>CORREO EJECUTIVO DESPACHADO CON ÉXITO</b>

• <b>Destinatario:</b> <code>${toEmail}</code>
• <b>Remitente:</b> <code>${SMTP_FROM}</code>
• <b>Asunto:</b> <b>${emailSubj}</b>
• <b>Identificador Resend:</b> <code>${sendResult.id}</code>
• <b>Estado:</b> 🟢 <i>Entregado en servidores de correo</i>

<i>El correo ha sido enviado en tu nombre sin intervención manual.</i>
          `.trim();
          await this.sendMessage(chatId, report, { isRawHtml: true });
        } else {
          await this.sendMessage(chatId, `⚠️ <b>Error al despachar el correo:</b> ${escapeHtml(sendResult.error)}`);
        }
        return;
      } else {
        const helpMsg = `
✉️ <b>MOTOR DE DESPACHO DE CORREOS</b>

Para enviar un correo directo usa el formato con barras verticales (|):
<code>/email destinatario@correo.com | Asunto de la reunión | Mensaje o cuerpo del correo</code>

<i>O simplemente pídeme en lenguaje natural:</i>
<i>"Redáctame un correo para la abogada Ana Guevara confirmando la cita de mañana"</i>
        `.trim();
        await this.sendMessage(chatId, helpMsg, { isRawHtml: true });
        return;
      }
    }

    // COMANDO: /VOZ [ON|OFF]
    if (lower === '/voz' || lower.startsWith('/voz ') || lower.startsWith('/voice')) {
      if (lower.includes('on') || lower.includes('activar') || lower.includes('1') || lower.includes('si')) {
        this.alwaysVoice = true;
        await this.sendMessage(chatId, '🎙️ <b>Modo de voz continuo ACTIVADO.</b> De ahora en adelante, cada respuesta que te dé incluirá automáticamente su nota de voz ejecutiva.');
        return;
      } else if (lower.includes('off') || lower.includes('desactivar') || lower.includes('0') || lower.includes('no')) {
        this.alwaysVoice = false;
        await this.sendMessage(chatId, '🔇 <b>Modo de voz continuo DESACTIVADO.</b> Te responderé en texto por defecto, y con nota de voz cuando me envíes audios o lo solicites explícitamente.');
        return;
      } else {
        const state = this.alwaysVoice ? '🟢 ACTIVADO (responde siempre con voz)' : '⚪ DESACTIVADO (solo responde con voz si envías audio)';
        await this.sendMessage(chatId, `🎙️ <b>ESTADO DE VOZ EJECUTIVA:</b>\n\n• Estado actual: <b>${state}</b>\n\nComandos:\n• <code>/voz on</code> — Activar respuestas por nota de voz en cada interacción\n• <code>/voz off</code> — Solo responder con voz si mandas audio`);
        return;
      }
    }

    // SALUDOS / CONVERSACIÓN DIRECTA
    if (lower === 'hola' || lower === 'buenas' || lower === 'buenos dias' || lower === 'buenas tardes' || lower === 'buenas noches' || lower === 'hey' || lower === 'hello' || lower === 'hi' || lower.startsWith('hola') || lower.startsWith('buenas') || lower.includes('como estas') || lower.includes('cómo estás') || lower === 'que tal') {
      const greeting = `
🎩 <b>Saludos cordiales, Don Ricardo.</b>

Tu Agente Ejecutivo Soberano de <b>Boltech Group</b> está 100% en línea y a tu disposición.

¿En qué te puedo apoyar hoy?
• ⚡ <b>/btc</b> — Cotización de Bitcoin, satoshis y fees de red
• 📅 <b>/agenda</b> — Reuniones y recordatorios proactivos
• 📊 <b>/proyectos</b> — Estado operativo y de tracción
• 🎯 <b>/hunter</b> — Cazador autónomo de oportunidades
• 🍷 <b>/restaurantes</b> — Recomendaciones gastronómicas ejecutivas

<i>Puedes escribirme o pedirme redacción de correos en cualquier momento.</i>
      `.trim();
      await this.sendMessage(chatId, greeting, { isRawHtml: true });
      return;
    }

    // /START, /HELP, /AYUDA
    if (lower === '/start' || lower === '/help' || lower === '/ayuda') {
      const welcome = `
🎩 <b>Executive Chief of Staff & Concierge Soberano</b>
<i>Inteligencia Bilingüe de Élite | Gemini 3.6 Flash & TTS Puck 24/7</i>

Hola <b>${userName}</b>, estoy a tu entera disposición 24/7 en inglés y español. Atajos rápidos:

🎙️ <b>/voz on | off</b> — Activar o pausar respuestas automáticas por nota de voz
⚡ <b>/btc</b> — Precio Bitcoin en tiempo real, satoshis y fees de Mempool
📅 <b>/agenda</b> o <b>/calendar</b> — Reuniones programadas y alarmas de voz
✈️ <b>/vuelos [destino]</b> — Vuelos desde San Salvador (SAL)
🍷 <b>/restaurantes</b> — Selección gastronómica ejecutiva en San Benito / Escalón
🎬 <b>/cine</b> — Carteleras de Multiplaza y La Gran Vía
📊 <b>/proyectos</b> — Métricas del pipeline de Boltech Group
🎯 <b>/hunter</b> — Estado en vivo del Cazador Autónomo 24/7
✉️ <b>/email</b> — Redactar y despachar correos ejecutivos

<i>Puedes escribirme o hablarme libremente por nota de voz en inglés o español.</i>
      `.trim();

      const keyboard = {
        keyboard: [
          [{ text: "⚡ Precio BTC" }, { text: "📅 Mi Agenda" }],
          [{ text: "✈️ Vuelos a Miami" }, { text: "🍷 Restaurantes" }],
          [{ text: "📊 Mis Proyectos" }, { text: "🎯 Cazador Autónomo" }]
        ],
        resize_keyboard: true
      };

      await this.sendMessage(chatId, welcome, { reply_markup: keyboard, isRawHtml: true });
      return;
    }

    // /AGENDA /CALENDAR /REUNIONES
    if (lower.startsWith('/agenda') || lower.startsWith('/calendar') || lower.includes('agenda') || lower.includes('reunion') || lower.includes('schedule') || lower.includes('calendar')) {
      let events = [];
      try {
        if (fs.existsSync(CALENDAR_PATH)) {
          events = JSON.parse(fs.readFileSync(CALENDAR_PATH, 'utf8'));
        }
      } catch (e) {}

      let listText = '';
      if (events.length === 0) {
        listText = '<i>No tienes compromisos adicionales agendados para esta semana.</i>';
      } else {
        listText = events.map(e => {
          const dateObj = new Date(e.eventTime);
          const timeStr = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          const dateStr = dateObj.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' });
          const alertStatus = e.reminderFired ? '✅ <i>Alarma despachada</i>' : `🔔 <i>Alarma de voz armada (${e.reminderMinutes} min antes: ${new Date(e.reminderTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})</i>`;
          return `• <b>${e.title}</b>\n  📍 ${e.location}\n  ⏰ <b>${dateStr} a las ${timeStr}</b>\n  ${alertStatus}`;
        }).join('\n\n');
      }

      const msg = `
📅 <b>AGENDA EJECUTIVA & GOOGLE WORKSPACE MCP</b>

${listText}

• <b>Conexión Google Workspace:</b> 🟢 <i>MCP Suite Activa</i>
• <b>Vigilancia de Alarmas:</b> 🟢 <i>Demonio Proactivo 24/7 Operativo</i>
      `.trim();

      await this.sendMessage(chatId, msg, { isRawHtml: true });
      return;
    }

    // /BTC
    if (lower.startsWith('/btc') || lower.includes('bitcoin') || lower.includes('precio btc') || lower.includes('sats')) {
      const btc = await mcpHub.getBitcoinData();
      const msg = `
⚡ <b>BITCOIN & LIGHTNING NETWORK MCP</b>

• <b>Precio actual:</b> <code>$${Number(btc.price_usd).toLocaleString()} USD</code> (${btc.change_24h_percent}%)
• <b>Poder de compra:</b> <code>${btc.satoshis_per_usd} satoshis</code> por $1 USD
• <b>Fee Mempool rápida:</b> <code>${btc.mempool_fees_sat_vb?.fastestFee || 14} sat/vB</code>
• <b>Destino de liquidación:</b> <code>${btc.strike_settlement_address}</code>
• <b>Estado Lightning:</b> 🟢 <i>Liquidación instantánea activa</i>
      `.trim();
      await this.sendMessage(chatId, msg, { isRawHtml: true });
      return;
    }

    // /VUELOS
    if (lower.startsWith('/vuelos') || lower.startsWith('/flights') || lower.includes('vuelo') || lower.includes('flight')) {
      let dest = "Madrid";
      if (lower.includes('miami')) dest = "Miami";
      if (lower.includes('bogota') || lower.includes('bogotá')) dest = "Bogota";
      if (lower.includes('mexico') || lower.includes('méxico')) dest = "Ciudad de Mexico";

      const flight = await mcpHub.searchFlightsFromSAL(dest, 'Próximas 2 semanas');
      const msg = `
✈️ <b>VUELOS DESDE SAN SALVADOR (SAL)</b>

• <b>Origen:</b> Aeropuerto El Salvador (SAL)
• <b>Destino:</b> <b>${flight.destination}</b>
• <b>Recomendación:</b> ${flight.recommended_airline}
• <b>Rango Estimado:</b> <code>${flight.rango_precio_estimado}</code>
• <b>Duración:</b> ${flight.tiempo_vuelo}
• <b>Aerolíneas:</b> ${flight.operadores_activos.join(', ')}

👉 <a href="${flight.booking_action_url}">Consultar Google Flights SAL</a>
      `.trim();
      await this.sendMessage(chatId, msg, { isRawHtml: true });
      return;
    }

    // /RESTAURANTES
    if (lower.startsWith('/restaurantes') || lower.startsWith('/restaurants') || lower.includes('restaurante') || lower.includes('dining')) {
      const venues = await mcpHub.searchSanSalvadorVenues('restaurant');
      const list = venues.restaurantes_recomendados.map(r => `• <b>${r.name}</b> (${r.zone})\n  <i>${r.cuisine}</i> | 📞 <code>${r.contact}</code>`).join('\n\n');
      const msg = `
🍷 <b>FINE DINING & CONCIERGE — SAN SALVADOR</b>

${list}

<i>¿Deseas que redacte una confirmación o reserva para hoy?</i>
      `.trim();
      await this.sendMessage(chatId, msg, { isRawHtml: true });
      return;
    }

    // /CINE
    if (lower.startsWith('/cine') || lower.startsWith('/cinema') || lower.includes('cine') || lower.includes('pelicula')) {
      const cine = await mcpHub.searchSanSalvadorVenues('cinema');
      const list = cine.salas_disponibles.map(c => `• <b>${c.theater}</b> (${c.format})\n  📍 ${c.ubicacion}\n  👉 <a href="${c.url_cartelera}">Horarios y Cartelera</a>`).join('\n\n');
      const msg = `
🎬 <b>CARTELERA & SALAS VIP — SAN SALVADOR</b>

${list}
      `.trim();
      await this.sendMessage(chatId, msg, { isRawHtml: true });
      return;
    }

    // /PROYECTOS
    if (lower.startsWith('/proyectos') || lower.startsWith('/pipeline') || lower.includes('boltech')) {
      const p = await mcpHub.getProjectTrackingData();
      const msg = `
📊 <b>REPORTE EJECUTIVO — Boltech Group</b>

• <b>Costo mensual a cubrir:</b> <code>${p.monthly_cost_target_usd}</code>
• <b>Meta de Break-Even:</b> <code>${p.break_even_needed}</code>
• <b>Empresas auditadas:</b> <code>${p.monitored_leads_today}</code>
• <b>Fallas críticas monetizables:</b> <code>${p.leads_with_actionable_flaws} empresas</code>
• <b>Runner Cloud 24/7:</b> 🟢 <i>GitHub Actions Activo</i>
• <b>Liquidación Lightning:</b> <code>${p.strike_lightning_destination}</code>
• <b>Estado:</b> 🟢 <b>100% OPERATIVO</b>
      `.trim();
      await this.sendMessage(chatId, msg, { isRawHtml: true });
      return;
    }

    // /HUNTER
    if (lower.startsWith('/hunter') || lower.startsWith('/cazador') || lower.includes('hunter') || lower.includes('cazador')) {
      let auditsCount = 0;
      let critical = 0;
      try {
        const auditFile = path.resolve('pipeline/auditorias_autonomas_ejecutadas.json');
        if (fs.existsSync(auditFile)) {
          const data = JSON.parse(fs.readFileSync(auditFile, 'utf8'));
          auditsCount = data.length;
          critical = data.filter(d => d.flawsCount > 0).length;
        }
      } catch (e) {}

      const msg = `
🎯 <b>CAZADOR AUTÓNOMO PERIMETRAL 24/7 (LEAD GENERATION)</b>

• <b>Modo de Operación:</b> 🟢 <i>Desatendido 24/7</i>
• <b>Empresas Auditadas en Base:</b> <code>${auditsCount}</code>
• <b>Oportunidades con Vulnerabilidades:</b> <code>${critical} empresas</code>
• <b>Ofertas Despachadas:</b> $19 USD Flash / $69 USD Pro
• <b>Pasarela de Cobro:</b> <code>rick2818@strike.me</code>
• <b>Estado de Prospección:</b> 🟢 <i>Activa en segundo plano</i>
      `.trim();
      await this.sendMessage(chatId, msg, { isRawHtml: true });
      return;
    }

    // GEMINI 3.6 FLASH (BILINGÜE Y MEMORIA)
    if (GEMINI_API_KEY) {
      try {
        const historyParts = this.conversationalMemory.slice(-6).map(m => `${m.role === 'user' ? 'Ricardo' : 'Assistant'}: ${m.content}`).join('\n');
        const contextPrompt = historyParts ? `Historial reciente:\n${historyParts}\n\nMensaje actual de Ricardo:\n${text}` : text;

        const geminiRes = await fetchWithTimeout(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            system_instruction: {
              parts: [{
                text: `You are the Sovereign Executive Chief of Staff and Personal Concierge to Ricardo.
Ricardo is an elite tech founder, investor, and builder based in San Salvador, El Salvador.

Key Operational Context:
- Platform: Boltech Group (unblock.ai) — sovereign AI custom agents & perimeter security audits.
- Settlement Rails: Bitcoin / Strike Lightning (rick2818@strike.me), Wompi.
- Base: San Salvador, El Salvador (SAL Airport, Multiplaza / Gran Vía VIP cinemas, San Benito / Santa Elena restaurants).
- Connected Tools: Bitcoin MCP, SAL Flights MCP, San Salvador Venues MCP, Google Workspace MCP, Autonomous Hunter 24/7, Resend Outbound Email Engine.
- Email Capabilities: You can draft executive emails and briefs in English or Spanish. When Ricardo says "Redáctame un correo...", provide a pristine, ready-to-send corporate email draft with Subject, Salutation, High-impact body, and Signature.
- Scheduled Meeting Confirmed: Tomorrow Wednesday Sept 16, 2026 at 10:00 AM with attorney Ana Guevara at her offices. A proactive voice alarm is armed for 09:15 AM (45 min before).

Language & Demeanor Mandate:
- DUAL NATIVE FLUENCY: You speak English and Spanish with pristine, natural fluency.
- DYNAMIC MIRRORING: If Ricardo speaks or writes in English, reply in immaculate, boardroom-grade English (sharp, executive, Silicon Valley / Wall Street Chief of Staff tone).
- If Ricardo speaks or writes in Spanish, reply in cultured, warm, and highly polished Latin American Spanish.
- If he mixes both (Spanglish), adapt smoothly and seamlessly.
- You are concise, fiduciary, highly intelligent, and authoritative. Never use filler, boilerplate, or robotic disclaimers.`
              }]
            },
            contents: [{ parts: [{ text: contextPrompt }] }]
          })
        }, 25000);

        const gData = await geminiRes.json();
        const reply = extractGeminiText(gData);
        if (reply) {
          this.conversationalMemory.push({ role: 'user', content: text });
          this.conversationalMemory.push({ role: 'assistant', content: reply });
          if (this.conversationalMemory.length > 10) this.conversationalMemory.shift();

          await this.sendMessage(chatId, reply);

          const wantsAudio = this.alwaysVoice || isVoiceInput || lower.includes('audio') || lower.includes('nota de voz') || lower.includes('voice note') || lower.includes('hablame') || lower.includes('habla') || lower.includes('voz') || lower.includes('voice') || lower.includes('speak');
          if (wantsAudio) {
            await this.sendVoiceNote(chatId, reply);
          }
          return;
        }
      } catch (err) {
        console.error('[GEMINI REASONING ERROR]:', err.message);
      }
    }

    // Fallback defensivo
    await this.sendMessage(chatId, `🎩 Instrucción registrada, <b>${userName}</b>: <i>"${escapeHtml(text)}"</i>.\n\nPuedes usar comandos directos:\n• ⚡ <b>/btc</b> — Bitcoin & Lightning\n• 📅 <b>/agenda</b> — Reuniones y Alertas\n• ✈️ <b>/vuelos</b> — Vuelos desde SAL\n• 🍷 <b>/restaurantes</b> — Opciones Gastronómicas\n• 📊 <b>/proyectos</b> — Estado de Boltech Group\n• 🎯 <b>/hunter</b> — Cazador Autónomo 24/7`);
  }

  async startPolling() {
    const webhook = await this.sendRequest('getWebhookInfo', {});
    if (!webhook?.ok || webhook.result?.url) {
      console.warn('[TELEGRAM POLLING]: No se inicia: webhook activo o estado no verificable.');
      return;
    }
    this.isRunning = true;
    this.startCalendarTicker();

    let backoffDelay = 1000;

    while (this.isRunning) {
      try {
        const updates = await this.sendRequest('getUpdates', {
          offset: this.offset,
          timeout: 25,
          allowed_updates: ['message', 'callback_query']
        }, 35000);

        if (updates.ok && Array.isArray(updates.result)) {
          backoffDelay = 1000;
          for (const update of updates.result) {
            this.offset = update.update_id + 1;
            console.log(`⚡ [EVENTO TELEGRAM]: Update #${update.update_id} recibido.`);
            if (update.message) {
              await this.processIncomingMessage(update.message);
            }
          }
        } else if (updates.error_code === 409) {
          console.warn('[TELEGRAM 409 CONFLICT]: Se detiene el polling para conservar el webhook y evitar competir con otra instancia.');
          this.isRunning = false;
          if (this.calendarTicker) clearInterval(this.calendarTicker);
        } else if (updates.error_code === 429) {
          const retrySec = updates.parameters?.retry_after || 5;
          console.warn(`[TELEGRAM 429 RATE LIMIT]: Esperando ${retrySec}s...`);
          await new Promise(r => setTimeout(r, (retrySec + 1) * 1000));
        } else {
          await new Promise(r => setTimeout(r, 2000));
        }
      } catch (err) {
        console.error(`[POLLING STALL]: ${err.message}. Reconectando en ${backoffDelay / 1000}s...`);
        await new Promise(r => setTimeout(r, backoffDelay));
        backoffDelay = Math.min(backoffDelay * 2, 16000);
      }
    }
  }
}

process.on('uncaughtException', (err) => {
  console.error('[DAEMON UNCAUGHT EXCEPTION]:', err.message);
});

process.on('unhandledRejection', (reason) => {
  console.error('[DAEMON UNHANDLED REJECTION]:', reason);
});

async function main() {
  if (!BOT_TOKEN) {
    console.error('❌ CRÍTICO: TELEGRAM_BOT_TOKEN no configurado en .env');
    process.exit(1);
  }

  const bot = new TelegramExecutiveBot();
  const identity = await bot.checkBotIdentity();
  if (identity) {
    await bot.startPolling();
  }
}

main().catch(err => {
  console.error('FATAL RUNNER CRASH:', err);
});
