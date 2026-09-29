const APOLLO_API_KEY = (process.env.APOLLO_API_KEY || '').trim();
const EXPLEE_API_KEY = (process.env.EXPLEE_API_KEY || '').trim();
const TELEGRAM_BOT_TOKEN = (process.env.TELEGRAM_BOT_TOKEN || '').trim();
const TELEGRAM_CHAT_ID = (process.env.TELEGRAM_AUTHORIZED_USER_ID || '').trim();
const BOLTECH_URL = (process.env.BOLTECH_URL || 'https://boltech-group.vercel.app').replace(/\/+$/, '');

const report = {
  timestamp: new Date().toISOString(),
  boltech: { online: false, telegramDeepHealth: null },
  explee: { configured: Boolean(EXPLEE_API_KEY), reachable: false, hotLeads: null, note: null },
  apollo: { configured: Boolean(APOLLO_API_KEY), reachable: false, savedContacts: null, note: null }
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
    report.explee.hotLeads = Array.isArray(r.data?.leads) ? r.data.leads.length : 0;
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
    report.apollo.savedContacts = Array.isArray(r.data?.contacts) ? r.data.contacts.length : 0;
    if (!r.ok) report.apollo.note = `HTTP ${r.status}`;
  } catch (err) {
    report.apollo.note = err.message;
  }
}

function buildMessage() {
  const tg = report.boltech.telegramDeepHealth || {};
  return [
    '📊 BOLTECH — MIT COMMERCIAL CONTROL TOWER',
    '',
    `🕘 ${report.timestamp}`,
    `🌐 Boltech: ${report.boltech.online ? 'ONLINE' : 'REVISAR'}`,
    `📲 Telegram webhook: ${tg.webhookConfigured === true ? 'CONFIGURADO' : 'PENDIENTE/REVISAR'}`,
    `🔥 Explee hot leads visibles: ${report.explee.hotLeads ?? 'N/D'}`,
    `🎯 Apollo contactos guardados visibles: ${report.apollo.savedContacts ?? 'N/D'}`,
    '',
    'MIT 1 — Revisar y responder hot leads.',
    'MIT 2 — Seleccionar 20–30 prospectos ICP de Apollo, sin gastar créditos indiscriminadamente.',
    'MIT 3 — Registrar resultados y optimizar mensajes/campañas.',
    '',
    'Asignación: Ricardo = pagos/reuniones/decisiones; Boltech = vigilancia y clasificación; Explee = outbound; Apollo = sourcing.'
  ].join('\n');
}

async function notifyTelegram(message) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.log('[TELEGRAM] Secrets no configurados; se emite reporte solo en Actions.');
    return false;
  }
  const r = await jsonFetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: message })
  });
  return Boolean(r.ok && r.data?.ok);
}

await Promise.all([checkBoltech(), checkExplee(), checkApollo()]);
const message = buildMessage();
console.log(message);
console.log('\nJSON REPORT\n' + JSON.stringify(report, null, 2));
const delivered = await notifyTelegram(message);
console.log(`\nTelegram notification delivered: ${delivered}`);
