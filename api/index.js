// Boltech production: minimal router. Wompi checkout and signed callbacks
// live in independent api/payments.js and api/wompi-webhook.js, unchanged.
import {allowedLeoWompiIndexRoute} from '../lib/leo_wompi_lean_mode.js';
import {applyStrictBankingHeaders,resolveCorsOrigin} from '../lib/fiduciary_core.js';

const suspended = Object.freeze({
  success: false,
  code: 'BOLTECH_LEO_WOMPI_ONLY',
  error: 'This nonessential API is temporarily disabled to reduce compute usage.'
});

export default async function handler(req,res) {
  applyStrictBankingHeaders(res);
  const allowedOrigin = resolveCorsOrigin(req.headers?.origin, process.env.NODE_ENV !== 'production');
  if (allowedOrigin) {
    res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers',
    'Content-Type, Authorization, X-Strike-Signature, X-Event-Checksum, X-Telegram-Bot-Api-Secret-Token, X-Requested-With');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const url = new URL(req.url, 'https://' + (req.headers?.host || 'localhost'));
    const pathname = url.pathname.replace(/\/$/, '') || '/';
    // Block retired commerce, outreach, marketing, CRM and MCP *before*
    // importing any handlers or SDKs. This is reversible through Git.
    if (!allowedLeoWompiIndexRoute(url)) {
      res.setHeader('Cache-Control', 'no-store');
      return res.status(410).json(suspended);
    }
    if (url.searchParams.get('rodrigo_speech') === '1') {
      const {handleMariaSpeech} = await import('../lib/maria_speech_http.js');
      return handleMariaSpeech(req,res);
    }
    if (url.searchParams.get('leo_channels') === '1' || pathname === '/api/leo-channels') {
      const {handleLeoChannels} = await import('../lib/leo_channels.js');
      return handleLeoChannels(req,res);
    }
    if (url.searchParams.get('leo_meta_whatsapp') === '1' || pathname === '/api/leo-meta-whatsapp') {
      const {handleMetaWhatsApp} = await import('../lib/leo_meta_whatsapp.js');
      return handleMetaWhatsApp(req,res);
    }
    if (url.searchParams.get('leo_sales') === '1') {
      const {leoHttpHandler} = await import('../lib/leo_sales_runtime.js');
      return leoHttpHandler(req,res);
    }
    if (url.searchParams.get('leo_worker') === '1' || pathname === '/api/leo-autonomy-worker') {
      const {handleLeoAutonomyWorker} = await import('../lib/leo_objectives_http.js');
      return handleLeoAutonomyWorker(req,res);
    }
    if (url.searchParams.get('leo_objectives') === '1' || pathname === '/api/leo-objectives') {
      const {handleLeoObjective} = await import('../lib/leo_objectives_http.js');
      return handleLeoObjective(req,res);
    }
    if (req.method === 'GET' && (pathname === '/api/catalog' || pathname.endsWith('/catalog') || url.searchParams.get('catalog') === '1')) {
      // Prices are only indicative; no payment or fulfillment is performed here.
      const {CATALOGO_PRECIOS_USD} = await import('../lib/payment_security.js');
      return res.status(200).json({
        success: true,
        brand: 'Boltech Group / Unblock AI',
        supportEmail: 'soporte@boltech.ai',
        strikeLightningAddress: 'rick2818@strike.me',
        catalog: CATALOGO_PRECIOS_USD
      });
    }
    res.setHeader('Cache-Control', 'no-store');
    return res.status(405).json({error:'METHOD_NOT_ALLOWED'});
  } catch (err) {
    console.error('[LEO ROUTER ERROR]', err?.code || err?.name || 'ERROR');
    return res.status(500).json({error:'Internal Server Error'});
  }
}
