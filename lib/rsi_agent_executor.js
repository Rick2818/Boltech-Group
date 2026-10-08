import crypto from 'node:crypto';
import pilot from '../config/commercial_pilot.json' with { type: 'json' };
import { redisCommand } from './rsi_handoff_store.js';
import { paginationGuard } from './store_pagination.js';
import { RSI_ROLES, validateExecutionReceipt } from './rsi_agent_status.js';
import { getOperatingCostMetrics, summarizeA2A } from './commercial_strategy.js';
import { getVerifiedSalesMetrics } from './payment_store.js';
import { listPartners, listReferrals } from './airtable_partner_store.js';
import { buildCommercialRoutes, mergeCommercialPacket } from './rsi_commercial_routes.js';
import { buildMarketingSupport, mergeMarketingSupport } from './marketing_sales_support.js';
import {createRsi03Closing} from './rsi03_closing.js';
import {createInteragentCoordinator} from './interagent_coordinator.js';
import {createRsi01Followups} from './rsi01_followups.js';
import {createCommercialRelay} from './commercial_relay.js';

export const RSI_EXECUTOR_VERSION = 9;

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
  costs = getOperatingCostMetrics, sales = getVerifiedSalesMetrics, partners = listPartners, referrals = listReferrals,
  closing = work => createRsi03Closing().runNext(work),
  followups = () => createRsi01Followups().run(),
  relay = (role,context) => createCommercialRelay({request,registerClosing:row=>createRsi03Closing().register(row)}).run(role,context),
  marketingCycle = async rsi=>{const worker=createInteragentCoordinator();if(rsi==='MARKETING')return worker.marketing.metrics();const pending=(await worker.queue(rsi)).pending;for(const row of pending.filter(r=>r.execution?.status==='PENDING_AUTHORIZED_EXECUTION').slice(0,5))await worker.executePending({from:rsi,eventId:row.eventId});const rows=pending.filter(r=>r.material).slice(0,5);const checks=[];for(const row of rows){await worker.marketing.review({from:rsi,eventId:row.eventId,materialFingerprint:row.material.fingerprint});checks.push(await worker.marketing.reconcile({from:rsi,eventId:row.eventId}));}return {reviewed:rows.length,historyChecks:checks,sendingPerformed:false,saleInferred:false};} } = {}) {
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
        const marketing = buildMarketingSupport(packet);
        const evidence = mergeMarketingSupport(mergeCommercialPacket(bootstrap.fields.Evidence, packet), marketing);
        if (evidence !== (bootstrap.fields.Evidence || '')) {
          const current = (await list(WORK, request)).find(w=>w.id===bootstrap.id);
          if (current?.fields['Execution Run ID'] !== runId) fail('RSI_EXECUTION_OWNERSHIP_LOST',409);
          const latestEvidence = mergeMarketingSupport(mergeCommercialPacket(current.fields.Evidence, packet), marketing);
          await patch({Evidence:latestEvidence,'Next Action':packet.nextAction,'Updated At':now()});
          const saved = (await list(WORK, request)).find(w=>w.id===bootstrap.id);
          if (saved?.fields.Evidence !== latestEvidence || saved.fields['Next Action'] !== packet.nextAction) fail('RSI_EXECUTION_WRITE_UNCONFIRMED');
        }
        receipt.actions.push({type:'COMMERCIAL_PREPARATION_PERSISTED',sourceRecordId:bootstrap.id,evidenceRef:packet.fingerprint,
          result:{mode:packet.mode,queue:packet.queue,preparedAccounts:packet.accounts.length,routes:packet.accounts.map(a=>a.route),salesVerified:false}});
        receipt.actions.push({type:'MARKETING_SUPPORT_PERSISTED',sourceRecordId:bootstrap.id,evidenceRef:marketing.fingerprint,
          result:{owner:marketing.owner,requests:marketing.requests.length,languages:['es','en'],salesAcceptance:'UNCONFIRMED',sendingEnabled:false,saleVerified:false}});
        const adoption=await observe('marketing_material_sales_review',bootstrap.id,()=>marketingCycle(rsi));
        receipt.actions.push({type:'MARKETING_ACCEPTANCE_RECORDED',sourceRecordId:bootstrap.id,result:adoption});
        receipt.nextAction=packet.nextAction;
      };
      try {
        if (rsi === 'RSI-01') {
          const leads = await observe('airtable_leads_read', LEADS, () => list(LEADS, request));
          await prepare(leads);
          const followup=await observe('rsi01_authorized_followup_dispatch',bootstrap.id,followups);
          receipt.actions.push({type:'RSI01_PROACTIVE_FOLLOWUP',sourceRecordId:bootstrap.id,result:followup});
          const relayed=await observe('rsi01_customer_reply_handoff',bootstrap.id,()=>relay(rsi,{leads,followup,bootstrapId:bootstrap.id,runId}));
          receipt.actions.push({type:'RSI01_TO_RSI02_HANDOFF',sourceRecordId:bootstrap.id,result:relayed});
          if(followup.results?.some(r=>['BLOCKED','FAILED','UNKNOWN','SEND_PENDING'].includes(r.state)))receipt.blockers.push('RSI01_FOLLOWUP_REVIEW_REQUIRED');
          receipt.nextAction='RSI-01 monitors and executes the scoped authorized follow-up in the existing hourly cycle; replies go to RSI-02, holds require review, uncertain sends are never repeated.';
          const rows = leads.filter(l=>/^RSI-01(?: US)?$/.test(l.fields['Experiment Cohort']||'') && l.fields['Data Quality'] !== 'QA' && !qa.test(l.fields.Name||''));
          const incomplete = rows.filter(l=>l.fields['Data Quality'] === 'INCOMPLETE' || !l.fields['Contact Email'] || !l.fields['Buyer Role'] || !l.fields['Source Evidence URL']);
          receipt.actions.push({type:'QUALIFICATION_REVIEW',sourceRecordId:bootstrap.id,evidenceRef:LEADS,result:{reviewedAccounts:rows.length,incompleteAccounts:incomplete.length,confirmedProblems:rows.filter(l=>l.fields['Problem Confirmed']===true).length}});
          receipt.blockers.push('LIVE_APOLLO_GMAIL_HISTORY_REQUIRED');
          if (incomplete.length) receipt.blockers.push('BUYER_OR_CONTACT_EVIDENCE_MISSING');
        } else if (rsi === 'RSI-02') {
          await prepare(await observe('airtable_leads_read', LEADS, () => list(LEADS, request)));
          const relayed=await observe('rsi02_incoming_case_consumer',bootstrap.id,()=>relay(rsi,{bootstrapId:bootstrap.id,runId}));
          receipt.actions.push({type:'RSI02_CASE_RELAY',sourceRecordId:bootstrap.id,result:relayed});
          if(relayed.results?.some(r=>r.state==='WAITING_DIRECTOR_APPROVAL'))receipt.blockers.push('WAITING_DIRECTOR_SCOPE_APPROVAL');
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
        } else if (rsi === 'MARKETING') {
          const leads = await observe('airtable_leads_read', LEADS, () => list(LEADS, request));
          const support = ['RSI-01','RSI-02','RSI-03'].map(role => buildMarketingSupport(buildCommercialRoutes(role, leads)));
          const adoption=await observe('marketing_adoption_metrics',bootstrap.id,()=>marketingCycle('MARKETING'));
          const content = JSON.stringify({owner:'MARKETING', support, adoption, sendingEnabled:false, salesAcceptance:adoption.accepted>0?'MEASURED_ACCEPTANCE':'UNCONFIRMED'});
          const block = `[MARKETING_TEAM_SUPPORT_V1]\n${content}\n[/MARKETING_TEAM_SUPPORT_V1]`;
          const current = (await list(WORK,request)).find(w=>w.id===bootstrap.id);
          if(current?.fields['Execution Run ID']!==runId) fail('RSI_EXECUTION_OWNERSHIP_LOST',409);
          const previous = current.fields.Evidence || '';
          const evidence = previous.includes('[MARKETING_TEAM_SUPPORT_V1]') ? previous.replace(/\[MARKETING_TEAM_SUPPORT_V1\][\s\S]*?\[\/MARKETING_TEAM_SUPPORT_V1\]/,block) : `${previous}\n${block}`;
          const nextAction = 'Deliver materials to existing sales agents; record their acceptance and actual customer response. Do not infer sending or a sale.';
          if(evidence!==previous) {
            await patch({Evidence:evidence,'Next Action':nextAction,'Updated At':now()});
            const saved=(await list(WORK,request)).find(w=>w.id===bootstrap.id);
            if(saved?.fields.Evidence!==evidence) fail('RSI_EXECUTION_WRITE_UNCONFIRMED');
          }
          receipt.actions.push({type:'MARKETING_TEAM_SUPPORT_PERSISTED',sourceRecordId:bootstrap.id,evidenceRef:crypto.createHash('sha256').update(content).digest('hex'),result:{salesAgents:3,requests:support.reduce((n,p)=>n+p.requests.length,0),adoption,sendingEnabled:false,salesAcceptance:adoption.accepted>0?'MEASURED_ACCEPTANCE':'UNCONFIRMED'}});
          receipt.nextAction=nextAction;
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
          if(!pilot.paymentEnabled&&!pilot.approvedQuoteClosingEnabled) receipt.blockers.push('PILOT_CHECKOUT_DISABLED');
          const relayed=await observe('rsi03_incoming_approved_case_consumer',bootstrap.id,()=>relay(rsi,{bootstrapId:bootstrap.id,runId}));
          receipt.actions.push({type:'RSI03_CASE_RELAY',sourceRecordId:bootstrap.id,result:relayed});
          const close=await observe('rsi03_approved_case_closing_cycle',WORK,()=>closing(work));
          receipt.actions.push({type:'RSI03_CLOSING_CYCLE',sourceRecordId:bootstrap.id,evidenceRef:close.approvalRecordId||WORK,result:close});
          if(close.state==='BLOCKED'){
            receipt.blockers.push(close.code||'CLOSE_TOOL_UNAVAILABLE');
            receipt.tools.push({name:'rsi03_closing_step',status:'FAILED',observedAt:now()});
          }else if(close.state==='WAITING_QUALIFIED_APPROVED_CASE') receipt.blockers.push('WAITING_QUALIFIED_APPROVED_CASE');
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
