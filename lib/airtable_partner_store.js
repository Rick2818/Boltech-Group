const DEFAULTS = Object.freeze({
  baseId: 'appCQZd0IhBHFoZ9P',
  partnersTableId: 'tblVpKkNAHmJqxME9',
  referralsTableId: 'tbl9d6B8ljjOuQ2ED',
  activitiesTableId: 'tblctlKwiFlhL0mct',
  leadsTableId: 'tblZaox2MX5uYA5PZ',
  commissionLedgerTableId: 'tbl1fMcSwr2zP6CXJ'
});

export class PartnerStoreConfigurationError extends Error {
  constructor(message) { super(message); this.name = 'PartnerStoreConfigurationError'; }
}

function config() {
  return {
    token: (process.env.AIRTABLE_TOKEN || process.env.AIRTABLE_PAT || '').trim(),
    baseId: (process.env.AIRTABLE_BASE_ID || DEFAULTS.baseId).trim(),
    partnersTableId: (process.env.AIRTABLE_PARTNERS_TABLE_ID || DEFAULTS.partnersTableId).trim(),
    referralsTableId: (process.env.AIRTABLE_REFERRALS_TABLE_ID || DEFAULTS.referralsTableId).trim(),
    activitiesTableId: (process.env.AIRTABLE_PARTNER_ACTIVITIES_TABLE_ID || DEFAULTS.activitiesTableId).trim(),
    leadsTableId: (process.env.AIRTABLE_LEADS_TABLE_ID || DEFAULTS.leadsTableId).trim(),
    commissionLedgerTableId: (process.env.AIRTABLE_COMMISSION_LEDGER_TABLE_ID || DEFAULTS.commissionLedgerTableId).trim()
  };
}

export function getPartnerStoreReadiness() {
  const cfg = config();
  return {
    configured: Boolean(cfg.token && cfg.baseId && cfg.partnersTableId && cfg.referralsTableId && cfg.activitiesTableId && cfg.commissionLedgerTableId),
    baseId: cfg.baseId,
    tables: { partners: cfg.partnersTableId, referrals: cfg.referralsTableId, activities: cfg.activitiesTableId, leads: cfg.leadsTableId, commissionLedger: cfg.commissionLedgerTableId }
  };
}

function requireConfig() {
  const cfg = config();
  if (!cfg.token) throw new PartnerStoreConfigurationError('AIRTABLE_TOKEN is required in the runtime environment.');
  return cfg;
}

async function airtableRequest(tableId, { method = 'GET', query = null, body = null } = {}) {
  const cfg = requireConfig();
  const url = new URL(`https://api.airtable.com/v0/${encodeURIComponent(cfg.baseId)}/${encodeURIComponent(tableId)}`);
  if (query) for (const [key, value] of Object.entries(query)) if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
  const response = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${cfg.token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await response.text();
  let payload = {};
  if (text) { try { payload = JSON.parse(text); } catch { payload = { raw: text.slice(0, 500) }; } }
  if (!response.ok) {
    const message = payload?.error?.message || payload?.error?.type || payload?.raw || `HTTP ${response.status}`;
    const err = new Error(`Airtable request failed: ${message}`); err.statusCode = response.status; throw err;
  }
  return payload;
}

async function listAll(tableId, maxRecords = 500) {
  const records = []; let offset = '';
  do {
    const page = await airtableRequest(tableId, { query: { pageSize: Math.min(100, maxRecords - records.length), offset } });
    records.push(...(page.records || [])); offset = page.offset || '';
  } while (offset && records.length < maxRecords);
  return records.slice(0, maxRecords);
}

function selectName(value) { return typeof value === 'string' ? value : value?.name || ''; }
function multiNames(value) { return Array.isArray(value) ? value.map(selectName).filter(Boolean) : []; }

export async function listPartners() {
  const cfg = requireConfig(); const records = await listAll(cfg.partnersTableId);
  return records.map(record => ({
    id: record.id,
    name: record.fields?.['Partner Name'] || '',
    companyUrl: record.fields?.['Company URL'] || '',
    contactEmail: record.fields?.['Contact Email'] || '',
    partnerType: selectName(record.fields?.['Partner Type']),
    status: selectName(record.fields?.Status),
    capabilities: multiNames(record.fields?.Capabilities),
    markets: multiNames(record.fields?.Markets),
    languages: multiNames(record.fields?.Languages),
    referralMode: selectName(record.fields?.['Referral Mode']),
    commissionRate: Number(record.fields?.['Commission Rate'] || 0),
    agentCardUrl: record.fields?.['Agent Card URL'] || '',
    programType: selectName(record.fields?.['Program Type']),
    costModel: selectName(record.fields?.['Cost Model']),
    applicationUrl: record.fields?.['Application URL'] || '',
    activationPriority: Number(record.fields?.['Activation Priority'] || 0),
    applicationStage: selectName(record.fields?.['Application Stage']),
    payoutPlatform: selectName(record.fields?.['Payout Platform']),
    payoutFeasibilitySv: selectName(record.fields?.['Payout Feasibility SV']),
    payoutNotes: record.fields?.['Payout Notes'] || '',
    a2aEnabled: Boolean(record.fields?.['A2A Enabled']),
    notes: record.fields?.Notes || '',
    lastContact: record.fields?.['Last Contact'] || '',
    createdTime: record.createdTime
  }));
}

export async function listReferrals() {
  const cfg = requireConfig(); const records = await listAll(cfg.referralsTableId);
  return records.map(record => ({
    id: record.id,
    referralId: record.fields?.['Referral ID'] || '',
    partnerRecordIds: record.fields?.Partner || [],
    leadRecordIds: record.fields?.Lead || [],
    direction: selectName(record.fields?.Direction),
    status: selectName(record.fields?.Status),
    serviceType: selectName(record.fields?.['Service Type']),
    needSummary: record.fields?.['Need Summary'] || '',
    budgetUsd: Number(record.fields?.['Budget USD'] || 0),
    clientConsent: Boolean(record.fields?.['Client Consent']),
    clientCompany: record.fields?.['Client Company'] || '',
    clientContact: record.fields?.['Client Contact'] || '',
    clientEmail: record.fields?.['Client Email'] || '',
    revenueUsd: Number(record.fields?.['Revenue USD'] || 0),
    commissionRate: Number(record.fields?.['Commission Rate'] || 0),
    commissionUsd: Number(record.fields?.['Commission USD'] || 0),
    source: selectName(record.fields?.['Deal Registration Source']),
    deliveryPartnerRecordIds: record.fields?.['Delivery Partner'] || [],
    requestMarket: record.fields?.['Request Market'] || '',
    requestLanguage: record.fields?.['Request Language'] || '',
    urgency: selectName(record.fields?.Urgency),
    a2aTaskId: record.fields?.['A2A Task ID'] || '',
    notes: record.fields?.Notes || '',
    createdTime: record.createdTime
  }));
}

export async function listCommissionLedger() {
  const cfg = requireConfig(); const records = await listAll(cfg.commissionLedgerTableId);
  return records.map(record => ({
    id: record.id,
    commissionEntryId: record.fields?.['Commission Entry ID'] || '',
    referralRecordIds: record.fields?.Referral || [],
    partnerRecordIds: record.fields?.Partner || [],
    customerPaymentReference: record.fields?.['Customer Payment Reference'] || '',
    cashCollectedUsd: Number(record.fields?.['Cash Collected USD'] || 0),
    commissionRate: Number(record.fields?.['Commission Rate'] || 0),
    commissionEarnedUsd: Number(record.fields?.['Commission Earned USD'] || 0),
    status: selectName(record.fields?.Status),
    collectedAt: record.fields?.['Collected At'] || '',
    payoutMethod: selectName(record.fields?.['Payout Method']),
    payoutReference: record.fields?.['Payout Reference'] || '',
    paidAt: record.fields?.['Paid At'] || '',
    notes: record.fields?.Notes || '',
    createdTime: record.createdTime
  }));
}

export async function createCommissionEntry(input = {}) {
  const cfg = requireConfig();
  const fields = {
    'Commission Entry ID': input.commissionEntryId,
    Referral: input.referralRecordId ? [input.referralRecordId] : undefined,
    Partner: input.partnerRecordId ? [input.partnerRecordId] : undefined,
    'Customer Payment Reference': input.customerPaymentReference,
    'Cash Collected USD': input.cashCollectedUsd,
    'Commission Rate': input.commissionRate,
    Status: input.status || 'PENDING_APPROVAL',
    'Collected At': input.collectedAt || new Date().toISOString(),
    Notes: input.notes || undefined
  };
  for (const key of Object.keys(fields)) if (fields[key] === undefined || fields[key] === '') delete fields[key];
  return await airtableRequest(cfg.commissionLedgerTableId, { method: 'POST', body: { fields, typecast: true } });
}

export async function findA2APartnerByKeyHash(keyHash) {
  const cfg = requireConfig();
  if (!keyHash) return null;
  const records = await listAll(cfg.partnersTableId);
  const record = records.find(item =>
    Boolean(item.fields?.['A2A Enabled']) &&
    selectName(item.fields?.Status) === 'ACTIVE' &&
    item.fields?.['A2A Key Hash'] === keyHash
  );
  if (!record) return null;
  return {
    id: record.id,
    name: record.fields?.['Partner Name'] || '',
    status: selectName(record.fields?.Status),
    capabilities: multiNames(record.fields?.Capabilities),
    markets: multiNames(record.fields?.Markets),
    languages: multiNames(record.fields?.Languages),
    referralMode: selectName(record.fields?.['Referral Mode'])
  };
}

export async function setPartnerA2AKey(recordId, keyHash, enabled = true) {
  const cfg = requireConfig();
  if (!recordId || !keyHash) throw new Error('recordId and keyHash are required.');
  return await airtableRequest(`${cfg.partnersTableId}/${recordId}`, {
    method: 'PATCH',
    body: { fields: { 'A2A Enabled': Boolean(enabled), 'A2A Key Hash': keyHash }, typecast: true }
  });
}

export async function createPartner(input = {}) {
  const cfg = requireConfig();
  const fields = {
    'Partner Name': input.name, 'Company URL': input.companyUrl || undefined, 'Contact Email': input.contactEmail || undefined,
    'Partner Type': input.partnerType || 'Referral Partner', Status: input.status || 'PROSPECT',
    Capabilities: input.capabilities || ['Custom Agents'], Markets: input.markets || ['Global'],
    Languages: input.languages || ['Spanish', 'English'], 'Referral Mode': input.referralMode || 'BIDIRECTIONAL',
    'Commission Rate': input.commissionRate, 'Agent Card URL': input.agentCardUrl || undefined,
    Notes: input.notes || undefined, 'Last Contact': input.lastContact || undefined
  };
  for (const key of Object.keys(fields)) if (fields[key] === undefined || fields[key] === '') delete fields[key];
  return await airtableRequest(cfg.partnersTableId, { method: 'POST', body: { fields, typecast: true } });
}

export async function createReferral(input = {}) {
  const cfg = requireConfig();
  const fields = {
    'Referral ID': input.referralId, Partner: [input.partnerRecordId], Direction: input.direction, Status: input.status,
    'Service Type': input.serviceType, 'Need Summary': input.needSummary, 'Budget USD': input.budgetUsd ?? undefined,
    'Client Consent': Boolean(input.clientConsent), 'Client Company': input.clientCompany || undefined,
    'Client Contact': input.clientContact || undefined, 'Client Email': input.clientEmail || undefined,
    'Commission Rate': input.commissionRate, 'Deal Registration Source': input.source,
    'Delivery Partner': input.deliveryPartnerRecordId ? [input.deliveryPartnerRecordId] : undefined,
    'Request Market': input.requestMarket || undefined,
    'Request Language': input.requestLanguage || undefined,
    Urgency: input.urgency || undefined,
    'A2A Task ID': input.a2aTaskId || undefined,
    Notes: input.notes || undefined
  };
  if (input.leadRecordId) fields.Lead = [input.leadRecordId];
  for (const key of Object.keys(fields)) if (fields[key] === undefined || fields[key] === '') delete fields[key];
  return await airtableRequest(cfg.referralsTableId, { method: 'POST', body: { fields, typecast: true } });
}

export async function updateReferral(recordId, update = {}) {
  const cfg = requireConfig(); if (!recordId) throw new Error('recordId is required.');
  const fields = {};
  if (update.status !== undefined) fields.Status = update.status;
  if (update.clientConsent !== undefined) fields['Client Consent'] = Boolean(update.clientConsent);
  if (update.clientCompany !== undefined) fields['Client Company'] = update.clientCompany;
  if (update.clientContact !== undefined) fields['Client Contact'] = update.clientContact;
  if (update.clientEmail !== undefined) fields['Client Email'] = update.clientEmail;
  if (update.revenueUsd !== undefined) fields['Revenue USD'] = update.revenueUsd;
  if (update.commissionRate !== undefined) fields['Commission Rate'] = update.commissionRate;
  if (update.commissionUsd !== undefined) fields['Commission USD'] = update.commissionUsd;
  if (update.notes !== undefined) fields.Notes = update.notes;
  return await airtableRequest(`${cfg.referralsTableId}/${recordId}`, { method: 'PATCH', body: { fields, typecast: true } });
}

export async function logPartnerActivity(input = {}) {
  const cfg = requireConfig();
  const fields = {
    'Activity ID': input.activityId,
    Partner: input.partnerRecordId ? [input.partnerRecordId] : undefined,
    Referral: input.referralRecordId ? [input.referralRecordId] : undefined,
    Channel: input.channel || 'Manual', 'Activity Type': input.activityType, Summary: input.summary,
    Outcome: input.outcome || 'PENDING', 'Created At': input.createdAt || new Date().toISOString()
  };
  for (const key of Object.keys(fields)) if (fields[key] === undefined || fields[key] === '') delete fields[key];
  return await airtableRequest(cfg.activitiesTableId, { method: 'POST', body: { fields, typecast: true } });
}

export async function getPartnerMetrics() {
  const [partners, referrals, commissionLedger] = await Promise.all([listPartners(), listReferrals(), listCommissionLedger()]);
  const activePartners = partners.filter(p => p.status === 'ACTIVE').length;
  const won = referrals.filter(r => r.status === 'WON');
  const open = referrals.filter(r => !['WON', 'LOST', 'REJECTED'].includes(r.status));
  const totalPipelineUsd = open.reduce((sum, r) => sum + (r.budgetUsd || 0), 0);
  const revenueUsd = won.reduce((sum, r) => sum + (r.revenueUsd || 0), 0);
  const approvedCommissionEntries = commissionLedger.filter(c => ['APPROVED', 'PAID'].includes(c.status));
  const pendingCommissionEntries = commissionLedger.filter(c => c.status === 'PENDING_APPROVAL');
  const paidCommissionEntries = commissionLedger.filter(c => c.status === 'PAID');
  const commissionsUsd = approvedCommissionEntries.reduce((sum, c) => sum + (c.commissionEarnedUsd || 0), 0);
  const commissionPendingUsd = pendingCommissionEntries.reduce((sum, c) => sum + (c.commissionEarnedUsd || 0), 0);
  const commissionPaidUsd = paidCommissionEntries.reduce((sum, c) => sum + (c.commissionEarnedUsd || 0), 0);
  return {
    partners: { total: partners.length, active: activePartners },
    referrals: { total: referrals.length, open: open.length, won: won.length, consentPending: referrals.filter(r => r.status === 'WAITING_CONSENT' || !r.clientConsent).length },
    finance: {
      pipelineUsd: Math.round(totalPipelineUsd * 100) / 100,
      revenueUsd: Math.round(revenueUsd * 100) / 100,
      commissionsUsd: Math.round(commissionsUsd * 100) / 100,
      commissionPendingUsd: Math.round(commissionPendingUsd * 100) / 100,
      commissionPaidUsd: Math.round(commissionPaidUsd * 100) / 100,
      netReferralRevenueUsd: Math.round((revenueUsd - commissionsUsd) * 100) / 100
    }
  };
}
