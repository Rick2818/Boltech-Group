import test from 'node:test';
import assert from 'node:assert/strict';
import { syncHubSpotContact, normalizeContact, hubspotHttpFetch } from '../lib/crm_recovery.js';
process.env.HUBSPOT_ACCESS_TOKEN = 'local-test-only';
const properties = { email: 'boltech-crm-test@example.com', firstname: 'PRUEBA TÉCNICA', lastname: 'Boltech CRM' };
const contact = { id: '252891994553', archived: false, properties };
function sequence(responses) {
  const calls = [];
  return { calls, fetcher: async (url, options) => {
    calls.push({ url, method: options.method });
    assert.ok(responses.length, 'unexpected extra request');
    return responses.shift();
  }};
}
const response = (status, data) => new Response(data === undefined ? null : JSON.stringify(data), { status });
test('confirms a created contact by reading its saved fields when write JSON lacks ID', async () => {
  const s = sequence([response(404), response(201, {}), response(200, contact)]);
  const result = await syncHubSpotContact(properties, s.fetcher);
  assert.equal(result.contactId, contact.id);
  assert.equal(result.synced, true);
  assert.deepEqual(s.calls.map(x => x.method), ['GET', 'POST', 'GET']);
  assert.match(s.calls[2].url, /properties=/);
});
test('confirms an empty successful PATCH response without creating a duplicate', async () => {
  const s = sequence([response(200, contact), response(204), response(200, contact)]);
  assert.equal((await syncHubSpotContact(properties, s.fetcher)).contactId, contact.id);
  assert.deepEqual(s.calls.map(x => x.method), ['GET', 'PATCH', 'GET']);
});
test('does not report success when saved properties differ', async () => {
  const s = sequence([response(200, contact), response(200, contact), response(200, { ...contact, properties: { ...properties, firstname: 'wrong' } })]);
  await assert.rejects(syncHubSpotContact(properties, s.fetcher), { code: 'HUBSPOT_READBACK_MISMATCH' });
});
test('does not accept archived or missing read responses', async () => {
  for (const data of [{}, { ...contact, archived: true }]) {
    const s = sequence([response(404), response(201, contact), response(200, data), response(200, { results: [] })]);
    await assert.rejects(syncHubSpotContact(properties, s.fetcher), { code: data.archived ? 'HUBSPOT_CONTACT_ARCHIVED' : 'HUBSPOT_BATCH_READ_UNCONFIRMED' });
  }
});
test('preserves authentication errors and stops before mutation', async () => {
  const s = sequence([response(403, {})]);
  await assert.rejects(syncHubSpotContact(properties, s.fetcher), { code: 'HUBSPOT_AUTH_REQUIRED' });
  assert.deepEqual(s.calls.map(x => x.method), ['GET']);
});
test('recovers a create conflict by updating and verifying the existing ID', async () => {
  const s = sequence([response(404), response(409), response(200, contact), response(200, {}), response(200, contact)]);
  assert.equal((await syncHubSpotContact(properties, s.fetcher)).contactId, contact.id);
  assert.deepEqual(s.calls.map(x => x.method), ['GET', 'POST', 'GET', 'PATCH', 'GET']);
});
test('rejects a different contact ID in the verification read', async () => {
  const s = sequence([response(200, contact), response(200, contact), response(200, { ...contact, id: '999' })]);
  await assert.rejects(syncHubSpotContact(properties, s.fetcher), { code: 'HUBSPOT_IDENTITY_MISMATCH' });
});

test('malformed successful GET recovers through batch read and verifies same saved contact', async () => {
  const batch = () => response(200, { results: [contact] });
  const s = sequence([response(200), batch(), response(200, contact), response(200), batch()]);
  assert.equal((await syncHubSpotContact(properties, s.fetcher)).contactId, contact.id);
  assert.deepEqual(s.calls.map(x => x.method), ['GET', 'POST', 'PATCH', 'GET', 'POST']);
  assert.ok(s.calls[1].url.endsWith('/batch/read'));
  assert.ok(s.calls[4].url.endsWith('/batch/read'));
});
test('malformed GET plus missing batch contact never causes a create', async () => {
  const s = sequence([response(200), response(200, { results: [] })]);
  await assert.rejects(syncHubSpotContact(properties, s.fetcher), { code: 'HUBSPOT_BATCH_READ_UNCONFIRMED' });
  assert.ok(s.calls.every(x => !x.url.endsWith('/contacts')));
});
test('batch fallback rejects a different email', async () => {
  const s = sequence([response(200), response(200, { results: [{ ...contact, properties: { ...properties, email: 'other@example.com' } }] })]);
  await assert.rejects(syncHubSpotContact(properties, s.fetcher), { code: 'HUBSPOT_BATCH_READ_UNCONFIRMED' });
});

test('wrong lookup identity blocks every mutation', async () => {
  for (const bad of [{ ...contact, id: '../other' }, { ...contact, properties: { email: 'other@example.com' } }]) {
    const s = sequence([response(200, bad)]);
    await assert.rejects(syncHubSpotContact(properties, s.fetcher), { code: 'HUBSPOT_IDENTITY_MISMATCH' });
    assert.equal(s.calls.length, 1);
  }
});
test('rejects destination changes before opening a socket', async () => {
  for (const url of ['http://api.hubapi.com/crm/v3/objects/contacts', 'https://example.com/crm/v3/objects/contacts', 'https://api.hubapi.com/oauth/v1/token', 'https://user:pass@api.hubapi.com/crm/v3/objects/contacts']) {
    await assert.rejects(hubspotHttpFetch(url, { method: 'GET' }), { code: 'HUBSPOT_INVALID_DESTINATION' });
  }
});
test('rate limits honor HTTP dates and missing header fallback', async () => {
  for (const header of [new Date(Date.now() + 180000).toUTCString(), null]) {
    await assert.rejects(syncHubSpotContact(properties, async () => new Response(null, { status: 429, headers: header ? { 'Retry-After': header } : {} })), error => {
      assert.equal(error.code, 'HUBSPOT_RATE_LIMIT');
      assert.ok(error.retryAfterMs >= (header ? 170000 : 60000));
      return true;
    });
  }
});
test('rejects malformed input and control characters', () => {
  for (const lead of [null, [], { ...properties, firstname: 'name\nInjected' }])
    assert.throws(() => normalizeContact(lead), { code: 'CRM_INVALID_CONTACT' });
});
