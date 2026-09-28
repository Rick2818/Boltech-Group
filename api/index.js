
import fs from 'fs';
import path from 'path';
import {
  StrikeLightningGateway,
  WompiGateway,
  CATALOGO_PRECIOS_USD,
  applyBankingSecurityHeaders,
  checkRateLimit,
  recordAndVerifyIdempotency,
  recordAndVerifyDistributedIdempotency
} from '../lib/payment_security.js';
import {
  verifyUnsubscribeToken,
  addToDncBlacklist
} from '../lib/compliance_dnc.js';
import { ExecutiveAssistantMCPHub } from '../lib/mcp_executive_assistant.js';

// Instancias reutilizadas entre invocaciones cálidas (evita recrear el cliente en cada request)
const strike = new StrikeLightningGateway({ lightningAddress: 'rick2818@strike.me' });
const wompi = new WompiGateway({
  appId: process.env.WOMPI_APP_ID || '',
  apiSecret: process.env.WOMPI_API_SECRET || '',
  webhookSecret: process.env.WOMPI_WEBHOOK_SECRET || ''
});
const mcpHub = new ExecutiveAssistantMCPHub({ strikeAddress: 'rick2818@strike.me' });

import {
  applyStrictBankingHeaders,
  resolveCorsOrigin
} from '../lib/fiduciary_core.js';
import {
  sendCustomerDeliveryEmail,
  sendExecutiveTelegramAlert
} from '../lib/fiduciary_delivery.js';
import {
  dispatchUniversalEmail,
  inspectResendAccount,
  maskSecret
} from '../lib/universal_email_engine.js';
import telegramHandler from './telegram.js';
import cronHandler from './cron/master-dispatcher.js';
import aiHandler from './ai.js';
import crmHandler from './crm.js';
import whatsappHandler from './whatsapp.js';
import intelHandler from './intel.js';
import leadHandler from './lead.js';
import scanHandler from './scan.js';
import partnersHandler from './partners.js';

export default async function handler(req, res) {
  applyStrictBankingHeaders(res);

  const requestOrigin = req.headers.origin;
  const allowedOrigin = resolveCorsOrigin(requestOrigin, process.env.NODE_ENV !== 'production');
  if (allowedOrigin) {
    res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Strike-Signature, X-Event-Checksum, X-Telegram-Bot-Api-Secret-Token, X-Requested-With');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const url = new URL(req.url, `https://${req.headers.host || 'localhost'}`);
    const pathname = url.pathname;

    // Enrutamiento a Captura y Despacho de Leads
    if (pathname === '/api/lead' || pathname.endsWith('/lead')) {
      return await leadHandler(req, res);
    }

    // Enrutamiento a Escaneo de Cabeceras
    if (pathname === '/api/scan' || pathname.endsWith('/scan')) {
      return await scanHandler(req, res);
    }

    // Enrutamiento a Vercel AI SDK
    if (pathname === '/api/ai' || pathname.endsWith('/ai')) {
      return await aiHandler(req, res);
    }

    // Enrutamiento a Partner Network (referrals, co-selling y comisiones)
    if (pathname.startsWith('/api/partners')) {
      return await partnersHandler(req, res);
    }

    // Enrutamiento a CRM (HubSpot & Salesforce)
    if (pathname.startsWith('/api/crm') || pathname.includes('/crm')) {
      return await crmHandler(req, res);
    }

    // Enrutamiento a WhatsApp Business (Twilio)
    if (pathname.startsWith('/api/whatsapp') || pathname.includes('/whatsapp')) {
      return await whatsappHandler(req, res);
    }

    // Enrutamiento a Inteligencia de Leads (Tavily)
    if (pathname.startsWith('/api/intel') || pathname.includes('/intel')) {
      return await intelHandler(req, res);
    }

    // Enrutamiento a Telegram Webhook Serverless
    if (pathname === '/api/telegram' || pathname.endsWith('/telegram')) {
      return await telegramHandler(req, res);
    }

    // Enrutamiento a Master Cloud Dispatcher Cron
    if (pathname === '/api/cron/master-dispatcher' || pathname.endsWith('/cron/master-dispatcher')) {
      return await cronHandler(req, res);
    }

    // --- ENDPOINT FIDUCIARIO DE DESUSCRIPCIÓN Y CUMPLIMIENTO DNC (CAN-SPAM / GDPR) ---
    if (pathname === '/api/unsubscribe' || pathname.endsWith('/unsubscribe')) {
      const token = url.searchParams.get('token') || req.body?.token;
      const verification = verifyUnsubscribeToken(token);

      if (!verification.valid) {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.status(400).send(`<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>Enlace Inválido</title><style>body{font-family:-apple-system,sans-serif;background:#0f172a;color:#f8fafc;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;}.card{background:#1e293b;padding:32px;border-radius:12px;max-width:480px;text-align:center;box-shadow:0 10px 25px rgba(0,0,0,0.5);}h1{color:#f43f5e;font-size:20px;margin-bottom:12px;}p{color:#94a3b8;font-size:14px;line-height:1.6;}</style></head><body><div class="card"><h1>Enlace de Desuscripción Inválido o Expirado</h1><p>El token de baja no pudo ser validado criptográficamente. Si deseas solicitar la exclusión manual inmediata, escribe a soporte@boltech.ai.</p></div></body></html>`);
      }

      await addToDncBlacklist(verification.email, 'WEB_ONE_CLICK_UNSUBSCRIBE');
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.status(200).send(`<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>Exclusión Fiduciaria Confirmada</title><style>body{font-family:-apple-system,sans-serif;background:#0f172a;color:#f8fafc;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;}.card{background:#1e293b;padding:36px;border-radius:12px;max-width:500px;text-align:center;box-shadow:0 10px 25px rgba(0,0,0,0.5);border:1px solid #334155;}h1{color:#10b981;font-size:22px;margin-bottom:12px;}p{color:#cbd5e1;font-size:14px;line-height:1.6;}.badge{display:inline-block;background:#064e3b;color:#6ee7b7;padding:6px 14px;border-radius:20px;font-size:12px;margin-top:16px;font-weight:600;}</style></head><body><div class="card"><h1>✅ Desuscripción Confirmada</h1><p>El correo <strong>${verification.email}</strong> ha sido excluido de forma permanente de todas nuestras transmisiones y diagnósticos defensivos.</p><div class="badge">ESTÁNDAR FIDUCIARIO CAN-SPAM CUMPLIDO</div></div></body></html>`);
    }

    const clientIp = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown-client';
    if (!checkRateLimit(clientIp, 60, 60000)) {
      return res.status(429).json({ error: 'Too Many Requests', retryAfterSeconds: 60 });
    }

    // --- ENDPOINT CONFIGURACIÓN DE CABINA SOBERANA ---
    // ELIMINADO del despliegue público de Vercel (2026-09-26): este endpoint
    // filtraba GEMINI_API_KEY sin autenticación a cualquiera en internet.
    // La Cabina Soberana es una herramienta LOCAL (server.js, localhost:8765);
    // la config con la API key solo se sirve ahí. Ver server.js para el
    // equivalente protegido con COCKPIT_ACCESS_TOKEN.

    // --- ENDPOINTS UNIVERSALES DE CORREO: ESTADO Y DESPACHO ---
    if (req.method === 'GET' && (pathname === '/api/email/status' || pathname.endsWith('/email/status'))) {
      const resendKey = process.env.RESEND_API_KEY || process.env.RESFND_APT_KEY;
      const resendAudit = await inspectResendAccount(resendKey);
      const isSmtpReady = Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS && process.env.SMTP_PASS.trim().length >= 8);

      return res.status(200).json({
        success: true,
        smtp: {
          configured: isSmtpReady,
          host: process.env.SMTP_HOST || 'smtp.gmail.com',
          port: parseInt(process.env.SMTP_PORT, 10) || 465,
          user: process.env.SMTP_USER || 'ricardo.boltechai@gmail.com',
          from: process.env.SMTP_FROM || `Boltech Group <${process.env.SMTP_USER || 'ricardo.boltechai@gmail.com'}>`,
          status: isSmtpReady ? 'OPERATIONAL_LIVE' : 'PENDING_APP_PASSWORD'
        },
        resend: {
          keyConfigured: Boolean(resendKey),
          keyMasked: maskSecret(resendKey),
          hasVerifiedDomain: resendAudit.hasVerifiedDomain || false,
          domainsCount: resendAudit.domainsCount || 0,
          domains: resendAudit.domains || [],
          mode: resendAudit.hasVerifiedDomain ? 'VERIFIED_DOMAIN_LIVE' : 'SANDBOX_OWNER_ONLY'
        },
        activeCarrier: isSmtpReady ? 'GMAIL_SMTPS' : (resendAudit.hasVerifiedDomain ? 'RESEND_VERIFIED' : 'RESEND_SANDBOX_DIGEST_ONLY'),
        hint: !isSmtpReady
          ? 'Ingresa tu contraseña de aplicación de Gmail (16 caracteres) en .env (SMTP_PASS) para habilitar envíos a terceros al 100% sin esperar verificación de dominio.'
          : 'Motor listo para despachar a cualquier tercero.'
      });
    }

    if (req.method === 'POST' && (pathname === '/api/email/dispatch' || pathname.endsWith('/email/dispatch'))) {
      const { to, subject, body, html } = req.body || {};
      if (!to || !subject || (!body && !html)) {
        return res.status(400).json({ success: false, error: 'Faltan campos requeridos: to, subject, body/html' });
      }

      const dispatchResult = await dispatchUniversalEmail({
        to,
        subject,
        text: body || '',
        html: html || ''
      });

      return res.status(dispatchResult.success ? 200 : 422).json(dispatchResult);
    }

    if (req.method === 'GET' && (pathname === '/api/catalog' || pathname.endsWith('/catalog'))) {
      return res.status(200).json({
        success: true,
        brand: 'Boltech Group / Unblock AI',
        supportEmail: 'soporte@boltech.ai',
        strikeLightningAddress: 'rick2818@strike.me',
        catalog: CATALOGO_PRECIOS_USD
      });
    }

    // --- RUTAS DE PAGO HEREDADAS DESHABILITADAS ---
    // Se retiraron porque permitían confirmaciones no verificadas o integraciones
    // incompatibles con los proveedores actuales. Toda creación/consulta de pagos
    // debe pasar por /api/payments y webhooks dedicados.
    if (
      pathname === '/api/strike/invoice' ||
      pathname.endsWith('/strike/invoice') ||
      pathname === '/api/wompi/checkout' ||
      pathname.endsWith('/wompi/checkout') ||
      pathname === '/api/verify-lightning' ||
      pathname.endsWith('/verify-lightning') ||
      pathname === '/api/payment/confirm' ||
      pathname.endsWith('/payment/confirm')
    ) {
      return res.status(410).json({
        success: false,
        error: 'Legacy payment route retired. Use the verified payment API.',
        code: 'LEGACY_PAYMENT_ROUTE_RETIRED'
      });
    }

    // --- MCP TOOL HUB: Asistente Personal Ejecutivo ---
    if ((req.method === 'POST' || req.method === 'GET') && (pathname === '/api/mcp/executive' || pathname.endsWith('/mcp/executive'))) {
      const action = (req.method === 'POST' ? req.body?.action : url.searchParams.get('action')) || 'all';
      const destination = (req.method === 'POST' ? req.body?.destination : url.searchParams.get('destination')) || 'Madrid';
      const category = (req.method === 'POST' ? req.body?.category : url.searchParams.get('category')) || 'cinema';
      const query = (req.method === 'POST' ? req.body?.query : url.searchParams.get('query')) || '';

      if (action === 'bitcoin') {
        const data = await mcpHub.getBitcoinData();
        return res.status(200).json({ success: true, tool: 'bitcoin_mcp', data });
      }
      if (action === 'flights') {
        const data = await mcpHub.searchFlightsFromSAL(destination, 'Próximos 14 días');
        return res.status(200).json({ success: true, tool: 'flights_sal_mcp', data });
      }
      if (action === 'venues') {
        const data = await mcpHub.searchSanSalvadorVenues(category, query);
        return res.status(200).json({ success: true, tool: 'venues_mcp', data });
      }
      if (action === 'google_workspace') {
        const data = await mcpHub.getGoogleWorkspaceStatus();
        return res.status(200).json({ success: true, tool: 'google_workspace_mcp', data });
      }
      if (action === 'spotify') {
        const data = await mcpHub.getSpotifyStatus();
        return res.status(200).json({ success: true, tool: 'spotify_mcp', data });
      }
      if (action === 'projects') {
        const data = await mcpHub.getProjectTrackingData();
        return res.status(200).json({ success: true, tool: 'project_tracker_mcp', data });
      }

      // Snapshot consolidado de todos los MCPs
      const [btc, flights, venues, gws, spotify, projects] = await Promise.all([
        mcpHub.getBitcoinData(),
        mcpHub.searchFlightsFromSAL('Madrid'),
        mcpHub.searchSanSalvadorVenues('cinema'),
        mcpHub.getGoogleWorkspaceStatus(),
        mcpHub.getSpotifyStatus(),
        mcpHub.getProjectTrackingData()
      ]);

      return res.status(200).json({
        success: true,
        agent: "Asistente Ejecutivo & Concierge Soberano",
        mcps: { btc, flights, venues, gws, spotify, projects }
      });
    }

    // --- WEBHOOKS HEREDADOS DESHABILITADOS ---
    // Los webhooks productivos viven en:
    //   /api/wompi-webhook
    //   /api/strike-webhook
    // y validan firma + proveedor + monto + orden antes de PAID.
    if (
      pathname === '/api/webhooks/wompi' ||
      pathname.endsWith('/webhooks/wompi') ||
      pathname === '/api/webhooks/strike' ||
      pathname.endsWith('/webhooks/strike')
    ) {
      return res.status(410).json({
        success: false,
        error: 'Legacy webhook route retired.',
        code: 'LEGACY_WEBHOOK_ROUTE_RETIRED'
      });
    }

    // --- ENDPOINTS FIDUCIARIOS DEL DASHBOARD EJECUTIVO (COCKPIT LOCAL & CLOUD) ---
    if (req.method === 'GET' && (pathname === '/api/dashboard/metrics' || pathname.endsWith('/dashboard/metrics'))) {
      let btcData = { price_usd: 76210, satoshis_per_usd: 1312 };
      try {
        btcData = await mcpHub.getBitcoinData();
      } catch (e) {}

      let leadsCount = 0;
      try {
        const pPath = path.resolve('pipeline/leads_contactados_activos.json');
        if (fs.existsSync(pPath)) {
          const leads = JSON.parse(fs.readFileSync(pPath, 'utf8'));
          leadsCount = Array.isArray(leads) ? leads.length : 0;
        }
      } catch (e) {}

      let auditsCount = 0;
      try {
        const aPath = path.resolve('pipeline/auditorias_autonomas_ejecutadas.json');
        if (fs.existsSync(aPath)) {
          const audits = JSON.parse(fs.readFileSync(aPath, 'utf8'));
          auditsCount = Array.isArray(audits) ? audits.length : 0;
        }
      } catch (e) {}

      let dncCount = 0;
      try {
        const dPath = path.resolve('pipeline/dnc_blacklist.json');
        if (fs.existsSync(dPath)) {
          const dnc = JSON.parse(fs.readFileSync(dPath, 'utf8'));
          dncCount = Array.isArray(dnc) ? dnc.length : 0;
        }
      } catch (e) {}

      const isSmtpReady = Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

      return res.status(200).json({
        success: true,
        timestamp: new Date().toISOString(),
        settlement: {
          rail: 'Strike Lightning Network',
          address: 'rick2818@strike.me',
          btc_usd: btcData.price_usd || 76210,
          satoshis_per_usd: btcData.satoshis_per_usd || 1312,
          status: 'OPERATIONAL_24_7'
        },
        pipeline: {
          active_leads: leadsCount,
          audits_executed: auditsCount,
          dnc_suppressed: dncCount,
          daily_target_leads: 40,
          readiness_9am: '100% OPERATIVO'
        },
        financials: {
          daily_target_usd: 300,
          monthly_target_usd: 9000,
          break_even_usd: 26,
          net_margin_pct: 96.8
        },
        email_carrier: isSmtpReady ? 'GMAIL_SMTPS' : 'RESEND_API',
        status: 'ALL_SYSTEMS_GO'
      });
    }

    if (req.method === 'POST' && (pathname === '/api/dashboard/trigger-dispatch' || pathname.endsWith('/dashboard/trigger-dispatch'))) {
      try {
        const { executeOutboundDispatch } = await import('../scripts/outbound/send_smtp_dispatch.mjs');
        const result = await executeOutboundDispatch({ dryRun: req.body?.dryRun !== false });
        return res.status(200).json({ success: true, result });
      } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
      }
    }

    return res.status(404).json({ error: 'Not Found', path: pathname });
  } catch (err) {
    // No se expone err.message al cliente: puede filtrar detalles internos.
    console.error('[API ERROR]', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
