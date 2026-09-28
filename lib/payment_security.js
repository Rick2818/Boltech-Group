/**
 * Boltech Group — Legacy payment compatibility layer.
 *
 * IMPORTANT:
 * Real payments are handled only by:
 *   - lib/payment_catalog.js
 *   - lib/payment_store.js
 *   - lib/payment_providers.js
 *   - lib/payment_reconciliation.js
 *   - api/payments.js
 *   - api/wompi-webhook.js
 *   - api/strike-webhook.js
 *
 * This file intentionally cannot create or confirm payments.
 */

import crypto from 'node:crypto';

export const CATALOGO_PRECIOS_USD = Object.freeze({
  flash: Object.freeze({ id: 'flash', name: 'Parche de Ciberseguridad', amount_usd: 19 }),
  pro: Object.freeze({ id: 'pro', name: 'Centinela Autónomo 24/7', amount_usd: 69 }),
  enterprise: Object.freeze({ id: 'enterprise', name: 'Agente Autónomo a la Medida', amount_usd: 490 })
});

const idempotencyLedger = new Map();
const ipRequestWindow = new Map();

export function applyBankingSecurityHeaders(res) {
  res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
}

export function checkRateLimit(clientIp, maxRequests = 10, windowMs = 60000) {
  const now = Date.now();
  const key = String(clientIp || 'unknown').slice(0, 160);
  const record = ipRequestWindow.get(key) || { count: 0, resetAt: now + windowMs };
  if (now > record.resetAt) {
    record.count = 1;
    record.resetAt = now + windowMs;
  } else {
    record.count += 1;
  }
  ipRequestWindow.set(key, record);
  return record.count <= maxRequests;
}

export function timingSafeCompare(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const x = Buffer.from(a, 'utf8');
  const y = Buffer.from(b, 'utf8');
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

function legacyPaymentError() {
  const err = new Error('Legacy payment gateway disabled. Use /api/payments and provider-verified webhooks.');
  err.code = 'LEGACY_PAYMENT_GATEWAY_DISABLED';
  err.statusCode = 410;
  return err;
}

export class StrikeLightningGateway {
  constructor() {}
  async createLightningPayment() { throw legacyPaymentError(); }
  verifyWebhookSignature() { return false; }
}

export class WompiGateway {
  constructor() {}
  async createPaymentLink() { throw legacyPaymentError(); }
  verifyWebhookSignature() { return false; }
}

export function recordAndVerifyIdempotency(transactionId) {
  if (!transactionId) return { isDuplicate: false };
  if (idempotencyLedger.has(transactionId)) {
    return { isDuplicate: true, firstSeen: idempotencyLedger.get(transactionId) };
  }
  idempotencyLedger.set(transactionId, Date.now());
  return { isDuplicate: false };
}

export async function recordAndVerifyDistributedIdempotency(transactionId) {
  return recordAndVerifyIdempotency(transactionId);
}
