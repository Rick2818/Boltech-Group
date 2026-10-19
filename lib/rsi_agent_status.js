import { paginationGuard } from './store_pagination.js';

// Legacy wire/storage keys only. Public agent names are A1/A2/A3/MKT; RSI denotes recursive self-improvement.
export const RSI_ROLES = Object.freeze(['RSI-01', 'RSI-02', 'RSI-03', 'MARKETING']);
export const AGENT_NAMES = Object.freeze({'RSI-01':'A1','RSI-02':'A2','RSI-03':'A3','MARKETING':'MKT'});
export const agentName = role => AGENT_NAMES[role] || role;
const states = new Set(['RUNNING', 'COMPLETED', 'BLOCKED', 'FAILED', 'UNKNOWN']);
const terminal = new Set(['COMPLETED', 'BLOCKED', 'FAILED', 'UNKNOWN']);
const iso = value => typeof value === 'string' && /^\d{4}-\d\d-\d\dT/.test(value) && Number.isFinite(Date.parse(value));
const safeCode = value => typeof value === 'string' && /^[A-Z][A-Z0-9_:-]{0,100}$/.test(value);

// A receipt proves a recorded cycle, never a sale, provider payment or exactly-once execution.
export function validateExecutionReceipt(fields, rsi, now = Date.now()) {
  let receipt;
  try { receipt = JSON.parse(fields['Execution Receipt']); } catch { return null; }
  if (!receipt || receipt.schemaVersion !== 1 || receipt.rsi !== rsi ||
      typeof receipt.actor !== 'string' || !receipt.actor.trim() ||
      receipt.runId !== fields['Execution Run ID'] ||
      !new RegExp(`^${rsi}:[0-9TZ:.+-]+$`).test(receipt.runId || '') ||
      !terminal.has(receipt.outcome) || receipt.outcome !== fields['Execution State'] ||
      !iso(receipt.startedAt) || !iso(receipt.finishedAt) ||
      receipt.startedAt !== fields['Execution Started At'] || receipt.finishedAt !== fields['Execution Finished At'] ||
      Date.parse(receipt.startedAt) > Date.parse(receipt.finishedAt) || Date.parse(receipt.finishedAt) > now + 60000 ||
      !Array.isArray(receipt.tools) || !receipt.tools.length || receipt.tools.length > 100 ||
      !Array.isArray(receipt.actions) || receipt.actions.length > 100 ||
      !Array.isArray(receipt.blockers) || !receipt.blockers.every(safeCode) ||
      typeof receipt.nextAction !== 'string' || !receipt.nextAction.trim()) return null;
  const validTools = receipt.tools.every(tool => tool && typeof tool.name === 'string' &&
    /^[a-zA-Z0-9_.:-]{1,140}$/.test(tool.name) && ['VERIFIED', 'FAILED', 'UNAVAILABLE'].includes(tool.status) &&
    iso(tool.observedAt) && Date.parse(tool.observedAt) >= Date.parse(receipt.startedAt) - 60000 &&
    Date.parse(tool.observedAt) <= Date.parse(receipt.finishedAt) + 60000 &&
    (tool.status !== 'VERIFIED' || (typeof tool.evidenceRef === 'string' && tool.evidenceRef.trim())));
  if (!validTools || (receipt.outcome === 'COMPLETED' && !receipt.tools.some(t => t.status === 'VERIFIED'))) return null;
  if (!receipt.actions.every(a => a && typeof a.type === 'string' && a.type && typeof a.result === 'string' && a.result)) return null;
  let platformResearch;
  try {
    const action=receipt.actions.find(a=>a.type==='RSI01_PLATFORM_RESEARCH');
    if(action){const p=JSON.parse(action.result);platformResearch={
      sources:(p.sources||[]).filter(s=>['UPWORK','N8N_COMMUNITY'].includes(s.source)).map(s=>({source:s.source,status:s.status==='OBSERVED'?'OBSERVED':'BLOCKED',observed:Number.isInteger(s.observed)?s.observed:0,...(safeCode(s.code)?{code:s.code}:{})})),
      stored:Number.isInteger(p.stored)?p.stored:0,verifiedBusinessLeads:0,sendingEnabled:false};}
  } catch { platformResearch={sources:[],stored:0,code:'PLATFORM_RECEIPT_INVALID',verifiedBusinessLeads:0,sendingEnabled:false}; }
  let platformReview;
  try {
    const action=receipt.actions.find(a=>a.type==='RSI01_PLATFORM_REVIEW');
    if(action){const review=JSON.parse(action.result);platformReview={assessed:Number.isInteger(review.assessed)?review.assessed:0,failed:Number.isInteger(review.failed)?review.failed:0,sendingEnabled:false,verifiedBusinessLeads:0};}
  }catch{platformReview={assessed:0,failed:1,sendingEnabled:false,verifiedBusinessLeads:0};}
  // Only aggregate/private-safe fields cross the telemetry boundary. Free text stays in Airtable.
  return { schemaVersion: 1, runId: receipt.runId, rsi, agent:agentName(rsi), engine: receipt.actor === `Boltech cloud executor ${rsi}` ? 'VERCEL_EXECUTOR' : 'SALES_AUTOMATION', startedAt: receipt.startedAt,
    finishedAt: receipt.finishedAt, outcome: receipt.outcome,
    tools: receipt.tools.map(t => ({ name: t.name, status: t.status, observedAt: t.observedAt })),
    actionCount: receipt.actions.length, blockers: receipt.blockers, ...(platformResearch?{platformResearch}:{}),...(platformReview?{platformReview}:{}) };
}

export function summarizeAgentExecutions(records, now = Date.now()) {
  const agents = RSI_ROLES.map(rsi => {
    const rows = records.filter(r => r.fields?.['Work ID'] === `BOOTSTRAP:${rsi}`);
    if (rows.length !== 1) return { rsi, agent:agentName(rsi), state: 'UNVERIFIED', code: rows.length ? 'DUPLICATE_BOOTSTRAP' : 'MISSING_BOOTSTRAP', executionProven: false };
    const f = rows[0].fields;
    const state = states.has(f['Execution State']) ? f['Execution State'] : 'UNVERIFIED';
    const running = state === 'RUNNING';
    const staleRun = running && (!iso(f['Execution Started At']) || now - Date.parse(f['Execution Started At']) > 45 * 60000);
    const receipt = running ? null : validateExecutionReceipt(f, rsi, now);
    return { rsi, agent:agentName(rsi), state: staleRun ? 'UNKNOWN' : state,
      executionProven: Boolean(receipt && ['COMPLETED', 'BLOCKED'].includes(receipt.outcome)),
      code: staleRun ? 'STALE_RUNNING' : running ? 'EXECUTION_IN_PROGRESS' : receipt ? null : 'RECEIPT_NOT_VERIFIED',
      lastStartedAt: iso(f['Execution Started At']) ? f['Execution Started At'] : null,
      lastFinishedAt: receipt?.finishedAt || null,
      receiptAgeMinutes: receipt ? Math.max(0, Math.floor((now - Date.parse(receipt.finishedAt)) / 60000)) : null,
      receipt };
  });
  return { contractVersion: 1, generatedAt: new Date(now).toISOString(), agents,
    allExecutionsProven: agents.every(a => a.executionProven),
    definition: 'Validated private recorded cycles, not scheduler uptime, provider verification, sales, cash or delivery. Airtable markers are not transactional locks.' };
}

export async function getAgentExecutionStatus(fetcher = fetch, now = Date.now()) {
  const token = String(process.env.AIRTABLE_TOKEN || process.env.AIRTABLE_PAT || '').trim();
  if (!token) throw Object.assign(new Error('RSI_AGENT_STORE_NOT_CONFIGURED'), { code: 'RSI_AGENT_STORE_NOT_CONFIGURED' });
  const base = process.env.AIRTABLE_BASE_ID || 'appCQZd0IhBHFoZ9P';
  const table = process.env.AIRTABLE_RSI_AGENT_WORK_TABLE_ID || 'tblHVqUMifOFjlGvj';
  const records = []; const nextPage = paginationGuard(); let offset;
  do {
    const url = new URL(`https://api.airtable.com/v0/${encodeURIComponent(base)}/${encodeURIComponent(table)}`);
    url.searchParams.set('pageSize', '100');
    url.searchParams.set('filterByFormula', 'OR({Work ID}="BOOTSTRAP:RSI-01",{Work ID}="BOOTSTRAP:RSI-02",{Work ID}="BOOTSTRAP:RSI-03",{Work ID}="BOOTSTRAP:MARKETING")');
    for (const name of ['Work ID', 'Execution Run ID', 'Execution State', 'Execution Started At', 'Execution Finished At', 'Execution Receipt']) url.searchParams.append('fields[]', name);
    if (offset) url.searchParams.set('offset', offset);
    const response = await fetcher(url, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw Object.assign(new Error('RSI_AGENT_STORE_UNAVAILABLE'), { code: 'RSI_AGENT_STORE_UNAVAILABLE' });
    const page = await response.json(); offset = nextPage(page); records.push(...page.records);
  } while (offset);
  return summarizeAgentExecutions(records, now);
}
