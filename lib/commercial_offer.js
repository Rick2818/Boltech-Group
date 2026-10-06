import pilot from '../config/commercial_pilot.json' with { type: 'json' };

// Shared factual context, not authorization to charge or accept a customer scope.
export function commercialOfferContext() {
  return `Oferta principal: ${pilot.name}. Segmento inicial: ${pilot.targetSegment}.
Resultados: ${pilot.outcomes.join('; ')}.
Piloto USD ${pilot.implementationAmount}, ${pilot.durationDays} días desde aceptación y accesos disponibles; USD ${pilot.milestones[0].amount} iniciales y USD ${pilot.milestones[1].amount} contra entrega verificada.
Alcance: una empresa, un flujo web y una integración sencilla. Herramientas, consumo y mantenimiento separados. Documentación y transferencia de uso incluidas.
Diagnóstico: ${pilot.diagnosticQuestions.join(' ')}
Los agentes preelaborados son una base reutilizable; los agentes a medida adaptan el proceso. No exigir auditoría gratuita ni presupuesto conocido para iniciar una conversación pertinente. Propuesta individual tras confirmar necesidad, alcance y viabilidad.
No afirmar ventas, ROI, entrega inmediata, CRM sincronizado, envío o pago sin evidencia. No activar cobros ni cambiar precios. Contacto: ricardo.boltechgroup@gmail.com.`;
}
