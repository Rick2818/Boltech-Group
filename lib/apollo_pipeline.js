import { mkdir, readFile, open, rename, unlink } from 'node:fs/promises';
import { dirname } from 'node:path';
import crypto from 'node:crypto';
import { apolloError, normalizeApolloContact, normalizeApolloEmail } from './apollo_client.js';

export function parseApolloCsv(input) {
  if (typeof input !== 'string' || Buffer.byteLength(input) > 2097152) throw apolloError('APOLLO_INVALID_CSV');
  input = input.replace(/^\uFEFF/, '');
  const rows = []; let row = [], cell = '', quoted = false, closed = false;
  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    if (quoted) {
      if (c === '"' && input[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') { quoted = false; closed = true; }
      else cell += c;
    } else if (c === '"') {
      if (cell || closed) throw apolloError('APOLLO_INVALID_CSV');
      quoted = true;
    } else if (c === ',' || c === '\n' || c === '\r') {
      row.push(cell.trim()); cell = ''; closed = false;
      if (c !== ',') { if (row.some(Boolean)) rows.push(row); row = []; if (c === '\r' && input[i + 1] === '\n') i++; }
    } else {
      if (closed && !/\s/.test(c)) throw apolloError('APOLLO_INVALID_CSV');
      if (!closed) cell += c;
    }
    if (rows.length > 5001 || cell.length > 10000) throw apolloError('APOLLO_CSV_LIMIT');
  }
  if (quoted) throw apolloError('APOLLO_INVALID_CSV');
  row.push(cell.trim()); if (row.some(Boolean)) rows.push(row);
  const headers = rows.shift();
  if (!headers?.includes('Email') || new Set(headers).size !== headers.length) throw apolloError('APOLLO_CSV_HEADERS_REQUIRED');
  const contacts = [], seen = new Map(); let rejected = 0;
  for (const row of rows) {
    if (row.length !== headers.length) throw apolloError('APOLLO_INVALID_CSV');
    const data = Object.fromEntries(headers.map((h, i) => [h, row[i]]));
    let lead;
    try { lead = normalizeApolloContact({ email: data.Email, first_name: data['First Name'], last_name: data['Last Name'],
      title: data.Title, organization_name: data['Company Name'], domain: data.Website || data.Email?.split('@')[1],
      country: data.Country, email_status: data['Email Status'] }, { source: 'APOLLO_CSV_IMPORT' }); }
    catch (error) { if (['APOLLO_INVALID_EMAIL', 'APOLLO_INVALID_DOMAIN'].includes(error.code)) { rejected++; continue; } throw error; }
    const key = lead.contactEmail.toLowerCase(), previous = seen.get(key);
    if (previous && JSON.stringify(previous) !== JSON.stringify(lead)) throw apolloError('APOLLO_IDENTITY_CONFLICT');
    if (!previous) { contacts.push(lead); seen.set(key, lead); }
  }
  return { contacts, rejected, complete: true };
}
export function toCrmContact(lead) {
  const email = normalizeApolloEmail(lead.contactEmail);
  return { email, ...(lead.firstname ? { firstname: lead.firstname } : {}),
    ...(lead.lastname ? { lastname: lead.lastname } : {}), ...(lead.company ? { company: lead.company } : {}) };
}
export async function syncApolloContacts(contacts, queue) {
  if (!Array.isArray(contacts) || typeof queue !== 'function') throw apolloError('APOLLO_INVALID_SYNC');
  // Validate the whole batch before the first durable write.
  const unique = new Map();
  for (const lead of contacts) {
    const fields = toCrmContact(lead), key = fields.email.toLowerCase();
    const previous = unique.get(key);
    if (previous && JSON.stringify(previous) !== JSON.stringify(fields)) throw apolloError('APOLLO_IDENTITY_CONFLICT');
    unique.set(key, fields);
  }
  const results = [];
  for (const fields of unique.values()) {
    const result = await queue(fields);
    if (!/^[a-f0-9]{64}$/.test(result?.jobId || '') ||
        !['PENDING', 'RETRY_PENDING', 'SYNCED_PROVIDER_CONFIRMED', 'BLOCKED', 'SUPERSEDED'].includes(result.status)) throw apolloError('APOLLO_CRM_UNCONFIRMED');
    if (['BLOCKED', 'SUPERSEDED'].includes(result.status)) throw apolloError('APOLLO_CRM_BLOCKED');
    if (result.status === 'SYNCED_PROVIDER_CONFIRMED' && (result.synced !== true || !/^[1-9]\d*$/.test(result.contactId || ''))) throw apolloError('APOLLO_CRM_UNCONFIRMED');
    results.push({ jobId: result.jobId, status: result.status, providerConfirmed: result.synced === true, ...(result.synced === true ? { contactId: result.contactId } : {}) });
  }
  return { submitted: results.length, providerConfirmed: results.filter(r => r.providerConfirmed).length, results };
}
export function mergeApolloPipeline(active, incoming) {
  if (!Array.isArray(active) || !Array.isArray(incoming)) throw apolloError('APOLLO_INVALID_PIPELINE');
  const result = active.map(row => ({ ...row }));
  const index = new Map();
  for (let i = 0; i < result.length; i++) {
    const key = normalizeApolloEmail(result[i].contactEmail).toLowerCase();
    if (index.has(key)) throw apolloError('APOLLO_EXISTING_DUPLICATES');
    index.set(key, i);
  }
  let added = 0;
  for (const lead of incoming) {
    const email = normalizeApolloEmail(lead.contactEmail), key = email.toLowerCase();
    const fields = { company: lead.company, domain: lead.domain, contactName: lead.name, contactEmail: email, jobTitle: lead.title,
      source: lead.source, apolloContactId: lead.apolloContactId ?? null };
    if (index.has(key)) {
      const old = result[index.get(key)];
      // Preserve genuine delivery status and evidence already in the operational record.
      result[index.get(key)] = { ...old, ...Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined && value !== '' && value !== null)) };
    } else {
      index.set(key, result.length); added++;
      result.push({ id: lead.leadId || 'apollo:' + crypto.createHash('sha256').update(key).digest('hex'),
        ...fields, status: 'RESEARCHING', currentImpact: 0, deliveryAudit: null });
    }
  }
  return { records: result, added };
}
// Local legacy files only: serialize writers and atomically replace, never claim a provider write.
export async function updatePipelineFile(file, update) {
  await mkdir(dirname(file), { recursive: true });
  const lockFile = file + '.lock', temp = file + '.' + crypto.randomUUID() + '.tmp';
  let lock;
  try { lock = await open(lockFile, 'wx', 0o600); } catch { throw apolloError('APOLLO_PIPELINE_BUSY'); }
  try {
    let records = [];
    try { records = JSON.parse(await readFile(file, 'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw apolloError('APOLLO_INVALID_PIPELINE'); }
    const result = update(records);
    const output = await open(temp, 'wx', 0o600);
    try { await output.writeFile(JSON.stringify(result.records, null, 2) + '\n'); await output.sync(); } finally { await output.close(); }
    await rename(temp, file);
    return result;
  } finally { await unlink(temp).catch(() => {}); await lock.close(); await unlink(lockFile); }
}
