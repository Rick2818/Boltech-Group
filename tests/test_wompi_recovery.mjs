import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { recoverWompiOrder, reconcileWompiRedirect } from '../lib/payment_reconciliation.js';
import { resolveApprovedQuote } from '../lib/payment_catalog.js';
import handler from '../api/payments.js';
import { claimPaymentCreation, getVerifiedSalesMetrics } from '../lib/payment_store.js';
import { fulfillPaidOrder } from '../lib/payment_fulfillment.js';

test('technical verification never activates a service', async () => {
  assert.deepEqual(await fulfillPaidOrder({ status: 'PAID', productId: 'payment-verification' }),
    { fulfilled: false, technicalTest: true, serviceDeliveryRequired: false });
});

test('creation claim admits one concurrent request and metrics exclude the real dollar test', async () => {
  const originalFetch = globalThis.fetch;
  const keys = ['UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN', 'AIRTABLE_TOKEN'];
  const previous = Object.fromEntries(keys.map(k => [k, process.env[k]]));
  Object.assign(process.env, { UPSTASH_REDIS_REST_URL: 'https://redis.example', UPSTASH_REDIS_REST_TOKEN: 'unit', AIRTABLE_TOKEN: 'unit' });
  let claimed = false;
  globalThis.fetch = async url => {
    if (url === 'https://redis.example') {
      const result = claimed ? null : 'OK'; claimed = true;
      return new Response(JSON.stringify({ result }), { status: 200 });
    }
    return new Response(JSON.stringify({ records: [{ id: 'recTest', fields: {
      Status: 'PAID', Environment: 'production', 'Product ID': 'payment-verification',
      'Expected Amount USD': 1, 'Paid At': '2026-10-05T16:14:16Z',
      'Provider Transaction ID': 'tx-test', 'Provider Evidence': '{"approved":true}'
    } }] }), { status: 200 });
  };
  try {
    assert.deepEqual((await Promise.all([claimPaymentCreation('Q1'), claimPaymentCreation('Q1')])).sort(), [false, true]);
    assert.deepEqual(await getVerifiedSalesMetrics(), { paidOrders: 0, cashCollectedUsd: 0 });
  } finally {
    globalThis.fetch = originalFetch;
    for (const key of keys) if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key];
  }
});

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

test('approved quote persists an order before issuing a link and reuses it on retry', async () => {
  const originalFetch = globalThis.fetch;
  const keys = ['AIRTABLE_TOKEN', 'PARTNER_API_TOKEN', 'PAYMENT_ENV', 'WOMPI_APP_ID', 'WOMPI_API_SECRET', 'UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN'];
  const previous = Object.fromEntries(keys.map(k => [k, process.env[k]]));
  Object.assign(process.env, { AIRTABLE_TOKEN: 'unit', PARTNER_API_TOKEN: 'unit-admin', PAYMENT_ENV: 'production',
    WOMPI_APP_ID: 'unit', WOMPI_API_SECRET: 'unit', UPSTASH_REDIS_REST_URL: 'https://redis.example', UPSTASH_REDIS_REST_TOKEN: 'unit' });
  let record = null, linkCreations = 0;
  const json = data => new Response(JSON.stringify(data), { status: 200 });
  globalThis.fetch = async (url, options = {}) => {
    const address = new URL(url);
    if (url === 'https://redis.example') return json({ result: 'OK' });
    if (address.hostname === 'id.wompi.sv') return json({ access_token: 'unit-access' });
    if (address.hostname === 'api.wompi.sv') {
      assert.equal(record.fields.Status, 'CREATED');
      assert.equal(JSON.parse(options.body).monto, 25);
      linkCreations++;
      return json({ idEnlace: 'quote-link', urlEnlace: 'https://pagos.wompi.sv/quote-test', estaProductivo: true });
    }
    if (options.method === 'PATCH') {
      const body = JSON.parse(options.body);
      if (body.records) {
        record = { id: 'recQuote', fields: body.records[0].fields };
        return json({ records: [record], createdRecords: ['recQuote'] });
      }
      Object.assign(record.fields, body.fields); return json(record);
    }
    return json({ records: record ? [record] : [] });
  };
  try {
    for (let attempt = 0; attempt < 2; attempt++) {
      let status, data;
      const body = { approved: true, quoteReference: 'approved-Q-25', productId: 'custom', approvedAmountUsd: 25,
        provider: 'WOMPI_SV', customerEmail: 'buyer@example.com' };
      const req = { method: 'POST', url: '/api/payments?action=create-approved',
        headers: { host: 'localhost', authorization: 'Bearer unit-admin' }, socket: { remoteAddress: 'quote-test' },
        async *[Symbol.asyncIterator]() { yield Buffer.from(JSON.stringify(body)); } };
      const res = { setHeader() {}, status(n) { status = n; return this; }, json(p) { data = p; return this; } };
      await handler(req, res);
      assert.equal(status, attempt ? 200 : 201);
      assert.equal(data.checkout.url, 'https://pagos.wompi.sv/quote-test');
      assert.equal(data.order.status, 'PENDING_PAYMENT');
    }
    assert.equal(linkCreations, 1);
  } finally {
    globalThis.fetch = originalFetch;
    for (const key of keys) if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key];
  }
});
