// Shared intake for existing RSI-01. Planning never sends or changes commercial stages.
const stopped = /unsubscribed|do not contact|bounced|disqualified|lost|paid verified/i;
const syntheticName = /\bcliente\s+sint[eé]tico\b|\bsynthetic\s+(?:client|customer|lead)\b/i;
export function planLeadIntake(leads, work, at) {
  if (!Array.isArray(leads) || !Array.isArray(work) || !Number.isFinite(Date.parse(at))) throw Error('INTAKE_INVALID_SNAPSHOT');
  const seen = new Set(), create = [], covered = [], excluded = [];
  for (const lead of leads) {
    if (!/^rec[a-zA-Z0-9]{14}$/.test(lead.id) || seen.has(lead.id)) throw Error('INTAKE_DUPLICATE_OR_INVALID_LEAD');
    seen.add(lead.id);
    const f = lead.fields || {};
    // Historical QA rows may be misclassified as research-only. Never let them
    // re-enter the commercial intake just because the Data Quality select drifted.
    if (f['Data Quality'] === 'QA' || syntheticName.test(String(f.Name || '')) || f.Unsubscribed || f['Do Not Contact'] || stopped.test([f.Status, f['Commercial Stage'], f['Data Quality']].join(' '))) { excluded.push(lead.id); continue; }
    const workId = `LEAD_INTAKE:${lead.id}`;
    const same = work.filter(w => w.fields?.['Work ID'] === workId);
    if (same.length > 1) throw Error('INTAKE_DUPLICATE_WORK_RECONCILE');
    const existing = same[0] || work.find(w => w.fields?.['Source Record ID'] === lead.id && ['RSI-01','RSI-02','RSI-03'].includes(w.fields?.RSI));
    if (existing) { covered.push({leadId:lead.id, workId:existing.id}); continue; }
    const moderation = f['Quotation Status'] === 'SUBMITTED_PENDING_MODERATION';
    let validSource = false;
    try { validSource = ['https:','http:'].includes(new URL(f['Source Evidence URL']).protocol); } catch {}
    const status = moderation ? 'WAITING_MODERATION' : validSource ? 'PENDING_RSI01_RESEARCH' : 'BLOCKED_SOURCE_MISSING';
    create.push({fields:{'Work ID':workId,RSI:'RSI-01',Owner:'RSI-01 — responsable diario de ventas',Status:status,
      'Source Record ID':lead.id,'Handoff To':'RSI-02','Updated At':at,
      Evidence:JSON.stringify({kind:'LEAD_INTAKE_V1',leadId:lead.id,name:f.Name||'',sourceUrl:f['Source Evidence URL']||null,cohort:f['Experiment Cohort']||null,quotationId:f['Quotation ID']||null,amountUsd:f['Quotation Amount USD']??null,emailVerified:false,receivedAt:at,sendingPerformed:false,customerInterestVerified:false}),
      Authorization:'Intake y seguimiento supervisado de la oportunidad dentro de autorización vigente. Verificar canal, identidad, historial y exclusiones antes de contacto. No gasto, precio nuevo, llamadas ni reenvío UNKNOWN. Un registro no autoriza campañas adicionales.',
      'Next Action':moderation ? 'RSI-01: verificar aprobación de la publicación existente y respuesta del comprador; no reenviar mientras esté pendiente. Registrar URL/recibo y próximo control.' : validSource ? 'RSI-01: revisar fuente e historial, comprobar vigencia de la solicitud y canal del comprador. Ejecutar contacto individual solo dentro de autorización vigente, persistir recibo o bloqueo y siguiente fecha. RSI-02 recibe únicamente respuesta humana verificada; RSI-03 cierra tras alcance aprobado.' : 'RSI-01: localizar y verificar fuente y canal del comprador; no enviar hasta resolver. Registrar resultado y fecha del próximo control.'}});
  }
  return {version:1,at,reviewed:leads.length,create,covered,excluded,sendingPerformed:false};
}
