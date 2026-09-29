export function evaluateCommercialProgress({ verifiedSales = null, hotLeads = null, savedContacts = null, referrals = null } = {}) {
  const collected = verifiedSales && Number.isFinite(verifiedSales.cashCollectedUsd)
    ? verifiedSales.cashCollectedUsd : null;
  const paidOrders = verifiedSales && Number.isInteger(verifiedSales.paidOrders)
    ? verifiedSales.paidOrders : null;
  const consentPending = referrals && Number.isInteger(referrals.consentPending)
    ? referrals.consentPending : null;

  let focus;
  let hypothesis;
  if (collected === null) {
    focus = 'Restablecer la lectura autenticada de cobros verificados; no declarar $0 a partir de datos ausentes.';
    hypothesis = 'Una medición fiable permitirá distinguir falta de ventas de una falla de integración.';
  } else if (collected > 0) {
    focus = 'Revisar el origen del primer cobro y repetir la oferta/canal que lo produjo con prospectos comparables.';
    hypothesis = 'La repetición del canal que ya cobró puede generar una segunda venta verificable.';
  } else if (typeof hotLeads === 'number' && hotLeads > 0) {
    focus = 'Calificar los hot leads reales de Explee y preparar respuesta individual para los que encajen con el ICP.';
    hypothesis = 'Responder primero a interés observado acortará el camino a una reunión y propuesta.';
  } else if (typeof savedContacts === 'number' && savedContacts > 0) {
    focus = 'Validar hasta cinco contactos de Apollo contra el ICP y preparar una oferta específica para su cuello de botella.';
    hypothesis = 'Una propuesta concreta a contactos verificados generará la primera conversación comercial.';
  } else {
    focus = 'Obtener prospectos verificables con un problema de cotizaciones, consultas o soporte y definir una oferta piloto concreta.';
    hypothesis = 'Un ICP y oferta piloto claros permitirán medir conversaciones reales en lugar de contar registros de prueba.';
  }

  return {
    goal: 'Primer cobro verificado > $0.00',
    cashCollectedUsd: collected,
    paidOrders,
    hotLeadsVisible: hotLeads,
    savedContactsVisible: savedContacts,
    referralsPendingConsent: consentPending,
    replies: null,
    meetings: null,
    proposals: null,
    measurementNote: 'Hot leads, contactos guardados, presupuestos y deals WON no son ventas ni efectivo cobrado. Respuestas, reuniones y propuestas quedan N/D sin evidencia del proveedor/CRM.',
    focus,
    hypothesis,
    acceptance: 'Registrar al menos una conversación real y su siguiente paso; la meta final es un cobro confirmado por el proveedor.',
  };
}
