import crypto from 'node:crypto';
import {
  getOrderByOrderId,
  getOrderByProviderInvoiceId,
  getEventByFingerprint,
  upsertPaymentEvent,
  updateOrder
} from './payment_store.js';
import {
  getPaymentEnvironment
} from './payment_catalog.js';
import {
  verifyWompiWebhookSignature,
  verifyWompiRedirectHash,
  getWompiTransaction,
  summarizeWompiTransaction,
  verifyStrikeWebhookSignature,
  getStrikeInvoice,
  summarizeStrikeInvoice
} from './payment_providers.js';
import { fulfillPaidOrder } from './payment_fulfillment.js';

function hashText(value) {
  return crypto.createHash('sha256').update(String(value || ''), 'utf8').digest('hex');
}

function sameAmount(a, b) {
  return Math.abs(Number(a) - Number(b)) < 0.005;
}

function safeEvidence(value) {
  return JSON.stringify(value, null, 2).slice(0, 90000);
}

function wompiWebhookParts(payload) {
  return {
    transactionId: payload?.IdTransaccion || payload?.idTransaccion || '',
    orderId:
      payload?.EnlacePago?.IdentificadorEnlaceComercio ||
      payload?.enlacePago?.identificadorEnlaceComercio ||
      '',
    linkId: String(payload?.EnlacePago?.Id || payload?.enlacePago?.id || ''),
    amount: Number(payload?.Monto ?? payload?.monto ?? 0),
    productive: Boolean(payload?.EsProductiva ?? payload?.esProductiva ?? payload?.EsReal ?? payload?.esReal),
    result: payload?.ResultadoTransaccion || payload?.resultadoTransaccion || ''
  };
}

async function rejectEvent({ fingerprint, provider, result, evidence, orderId = '', providerEventId = '', providerTransactionId = '', signatureValid = false }) {
  await upsertPaymentEvent({
    fingerprint,
    provider,
    orderId,
    providerEventId,
    providerTransactionId,
    signatureValid,
    processed: true,
    result,
    evidence,
    processedAt: new Date().toISOString()
  });
}

export async function reconcileWompiWebhook({ rawBody, signature }) {
  const fingerprint = 'WOMPI:' + hashText(rawBody);
  const existing = await getEventByFingerprint(fingerprint);
  if (existing?.processed) return { ok: true, duplicate: true, result: existing.result };

  if (!verifyWompiWebhookSignature(rawBody, signature)) {
    await rejectEvent({
      fingerprint,
      provider: 'WOMPI_SV',
      result: 'REJECTED_SIGNATURE',
      evidence: 'Invalid wompi_hash.'
    });
    const err = new Error('Invalid Wompi webhook signature.');
    err.code = 'INVALID_WEBHOOK_SIGNATURE';
    err.statusCode = 401;
    throw err;
  }

  let payload;
  try { payload = JSON.parse(rawBody); }
  catch {
    await rejectEvent({
      fingerprint,
      provider: 'WOMPI_SV',
      result: 'ERROR',
      signatureValid: true,
      evidence: 'Signed Wompi payload was not valid JSON.'
    });
    const err = new Error('Invalid Wompi webhook JSON.');
    err.statusCode = 400;
    throw err;
  }

  const parts = wompiWebhookParts(payload);
  if (!parts.orderId || !parts.transactionId) {
    await rejectEvent({
      fingerprint,
      provider: 'WOMPI_SV',
      result: 'MISMATCH',
      signatureValid: true,
      orderId: parts.orderId,
      providerTransactionId: parts.transactionId,
      evidence: safeEvidence({ reason: 'Missing orderId or transactionId in signed Wompi webhook.' })
    });
    return { ok: true, accepted: false, reason: 'MISSING_REFERENCE' };
  }

  const order = await getOrderByOrderId(parts.orderId);
  if (!order || order.provider !== 'WOMPI_SV') {
    await rejectEvent({
      fingerprint,
      provider: 'WOMPI_SV',
      result: 'MISMATCH',
      signatureValid: true,
      orderId: parts.orderId,
      providerTransactionId: parts.transactionId,
      evidence: safeEvidence({ reason: 'Order not found or wrong provider.' })
    });
    return { ok: true, accepted: false, reason: 'ORDER_NOT_FOUND' };
  }

  const txRaw = await getWompiTransaction(parts.transactionId);
  const tx = summarizeWompiTransaction(txRaw);
  const env = getPaymentEnvironment();

  const expectedProductive = env === 'production';
  const checks = {
    approved: tx.approved === true,
    environment: tx.real === expectedProductive && parts.productive === expectedProductive,
    amountProvider: sameAmount(tx.amount, order.expectedAmountUsd),
    amountWebhook: sameAmount(parts.amount, order.expectedAmountUsd)
  };

  if (!Object.values(checks).every(Boolean)) {
    await rejectEvent({
      fingerprint,
      provider: 'WOMPI_SV',
      result: 'MISMATCH',
      signatureValid: true,
      orderId: order.orderId,
      providerTransactionId: parts.transactionId,
      evidence: safeEvidence({ checks, webhook: parts, provider: tx })
    });
    await updateOrder(order.orderId, {
      lastVerifiedAt: new Date().toISOString(),
      providerEvidence: safeEvidence({ checks, provider: tx })
    });
    return { ok: true, accepted: false, reason: 'PROVIDER_MISMATCH' };
  }

  const now = new Date().toISOString();
  const paidOrder = await updateOrder(order.orderId, {
    status: 'PAID',
    providerTransactionId: parts.transactionId,
    providerEvidence: safeEvidence({ provider: tx, webhookFingerprint: fingerprint }),
    webhookEventId: fingerprint,
    paidAt: order.paidAt || now,
    lastVerifiedAt: now,
    fulfillmentStatus: order.fulfillmentStatus === 'COMPLETED' ? 'COMPLETED' : 'READY'
  });

  await upsertPaymentEvent({
    fingerprint,
    provider: 'WOMPI_SV',
    orderId: order.orderId,
    providerTransactionId: parts.transactionId,
    signatureValid: true,
    processed: true,
    result: 'ACCEPTED',
    evidence: safeEvidence({ checks, provider: tx }),
    processedAt: now
  });

  const fulfillment = await fulfillPaidOrder(paidOrder);
  return { ok: true, accepted: true, orderId: order.orderId, fulfillment };
}

export async function reconcileWompiRedirect(params) {
  const orderId = String(params?.identificadorEnlaceComercio || '');
  const transactionId = String(params?.idTransaccion || '');
  const linkId = String(params?.idEnlace || '');
  const amountText = String(params?.monto || '');
  const hash = String(params?.hash || '');
  const fingerprint = 'WOMPI-REDIRECT:' + hashText([orderId, transactionId, linkId, amountText, hash].join('|'));

  if (!verifyWompiRedirectHash({
    identificadorEnlaceComercio: orderId,
    idTransaccion: transactionId,
    idEnlace: linkId,
    monto: amountText,
    hash
  })) {
    await rejectEvent({
      fingerprint,
      provider: 'WOMPI_SV',
      result: 'REJECTED_SIGNATURE',
      orderId,
      providerTransactionId: transactionId,
      evidence: 'Invalid Wompi redirect hash.'
    });
    const err = new Error('Invalid Wompi redirect hash.');
    err.code = 'INVALID_REDIRECT_HASH';
    err.statusCode = 401;
    throw err;
  }

  const existing = await getEventByFingerprint(fingerprint);
  if (existing?.processed) return { ok: true, duplicate: true, orderId };

  const order = await getOrderByOrderId(orderId);
  if (!order || order.provider !== 'WOMPI_SV') {
    await rejectEvent({
      fingerprint,
      provider: 'WOMPI_SV',
      result: 'MISMATCH',
      signatureValid: true,
      orderId,
      providerTransactionId: transactionId,
      evidence: 'Redirect references an unknown Wompi order.'
    });
    return { ok: false, reason: 'ORDER_NOT_FOUND' };
  }

  if (order.providerInvoiceId && String(order.providerInvoiceId) !== linkId) {
    await rejectEvent({
      fingerprint,
      provider: 'WOMPI_SV',
      result: 'MISMATCH',
      signatureValid: true,
      orderId,
      providerTransactionId: transactionId,
      evidence: 'Wompi idEnlace does not match the order.'
    });
    return { ok: false, reason: 'LINK_MISMATCH' };
  }

  const txRaw = await getWompiTransaction(transactionId);
  const tx = summarizeWompiTransaction(txRaw);
  const env = getPaymentEnvironment();
  const checks = {
    approved: tx.approved === true,
    environment: tx.real === (env === 'production'),
    amountRedirect: sameAmount(Number(amountText), order.expectedAmountUsd),
    amountProvider: sameAmount(tx.amount, order.expectedAmountUsd)
  };

  if (!Object.values(checks).every(Boolean)) {
    await rejectEvent({
      fingerprint,
      provider: 'WOMPI_SV',
      result: 'MISMATCH',
      signatureValid: true,
      orderId,
      providerTransactionId: transactionId,
      evidence: safeEvidence({ checks, provider: tx })
    });
    return { ok: false, reason: 'PROVIDER_MISMATCH' };
  }

  const now = new Date().toISOString();
  const paidOrder = await updateOrder(order.orderId, {
    status: 'PAID',
    providerTransactionId: transactionId,
    providerEvidence: safeEvidence({ provider: tx, redirectFingerprint: fingerprint }),
    webhookEventId: order.webhookEventId || fingerprint,
    paidAt: order.paidAt || now,
    lastVerifiedAt: now,
    fulfillmentStatus: order.fulfillmentStatus === 'COMPLETED' ? 'COMPLETED' : 'READY'
  });

  await upsertPaymentEvent({
    fingerprint,
    provider: 'WOMPI_SV',
    orderId,
    providerTransactionId: transactionId,
    signatureValid: true,
    processed: true,
    result: 'ACCEPTED',
    evidence: safeEvidence({ checks, provider: tx, source: 'verified_redirect' }),
    processedAt: now
  });

  const fulfillment = await fulfillPaidOrder(paidOrder);
  return { ok: true, accepted: true, orderId, fulfillment };
}

export async function reconcileStrikeWebhook({ rawBody, signature }) {
  let payload;
  const rawFingerprint = hashText(rawBody);

  if (!verifyStrikeWebhookSignature(rawBody, signature)) {
    const fingerprint = 'STRIKE:' + rawFingerprint;
    await rejectEvent({
      fingerprint,
      provider: 'STRIKE',
      result: 'REJECTED_SIGNATURE',
      evidence: 'Invalid X-Webhook-Signature.'
    });
    const err = new Error('Invalid Strike webhook signature.');
    err.code = 'INVALID_WEBHOOK_SIGNATURE';
    err.statusCode = 401;
    throw err;
  }

  try { payload = JSON.parse(rawBody); }
  catch {
    const fingerprint = 'STRIKE:' + rawFingerprint;
    await rejectEvent({
      fingerprint,
      provider: 'STRIKE',
      result: 'ERROR',
      signatureValid: true,
      evidence: 'Signed Strike payload was not valid JSON.'
    });
    const err = new Error('Invalid Strike webhook JSON.');
    err.statusCode = 400;
    throw err;
  }

  const providerEventId = String(payload?.id || '');
  const fingerprint = 'STRIKE:' + (providerEventId || rawFingerprint);
  const existing = await getEventByFingerprint(fingerprint);
  if (existing?.processed) return { ok: true, duplicate: true, result: existing.result };

  if (payload?.eventType !== 'invoice.updated' && payload?.eventType !== 'invoice.created') {
    await upsertPaymentEvent({
      fingerprint,
      provider: 'STRIKE',
      providerEventId,
      signatureValid: true,
      processed: true,
      result: 'ACCEPTED',
      evidence: safeEvidence({ ignoredEventType: payload?.eventType || '' }),
      processedAt: new Date().toISOString()
    });
    return { ok: true, ignored: true };
  }

  const invoiceId = String(payload?.data?.entityId || '');
  const order = await getOrderByProviderInvoiceId(invoiceId);
  if (!order || order.provider !== 'STRIKE') {
    await rejectEvent({
      fingerprint,
      provider: 'STRIKE',
      result: 'MISMATCH',
      signatureValid: true,
      providerEventId,
      evidence: safeEvidence({ reason: 'Invoice is not attached to a Boltech Strike order.', invoiceId })
    });
    return { ok: true, accepted: false, reason: 'ORDER_NOT_FOUND' };
  }

  const invoiceRaw = await getStrikeInvoice(invoiceId);
  const invoice = summarizeStrikeInvoice(invoiceRaw);
  const checks = {
    correlation: invoice.correlationId === order.orderId,
    amount: sameAmount(invoice.amount, order.expectedAmountUsd),
    currency: invoice.currency === order.currency
  };

  if (!Object.values(checks).every(Boolean)) {
    await rejectEvent({
      fingerprint,
      provider: 'STRIKE',
      result: 'MISMATCH',
      signatureValid: true,
      orderId: order.orderId,
      providerEventId,
      evidence: safeEvidence({ checks, invoice })
    });
    await updateOrder(order.orderId, {
      lastVerifiedAt: new Date().toISOString(),
      providerEvidence: safeEvidence({ checks, invoice })
    });
    return { ok: true, accepted: false, reason: 'PROVIDER_MISMATCH' };
  }

  if (invoice.state !== 'PAID') {
    const now = new Date().toISOString();
    await updateOrder(order.orderId, {
      status: invoice.state === 'CANCELLED' ? 'CANCELED' : 'PROVIDER_PENDING',
      lastVerifiedAt: now,
      providerEvidence: safeEvidence({ invoice })
    });
    await upsertPaymentEvent({
      fingerprint,
      provider: 'STRIKE',
      orderId: order.orderId,
      providerEventId,
      signatureValid: true,
      processed: true,
      result: 'ACCEPTED',
      evidence: safeEvidence({ invoice, paymentFinal: false }),
      processedAt: now
    });
    return { ok: true, accepted: true, paid: false, state: invoice.state };
  }

  const now = new Date().toISOString();
  const providerTransactionId = invoice.completedTransactionIds?.[0] || '';
  const paidOrder = await updateOrder(order.orderId, {
    status: 'PAID',
    providerTransactionId,
    providerEvidence: safeEvidence({ invoice }),
    webhookEventId: providerEventId || fingerprint,
    paidAt: order.paidAt || now,
    lastVerifiedAt: now,
    fulfillmentStatus: order.fulfillmentStatus === 'COMPLETED' ? 'COMPLETED' : 'READY'
  });

  await upsertPaymentEvent({
    fingerprint,
    provider: 'STRIKE',
    orderId: order.orderId,
    providerEventId,
    providerTransactionId,
    signatureValid: true,
    processed: true,
    result: 'ACCEPTED',
    evidence: safeEvidence({ checks, invoice, paymentFinal: true }),
    processedAt: now
  });

  const fulfillment = await fulfillPaidOrder(paidOrder);
  return { ok: true, accepted: true, paid: true, orderId: order.orderId, fulfillment };
}

export async function reconcileStrikeOrder(order) {
  if (!order || order.provider !== 'STRIKE' || !order.providerInvoiceId) return order;
  if (order.status === 'PAID') return order;

  const invoiceRaw = await getStrikeInvoice(order.providerInvoiceId);
  const invoice = summarizeStrikeInvoice(invoiceRaw);
  const checks = {
    correlation: invoice.correlationId === order.orderId,
    amount: sameAmount(invoice.amount, order.expectedAmountUsd),
    currency: invoice.currency === order.currency
  };

  const now = new Date().toISOString();
  if (!Object.values(checks).every(Boolean)) {
    return updateOrder(order.orderId, {
      lastVerifiedAt: now,
      providerEvidence: safeEvidence({ checks, invoice })
    });
  }

  if (invoice.state !== 'PAID') {
    return updateOrder(order.orderId, {
      status: invoice.state === 'CANCELLED' ? 'CANCELED' : 'PROVIDER_PENDING',
      lastVerifiedAt: now,
      providerEvidence: safeEvidence({ invoice })
    });
  }

  const paidOrder = await updateOrder(order.orderId, {
    status: 'PAID',
    providerTransactionId: invoice.completedTransactionIds?.[0] || '',
    providerEvidence: safeEvidence({ invoice, source: 'server_poll' }),
    paidAt: now,
    lastVerifiedAt: now,
    fulfillmentStatus: 'READY'
  });
  await fulfillPaidOrder(paidOrder);
  return getOrderByOrderId(order.orderId);
}
