/**
 * =============================================================================
 * ENDPOINT SERVERLESS: CRM INTEGRATIONS (HUBSPOT & SALESFORCE)
 * =============================================================================
 * Rutas:
 *   GET  /api/crm       -> Diagnóstico de estado de integración con CRM
 *   POST /api/crm/sync  -> Sincronización fiduciaria de lead calificado
 * SOC-2 | In-Memory RAM | Rate Limiting
 * =============================================================================
 */

import {
  applyStrictBankingHeaders,
  resolveCorsOrigin,
  checkRateLimit
} from '../lib/fiduciary_core.js';
import {
  getCRMStatus,
  syncLeadToCRM
} from '../lib/crm_integrations.js';
import { requireOperationalAuth } from '../lib/operational_auth.js';
import { createCrmRecovery } from '../lib/crm_recovery.js';

export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  applyStrictBankingHeaders(res);

  const requestOrigin = req.headers.origin;
  const allowedOrigin = resolveCorsOrigin(requestOrigin, process.env.NODE_ENV !== 'production');
  if (allowedOrigin) {
    res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  if (!requireOperationalAuth(req, res)) return;

  // Rate Limiting perimetral
  const clientIp = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '127.0.0.1';
  const { allowed, remainingSeconds } = checkRateLimit(clientIp, 40, 60000);
  if (!allowed) {
    res.setHeader('Retry-After', remainingSeconds);
    return res.status(429).json({ error: 'Too Many Requests', retryAfterSeconds: remainingSeconds });
  }

  try {
    const url = new URL(req.url, `https://${req.headers.host || 'localhost'}`);
    const pathname = url.pathname;
    const action = req.query?.action || url.searchParams.get('action');
    if (action === 'recovery') {
      const store = createCrmRecovery();
      if (req.method === 'POST') {
        const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
        if (body.jobId) return res.status(200).json({ success: true, result: await store.resume(body.jobId) });
        return res.status(200).json({ success: true, results: await store.drain(), recovery: await store.status() });
      }
      if (req.method === 'GET') {
        const id = req.query?.jobId || url.searchParams.get('jobId');
        if (!id) return res.status(200).json({ success: true, recovery: await store.status() });
        const job = await store.read(id);
        return res.status(job ? 200 : 404).json({ success: Boolean(job), job: job ? { id: job.id, state: job.state, attempts: job.attempts, code: job.code, history: job.history } : null });
      }
      return res.status(405).json({ success: false, code: 'METHOD_NOT_ALLOWED' });
    }

    // 1. GET: Estado de integración
    if (req.method === 'GET') {
      const status = getCRMStatus();
      return res.status(200).json(status);
    }

    // 2. POST: Sincronización de Lead
    if (req.method === 'POST') {
      const lead = req.body || {};
      if (!lead.email) {
        return res.status(400).json({
          success: false,
          error: 'El campo "email" es obligatorio para la sincronización con el CRM.'
        });
      }

      const syncResult = await syncLeadToCRM(lead);
      return res.status(syncResult.hubspot?.synced ? 200 : 202).json({
        success: syncResult.hubspot?.synced === true || syncResult.salesforce?.synced === true,
        queued: ['PENDING', 'RETRY_PENDING'].includes(syncResult.hubspot?.status),
        data: syncResult
      });
    }

    return res.status(405).json({ error: 'Método HTTP no permitido' });
  } catch (error) {
    console.error('[CRM API Error]:', error.code || 'CRM_REQUEST_FAILED');
    return res.status(error.code?.startsWith('CRM_INVALID') ? 400 : 503).json({
      success: false,
      code: error.code || 'CRM_REQUEST_FAILED'
    });
  }
}
