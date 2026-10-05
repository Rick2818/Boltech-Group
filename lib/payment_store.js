import { paginationGuard } from './store_pagination.js';
const DEFAULTS = Object.freeze({
  baseId: 'appCQZd0IhBHFoZ9P',
  ordersTableId: 'tbl7j8UvfuOAkbgRB',
  eventsTableId: 'tblcX6MFc9SOiY9cd'
});

function cfg() {
  return {
    token: String(process.env.AIRTABLE_TOKEN || process.env.AIRTABLE_PAT || '').trim(),
    baseId: String(process.env.AIRTABLE_BASE_ID || DEFAULTS.baseId).trim(),
    ordersTableId: String(process.env.AIRTABLE_PAYMENT_ORDERS_TABLE_ID || DEFAULTS.ordersTableId).trim(),
    eventsTableId: String(process.env.AIRTABLE_PAYMENT_EVENTS_TABLE_ID || DEFAULTS.eventsTableId).trim()
  };
}

export function getPaymentStoreReadiness() {
  const c = cfg();
  return {
    configured: Boolean(c.token && c.baseId && c.ordersTableId && c.eventsTableId),
    baseId: c.baseId,
    ordersTableId: c.ordersTableId,
    eventsTableId: c.eventsTableId
  };
}

export function getFulfillmentReadiness() {
  return {
    atomicClaimConfigured: Boolean(String(process.env.UPSTASH_REDIS_REST_URL || '').trim() &&
      String(process.env.UPSTASH_REDIS_REST_TOKEN || '').trim())
  };
}

// Permanent creation claim: uncertain provider outcomes require reconciliation,
// never a second invoice on an automatic retry.
export async function claimPaymentCreation(orderId) {
  const url = String(process.env.UPSTASH_REDIS_REST_URL || '').trim();
  const token = String(process.env.UPSTASH_REDIS_REST_TOKEN || '').trim();
  if (!url || !token) throw new Error('Payment creation claim is not configured.');
  const response = await fetch(url, {
    method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify(['SET', 'boltech:payment:create:' + orderId, 'claimed', 'NX']),
    signal: AbortSignal.timeout(10000)
  });
  const payload = await response.json();
  if (!response.ok || payload.error || !Object.hasOwn(payload, 'result')) throw new Error('Payment creation claim failed.');
  return payload.result === 'OK';
}

function requireCfg() {
  const c = cfg();
  if (!c.token) {
    const err = new Error('AIRTABLE_TOKEN is required.');
    err.code = 'PAYMENT_STORE_NOT_CONFIGURED';
    throw err;
  }
  return c;
}

function escapeFormula(value) {
  return String(value || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

async function request(tableId, { method = 'GET', query = null, body = null, recordId = '' } = {}) {
  const c = requireCfg();
  const suffix = recordId ? '/' + encodeURIComponent(recordId) : '';
  const url = new URL(`https://api.airtable.com/v0/${encodeURIComponent(c.baseId)}/${encodeURIComponent(tableId)}${suffix}`);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
    }
  }

  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${c.token}`,
      'Content-Type': 'application/json'
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15000)
  });

  const text = await response.text();
  let payload = {};
  if (text) {
    try { payload = JSON.parse(text); }
    catch { payload = { raw: text.slice(0, 500) }; }
  }

  if (!response.ok) {
    const message = payload?.error?.message || payload?.error?.type || payload?.raw || `HTTP ${response.status}`;
    const err = new Error(`Airtable payment store request failed: ${message}`);
    err.statusCode = response.status;
    throw err;
  }
  return payload;
}

function orderFromRecord(record) {
  const f = record?.fields || {};
  return {
    recordId: record?.id || '',
    orderId: f['Order ID'] || '',
    provider: f.Provider || '',
    environment: f.Environment || '',
    status: f.Status || '',
    productId: f['Product ID'] || '',
    quantity: Number(f.Quantity || 0),
    expectedAmountUsd: Number(f['Expected Amount USD'] || 0),
    currency: f.Currency || '',
    customerEmail: f['Customer Email'] || '',
    domain: f.Domain || '',
    providerInvoiceId: f['Provider Invoice ID'] || '',
    providerTransactionId: f['Provider Transaction ID'] || '',
    providerCheckoutUrl: f['Provider Checkout URL'] || '',
    providerEvidence: f['Provider Evidence'] || '',
    webhookEventId: f['Webhook Event ID'] || '',
    fulfillmentStatus: f['Fulfillment Status'] || '',
    createdAt: f['Created At'] || '',
    paidAt: f['Paid At'] || '',
    expiresAt: f['Expires At'] || '',
    lastVerifiedAt: f['Last Verified At'] || '',
    notes: f.Notes || ''
  };
}

function eventFromRecord(record) {
  const f = record?.fields || {};
  return {
    recordId: record?.id || '',
    fingerprint: f['Event Fingerprint'] || '',
    provider: f.Provider || '',
    orderId: f['Order ID'] || '',
    providerEventId: f['Provider Event ID'] || '',
    providerTransactionId: f['Provider Transaction ID'] || '',
    signatureValid: Boolean(f['Signature Valid']),
    processed: Boolean(f.Processed),
    result: f.Result || '',
    receivedAt: f['Received At'] || '',
    processedAt: f['Processed At'] || '',
    evidence: f.Evidence || ''
  };
}

export async function getOrderByOrderId(orderId) {
  const c = requireCfg();
  const page = await request(c.ordersTableId, {
    query: {
      maxRecords: 2,
      filterByFormula: `{Order ID}="${escapeFormula(orderId)}"`
    }
  });
  const records = page.records || [];
  if (records.length > 1) {
    const err = new Error('Duplicate Order ID detected in payment ledger.');
    err.code = 'DUPLICATE_ORDER_ID';
    throw err;
  }
  return records[0] ? orderFromRecord(records[0]) : null;
}

// Aggregate only provider-confirmed production orders. Never expose customer or transaction data.
export async function getVerifiedSalesMetrics() {
  const c = requireCfg();
  let offset;
  let paidOrders = 0;
  let cashCollectedUsd = 0;
  const nextPage = paginationGuard();
  do {
    const page = await request(c.ordersTableId, {
      query: {
        pageSize: 100,
        filterByFormula: 'AND({Status}="PAID", {Environment}="production")',
        ...(offset ? { offset } : {})
      }
    });
    offset = nextPage(page);
    for (const record of page.records) {
      const order = orderFromRecord(record);
      if (order.status !== 'PAID' || order.environment !== 'production' ||
          order.productId === 'payment-verification' ||
          !String(order.providerEvidence).trim() || !Number.isFinite(Date.parse(order.paidAt)) ||
          !(order.providerTransactionId || order.providerInvoiceId)) continue;
      if (!Number.isFinite(order.expectedAmountUsd) || order.expectedAmountUsd <= 0) continue;
      paidOrders++;
      cashCollectedUsd += order.expectedAmountUsd;
    }
  } while (offset);
  return { paidOrders, cashCollectedUsd: Math.round(cashCollectedUsd * 100) / 100 };
}

export async function getOrderByProviderInvoiceId(providerInvoiceId) {
  const c = requireCfg();
  if (!providerInvoiceId) return null;
  const page = await request(c.ordersTableId, {
    query: {
      maxRecords: 2,
      filterByFormula: `{Provider Invoice ID}="${escapeFormula(providerInvoiceId)}"`
    }
  });
  const records = page.records || [];
  if (records.length > 1) {
    const err = new Error('Duplicate provider invoice ID detected.');
    err.code = 'DUPLICATE_PROVIDER_INVOICE';
    throw err;
  }
  return records[0] ? orderFromRecord(records[0]) : null;
}

export async function createOrder(input) {
  const c = requireCfg();
  const fields = {
    'Order ID': input.orderId,
    Provider: input.provider,
    Environment: input.environment,
    Status: input.status || 'CREATED',
    'Product ID': input.productId,
    Quantity: input.quantity,
    'Expected Amount USD': input.expectedAmountUsd,
    Currency: input.currency || 'USD',
    'Customer Email': input.customerEmail,
    Domain: input.domain || undefined,
    'Provider Invoice ID': input.providerInvoiceId || undefined,
    'Provider Transaction ID': input.providerTransactionId || undefined,
    'Provider Checkout URL': input.providerCheckoutUrl || undefined,
    'Provider Evidence': input.providerEvidence || undefined,
    'Webhook Event ID': input.webhookEventId || undefined,
    'Fulfillment Status': input.fulfillmentStatus || 'NOT_READY',
    'Created At': input.createdAt || new Date().toISOString(),
    'Expires At': input.expiresAt || undefined,
    Notes: input.notes || undefined
  };
  for (const key of Object.keys(fields)) if (fields[key] === undefined || fields[key] === '') delete fields[key];

  const payload = await request(c.ordersTableId, {
    method: 'PATCH',
    body: {
      performUpsert: { fieldsToMergeOn: ['Order ID'] },
      records: [{ fields }],
      typecast: true
    }
  });

  const record = payload.records?.[0];
  if (!record) throw new Error('Payment order upsert returned no record.');
  return {
    ...orderFromRecord(record),
    created: Array.isArray(payload.createdRecords) ? payload.createdRecords.includes(record.id) : undefined
  };
}

export async function updateOrder(orderOrRecordId, fieldsInput) {
  const c = requireCfg();
  let recordId = orderOrRecordId;
  if (!String(recordId || '').startsWith('rec')) {
    const order = await getOrderByOrderId(orderOrRecordId);
    if (!order) {
      const err = new Error('Payment order not found.');
      err.code = 'ORDER_NOT_FOUND';
      throw err;
    }
    recordId = order.recordId;
  }

  const map = {
    provider: 'Provider',
    environment: 'Environment',
    status: 'Status',
    productId: 'Product ID',
    quantity: 'Quantity',
    expectedAmountUsd: 'Expected Amount USD',
    currency: 'Currency',
    customerEmail: 'Customer Email',
    domain: 'Domain',
    providerInvoiceId: 'Provider Invoice ID',
    providerTransactionId: 'Provider Transaction ID',
    providerCheckoutUrl: 'Provider Checkout URL',
    providerEvidence: 'Provider Evidence',
    webhookEventId: 'Webhook Event ID',
    fulfillmentStatus: 'Fulfillment Status',
    createdAt: 'Created At',
    paidAt: 'Paid At',
    expiresAt: 'Expires At',
    lastVerifiedAt: 'Last Verified At',
    notes: 'Notes'
  };

  const fields = {};
  for (const [key, value] of Object.entries(fieldsInput || {})) {
    const target = map[key];
    if (!target || value === undefined) continue;
    fields[target] = value;
  }

  const payload = await request(c.ordersTableId, {
    method: 'PATCH',
    recordId,
    body: { fields, typecast: true }
  });

  return orderFromRecord(payload);
}

export async function getEventByFingerprint(fingerprint) {
  const c = requireCfg();
  const page = await request(c.eventsTableId, {
    query: {
      maxRecords: 2,
      filterByFormula: `{Event Fingerprint}="${escapeFormula(fingerprint)}"`
    }
  });
  const records = page.records || [];
  if (records.length > 1) {
    const err = new Error('Duplicate payment event fingerprint detected.');
    err.code = 'DUPLICATE_PAYMENT_EVENT';
    throw err;
  }
  return records[0] ? eventFromRecord(records[0]) : null;
}

export async function upsertPaymentEvent(input) {
  const c = requireCfg();
  const fields = {
    'Event Fingerprint': input.fingerprint,
    Provider: input.provider,
    'Order ID': input.orderId || undefined,
    'Provider Event ID': input.providerEventId || undefined,
    'Provider Transaction ID': input.providerTransactionId || undefined,
    'Signature Valid': Boolean(input.signatureValid),
    Processed: Boolean(input.processed),
    Result: input.result,
    'Received At': input.receivedAt || new Date().toISOString(),
    'Processed At': input.processedAt || undefined,
    Evidence: input.evidence ? String(input.evidence).slice(0, 90000) : undefined
  };
  for (const key of Object.keys(fields)) if (fields[key] === undefined || fields[key] === '') delete fields[key];

  const payload = await request(c.eventsTableId, {
    method: 'PATCH',
    body: {
      performUpsert: { fieldsToMergeOn: ['Event Fingerprint'] },
      records: [{ fields }],
      typecast: true
    }
  });

  const record = payload.records?.[0];
  if (!record) throw new Error('Payment event upsert returned no record.');
  return {
    ...eventFromRecord(record),
    created: Array.isArray(payload.createdRecords) ? payload.createdRecords.includes(record.id) : undefined
  };
}

export async function claimFulfillment(orderId, provider) {
  const fingerprint = `FULFILL:${orderId}`;
  const url = String(process.env.UPSTASH_REDIS_REST_URL || '').trim().replace(/\/$/, '');
  const token = String(process.env.UPSTASH_REDIS_REST_TOKEN || '').trim();
  if (!url || !token) {
    const err = new Error('Atomic fulfillment requires Upstash Redis.');
    err.code = 'FULFILLMENT_LOCK_NOT_CONFIGURED';
    err.statusCode = 503;
    throw err;
  }
  const response = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(['SET', `boltech:payment:${fingerprint}`, 'claimed', 'NX']),
    signal: AbortSignal.timeout(10000)
  });
  if (!response.ok) throw new Error('Atomic fulfillment claim unavailable.');
  const claim = await response.json();
  if (claim.error) throw new Error('Atomic fulfillment claim failed.');
  if (claim.result !== 'OK') return { claimed: false };

  await upsertPaymentEvent({
    fingerprint,
    provider,
    orderId,
    signatureValid: true,
    processed: true,
    result: 'ACCEPTED',
    evidence: 'Atomic at-most-once notification claim. Failed sends require manual review.',
    receivedAt: new Date().toISOString(),
    processedAt: new Date().toISOString()
  });
  return { claimed: true };
}
