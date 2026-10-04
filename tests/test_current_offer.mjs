import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import handler from '../api/payments.js';
import { PAYMENT_CATALOG } from '../lib/payment_catalog.js';

test('current offer has two quote-based services without inherited prices', () => {
  assert.deepEqual(Object.keys(PAYMENT_CATALOG), ['prebuilt', 'custom']);
  for (const product of Object.values(PAYMENT_CATALOG)) {
    assert.equal(product.unitAmountUsd, null);
    assert.equal(product.pricingMode, 'quote');
  }
  const page = fs.readFileSync('index.html', 'utf8');
  assert.deepEqual([...page.matchAll(/data-service-id="([^"]+)"/g)].map(m => m[1]), ['prebuilt', 'custom']);
  assert.doesNotMatch(page, /\$(?:19|69|490)(?:\D|$)|Parche de Ciberseguridad|Plan Flash|Plan Pro/);
  assert.match(page, /requestAgentQuote\('prebuilt'\)/);
  assert.match(page, /requestAgentQuote\('custom'\)/);
});

test('retired and unpriced products fail before ledger or provider calls, despite caller amount', async () => {
  const saved = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls++; throw new Error('Unexpected financial side effect'); };
  try {
    for (const [productId, expectedStatus, expectedCode] of [
      ['flash', 410, 'PRODUCT_RETIRED'], ['pro', 410, 'PRODUCT_RETIRED'],
      ['enterprise', 410, 'PRODUCT_RETIRED'], ['prebuilt', 409, 'APPROVED_QUOTE_REQUIRED'],
      ['custom', 409, 'APPROVED_QUOTE_REQUIRED']
    ]) {
      const req = { method: 'POST', url: '/api/payments?action=create', headers: { host: 'localhost', 'x-forwarded-for': 'catalog-' + productId },
        async *[Symbol.asyncIterator]() { yield Buffer.from(JSON.stringify({ provider: 'WOMPI_SV', productId, quantity: 1, customerEmail: 'test@example.com', amountUsd: 1 })); }
      };
      const res = { setHeader() {}, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
      await handler(req, res);
      assert.equal(res.code, expectedStatus);
      assert.equal(res.body.code, expectedCode);
    }
    assert.equal(calls, 0);
  } finally { globalThis.fetch = saved; }
});
