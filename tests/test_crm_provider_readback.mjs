import test from 'node:test';
import assert from 'node:assert/strict';
import { syncHubSpotContact } from '../lib/crm_recovery.js';
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
    const s = sequence([response(404), response(201, contact), response(200, data)]);
    await assert.rejects(syncHubSpotContact(properties, s.fetcher), { code: 'HUBSPOT_INVALID_RESPONSE' });
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
