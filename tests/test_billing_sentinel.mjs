import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BOLTECH_PRICING_CATALOG,
  createCheckoutIntent,
  createStripeCheckoutSession,
  verifyAndSettleLightningPayment,
  executeReActBillingLoop,
  isAlreadySettled
} from '../lib/billing_settlement_sentinel.js';

test('legacy billing cannot manufacture a paid transaction', async () => {
  assert.deepEqual(Object.keys(BOLTECH_PRICING_CATALOG), ['prebuilt', 'custom']);
  assert.equal(BOLTECH_PRICING_CATALOG.prebuilt.amountUSD, null);
  assert.throws(() => createCheckoutIntent(), { code: 'DEPRECATED_BILLING_SENTINEL_DISABLED' });
  await assert.rejects(createStripeCheckoutSession(), { code: 'DEPRECATED_BILLING_SENTINEL_DISABLED' });
  await assert.rejects(verifyAndSettleLightningPayment(), { code: 'DEPRECATED_BILLING_SENTINEL_DISABLED' });
  await assert.rejects(executeReActBillingLoop(), { code: 'DEPRECATED_BILLING_SENTINEL_DISABLED' });
  assert.equal(isAlreadySettled('legacy-order'), false);
});
