import { mkdir, writeFile } from 'node:fs/promises';

const base = 'https://boltech-group.vercel.app';
const report = { timestamp: new Date().toISOString(), status: 'FAIL', steps: [], scope: 'Apollo saved contacts and optional controlled CRM sync; no enrichment or outbound messages' };
const token = process.env.PARTNER_API_TOKEN;
async function call(path, body, authenticated = true) {
  const response = await fetch(base + path, { method: body === undefined ? 'GET' : 'POST',
    headers: { ...(authenticated ? { Authorization: 'Bearer ' + token } : {}), 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }), redirect: 'error', signal: AbortSignal.timeout(55000) });
  const data = await response.json();
  return { response, data };
}
try {
  if (!token) throw new Error('OPERATIONAL_AUTH_NOT_CONFIGURED');
  let ready = false;
  for (let i = 0; i < 24; i++) {
    try {
      const { response, data } = await call('/api/crm?action=apollo-readiness');
      if (response.ok && data.apollo?.revision === 'apollo-hardening-v1') {
        if (!data.apollo.configured) throw new Error('APOLLO_NOT_CONFIGURED');
        ready = true; break;
      }
    } catch (error) { if (error.message === 'APOLLO_NOT_CONFIGURED') throw error; }
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
  if (!ready) throw new Error('APOLLO_DEPLOYMENT_NOT_READY');
  const unauthorized = await call('/api/crm?action=apollo-verify', undefined, false);
  if (unauthorized.response.status !== 401) throw new Error('APOLLO_AUTH_GUARD_FAILED');
  report.steps.push({ step: 'unauthenticated_access', status: 401 });
  const { response, data } = await call('/api/crm?action=apollo-verify&perPage=10');
  if (!response.ok || !data.success || !data.complete) throw new Error(data.code || 'APOLLO_READ_UNCONFIRMED');
  report.steps.push({ step: 'provider_read', pagesRead: data.pagesRead, providerTotal: data.providerTotal, usableContacts: data.usableContacts,
    rejected: data.rejected, emailValidation: data.emailValidation });
  if (process.env.VERIFY_CRM === 'true') {
    if (!data.sampleContactId) throw new Error('APOLLO_NO_SAVED_CONTACT');
    const payload = { contactIds: [data.sampleContactId] };
    const first = await call('/api/crm?action=apollo-sync', payload);
    if (!first.response.ok || first.data.submitted !== 1) throw new Error(first.data.code || 'APOLLO_CRM_SUBMISSION_FAILED');
    const jobId = first.data.results?.[0]?.jobId;
    if (!/^[a-f0-9]{64}$/.test(jobId || '')) throw new Error('APOLLO_CRM_JOB_MISSING');
    let completed = first.data.providerConfirmed === 1;
    for (let i = 0; !completed && i < 48; i++) {
      const current = await call('/api/crm?action=recovery&jobId=' + jobId);
      if (!current.response.ok) throw new Error('APOLLO_CRM_JOB_READ_FAILED');
      completed = current.data.job?.state === 'COMPLETED';
      if (current.data.job?.state === 'BLOCKED') throw new Error(current.data.job.code || 'APOLLO_CRM_BLOCKED');
      if (!completed) {
        const drain = await call('/api/crm?action=recovery', {});
        if (!drain.response.ok) throw new Error('APOLLO_CRM_RECOVERY_FAILED');
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
    if (!completed) throw new Error('APOLLO_CRM_NOT_COMPLETED');
    const repeat = await call('/api/crm?action=apollo-sync', payload);
    const result = repeat.data.results?.[0];
    if (!repeat.response.ok || repeat.data.providerConfirmed !== 1 || result.jobId !== jobId || !/^[1-9]\d*$/.test(result.contactId || ''))
      throw new Error('APOLLO_CRM_READBACK_OR_DEDUP_FAILED');
    const again = await call('/api/crm?action=apollo-sync', payload);
    if (!again.response.ok || again.data.results?.[0]?.jobId !== jobId || again.data.results?.[0]?.contactId !== result.contactId)
      throw new Error('APOLLO_CRM_IDEMPOTENCY_FAILED');
    report.steps.push({ step: 'crm_sync', state: 'COMPLETED', providerConfirmed: true, identicalPayloadDeduplicated: true });
  }
  report.status = 'PASS';
} catch (error) {
  report.code = /^[A-Z_]+$/.test(error.message) ? error.message : 'APOLLO_VERIFICATION_FAILED';
  process.exitCode = 1;
} finally {
  await mkdir('ops-output', { recursive: true });
  await writeFile('ops-output/apollo-verification.json', JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report));
}
