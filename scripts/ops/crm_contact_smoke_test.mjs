import { mkdir, writeFile } from 'node:fs/promises';
const base = 'https://boltech-group.vercel.app';
const token = process.env.PARTNER_API_TOKEN;
const report = { timestamp: new Date().toISOString(), status: 'FAIL', email: 'boltech-crm-test@example.com', steps: [] };
async function call(path, body) {
  const response = await fetch(base + path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(25000), redirect: 'error'
  });
  if (!response.ok && response.status !== 202) throw new Error('CRM_HTTP_' + response.status);
  return response.json();
}
const lead = { email: report.email, firstname: 'PRUEBA TÉCNICA', lastname: 'Boltech CRM' };
try {
  if (!token) throw new Error('PARTNER_API_TOKEN_MISSING');
  const config = await call('/api/crm');
  if (!config.integrations?.hubspot?.configured) throw new Error('HUBSPOT_NOT_CONFIGURED');
  if (config.integrations?.salesforce?.configured) throw new Error('SALESFORCE_ENABLED_TEST_STOPPED');
  const first = await call('/api/crm', lead);
  const jobId = first.data?.hubspot?.jobId;
  if (!/^[a-f0-9]{64}$/.test(jobId || '')) throw new Error('CRM_JOB_ID_MISSING');
  report.jobId = jobId;
  report.steps.push({ step: 'enqueue', status: first.data.hubspot.status });
  let job;
  for (let i = 0; i < 48; i++) {
    job = (await call('/api/crm?action=recovery&jobId=' + jobId)).job;
    if (job?.state === 'COMPLETED') break;
    if (job?.state === 'BLOCKED' || (i === 0 && process.env.RESUME_TEST_JOB === 'true' && job?.state === 'RETRY_PENDING' && ['HUBSPOT_INVALID_RESPONSE', 'HUBSPOT_BATCH_READ_UNCONFIRMED'].includes(job?.code))) {
      if (process.env.RESUME_TEST_JOB !== 'true' || i !== 0) throw new Error(job.code || 'CRM_JOB_BLOCKED');
      await call('/api/crm?action=recovery', { jobId });
      report.steps.push({ step: 'resume_test_job', jobId });
    }
    await call('/api/crm?action=recovery', {});
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
  report.steps.push({ step: 'recovery', state: job?.state, attempts: job?.attempts, history: job?.history });
  if (job?.state !== 'COMPLETED') throw new Error('CRM_TEST_NOT_COMPLETED');
  const repeated = await call('/api/crm', lead);
  const confirmed = repeated.data?.hubspot;
  if (!confirmed?.synced || !confirmed.contactId || confirmed.jobId !== jobId) throw new Error('CRM_CONFIRMATION_MISSING');
  report.contactId = String(confirmed.contactId);
  const again = await call('/api/crm', lead);
  if (again.data?.hubspot?.contactId !== report.contactId || again.data?.hubspot?.jobId !== jobId) throw new Error('CRM_IDEMPOTENCY_FAILED');
  report.steps.push({ step: 'repeat_identical_payload', contactId: report.contactId, sameJobAndContact: true });
  report.status = 'PASS';
} catch (error) {
  report.code = /^[A-Z_0-9]+$/.test(error.message) ? error.message : 'CRM_TEST_FAILED';
  process.exitCode = 1;
} finally {
  await mkdir('ops-output', { recursive: true });
  await writeFile('ops-output/crm-contact-smoke-test.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
}
