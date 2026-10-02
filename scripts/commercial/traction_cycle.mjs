export const CAMPAIGN_ID = '6abea3c24b681c000c082c9f';
const count = value => Number.isInteger(value) && value >= 0 ? value : null;

export function normalizeCampaign(data, id = CAMPAIGN_ID) {
  const c = data?.emailer_campaigns?.find(item => item.id === id);
  if (!c) return { status: 'unavailable', note: 'Campaña no encontrada; no equivale a cero respuestas.' };
  const delivered = count(c.unique_delivered);
  const replied = count(c.unique_replied);
  const tracked = count(c.unique_delivered_open_tracked);
  return {
    status: 'verified', id: c.id, name: c.name,
    delivered, replied, bounced: count(c.unique_bounced),
    opens: tracked > 0 ? count(c.unique_opened) : null,
    openTracking: tracked > 0 ? 'measured' : 'unavailable',
    replyRate: delivered > 0 && replied !== null ? replied / delivered : null,
  };
}

export function decideTraction(campaign, now = new Date()) {
  if (campaign?.status !== 'verified') return {
    action: 'RESTORE_MEASUREMENT', next: 'Restablecer acceso a métricas de campaña; no ampliar envíos a ciegas.'
  };
  if (campaign.replied > 0) return {
    action: 'QUALIFY_REPLIES', next: 'Clasificar respuestas reales por email: necesidad, alcance, presupuesto, urgencia y decisor. Detener seguimiento a quien respondió.'
  };
  if (campaign.bounced > 0) return {
    action: 'REVIEW_DELIVERY', next: 'Revisar direcciones rebotadas antes del próximo envío; no reenviarlas sin corrección.'
  };
  if (campaign.replied === null || campaign.delivered === null) return {
    action: 'RESTORE_MEASUREMENT', next: 'Métricas incompletas: verificar respuestas y entregas antes de decidir.'
  };
  // El primer contacto de esta cohorte fue el 1 de octubre. Su siguiente paso vence el 4.
  const due = Date.parse('2026-10-04T15:00:00Z');
  return {
    action: now.getTime() < due ? 'WAIT_FOR_SCHEDULED_FOLLOWUP' : 'REVIEW_FOLLOWUP',
    next: now.getTime() < due
      ? 'Mantener el seguimiento ya programado; no duplicar correos. Preparar diagnóstico y propuesta por email.'
      : 'Comprobar ejecución del seguimiento existente. Sin respuesta al completar la secuencia, probar una sola variable en la siguiente cohorte.',
    experiment: { variable: 'CTA', hypothesis: 'Pedir un único caso concreto facilitará una respuesta útil.',
      success: 'Respuesta humana con problema y próximo paso; éxito final solo con pago verificado.',
      limitation: 'No atribuir diferencias entre socios y clientes al CTA: son audiencias distintas.' }
  };
}
