import { mkdir, writeFile } from 'node:fs/promises';
const token = process.env.PARTNER_API_TOKEN;
if (!token) throw new Error('Administrative credential is missing');
const base = 'https://boltech-group.vercel.app';
const response = await fetch(`${base}/api/crm?action=recovery`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: '{}', signal: AbortSignal.timeout(55000) });
let data;
try { data = await response.json(); } catch { throw new Error('CRM recovery response is invalid'); }
if (!response.ok || data.success !== true || !Array.isArray(data.results)) throw new Error(`CRM recovery failed: HTTP ${response.status}`);
const report = { timestamp: new Date().toISOString(), commit: process.env.GITHUB_SHA || null, results: data.results, recovery: data.recovery, status: data.recovery?.blocked > 0 ? 'ATTENTION' : 'PASS' };
await mkdir('ops-output', { recursive: true });
await writeFile('ops-output/crm-recovery.json', JSON.stringify(report, null, 2));
// Verify the already-authorized intake without creating another contact or email.
const intakeId = process.env.VERIFY_CRM_JOB_ID;
if (intakeId) {
const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
const check = await fetch(`${base}/api/crm?action=recovery&jobId=${intakeId}`, { headers, signal: AbortSignal.timeout(15000) });
const current = await check.json();
if (check.ok && current.job && ['PENDING', 'RETRY_PENDING'].includes(current.job.state)) {
  const recovery = await fetch(`${base}/api/crm?action=recovery`, { method: 'POST', headers,
    body: JSON.stringify({ runJobId: intakeId }), signal: AbortSignal.timeout(55000) });
  if (!recovery.ok) throw new Error('Controlled intake recovery failed');
}
const verified = await fetch(`${base}/api/crm?action=recovery&jobId=${intakeId}`, { headers, signal: AbortSignal.timeout(15000) });
const final = await verified.json();
report.controlledIntake = final.job ? { id: final.job.id, state: final.job.state,
  requestPreserved: Boolean(final.job.request?.painPoint), contactVerified: Boolean(final.job.contactId), code: final.job.code || null } : null;
await writeFile('ops-output/crm-recovery.json', JSON.stringify(report, null, 2));
}
console.log(JSON.stringify(report));
