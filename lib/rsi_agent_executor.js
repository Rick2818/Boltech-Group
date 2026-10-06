import crypto from 'node:crypto';
import pilot from '../config/commercial_pilot.json' with { type: 'json' };
import { redisCommand } from './rsi_handoff_store.js';
import { paginationGuard } from './store_pagination.js';
import { RSI_ROLES, validateExecutionReceipt } from './rsi_agent_status.js';
import { getOperatingCostMetrics, summarizeA2A } from './commercial_strategy.js';
import { getVerifiedSalesMetrics } from './payment_store.js';
import { listPartners, listReferrals } from './airtable_partner_store.js';
import { buildCommercialRoutes, mergeCommercialPacket } from './rsi_commercial_routes.js';

export const RSI_EXECUTOR_VERSION = 2;

const WORK = 'tblHVqUMifOFjlGvj', LEADS = 'tblZaox2MX5uYA5PZ';
const fail = (code, statusCode = 503) => { throw Object.assign(new Error(code), { code, statusCode }); };
const qa = /(?:^|[^a-z])(qa|test|sandbox|synthetic)(?:[^a-z]|$)/i;
export async function agentTableRequest(table, { method = 'GET', body, offset } = {}) {
  const token = String(process.env.AIRTABLE_TOKEN || process.env.AIRTABLE_PAT || '').trim();
  if (!token) fail('RSI_AGENT_STORE_NOT_CONFIGURED');
  const base = process.env.AIRTABLE_BASE_ID || 'appCQZd0IhBHFoZ9P';
  const url = new URL(`https://api.airtable.com/v0/${encodeURIComponent(base)}/${table}`);
  if (method === 'GET') { url.searchParams.set('pageSize', '100'); if (offset) url.searchParams.set('offset', offset); }
  const response = await fetch(url, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(8000) });
  if (!response.ok) fail('RSI_AGENT_STORE_UNAVAILABLE');
  const data = await response.json();
  if (!Array.isArray(data.records)) fail('RSI_AGENT_STORE_INVALID');
  return data;
}
async function list(table, request) {
  let offset; const records = []; const next = paginationGuard(1000, 20);
  do { const page = await request(table, { offset }); offset = next(page); records.push(...page.records); } while (offset);
  return records;
}
const iso = value => typeof value === 'string' && Number.isFinite(Date.parse(value));
export function analyzeAcceptedResponseAudit(authorization) {
  if (!authorization || authorization.accepted !== true || authorization.kind !== 'RESPONSE_LOG_ANALYSIS' ||
      typeof authorization.evidenceRef !== 'string' || !authorization.evidenceRef.trim() ||
      !Array.isArray(authorization.samples) || !authorization.samples.length || authorization.samples.length > 1000)
    fail('AUDIT_ACCEPTANCE_OR_DATA_MISSING', 409);
  const useful = [], automatic = [], resolved = []; let unanswered = 0;
  for (const sample of authorization.samples) {
    if (!sample || !iso(sample.receivedAt)) fail('AUDIT_INVALID_SAMPLE', 409);
    const received = Date.parse(sample.receivedAt);
    for (const [key, values] of [['automaticResponseAt', automatic], ['usefulResponseAt', useful], ['resolvedAt', resolved]]) {
      if (sample[key] == null) continue;
      if (!iso(sample[key]) || Date.parse(sample[key]) < received) fail('AUDIT_INVALID_SAMPLE', 409);
      values.push(Date.parse(sample[key]) - received);
    }
    if (!sample.usefulResponseAt) unanswered++;
  }
  const median = values => { if (!values.length) return null; const s=[...values].sort((a,b)=>a-b), m=Math.floor(s.length/2); return s.length%2?s[m]:(s[m-1]+s[m])/2; };
  return { sampleSize: authorization.samples.length, unansweredUseful: unanswered,
    automaticMedianMs: median(automatic), usefulMedianMs: median(useful), resolutionMedianMs: median(resolved),
    evidenceRef: authorization.evidenceRef, basis: 'Authorized customer-supplied timestamps; no simulated buyers, SMTP sends or independent validation of the customer log.',
    limits: 'Elapsed time only; not business-hour-adjusted. No causal ROI or full-population SLA inferred.' };
}

export function createRsiExecutor({ command = redisCommand, request = agentTableRequest, now = () => new Date().toISOString(),
  costs = getOperatingCostMetrics, sales = getVerifiedSalesMetrics, partners = listPartners, referrals = listReferrals } = {}) {
  async function run({ rsi, cycleId }) {
    if (!RSI_ROLES.includes(rsi) || typeof cycleId !== 'string' || !/^[a-zA-Z0-9_.:-]{1,120}$/.test(cycleId)) fail('RSI_INVALID_EXECUTION_INPUT', 400);
    const ledger = `boltech:rsi:execution:${rsi}:${cycleId}`, lock = `boltech:rsi:executor-lock:${rsi}`;
    const previous = await command(['GET', ledger]);
    if (previous) {
      const saved = JSON.parse(previous);
      if (saved.state === 'FINISHED') return { receipt: saved.receipt, reused: true };
      fail('RSI_EXECUTION_RECONCILE_REQUIRED', 409);
    }
    const lease = crypto.randomUUID();
    if (await command(['SET', lock, lease, 'NX', 'PX', 120000]) !== 'OK') fail('RSI_EXECUTOR_BUSY', 409);
    const startedAt = now(), runId = `${rsi}:${startedAt}`;
    const receipt = { schemaVersion: 1, runId, rsi, actor: `Boltech cloud executor ${rsi}`, startedAt,
      tools: [], actions: [], blockers: [], nextAction: '' };
    let bootstrap;
    const observe = async (name, evidenceRef, fn) => {
      try { const result = await fn(); receipt.tools.push({ name, status:'VERIFIED', evidenceRef, observedAt:now() }); return result; }
      catch { receipt.tools.push({ name, status:'FAILED', observedAt:now() }); throw Object.assign(new Error('RSI_TOOL_UNAVAILABLE'),{code:'RSI_TOOL_UNAVAILABLE'}); }
    };
    const patch = async fields => {
      const data = await request(WORK, { method:'PATCH', body:{records:[{id:bootstrap.id,fields}]} });
      if (data.records.length !== 1 || data.records[0].id !== bootstrap.id) fail('RSI_EXECUTION_WRITE_UNCONFIRMED');
    };
    try {
      const work = await observe('airtable_work_read', WORK, () => list(WORK, request));
      const matches = work.filter(w=>w.fields['Work ID'] === `BOOTSTRAP:${rsi}`);
      if (matches.length !== 1) fail('RSI_BOOTSTRAP_NOT_UNIQUE', 409);
      bootstrap = matches[0];
      if (bootstrap.fields['Execution State'] === 'RUNNING' || bootstrap.fields['Execution State'] === 'UNKNOWN') fail('RSI_EXECUTION_RECONCILE_REQUIRED', 409);
      if (await command(['SET', ledger, JSON.stringify({state:'RUNNING',runId,startedAt}), 'NX']) !== 'OK') fail('RSI_EXECUTION_RECONCILE_REQUIRED',409);
      await patch({'Execution Run ID':runId,'Execution State':'RUNNING','Execution Started At':startedAt,'Execution Finished At':'','Execution Receipt':''});
      const start = (await list(WORK,request)).find(w=>w.id===bootstrap.id);
      if (start?.fields['Execution Run ID'] !== runId || start.fields['Execution State'] !== 'RUNNING') fail('RSI_EXECUTION_OWNERSHIP_LOST',409);
      const prepare = async leads => {
        const packet = buildCommercialRoutes(rsi, leads);
        const evidence = mergeCommercialPacket(bootstrap.fields.Evidence, packet);
        if (evidence !== (bootstrap.fields.Evidence || '')) {
          const current = (await list(WORK, request)).find(w=>w.id===bootstrap.id);
          if (current?.fields['Execution Run ID'] !== runId) fail('RSI_EXECUTION_OWNERSHIP_LOST',409);
          const latestEvidence = mergeCommercialPacket(current.fields.Evidence, packet);
          await patch({Evidence:latestEvidence,'Next Action':packet.nextAction,'Updated At':now()});
          const saved = (await list(WORK, request)).find(w=>w.id===bootstrap.id);
          if (saved?.fields.Evidence !== latestEvidence || saved.fields['Next Action'] !== packet.nextAction) fail('RSI_EXECUTION_WRITE_UNCONFIRMED');
        }
        receipt.actions.push({type:'COMMERCIAL_PREPARATION_PERSISTED',sourceRecordId:bootstrap.id,evidenceRef:packet.fingerprint,
          result:{mode:packet.mode,queue:packet.queue,preparedAccounts:packet.accounts.length,routes:packet.accounts.map(a=>a.route),salesVerified:false}});
        receipt.nextAction=packet.nextAction;
      };
      try {
        if (rsi === 'RSI-01') {
          const leads = await observe('airtable_leads_read', LEADS, () => list(LEADS, request));
          await prepare(leads);
          const rows = leads.filter(l=>/^RSI-01(?: US)?$/.test(l.fields['Experiment Cohort']||'') && l.fields['Data Quality'] !== 'QA' && !qa.test(l.fields.Name||''));
          const incomplete = rows.filter(l=>l.fields['Data Quality'] === 'INCOMPLETE' || !l.fields['Contact Email'] || !l.fields['Buyer Role'] || !l.fields['Source Evidence URL']);
          receipt.actions.push({type:'QUALIFICATION_REVIEW',sourceRecordId:bootstrap.id,evidenceRef:LEADS,result:{reviewedAccounts:rows.length,incompleteAccounts:incomplete.length,confirmedProblems:rows.filter(l=>l.fields['Problem Confirmed']===true).length}});
          receipt.blockers.push('LIVE_APOLLO_GMAIL_HISTORY_REQUIRED');
          if (incomplete.length) receipt.blockers.push('BUYER_OR_CONTACT_EVIDENCE_MISSING');
        } else if (rsi === 'RSI-02') {
          await prepare(await observe('airtable_leads_read', LEADS, () => list(LEADS, request)));
          const accepted = work.filter(w=>w.fields.RSI===rsi && w.fields.Status==='AUDIT_ACCEPTED');
          if (accepted.length) {
            const task=accepted[0]; let authorization;
            try { authorization=JSON.parse(task.fields.Authorization); } catch { fail('AUDIT_ACCEPTANCE_OR_DATA_MISSING',409); }
            const report=analyzeAcceptedResponseAudit(authorization);
            const evidence = `${task.fields.Evidence||''}\n[${runId}] ${JSON.stringify(report)}`;
            const updated=await request(WORK,{method:'PATCH',body:{records:[{id:task.id,fields:{Status:'AUDIT_ANALYZED',Evidence:evidence,'Updated At':now()}}]}});
            if(updated.records[0]?.id!==task.id) fail('RSI_EXECUTION_WRITE_UNCONFIRMED');
            const reread=(await list(WORK,request)).find(w=>w.id===task.id);
            if(reread?.fields.Status!=='AUDIT_ANALYZED'||!reread.fields.Evidence.includes(runId)) fail('RSI_EXECUTION_WRITE_UNCONFIRMED');
            receipt.tools.push({name:'authorized_response_log_analysis',status:'VERIFIED',evidenceRef:task.id,observedAt:now()});
            receipt.actions.push({type:'AUDIT_ANALYZED',sourceRecordId:task.id,evidenceRef:authorization.evidenceRef,result:'Response-time report persisted; customer data scope and limitations retained'});
            receipt.nextAction='Sales agent prepares the evidence-based proposal using the approved pilot scope and transfers it to RSI-03; no automatic sending or payment.';
          } else {
            receipt.actions.push({type:'COMMERCIAL_DIAGNOSIS_PREPARED',sourceRecordId:bootstrap.id,evidenceRef:WORK,
              result:'Qualification questions and pilot scope prepared; no customer need or acceptance inferred. Response-log audit is optional.'});
          }
        } else {
          // A failed lead source must not suppress independent cost/payment/partner work.
          try { await prepare(await observe('airtable_leads_read', LEADS, () => list(LEADS, request))); }
          catch (error) { receipt.blockers.push('COMMERCIAL_PREPARATION_UNAVAILABLE'); receipt.nextAction='Restore private commercial preparation; continue independent partner, cost and payment review.'; }
          const values=await Promise.allSettled([
            observe('airtable_partner_read','Partners',partners),observe('airtable_referral_read','Referrals',referrals),
            observe('cost_evidence_read','OperatingCosts',costs),observe('provider_confirmed_payment_ledger_read','PaymentOrders',sales)
          ]);
          const get=i=>values[i].status==='fulfilled'?values[i].value:null;
          const p=get(0),rf=get(1),c=get(2),cash=get(3);
          const network=p&&rf?summarizeA2A(p,rf):null;
          receipt.actions.push({type:'REFERRAL_COST_PAYMENT_REVIEW',sourceRecordId:bootstrap.id,evidenceRef:WORK,result:{network,costs:c,cash,pilotPaymentEnabled:pilot.paymentEnabled}});
          if(values.some(v=>v.status==='rejected')) receipt.blockers.push('RSI_SOURCE_UNAVAILABLE');
          if(!network?.enabledPartners) receipt.blockers.push('WAITING_VERIFIED_PARTNER');
          if(!c?.complete) receipt.blockers.push('COST_EVIDENCE_INCOMPLETE');
          if(!pilot.paymentEnabled) receipt.blockers.push('PILOT_CHECKOUT_DISABLED');
        }
        receipt.outcome = receipt.tools.some(t=>t.status==='FAILED')?'BLOCKED':'COMPLETED';
      } catch (error) {
        receipt.outcome='BLOCKED'; receipt.blockers.push(/^[A-Z_]+$/.test(error.code||'')?error.code:'RSI_EXECUTION_FAILED');
        receipt.nextAction='Resolve the recorded source, scope or write failure; reconcile any uncertain mutation before retrying.';
      }
      receipt.finishedAt=now();
      // Result objects stay private; telemetry reports only aggregate counts and codes.
      const normalized={...receipt,actions:receipt.actions.map(a=>({...a,result:typeof a.result==='string'?a.result:JSON.stringify(a.result)}))};
      const fields={'Execution Run ID':runId,'Execution State':receipt.outcome,'Execution Started At':startedAt,'Execution Finished At':receipt.finishedAt,'Execution Receipt':JSON.stringify(normalized)};
      if(!validateExecutionReceipt(fields,rsi,Date.parse(receipt.finishedAt))) fail('RSI_EXECUTION_RECEIPT_INVALID');
      const current=(await list(WORK,request)).find(w=>w.id===bootstrap.id);
      if(current?.fields['Execution Run ID']!==runId) fail('RSI_EXECUTION_OWNERSHIP_LOST',409);
      await patch(fields);
      const persisted=(await list(WORK,request)).find(w=>w.id===bootstrap.id);
      if(persisted?.fields['Execution Receipt']!==fields['Execution Receipt']) fail('RSI_EXECUTION_WRITE_UNCONFIRMED');
      const saved={state:'FINISHED',receipt:validateExecutionReceipt(fields,rsi,Date.parse(receipt.finishedAt))};
      const finish=await command(['EVAL',"if redis.call('GET', KEYS[1]) ~= ARGV[1] then return 'LEASE_LOST' end redis.call('SET', KEYS[2], ARGV[2]) return 'OK'",2,lock,ledger,lease,JSON.stringify(saved)]);
      if(finish!=='OK') fail('RSI_EXECUTION_OWNERSHIP_LOST',409);
      return {receipt:saved.receipt,reused:false};
    } finally {
      await command(['EVAL',"if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) end return 0",1,lock,lease]);
    }
  }
  return {run};
}
