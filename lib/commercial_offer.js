import pilot from '../config/commercial_pilot.json' with { type: 'json' };

// Proposal guidance only: no order, accepted-quote mutation or charge.
export function pilotCommercialTerms({discountPercent = 0} = {}) {
  const policy = pilot.commercialPolicy;
  if (!Number.isFinite(discountPercent) || discountPercent < 0 || discountPercent > policy.maxDiscountPercent) {
    throw Object.assign(new Error('COMMERCIAL_DISCOUNT_NOT_AUTHORIZED'), {code:'COMMERCIAL_DISCOUNT_NOT_AUTHORIZED'});
  }
  const baseCents = Math.round(pilot.implementationAmount * 100);
  const totalCents = Math.round(baseCents * (100 - discountPercent) / 100);
  const upfrontCents = Math.round(totalCents * policy.upfrontPercent / 100);
  return {
    offerId:pilot.id, offerVersion:pilot.offerVersion, currency:pilot.currency,
    applicability:'Only the USD990 pilot; confirm scope and feasibility. Do not offer monthly or other product prices.',
    activePriceScope:policy.activePriceScope, otherOffersPricingEnabled:false,
    recurringAmount:null, recurringPricingStatus:'NOT_OFFERED',
    monthlyInstallmentsAllowed:false, monthlyPaymentRule:policy.monthlyPaymentRule,
    baseAmount:baseCents / 100, discountPercent, maxDiscountPercent:policy.maxDiscountPercent,
    totalAmount:totalCents / 100, upfrontAmount:upfrontCents / 100, completionAmount:(totalCents - upfrontCents) / 100,
    upfrontPercent:policy.upfrontPercent, completionPercent:policy.completionPercent,
    upfrontCondition:policy.upfrontCondition, completionCondition:policy.completionCondition,
    scope:{...pilot.scope}, outcomes:[...pilot.outcomes], acceptanceCriteria:[...pilot.acceptanceCriteria],
    exclusions:[...pilot.exclusions], deliveryDays:pilot.durationDays,
    deliveryStartsAfter:'Scope accepted, upfront payment confirmed and required access available',
    scopeChangesRequireNewQuote:true, existingAcceptedQuotesUnchanged:true, paymentEnabled:pilot.paymentEnabled,
    createsOrder:false, customerAcceptance:'UNCONFIRMED', paymentConfirmed:false
  };
}

// Shared factual context, not authorization to charge or accept a customer scope.
export function commercialOfferContext() {
  return `Marca: ${pilot.brandPromise}. Público: ${pilot.businessAudience}.
${pilot.positioningNote}
Piloto disponible: ${pilot.name}. Segmento inicial de prospección: ${pilot.targetSegment}.
Resultados: ${pilot.outcomes.join('; ')}.
Piloto USD ${pilot.implementationAmount}, ${pilot.durationDays} días desde aceptación y accesos disponibles; USD ${pilot.milestones[0].amount} iniciales y USD ${pilot.milestones[1].amount} contra entrega verificada.
Instrucción vigente: trabajar solo con el precio del piloto USD990; no ofrecer mensualidades ni precios de otros productos. Condiciones autorizadas por Ricardo el 19 octubre 2026: descuento de hasta ${pilot.commercialPolicy.maxDiscountPercent}% sobre el precio de implementación aprobado, sin acumular descuentos; 50% antes de comenzar y 50% al terminar con entrega verificada. Las mensualidades se pagan completas, sin dividirlas; 50/50 aplica solo a implementación. Calcular las cuotas sobre el total después del descuento. No modificar cotizaciones aceptadas. Iniciar el plazo después de aceptación, anticipo confirmado y accesos disponibles.
Alcance: una empresa, un flujo web y una integración sencilla. Herramientas, consumo y mantenimiento separados. Documentación y transferencia de uso incluidas.
Diagnóstico: ${pilot.diagnosticQuestions.join(' ')}
Los agentes preelaborados son una base reutilizable; los agentes a medida adaptan el proceso. No exigir auditoría gratuita ni presupuesto conocido para iniciar una conversación pertinente. Propuesta individual tras confirmar necesidad, alcance y viabilidad.
No afirmar ventas, ROI, entrega inmediata, CRM sincronizado, envío o pago sin evidencia. No activar cobros ni cambiar precios. Contacto: ricardo.boltechgroup@gmail.com.`;
}
