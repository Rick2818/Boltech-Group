import { mkdir, writeFile } from 'node:fs/promises';
import { evaluateCommercialProgress, buildMitAgenda } from './zero_to_first_sale.mjs';

const APOLLO_API_KEY = (process.env.APOLLO_API_KEY || '').trim();
const EXPLEE_API_KEY = (process.env.EXPLEE_API_KEY || '').trim();
const PARTNER_API_TOKEN = (process.env.PARTNER_API_TOKEN || '').trim();
const BOLTECH_URL = (process.env.BOLTECH_URL || 'https://boltech-group.vercel.app').replace(/\/+$/, '');

const report = {
  timestamp: new Date().toISOString(),
  boltech: { online: false, telegramDeepHealth: null },
  explee: { configured: Boolean(EXPLEE_API_KEY), reachable: false, hotLeads: null, note: null },
  apollo: { configured: Boolean(APOLLO_API_KEY), reachable: false, savedContacts: null, note: null },
  commercial: { configured: Boolean(PARTNER_API_TOKEN), reachable: false, metrics: null, note: null },
};

async function jsonFetch(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    let data = null;
    try { data = await res.json(); } catch {}
    return { ok: res.ok, status: res.status, data };
  } finally {
    clearTimeout(timeout);
  }
}

async function checkBoltech() {
  try {
    const health = await jsonFetch(`${BOLTECH_URL}/api/telegram?deep=1`);
    report.boltech.online = health.status === 200;
    report.boltech.telegramDeepHealth = health.data || { status: health.status };
  } catch (err) {
    report.boltech.telegramDeepHealth = { error: err.message };
  }
}

async function checkExplee() {
  if (!EXPLEE_API_KEY) {
    report.explee.note = 'EXPLEE_API_KEY no está configurada en GitHub Secrets.';
    return;
  }
  try {
    const r = await jsonFetch('https://api.explee.com/public/api/v1/autogtm/hot-leads?limit=50', {
      headers: { 'X-API-Key': EXPLEE_API_KEY }
    });
    report.explee.reachable = r.ok;
    report.explee.hotLeads = Array.isArray(r.data?.leads) ? r.data.leads.length : null;
    if (r.ok && report.explee.hotLeads === null) report.explee.note = 'Respuesta sin lista de hot leads verificable.';
    if (!r.ok) report.explee.note = `HTTP ${r.status}`;
  } catch (err) {
    report.explee.note = err.message;
  }
}

async function checkApollo() {
  if (!APOLLO_API_KEY) {
    report.apollo.note = 'APOLLO_API_KEY no está configurada en GitHub Secrets.';
    return;
  }
  try {
    const r = await jsonFetch('https://api.apollo.io/v1/contacts/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': APOLLO_API_KEY
      },
      body: JSON.stringify({ page: 1, per_page: 25 })
    });
    report.apollo.reachable = r.ok;
    report.apollo.savedContacts = Array.isArray(r.data?.contacts) ? r.data.contacts.length : null;
    if (r.ok && report.apollo.savedContacts === null) report.apollo.note = 'Respuesta sin lista de contactos verificable.';
    if (!r.ok) report.apollo.note = `HTTP ${r.status}`;
  } catch (err) {
    report.apollo.note = err.message;
  }
}

async function checkCommercial() {
  if (!PARTNER_API_TOKEN) {
    report.commercial.note = 'PARTNER_API_TOKEN no está configurado en GitHub Secrets.';
    return;
  }
  try {
    const r = await jsonFetch(`${BOLTECH_URL}/api/partners?action=commercial-metrics`, {
      headers: { Authorization: `Bearer ${PARTNER_API_TOKEN}` }
    });
    report.commercial.reachable = r.ok && r.data?.success === true;
    if (report.commercial.reachable &&
        Number.isFinite(r.data?.metrics?.verifiedSales?.cashCollectedUsd)) {
      report.commercial.metrics = r.data.metrics;
    } else {
      report.commercial.note = `Métricas de cobro no verificables (HTTP ${r.status}).`;
    }
  } catch (err) {
    report.commercial.note = err.message;
  }
}

function buildMessage() {
  const tg = report.boltech.telegramDeepHealth || {};
  const progress = report.commercial.progress;
  const agenda = report.commercial.agenda;
  return [
    '📊 BOLTECH — DEL $0 AL PRIMER COBRO',
    '',
    `🕘 ${report.timestamp}`,
    `🌐 Boltech: ${report.boltech.online ? 'ONLINE' : 'REVISAR'}`,
    `📲 Telegram webhook: ${tg.webhookConfigured === true ? 'CONFIGURADO' : 'PENDIENTE/REVISAR'}`,
    `🔥 Explee hot leads visibles: ${report.explee.hotLeads ?? 'N/D'}`,
    `🎯 Apollo contactos guardados visibles: ${report.apollo.savedContacts ?? 'N/D'}`,
    `💵 Cobros verificados en checkout de producción: ${progress.cashCollectedUsd === null ? 'N/D' : '$' + progress.cashCollectedUsd.toFixed(2)}`,
    `📄 Órdenes pagadas verificadas: ${progress.paidOrders ?? 'N/D'}`,
    `🏢 Empresas en investigación RSI-01: ${progress.cohort?.stageCounts?.Researching ?? 'N/D'}`,
    `🗣️ Respuestas / reuniones / propuestas: N/D (sin fuente integrada)`,
    '',
    `Bloqueo principal — ${progress.focus}`,
    'PLAN MIT + RSI-01 · Hora de El Salvador',
    ...agenda.map(item => `${item.at} | ${item.owner}: ${item.action} Evidencia: ${item.evidence}.`),
    '',
    'Ricardo: decisiones, reuniones y precios. Boltech: medición, clasificación y preparación. Explee/Apollo: fuentes solo si están configuradas.',
    'Inventario y presupuestos no equivalen a dinero cobrado.'
  ].join('\n');
}

await Promise.all([checkBoltech(), checkExplee(), checkApollo(), checkCommercial()]);
report.commercial.progress = evaluateCommercialProgress({
  verifiedSales: report.commercial.metrics?.verifiedSales,
  referrals: report.commercial.metrics?.referrals,
  cohort: report.commercial.metrics?.cohort,
  hotLeads: report.explee.hotLeads,
  savedContacts: report.apollo.savedContacts
});
report.commercial.agenda = buildMitAgenda(report.commercial.progress);
const message = buildMessage();
console.log(message);
console.log('\nJSON REPORT\n' + JSON.stringify(report, null, 2));
await mkdir('ops-output', { recursive: true });
await writeFile('ops-output/commercial-report.json', JSON.stringify(report, null, 2) + '\n');
if (process.env.GITHUB_STEP_SUMMARY) {
  await writeFile(process.env.GITHUB_STEP_SUMMARY, message + '\n');
}
