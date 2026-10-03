const BASE = 'appCQZd0IhBHFoZ9P';
const COSTS_TABLE = 'tblpPzMSjM1EVpF8Y';
export const COST_PROVIDERS = ['Vercel', 'AI APIs', 'Airtable', 'Apollo', 'Explee', 'Domains', 'Messaging', 'Payment fees', 'Partner commissions'];
const qaPattern = /(?:^|[^a-z])(qa|test|sandbox|synthetic)(?:[^a-z]|$)/i;

export function summarizeA2A(partners, referrals) {
  const excluded = new Set(partners.filter(p => qaPattern.test(p.name || '')).map(p => p.id));
  const realPartners = partners.filter(p => !excluded.has(p.id));
  const rows = referrals.filter(r => !qaPattern.test(r.notes || '') &&
    !qaPattern.test(r.referralId || '') && !(r.partnerRecordIds || []).some(id => excluded.has(id)));
  const stageCounts = {};
  for (const r of rows) stageCounts[r.status] = (stageCounts[r.status] || 0) + 1;
  return { candidates: realPartners.filter(p => p.status === 'PROSPECT').length,
    activePartners: realPartners.filter(p => p.status === 'ACTIVE').length,
    enabledPartners: realPartners.filter(p => p.status === 'ACTIVE' && p.a2aEnabled).length,
    referrals: rows.length, stageCounts, excludedQaReferrals: referrals.length - rows.length,
    attributedCashUsd: null,
    note: 'Real CRM referrals only. Provider payments are not attributed to partners without an explicit verified order link.' };
}

export function summarizeCosts(records, period) {
  const rows = records.filter(r => r.fields?.Period === period);
  const grouped = new Map();
  for (const row of rows) {
    const provider = row.fields.Provider;
    if (!grouped.has(provider)) grouped.set(provider, []);
    grouped.get(provider).push(row.fields);
  }
  let verifiedSubtotalUsd = 0;
  const missingProviders = [], duplicateProviders = [];
  for (const provider of new Set([...COST_PROVIDERS, ...grouped.keys()])) {
    const entries = grouped.get(provider) || [];
    if (entries.length !== 1) {
      if (entries.length > 1) duplicateProviders.push(provider);
      missingProviders.push(provider);
      continue;
    }
    const f = entries[0];
    const evidence = typeof f.Evidence === 'string' && f.Evidence.trim();
    const date = typeof f['Verified At'] === 'string' && Number.isFinite(Date.parse(f['Verified At']));
    if (f.Status === 'Not applicable' && evidence && date) continue;
    if (f.Status !== 'Verified' || !evidence || !date ||
      typeof f['Amount USD'] !== 'number' || !Number.isFinite(f['Amount USD']) || f['Amount USD'] < 0) {
      missingProviders.push(provider); continue;
    }
    verifiedSubtotalUsd += f['Amount USD'];
  }
  verifiedSubtotalUsd = Math.round(verifiedSubtotalUsd * 100) / 100;
  return { period, verifiedSubtotalUsd, totalCostUsd: missingProviders.length ? null : verifiedSubtotalUsd,
    missingProviders, duplicateProviders, complete: missingProviders.length === 0,
    note: 'Monthly provider totals entered with evidence; not live provider billing or profit. Missing evidence/amount is N/D.' };
}

export async function getOperatingCostMetrics(now = new Date()) {
  const token = String(process.env.AIRTABLE_TOKEN || process.env.AIRTABLE_PAT || '').trim();
  if (!token) throw new Error('Cost store unavailable');
  const period = new Intl.DateTimeFormat('sv-SE', {timeZone: 'America/El_Salvador', year:'numeric', month:'2-digit'}).format(now);
  const records = []; let offset;
  do {
    const url = new URL('https://api.airtable.com/v0/' + encodeURIComponent(process.env.AIRTABLE_BASE_ID || BASE) + '/' +
      encodeURIComponent(process.env.AIRTABLE_OPERATING_COSTS_TABLE_ID || COSTS_TABLE));
    url.searchParams.set('pageSize', '100');
    url.searchParams.set('filterByFormula', '{Period}="' + period + '"');
    if (offset) url.searchParams.set('offset', offset);
    const response = await fetch(url, {headers: {Authorization: 'Bearer ' + token}, signal: AbortSignal.timeout(15000)});
    if (!response.ok) throw new Error('Cost store HTTP ' + response.status);
    const page = await response.json();
    if (!Array.isArray(page.records)) throw new Error('Invalid cost store response');
    records.push(...page.records); offset = page.offset;
  } while (offset);
  return summarizeCosts(records, period);
}

export function decideStrategyActions({cohorts = {}, a2a = null, costs = null} = {}) {
  return [
    {rsi: 'RSI-01', action: 'Mantener Apollo; revisar historial y validar decisor antes de contacto.', observedAccounts: cohorts['RSI-01']?.total ?? null},
    {rsi: 'RSI-02', action: cohorts['RSI-02']?.total > 0 ? 'Ofrecer auditoría a cuentas elegibles; medir aceptación y siguiente paso.' : 'Preparar cohorte de auditoría gratuita sin duplicar cuentas Apollo.', observedAccounts: cohorts['RSI-02']?.total ?? null},
    {rsi: 'RSI-03 A2A', action: !a2a ? 'Restablecer lectura de socios/referrals.' : a2a.enabledPartners === 0 ? 'Seleccionar socios complementarios y acordar colaboración; no hay socios A2A habilitados.' : 'Revisar referidos genuinos y consentimiento; preparar piloto conjunto.', observedReferrals: a2a?.referrals ?? null},
    {rsi: 'RSI-03 costos', action: costs?.complete ? 'Comparar costos comprobados con cobros del mismo período antes de ampliar gasto.' : 'Completar evidencia de costos; margen N/D hasta verificar todas las partidas.', totalCostUsd: costs?.totalCostUsd ?? null}
  ];
}


export const AUDIT_CAMPAIGN = Object.freeze({id: '6ac078f9ce5b500010a45968', name: 'Boltech | Free Response Audit | RSI-02 | Oct 2026 | EN'});

// A read-only coordinator. Contracts describe handoffs; no contact is moved or messaged here.
export function buildRsiArchitecture({metrics = null, campaign = null, auditCampaign = null} = {}) {
  const cash = metrics?.verifiedSales?.cashCollectedUsd;
  const costs = metrics?.operatingCosts;
  return {
    version: 1,
    mode: 'OBSERVE_DECIDE_REPORT',
    goal: Number.isFinite(cash) && cash > 0 ? 'REPEAT_PROFITABLE_COLLECTION' : 'FIRST_VERIFIED_COLLECTION',
    observation: { cashCollectedUsd: Number.isFinite(cash) ? cash : null },
    controllers: [
      {id: 'RSI-01', role: 'Apollo acquisition',
        state: campaign?.status === 'verified' ? 'MEASURED' : 'WAITING_DATA',
        inputs: ['Apollo sequence history', 'CRM identity and stage'], outputs: ['Qualified opportunity or audit invitation candidate'],
        campaignId: campaign?.id ?? null},
      {id: 'RSI-02', role: 'Free audit to paid pilot',
        state: auditCampaign?.status !== 'verified' ? 'WAITING_DATA' : auditCampaign.active === true ? 'MEASURED' : 'DRAFT_REVIEW',
        inputs: ['Eligible account', 'Authorized audit scope'], outputs: ['Evidence report', 'Scoped paid pilot proposal'],
        campaignId: auditCampaign?.id ?? null},
      {id: 'RSI-03', role: 'A2A acquisition and economics',
        state: !metrics?.a2a ? 'WAITING_DATA' : !costs?.complete ? 'WAITING_COST_EVIDENCE' : 'MEASURED',
        inputs: ['Partner agreement', 'Genuine referral', 'Cost evidence', 'Provider payment'], outputs: ['Contribution review', 'Next iteration'],
        enabledPartners: metrics?.a2a?.enabledPartners ?? null}
    ],
    handoffs: [
      {from:'RSI-01', to:'RSI-02', trigger:'Audit offer chosen for an eligible account',
        gate:'Check Apollo and CRM history; one active offer per account; record owner and next action; no automatic reenrollment'},
      {from:'RSI-03', to:'RSI-02', trigger:'Genuine partner referral needs diagnosis',
        gate:'Partner agreement, consent and attribution; exclude QA; share only authorized data'},
      {from:'RSI-02', to:'RSI-03', trigger:'Paid pilot scope prepared',
        gate:'Agreed price and terms; cost estimate; provider-confirmed payment before recording cash'},
      {from:'RSI-03', to:'RSI-01', trigger:'Measured delivery and commercial outcome',
        gate:'Use comparable cohorts; change one variable; scale only with verified economics'}
    ],
    cycle:['OBSERVE','DECIDE','AUTHORIZED_ACTION','MEASURE','KEEP_OR_ADJUST'],
    sharedState:'Private Airtable CRM; provider-confirmed Payment Orders; monthly Operating Costs',
    approvalBoundary:'New spending, contract/pricing commitments and outbound activation require the relevant existing authorization',
    dotProvisioning:'NOT_CONFIGURED: no DOTS management tool or account eligibility verified in this session'
  };
}
