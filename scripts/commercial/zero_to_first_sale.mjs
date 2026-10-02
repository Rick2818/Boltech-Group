export function evaluateCommercialProgress({ verifiedSales = null, hotLeads = null, savedContacts = null, referrals = null, cohort = null } = {}) {
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
    hypothesis = 'Responder primero a interés observado acortará el camino a un diagnóstico por email y propuesta.';
  } else if (cohort?.stageCounts?.Researching > 0) {
    focus = `Validar el decisor y confirmar la necesidad en las ${cohort.stageCounts.Researching} empresas investigadas de ${cohort.cohort}; no asumir que el formulario de cotización prueba demora.`;
    hypothesis = 'Confirmar decisor y necesidad permitirá pasar de empresas reales a prospectos calificados.';
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
    cohort: cohort || null,
    replies: null,
    meetings: null,
    proposals: null,
    measurementNote: 'Hot leads, contactos guardados, presupuestos y deals WON no son ventas ni efectivo cobrado. Respuestas, reuniones y propuestas quedan N/D sin evidencia del proveedor/CRM.',
    focus,
    hypothesis,
    acceptance: 'Registrar al menos una conversación real y su siguiente paso; la meta final es un cobro confirmado por el proveedor.',
  };
}

export function buildMitAgenda(progress) {
  const researching = progress.cohort?.stageCounts?.Researching;
  const morningFocus = progress.hotLeadsVisible > 0
    ? `Revisar ${progress.hotLeadsVisible} hot leads de Explee y sus conversaciones reales antes de ampliar prospectos.`
    : researching > 0
      ? `Validar decisor y necesidad de las ${researching} empresas RSI-01 en Airtable; Apollo solo para completar datos verificables.`
      : 'Revisar RSI-01 y localizar empresas verificables; no contar registros de QA ni contactos sin fuente.';
  return [
    { at: '09:00', owner: 'Boltech', action: 'Leer salud, hot leads, etapas RSI-01 y cobros; señalar N/D y errores de integración.', evidence: 'Reporte de GitHub Actions' },
    { at: '09:15', owner: 'Boltech', action: morningFocus, evidence: 'Fuente, decisor y problema confirmado por empresa' },
    { at: '10:00', owner: 'Ricardo', action: 'Revisar oferta piloto y los cinco mensajes preparados; decidir cuáles cuentas y canales se autorizan.', evidence: 'Decisión sobre cada cuenta' },
    { at: '11:00', owner: 'Ricardo + Boltech', action: 'Preparar el contacto individual solo para cuentas aprobadas; registrar envíos genuinos y no activar campañas pagadas.', evidence: 'ID o aceptación real del proveedor si se envía' },
    { at: '15:00', owner: 'Boltech', action: 'Clasificar respuestas verificadas, realizar diagnóstico exclusivamente por email y actualizar etapa con evidencia.', evidence: 'Respuesta y siguiente paso fechado' },
    { at: '17:30', owner: 'Boltech + Ricardo', action: 'Comparar etapas y cobros; escoger una variable para la siguiente iteración.', evidence: 'Antes, después, decisión y referencia de pago si existe' },
  ];
}
