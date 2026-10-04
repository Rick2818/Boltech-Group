import { createApolloClient } from '../../lib/apollo_client.js';
import { mkdir, writeFile } from 'node:fs/promises';
import { CAMPAIGN_ID, normalizeCampaign, decideTraction } from './traction_cycle.mjs';
import { evaluateCommercialProgress, buildMitAgenda } from './zero_to_first_sale.mjs';
import { decideStrategyActions, buildRsiArchitecture, AUDIT_CAMPAIGN } from '../../lib/commercial_strategy.js';

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
    const site = await jsonFetch(`${BOLTECH_URL}/api/telegram`);
    report.boltech.online = site.status === 200 && site.data?.status === 'ONLINE';
  } catch (err) {
    report.boltech.note = err.message;
  }
  try {
    const telegram = await jsonFetch(`${BOLTECH_URL}/api/telegram?deep=1`);
    report.boltech.telegramDeepHealth = telegram.data || { status: telegram.status };
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
    const batch = await createApolloClient().listSavedContacts({ perPage: 100, maxPages: 20 });
    report.apollo.reachable = true;
    report.apollo.savedContacts = batch.totalEntries ?? batch.contacts.length;
    report.apollo.usableContacts = batch.contacts.length;
    report.apollo.pagesRead = batch.pagesRead;
    report.apollo.rejected = batch.rejected;
    report.apollo.complete = batch.complete;
  } catch (err) {
    report.apollo.note = err.code || 'APOLLO_REQUEST_FAILED';
  }
}

async function checkCampaign() {
  report.apollo.campaign = { status: 'unavailable', note: 'APOLLO_API_KEY ausente.' };
  if (!APOLLO_API_KEY) return;
  try {
    const data = await createApolloClient().request('emailer_campaigns/search', { body:
      { q_name: 'Boltech | Customer Requests | Oct 2026 | EN', page: 1, per_page: 10 } });
    report.apollo.campaign = normalizeCampaign(data, CAMPAIGN_ID);
  } catch {
    report.apollo.campaign = { status: 'unavailable', note: 'Fallo de lectura de campaña.' };
  }
  report.apollo.campaign.observedAt = new Date().toISOString();
}

async function checkAuditCampaign() {
  report.apollo.auditCampaign = { status: 'unavailable', active: null, note: 'APOLLO_API_KEY ausente.' };
  if (!APOLLO_API_KEY) return;
  try {
    const data = await createApolloClient().request('emailer_campaigns/search', { body:
      { q_name: AUDIT_CAMPAIGN.name, page: 1, per_page: 10 } });
    const row = data?.emailer_campaigns?.find(item => item.id === AUDIT_CAMPAIGN.id);
    report.apollo.auditCampaign = { ...normalizeCampaign(data, AUDIT_CAMPAIGN.id),
      active: typeof row?.active === 'boolean' ? row.active : null };
  } catch {
    report.apollo.auditCampaign = { status: 'unavailable', active: null, note: 'Fallo de lectura de campaña de auditoría.' };
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
    if (report.commercial.reachable && r.data?.metrics && typeof r.data.metrics === 'object') {
      report.commercial.metrics = r.data.metrics;
      if (!Number.isFinite(r.data.metrics.verifiedSales?.cashCollectedUsd))
        report.commercial.note = 'Cobros N/D; se conservan las demás fuentes disponibles.';
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
    `✉️ Campaña: entregados ${report.apollo.campaign?.delivered ?? 'N/D'} | respuestas ${report.apollo.campaign?.replied ?? 'N/D'} | rebotes ${report.apollo.campaign?.bounced ?? 'N/D'}`,
    `Aperturas: ${report.apollo.campaign?.opens ?? 'N/D (sin seguimiento verificable)'}`,
    `RSI tracción: ${report.commercial.traction.action} — ${report.commercial.traction.next}`,
    'Diagnósticos y propuestas: N/D hasta evidencia; coordinación exclusivamente por email.',
    '',
    `Bloqueo principal — ${progress.focus}`,
    'PLAN MIT + RSI-01/02/03 · Hora de El Salvador',
    ...report.commercial.architecture.controllers.map(item => `${item.id} | ${item.role} | ${item.state}`),
    'Ciclo: observar → decidir → acción autorizada → medir → conservar/ajustar.',
    ...report.commercial.strategyActions.map(item => `${item.rsi}: ${item.action}`),
    `A2A socios habilitados: ${report.commercial.metrics?.a2a?.enabledPartners ?? 'N/D'} | referidos genuinos: ${report.commercial.metrics?.a2a?.referrals ?? 'N/D'}`,
    `Costos ${report.commercial.metrics?.operatingCosts?.period ?? ''}: ${report.commercial.metrics?.operatingCosts?.totalCostUsd == null ? 'N/D' : '$' + report.commercial.metrics.operatingCosts.totalCostUsd.toFixed(2)}`,
    'Costos mensuales y cobros acumulados no se restan como utilidad. Atribución de cobros A2A: N/D sin vínculo verificado.',
    ...agenda.map(item => `${item.at} | ${item.owner}: ${item.action} Evidencia: ${item.evidence}.`),
    '',
    'Ricardo: decisiones y precios por email. Boltech: medición, clasificación y preparación. Explee/Apollo: fuentes solo si están configuradas.',
    'Inventario y presupuestos no equivalen a dinero cobrado.'
  ].join('\n');
}

await Promise.all([checkBoltech(), checkExplee(), checkApollo(), checkCampaign(), checkAuditCampaign(), checkCommercial()]);
report.commercial.progress = evaluateCommercialProgress({
  verifiedSales: report.commercial.metrics?.verifiedSales,
  referrals: report.commercial.metrics?.referrals,
  cohort: report.commercial.metrics?.cohort,
  hotLeads: report.explee.hotLeads,
  savedContacts: report.apollo.savedContacts
});
report.commercial.traction = decideTraction(report.apollo.campaign);
report.commercial.agenda = buildMitAgenda(report.commercial.progress);
report.commercial.strategyActions = decideStrategyActions({
  cohorts: report.commercial.metrics?.cohorts,
  a2a: report.commercial.metrics?.a2a,
  costs: report.commercial.metrics?.operatingCosts
});
report.commercial.architecture = buildRsiArchitecture({
  metrics: report.commercial.metrics, campaign: report.apollo.campaign, auditCampaign: report.apollo.auditCampaign
});
const message = buildMessage();
console.log(message);
console.log('\nJSON REPORT\n' + JSON.stringify(report, null, 2));
await mkdir('ops-output', { recursive: true });
await writeFile('ops-output/commercial-report.json', JSON.stringify(report, null, 2) + '\n');
if (process.env.GITHUB_STEP_SUMMARY) {
  await writeFile(process.env.GITHUB_STEP_SUMMARY, message + '\n');
}

