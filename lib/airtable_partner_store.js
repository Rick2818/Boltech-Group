const DEFAULTS = Object.freeze({
  baseId: 'appCQZd0IhBHFoZ9P',
  partnersTableId: 'tblVpKkNAHmJqxME9',
  referralsTableId: 'tbl9d6B8ljjOuQ2ED',
  activitiesTableId: 'tblctlKwiFlhL0mct',
  leadsTableId: 'tblZaox2MX5uYA5PZ'
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
    leadsTableId: (process.env.AIRTABLE_LEADS_TABLE_ID || DEFAULTS.leadsTableId).trim()
  };
}

export function getPartnerStoreReadiness() {
  const cfg = config();
  return {
    configured: Boolean(cfg.token && cfg.baseId && cfg.partnersTableId && cfg.referralsTableId && cfg.activitiesTableId),
    baseId: cfg.baseId,
    tables: { partners: cfg.partnersTableId, referrals: cfg.referralsTableId, activities: cfg.activitiesTableId, leads: cfg.leadsTableId }
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
    notes: record.fields?.Notes || '',
    createdTime: record.createdTime
  }));
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
    'Commission Rate': input.commissionRate, 'Deal Registration Source': input.source, Notes: input.notes || undefined
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
  const [partners, referrals] = await Promise.all([listPartners(), listReferrals()]);
  const activePartners = partners.filter(p => p.status === 'ACTIVE').length;
  const won = referrals.filter(r => r.status === 'WON');
  const open = referrals.filter(r => !['WON', 'LOST', 'REJECTED'].includes(r.status));
  const totalPipelineUsd = open.reduce((sum, r) => sum + (r.budgetUsd || 0), 0);
  const revenueUsd = won.reduce((sum, r) => sum + (r.revenueUsd || 0), 0);
  const commissionsUsd = won.reduce((sum, r) => sum + (r.commissionUsd || 0), 0);
  return {
    partners: { total: partners.length, active: activePartners },
    referrals: { total: referrals.length, open: open.length, won: won.length, consentPending: referrals.filter(r => r.status === 'WAITING_CONSENT' || !r.clientConsent).length },
    finance: {
      pipelineUsd: Math.round(totalPipelineUsd * 100) / 100,
      revenueUsd: Math.round(revenueUsd * 100) / 100,
      commissionsUsd: Math.round(commissionsUsd * 100) / 100,
      netReferralRevenueUsd: Math.round((revenueUsd - commissionsUsd) * 100) / 100
    }
  };
}
