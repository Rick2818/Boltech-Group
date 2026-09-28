export const PAYMENT_ENVIRONMENTS = new Set(['production', 'sandbox']);

export const PAYMENT_CATALOG = Object.freeze({
  flash: Object.freeze({
    id: 'flash',
    name: 'Parche de Ciberseguridad',
    unitAmountUsd: 19,
    pricingMode: 'per_unit',
    minQuantity: 1,
    maxQuantity: 25,
    recurring: false
  }),
  pro: Object.freeze({
    id: 'pro',
    name: 'Centinela Autónomo 24/7',
    unitAmountUsd: 69,
    pricingMode: 'fixed',
    minQuantity: 1,
    maxQuantity: 1,
    recurring: true
  }),
  enterprise: Object.freeze({
    id: 'enterprise',
    name: 'Agente Autónomo a la Medida',
    unitAmountUsd: 490,
    pricingMode: 'fixed',
    minQuantity: 1,
    maxQuantity: 1,
    recurring: true
  })
});

export function getPaymentEnvironment() {
  const value = String(process.env.PAYMENT_ENV || 'production').trim().toLowerCase();
  if (!PAYMENT_ENVIRONMENTS.has(value)) {
    throw new Error('PAYMENT_ENV must be production or sandbox.');
  }
  return value;
}

export function resolveProductPricing(productId, quantity = 1) {
  const product = PAYMENT_CATALOG[String(productId || '').trim()];
  if (!product) {
    const err = new Error('Unknown productId.');
    err.code = 'UNKNOWN_PRODUCT';
    throw err;
  }

  const parsedQuantity = Number(quantity);
  if (!Number.isInteger(parsedQuantity)) {
    const err = new Error('quantity must be an integer.');
    err.code = 'INVALID_QUANTITY';
    throw err;
  }

  const effectiveQuantity = product.pricingMode === 'fixed' ? 1 : parsedQuantity;
  if (effectiveQuantity < product.minQuantity || effectiveQuantity > product.maxQuantity) {
    const err = new Error(`quantity must be between ${product.minQuantity} and ${product.maxQuantity}.`);
    err.code = 'INVALID_QUANTITY';
    throw err;
  }

  const amountUsd = Math.round(product.unitAmountUsd * effectiveQuantity * 100) / 100;

  return {
    productId: product.id,
    productName: product.name,
    quantity: effectiveQuantity,
    amountUsd,
    currency: 'USD',
    recurring: product.recurring
  };
}
