/**
 * =============================================================================
 * BOLTECH GROUP — MOTOR DE MENSAJERÍA FIDUCIARIA: WHATSAPP BUSINESS & SMS
 * =============================================================================
 * Número Oficial de Soporte: +503 7574 3444 (50375743444)
 * Motor Cognitivo de Respuestas: Google Gemini 2.5 Flash
 * Conector: Twilio SDK (WhatsApp Business API & SMS)
 * =============================================================================
 */

import twilio from 'twilio';
import { generateAIResponse } from './ai_sdk.js';

export const BOLTECH_SUPPORT_PHONE = '50375743444';
export const BOLTECH_SUPPORT_PHONE_DISPLAY = '+503 7574 3444';
export const BOLTECH_SUPPORT_WA_URL = 'https://wa.me/50375743444';

/**
 * Obtener cliente autenticado de Twilio
 */
export function getTwilioClient(accountSid = null, authToken = null) {
  const sid = (accountSid || process.env.TWILIO_ACCOUNT_SID || '').trim();
  const token = (authToken || process.env.TWILIO_AUTH_TOKEN || '').trim();

  if (!sid || !token) {
    return null;
  }

  return twilio(sid, token);
}

/**
 * Diagnóstico de estado del motor de WhatsApp
 */
export function getWhatsAppStatus() {
  const sid = (process.env.TWILIO_ACCOUNT_SID || '').trim();
  const token = (process.env.TWILIO_AUTH_TOKEN || '').trim();
  const from = (process.env.TWILIO_WHATSAPP_NUMBER || `whatsapp:+${BOLTECH_SUPPORT_PHONE}`).trim();

  const isConfigured = Boolean(sid && token && sid.startsWith('AC'));

  return {
    success: true,
    channel: 'whatsapp_business',
    sdk: 'twilio',
    configured: isConfigured,
    supportNumber: BOLTECH_SUPPORT_PHONE,
    supportNumberDisplay: BOLTECH_SUPPORT_PHONE_DISPLAY,
    whatsappUrl: BOLTECH_SUPPORT_WA_URL,
    aiModel: 'Google Gemini 2.5 Flash',
    fromNumber: from,
    status: isConfigured ? 'OPERATIONAL_LIVE' : 'PENDING_TWILIO_CREDENTIALS'
  };
}

/**
 * Despachar mensaje de WhatsApp fiduciario a un prospecto o cliente
 * @param {Object} options
 * @param {string} options.to - Número de destino (ej: '+50371234567' o 'whatsapp:+50371234567')
 * @param {string} options.body - Contenido del mensaje de texto
 * @param {string} [options.mediaUrl] - URL opcional de imagen, PDF o video demostrativo
 */
export async function sendWhatsAppMessage({ to, body, mediaUrl = null }) {
  if (!to || !body) {
    throw new Error('Los parámetros "to" y "body" son requeridos para enviar WhatsApp.');
  }

  const client = getTwilioClient();
  const normalizedTo = to.startsWith('whatsapp:') ? to : `whatsapp:${to.trim()}`;
  const defaultFrom = (process.env.TWILIO_WHATSAPP_NUMBER || `whatsapp:+${BOLTECH_SUPPORT_PHONE}`).trim();

  if (!client) {
    return {
      success: false,
      delivered: false,
      channel: 'whatsapp',
      recipient: normalizedTo,
      reason: 'TWILIO_ACCOUNT_SID o TWILIO_AUTH_TOKEN no configurados en entorno local.',
      simulated: true,
      timestamp: new Date().toISOString()
    };
  }

  try {
    const payload = {
      from: defaultFrom,
      to: normalizedTo,
      body
    };

    if (mediaUrl) {
      payload.mediaUrl = [mediaUrl];
    }

    const message = await client.messages.create(payload);

    return {
      success: true,
      delivered: true,
      channel: 'whatsapp',
      sid: message.sid,
      status: message.status,
      to: message.to,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    return {
      success: false,
      delivered: false,
      channel: 'whatsapp',
      error: error?.message || 'Error al despachar mensaje de WhatsApp vía Twilio API',
      code: error?.code || 'TWILIO_API_ERROR'
    };
  }
}

/**
 * Motor de Soporte Asistido por Google Gemini 2.5 Flash
 * Responde dudas sobre BolTech Group, AuditFlow AI, pasarelas de pago y ciberseguridad
 * @param {Object} params
 * @param {string} params.message - Pregunta del usuario
 * @param {string} [params.senderPhone] - Número del usuario (si viene de WhatsApp)
 * @param {Array} [params.history] - Historial de conversación
 */
export async function handleSupportWithGemini({ message, senderPhone = null, history = [] }) {
  if (!message || typeof message !== 'string') {
    throw new Error('El mensaje de consulta es requerido.');
  }

  const systemPrompt = `Eres "Soporte BolTech Group", el asistente de atención al cliente e ingeniería de soporte fiduciario de BolTech Group y Boltech Group.
Tu motor de razonamiento es Google Gemini 2.5 Flash.
Tu canal de WhatsApp oficial de soporte es: ${BOLTECH_SUPPORT_PHONE_DISPLAY} (${BOLTECH_SUPPORT_PHONE}).
Autoridad Máxima / Director General: Ricardo Bolaños.

CONOCIMIENTO OPERATIVO CLAVE:
1. Boltech Group ofrece exclusivamente agentes preelaborados y custom agents (agentes a medida) para procesos empresariales.
2. Agentes preelaborados: adaptar un flujo existente al proceso y herramientas del cliente. Custom agents: diseñar el flujo e integraciones según requisitos y criterios de aceptación.
3. Precio, alcance, soporte y entrega requieren una propuesta aprobada. No reutilices precios de productos retirados ni prometas despliegue inmediato, rentabilidad, certificaciones o activación tras un pago sin evidencia.
4. El contacto comercial confirmado es ricardo.boltechgroup@gmail.com. Solicita proceso, herramientas y empresa para preparar una cotización.
5. Las pasarelas requieren verificación del proveedor; no prometas comisiones, liquidación ni habilitación de un medio de pago sin evidencia actual.
6. Responde en 2 a 4 párrafos concisos. No ofrezcas AuditFlow, Unblock Shield, parches, planes Flash/Pro o auditorías de pago.`;

  try {
    const aiRes = await generateAIResponse({
      prompt: message,
      system: systemPrompt,
      provider: 'google',
      modelName: 'gemini-2.5-flash',
      temperature: 0.6,
      maxTokens: 1024
    });

    return {
      success: true,
      agent: 'Soporte BolTech Group',
      model: 'Google Gemini 2.5 Flash',
      whatsappNumber: BOLTECH_SUPPORT_PHONE,
      whatsappDisplay: BOLTECH_SUPPORT_PHONE_DISPLAY,
      reply: aiRes.text,
      timestamp: new Date().toISOString()
    };
  } catch (err) {
    console.warn('[Gemini 2.5 Flash Fallback en Soporte]:', err.message);
    
    // Fallback defensivo fiduciario en caso de API key no configurada aún en local
    return {
      success: true,
      agent: 'Soporte BolTech Group',
      model: 'Google Gemini 2.5 Flash (Modo Resiliente)',
      whatsappNumber: BOLTECH_SUPPORT_PHONE,
      whatsappDisplay: BOLTECH_SUPPORT_PHONE_DISPLAY,
      reply: `Hola. Gracias por comunicarte con Soporte de BolTech Group. Atendemos consultas sobre infraestructura cloud defensiva, auditoría de contratos con AuditFlow AI y pasarelas de pago (Stripe, Wompi y Bitcoin Lightning). Para una atención personalizada inmediata con el equipo de Ricardo Bolaños, puedes contactarnos directamente a nuestro WhatsApp oficial: ${BOLTECH_SUPPORT_PHONE_DISPLAY} o enviarnos un correo a soporte@boltech.ai. ¿En qué servicio específico podemos orientarte?`,
      timestamp: new Date().toISOString()
    };
  }
}

