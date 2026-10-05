import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { recoverWompiOrder, reconcileWompiRedirect } from '../lib/payment_reconciliation.js';
import { resolveApprovedQuote } from '../lib/payment_catalog.js';
import handler from '../api/payments.js';

test('administrative quote requires explicit approval and cents precision', () => {
  const quote = { approved: true, quoteReference: 'Q-1', productId: 'custom', approvedAmountUsd: 25 };
  assert.equal(resolveApprovedQuote(quote).amountUsd, 25);
  for (const change of [{ approved: false }, { approvedAmountUsd: 1.001 }, { approvedAmountUsd: 0 }, { productId: 'constructor' }, { quoteReference: '' }, { quantity: 2 }]) {
    assert.throws(() => resolveApprovedQuote({ ...quote, ...change }), { code: 'INVALID_APPROVED_QUOTE' });
  }
});

test('recovery and approved quote routes reject unauthenticated callers', async () => {
  process.env.PARTNER_API_TOKEN = 'unit-admin';
  try {
    for (const action of ['wompi-recover', 'create-approved']) {
      let status, data;
      const req = { method: 'POST', url: '/api/payments?action=' + action, headers: { host: 'localhost' },
        socket: { remoteAddress: action }, async *[Symbol.asyncIterator]() { yield Buffer.from('{}'); } };
      const res = { setHeader() {}, status(n) { status = n; return this; }, json(p) { data = p; return this; } };
      await handler(req, res);
      assert.equal(status, 401); assert.equal(data.code, 'OPERATIONAL_AUTH_REQUIRED');
    }
  } finally { delete process.env.PARTNER_API_TOKEN; }
});

test('recovery queries provider, rejects wrong amount, and preserves original mismatch', async () => {
  const originalFetch = globalThis.fetch;
  const keys = ['AIRTABLE_TOKEN', 'WOMPI_API_SECRET', 'WOMPI_APP_ID', 'PAYMENT_ENV'];
  const previous = Object.fromEntries(keys.map(k => [k, process.env[k]]));
  Object.assign(process.env, { AIRTABLE_TOKEN: 'unit', WOMPI_API_SECRET: 'unit', WOMPI_APP_ID: 'unit', PAYMENT_ENV: 'production' });
  const orderId = 'technical-test', transactionId = 'tx-test', fingerprint = 'WOMPI-REDIRECT:original';
  let amount = 2, paid = false, eventWrites = [], providerQueries = 0;
  const order = { 'Order ID': orderId, Provider: 'WOMPI_SV', Environment: 'production', Status: 'PENDING_PAYMENT',
    'Product ID': 'payment-verification', Quantity: 1, 'Expected Amount USD': 1,
    'Provider Invoice ID': '4478632', 'Provider Transaction ID': transactionId };
  const event = { 'Event Fingerprint': fingerprint, Provider: 'WOMPI_SV', 'Order ID': orderId,
    'Provider Transaction ID': transactionId, 'Signature Valid': true, Processed: true, Result: 'MISMATCH' };
  const json = body => new Response(JSON.stringify(body), { status: 200 });
  globalThis.fetch = async (url, options = {}) => {
    const address = new URL(url);
    if (address.hostname === 'id.wompi.sv') return json({ access_token: 'unit-token' });
    if (address.hostname === 'api.wompi.sv') { providerQueries++; return json({ idTransaccion: transactionId, esAprobada: true, esReal: true, monto: amount }); }
    if (options.method === 'PATCH') {
      const body = JSON.parse(options.body);
      if (body.records) { eventWrites.push(body.records[0].fields); return json({ records: [{ id: 'recEvent', fields: body.records[0].fields }] }); }
      Object.assign(order, body.fields); paid ||= body.fields.Status === 'PAID'; return json({ id: 'recOrder', fields: order });
    }
    if (address.pathname.endsWith('tblcX6MFc9SOiY9cd')) {
      const formula = address.searchParams.get('filterByFormula');
      return json({ records: formula.includes('WOMPI-RECOVERY:') ? [] : [{ id: 'recOriginal', fields: event }] });
    }
    return json({ records: [{ id: 'recOrder', fields: order }] });
  };
  try {
    assert.equal((await recoverWompiOrder({ orderId, fingerprint })).reason, 'PROVIDER_MISMATCH');
    assert.equal(paid, false);
    amount = 1;
    assert.equal((await recoverWompiOrder({ orderId, fingerprint })).accepted, true);
    assert.equal(paid, true); assert.equal(providerQueries, 2);
    assert.equal(event.Result, 'MISMATCH');
    assert.ok(eventWrites.every(e => e['Event Fingerprint'].startsWith('WOMPI-RECOVERY:')));
    // A rejected redirect must be evaluated again, instead of falsely succeeding as a duplicate.
    const params = { identificadorEnlaceComercio: orderId, idTransaccion: transactionId, idEnlace: 'wrong', monto: '1' };
    params.hash = crypto.createHmac('sha256', 'unit').update([orderId, transactionId, 'wrong', '1'].join('')).digest('hex');
    assert.equal((await reconcileWompiRedirect(params)).reason, 'LINK_MISMATCH');
  } finally {
    globalThis.fetch = originalFetch;
    for (const key of keys) if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key];
  }
});
