/**
 * =============================================================================
 * ENDPOINT SERVERLESS: WHATSAPP BUSINESS & SOPORTE CON GEMINI 2.5 FLASH
 * =============================================================================
 * Rutas:
 *   GET  /api/whatsapp          -> Estado del servicio y número de soporte (50375743444)
 *   POST /api/whatsapp/support  -> Chat de soporte respondido por Google Gemini 2.5 Flash
 *   POST /api/whatsapp          -> Despacho saliente o webhook entrante de Twilio
 * =============================================================================
 */

import twilio from 'twilio';
import {requireOperationalAuth} from '../lib/operational_auth.js';
import {
  applyStrictBankingHeaders,
  resolveCorsOrigin,
  checkRateLimit
} from '../lib/fiduciary_core.js';
import {
  getWhatsAppStatus,
  sendWhatsAppMessage,
  handleSupportWithGemini,
  BOLTECH_SUPPORT_PHONE,
  BOLTECH_SUPPORT_PHONE_DISPLAY
} from '../lib/whatsapp_engine.js';

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

  const clientIp = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '127.0.0.1';
  const { allowed, remainingSeconds } = checkRateLimit(clientIp, 40, 60000);
  if (!allowed) {
    res.setHeader('Retry-After', remainingSeconds);
    return res.status(429).json({ error: 'Too Many Requests', retryAfterSeconds: remainingSeconds });
  }

  try {
    const url = new URL(req.url, `https://${req.headers.host || 'localhost'}`);
    const pathname = url.pathname;

    // 1. GET: Información de soporte y estado
    if (req.method === 'GET') {
      const status = getWhatsAppStatus();
      return res.status(200).json({
        ...status,
        supportPhone: BOLTECH_SUPPORT_PHONE,
        supportPhoneDisplay: BOLTECH_SUPPORT_PHONE_DISPLAY,
        aiEngine: 'Google Gemini 2.5 Flash'
      });
    }

    // 2. POST: Manejo de consultas y soporte
    if (req.method === 'POST') {
      const body = req.body || {};
      if(body.From || body.Body || req.headers['x-twilio-signature']){
        const token=String(process.env.TWILIO_AUTH_TOKEN||'');
        const signature=String(req.headers['x-twilio-signature']||'');
        const host=String(req.headers['x-forwarded-host']||req.headers.host||'');
        if(!token||!signature||!host||!twilio.validateRequest(token,signature,'https://'+host+req.url,body))
          return res.status(403).json({success:false,error:'TWILIO_SIGNATURE_INVALID'});
      }

      // Caso A: Consulta al Asistente de Soporte Gemini 2.5 Flash (desde Web App o Webhook)
      const userMessage = body.message || body.query || body.Body;
      const isSupportQuery = Boolean(
        pathname.endsWith('/support') ||
        pathname.includes('support') ||
        (userMessage && !body.to && !body.mediaUrl)
      );

      if (isSupportQuery && userMessage) {
        const supportRes = await handleSupportWithGemini({
          message: userMessage,
          senderPhone: body.From || body.phone,
          history: body.history || []
        });

        // Si la petición viene de un Webhook de Twilio (Body & From presentes)
        if (body.From && body.Body) {
          res.setHeader('Content-Type', 'text/xml; charset=utf-8');
          return res.status(200).send(`<?xml version="1.0" encoding="UTF-8"?><Response><Message>${String(supportRes.reply||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</Message></Response>`);
        }

        return res.status(200).json(supportRes);
      }

      // Caso B: Despacho saliente de mensaje a un destinatario específico
      if(!requireOperationalAuth(req,res))return;
      if(body.ownerApproved!==true||body.recipientConsent!==true)
        return res.status(403).json({success:false,error:'APPROVAL_AND_CONSENT_REQUIRED'});
      const { to, body: msgBody, mediaUrl } = body;
      if (!to || !msgBody) {
        return res.status(400).json({
          success: false,
          error: 'Para enviar WhatsApp se requieren los campos "to" y "body", o "message" para consultar a Soporte Gemini 2.5 Flash.'
        });
      }

      const result = await sendWhatsAppMessage({ to, body: msgBody, mediaUrl });
      return res.status(result.success ? 200 : 422).json(result);
    }

    return res.status(405).json({ error: 'Método HTTP no permitido' });
  } catch (error) {
    console.error('[WhatsApp Support API Error]:', error);
    return res.status(500).json({
      success: false,
      error: error?.message || 'Error interno en servicio WhatsApp Soporte'
    });
  }
}
