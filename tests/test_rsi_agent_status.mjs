import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeAgentExecutions, getAgentExecutionStatus } from '../lib/rsi_agent_status.js';
import partners from '../api/partners.js';

const now = Date.parse('2026-10-03T20:05:00Z');
function row(rsi = 'RSI-01', outcome = 'COMPLETED') {
  const runId = `${rsi}:2026-10-03T20:00:00Z`;
  const receipt = { schemaVersion: 1, runId, rsi, actor: 'local test actor', startedAt: '2026-10-03T20:00:00Z', finishedAt: '2026-10-03T20:04:00Z', outcome,
    tools: [{ name: 'airtable_list_records_for_table', status: 'VERIFIED', evidenceRef: 'local-test-record', observedAt: '2026-10-03T20:02:00Z' }],
    actions: [{ type: 'CLASSIFY', result: 'Missing customer acceptance', sourceRecordId: 'local-test-record' }], blockers: ['WAITING_CUSTOMER_ACCEPTANCE'], nextAction: 'Review accepted scope' };
  return { fields: { 'Work ID': `BOOTSTRAP:${rsi}`, 'Execution Run ID': runId, 'Execution State': outcome,
    'Execution Started At': receipt.startedAt, 'Execution Finished At': receipt.finishedAt, 'Execution Receipt': JSON.stringify(receipt) } };
}
test('separate role cycles and blockers are preserved without claiming commercial completion', () => {
  const result = summarizeAgentExecutions([row(), row('RSI-02', 'BLOCKED'), row('RSI-03')], now);
  assert.equal(result.allExecutionsProven, true); assert.equal(result.agents[1].state, 'BLOCKED');
  assert.equal(result.agents[0].receiptAgeMinutes, 1); assert.match(result.definition, /not scheduler uptime/);
  assert.ok(result.agents[1].receipt.blockers.includes('WAITING_CUSTOMER_ACCEPTANCE'));
});
test('missing and duplicate bootstrap never prove an agent', () => {
  const result = summarizeAgentExecutions([row(), row()], now);
  assert.equal(result.allExecutionsProven, false); assert.equal(result.agents[0].code, 'DUPLICATE_BOOTSTRAP');
  assert.equal(result.agents[1].code, 'MISSING_BOOTSTRAP');
});
test('mismatched identity, future completion, wrong state and fabricated empty tool lists fail closed', () => {
  for (const change of [r => r.rsi = 'RSI-02', r => r.runId = 'OTHER', r => r.finishedAt = '2027-01-01T00:00:00Z',
    r => r.outcome = 'BLOCKED', r => r.tools = [], r => r.tools[0].evidenceRef = '',
    r => r.tools[0].observedAt = '2026-10-03T19:00:00Z', r => r.tools[0].status = 'UNAVAILABLE', r => r.nextAction = '']) {
    const record = row(); const receipt = JSON.parse(record.fields['Execution Receipt']); change(receipt);
    record.fields['Execution Receipt'] = JSON.stringify(receipt);
    assert.equal(summarizeAgentExecutions([record], now).agents[0].executionProven, false);
  }
});
test('failed and unknown cycles are visible but do not prove successful operation', () => {
  for (const state of ['FAILED', 'UNKNOWN']) { const a = summarizeAgentExecutions([row('RSI-01', state)], now).agents[0]; assert.equal(a.state, state); assert.equal(a.executionProven, false); }
});
test('running and abandoned markers cannot inherit an old completion receipt', () => {
  const r = row(); r.fields['Execution State'] = 'RUNNING';
  let a = summarizeAgentExecutions([r], now).agents[0]; assert.equal(a.state, 'RUNNING'); assert.equal(a.executionProven, false);
  a = summarizeAgentExecutions([r], now + 46 * 60000).agents[0]; assert.equal(a.state, 'UNKNOWN'); assert.equal(a.code, 'STALE_RUNNING');
});
test('telemetry strips email, source identifiers, actor and free-text evidence', () => {
  const r = row(); const receipt = JSON.parse(r.fields['Execution Receipt']);
  receipt.actor = 'private@example.com'; receipt.tools[0].evidenceRef = 'secret-private-reference';
  receipt.actions[0].result = 'customer email private@example.com'; receipt.nextAction = 'Call private@example.com';
  r.fields['Execution Receipt'] = JSON.stringify(receipt);
  const data = JSON.stringify(summarizeAgentExecutions([r], now));
  assert.doesNotMatch(data, /private@example|secret-private-reference|sourceRecordId/);
});
test('provider errors and incomplete pagination do not produce a successful diagnostic', async t => {
  const old = process.env.AIRTABLE_TOKEN; process.env.AIRTABLE_TOKEN = 'test-only';
  t.after(() => { if (old === undefined) delete process.env.AIRTABLE_TOKEN; else process.env.AIRTABLE_TOKEN = old; });
  await assert.rejects(getAgentExecutionStatus(async () => Response.json({}, { status: 403 }), now));
  await assert.rejects(getAgentExecutionStatus(async () => Response.json({ records: [row()], offset: 'repeated' }), now));
  const pages = [{ records: [row()], offset: 'page2' }, { records: [row('RSI-02'), row('RSI-03')] }];
  const result = await getAgentExecutionStatus(async url => { assert.equal(new URL(url).hostname, 'api.airtable.com'); return Response.json(pages.shift()); }, now);
  assert.equal(result.allExecutionsProven, true);
});
test('API authenticates every request and never writes on diagnostic route', async t => {
  const old = process.env.PARTNER_API_TOKEN, fetcher = globalThis.fetch; process.env.PARTNER_API_TOKEN = 'test-only';
  let calls = 0; globalThis.fetch = async () => { calls++; return Response.json({ records: [] }); };
  t.after(() => { globalThis.fetch = fetcher; if (old === undefined) delete process.env.PARTNER_API_TOKEN; else process.env.PARTNER_API_TOKEN = old; });
  const res = () => ({ headers: {}, setHeader(k,v) { this.headers[k]=v; }, status(n) { this.statusCode=n; return this; }, json(v) { this.body=v; return this; } });
  for (const method of ['GET', 'POST', 'PATCH']) { const r=res(); await partners({ url:'/api/partners?action=rsi-agents', method, headers:{} },r); assert.equal(r.statusCode,401); assert.equal(r.headers['Cache-Control'],'no-store'); }
  const r=res(); await partners({ url:'/api/partners?action=rsi-agents', method:'POST', headers:{authorization:'Bearer test-only'} },r); assert.equal(r.statusCode,405); assert.equal(calls,0);
});
