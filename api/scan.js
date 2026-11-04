import { pauseNoncoreVercelFunction } from '../lib/leo_wompi_lean_mode.js';
// Vercel Serverless Function: Escáner REAL de cabeceras de seguridad y certificado TLS
// Solo lectura pública: una petición GET / por HTTPS al dominio indicado.
import { scanDomain, normalizeDomain } from '../lib/header_scanner.js';
import { checkRateLimit } from '../lib/fiduciary_core.js';

function getClientIp(req) {
  const fwd = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return req.headers['x-real-ip'] || fwd || req.socket?.remoteAddress || 'unknown';
}

function readBody(req) {
  const b = req.body;
  if (b && typeof b === 'object') return b;
  if (typeof b === 'string') {
    try { return JSON.parse(b); } catch { return {}; }
  }
  return {};
}

export default async function handler(req, res) {
  if (pauseNoncoreVercelFunction(req, res)) return;
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST', 'OPTIONS']);
    return res.status(405).json({ ok: false, error: { code: 'method_not_allowed', message: 'Método no permitido.' } });
  }

  // Límite por IP (best-effort: en serverless cada instancia tiene su propia memoria)
  const rl = checkRateLimit('scan:' + getClientIp(req), 8, 60000);
  if (!rl.allowed) {
    res.setHeader('Retry-After', String(rl.remainingSeconds));
    return res.status(429).json({
      ok: false,
      error: { code: 'rate_limited', message: `Demasiados análisis seguidos. Intenta de nuevo en ${rl.remainingSeconds} s.` }
    });
  }

  let rawDomain = readBody(req).domain;
  if (typeof rawDomain === 'string') {
    rawDomain = rawDomain.trim();
    if (rawDomain && !rawDomain.includes('.') && !rawDomain.includes('/') && rawDomain.length > 1) {
      rawDomain = rawDomain + '.com';
    }
  }

  const domain = normalizeDomain(rawDomain);
  if (!domain) {
    return res.status(400).json({
      ok: false,
      error: { code: 'invalid_domain', message: 'Ingresa un nombre de dominio público válido (ejemplo: tuempresa.com).' }
    });
  }

  try {
    const result = await scanDomain(domain);
    // Fallos esperables (DNS, TLS, timeout) viajan como 200 con ok:false para que el front los muestre tal cual
    return res.status(200).json(result);
  } catch (err) {
    console.error('[SCAN HANDLER ERROR]', err);
    return res.status(500).json({ ok: false, error: { code: 'internal', message: 'Error interno al analizar el dominio.' } });
  }
}
