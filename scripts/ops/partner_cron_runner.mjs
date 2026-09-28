import fs from 'node:fs';
import path from 'node:path';

const action = process.argv[2] || 'health';
const baseUrl = (process.env.BOLTECH_APP_URL || 'https://boltech-group.vercel.app').replace(/\/$/, '');
const token = (process.env.PARTNER_API_TOKEN || '').trim();
const outputDir = path.resolve('ops-output');

function nowIso() {
  return new Date().toISOString();
}

async function api(route, { auth = false } = {}) {
  if (auth && !token) {
    throw new Error('PARTNER_API_TOKEN is required for this operational job.');
  }

  const headers = { Accept: 'application/json' };
  if (auth) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${baseUrl}/api/partners?action=${encodeURIComponent(route)}`, {
    headers,
    signal: AbortSignal.timeout(20000)
  });

  const text = await response.text();
  let payload = {};
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = { raw: text.slice(0, 500) };
  }

  if (!response.ok || payload.success === false) {
    throw new Error(`${route} failed: HTTP ${response.status} ${payload.error || payload.raw || ''}`.trim());
  }

  return payload;
}

function countBy(items, key) {
  return items.reduce((acc, item) => {
    const value = item?.[key] || 'UNKNOWN';
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
}

function money(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  }).format(Number(value || 0));
}

function appendSummary(markdown) {
  const file = process.env.GITHUB_STEP_SUMMARY;
  if (file) fs.appendFileSync(file, markdown + '\n', 'utf8');
  else console.log(markdown);
}

function writeJson(name, data) {
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(path.join(outputDir, name), JSON.stringify(data, null, 2), 'utf8');
}

function partnerPriority(partner) {
  const base = {
    PROSPECT: 100,
    INVITED: 80,
    ACTIVE: 20,
    PAUSED: 0,
    DECLINED: -100
  }[partner.status] ?? 10;

  const noContactBonus = partner.lastContact ? 0 : 20;
  return base + noContactBonus;
}

function referralPriority(referral) {
  return ({
    NEGOTIATION: 100,
    PROPOSAL: 90,
    QUALIFIED: 80,
    ACCEPTED: 70,
    WAITING_CONSENT: 60,
    REVIEW: 50,
    NEW: 40,
    WON: -100,
    LOST: -100,
    REJECTED: -100
  }[referral.status] ?? 10) + Math.min(Number(referral.budgetUsd || 0) / 1000, 20);
}

async function runHealth() {
  const [health, metrics] = await Promise.all([api('health'), api('metrics')]);

  if (!health.airtableConfigured) throw new Error('Airtable is not configured in production.');
  if (!health.writeAuthConfigured) throw new Error('Partner write authentication is not configured in production.');

  const result = {
    generatedAt: nowIso(),
    status: 'healthy',
    service: health.service,
    safeguards: health.safeguards,
    metrics: metrics.metrics
  };

  writeJson('health.json', result);
  appendSummary(
    `## Boltech Health Check ✅\n\n` +
    `- Partner Network: **OK**\n` +
    `- Airtable: **OK**\n` +
    `- Write authentication: **OK**\n` +
    `- Partners: **${metrics.metrics.partners.total}**\n` +
    `- Referrals: **${metrics.metrics.referrals.total}**\n` +
    `- Checked: ${result.generatedAt}`
  );
}

async function runPlanner() {
  const [partnersPayload, referralsPayload, metricsPayload] = await Promise.all([
    api('partners', { auth: true }),
    api('referrals', { auth: true }),
    api('metrics')
  ]);

  const partners = partnersPayload.partners || [];
  const referrals = referralsPayload.referrals || [];

  const partnerQueue = partners
    .filter(p => ['PROSPECT', 'INVITED', 'ACTIVE'].includes(p.status))
    .map(p => ({
      id: p.id,
      name: p.name,
      status: p.status,
      partnerType: p.partnerType,
      lastContact: p.lastContact || null,
      priority: partnerPriority(p),
      nextAction: p.status === 'PROSPECT'
        ? 'Prepare application / first contact'
        : p.status === 'INVITED'
          ? 'Follow up on application or invitation'
          : 'Review active co-selling opportunities'
    }))
    .sort((a, b) => b.priority - a.priority || a.name.localeCompare(b.name))
    .slice(0, 10);

  const referralQueue = referrals
    .filter(r => !['WON', 'LOST', 'REJECTED'].includes(r.status))
    .map(r => ({
      id: r.id,
      referralId: r.referralId,
      status: r.status,
      serviceType: r.serviceType,
      budgetUsd: r.budgetUsd,
      clientConsent: r.clientConsent,
      priority: referralPriority(r),
      nextAction: r.status === 'WAITING_CONSENT'
        ? 'Obtain customer consent before sharing PII'
        : r.status === 'NEGOTIATION'
          ? 'Human commercial review'
          : r.status === 'PROPOSAL'
            ? 'Human proposal follow-up'
            : 'Qualification / next-step review'
    }))
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 10);

  const plan = {
    generatedAt: nowIso(),
    guardrails: [
      'No paid subscription purchase',
      'No autonomous price or contract approval',
      'No customer PII before consent',
      'No outbound message is sent by this job'
    ],
    metrics: metricsPayload.metrics,
    partnerQueue,
    referralQueue
  };

  writeJson('daily-plan.json', plan);

  const partnerLines = partnerQueue.length
    ? partnerQueue.map((p, i) => `${i + 1}. **${p.name}** — ${p.status} — ${p.nextAction}`).join('\n')
    : 'No partner actions pending.';

  const referralLines = referralQueue.length
    ? referralQueue.map((r, i) => `${i + 1}. **${r.referralId || r.id}** — ${r.status} — ${r.nextAction}`).join('\n')
    : 'No open referrals pending.';

  appendSummary(
    `## Boltech Daily Planner\n\n### Partner priorities\n${partnerLines}\n\n` +
    `### Referral priorities\n${referralLines}\n\n` +
    `**Control:** this workflow plans only; it does not send outbound messages or spend money.`
  );
}

async function runCrmSync() {
  const [partnersPayload, referralsPayload, metricsPayload] = await Promise.all([
    api('partners', { auth: true }),
    api('referrals', { auth: true }),
    api('metrics')
  ]);

  const partners = partnersPayload.partners || [];
  const referrals = referralsPayload.referrals || [];
  const metrics = metricsPayload.metrics;

  const computed = {
    partnersTotal: partners.length,
    partnersActive: partners.filter(p => p.status === 'ACTIVE').length,
    referralsTotal: referrals.length,
    referralsWon: referrals.filter(r => r.status === 'WON').length,
    referralsOpen: referrals.filter(r => !['WON', 'LOST', 'REJECTED'].includes(r.status)).length
  };

  const mismatches = [];
  if (computed.partnersTotal !== metrics.partners.total) mismatches.push('partners.total');
  if (computed.partnersActive !== metrics.partners.active) mismatches.push('partners.active');
  if (computed.referralsTotal !== metrics.referrals.total) mismatches.push('referrals.total');
  if (computed.referralsWon !== metrics.referrals.won) mismatches.push('referrals.won');
  if (computed.referralsOpen !== metrics.referrals.open) mismatches.push('referrals.open');

  const partnerNames = partners.map(p => (p.name || '').trim().toLowerCase()).filter(Boolean);
  const duplicatePartners = [...new Set(partnerNames.filter((name, i) => partnerNames.indexOf(name) !== i))];

  const referralIds = referrals.map(r => (r.referralId || '').trim().toLowerCase()).filter(Boolean);
  const duplicateReferrals = [...new Set(referralIds.filter((id, i) => referralIds.indexOf(id) !== i))];

  const integrity = {
    generatedAt: nowIso(),
    status: mismatches.length || duplicatePartners.length || duplicateReferrals.length ? 'attention' : 'clean',
    computed,
    publishedMetrics: metrics,
    mismatches,
    duplicatePartners,
    duplicateReferrals
  };

  writeJson('crm-integrity.json', integrity);

  appendSummary(
    `## Boltech CRM Integrity Check ${integrity.status === 'clean' ? '✅' : '⚠️'}\n\n` +
    `- Partners reconciled: **${computed.partnersTotal}**\n` +
    `- Referrals reconciled: **${computed.referralsTotal}**\n` +
    `- Metric mismatches: **${mismatches.length}**\n` +
    `- Duplicate partner names: **${duplicatePartners.length}**\n` +
    `- Duplicate referral IDs: **${duplicateReferrals.length}**\n\n` +
    `This job is non-destructive: Airtable remains the system of record.`
  );

  if (mismatches.length) {
    throw new Error(`CRM integrity mismatch: ${mismatches.join(', ')}`);
  }
}

async function runReport() {
  const [partnersPayload, referralsPayload, metricsPayload] = await Promise.all([
    api('partners', { auth: true }),
    api('referrals', { auth: true }),
    api('metrics')
  ]);

  const partners = partnersPayload.partners || [];
  const referrals = referralsPayload.referrals || [];
  const metrics = metricsPayload.metrics;

  const report = {
    generatedAt: nowIso(),
    partnerStatus: countBy(partners, 'status'),
    referralStatus: countBy(referrals, 'status'),
    metrics
  };

  writeJson('executive-report.json', report);

  appendSummary(
    `## Boltech Daily Executive Report\n\n` +
    `| KPI | Result |\n|---|---:|\n` +
    `| Partners | ${metrics.partners.total} |\n` +
    `| Active partners | ${metrics.partners.active} |\n` +
    `| Open referrals | ${metrics.referrals.open} |\n` +
    `| Won referrals | ${metrics.referrals.won} |\n` +
    `| Pipeline | ${money(metrics.finance.pipelineUsd)} |\n` +
    `| Revenue | ${money(metrics.finance.revenueUsd)} |\n` +
    `| Commissions | ${money(metrics.finance.commissionsUsd)} |\n` +
    `| Net referral revenue | **${money(metrics.finance.netReferralRevenueUsd)}** |\n\n` +
    `### Partner status\n\n\`\`\`json\n${JSON.stringify(report.partnerStatus, null, 2)}\n\`\`\`\n\n` +
    `### Referral status\n\n\`\`\`json\n${JSON.stringify(report.referralStatus, null, 2)}\n\`\`\``
  );
}

const runners = {
  health: runHealth,
  planner: runPlanner,
  'crm-sync': runCrmSync,
  report: runReport
};

if (!runners[action]) {
  console.error(`Unknown action: ${action}`);
  process.exit(2);
}

try {
  await runners[action]();
  console.log(`Boltech operational job "${action}" completed successfully.`);
} catch (error) {
  appendSummary(`## Boltech Operational Job ❌\n\n**${action}** failed: ${error.message}`);
  console.error(error);
  process.exit(1);
}
