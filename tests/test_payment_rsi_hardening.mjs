import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { reconcileWompiWebhook } from '../lib/payment_reconciliation.js';
import { claimFulfillment } from '../lib/payment_store.js';

function json(body) { return new Response(JSON.stringify(body), { status: 200 }); }

test('a rejected Wompi delivery cannot be acknowledged as a valid duplicate', async () => {
  const originalFetch = globalThis.fetch;
  const originalSecret = process.env.WOMPI_API_SECRET;
  const originalAppId = process.env.WOMPI_APP_ID;
  const originalToken = process.env.AIRTABLE_TOKEN;
  process.env.WOMPI_API_SECRET = 'unit-secret';
  process.env.WOMPI_APP_ID = 'unit-app';
  process.env.AIRTABLE_TOKEN = 'unit-airtable';
  let event = null;
  globalThis.fetch = async (url, options = {}) => {
    const path = new URL(url).pathname;
    if (options.method === 'PATCH') {
      event = { id: 'recEvent', fields: options.body && JSON.parse(options.body).records[0].fields };
      return json({ records: [event], createdRecords: ['recEvent'] });
    }
    if (path.endsWith('tblcX6MFc9SOiY9cd')) return json({ records: event ? [event] : [] });
    throw new Error('Unexpected provider or order lookup');
  };
  try {
    const payload = '{"IdTransaccion":"irrelevant"}';
    for (let attempt = 0; attempt < 2; attempt++) {
      await assert.rejects(reconcileWompiWebhook({ rawBody: payload, signature: 'bad' }), {
        code: 'INVALID_WEBHOOK_SIGNATURE'
      });
    }
  } finally {
    globalThis.fetch = originalFetch;
    if (originalSecret === undefined) delete process.env.WOMPI_API_SECRET;
    else process.env.WOMPI_API_SECRET = originalSecret;
    if (originalAppId === undefined) delete process.env.WOMPI_APP_ID;
    else process.env.WOMPI_APP_ID = originalAppId;
    if (originalToken === undefined) delete process.env.AIRTABLE_TOKEN;
    else process.env.AIRTABLE_TOKEN = originalToken;
  }
});

test('atomic fulfillment claim admits one concurrent worker', async () => {
  const originalFetch = globalThis.fetch;
  const originalUrl = process.env.UPSTASH_REDIS_REST_URL;
  const originalRedisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  const originalAirtableToken = process.env.AIRTABLE_TOKEN;
  process.env.UPSTASH_REDIS_REST_URL = 'https://redis.example';
  process.env.UPSTASH_REDIS_REST_TOKEN = 'unit-redis';
  process.env.AIRTABLE_TOKEN = 'unit-airtable';
  let claimed = false;
  globalThis.fetch = async (url, options = {}) => {
    if (url === 'https://redis.example') {
      const result = claimed ? null : 'OK';
      claimed = true;
      return json({ result });
    }
    return json({ records: [{ id: 'recEvent', fields: JSON.parse(options.body).records[0].fields }] });
  };
  try {
    const orderId = crypto.randomUUID();
    const results = await Promise.all([
      claimFulfillment(orderId, 'STRIKE'),
      claimFulfillment(orderId, 'STRIKE')
    ]);
    assert.deepEqual(results.map(r => r.claimed).sort(), [false, true]);
  } finally {
    globalThis.fetch = originalFetch;
    for (const [key, value] of Object.entries({
      UPSTASH_REDIS_REST_URL: originalUrl,
      UPSTASH_REDIS_REST_TOKEN: originalRedisToken,
      AIRTABLE_TOKEN: originalAirtableToken
    })) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test('Wompi rejects an approved transaction attached to a different payment link', async () => {
  const previous = Object.fromEntries(['WOMPI_APP_ID', 'WOMPI_API_SECRET', 'AIRTABLE_TOKEN', 'PAYMENT_ENV'].map(k => [k, process.env[k]]));
  const originalFetch = globalThis.fetch;
  Object.assign(process.env, {
    WOMPI_APP_ID: 'unit-app', WOMPI_API_SECRET: 'unit-secret', AIRTABLE_TOKEN: 'unit-airtable', PAYMENT_ENV: 'sandbox'
  });
  const orderId = crypto.randomUUID();
  const transactionId = crypto.randomUUID();
  const rawBody = JSON.stringify({
    IdTransaccion: transactionId, Monto: 19, EsProductiva: false,
    EnlacePago: { Id: 222, IdentificadorEnlaceComercio: orderId }
  });
  const signature = crypto.createHmac('sha256', 'unit-secret').update(rawBody).digest('hex');
  let markedPaid = false;
  globalThis.fetch = async (url, options = {}) => {
    const address = new URL(url);
    if (address.hostname === 'id.wompi.sv') return json({ access_token: 'unit-access', expires_in: 300 });
    if (address.hostname === 'api.wompi.sv') return json({ idTransaccion: transactionId, esAprobada: true, esReal: false, monto: 19 });
    if (options.method === 'PATCH') {
      const fields = JSON.parse(options.body).records?.[0]?.fields || JSON.parse(options.body).fields;
      if (fields.Status === 'PAID') markedPaid = true;
      return json(options.body && JSON.parse(options.body).records
        ? { records: [{ id: 'recEvent', fields }] }
        : { id: 'recOrder', fields });
    }
    if (address.pathname.endsWith('tblcX6MFc9SOiY9cd')) return json({ records: [] });
    return json({ records: [{ id: 'recOrder', fields: {
      'Order ID': orderId, Provider: 'WOMPI_SV', Environment: 'sandbox', Status: 'PENDING_PAYMENT',
      'Expected Amount USD': 19, 'Provider Invoice ID': '111', Currency: 'USD'
    } }] });
  };
  try {
    const result = await reconcileWompiWebhook({ rawBody, signature });
    assert.equal(result.accepted, false);
    assert.equal(result.reason, 'PROVIDER_MISMATCH');
    assert.equal(markedPaid, false);
  } finally {
    globalThis.fetch = originalFetch;
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
