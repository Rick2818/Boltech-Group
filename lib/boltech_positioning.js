// Approved commercial guidance, not a tool execution or evidence of a delivery.
export const POSITIONING_VERSION = 'boltech-outcome-20261110-v1';
export const POSITIONING_SYSTEM = `Position Boltech as a scoped implementation service for small businesses that want help adapting a business workflow, rather than comparing AI model counts. Lead with quotation intake: registration, reference, owner and next action. Treat those as proposed delivery criteria, never as integrations already active for a visitor. Offer a written scope and feasibility check; the customer-facing CTA is 'Quiero mi proceso funcionando' / 'Get my workflow working'. The existing scoped pilot is one business, one web workflow and one simple integration, subject to approved scope. Implementation, third-party usage and ongoing support are separate. No fabricated savings, clients, certifications, guarantees, scarcity, free services, refunds, revenue, 24/7 SLA or competitor shortcomings. Relevance AI and other platforms can also offer implementation and partners; never claim Boltech alone offers these. Ask what workflow, tools and volume the buyer has and what would prove success. Use the customer's answers for a draft brief, not a binding quote, acceptance, order or payment. For competitor objections, recommend a platform when a customer wants to build and maintain agents themselves; offer Boltech when they want a focused implementation with agreed acceptance criteria. Always distinguish current verified capability from proposed work.`;

const copy = {
 es: {
  competitor: 'Boltech puede encajarte si quieres ayuda para adaptar y probar un proceso concreto de tu empresa. Acordamos por escrito el flujo, la integración, los costos y la prueba de entrega. Las plataformas y otros proveedores también pueden ofrecer implementación: compara el alcance completo, no solo la suscripción. ¿Qué proceso necesitas resolver primero?',
  proof: 'Antes de contratar acordamos qué debe demostrar la entrega. Para solicitudes de cotización: registro con referencia, responsable, próxima acción y manejo de duplicados y errores. Es un alcance propuesto, no una integración ya activa para ti. ¿Qué herramienta utilizas hoy para registrar esas solicitudes?',
  fit: 'Podemos empezar por registrar, asignar y dar seguimiento a tus solicitudes de cotización: una empresa, un flujo web y una integración sencilla, previa validación de viabilidad y alcance. ¿Cómo recibes y registras esas solicitudes actualmente?',
  close: 'El siguiente paso es preparar tu alcance por escrito: proceso, herramienta a conectar, entregables, costos separados y prueba de aceptación. Es un borrador para revisión; no constituye un pedido ni confirma un pago. ¿Qué proceso y herramienta quieres incluir?',
  roi: 'Podemos estimar el valor con tus datos: solicitudes al mes, minutos por solicitud y costo por hora. El tiempo potencial debe restar la supervisión; también se descuentan herramientas y soporte. Una estimación no garantiza ahorros ni ventas. ¿Cuántas solicitudes procesas al mes?'
 },
 en: {
  competitor: 'Boltech may fit if you want help adapting and testing one specific business workflow. We agree on the workflow, integration, costs and acceptance test in writing. Platforms and other providers can also offer implementation: compare the complete scope, not just the subscription. Which workflow do you need to solve first?',
  proof: 'Before contracting, we agree on what the delivery must demonstrate. For quotation requests: a recorded reference, an owner, a next action, and duplicate and error handling. This is a proposed scope, not an integration already active for you. Which tool do you use to record requests today?',
  fit: 'We can start by recording, assigning and tracking quotation requests: one business, one web workflow and one simple integration, subject to feasibility and agreed scope. How do you receive and record requests today?',
  close: 'The next step is a written scope: workflow, tool to connect, deliverables, separate costs and acceptance test. This is a draft for review, not an order or a payment confirmation. Which workflow and tool would you like to include?',
  roi: 'We can estimate value using your monthly request volume, minutes per request and hourly cost. Potential time saved must allow for supervision; tools and support costs also count. An estimate does not guarantee savings or sales. How many requests do you process each month?'
 }
};

export function positioningAnswer({message,language='es'}={}) {
 if(typeof message!=='string')return null;
 const m=message.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 let intent;
 if(/\b(relevance|competencia|competidor\w*|competitor\w*|chatbase|botpress|sintra)\b|por que.{0,35}boltech|why.{0,35}boltech|que.{0,15}diferenc|what.{0,15}different/.test(m))intent='competitor';
 else if(/prueba de entrega|criterios? de aceptacion|como.{0,20}(comprob|demuestr|verific)|acceptance (test|criteria)|proof of delivery/.test(m))intent='proof';
 else if(/quiero mi proceso funcionando|get my workflow working|evaluar mi caso|assess my workflow/.test(m))intent='fit';
 else if(/^(quiero (comprar|contratar|empezar)|i (want to buy|want to start)|prepara (mi|una) propuesta|prepare (my|a) proposal)/.test(m))intent='close';
 else if(/\broi\b|retorno de inversion|cuanto.{0,15}ahorr|how much.{0,15}save/.test(m))intent='roi';
 else return null;
 return {mode:'COMMERCIAL_GUIDANCE',reply:copy[language==='en'?'en':'es'][intent],contentVersion:POSITIONING_VERSION,materialId:'boltech:'+intent,authorizedActions:[],qualified:false};
}
