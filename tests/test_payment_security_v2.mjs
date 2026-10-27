import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

import { resolveProductPricing } from '../lib/payment_catalog.js';
import { verifyHmacHex } from '../lib/payment_providers.js';

const ROOT = path.resolve(process.cwd());
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');

test('retired offers cannot generate a payment and current services require an approved quote', () => {
  for (const id of ['flash', 'pro', 'enterprise']) {
    assert.throws(() => resolveProductPricing(id, 1), { code: 'PRODUCT_RETIRED', statusCode: 410 });
  }
  for (const id of ['prebuilt', 'custom']) {
    assert.throws(() => resolveProductPricing(id, 1), { code: 'APPROVED_QUOTE_REQUIRED', statusCode: 409 });
    assert.throws(() => resolveProductPricing(id, 99), { code: 'INVALID_QUANTITY' });
  }
  for (const id of ['unknown', '__proto__', 'constructor']) {
    assert.throws(() => resolveProductPricing(id, 1), { code: 'UNKNOWN_PRODUCT', statusCode: 400 });
  }
});

test('HMAC verification is timing-safe compatible and rejects altered payloads', () => {
  const secret = 'unit-test-secret';
  const body = '{"id":"evt_1"}';
  const signature = crypto.createHmac('sha256', secret).update(body).digest('hex');
  assert.equal(verifyHmacHex(body, signature, secret), true);
  assert.equal(verifyHmacHex(body + 'x', signature, secret), false);
  assert.equal(verifyHmacHex(body, 'not-a-signature', secret), false);
});

test('legacy public payment confirmation routes are explicitly retired', () => {
  const api = read('api/index.js');
  assert.match(api, /LEGACY_PAYMENT_ROUTE_RETIRED/);
  assert.match(api, /LEGACY_WEBHOOK_ROUTE_RETIRED/);
  assert.doesNotMatch(api, /status:\s*['"]SETTLED['"]/);
});

test('production payment code contains no synthetic paid/approved fallback', () => {
  const files = [
    'lib/payment_security.js',
    'lib/billing_settlement_sentinel.js',
    'lib/payment_catalog.js',
    'lib/payment_store.js',
    'lib/payment_providers.js',
    'lib/payment_reconciliation.js',
    'api/payments.js',
    'mcp/boltech-payments-mcp.mjs',
    'index.html'
  ];
  const joined = files.map(read).join('\n');
  assert.doesNotMatch(joined, /sim_strike_/i);
  assert.doesNotMatch(joined, /sim_wompi_/i);
  assert.doesNotMatch(joined, /mock_bolt11/i);
  assert.doesNotMatch(joined, /verified\s*=\s*true\s*;\s*\/\/\s*Si no hay API key/i);
  assert.doesNotMatch(joined, /\/api\/verify-lightning/);
});

test('payment confirmation requires provider verification and persistent ledger', () => {
  const reconciliation = read('lib/payment_reconciliation.js');
  const store = read('lib/payment_store.js');
  const providers = read('lib/payment_providers.js');
  assert.match(reconciliation, /getWompiTransaction/);
  assert.match(reconciliation, /getStrikeInvoice/);
  assert.match(reconciliation, /status:\s*'PAID'/);
  assert.match(store, /Payment Orders|ordersTableId/);
  assert.match(store, /Payment Events|eventsTableId/);
  assert.match(providers, /wompi_hash|verifyWompiWebhookSignature/);
  assert.match(providers, /STRIKE_WEBHOOK_SECRET/);
  assert.match(providers, /\/quote/);
  const api = read('api/payments.js');
  assert.match(api, /action === 'wompi-webhook'/);
  assert.match(api, /action === 'strike-webhook'/);
  assert.match(api, /bodyParser:\s*false/);
});

test('minimal front-end cannot create or pretend to confirm payment', () => {
  const html = read('index.html');
  const factory = read('factory-preview.html');
  for (const page of [html, factory]) {
    assert.doesNotMatch(page, /\/api\/payments\?action=(?:create|create-approved|status)/);
    assert.doesNotMatch(page, /Pago confirmado por Strike|Pago confirmado por Wompi/);
    assert.doesNotMatch(page, /Ya transferí: Notificar|Confirmar y Activar Licencia/);
  }
  const api = read('api/payments.js');
  const catalog = read('lib/payment_catalog.js');
  assert.match(api, /requireOperationalAuth\(req, res\)/);
  assert.match(catalog, /APPROVED_QUOTE_REQUIRED/);
});


test('Vercel Hobby deployment stays within the 12 serverless function limit', () => {
  const apiDir = path.join(ROOT, 'api');
  function walk(dir) {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) return walk(full);
      return entry.isFile() && entry.name.endsWith('.js') ? [full] : [];
    });
  }
  const functions = walk(apiDir);
  assert.ok(functions.length <= 12, `Vercel Hobby allows at most 12 functions; found ${functions.length}: ${functions.join(', ')}`);
});

