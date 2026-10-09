/**
 * =============================================================================
 * ENDPOINT SERVERLESS: TELEGRAM CLOUD WEBHOOK 24/7 (VERCEL & AWS LAMBDA)
 * =============================================================================
 * Ruta: POST /api/telegram
 * SOC-2 | Zero-Trust | Cero Dependencia Local | 100% In-Memory RAM
 * =============================================================================
 */

import {
  timingSafeCompare,
  checkRateLimit,
  applyStrictBankingHeaders,
  getRequiredEnv
} from '../lib/fiduciary_core.js';
import { processCloudTelegramUpdate } from '../lib/telegram_cloud_processor.js';
import { requireOperationalAuth } from '../lib/operational_auth.js';

// Cache de deduplicación en memoria para evitar reprocesar reintentos de Telegram
const processedUpdatesCache = new Map();
const UPDATE_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutos
const MAX_UPDATE_CACHE_SIZE = 1000;

function isUpdateDuplicate(updateId) {
  if (!updateId) return false;
  const now = Date.now();
  for (const [id, entry] of processedUpdatesCache) {
    if (now - entry.time > UPDATE_CACHE_TTL_MS) processedUpdatesCache.delete(id);
  }
  return processedUpdatesCache.get(updateId)?.state === 'DONE';
}

export default async function handler(req, res) {
  applyStrictBankingHeaders(res);

  // Manejo de pre-flight OPTIONS
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Comprobación de salud GET
  if (req.method === 'GET') {
    if (req.query?.deep === '1') {
      const botToken = (process.env.TELEGRAM_BOT_TOKEN || '').trim();
      if (!botToken) {
        return res.status(503).json({
          status: 'DEGRADED',
          telegramConfigured: false,
          reason: 'TELEGRAM_BOT_TOKEN_MISSING'
        });
      }

      const geminiKeyPresent = Boolean((process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY || '').trim());
      const geminiDisabled = String(process.env.TELEGRAM_GEMINI_DISABLED || '').trim() === '1';
      const geminiActive = geminiKeyPresent && !geminiDisabled;

      try {
        const tgRes = await fetch(`https://api.telegram.org/bot${botToken}/getWebhookInfo`);
        const tgData = await tgRes.json();
        const info = tgData?.result || {};
        const expectedUrl = 'https://boltech-group.vercel.app/api/telegram';
        return res.status(tgData?.ok ? 200 : 502).json({
          status: tgData?.ok && info.url === expectedUrl && !info.last_error_message ? 'ONLINE' : 'DEGRADED',
          telegramConfigured: Boolean(tgData?.ok),
          webhookConfigured: info.url === expectedUrl,
          assistantAiConfigured: geminiActive,
          assistantMode: geminiActive ? 'GEMINI_2_5_FLASH' : 'FREE_OPERATIONAL_COMMANDS',
          configuredModel: 'gemini-2.5-flash',
          paidModelCallsEnabled: geminiActive,
          geminiDisabledBySwitch: geminiDisabled,
          geminiKeyPresent: geminiKeyPresent,
          pendingUpdates: info.pending_update_count ?? null,
          lastError: info.last_error_message || null,
          agent: '@ricardo_asistente_2026_bot',
          timestamp: new Date().toISOString()
        });
      } catch (err) {
        return res.status(502).json({
          status: 'DEGRADED',
          telegramConfigured: false,
          reason: 'TELEGRAM_HEALTH_CHECK_FAILED'
        });
      }
    }

    return res.status(200).json({
      status: 'ONLINE',
      mode: 'CLOUD_NATIVE_SERVERLESS_24_7',
      agent: '@ricardo_asistente_2026_bot',
      timestamp: new Date().toISOString()
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // Restore only an absent webhook or the existing Boltech destination. Never
  // overwrite another integration, drop queued updates or disclose bot secrets.
  if (['repair-webhook', 'replace-webhook'].includes(req.query?.action)) {
    if (!requireOperationalAuth(req, res)) return;
    const botToken = String(process.env.TELEGRAM_BOT_TOKEN || '').trim();
    const secret = String(process.env.TELEGRAM_WEBHOOK_SECRET || '').trim();
    const expectedUrl = 'https://boltech-group.vercel.app/api/telegram';
    if (!botToken || !secret) return res.status(503).json({ ok: false, code: 'TELEGRAM_CONFIGURATION_MISSING' });
    try {
      const infoResponse = await fetch(`https://api.telegram.org/bot${botToken}/getWebhookInfo`, { signal: AbortSignal.timeout(10000) });
      const info = await infoResponse.json();
      if (!infoResponse.ok || info.ok !== true || typeof info.result?.url !== 'string') {
        return res.status(502).json({ ok: false, code: 'TELEGRAM_DIAGNOSTIC_FAILED' });
      }
      if (info.result.url && info.result.url !== expectedUrl && req.query.action !== 'replace-webhook') {
        return res.status(409).json({ ok: false, code: 'TELEGRAM_OTHER_WEBHOOK_PRESENT' });
      }
      const response = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(10000),
        body: JSON.stringify({ url: expectedUrl, secret_token: secret, max_connections: 40,
          allowed_updates: ['message', 'callback_query'], drop_pending_updates: false })
      });
      const result = await response.json();
      return res.status(response.ok && result.ok === true ? 200 : 502).json({
        ok: response.ok && result.ok === true, code: result.ok === true ? 'TELEGRAM_WEBHOOK_RESTORED' : 'TELEGRAM_REPAIR_FAILED'
      });
    } catch {
      return res.status(502).json({ ok: false, code: 'TELEGRAM_REPAIR_FAILED' });
    }
  }

  // PILAR 6: Rate Limiting en Serverless (Anti-DoS / Anti-Flooding)
  const clientIp = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'telegram-edge';
  const { allowed, remainingSeconds } = checkRateLimit(clientIp, 60, 60000);
  if (!allowed) {
    res.setHeader('Retry-After', remainingSeconds);
    return res.status(429).json({ error: 'Too Many Requests', retryAfterSeconds: remainingSeconds });
  }

  // PILAR 4: Verificación Criptográfica Obligatoria del Token Secreto de Webhook
  const expectedSecret = (process.env.TELEGRAM_WEBHOOK_SECRET || '').trim();
  if (!expectedSecret) {
    console.error('[CRITICAL SECURITY CONFIG]: TELEGRAM_WEBHOOK_SECRET no está configurado en el servidor.');
    return res.status(500).json({ error: 'Server misconfiguration: TELEGRAM_WEBHOOK_SECRET is required' });
  }

  const incomingSecret = req.headers['x-telegram-bot-api-secret-token'];
  if (!incomingSecret || !timingSafeCompare(incomingSecret, expectedSecret)) {
    console.warn('[SEGURIDAD CLOUD] Intento de webhook con token secreto inválido o ausente.');
    return res.status(401).json({ error: 'Unauthorized Webhook Source' });
  }

  // Operación administrativa autenticada: registrar/reparar el webhook sin exponer el Bot Token.
  if (req.query?.action === 'register-webhook') {
    if (!requireOperationalAuth(req, res)) return;
    const botToken = (process.env.TELEGRAM_BOT_TOKEN || '').trim();
    if (!botToken) {
      return res.status(503).json({ error: 'TELEGRAM_BOT_TOKEN_MISSING' });
    }

    try {
      const telegramRes = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: 'https://boltech-group.vercel.app/api/telegram',
          max_connections: 40,
          allowed_updates: ['message', 'callback_query'],
          drop_pending_updates: false,
          secret_token: expectedSecret
        })
      });
      const telegramData = await telegramRes.json();
      if (!telegramData?.ok) {
        console.error('[TELEGRAM WEBHOOK REGISTER ERROR]:', telegramData?.description || 'Unknown Telegram error');
        return res.status(502).json({ ok: false, error: 'TELEGRAM_WEBHOOK_REGISTER_FAILED' });
      }
      return res.status(200).json({
        ok: true,
        webhook: 'https://boltech-group.vercel.app/api/telegram',
        status: 'REGISTERED'
      });
    } catch (err) {
      console.error('[TELEGRAM WEBHOOK REGISTER ERROR]:', err.message);
      return res.status(502).json({ ok: false, error: 'TELEGRAM_WEBHOOK_REGISTER_FAILED' });
    }
  }

  let updateId;
  try {
    const update = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    updateId = update?.update_id;

    // Deduplicación rápida por update_id
    if (update?.update_id && isUpdateDuplicate(update.update_id)) {
      console.log(`[DEDUPE]: Update #${update.update_id} ya procesado recientemente. Ignorando reintento.`);
      return res.status(200).json({ ok: true, duplicate: true });
    }
    if (updateId && processedUpdatesCache.get(updateId)?.state === 'PROCESSING') {
      return res.status(503).json({ ok: false, code: 'TELEGRAM_UPDATE_IN_PROGRESS' });
    }
    if (updateId) {
      if (processedUpdatesCache.size >= MAX_UPDATE_CACHE_SIZE) {
        return res.status(503).json({ ok: false, code: 'TELEGRAM_PROCESSOR_BUSY' });
      }
      processedUpdatesCache.set(updateId, { time: Date.now(), state: 'PROCESSING' });
    }

    // Procesar actualización de Telegram en memoria RAM
    const result = await processCloudTelegramUpdate(update, process.env);
    if (result?.delivered === false) {
      if (updateId) processedUpdatesCache.delete(updateId);
      return res.status(502).json({ ok: false, code: 'TELEGRAM_REPLY_NOT_DELIVERED' });
    }
    if (updateId) processedUpdatesCache.set(updateId, { time: Date.now(), state: 'DONE' });

    return res.status(200).json({ ok: true, result });
  } catch (err) {
    if (updateId) processedUpdatesCache.delete(updateId);
    // PILAR 7: Cero fuga de stack traces a clientes externos
    console.error('[TELEGRAM SERVERLESS ERROR]:', err.message);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
