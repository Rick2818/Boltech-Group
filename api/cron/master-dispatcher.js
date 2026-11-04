import { pauseNoncoreVercelFunction } from '../../lib/leo_wompi_lean_mode.js';
/**
 * =============================================================================
 * MASTER CLOUD DISPATCHER: ENRUTADOR MAESTRO DE TAREAS CRON EN LA NUBE 24/7
 * =============================================================================
 * Ruta: POST/GET /api/cron/master-dispatcher
 * Conexión: GitHub Actions Cron / QStash / cron-job.org
 * Autorización: Bearer <ADMIN_SECRET> con verificación timing-safe (Pilar 4)
 * =============================================================================
 */

import {
  timingSafeCompare,
  applyStrictBankingHeaders
} from '../../lib/fiduciary_core.js';
import { ExecutiveAssistantMCPHub } from '../../lib/mcp_executive_assistant.js';

export default async function handler(req, res) {
  if (pauseNoncoreVercelFunction(req, res)) return;
  applyStrictBankingHeaders(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // PILAR 3 & 4: Autenticación Timing-Safe de Administrador / Cron Secret
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  const expectedSecret = process.env.CRON_SECRET || process.env.PLATFORM_MASTER_KEY || '';

  if (!token || !timingSafeCompare(token, expectedSecret)) {
    console.warn('[SEGURIDAD] Intento no autorizado en Master Cloud Dispatcher.');
    return res.status(401).json({ error: 'Unauthorized Cloud Dispatcher Request' });
  }

  try {
    const url = new URL(req.url, `https://${req.headers.host || 'localhost'}`);
    const task = url.searchParams.get('task') || req.body?.task || 'all';
    if(task === 'hunter') return res.status(410).json({success:false,code:'LEGACY_COMMERCIAL_TRACTION_RETIRED',sendingEnabled:false});

    const mcpHub = new ExecutiveAssistantMCPHub({
      strikeAddress: process.env.STRIKE_LIGHTNING_ADDRESS || 'rick2818@strike.me'
    });

    const executionReport = {
      dispatcher: 'Master Cloud Dispatcher 24/7',
      invokedAt: new Date().toISOString(),
      task,
      results: {}
    };

    // Historical lead hunter retired. Only settlement and operational health are supported.
    // TAREA 2: CONCILIACIÓN FIDUCIARIA LIGHTNING (STRIKE MONITOR)
    if (task === 'all' || task === 'settlement') {
      const btc = await mcpHub.getBitcoinData();
      executionReport.results.settlement = {
        gateway: 'Strike Lightning',
        destination: btc.strike_settlement_address,
        current_btc_price_usd: btc.price_usd,
        satoshis_per_usd: btc.satoshis_per_usd,
        status: 'SETTLEMENT_RAILS_ACTIVE'
      };
    }

    // TAREA 3: HEALTH CHECK GENERAL DE SERVICIOS FIDUCIARIOS
    if (task === 'all' || task === 'health') {
      executionReport.results.system_health = {
        serverless_runtime: 'Node.js Vercel Edge/Serverless',
        memory_retention: 'ZERO_DISK_100_PERCENT_RAM',
        status: 'OPERATIONAL'
      };
    }

    return res.status(200).json({
      success: true,
      report: executionReport
    });
  } catch (err) {
    console.error('[MASTER DISPATCHER CRASH]:', err.message);
    return res.status(500).json({ error: 'Master Dispatcher Execution Failed' });
  }
}
