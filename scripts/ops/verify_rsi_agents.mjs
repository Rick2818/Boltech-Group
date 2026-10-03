import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const base = 'https://boltech-group.vercel.app/api/partners?action=rsi-agents';
const token = process.env.PARTNER_API_TOKEN;
const report = { timestamp: new Date().toISOString(), commit: process.env.GITHUB_SHA || null,
  scope: 'Real recorded agent cycles and authenticated telemetry; no outreach, transactions or synthetic work', status: 'FAIL', checks: [] };
try {
  assert.ok(token, 'Administrative secret is required');
  const deny = await fetch(base, { signal: AbortSignal.timeout(10000) });
  assert.equal(deny.status, 401, 'Telemetry must be private');
  report.checks.push({ name: 'unauthenticated access rejected', status: 'PASS' });
  const response = await fetch(base, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(20000) });
  assert.equal(response.status, 200, 'Authenticated telemetry is available');
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const body = await response.json();
  assert.equal(body.execution?.contractVersion, 1);
  assert.deepEqual(body.execution.agents.map(a => a.rsi), ['RSI-01', 'RSI-02', 'RSI-03']);
  report.execution = body.execution;
  for (const agent of body.execution.agents) {
    assert.equal(agent.executionProven, true, `${agent.rsi} needs a real completed or blocked receipt`);
    assert.ok(agent.receipt?.tools.some(t => t.status === 'VERIFIED'), `${agent.rsi} has no verified tool read`);
    report.checks.push({ name: `${agent.rsi} receipt readable`, status: 'PASS', outcome: agent.state });
  }
  report.status = 'PASS';
} catch (error) { report.error = String(error.message).slice(0, 300); process.exitCode = 1; }
finally {
  await mkdir('ops-output', { recursive: true });
  await writeFile('ops-output/rsi-agent-verification.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
}
