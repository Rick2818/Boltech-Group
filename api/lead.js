// Vercel Serverless Function: Lead Capture, Instant Forensic Report & Fiduciary Dispatch
import { commercialOfferContext } from '../lib/commercial_offer.js';
import { confirmIntake } from '../lib/intake_confirmation.js';
import { dispatchUniversalEmail } from '../lib/universal_email_engine.js';
import { scanDomain, normalizeDomain } from '../lib/header_scanner.js';
import { buildScanEmail } from '../lib/scan_report_email.js';
import { checkRateLimit } from '../lib/fiduciary_core.js';
import { syncInboundLeadToHubSpotAndExplee } from '../lib/bidirectional_commercial_sync.js';

function escapeForHtml(text) {
  return String(text == null ? '' : text)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function getClientIp(req) {
  const fwd = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return req.headers['x-real-ip'] || fwd || req.socket?.remoteAddress || 'unknown';
}

export default async function handler(req, res) {
  // Allow only POST
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // Este endpoint envía correos a direcciones arbitrarias: límite estricto por IP
  const rl = checkRateLimit('lead:' + getClientIp(req), 5, 10 * 60 * 1000);
  if (!rl.allowed) {
    res.setHeader('Retry-After', String(rl.remainingSeconds));
    return res.status(429).json({ error: `Demasiadas solicitudes. Intenta de nuevo en ${Math.ceil(rl.remainingSeconds / 60)} min.` });
  }

  try {
    const { email, domain, message, timestamp } = req.body || {};

    // Strict email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(String(email).trim())) {
      return res.status(400).json({ error: 'Dirección de correo electrónico no válida' });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const cleanDomain = String(domain || 'tu empresa').trim().replace(/[^a-zA-Z0-9.-]/g, '') || 'tu empresa';
    const cleanMessage = String(message || '').trim().substring(0, 1000);
    const cleanPainPoint = String(req.body?.painPoint || '').trim().substring(0, 1000);
    const cleanCompany = String(req.body?.companyName || cleanDomain || 'tu empresa').trim().substring(0, 120);
    const leadTime = timestamp || new Date().toISOString();

    console.log(`[FIDUCIARY INTAKE] Email: ${cleanEmail} | Company: ${cleanCompany} | Pain: ${cleanPainPoint ? 'YES' : 'NO'}`);

    const isCustomAgentRequest = Boolean(cleanPainPoint && cleanPainPoint.length > 3);
    const isCustomSupportInquiry = Boolean(!isCustomAgentRequest && cleanMessage && cleanMessage.length > 5);

    let subject = '';
    let htmlContent = '';
    let textContent = '';
    const cabinaUrl = `https://boltech-group.vercel.app/cabina?email=${encodeURIComponent(cleanEmail)}&company=${encodeURIComponent(cleanCompany)}&pain=${encodeURIComponent(cleanPainPoint)}`;

    if (isCustomAgentRequest) {
      // INTAKE: AGENTE A LA MEDIDA PARA DESBLOQUEAR PROCESO LENTO
      subject = `🤖 Recibimos tu proceso — Evaluación de Agente a la Medida para ${cleanCompany}`;

      textContent = `Estimado Equipo de ${cleanCompany}:

Recibimos la descripción del proceso que desean mejorar:
"${cleanPainPoint}"

${commercialOfferContext()}

Boltech Group lo registró para revisión comercial del proceso. No afirmamos que exista un agente terminado hasta que el diseño haya sido construido y verificado.

Puede abrir la Cabina Cloud para revisar el contexto registrado y continuar la evaluación:
${cabinaUrl}

Siguiente paso:
1. Revisamos el proceso y sus restricciones.
2. Definimos qué parte puede automatizarse de forma segura.
3. Preparamos una demostración verificable antes de hablar de despliegue en producción.

Atentamente,
Dirección de Ingeniería y Operaciones
Boltech Group
Correo: ricardo.boltechgroup@gmail.com
WhatsApp: +503 7574 3444`;

      htmlContent = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #05070e; color: #f8fafc; padding: 20px; }
    .box { max-width: 600px; margin: 0 auto; background: #0b1120; border: 1px solid #1e293b; border-radius: 16px; padding: 32px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
    .badge { display: inline-block; padding: 4px 12px; background: rgba(99, 102, 241, 0.15); color: #818cf8; border: 1px solid rgba(99, 102, 241, 0.3); border-radius: 20px; font-size: 11px; font-weight: 700; text-transform: uppercase; font-family: monospace; }
    .pain-box { background: #05070e; border: 1px solid #334155; border-left: 4px solid #6366f1; border-radius: 8px; padding: 14px 18px; margin: 18px 0; color: #e2e8f0; font-style: italic; font-size: 13px; line-height: 1.5; }
    .btn { display: inline-block; background: linear-gradient(135deg, #6366f1, #06b6d4); color: #ffffff !important; padding: 14px 28px; border-radius: 10px; text-decoration: none; font-weight: 800; font-size: 13px; margin: 20px 0; box-shadow: 0 4px 15px rgba(99, 102, 241, 0.4); text-align: center; }
    .step { background: #0f172a; border-radius: 8px; padding: 12px 16px; margin-bottom: 10px; font-size: 12px; border: 1px solid #1e293b; }
    .footer { text-align: center; font-size: 11px; color: #64748b; margin-top: 24px; font-family: monospace; }
  </style>
</head>
<body>
  <div class="box">
    <div style="text-align: center; margin-bottom: 20px;">
      <span class="badge">Revisión de solicitudes • Propuesta individual</span>
      <h2 style="color: #ffffff; margin: 12px 0 6px 0; font-size: 20px; font-weight: 800;">Solución de Proceso Lento para ${escapeForHtml(cleanCompany)}</h2>
      <p style="color: #94a3b8; margin: 0; font-size: 12px;">Boltech Group — Registro, asignación y seguimiento</p>
    </div>

    <p style="font-size: 14px; line-height: 1.5;">Hola <strong>Equipo de ${escapeForHtml(cleanCompany)}</strong>,</p>
    <p style="font-size: 13px; color: #cbd5e1; line-height: 1.5;">Hemos recibido la descripción del proceso que hoy está lento o no resuelto en su empresa:</p>
    
    <div class="pain-box">
      "${escapeForHtml(cleanPainPoint)}"
    </div>

    <p style="font-size: 13px; color: #cbd5e1; line-height: 1.5;">
      Boltech Group registró el proceso para <strong>revisión comercial del flujo de solicitudes</strong>. No presentamos una automatización como terminada hasta que haya sido construida y verificada.
    </p>

    <!-- BOTÓN DE ENLACE DIRECTO A LA CABINA CLOUD -->
    <div style="text-align: center; margin: 25px 0;">
      <a href="${cabinaUrl}" target="_blank" class="btn">
        🚀 Abrir Cabina Cloud y Revisar Solicitud →
      </a>
      <span style="display: block; font-size: 11px; color: #94a3b8; margin-top: 6px;">La cabina conserva el contexto de la solicitud para continuar la evaluación.</span>
    </div>

    <!-- PASOS DE ACTIVACIÓN -->
    <h3 style="color: #ffffff; font-size: 13px; margin: 20px 0 10px 0; text-transform: uppercase; font-family: monospace;">¿Qué sigue?</h3>
    <div class="step">
      <strong style="color: #38bdf8;">1. Revisar contexto:</strong> Abra la Cabina Cloud para ver la solicitud registrada.
    </div>
    <div class="step">
      <strong style="color: #818cf8;">2. Verificación:</strong> Definimos entradas, salidas, reglas, integraciones y límites del proceso.
    </div>
    <div class="step">
      <strong style="color: #34d399;">3. Demostración:</strong> Presentamos un flujo real y verificable antes de proponer despliegue en producción.
    </div>

    <div class="footer">
      <p style="margin: 4px 0;">BolTech Group • WhatsApp Oficial: <a href="https://wa.me/50375743444" style="color: #34d399; text-decoration: none;">+503 7574 3444</a></p>
      <p style="margin: 0;">Infraestructura Cloud Segura • Inferencia en Memoria Volátil RAM</p>
    </div>
  </div>
</body>
</html>
      `;
    } else if (!isCustomSupportInquiry) {
      // DIAGNÓSTICO REAL: se escanea el dominio en este momento y el correo solo contiene lo detectado
      const targetDomain = normalizeDomain(domain);
      if (!targetDomain) {
        return res.status(400).json({ error: 'Ingresa un nombre de dominio público válido (ejemplo: tuempresa.com).' });
      }

      const scan = await scanDomain(targetDomain);
      if (!scan.ok) {
        // Sin escaneo real no se envía ningún "informe"
        return res.status(422).json({ error: scan.error.message, code: scan.error.code });
      }

      const built = buildScanEmail({ domain: targetDomain, email: cleanEmail, scan });
      subject = built.subject;
      textContent = built.text;
      htmlContent = built.html;
    } else {
      // INQUIRY / MENSAJE PERSONALIZADO DE SOPORTE
      subject = `[CONFIRMACIÓN] Solicitud de Soporte Técnico para ${cleanDomain} — Unblock AI Shield`;

      textContent = `Estimado Director / Cliente de ${cleanDomain}:

Hemos recibido su consulta en el Centro de Soporte de Unblock AI Shield:
"${cleanMessage}"

El equipo de Boltech Group revisará su requerimiento y responderá por el canal disponible.

Si su requerimiento es de carácter urgente, puede comunicarse de inmediato a:
Correo Oficial: ricardo.boltechgroup@gmail.com
Portal de Monitoreo: https://boltech-group.vercel.app

Atentamente,
Equipo de Operaciones e Ingeniería Fiduciaria
BolTech Group`;

      htmlContent = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #030712; color: #f8fafc; padding: 20px; }
    .box { max-width: 600px; margin: 0 auto; background: #0f172a; border: 1px solid #1e293b; border-radius: 12px; padding: 28px; }
    .btn { display: inline-block; background: #0284c7; color: #ffffff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 700; margin-top: 16px; }
  </style>
</head>
<body>
  <div class="box">
    <h2 style="color: #38bdf8; margin-top: 0;">Solicitud Recibida — BolTech Group</h2>
    <p>Estimado Director de <strong>${cleanDomain}</strong>,</p>
    <p>Hemos recibido su requerimiento:</p>
    <blockquote style="background: #1e293b; padding: 12px 16px; border-left: 3px solid #38bdf8; color: #cbd5e1; font-style: italic;">
      "${escapeForHtml(cleanMessage)}"
    </blockquote>
    <p>El equipo de Boltech Group revisará su requerimiento y responderá por el canal disponible.</p>
    <a href="https://boltech-group.vercel.app" class="btn">Ir a BolTech Group →</a>
  </div>
</body>
</html>
      `;
    }

    // Persist the complete request before acknowledging it or sending a receipt.
    let crmSync;
    try {
      crmSync = await syncInboundLeadToHubSpotAndExplee({
        email: cleanEmail, companyName: cleanCompany,
        painPoint: cleanPainPoint, message: cleanMessage, domain: cleanDomain,
        service: isCustomAgentRequest ? 'Registro, asignación y seguimiento de solicitudes' : isCustomSupportInquiry ? 'Support' : 'Unblock AI Shield'
      });
      if (!crmSync?.hubspot?.jobId) throw new Error('CRM_RECORD_UNCONFIRMED');
    } catch {
      return res.status(503).json({ success: false, registration: { status: 'FAILED' },
        error: 'No se pudo guardar la solicitud. No se envió un correo de confirmación.' });
    }
    const registration = { status: 'RECORDED', requestId: crmSync.hubspot.jobId,
      contactSyncStatus: crmSync.hubspot.status };
    textContent += '\n\nReferencia de solicitud: ' + registration.requestId;
    htmlContent += '<p>Referencia de solicitud: ' + registration.requestId + '</p>';

    // DISPARO EN RED REAL (LIVE NETWORK OBLIGATORIO)
    let dispatchResult;
    try { dispatchResult = await confirmIntake({requestId: registration.requestId, recipient: cleanEmail,
      send: () => dispatchUniversalEmail({
      to: cleanEmail,
      subject,
      text: textContent,
      html: htmlContent
    })}); } catch {
      return res.status(503).json({ success: false, registration, deliveryStatus: 'UNKNOWN',
        error: 'Solicitud guardada, pero no se confirmó el correo. Contacta a soporte con la referencia antes de reintentar.' });
    }

    console.log(`[LIVE EMAIL DISPATCH] Success: ${dispatchResult.success} | Transport: ${dispatchResult.transport} | Provider status: ${dispatchResult.deliveryStatus || 'UNKNOWN'}`);

    if (!dispatchResult.success || dispatchResult.acceptedByProvider !== true) {
      return res.status(503).json({
        success: false,
        registration,
        error: 'El correo no fue aceptado por el proveedor. No se reporta como enviado.',
        deliveryStatus: dispatchResult.deliveryStatus || 'FAILED',
        transport: dispatchResult.transport || null
      });
    }

    // NOTIFICACIÓN A TELEGRAM (SI ESTÁ CONFIGURADO)
    if (!dispatchResult.duplicate && process.env.TELEGRAM_BOT_TOKEN && (process.env.TELEGRAM_AUTHORIZED_USER_ID || process.env.TELEGRAM_CHAT_ID)) {
      const chatId = process.env.TELEGRAM_AUTHORIZED_USER_ID || process.env.TELEGRAM_CHAT_ID;
      try {
        const text = `🎯 *LEAD PROCESADO EN RED REAL (UNBLOCK AI SHIELD)*\n\n📧 *Email:* \`${cleanEmail}\`\n🏢 *Empresa:* \`${cleanCompany}\`\n📨 *Tipo:* ${isCustomAgentRequest ? 'Agente a la Medida (Proceso Lento)' : isCustomSupportInquiry ? 'Consulta de Soporte' : 'Diagnóstico de Blindaje'}\n🚀 *Transporte:* \`${dispatchResult.transport}\`\n🆔 *MessageID:* \`${dispatchResult.messageId}\`\n⏰ *Fecha:* \`${leadTime}\``;
        await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text,
            parse_mode: 'Markdown'
          })
        });
      } catch (tgErr) {
        console.error('[TELEGRAM NOTIFY ERROR]', tgErr.message);
      }
    }

    return res.status(200).json({
      success: true,
      registration,
      message: isCustomAgentRequest
        ? 'Solicitud guardada; el proveedor aceptó el correo de confirmación. La cotización requiere evaluación y aprobación.'
        : 'El proveedor de correo aceptó el diagnóstico para despacho.',
      domain: cleanDomain,
      cabinaUrl: isCustomAgentRequest ? cabinaUrl : undefined,
      crmSync: crmSync ? { synced: crmSync.hubspot?.synced === true, queued: ['PENDING', 'RETRY_PENDING'].includes(crmSync.hubspot?.status), hubspot: crmSync.hubspot?.status, explee: crmSync.explee?.status } : undefined,
      transport: dispatchResult.transport,
      deliveryStatus: dispatchResult.deliveryStatus,
      providerResponse: dispatchResult.providerResponse || null,
      messageId: dispatchResult.messageId || null
    });
  } catch (err) {
    console.error('[LEAD HANDLER CRITICAL ERROR]', err);
    return res.status(500).json({ error: 'Error interno al procesar la solicitud' });
  }
}
