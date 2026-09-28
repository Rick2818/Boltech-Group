import crypto from 'node:crypto';
import { getPaymentEnvironment } from './payment_catalog.js';

const WOMPI_AUTH_URL = 'https://id.wompi.sv/connect/token';
const WOMPI_API_BASE = 'https://api.wompi.sv';
const STRIKE_PROD_BASE = 'https://api.strike.me/v1';
const STRIKE_SANDBOX_BASE = 'https://api.dev.strike.me/v1';

let wompiTokenCache = null;

function configurationError(message, code = 'PAYMENT_PROVIDER_NOT_CONFIGURED') {
  const err = new Error(message);
  err.code = code;
  err.statusCode = 503;
  return err;
}

async function readJsonResponse(response, provider) {
  const text = await response.text();
  let payload = {};
  if (text) {
    try { payload = JSON.parse(text); }
    catch { payload = { raw: text.slice(0, 1000) }; }
  }
  if (!response.ok) {
    const providerMessage =
      payload?.error_description ||
      payload?.message ||
      payload?.error?.message ||
      payload?.error ||
      payload?.raw ||
      `HTTP ${response.status}`;
    const err = new Error(`${provider} request failed: ${String(providerMessage).slice(0, 700)}`);
    err.statusCode = response.status >= 500 ? 502 : 422;
    err.providerStatus = response.status;
    throw err;
  }
  return payload;
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 12000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (error?.name === 'AbortError') {
      const err = new Error('Payment provider request timed out.');
      err.code = 'PROVIDER_TIMEOUT';
      err.statusCode = 504;
      throw err;
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function requireWompiCredentials() {
  const appId = String(process.env.WOMPI_APP_ID || '').trim();
  const apiSecret = String(process.env.WOMPI_API_SECRET || '').trim();
  if (!appId || !apiSecret) {
    throw configurationError('WOMPI_APP_ID and WOMPI_API_SECRET are required for Wompi El Salvador.');
  }
  return { appId, apiSecret };
}

export function getWompiReadiness() {
  return {
    configured: Boolean(String(process.env.WOMPI_APP_ID || '').trim() && String(process.env.WOMPI_API_SECRET || '').trim()),
    environment: getPaymentEnvironment()
  };
}

async function getWompiAccessToken() {
  const { appId, apiSecret } = requireWompiCredentials();
  const now = Date.now();
  if (wompiTokenCache && wompiTokenCache.expiresAt > now + 30000) {
    return wompiTokenCache.token;
  }

  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: appId,
    client_secret: apiSecret,
    audience: 'wompi_api'
  });

  const response = await fetchWithTimeout(WOMPI_AUTH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json'
    },
    body: body.toString()
  });

  const payload = await readJsonResponse(response, 'Wompi auth');
  const token = String(payload.access_token || '').trim();
  if (!token) throw configurationError('Wompi auth returned no access_token.', 'WOMPI_AUTH_INVALID');

  const expiresInSec = Math.max(60, Number(payload.expires_in || 300));
  wompiTokenCache = { token, expiresAt: now + expiresInSec * 1000 };
  return token;
}

async function wompiRequest(path, { method = 'GET', body = null } = {}) {
  const token = await getWompiAccessToken();
  const response = await fetchWithTimeout(WOMPI_API_BASE + path, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      'Content-Type': 'application/json'
    },
    body: body ? JSON.stringify(body) : undefined
  });
  return readJsonResponse(response, 'Wompi');
}

export async function createWompiPaymentLink(order) {
  const environment = getPaymentEnvironment();
  const site = 'https://boltech-group.vercel.app';

  const payload = {
    identificadorEnlaceComercio: order.orderId,
    monto: order.expectedAmountUsd,
    nombreProducto: order.productName,
    configuracion: {
      urlRedirect: `${site}/?payment_return=wompi&orderId=${encodeURIComponent(order.orderId)}`,
      urlRetorno: site,
      urlWebhook: `${site}/api/payments?action=wompi-webhook`,
      emailsNotificacion: 'ricardo.boltechgroup@gmail.com',
      esMontoEditable: false,
      esCantidadEditable: false,
      cantidadPorDefecto: 1,
      duracionInterfazIntentoMinutos: 30,
      notificarTransaccionCliente: true
    },
    limitesDeUso: {
      cantidadMaximaPagosExitosos: 1,
      cantidadMaximaPagosFallidos: 5
    }
  };

  const result = await wompiRequest('/EnlacePago', { method: 'POST', body: payload });
  const isProductive = Boolean(result.estaProductivo);
  if ((environment === 'production' && !isProductive) || (environment === 'sandbox' && isProductive)) {
    const err = new Error(`Wompi environment mismatch. PAYMENT_ENV=${environment}, estaProductivo=${isProductive}.`);
    err.code = 'WOMPI_ENVIRONMENT_MISMATCH';
    err.statusCode = 503;
    throw err;
  }

  if (!result.idEnlace || !result.urlEnlace) {
    const err = new Error('Wompi did not return idEnlace/urlEnlace.');
    err.code = 'WOMPI_INVALID_LINK_RESPONSE';
    err.statusCode = 502;
    throw err;
  }

  return {
    providerInvoiceId: String(result.idEnlace),
    checkoutUrl: String(result.urlEnlace),
    qrUrl: result.urlQrCodeEnlace ? String(result.urlQrCodeEnlace) : '',
    productive: isProductive
  };
}

export async function getWompiTransaction(transactionId) {
  if (!transactionId) throw new Error('Wompi transactionId is required.');
  return wompiRequest('/TransaccionCompra/' + encodeURIComponent(transactionId));
}

export function verifyWompiWebhookSignature(rawBody, signature) {
  const { apiSecret } = requireWompiCredentials();
  return verifyHmacHex(rawBody, signature, apiSecret);
}

export function verifyWompiRedirectHash({ identificadorEnlaceComercio, idTransaccion, idEnlace, monto, hash }) {
  const { apiSecret } = requireWompiCredentials();
  const content = [
    String(identificadorEnlaceComercio || ''),
    String(idTransaccion || ''),
    String(idEnlace || ''),
    String(monto || '')
  ].join('');
  return verifyHmacHex(content, hash, apiSecret);
}

function strikeConfig() {
  const environment = getPaymentEnvironment();
  if (environment === 'sandbox') {
    const apiKey = String(process.env.STRIKE_SANDBOX_API_KEY || '').trim();
    if (!apiKey) throw configurationError('STRIKE_SANDBOX_API_KEY is required when PAYMENT_ENV=sandbox.');
    return { environment, apiKey, baseUrl: STRIKE_SANDBOX_BASE };
  }
  const apiKey = String(process.env.STRIKE_API_KEY || '').trim();
  if (!apiKey) throw configurationError('STRIKE_API_KEY is required when PAYMENT_ENV=production.');
  return { environment, apiKey, baseUrl: STRIKE_PROD_BASE };
}

export function getStrikeReadiness() {
  const environment = getPaymentEnvironment();
  const configured = environment === 'sandbox'
    ? Boolean(String(process.env.STRIKE_SANDBOX_API_KEY || '').trim())
    : Boolean(String(process.env.STRIKE_API_KEY || '').trim());
  return {
    configured,
    webhookConfigured: Boolean(String(process.env.STRIKE_WEBHOOK_SECRET || '').trim()),
    environment
  };
}

async function strikeRequest(path, { method = 'GET', body = null } = {}) {
  const { apiKey, baseUrl } = strikeConfig();
  const response = await fetchWithTimeout(baseUrl + path, {
    method,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: 'application/json',
      'Content-Type': 'application/json'
    },
    body: body ? JSON.stringify(body) : undefined
  });
  return readJsonResponse(response, 'Strike');
}

export async function createStrikeInvoiceAndQuote(order) {
  const invoice = await strikeRequest('/invoices', {
    method: 'POST',
    body: {
      correlationId: order.orderId,
      description: order.productName.slice(0, 200),
      amount: {
        currency: 'USD',
        amount: Number(order.expectedAmountUsd).toFixed(2)
      }
    }
  });

  if (!invoice.invoiceId) {
    const err = new Error('Strike did not return invoiceId.');
    err.code = 'STRIKE_INVALID_INVOICE_RESPONSE';
    err.statusCode = 502;
    throw err;
  }

  const quote = await strikeRequest('/invoices/' + encodeURIComponent(invoice.invoiceId) + '/quote', {
    method: 'POST',
    body: {}
  });

  if (!quote.lnInvoice) {
    const err = new Error('Strike did not return lnInvoice from quote.');
    err.code = 'STRIKE_INVALID_QUOTE_RESPONSE';
    err.statusCode = 502;
    throw err;
  }

  return {
    providerInvoiceId: String(invoice.invoiceId),
    quoteId: quote.quoteId ? String(quote.quoteId) : '',
    bolt11: String(quote.lnInvoice),
    expiresAt: quote.expiration || '',
    expirationInSec: Number(quote.expirationInSec || 0)
  };
}

export async function getStrikeInvoice(invoiceId) {
  if (!invoiceId) throw new Error('Strike invoiceId is required.');
  return strikeRequest('/invoices/' + encodeURIComponent(invoiceId) + '?includeTransactions=true');
}

export function verifyStrikeWebhookSignature(rawBody, signature) {
  const secret = String(process.env.STRIKE_WEBHOOK_SECRET || '').trim();
  if (!secret) throw configurationError('STRIKE_WEBHOOK_SECRET is required.');
  return verifyHmacHex(rawBody, signature, secret);
}

export function verifyHmacHex(content, providedSignature, secret) {
  const signature = String(providedSignature || '').trim().toLowerCase();
  if (!signature || !/^[a-f0-9]{64}$/.test(signature)) return false;
  const expected = crypto.createHmac('sha256', secret).update(content).digest('hex').toLowerCase();
  const a = Buffer.from(signature, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function summarizeWompiTransaction(tx) {
  return {
    id: tx?.idTransaccion || tx?.IdTransaccion || tx?.id || '',
    approved: Boolean(tx?.esAprobada ?? tx?.EsAprobada),
    real: Boolean(tx?.esReal ?? tx?.EsReal ?? tx?.EsProductiva),
    amount: Number(tx?.monto ?? tx?.Monto ?? 0),
    result: tx?.resultadoTransaccion || tx?.ResultadoTransaccion || '',
    authorizationCode: tx?.codigoAutorizacion || tx?.CodigoAutorizacion || ''
  };
}

export function summarizeStrikeInvoice(invoice) {
  return {
    invoiceId: invoice?.invoiceId || '',
    state: invoice?.state || '',
    amount: Number(invoice?.amount?.amount || 0),
    currency: invoice?.amount?.currency || '',
    correlationId: invoice?.correlationId || '',
    completedTransactionIds: Array.isArray(invoice?.transactions)
      ? invoice.transactions.filter(t => t?.state === 'COMPLETED').map(t => t.transactionId).filter(Boolean)
      : []
  };
}
