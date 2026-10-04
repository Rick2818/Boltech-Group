import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApolloClient, normalizeApolloContact, normalizeApolloDomain, normalizeApolloEmail, validateApolloEmail, apolloHttpFetch } from '../lib/apollo_client.js';
import { parseApolloCsv, syncApolloContacts, mergeApolloPipeline, updatePipelineFile } from '../lib/apollo_pipeline.js';
import { createApolloCrmQueue } from '../lib/apollo_crm_transport.js';
import { createApolloHandler } from '../lib/apollo_api.js';
import { createMcpHandler } from '../scripts/mcp/apollo_explee_mcp_server.mjs';

const id = n => String(n).padStart(24, 'a');
const row = (n, email = 'owner' + n + '@example.com') => ({ id: id(n), email, first_name: 'Owner', last_name: String(n), organization_name: 'Example', organization: { primary_domain: 'example.com' }, email_status: 'verified' });
const response = (status, data, headers) => new Response(JSON.stringify(data), { status, headers });
function sequence(items, options = {}) {
  const calls = [], sleeps = [];
  const client = createApolloClient({ apiKey: 'test-only-never-live', fetcher: async (url, options) => {
    calls.push({ url, ...options }); assert.ok(items.length, 'unexpected request'); const item = items.shift();
    if (item instanceof Error) throw item;
    return item;
  }, sleep: async ms => sleeps.push(ms), ...options });
  return { client, calls, sleeps };
}
const page = (contacts, number = 1, total = contacts.length, per = 1) => ({ contacts, pagination: { page: number, per_page: per, total_entries: total, total_pages: Math.ceil(total / per) } });

test('missing API key fails visibly before transport', async () => {
  await assert.rejects(createApolloClient({ apiKey: '', fetcher: () => assert.fail('must not call') }).listSavedContacts(), { code: 'APOLLO_NOT_CONFIGURED' });
});
test('paginates the entire saved-contact collection with current endpoint and stable ordering', async () => {
  const s = sequence([response(200, page([row(1)], 1, 2)), response(200, page([row(2)], 2, 2))]);
  const batch = await s.client.listSavedContacts({ perPage: 1 });
  assert.equal(batch.contacts.length, 2); assert.equal(batch.pagesRead, 2); assert.equal(batch.complete, true);
  assert.ok(s.calls.every(c => c.url === 'https://api.apollo.io/api/v1/contacts/search'));
  assert.deepEqual(s.calls.map(c => JSON.parse(c.body).page), [1, 2]);
  assert.equal(JSON.parse(s.calls[0].body).sort_by_field, 'contact_created_at');
});
test('empty provider collection is genuine success, not a substitute for an error', async () => {
  assert.equal((await sequence([response(200, page([], 1, 0, 25))]).client.listSavedContacts()).contacts.length, 0);
});
test('never returns partial success when a later page fails authentication', async () => {
  const s = sequence([response(200, page([row(1)], 1, 2)), response(401, { secret: 'do-not-echo' })]);
  await assert.rejects(s.client.listSavedContacts({ perPage: 1 }), { code: 'APOLLO_AUTH_REQUIRED' });
  assert.equal(s.calls.length, 2);
});
test('access and credit failures are not retried', async () => {
  for (const [status, code] of [[403, 'APOLLO_ACCESS_DENIED'], [402, 'APOLLO_CREDIT_LIMIT']]) {
    const s = sequence([response(status, {})]); await assert.rejects(s.client.listSavedContacts(), { code }); assert.equal(s.calls.length, 1);
  }
});
test('short 429 delay is honored, while long Retry-After is surfaced without early retry', async () => {
  const s = sequence([response(429, {}, { 'Retry-After': '1' }), response(200, page([], 1, 0, 25))]);
  await s.client.listSavedContacts(); assert.deepEqual(s.sleeps, [1000]);
  const long = sequence([response(429, {}, { 'Retry-After': '120' })]);
  await assert.rejects(long.client.listSavedContacts(), e => e.code === 'APOLLO_RATE_LIMIT' && e.retryAfterMs === 120000);
  assert.equal(long.calls.length, 1);
});
test('HTTP-date and absent rate limit headers retain safe retry deadlines', async () => {
  for (const header of [new Date(120000).toUTCString(), null]) {
    const s = sequence([response(429, {}, header ? { 'Retry-After': header } : {})], { now: () => 0 });
    await assert.rejects(s.client.listSavedContacts(), e => e.code === 'APOLLO_RATE_LIMIT' && e.retryAfterMs === (header ? 120000 : 60000));
  }
});
test('transient network and server errors have bounded retry recovery', async () => {
  const s = sequence([new Error('secret raw provider text'), response(503, {}), response(200, page([], 1, 0, 25))]);
  await s.client.listSavedContacts(); assert.equal(s.calls.length, 3);
  const failure = sequence([response(503, {}), response(503, {}), response(503, {})]);
  await assert.rejects(failure.client.listSavedContacts(), { code: 'APOLLO_UNAVAILABLE' }); assert.equal(failure.calls.length, 3);
});
test('hung transport and response parser are bounded even if injected fetch ignores abort', async () => {
  for (const fetcher of [() => new Promise(() => {}), async () => ({ ok: true, json: () => new Promise(() => {}) })]) {
    await assert.rejects(createApolloClient({ apiKey: 'test', fetcher, timeoutMs: 5, sleep: async () => {} }).listSavedContacts(), { code: 'APOLLO_TIMEOUT' });
  }
});
test('malformed, truncated and falsely empty provider collections never certify completeness', async () => {
  for (const data of [{}, { contacts: [], partial_results_only: true }, page([], 1, 5, 25), page([row(1)], 2, 1), { contacts: [row(1)], pagination: { page: 1, per_page: 25 } }]) {
    await assert.rejects(sequence([response(200, data)]).client.listSavedContacts());
  }
});
test('changed totals, repeated pages and configured pagination ceiling are visible failures', async () => {
  const a = sequence([response(200, page([row(1)], 1, 2)), response(200, page([row(2)], 2, 3))]);
  await assert.rejects(a.client.listSavedContacts({ perPage: 1 }), { code: 'APOLLO_RESULTS_CHANGED' });
  const b = sequence([response(200, page([row(1)], 1, 2)), response(200, page([row(1)], 2, 2))]);
  await assert.rejects(b.client.listSavedContacts({ perPage: 1 }), { code: 'APOLLO_REPEATED_PAGE' });
  const c = sequence([response(200, page([row(1)], 1, 2))]);
  await assert.rejects(c.client.listSavedContacts({ perPage: 1, maxPages: 1 }), { code: 'APOLLO_PAGINATION_LIMIT' });
});
test('duplicate emails deduplicate but conflicting identities require reconciliation', async () => {
  const duplicate = { ...row(1), id: id(2) };
  const s = sequence([response(200, page([row(1), duplicate], 1, 2, 25))]);
  assert.equal((await s.client.listSavedContacts()).contacts.length, 1);
  const bad = sequence([response(200, page([row(1), { ...duplicate, first_name: 'Other' }], 1, 2, 25))]);
  await assert.rejects(bad.client.listSavedContacts(), { code: 'APOLLO_IDENTITY_CONFLICT' });
});
test('invalid email records are counted rather than invented', async () => {
  const s = sequence([response(200, page([{ ...row(1), email: null }, row(2)], 1, 2, 25))]);
  const batch = await s.client.listSavedContacts(); assert.equal(batch.rejected, 1); assert.equal(batch.contacts.length, 1);
});
test('email spelling preserves dots, plus tags and local case; rejects unsafe domains', () => {
  assert.equal(normalizeApolloEmail(' First.Last+tag@EXAMPLE.COM '), 'First.Last+tag@example.com');
  for (const bad of ['a@foo.com/path', 'a@foo.com:443', 'a\n@foo.com', 'a..b@foo.com']) assert.throws(() => normalizeApolloEmail(bad));
  for (const bad of ['https://user:pass@foo.com', 'http://127.0.0.1', 'foo.com:5000', 'localhost']) assert.throws(() => normalizeApolloDomain(bad));
});
test('source fields never invent title, person, or mailbox validation', () => {
  const c = normalizeApolloContact({ id: id(1), email: 'a@example.com' });
  assert.equal(c.name, ''); assert.equal(c.title, ''); assert.equal(c.verified, false); assert.equal(c.emailValidation.mailboxConfirmed, false);
});
test('MX evidence does not guarantee a mailbox and DNS outages are errors', async () => {
  const check = await validateApolloEmail('a@example.com', { mxLookup: async () => [{ exchange: 'mail.example.com' }] });
  assert.equal(check.mx, true); assert.equal(check.mailboxConfirmed, false); assert.equal(check.zeroBounceGuaranteed, false);
  assert.equal((await validateApolloEmail('a@example.com', { mxLookup: async () => [{ exchange: '.' }] })).mx, false);
  await assert.rejects(validateApolloEmail('a@example.com', { mxLookup: () => new Promise(() => {}), timeoutMs: 5 }), { code: 'APOLLO_EMAIL_VALIDATION_UNAVAILABLE' });
});
test('paid enrichment requires explicit opt-in and never repeats uncertain requests', async () => {
  const s = sequence([]);
  await assert.rejects(s.client.enrichOrganization('example.com'), { code: 'APOLLO_ENRICHMENT_NOT_AUTHORIZED' });
  assert.equal(s.calls.length, 0);
  const network = sequence([new Error('lost response')]);
  await assert.rejects(network.client.enrichOrganization('example.com', { allowCreditConsumption: true }), { code: 'APOLLO_NETWORK_ERROR' });
  assert.equal(network.calls.length, 1);
});
test('enrichment proves matching organization and supports string technology values', async () => {
  const s = sequence([response(200, { organization: { id: id(1), primary_domain: 'example.com', current_technologies: ['React', { name: 'Node.js' }] } })]);
  const org = await s.client.enrichOrganization('www.example.com', { allowCreditConsumption: true });
  assert.deepEqual(org.technologies, ['React', 'Node.js']);
  const bad = sequence([response(200, { organization: { id: id(1), primary_domain: 'other.com' } })]);
  await assert.rejects(bad.client.enrichOrganization('example.com', { allowCreditConsumption: true }), { code: 'APOLLO_IDENTITY_MISMATCH' });
});
test('transport rejects alternate destinations before opening a connection', async () => {
  for (const url of ['https://example.com/api/v1/contacts/search', 'http://api.apollo.io/api/v1/contacts/search', 'https://api.apollo.io/api/v1/emailer_messages/send']) {
    await assert.rejects(apolloHttpFetch(url, { method: 'POST' }), { code: 'APOLLO_INVALID_DESTINATION' });
  }
});
test('CSV supports escaped quotes, BOM and quoted newlines without fabricated verification', () => {
  const batch = parseApolloCsv('\uFEFFEmail,First Name,Company Name,Title\r\na@example.com,A,"Example ""Inc""","Head\nof IT"\r\n');
  assert.equal(batch.contacts[0].company, 'Example "Inc"'); assert.equal(batch.contacts[0].verified, false);
  assert.equal(batch.contacts[0].source, 'APOLLO_CSV_IMPORT');
  for (const csv of ['Name\na', 'Email\n"a@example.com', 'Email,Email\na@example.com,a@example.com']) assert.throws(() => parseApolloCsv(csv));
});
test('CRM bridge deduplicates and reports queued separately from confirmed', async () => {
  let calls = 0; const lead = normalizeApolloContact(row(1)), jobId = 'a'.repeat(64);
  const batch = await syncApolloContacts([lead, lead], async () => { calls++; return { jobId, status: 'PENDING', synced: false }; });
  assert.equal(calls, 1); assert.equal(batch.providerConfirmed, 0);
  await assert.rejects(syncApolloContacts([lead], async () => ({ jobId, status: 'SYNCED_PROVIDER_CONFIRMED', synced: false })), { code: 'APOLLO_CRM_UNCONFIRMED' });
  await assert.rejects(syncApolloContacts([lead], async () => ({ jobId, status: 'BLOCKED' })), { code: 'APOLLO_CRM_BLOCKED' });
});
test('CRM validates all records before mutation and propagates storage failures', async () => {
  let calls = 0; const lead = normalizeApolloContact(row(1));
  await assert.rejects(syncApolloContacts([lead, { contactEmail: 'invalid' }], async () => calls++)); assert.equal(calls, 0);
  await assert.rejects(syncApolloContacts([lead], async () => { throw Object.assign(new Error('unavailable'), { code: 'CRM_STORAGE_FAILED' }); }), { code: 'CRM_STORAGE_FAILED' });
});
test('CRM remote transport guards credentials and secondary provider side effects', async () => {
  await assert.rejects(createApolloCrmQueue({ token: '', fetcher: () => assert.fail() })({ email: 'a@example.com' }), { code: 'APOLLO_CRM_AUTH_NOT_CONFIGURED' });
  let calls = 0;
  await assert.rejects(createApolloCrmQueue({ token: 'test', fetcher: async () => { calls++; return response(200, { integrations: { hubspot: { configured: true }, salesforce: { configured: true } } }); } })({ email: 'a@example.com' }), { code: 'APOLLO_SECONDARY_CRM_REVIEW_REQUIRED' });
  assert.equal(calls, 1);
});
test('pipeline import never invents dispatch and preserves genuine old delivery evidence', () => {
  const a = normalizeApolloContact(row(1)), b = normalizeApolloContact(row(2, 'other@example.com'));
  const initial = mergeApolloPipeline([], [a, b]); assert.equal(initial.records.length, 2); assert.equal(initial.records[0].status, 'RESEARCHING'); assert.equal(initial.records[0].deliveryAudit, null);
  initial.records[0].status = 'ENVIADO_IMPACTO_1'; initial.records[0].deliveryAudit = { messageId: 'provider-real' };
  const second = mergeApolloPipeline(initial.records, [a]);
  assert.equal(second.added, 0); assert.equal(second.records[0].deliveryAudit.messageId, 'provider-real');
  assert.equal(second.records.length, 2, 'same company must not discard a distinct person');
});
test('file updates persist atomically and block concurrent writers', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'apollo-regression-')), file = join(dir, 'pipeline.json');
  try {
    await updatePipelineFile(file, () => ({ records: [normalizeApolloContact(row(1))] }));
    assert.equal(JSON.parse(await readFile(file, 'utf8')).length, 1);
    await writeFile(file + '.lock', 'occupied');
    await assert.rejects(updatePipelineFile(file, () => assert.fail()), { code: 'APOLLO_PIPELINE_BUSY' });
  } finally { await rm(dir, { recursive: true, force: true }); }
});
function res() { return { headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(v) { this.statusCode = v; return this; }, json(v) { this.data = v; return this; } }; }
process.env.PARTNER_API_TOKEN = 'local-auth-test';
test('Apollo API rejects unauthenticated access and does not expose personal data', async () => {
  let reads = 0; const client = { listSavedContacts: async () => { reads++; return { contacts: [normalizeApolloContact(row(1))], complete: true, pagesRead: 1, totalEntries: 1, rejected: 0 }; } };
  const handler = createApolloHandler({ client, validateEmail: async () => ({ mx: true }) });
  const a = res(); await handler({ method: 'GET', url: '/api/apollo?action=verify', headers: {} }, a); assert.equal(a.statusCode, 401); assert.equal(reads, 0);
  const b = res(); await handler({ method: 'GET', url: '/api/apollo?action=verify', headers: { authorization: 'Bearer local-auth-test' } }, b);
  assert.equal(b.statusCode, 200); assert.equal(b.headers['Cache-Control'], 'no-store'); assert.doesNotMatch(JSON.stringify(b.data), /owner1|Owner/);
});
test('Apollo API resolves selected IDs from provider and rejects client-invented contacts', async () => {
  let writes = 0;
  const handler = createApolloHandler({ client: { listSavedContacts: async () => ({ contacts: [normalizeApolloContact(row(1))] }) }, validateEmail: async () => ({ mx: true }),
    queue: async () => { writes++; return { jobId: 'a'.repeat(64), status: 'PENDING' }; } });
  const req = { method: 'POST', url: '/api/apollo?action=sync', headers: { authorization: 'Bearer local-auth-test' } };
  const bad = res(); await handler({ ...req, body: { contactIds: [id(2)] } }, bad); assert.equal(bad.statusCode, 400); assert.equal(writes, 0);
  const ok = res(); await handler({ ...req, body: { contactIds: [id(1)] } }, ok); assert.equal(ok.statusCode, 202); assert.equal(ok.data.success, false); assert.equal(writes, 1);
});
test('MCP uses real provider results, rejects fake filters and removes fictitious exports', async () => {
  let reads = 0; const handler = createMcpHandler({ client: { listSavedContacts: async () => { reads++; return { contacts: [], complete: true }; } } });
  const call = (name, args) => handler({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } });
  const ok = await call('apollo_search_saved_contacts', {}); assert.equal(JSON.parse(ok.result.content[0].text).contacts.length, 0); assert.equal(reads, 1);
  const filtered = await call('apollo_search_infrastructure_leads', { technology: 'React' }); assert.equal(filtered.result.isError, true); assert.equal(reads, 1);
  for (const name of ['explee_generate_micro_audit_video', 'airtable_export_pipeline_record']) assert.equal((await call(name, {})).result.isError, true);
  assert.equal(await handler({ jsonrpc: '2.0', method: 'notifications/initialized' }), null);
});

test('global prospect search forwards supported filters and never invents contact emails or full surnames', async () => {
  const s = sequence([response(200, { total_entries: 1000, people: [{ id: id(1), first_name: 'Real', last_name_obfuscated: 'S***', email: 'do-not-use@example.com', organization: { name: 'Example' } }] })]);
  const result = await s.client.searchPeople({ technologyUids: ['wordpress_org'], locations: ['El Salvador'], titles: ['CTO'], perPage: 1 });
  assert.equal(result.complete, false); assert.equal(result.researchOnly, true); assert.equal(result.people[0].contactable, false);
  assert.doesNotMatch(JSON.stringify(result), /do-not-use/);
  assert.deepEqual(JSON.parse(s.calls[0].body).currently_using_any_of_technology_uids, ['wordpress_org']);
});
test('global prospect search fails on unsupported filters or malformed provider identity', async () => {
  await assert.rejects(sequence([]).client.searchPeople({ technologyUids: ['Bad Technology'] }), { code: 'APOLLO_INVALID_FILTER' });
  await assert.rejects(sequence([response(200, { total_entries: 1, people: [{ id: 'fake' }] })]).client.searchPeople(), { code: 'APOLLO_INVALID_RESPONSE' });
});
test('MCP global search invokes the real search client', async () => {
  let called = false;
  const handler = createMcpHandler({ client: { searchPeople: async args => { called = true; assert.deepEqual(args.locations, ['Spain']); return { people: [], researchOnly: true }; } } });
  const result = await handler({ jsonrpc: '2.0', id: 5, method: 'tools/call', params: { name: 'apollo_search_infrastructure_leads', arguments: { locations: ['Spain'] } } });
  assert.equal(called, true); assert.equal(result.result.isError, undefined);
});
