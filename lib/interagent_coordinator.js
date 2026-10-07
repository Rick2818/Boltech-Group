import crypto from 'node:crypto';
import {redisCommand} from './rsi_handoff_store.js';
import {routeSalesMarketingEvent} from './sales_marketing_router.js';
import {buildMarketingSupport} from './marketing_sales_support.js';
import {getOrderByOrderId} from './payment_store.js';
import {createSdrGmail,SDR_SENDER} from './sdr_gmail.js';
import {getWompiTransaction,summarizeWompiTransaction} from './payment_providers.js';
import {acceptanceBody} from './customer_acceptance.js';
const roles=['RSI-01','RSI-02','RSI-03','MARKETING','DIRECTORA'];
const fail=(code,statusCode=400)=>{throw Object.assign(new Error(code),{code,statusCode});};
const id=v=>typeof v==='string'&&/^[a-zA-Z0-9_.:-]{1,120}$/.test(v);
const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
const digest=v=>crypto.createHash('sha256').update(JSON.stringify(canonical(v))).digest('hex');
const legacyDigest=v=>crypto.createHash('sha256').update(JSON.stringify(v)).digest('hex');
export function signInteragent(body,key){return crypto.createHmac('sha256',key).update(JSON.stringify(body)).digest('hex');}
export function authenticateInteragent(body,signature,env=process.env,now=Date.now()){
 let keys;try{keys=JSON.parse(env.INTERAGENT_ROLE_KEYS||'');}catch{fail('INTERAGENT_NOT_CONFIGURED',503);}
 if(!roles.includes(body?.from)||!keys[body.from]||!Number.isFinite(Date.parse(body.signedAt))||Math.abs(now-Date.parse(body.signedAt))>300000)fail('INTERAGENT_AUTH_REQUIRED',401);
 const expected=signInteragent(body,keys[body.from]);
 if(typeof signature!=='string'||signature.length!==expected.length||!crypto.timingSafeEqual(Buffer.from(signature),Buffer.from(expected)))fail('INTERAGENT_AUTH_REQUIRED',401);
 return body.from;
}
async function getLead(recordId){
 if(!/^rec[a-zA-Z0-9]{14}$/.test(recordId))fail('INTERAGENT_OPPORTUNITY_INVALID');
 const token=process.env.AIRTABLE_TOKEN||process.env.AIRTABLE_PAT;if(!token)fail('INTERAGENT_CRM_UNAVAILABLE',503);
 const base=process.env.AIRTABLE_BASE_ID||'appCQZd0IhBHFoZ9P';
 const r=await fetch(`https://api.airtable.com/v0/${base}/tblZaox2MX5uYA5PZ/${recordId}`,{headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(8000)});
 if(!r.ok)fail('INTERAGENT_OPPORTUNITY_UNVERIFIED',409);return r.json();
}
export const EVENT_COMMIT=`local old=redis.call('GET',KEYS[1]); if old then return old end
local current=redis.call('GET',KEYS[2]); if (current or '') ~= ARGV[1] then return 'CONFLICT' end
redis.call('SET',KEYS[1],ARGV[2]);redis.call('SET',KEYS[2],ARGV[3]);redis.call('SADD',KEYS[3],KEYS[1]);return ARGV[2]`;
async function verifyPaymentProvider(paid){
 if(paid.provider!=='WOMPI_SV'||!paid.providerTransactionId)return false;
 const tx=summarizeWompiTransaction(await getWompiTransaction(paid.providerTransactionId));
 return tx.approved===true&&tx.real===true&&tx.id===paid.providerTransactionId&&Number.isFinite(tx.amount)&&Math.abs(tx.amount-paid.expectedAmountUsd)<0.005;
}
export function createInteragentCoordinator({command=redisCommand,lead=getLead,order=getOrderByOrderId,acceptance=id=>createSdrGmail().message(id),gmail=createSdrGmail(),verifyPayment=verifyPaymentProvider,now=()=>new Date().toISOString()}={}){
 const read=async key=>{const s=await command(['GET',key]);return s?JSON.parse(s):null;};
 async function verifyClosure(eventId){
  if(!id(eventId))fail('INTERAGENT_INVALID_EVENT');
  const event=await read(`boltech:interagent:event:${eventId}`);
  if(event?.type!=='CLOSE_REPORTED'||event.from!=='RSI-03'||event.to!=='DIRECTORA')fail('INTERAGENT_CLOSURE_NOT_FOUND',404);
  const [account,paid,closing]=await Promise.all([lead(event.opportunityId),order(event.orderId),read(`boltech:closing:case:${event.opportunityId}`)]);
  if(!paid||paid.status!=='PAID'||paid.environment!=='production'||!['prebuilt','custom'].includes(paid.productId)||!paid.providerEvidence||!paid.paidAt||!Number.isFinite(paid.expectedAmountUsd)||paid.expectedAmountUsd<=0||String(account?.fields?.['Contact Email']).toLowerCase()!==String(paid.customerEmail).toLowerCase()||closing?.orderId!==event.orderId||closing.acceptanceMessageId!==event.acceptanceRef||closing.approval?.approvedAmountUsd!==paid.expectedAmountUsd||closing.approval?.productId!==paid.productId)fail('INTERAGENT_CLOSURE_EVIDENCE_UNVERIFIED',409);
  const message=await acceptance(event.acceptanceRef);
  if(!Number.isFinite(Date.parse(closing.proposal?.sentAt||''))||!Number.isFinite(Date.parse(closing.approval?.expiresAt||'')))fail('INTERAGENT_CLOSURE_EVIDENCE_UNVERIFIED',409);
  if(message?.from!==String(paid.customerEmail).toLowerCase()||message.sent||message.automatic||message.threadId!==closing.threadId||acceptanceBody(message.text)!==closing.acceptanceToken||!Number.isFinite(Date.parse(message.receivedAt))||Date.parse(message.receivedAt)<Date.parse(closing.proposal?.sentAt||'')||Date.parse(message.receivedAt)>Date.parse(closing.approval?.expiresAt||''))fail('INTERAGENT_CUSTOMER_ACCEPTANCE_UNVERIFIED',409);
  if(!await verifyPayment(paid))fail('INTERAGENT_PROVIDER_PAYMENT_UNVERIFIED',409);
  return {eventId:event.eventId,opportunityId:event.opportunityId,orderId:paid.orderId,amountUsd:paid.expectedAmountUsd,verified:true,totalAmountUsd:closing.approval.totalAmountUsd};
 }
 async function submit(input){
  if(!id(input.eventId)||!id(input.opportunityId)||!roles.includes(input.from))fail('INTERAGENT_INVALID_EVENT');
  const {signedAt,operation,...event}=input;const fingerprint=digest(event),eventKey=`boltech:interagent:event:${event.eventId}`;
  const old=await read(eventKey);if(old){if(old.fingerprint!==fingerprint&&old.fingerprint!==legacyDigest(event))fail('INTERAGENT_EVENT_CONFLICT',409);await command(['SADD','boltech:interagent:index',eventKey]);return {...old,reused:true};}
  const row=await lead(event.opportunityId);
  if(!row?.id||row.id!==event.opportunityId)fail('INTERAGENT_OPPORTUNITY_UNVERIFIED',409);
  const f=row.fields||{};if(f['Data Quality']==='QA'||f.Unsubscribed||f['Do Not Contact']||/disqualified|bounced/i.test([f.Status,f['Commercial Stage'],f['Data Quality']].join(' ')))fail('INTERAGENT_OPPORTUNITY_EXCLUDED',409);
  if(event.type==='CLOSE_REPORTED'){
   if(event.from!=='RSI-03'||!id(event.orderId)||!id(event.acceptanceRef))fail('INTERAGENT_CLOSURE_EVIDENCE_REQUIRED');
   const paid=await order(event.orderId);
   if(!paid||paid.status!=='PAID'||paid.environment!=='production'||paid.productId==='payment-verification'||!paid.providerEvidence||!paid.paidAt||!(paid.providerTransactionId||paid.providerInvoiceId)||!Number.isFinite(paid.expectedAmountUsd)||paid.expectedAmountUsd<=0)fail('INTERAGENT_PAYMENT_UNVERIFIED',409);
   const sameEmail=f['Contact Email']&&String(f['Contact Email']).toLowerCase()===String(paid.customerEmail).toLowerCase();
   const domain=value=>{try{return new URL(value.includes('://')?value:'https://'+value).hostname.replace(/^www\./,'').toLowerCase();}catch{return '';}};
   const sameDomain=domain(f['Company URL']||'')&&domain(f['Company URL'])===domain(paid.domain||'');
   if(!sameEmail&&!sameDomain)fail('INTERAGENT_ORDER_ACCOUNT_MISMATCH',409);
   const closing=await read(`boltech:closing:case:${event.opportunityId}`);
   if(!closing||closing.orderId!==event.orderId||closing.acceptanceMessageId!==event.acceptanceRef||!['WAITING_PAYMENT','DIRECTOR_REVIEW'].includes(closing.state)||!closing.proposal?.sentAt)fail('INTERAGENT_ACCEPTANCE_CASE_UNVERIFIED',409);
   if(paid.orderId!==event.orderId||!['prebuilt','custom'].includes(paid.productId)||closing.approval?.productId!==paid.productId||closing.approval?.approvedAmountUsd!==paid.expectedAmountUsd||String(closing.approval?.customerEmail).toLowerCase()!==String(paid.customerEmail).toLowerCase())fail('INTERAGENT_ORDER_SCOPE_MISMATCH',409);
   const accepted=await acceptance(event.acceptanceRef);
   if(!Number.isFinite(Date.parse(closing.proposal.sentAt))||!Number.isFinite(Date.parse(closing.approval?.expiresAt||'')))fail('INTERAGENT_ACCEPTANCE_CASE_UNVERIFIED',409);
   if(accepted?.from!==String(closing.approval?.customerEmail).toLowerCase()||accepted.sent||accepted.automatic||accepted.threadId!==closing.threadId||acceptanceBody(accepted.text)!==closing.acceptanceToken||!Number.isFinite(Date.parse(accepted.receivedAt))||Date.parse(accepted.receivedAt)<Date.parse(closing.proposal.sentAt)||Date.parse(accepted.receivedAt)>Date.parse(now())+60000||Date.parse(accepted.receivedAt)>Date.parse(closing.approval?.expiresAt||''))fail('INTERAGENT_CUSTOMER_ACCEPTANCE_UNVERIFIED',409);
   if(!await verifyPayment(paid))fail('INTERAGENT_PROVIDER_PAYMENT_UNVERIFIED',409);
   const decision={success:true,from:'RSI-03',to:'DIRECTORA',eventId:event.eventId,opportunityId:event.opportunityId,type:event.type,status:'PAYMENT_LEDGER_VERIFIED_DIRECTOR_REVIEW',orderId:paid.orderId,amountUsd:paid.expectedAmountUsd,paymentVerified:true,acceptanceRef:event.acceptanceRef,ricardoNotified:false,notificationChain:['RSI-03','DIRECTORA','RICARDO']};
   const result={...decision,fingerprint,createdAt:now()};const saved=await command(['SET',eventKey,JSON.stringify(result),'NX']);
   if(saved!=='OK'){const existing=await read(eventKey);if(existing?.fingerprint!==fingerprint)fail('INTERAGENT_EVENT_CONFLICT',409);return {...existing,reused:true};}
   // Queue discovery also scans the event index: repair either index after an uncertain mutation by reading first.
   await command(['SADD','boltech:interagent:index',eventKey]);return result;
  }
  if(!['SUPPORT_REQUEST','PROBLEM'].includes(event.type)||!['RSI-01','RSI-02','RSI-03'].includes(event.from))fail('INTERAGENT_INVALID_EVENT');
  const stateKey=`boltech:interagent:case:v2:${event.opportunityId}`;
  let previous=await read(stateKey);
  // Carry forward existing history: a different role, problem or event ID cannot reset the limit.
  if(!previous){
   const keys=await command(['SMEMBERS','boltech:interagent:index']);if(keys.length>1000)fail('INTERAGENT_QUEUE_REVIEW_REQUIRED',503);
   const history=(await Promise.all(keys.map(read))).filter(r=>r?.opportunityId===event.opportunityId&&r.type!=='CLOSE_REPORTED'&&r.problem);
   const last=history.sort((a,b)=>(b.attempt-a.attempt)||b.createdAt.localeCompare(a.createdAt))[0];
   if(last)previous={eventId:last.eventId,attempt:last.attempt,closed:last.to==='DIRECTORA'};
  }
  const storedState=await read(stateKey);
  let attempt=0;
  if(previous){
   if(event.previousEventId!==previous.eventId||!id(event.resultEvidenceRef)||event.previousOutcome!=='FAILED')fail('INTERAGENT_PREVIOUS_RESULT_REQUIRED',409);
   const priorResult=await read(`boltech:interagent:event:${previous.eventId}`);
   const actualFailure=priorResult?.execution?.status==='FAILED'&&priorResult.execution.verified===true&&event.resultEvidenceRef===priorResult.eventId;
   const recordedSalesFailure=priorResult?.salesAcceptance==='FAILED'&&priorResult.ackEvidence===event.resultEvidenceRef;
   if(!actualFailure&&!recordedSalesFailure)fail('INTERAGENT_PREVIOUS_RESULT_UNVERIFIED',409);
   if(previous.closed)fail('INTERAGENT_CASE_ESCALATED',409);attempt=previous.attempt+1;
  }else if(event.attempt&&event.attempt!==0)fail('INTERAGENT_ATTEMPT_INVALID');
  const decision=routeSalesMarketingEvent({...event,attempt});if(!decision.success)fail(decision.code);
  const material=decision.to==='marketing-director'?buildMarketingSupport({rsi:event.from,accounts:[{sourceRecordId:row.id,account:f.Name||'CRM account',route:'REVIEW_COHORT_ELIGIBILITY',gates:['SALES_REVIEW','LIVE_HISTORY_REQUIRED']}]}):null;
  let execution={status:'PENDING_AUTHORIZED_EXECUTION',action:decision.action,verified:false};
  if(decision.to==='DIRECTORA')execution={status:'DIRECTOR_DECISION_REQUIRED',action:decision.action,verified:false};
  else if(decision.action==='PREPARE_ROLE_SPECIFIC_MATERIAL')execution={status:'SUCCEEDED',action:decision.action,verified:!!material,receiptKind:'PERSISTED_ROLE_MATERIAL'};
  else if(['CHECK_STATUS_WITH_READ_ONLY_REQUEST','REVIEW_FIT_AND_HISTORY'].includes(decision.action)){
   try{
    const verified=await gmail.verify();if(verified.verified!==true)fail('INTERAGENT_GMAIL_UNVERIFIED',503);
    let messageCount;
    if(decision.action==='REVIEW_FIT_AND_HISTORY'){
     const email=String(f['Contact Email']||'').toLowerCase();if(!/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(email))fail('INTERAGENT_CONTACT_UNVERIFIED',409);
     const messages=await gmail.search(`from:${email} OR to:${email}`);messageCount=messages.length;
    }
    execution={status:'SUCCEEDED',action:decision.action,verified:true,checkedAt:now(),...(messageCount!==undefined?{messageCount}:{})};
   }catch(error){execution={status:'FAILED',action:decision.action,verified:true,checkedAt:now(),code:/^[A-Z_]+$/.test(error.code||'')?error.code:'INTERAGENT_READ_UNCONFIRMED'};}
  }
  const result={...decision,type:event.type,fingerprint,createdAt:now(),material,deliveredTo:decision.returnTo||'DIRECTORA',usedBySales:false,owner:material?'MARKETING':'DIRECTORA',executionKind:material?'MATERIAL_CREATED':'DIRECTOR_ESCALATION',execution,alternativeExecuted:execution.verified};
  const state={eventId:event.eventId,attempt,closed:decision.to==='DIRECTORA'};
  const raw=await command(['EVAL',EVENT_COMMIT,3,eventKey,stateKey,'boltech:interagent:index',storedState?JSON.stringify(storedState):'',JSON.stringify(result),JSON.stringify(state)]);
  if(raw==='CONFLICT')fail('INTERAGENT_CASE_CONFLICT',409);
  const saved=JSON.parse(raw);if(saved.fingerprint!==fingerprint)fail('INTERAGENT_EVENT_CONFLICT',409);return saved;
 }
 async function queue(actor){
  if(!roles.includes(actor))fail('INTERAGENT_INVALID_ACTOR');
  const keys=await command(['SMEMBERS','boltech:interagent:index']);if(keys.length>1000)fail('INTERAGENT_QUEUE_REVIEW_REQUIRED',503);
  const pending=[];for(const key of keys){const row=await read(key);if(row&&(row.to===actor||row.deliveredTo===actor||(actor==='MARKETING'&&row.owner==='MARKETING'))&&!row.acknowledgedAt)pending.push(row);}
  return {success:true,actor,pending:pending.sort((a,b)=>a.createdAt.localeCompare(b.createdAt)),commercialSaleInferred:false};
 }
 async function acknowledge(input){
  if(!id(input.eventId)||!id(input.evidenceRef))fail('INTERAGENT_ACK_EVIDENCE_REQUIRED');
  const key=`boltech:interagent:event:${input.eventId}`,row=await read(key);if(!row)fail('INTERAGENT_EVENT_NOT_FOUND',404);
  const allowed=row.to==='DIRECTORA'?'DIRECTORA':row.from;
  if(input.from!==allowed)fail('INTERAGENT_ACK_OWNER_MISMATCH',403);
  if(row.to==='DIRECTORA'&&(!id(input.communicationRef)||input.verified!==true))fail('INTERAGENT_NOTIFICATION_RECEIPT_REQUIRED');
  if(row.to==='DIRECTORA'){
   if(row.type==='CLOSE_REPORTED')await verifyClosure(row.eventId);
   const notice=await acceptance(input.communicationRef);
   if(notice?.sent!==true||notice.from!==SDR_SENDER||!String(notice.to).toLowerCase().includes(SDR_SENDER)||!notice.text?.includes(`[BOLTECH_DIRECTOR_NOTICE:${row.eventId}]`))fail('INTERAGENT_NOTIFICATION_UNVERIFIED',409);
  }else{
   const account=await lead(row.opportunityId),message=await acceptance(input.evidenceRef);
   const email=String(account?.fields?.['Contact Email']||'').toLowerCase();
   const recipients=String(message?.to||'').toLowerCase().match(/[a-z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-z0-9.-]+\.[a-z]{2,}/g)||[];
   if(account?.id!==row.opportunityId||!email||!message?.id||message.automatic||!message.text?.trim()||!((message.sent===true&&message.from===SDR_SENDER&&recipients.includes(email))||(!message.sent&&message.from===email&&recipients.includes(SDR_SENDER))))fail('INTERAGENT_SALES_EVIDENCE_UNVERIFIED',409);
  }
  const salesAcceptance=input.outcome==='FAILED'?'FAILED':'ACCEPTED';
  if(row.acknowledgedAt){
   if(row.ackEvidence!==input.evidenceRef||(row.to==='DIRECTORA'?row.communicationRef!==input.communicationRef:row.salesAcceptance!==salesAcceptance||row.usedBySales!==(input.usedBySales===true)))fail('INTERAGENT_ACK_CONFLICT',409);
   return {success:true,eventId:row.eventId,acknowledgedAt:row.acknowledgedAt,reused:true};
  }
  const next={...row,acknowledgedAt:now(),ackEvidence:input.evidenceRef,...(row.to==='DIRECTORA'?{ricardoNotified:true,communicationRef:input.communicationRef}:{salesAcceptance,usedBySales:input.usedBySales===true})};
  const result=await command(['EVAL',"local raw=redis.call('GET',KEYS[1]);if raw~=ARGV[1] then return 'CONFLICT' end;redis.call('SET',KEYS[1],ARGV[2]);return 'OK'",1,key,JSON.stringify(row),JSON.stringify(next)]);
  if(result!=='OK')fail('INTERAGENT_ACK_CONFLICT',409);return {success:true,eventId:row.eventId,acknowledgedAt:next.acknowledgedAt};
 }
 return {submit,queue,acknowledge,verifyClosure};
}
