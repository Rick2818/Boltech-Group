import crypto from 'node:crypto';
import { checkRateLimit, resolveCorsOrigin } from '../lib/fiduciary_core.js';
import { resolveProductPricing, getPaymentEnvironment } from '../lib/payment_catalog.js';
import {
  createOrder,
  getOrderByOrderId,
  getPaymentStoreReadiness,
  updateOrder
} from '../lib/payment_store.js';
import {
  createWompiPaymentLink,
  createStrikeInvoiceAndQuote,
  getWompiReadiness,
  getStrikeReadiness
} from '../lib/payment_providers.js';
import {
  reconcileStrikeOrder,
  reconcileWompiRedirect
} from '../lib/payment_reconciliation.js';

function json(res, status, payload) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  return res.status(status).json(payload);
}

function clean(value, max = 500) {
  return value == null ? '' : String(value).trim().slice(0, max);
}

function getIp(req) {
  return clean(String(req.headers?.['x-forwarded-for'] || '').split(',')[0] || req.headers?.['x-real-ip'] || req.socket?.remoteAddress || 'unknown', 100);
}

function validEmail(value) {
  const email = clean(value, 320);
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : '';
}

function safeDomain(value) {
  const d = clean(value, 253).toLowerCase();
  if (!d) return '';
  return /^[a-z0-9.-]+$/.test(d) ? d : '';
}

function actionOf(req) {
  try {
    const url = new URL(req.url, `https://${req.headers.host || 'localhost'}`);
    return clean(url.searchParams.get('action'), 80);
  } catch {
    return '';
  }
}

function statusPayload(order) {
  if (!order) return null;
  return {
    orderId: order.orderId,
    provider: order.provider,
    environment: order.environment,
    status: order.status,
    productId: order.productId,
    quantity: order.quantity,
    expectedAmountUsd: order.expectedAmountUsd,
    currency: order.currency,
    providerInvoiceId: order.providerInvoiceId || null,
    providerCheckoutUrl: order.providerCheckoutUrl || null,
    fulfillmentStatus: order.fulfillmentStatus,
    createdAt: order.createdAt,
    paidAt: order.paidAt || null,
    expiresAt: order.expiresAt || null,
    lastVerifiedAt: order.lastVerifiedAt || null
  };
}

function applyCors(req, res) {
  const origin = req.headers?.origin;
  const allowed = resolveCorsOrigin(origin, process.env.NODE_ENV !== 'production');
  if (origin && !allowed) return false;
  if (allowed) {
    res.setHeader('Access-Control-Allow-Origin', allowed);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  return true;
}

export default async function handler(req, res) {
  if (!applyCors(req, res)) return json(res, 403, { success: false, error: 'Origin not allowed.' });
  if (req.method === 'OPTIONS') return res.status(204).end();

  const ip = getIp(req);
  const rate = checkRateLimit('payments:' + ip, 12, 60000);
  if (!rate.allowed) {
    res.setHeader('Retry-After', String(rate.remainingSeconds));
    return json(res, 429, { success: false, error: 'Too many payment requests.' });
  }

  const action = actionOf(req);

  try {
    if (req.method === 'GET' && action === 'readiness') {
      return json(res, 200, {
        success: true,
        environment: getPaymentEnvironment(),
        store: getPaymentStoreReadiness(),
        wompi: getWompiReadiness(),
        strike: getStrikeReadiness(),
        policy: 'PROVIDER_VERIFICATION_REQUIRED'
      });
    }

    if (req.method === 'GET' && action === 'status') {
      const url = new URL(req.url, `https://${req.headers.host || 'localhost'}`);
      const orderId = clean(url.searchParams.get('orderId'), 80);
      if (!orderId) return json(res, 400, { success: false, error: 'orderId is required.' });

      let order = await getOrderByOrderId(orderId);
      if (!order) return json(res, 404, { success: false, error: 'Order not found.' });

      // Strike can be safely reconciled by querying the provider if a webhook was delayed.
      if (order.provider === 'STRIKE' && !['PAID', 'CANCELED', 'EXPIRED', 'REFUNDED'].includes(order.status)) {
        order = await reconcileStrikeOrder(order);
      }

      return json(res, 200, { success: true, order: statusPayload(order) });
    }

    if (req.method === 'POST' && action === 'create') {
      const body = req.body && typeof req.body === 'object' ? req.body : {};
      const provider = clean(body.provider, 30).toUpperCase();
      if (!['WOMPI_SV', 'STRIKE'].includes(provider)) {
        return json(res, 400, { success: false, error: 'provider must be WOMPI_SV or STRIKE.' });
      }

      const customerEmail = validEmail(body.customerEmail);
      if (!customerEmail) return json(res, 400, { success: false, error: 'A valid customerEmail is required.' });

      const pricing = resolveProductPricing(body.productId, body.quantity ?? 1);
      const environment = getPaymentEnvironment();
      const orderId = crypto.randomUUID();
      const domain = safeDomain(body.domain);

      let order = await createOrder({
        orderId,
        provider,
        environment,
        status: 'CREATED',
        productId: pricing.productId,
        quantity: pricing.quantity,
        expectedAmountUsd: pricing.amountUsd,
        currency: pricing.currency,
        customerEmail,
        domain,
        fulfillmentStatus: 'NOT_READY',
        notes: 'Amount derived server-side from PAYMENT_CATALOG.'
      });

      try {
        if (provider === 'WOMPI_SV') {
          const wompi = await createWompiPaymentLink({
            ...order,
            productName: pricing.productName
          });
          order = await updateOrder(orderId, {
            status: 'PENDING_PAYMENT',
            providerInvoiceId: wompi.providerInvoiceId,
            providerCheckoutUrl: wompi.checkoutUrl,
            expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
            providerEvidence: JSON.stringify({
              linkCreated: true,
              productive: wompi.productive,
              qrUrlPresent: Boolean(wompi.qrUrl)
            })
          });

          return json(res, 201, {
            success: true,
            order: statusPayload(order),
            checkout: {
              type: 'HOSTED_URL',
              url: wompi.checkoutUrl,
              qrUrl: wompi.qrUrl || null
            }
          });
        }

        const strike = await createStrikeInvoiceAndQuote({
          ...order,
          productName: pricing.productName
        });
        order = await updateOrder(orderId, {
          status: 'PENDING_PAYMENT',
          providerInvoiceId: strike.providerInvoiceId,
          expiresAt: strike.expiresAt || undefined,
          providerEvidence: JSON.stringify({
            invoiceCreated: true,
            quoteId: strike.quoteId || null
          })
        });

        return json(res, 201, {
          success: true,
          order: statusPayload(order),
          checkout: {
            type: 'BOLT11',
            bolt11: strike.bolt11,
            expiresAt: strike.expiresAt || null
          }
        });
      } catch (providerError) {
        await updateOrder(orderId, {
          status: 'FAILED',
          notes: `Provider setup failed closed: ${clean(providerError?.message, 700)}`
        });
        throw providerError;
      }
    }

    if (req.method === 'POST' && action === 'wompi-return') {
      const body = req.body && typeof req.body === 'object' ? req.body : {};
      const result = await reconcileWompiRedirect({
        identificadorEnlaceComercio: clean(body.identificadorEnlaceComercio, 500),
        idTransaccion: clean(body.idTransaccion, 100),
        idEnlace: clean(body.idEnlace, 100),
        monto: clean(body.monto, 50),
        hash: clean(body.hash, 200)
      });
      return json(res, result.ok ? 200 : 422, { success: Boolean(result.ok), ...result });
    }

    return json(res, 404, { success: false, error: 'Payment route not found.' });
  } catch (error) {
    console.error('[PAYMENTS API]', error?.code || error?.name || 'ERROR', clean(error?.message, 800));
    const status = Number(error?.statusCode) || 500;
    return json(res, status, {
      success: false,
      error: status >= 500 ? 'Payment service is temporarily unavailable.' : clean(error?.message, 500),
      code: error?.code || 'PAYMENT_ERROR'
    });
  }
}
