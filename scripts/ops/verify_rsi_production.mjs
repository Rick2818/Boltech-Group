import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';

const base = 'https://boltech-group.vercel.app';
const token = process.env.PARTNER_API_TOKEN;
const report = { timestamp: new Date().toISOString(), auditor: 'ChatGPT / Codex', commit: process.env.GITHUB_SHA || null, scope: 'Authenticated production RSI handoff QA; no campaigns or charges', checks: [], status: 'FAIL' };
const handoffId = `qa-production-${process.env.GITHUB_RUN_ID || Date.now()}`;
async function request(method, body, authorized = true, id = handoffId) {
  const url = `${base}/api/partners?action=rsi-handoff&handoffId=${encodeURIComponent(id)}`;
  const response = await fetch(url, { method, headers: { 'Content-Type': 'application/json', ...(authorized ? { Authorization: `Bearer ${token}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(20000) });
  const data = await response.json();
  return { status: response.status, data, cache: response.headers.get('cache-control') };
}
function check(name, actual, expected) { assert.equal(actual, expected, name); report.checks.push({ name, status: 'PASS' }); }
try {
  assert.ok(token, 'PARTNER_API_TOKEN GitHub secret is required');
  // Wait only for the route contract, not for an unrelated readiness check.
  let ready = false;
  for (let attempt = 0; attempt < 12; attempt++) {
    try { const result = await request('GET', null, false); if (result.status === 401 && result.data.code === 'OPERATIONAL_AUTH_REQUIRED') { ready = true; break; } } catch {}
    await new Promise(resolve => setTimeout(resolve, 10000));
  }
  assert.ok(ready, 'RSI route contract is not deployed');
  for (const method of ['GET', 'POST', 'PATCH']) {
    const result = await request(method, method === 'GET' ? null : {} , false);
    check(`unauthorized ${method}`, result.status, 401);
    check(`${method} cache disabled`, result.cache, 'no-store');
  }
  const input = { handoffId, opportunityId: handoffId, from: 'RSI-01', to: 'RSI-02', owner: 'RSI-02', reason: 'QA production verification; no customer or campaign activity', evidenceRef: `qa-run-${process.env.GITHUB_RUN_ID || 'local'}` };
  let result = await request('POST', input); check('create durable record', result.status, 201);
  result = await request('POST', input); check('duplicate creation', result.status, 200); check('duplicate does not create', result.data.created, false);
  result = await request('POST', { ...input, opportunityId: 'qa-conflicting-input' }); check('conflicting id rejected', result.status, 409);
  result = await request('GET'); check('read persistent record', result.status, 200); check('initial state', result.data.record.state, 'PENDING');
  const change = (version, state) => ({ handoffId, expectedVersion: version, state, owner: 'RSI-02', evidenceRef: input.evidenceRef });
  result = await request('PATCH', change(1, 'ACCEPTED')); check('accept handoff', result.status, 200);
  result = await request('PATCH', change(1, 'CANCELLED')); check('stale version rejected', result.status, 409);
  result = await request('PATCH', change(2, 'BLOCKED')); check('block handoff', result.status, 200);
  result = await request('PATCH', change(3, 'ACCEPTED')); check('resume handoff', result.status, 200);
  result = await request('PATCH', change(4, 'COMPLETED')); check('complete handoff', result.status, 200);
  result = await request('GET'); check('final state persisted', result.data.record.state, 'COMPLETED'); check('history retained', result.data.record.events.length, 5); check('version retained', result.data.record.version, 5);
  result = await request('PATCH', change(5, 'ACCEPTED')); check('terminal state protected', result.status, 409);
  report.handoffId = handoffId;
  report.status = 'PASS';
} catch (error) { report.error = String(error.message).slice(0, 400); process.exitCode = 1; }
finally {
  await mkdir('ops-output', { recursive: true });
  await writeFile('ops-output/rsi-production-verification.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
}
