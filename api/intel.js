import { pauseNoncoreVercelFunction } from '../lib/leo_wompi_lean_mode.js';
/**
 * =============================================================================
 * ENDPOINT SERVERLESS: LEAD & CORPORATE INTELLIGENCE (TAVILY)
 * =============================================================================
 * Rutas:
 *   GET  /api/intel  -> Estado del motor cognitivo Tavily
 *   POST /api/intel  -> Búsqueda e investigación profunda de empresas/decisores
 * =============================================================================
 */

import {
  applyStrictBankingHeaders,
  resolveCorsOrigin,
  checkRateLimit
} from '../lib/fiduciary_core.js';
import {
  getIntelligenceStatus,
  researchCompanyOrLead
} from '../lib/lead_intelligence.js';

export default async function handler(req, res) {
  if (pauseNoncoreVercelFunction(req, res)) return;
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

  const clientIp = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '127.0.0.1';
  const { allowed, remainingSeconds } = checkRateLimit(clientIp, 30, 60000);
  if (!allowed) {
    res.setHeader('Retry-After', remainingSeconds);
    return res.status(429).json({ error: 'Too Many Requests', retryAfterSeconds: remainingSeconds });
  }

  try {
    if (req.method === 'GET') {
      return res.status(200).json(getIntelligenceStatus());
    }

    if (req.method === 'POST') {
      const { query, topic, maxResults } = req.body || {};
      if (!query || typeof query !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'El parámetro "query" es requerido.'
        });
      }

      const result = await researchCompanyOrLead(query, { topic, maxResults });
      return res.status(200).json(result);
    }

    return res.status(405).json({ error: 'Método HTTP no permitido' });
  } catch (error) {
    console.error('[Intel API Error]:', error);
    return res.status(500).json({
      success: false,
      error: error?.message || 'Error interno en investigación de leads'
    });
  }
}
