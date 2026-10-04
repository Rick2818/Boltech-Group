/**
 * Boltech Group — deprecated billing compatibility module.
 *
 * This module is intentionally non-operational. Real payment creation,
 * provider verification, settlement and fulfillment are handled by the
 * verified payment architecture under lib/payment_* and api/payments.js.
 */

import { PAYMENT_CATALOG } from './payment_catalog.js';
export const BOLTECH_PRICING_CATALOG = Object.freeze(Object.fromEntries(
  Object.values(PAYMENT_CATALOG).map(p => [p.id, Object.freeze({ id: p.id, name: p.name, amountUSD: null, type: 'quote' })])
));

function retired() {
  const err = new Error('Deprecated billing sentinel disabled. Use the provider-verified payment API.');
  err.code = 'DEPRECATED_BILLING_SENTINEL_DISABLED';
  err.statusCode = 410;
  throw err;
}

export function createCheckoutIntent() { return retired(); }
export async function createStripeCheckoutSession() { return retired(); }
export async function verifyAndSettleLightningPayment() { return retired(); }
export function isAlreadySettled() { return false; }
export async function handleStripeWebhookEvent() { return retired(); }
export async function executeReActBillingLoop() { return retired(); }

