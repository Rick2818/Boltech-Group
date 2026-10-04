export const PAYMENT_ENVIRONMENTS = new Set(['production', 'sandbox']);

// Current offer confirmed by Ricardo on 2026-10-04. Prices require an approved quote.
export const PAYMENT_CATALOG = Object.freeze({
  prebuilt: Object.freeze({ id: 'prebuilt', name: 'Agentes preelaborados', pricingMode: 'quote', unitAmountUsd: null, minQuantity: 1, maxQuantity: 1, recurring: false }),
  custom: Object.freeze({ id: 'custom', name: 'Custom agents — Agentes a medida', pricingMode: 'quote', unitAmountUsd: null, minQuantity: 1, maxQuantity: 1, recurring: false })
});
export const RETIRED_PRODUCT_IDS = Object.freeze(['flash', 'pro', 'enterprise']);

export function getPaymentEnvironment() {
  const raw = String(process.env.PAYMENT_ENV || '').trim().toLowerCase();
  if (!raw) {
    const err = new Error('PAYMENT_ENV is required and must be explicitly set to production or sandbox.');
    err.code = 'PAYMENT_ENV_NOT_CONFIGURED';
    err.statusCode = 503;
    throw err;
  }
  if (!PAYMENT_ENVIRONMENTS.has(raw)) {
    const err = new Error('PAYMENT_ENV must be production or sandbox.');
    err.code = 'PAYMENT_ENV_INVALID';
    err.statusCode = 503;
    throw err;
  }
  return raw;
}

export function resolveProductPricing(productId, quantity = 1) {
  const id = String(productId || '').trim();
  if (RETIRED_PRODUCT_IDS.includes(id)) {
    const err = new Error('This product is no longer offered. Request a quote for prebuilt or custom agents.');
    err.code = 'PRODUCT_RETIRED';
    err.statusCode = 410;
    throw err;
  }
  if (!Object.hasOwn(PAYMENT_CATALOG, id)) {
    const err = new Error('Unknown productId.');
    err.code = 'UNKNOWN_PRODUCT';
    err.statusCode = 400;
    throw err;
  }
  const parsedQuantity = Number(quantity);
  if (!Number.isInteger(parsedQuantity) || parsedQuantity !== 1) {
    const err = new Error('quantity must be 1 for a scoped agent quote.');
    err.code = 'INVALID_QUANTITY';
    err.statusCode = 400;
    throw err;
  }
  // Never accept a browser amount or reuse an obsolete subscription price.
  const err = new Error('An approved quote is required before creating a payment order.');
  err.code = 'APPROVED_QUOTE_REQUIRED';
  err.statusCode = 409;
  throw err;
}
