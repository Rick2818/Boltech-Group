import { mkdir, writeFile, appendFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const BASE = 'https://boltech-group.vercel.app';
const REPO = 'Rick2818/Boltech-Group';

export function triggerEvidence(env = {}) {
  const event = ['schedule', 'push', 'workflow_dispatch'].includes(env.WATCH_EVENT_NAME) ? env.WATCH_EVENT_NAME : 'unknown';
  const schedule = event === 'schedule' && ['17 * * * *', '30 12 * * 1-5'].includes(env.WATCH_SCHEDULE) ? env.WATCH_SCHEDULE : null;
  const runId = /^\d+$/.test(env.WATCH_RUN_ID || '') ? env.WATCH_RUN_ID : null;
  return { event, schedule, kind: event === 'schedule' ? (schedule === '17 * * * *' ? 'hourly' : schedule === '30 12 * * 1-5' ? 'daily' : 'unknown') : event,
    runId, artifactName: runId ? 'production-health-' + runId : null };
}

export function classifyPayments(data) {
  if (data?.success !== true || !['production', 'sandbox'].includes(data.environment)) return 'FAILED';
  if (!data.store?.configured || !data.fulfillment?.atomicClaimConfigured) return 'FAILED';
  if (data.wompiConnection?.status === 'FAILED') return 'FAILED';
  // Configured credentials never establish a successful payment or bank activation.
  return 'PROVIDER_VERIFICATION_PENDING';
}

export function scheduleEvidence(runs, now = new Date()) {
  const findings = [];
  const today = new Date(now.getTime() - 6 * 3600000).toISOString().slice(0, 10);
  const local = new Date(now.getTime() - 6 * 3600000);
  const localMinutes = local.getUTCHours() * 60 + local.getUTCMinutes();
  const weekday = local.getUTCDay() > 0 && local.getUTCDay() < 6;
  for (const [path, due, weekdays] of [
    ['.github/workflows/boltech_health_check.yml', 390, true],
    ['.github/workflows/mit_commercial_9am.yml', 540, false]
  ]) {
    if (weekdays && !weekday) continue;
    if (localMinutes < due + 60) continue;
    const sameDay = runs.filter(r => r.path === path && r.event === 'schedule' &&
      new Date(new Date(r.created_at).getTime() - 6 * 3600000).toISOString().slice(0, 10) === today);
    // Health also runs hourly: any successful run after its morning deadline establishes coverage,
    // but does not prove the specific 06:30 event executed punctually.
    const afterDue = sameDay.filter(r => {
      const t = new Date(new Date(r.created_at).getTime() - 6 * 3600000);
      return t.getUTCHours() * 60 + t.getUTCMinutes() >= due;
    });
    if (!afterDue.length) findings.push({ path, code: 'MISSING_EXECUTION' });
    else {
      const first = afterDue.sort((a, b) => a.created_at.localeCompare(b.created_at))[0];
      const t = new Date(new Date(first.created_at).getTime() - 6 * 3600000);
      const delay = t.getUTCHours() * 60 + t.getUTCMinutes() - due;
      if (delay > 60) findings.push({ path, code: 'LATE_EXECUTION', delayMinutes: delay });
      if (first.status === 'completed' && first.conclusion !== 'success') findings.push({ path, code: 'FAILED_EXECUTION' });
    }
  }
  const health = runs.filter(r => r.path === '.github/workflows/boltech_health_check.yml' && r.event === 'schedule')
    .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
  if (!health || now - new Date(health.created_at) > 150 * 60000) findings.push({ code: 'HOURLY_HEALTH_STALE' });
  else if (health.status === 'completed' && health.conclusion !== 'success') findings.push({ code: 'LATEST_HEALTH_FAILED' });
  return findings;
}

export async function runWatch({ fetcher = fetch, env = process.env, now = new Date() } = {}) {
  const checks = [];
  async function request(url, options = {}) {
    const response = await fetcher(url, { ...options, signal: AbortSignal.timeout(15000) });
    const text = await response.text();
    let data; try { data = JSON.parse(text); } catch { data = null; }
    return { status: response.status, data, text };
  }
  async function check(name, fn) {
    try { checks.push({ name, ...await fn() }); }
    catch { checks.push({ name, status: 'FAILED', code: 'REQUEST_FAILED' }); }
  }
  const token = String(env.PARTNER_API_TOKEN || '').trim();
  const adminHeaders = { Authorization: `Bearer ${token}` };
  await check('website', async () => {
    const r = await request(BASE);
    return { status: r.status === 200 && /Boltech/i.test(r.text) ? 'PASSED' : 'FAILED', http: r.status };
  });
  await check('agent_card', async () => {
    const r = await request(BASE + '/.well-known/agent-card.json');
    const valid = r.data?.supportedInterfaces?.some(x => x.url === BASE + '/api/a2a') && r.data?.securityRequirements?.length > 0;
    return { status: r.status === 200 && valid ? 'PASSED' : 'FAILED', http: r.status };
  });
  await check('a2a_auth_boundary', async () => {
    const r = await request(BASE + '/api/a2a', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 'health', method: 'GetTask', params: { id: '0'.repeat(64) } }) });
    return { status: r.status === 401 && r.data?.error?.code === -32001 ? 'PASSED' : 'FAILED', http: r.status };
  });
  await check('a2a_authenticated', async () => {
    const key = String(env.A2A_MONITOR_TOKEN || '').trim();
    if (!key) return { status: 'PENDING', code: 'APPROVED_PARTNER_CREDENTIAL_REQUIRED' };
    // Unsupported read-only method reaches method validation only after real partner authentication.
    const r = await request(BASE + '/api/a2a', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({ jsonrpc: '2.0', id: 'health', method: 'HealthCheck' }) });
    return { status: r.status === 400 && r.data?.error?.code === -32601 ? 'PASSED' : 'FAILED', http: r.status };
  });
  await check('telegram_deep', async () => {
    const r = await request(BASE + '/api/telegram?deep=1');
    const d = r.data;
    return { status: r.status === 200 && d?.status === 'ONLINE' && d.telegramConfigured === true && d.webhookConfigured === true &&
      d.pendingUpdates === 0 && !d.lastError ? 'PASSED' : 'FAILED', http: r.status };
  });
  await check('private_metrics_boundary', async () => {
    const r = await request(BASE + '/api/partners?action=metrics');
    return { status: r.status === 401 && !r.data?.metrics ? 'PASSED' : 'FAILED', http: r.status };
  });
  await check('private_readiness_boundary', async () => {
    const r = await request(BASE + '/api/payments?action=readiness-internal');
    return { status: r.status === 401 && !r.data?.store ? 'PASSED' : 'FAILED', http: r.status };
  });
  await check('partner_storage', async () => {
    if (!token) return { status: 'FAILED', code: 'ADMIN_MONITOR_CREDENTIAL_MISSING' };
    const [health, metrics] = await Promise.all([
      request(BASE + '/api/partners?action=health-internal', { headers: adminHeaders }),
      request(BASE + '/api/partners?action=metrics', { headers: adminHeaders })
    ]);
    return { status: health.status === 200 && health.data?.airtableConfigured === true && health.data?.writeAuthConfigured === true &&
      metrics.status === 200 && metrics.data?.metrics?.partners && metrics.data?.metrics?.finance ? 'PASSED' : 'FAILED' };
  });
  await check('payments', async () => {
    if (!token) return { status: 'FAILED', code: 'ADMIN_MONITOR_CREDENTIAL_MISSING' };
    const r = await request(BASE + '/api/payments?action=readiness-internal', { headers: adminHeaders });
    const state = classifyPayments(r.data);
    return { status: r.status !== 200 || state === 'FAILED' ? 'FAILED' : 'PENDING', code: state,
      wompiConfigured: r.data?.wompi?.configured === true,
      wompiConnection: r.data?.wompiConnection || { status: 'PENDING', code: 'WOMPI_PROBE_NOT_AVAILABLE' }, strikeConfigured: r.data?.strike?.configured === true,
      strikeWebhookConfigured: r.data?.strike?.webhookConfigured === true };
  });
  await check('schedule_freshness', async () => {
    const githubToken = String(env.GITHUB_TOKEN || '').trim();
    if (!githubToken) return { status: 'FAILED', code: 'GITHUB_READ_CREDENTIAL_MISSING' };
    const since = new Date(now.getTime() - 36 * 3600000).toISOString();
    const r = await request(`https://api.github.com/repos/${REPO}/actions/runs?created=%3E%3D${encodeURIComponent(since)}&per_page=100`, {
      headers: { Authorization: `Bearer ${githubToken}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' }
    });
    if (r.status !== 200 || !Array.isArray(r.data?.workflow_runs)) return { status: 'FAILED', code: 'SCHEDULE_HISTORY_UNAVAILABLE' };
    const findings = scheduleEvidence(r.data.workflow_runs, now);
    return { status: findings.length ? 'ATTENTION' : 'PASSED', findings };
  });
  const failed = checks.filter(x => x.status === 'FAILED');
  return { generatedAt: now.toISOString(), trigger: triggerEvidence(env), status: failed.length ? 'FAILED' : checks.some(x => ['PENDING', 'ATTENTION'].includes(x.status)) ? 'ATTENTION' : 'PASSED',
    checks, failedCount: failed.length, scope: 'Read-only diagnostics; no payments, referrals or outbound messages created.' };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = await runWatch();
  await mkdir('ops-output', { recursive: true });
  await writeFile('ops-output/production-health.json', JSON.stringify(report, null, 2) + '\n');
  const summary = '# Boltech Production Watch — ' + report.status + '\n\nTrigger: ' + JSON.stringify(report.trigger) + '\n\n' + report.checks.map(x => `- ${x.name}: ${x.status}${x.code ? ' (' + x.code + ')' : ''}`).join('\n') + '\n\n' + report.scope + '\n';
  console.log(summary);
  if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, summary);
  if (report.failedCount) process.exitCode = 1;
}
