// Bounded guidance from the customer's statement; never an approved scope or promise.
export function orientReception(pain, language='es') {
  const text=String(pain).toLowerCase();
  if(language==='en') return 'We can evaluate automating repeated steps, subject to a review of your existing workflow, integrations and approval requirements.';
  if(/cotiza|consulta|lead|solicitud|seguimiento|cliente|inquir|follow.?up/.test(text))
    return 'Podríamos ayudarte a registrar cada consulta, asignar un responsable y conservar la próxima acción. Para saber si resuelve tu caso, necesito entender cómo llega y se atiende hoy una solicitud.';
  if(/excel|hoja|document|pdf|factura|copiar|dato|sheet|invoice/.test(text))
    return 'Podríamos evaluar un agente que organice información y prepare registros o documentos para revisión. Debemos comprobar formatos, herramientas y reglas antes de confirmar que puede hacerlo.';
  return 'Podemos evaluar un agente para reducir pasos repetitivos y hacer visibles los pendientes. Primero necesito conocer el proceso; si requiere decisiones humanas, las mantendremos bajo tu control.';
}
export const receptionSteps=[
  ['painPoint','¿Qué problema te está costando tiempo, dinero o clientes?','text',1000],
  ['workflow','¿Cómo sucede hoy, paso a paso, desde que comienza hasta que se resuelve?','text',1000],
  ['impact','¿Cuánto tiempo, dinero u oportunidades pierdes? Una estimación es suficiente.','text',500],
  ['tools','¿Qué herramientas y datos usas? No compartas contraseñas ni datos privados.','text',200],
  ['decision','¿Quién participa y decide? ¿Qué acciones deben conservar aprobación humana?','text',500],
  ['result','¿Qué resultado medible necesitas conseguir y para cuándo?','text',500],
  ['limits','¿Qué no debe hacer nunca el agente?','text',500],
  ['commercialIntent','¿Quieres una propuesta de la prueba de US$600, de un agente de US$900, o aclarar una duda antes de decidir?','text',500],
  ['companyName','¿Cómo se llama tu empresa?','text',120],
  ['email','¿A qué correo podemos responderte sobre esta necesidad?','email',254]
];

// Guidance only; feasibility and accepted scope require a written proposal.
export const receptionPricingEn = 'Pilot implementation USD 600: USD 300 upfront and USD 300 after verified delivery. Scope: one business workflow and one simple integration. A written proposal and approval are required; license costs and usage are separate. No automatic payment.';
export const receptionPricing = 'Prueba de implementación US$600 (US$300 iniciales y US$300 contra entrega verificada): una empresa, un flujo web y una integración sencilla. Plazo: 14 días desde alcance aceptado, anticipo confirmado y accesos disponibles. Implementación general US$900, según alcance aprobado. Licencias, consumo y mantenimiento aparte. No hay contratación ni cobro automático.';
export function recommendReception(values = {}, language='es') {
  if(language==='en') return {type:'CUSTOM_REVIEW',text:'We can review a tailored solution for this workflow. Scope, integrations and permissions must be approved in writing before implementation. '+receptionPricingEn};
  const process = String(values.painPoint || '').trim();
  const result = String(values.result || '').trim();
  const routine = /cotiza|consulta|lead|solicitud|seguimiento|inquir|follow.?up/i.test(process);
  return {
    type: routine ? 'PREBUILT_CANDIDATE' : 'CUSTOM_REVIEW',
    text: (routine
      ? 'Te recomendamos evaluar un agente preelaborado de registro y seguimiento, adaptado a tus herramientas.'
      : 'Te recomendamos evaluar un agente a medida para este proceso; primero debemos confirmar su viabilidad.') +
      ` Objetivo declarado: ${result || 'por definir'}. Herramientas: ${values.tools || 'por definir'}. ` +
      'El alcance debe respetar las aprobaciones y límites que indicaste. ' + receptionPricing +
      ' Siguiente paso: preparar una propuesta por escrito con entregables y criterios de aceptación. Solicitarla no te obliga a comprar.'
  };
}
