import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateCommercialProgress } from '../scripts/commercial/zero_to_first_sale.mjs';
import { getVerifiedSalesMetrics } from '../lib/payment_store.js';
import partnersHandler from '../api/partners.js';

test('missing payment evidence stays unknown even when contacts exist', () => {
  const result = evaluateCommercialProgress({ savedContacts: 25 });
  assert.equal(result.cashCollectedUsd, null);
  assert.match(result.focus, /Restablecer/);
  assert.equal(result.replies, null);
});

test('zero collected prioritizes actual interest over contact inventory', () => {
  const result = evaluateCommercialProgress({
    verifiedSales: { cashCollectedUsd: 0, paidOrders: 0 },
    hotLeads: 2,
    savedContacts: 25,
  });
  assert.equal(result.cashCollectedUsd, 0);
  assert.match(result.focus, /hot leads reales/);
});

test('verified first payment changes focus to repeatable sale', () => {
  const result = evaluateCommercialProgress({
    verifiedSales: { cashCollectedUsd: 49, paidOrders: 1 },
    hotLeads: 3,
  });
  assert.equal(result.paidOrders, 1);
  assert.match(result.focus, /primer cobro/);
});

test('payment aggregate excludes tests and orders without payment evidence across pages', async () => {
  const originalFetch = globalThis.fetch;
  const previousToken = process.env.AIRTABLE_TOKEN;
  process.env.AIRTABLE_TOKEN = 'unit-test-token';
  const pages = [
    { records: [
      { fields: { Status: 'PAID', Environment: 'production', 'Expected Amount USD': 49,
        'Provider Transaction ID': 'tx-real-1', 'Provider Evidence': 'verified', 'Paid At': '2026-09-29T00:00:00Z' } },
      { fields: { Status: 'PAID', Environment: 'production', 'Expected Amount USD': 99,
        'Provider Evidence': 'unconfirmed link' } },
    ], offset: 'next' },
    { records: [{ fields: { Status: 'PAID', Environment: 'production', 'Expected Amount USD': 51,
      'Provider Invoice ID': 'invoice-real-2', 'Provider Evidence': 'verified', 'Paid At': '2026-09-29T00:00:00Z' } }] },
  ];
  globalThis.fetch = async url => {
    assert.match(String(url), /Status/);
    return { ok: true, text: async () => JSON.stringify(pages.shift()) };
  };
  try {
    assert.deepEqual(await getVerifiedSalesMetrics(), { paidOrders: 2, cashCollectedUsd: 100 });
  } finally {
    globalThis.fetch = originalFetch;
    if (previousToken === undefined) delete process.env.AIRTABLE_TOKEN;
    else process.env.AIRTABLE_TOKEN = previousToken;
  }
});

test('commercial payment totals require operator authentication', async () => {
  const previousAirtable = process.env.AIRTABLE_TOKEN;
  const previousPartner = process.env.PARTNER_API_TOKEN;
  process.env.AIRTABLE_TOKEN = 'unit-test-token';
  process.env.PARTNER_API_TOKEN = 'operator-secret';
  let status;
  let payload;
  const res = {
    setHeader() {},
    status(code) { status = code; return this; },
    json(value) { payload = value; return this; },
  };
  try {
    await partnersHandler({ method: 'GET', url: '/api/partners?action=commercial-metrics', headers: { host: 'localhost' } }, res);
    assert.equal(status, 401);
    assert.equal(payload.code, 'PARTNER_AUTH_REQUIRED');
  } finally {
    if (previousAirtable === undefined) delete process.env.AIRTABLE_TOKEN;
    else process.env.AIRTABLE_TOKEN = previousAirtable;
    if (previousPartner === undefined) delete process.env.PARTNER_API_TOKEN;
    else process.env.PARTNER_API_TOKEN = previousPartner;
  }
});
