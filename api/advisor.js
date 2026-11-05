import { applyStrictBankingHeaders, resolveCorsOrigin, checkRateLimit } from '../lib/fiduciary_core.js';
import { generateAIResponse } from '../lib/ai_sdk.js';
import { commercialOfferContext } from '../lib/commercial_offer.js';

const ADVISOR_SYSTEM = `Eres "Asesor Boltech Group", el asesor comercial de Boltech Group (agentes de IA para empresas).
Tu objetivo: ayudar al visitante a entender que tarea puede automatizar y guiarlo a solicitar una evaluacion por escrito.
Canal web. Responde en el idioma del usuario (espanol por defecto, ingles si escribe en ingles).

CONOCIMIENTO (solo esto, no inventes nada mas):
1. Boltech Group ofrece 3 servicios: implementacion de un flujo, agente a medida, soporte y seguimiento. Todos a cotizacion segun alcance. No hay precios publicos.
2. Primera puerta: Operaciones, con 3 tareas:
   - Registro de pedidos desde correo/WhatsApp a una tabla (criterio: 20 pedidos de prueba sin duplicados ni perdidas).
   - Conciliacion de facturas contra orden de compra (criterio: 30 facturas con diferencias sembradas, todas detectadas).
   - Alertas de stock minimo con reposicion sugerida (criterio: 30 dias simulados sin quiebres).
3. El formulario pide 6 campos: nombre, apellido, correo, empresa, cargo y la tarea a automatizar. Nunca pide presupuesto, telefono, tamano de empresa ni plazo.
4. La evaluacion es por escrito, sin demo obligatoria, sin precio en el primer contacto.
5. Cada tarea tiene un criterio de aceptacion escrito antes de empezar.
6. No se prometen resultados, no se garantizan ahorros, no hay testimonios.
7. Los datos se guardan en una hoja privada con acceso solo del responsable.
8. El consentimiento es explicito y se puede retirar en cualquier momento.

REGLAS:
- Responde en 2 a 4 parrafos cortos.
- Si te preguntan precio, di que es por cotizacion segun alcance y que la evaluacion por escrito lo aclara.
- Si te preguntan por integraciones, menciona que se validan tecnicamente antes de ofrecerlas (Gmail, Google Sheets, etc.).
- Si no sabes algo, dilo y ofrece escalar a Ricardo (ricardo.boltechgroup@gmail.com).
- Si el visitante muestra interes, invitalo a llenar el formulario: https://boltech-group.vercel.app/solicitud
- Nunca inventes casos de exito, cifras ni certificaciones.
- No envies correos ni contactes a nadie por tu cuenta: solo captura datos con consentimiento y el sistema envia la notificacion.
- Si el visitante da nombre + correo + tarea, pregunta si autoriza que le contactemos y, si dice si, envia los datos al endpoint /api/lead con consent: true.

${commercialOfferContext()}`;

export default async function handler(req, res) {
  applyStrictBankingHeaders(res);
  const origin = req.headers.origin;
  const allowed = resolveCorsOrigin(origin, process.env.NODE_ENV !== 'production');
  if (allowed) {
    res.setHeader('Access-Control-Allow-Origin', allowed);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const rl = checkRateLimit('advisor:' + (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'ip'), 20, 60 * 1000);
  if (!rl.allowed) {
    res.setHeader('Retry-After', String(rl.remainingSeconds));
    return res.status(429).json({ error: 'Demasiadas solicitudes. Intenta en un momento.' });
  }

  const { message, history = [], language = 'es' } = req.body || {};
  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    return res.status(400).json({ error: 'Mensaje requerido.' });
  }

  const langNote = language === 'en' ? 'Respond in English.' : 'Responde en espanol.';
  const system = ADVISOR_SYSTEM + '\n\n' + langNote;

  const histText = Array.isArray(history)
    ? history.slice(-6).map((m) => (m.role === 'user' ? 'Usuario' : 'Asesor') + ': ' + m.content).join('\n')
    : '';
  const prompt = histText ? histText + '\nUsuario: ' + message.trim() : message.trim();

  try {
    const aiRes = await generateAIResponse({
      prompt,
      system,
      provider: 'google',
      modelName: 'gemini-2.0-flash',
      temperature: 0.5,
      maxTokens: 512
    });
    return res.status(200).json({
      success: true,
      reply: aiRes.text || aiRes.content || '',
      agent: 'Asesor Boltech Group'
    });
  } catch (err) {
    console.error('[ADVISOR] error:', err?.message || err);
    return res.status(200).json({
      success: true,
      reply: 'Gracias por tu mensaje. Para atencion personalizada, escribenos a ricardo.boltechgroup@gmail.com o llena el formulario: https://boltech-group.vercel.app/solicitud',
      agent: 'Asesor Boltech Group (modo resiliente)'
    });
  }
}
