/**
 * Boltech Group — deprecated billing compatibility module.
 *
 * This module is intentionally non-operational. Real payment creation,
 * provider verification, settlement and fulfillment are handled by the
 * verified payment architecture under lib/payment_* and api/payments.js.
 */

export const BOLTECH_PRICING_CATALOG = Object.freeze({
  flash: Object.freeze({ id: 'flash', name: 'Parche de Ciberseguridad', amountUSD: 19, type: 'one_time' }),
  pro: Object.freeze({ id: 'pro', name: 'Centinela Autónomo 24/7', amountUSD: 69, type: 'recurring_monthly' }),
  enterprise: Object.freeze({ id: 'enterprise', name: 'Agente Autónomo a la Medida', amountUSD: 490, type: 'recurring_monthly' })
});

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
