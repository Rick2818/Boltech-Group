import { request as httpsRequest } from 'node:https';
import { domainToASCII } from 'node:url';
import { isIP } from 'node:net';
import { resolveMx } from 'node:dns/promises';
import crypto from 'node:crypto';

export function apolloError(code, retryable = false, retryAfterMs = 0) {
  return Object.assign(new Error(code), { code, retryable, retryAfterMs });
}
const fail = (...args) => { throw apolloError(...args); };
const paths = new Set(['contacts/search', 'organizations/enrich', 'emailer_campaigns/search', 'mixed_people/api_search']);
export function normalizeApolloDomain(input) {
  if (typeof input !== 'string' || input.length > 500 || /[\s\x00-\x1f\x7f]/.test(input.trim())) fail('APOLLO_INVALID_DOMAIN');
  let url;
  try { url = new URL(input.includes('://') ? input.trim() : `https://${input.trim()}`); } catch { fail('APOLLO_INVALID_DOMAIN'); }
  const domain = domainToASCII(url.hostname).toLowerCase().replace(/^www\./, '');
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.port || isIP(domain) ||
      domain.length > 253 || !/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(domain)) fail('APOLLO_INVALID_DOMAIN');
  return domain;
}
export function normalizeApolloEmail(input) {
  if (typeof input !== 'string') fail('APOLLO_INVALID_EMAIL');
  const email = input.trim();
  if (email.length > 254 || /[\s\x00-\x1f\x7f]/.test(email) || !/^[^@]+@[^@]+$/.test(email)) fail('APOLLO_INVALID_EMAIL');
  const [local, domain] = email.split('@');
  if (/[\/:#?@\\]/.test(domain)) fail('APOLLO_INVALID_EMAIL');
  if (local.length > 64 || !/^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+$/.test(local) || local.startsWith('.') || local.endsWith('.') || local.includes('..')) fail('APOLLO_INVALID_EMAIL');
  return `${local}@${normalizeApolloDomain(domain)}`;
}
const clean = value => typeof value === 'string' && value.length <= 500 && !/[\x00-\x1f\x7f]/.test(value) ? value.trim() : '';
export function normalizeApolloContact(row, { source = 'APOLLO_SAVED_CONTACT' } = {}) {
  if (!row || typeof row !== 'object' || Array.isArray(row)) fail('APOLLO_INVALID_CONTACT');
  if (source === 'APOLLO_SAVED_CONTACT' && !/^[a-f0-9]{24}$/.test(row.id || '')) fail('APOLLO_INVALID_CONTACT');
  const email = normalizeApolloEmail(row.email);
  const domain = normalizeApolloDomain(row.organization?.primary_domain || row.account?.primary_domain || row.domain || email.split('@')[1]);
  const firstname = clean(row.first_name), lastname = clean(row.last_name);
  return { leadId: 'apollo:' + crypto.createHash('sha256').update(email.toLowerCase()).digest('hex'),
    apolloContactId: source === 'APOLLO_SAVED_CONTACT' ? row.id : null,
    contactEmail: email, domain, firstname, lastname,
    name: clean(row.name) || [firstname, lastname].filter(Boolean).join(' '),
    title: clean(row.title), company: clean(row.organization_name || row.organization?.name || row.account?.name),
    country: clean(row.country), linkedinUrl: clean(row.linkedin_url),
    source, providerEmailStatus: clean(row.email_status) || 'unknown',
    verified: false, emailValidation: { syntax: true, mailboxConfirmed: false, zeroBounceGuaranteed: false } };
}

// Fixed destination, verified TLS, no redirects, bounded complete body. No secrets in errors.
export async function apolloHttpFetch(url, options) {
  const destination = new URL(url);
  if (destination.protocol !== 'https:' || destination.hostname !== 'api.apollo.io' || destination.port ||
      destination.username || destination.password || !paths.has(destination.pathname.replace(/^\/api\/v1\//, '')) ||
      !destination.pathname.startsWith('/api/v1/') || !['GET', 'POST'].includes(options.method)) fail('APOLLO_INVALID_DESTINATION');
  return new Promise((resolve, reject) => {
    const req = httpsRequest(destination, { method: options.method, signal: options.signal,
      headers: { ...options.headers, 'Accept-Encoding': 'identity' } }, res => {
      const chunks = []; let size = 0;
      res.on('data', chunk => { size += chunk.length; if (size > 1048576) res.destroy(apolloError('APOLLO_RESPONSE_TOO_LARGE')); else chunks.push(chunk); });
      res.on('error', reject);
      res.on('aborted', () => reject(apolloError('APOLLO_INCOMPLETE_RESPONSE')));
      res.on('end', () => {
        if (!res.complete) return reject(apolloError('APOLLO_INCOMPLETE_RESPONSE'));
        try { resolve(new Response(Buffer.concat(chunks), { status: res.statusCode, headers: res.headers })); } catch { reject(apolloError('APOLLO_INVALID_RESPONSE')); }
      });
    });
    req.on('error', reject);
    req.end(options.body);
  });
}
async function bounded(work, ms, code) {
  let timer;
  try { return await Promise.race([Promise.resolve().then(work), new Promise((_, reject) => { timer = setTimeout(() => reject(apolloError(code, true)), ms); })]); }
  finally { clearTimeout(timer); }
}
export async function validateApolloEmail(email, { mxLookup = resolveMx, timeoutMs = 3000 } = {}) {
  const normalized = normalizeApolloEmail(email);
  let mx;
  try { mx = await bounded(() => mxLookup(normalized.split('@')[1]), timeoutMs, 'APOLLO_DNS_TIMEOUT'); }
  catch (error) { if (['ENODATA', 'ENOTFOUND'].includes(error.code)) return { syntax: true, mx: false, mailboxConfirmed: false, zeroBounceGuaranteed: false }; fail('APOLLO_EMAIL_VALIDATION_UNAVAILABLE', true); }
  if (!Array.isArray(mx)) fail('APOLLO_EMAIL_VALIDATION_UNAVAILABLE', true);
  return { syntax: true, mx: mx.some(record => typeof record.exchange === 'string' && record.exchange && record.exchange !== '.'), mailboxConfirmed: false, zeroBounceGuaranteed: false };
}
export const getApolloApiKey = () => String(process.env.APOLLO_API_KEY || process.env.BoltechVercelCRM || '').trim();
export function createApolloClient({ apiKey = getApolloApiKey(), fetcher = apolloHttpFetch,
  sleep = ms => new Promise(resolve => setTimeout(resolve, ms)), now = Date.now, timeoutMs = 8000 } = {}) {
  async function request(endpoint, { method = 'POST', body, query, creditConsuming = false, deadline = Infinity } = {}) {
    if (!String(apiKey || '').trim()) fail('APOLLO_NOT_CONFIGURED');
    if (!paths.has(endpoint)) fail('APOLLO_INVALID_ENDPOINT');
    const url = new URL('https://api.apollo.io/api/v1/' + endpoint);
    for (const [key, value] of Object.entries(query || {})) url.searchParams.set(key, value);
    for (let attempt = 0; attempt < 3; attempt++) {
      if (now() >= deadline) fail('APOLLO_OPERATION_TIMEOUT', true);
      const remaining = Math.min(timeoutMs, deadline - now());
      let response, data;
      try {
        ({ response, data } = await bounded(async () => {
          const response = await fetcher(url.href, { method, redirect: 'error',
            headers: { 'X-Api-Key': String(apiKey).trim(), Accept: 'application/json', 'Content-Type': 'application/json' },
            ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(Math.max(1, Math.ceil(remaining))) });
          // Parse only successful responses; provider error text never reaches logs.
          return { response, data: response.ok ? await response.json() : null };
        }, remaining, 'APOLLO_TIMEOUT'));
      } catch (error) {
        if (!creditConsuming && attempt < 2) { await sleep(250 * 2 ** attempt); continue; }
        fail(error.code === 'APOLLO_TIMEOUT' ? 'APOLLO_TIMEOUT' : 'APOLLO_NETWORK_ERROR', !creditConsuming);
      }
      if (response.ok) {
        if (!data || typeof data !== 'object' || Array.isArray(data) || data.error || data.error_code) fail('APOLLO_INVALID_RESPONSE');
        return data;
      }
      if (response.status === 401) fail('APOLLO_AUTH_REQUIRED');
      if (response.status === 403) fail('APOLLO_ACCESS_DENIED');
      if (response.status === 402) fail('APOLLO_CREDIT_LIMIT');
      if (response.status === 429 || response.status >= 500) {
        const header = response.headers?.get('retry-after');
        const seconds = header && /^\d+(?:\.\d+)?$/.test(header.trim()) ? Number(header) : NaN;
        const delay = header ? Number.isFinite(seconds) ? seconds * 1000 : Date.parse(header) - now() : NaN;
        const retryAfterMs = Number.isFinite(delay) ? Math.max(0, delay) : response.status === 429 ? 60000 : 250 * 2 ** attempt;
        if (!creditConsuming && attempt < 2 && retryAfterMs <= 2000) { await sleep(retryAfterMs); continue; }
        fail(response.status === 429 ? 'APOLLO_RATE_LIMIT' : 'APOLLO_UNAVAILABLE', true, retryAfterMs);
      }
      fail(response.status === 404 ? 'APOLLO_RESOURCE_NOT_FOUND' : 'APOLLO_INVALID_REQUEST');
    }
  }
  async function listSavedContacts({ perPage = 25, maxPages = 20, qKeywords, labelIds, budgetMs = 25000 } = {}) {
    if (!Number.isInteger(perPage) || perPage < 1 || perPage > 100 || !Number.isInteger(maxPages) || maxPages < 1 || maxPages > 500) fail('APOLLO_INVALID_PAGINATION');
    if (qKeywords !== undefined && (!clean(qKeywords) || typeof qKeywords !== 'string')) fail('APOLLO_INVALID_FILTER');
    if (labelIds !== undefined && (!Array.isArray(labelIds) || labelIds.some(id => !/^[a-f0-9]{24}$/.test(id)))) fail('APOLLO_INVALID_FILTER');
    if (!Number.isInteger(budgetMs) || budgetMs < 1 || budgetMs > 120000) fail('APOLLO_INVALID_PAGINATION');
    const deadline = now() + budgetMs;
    const contacts = [], ids = new Set(), emails = new Map(), signatures = new Set();
    let rejected = 0, rawCount = 0, totalEntries = null;
    for (let page = 1; page <= maxPages; page++) {
      const data = await request('contacts/search', { deadline, body: { page, per_page: perPage, sort_by_field: 'contact_created_at', sort_ascending: true,
        ...(qKeywords ? { q_keywords: qKeywords } : {}), ...(labelIds ? { contact_label_ids: labelIds } : {}) } });
      if (!Array.isArray(data.contacts) || data.contacts.length > perPage || data.partial_results_only === true) fail('APOLLO_INCOMPLETE_RESULTS');
      rawCount += data.contacts.length;
      const meta = data.pagination;
      if (meta && (meta.page !== page || !Number.isInteger(meta.total_pages) || meta.total_pages < 0 ||
          !Number.isInteger(meta.total_entries) || meta.total_entries < 0 || meta.per_page !== perPage)) fail('APOLLO_INVALID_PAGINATION_RESPONSE');
      if (meta && totalEntries !== null && meta.total_entries !== totalEntries) fail('APOLLO_RESULTS_CHANGED', true);
      totalEntries = meta?.total_entries ?? totalEntries;
      const signature = JSON.stringify(data.contacts.map(c => c?.id));
      if (data.contacts.length && signatures.has(signature)) fail('APOLLO_REPEATED_PAGE');
      signatures.add(signature);
      for (const row of data.contacts) {
        let contact;
        try { contact = normalizeApolloContact(row); } catch (error) { if (['APOLLO_INVALID_EMAIL', 'APOLLO_INVALID_DOMAIN'].includes(error.code)) { rejected++; continue; } throw error; }
        const previous = emails.get(contact.contactEmail.toLowerCase());
        if (previous && JSON.stringify({ firstname: previous.firstname, lastname: previous.lastname, company: previous.company, domain: previous.domain }) !==
            JSON.stringify({ firstname: contact.firstname, lastname: contact.lastname, company: contact.company, domain: contact.domain })) fail('APOLLO_IDENTITY_CONFLICT');
        if (ids.has(contact.apolloContactId) && !previous) fail('APOLLO_IDENTITY_CONFLICT');
        ids.add(contact.apolloContactId);
        if (!previous) { emails.set(contact.contactEmail.toLowerCase(), contact); contacts.push(contact); }
      }
      if ((meta && page >= meta.total_pages) || (!meta && data.contacts.length < perPage)) {
        if (meta && rawCount !== meta.total_entries) fail('APOLLO_INCOMPLETE_RESULTS');
        return { contacts, complete: true, pagesRead: page, totalEntries, rejected, observedAt: new Date(now()).toISOString() };
      }
      if (!data.contacts.length) fail('APOLLO_INCOMPLETE_RESULTS');
    }
    fail('APOLLO_PAGINATION_LIMIT');
  }
  async function enrichOrganization(domain, { allowCreditConsumption = false } = {}) {
    if (allowCreditConsumption !== true) fail('APOLLO_ENRICHMENT_NOT_AUTHORIZED');
    const normalized = normalizeApolloDomain(domain);
    const data = await request('organizations/enrich', { method: 'GET', query: { domain: normalized }, creditConsuming: true });
    const org = data.organization;
    if (!org || !/^[a-f0-9]{24}$/.test(org.id || '')) fail('APOLLO_ENRICHMENT_UNCONFIRMED');
    if (normalizeApolloDomain(org.primary_domain || org.website_url || '') !== normalized) fail('APOLLO_IDENTITY_MISMATCH');
    return { name: clean(org.name), domain: normalized, phone: clean(org.phone || org.primary_phone?.number), industry: clean(org.industry),
      estimatedNumEmployees: Number.isFinite(org.estimated_num_employees) ? org.estimated_num_employees : null,
      linkedinUrl: clean(org.linkedin_url), country: clean(org.country), city: clean(org.city),
      technologies: Array.isArray(org.current_technologies) ? org.current_technologies.map(t => clean(typeof t === 'string' ? t : t?.name)).filter(Boolean).slice(0, 10) : [], rawApolloId: org.id };
  }
  async function searchPeople({ page = 1, perPage = 25, titles = [], locations = [], technologyUids = [] } = {}) {
    if (!Number.isInteger(page) || page < 1 || page > 500 || !Number.isInteger(perPage) || perPage < 1 || perPage > 100)
      fail('APOLLO_INVALID_PAGINATION');
    for (const list of [titles, locations, technologyUids])
      if (!Array.isArray(list) || list.length > 20 || list.some(value => !clean(value))) fail('APOLLO_INVALID_FILTER');
    if (technologyUids.some(value => !/^[a-z0-9_]+$/.test(value))) fail('APOLLO_INVALID_FILTER');
    const data = await request('mixed_people/api_search', { body: { page, per_page: perPage,
      person_titles: titles, person_locations: locations, currently_using_any_of_technology_uids: technologyUids } });
    if (!Array.isArray(data.people) || data.people.length > perPage || !Number.isInteger(data.total_entries) || data.total_entries < 0)
      fail('APOLLO_INVALID_RESPONSE');
    const people = data.people.map(person => {
      if (!/^[a-f0-9]{24}$/.test(person?.id || '')) fail('APOLLO_INVALID_RESPONSE');
      return { apolloPersonId: person.id, firstname: clean(person.first_name),
        lastNameObfuscated: clean(person.last_name_obfuscated), title: clean(person.title),
        company: clean(person.organization?.name), source: 'APOLLO_PEOPLE_SEARCH', contactable: false };
    });
    return { people, page, perPage, totalEntries: data.total_entries,
      complete: page * perPage >= data.total_entries, researchOnly: true };
  }
  return { request, listSavedContacts, enrichOrganization, searchPeople };
}
