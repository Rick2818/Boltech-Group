import test from 'node:test';
import assert from 'node:assert/strict';
import {authenticateInteragent,signInteragent,createInteragentCoordinator,EVENT_COMMIT} from '../lib/interagent_coordinator.js';
const keys={'RSI-01':'sales-one','RSI-02':'sales-two','RSI-03':'closer','MARKETING':'marketing','DIRECTORA':'director'};
const opportunityId='rec0123456789abcd';
const event={eventId:'support-one',opportunityId,from:'RSI-01',type:'SUPPORT_REQUEST',problem:'SUPPORT_NEEDED'};
function fixture(){
 const data=new Map(),index=new Set();
 const command=async a=>{
  if(a[0]==='GET')return data.get(a[1])||null;
  if(a[0]==='SET'){if(a.includes('NX')&&data.has(a[1]))return null;data.set(a[1],a[2]);return 'OK';}
  if(a[0]==='SADD'){index.add(a[2]);return 1;}
  if(a[0]==='SMEMBERS')return [...index];
  if(a[0]==='EVAL'&&a[1]===EVENT_COMMIT){const old=data.get(a[3]);if(old)return old;if((data.get(a[4])||'')!==a[6])return 'CONFLICT';data.set(a[3],a[7]);data.set(a[4],a[8]);index.add(a[3]);return a[7];}
  if(a[0]==='EVAL'){if(data.get(a[3])!==a[4])return 'CONFLICT';data.set(a[3],a[5]);return 'OK';}
  throw new Error('Unexpected command');
 };
 const lead=async id=>({id,fields:{Name:'Business fixture','Contact Email':'buyer@example.test'}});
 const paid={orderId:'order-fixture',status:'PAID',environment:'production',productId:'custom',providerEvidence:'provider-receipt',paidAt:'2026-10-07T19:00:00Z',providerTransactionId:'provider-fixture',expectedAmountUsd:495,customerEmail:'buyer@example.test'};
 const accepted={id:'crm-result-one',to:'ricardo.boltechgroup@gmail.com',from:'buyer@example.test',threadId:'customer-thread',text:'ACEPTO BOLTECH-FIXTURE',receivedAt:'2026-10-07T18:50:00Z'};
 data.set(`boltech:closing:case:${opportunityId}`,JSON.stringify({orderId:paid.orderId,acceptanceMessageId:'crm-acceptance',state:'WAITING_PAYMENT',proposal:{sentAt:'2026-10-07T18:40:00Z'},approval:{customerEmail:'buyer@example.test',productId:'custom',approvedAmountUsd:495,totalAmountUsd:990,expiresAt:'2026-10-08T19:00:00Z'},threadId:'customer-thread',acceptanceToken:'ACEPTO BOLTECH-FIXTURE'}));
 return {data,index,command,lead,paid,accepted,worker:createInteragentCoordinator({command,lead,order:async()=>paid,acceptance:async id=>id==='director-message'?{sent:true,from:'ricardo.boltechgroup@gmail.com',to:'ricardo.boltechgroup@gmail.com',text:'[BOLTECH_DIRECTOR_NOTICE:close-one]'}:accepted,verifyPayment:async()=>true,now:()=> '2026-10-07T19:00:00Z'})};
}
test('role signature rejects actor spoofing, expiration and missing configuration',()=>{
 const body={...event,signedAt:'2026-10-07T19:00:00Z'},env={INTERAGENT_ROLE_KEYS:JSON.stringify(keys)},now=Date.parse(body.signedAt);
 assert.equal(authenticateInteragent(body,signInteragent(body,keys['RSI-01']),env,now),'RSI-01');
 assert.throws(()=>authenticateInteragent({...body,from:'RSI-03'},signInteragent(body,keys['RSI-01']),env,now),/AUTH_REQUIRED/);
 assert.throws(()=>authenticateInteragent(body,signInteragent(body,keys['RSI-01']),env,now+300001),/AUTH_REQUIRED/);
 assert.throws(()=>authenticateInteragent(body,'',{ },now),/NOT_CONFIGURED/);
});
test('durable support reaches sales and marketing inboxes; replay does not duplicate and repairs index',async()=>{
 const f=fixture();const a=await f.worker.submit(event);assert.ok(a.material);assert.equal(a.usedBySales,false);
 assert.equal((await f.worker.queue('RSI-01')).pending.length,1);assert.equal((await f.worker.queue('MARKETING')).pending.length,1);
 f.index.clear();const b=await f.worker.submit({...event,signedAt:'later',operation:'submit'});assert.equal(b.reused,true);assert.equal(f.index.size,1);
 assert.equal((await f.worker.submit({problem:event.problem,type:event.type,from:event.from,opportunityId,eventId:event.eventId})).reused,true);
 await assert.rejects(f.worker.submit({...event,problem:'NO_RESPONSE'}),/EVENT_CONFLICT/);
});
test('alternative requires stored failed result and acknowledgement is owned and idempotent',async()=>{
 const f=fixture();await f.worker.submit(event);
 const next={...event,eventId:'support-two',previousEventId:event.eventId,previousOutcome:'FAILED',resultEvidenceRef:'crm-result-one',attempt:0};
 await assert.rejects(f.worker.submit(next),/RESULT_UNVERIFIED/);
 await assert.rejects(f.worker.acknowledge({from:'RSI-02',eventId:event.eventId,evidenceRef:'crm-result-one'}),/OWNER_MISMATCH/);
 const ack={from:'RSI-01',eventId:event.eventId,evidenceRef:'crm-result-one',outcome:'FAILED',usedBySales:true};
 f.accepted.from='unrelated@example.test';await assert.rejects(f.worker.acknowledge(ack),/SALES_EVIDENCE_UNVERIFIED/);f.accepted.from='buyer@example.test';
 await f.worker.acknowledge(ack);assert.equal((await f.worker.acknowledge(ack)).reused,true);
 assert.equal((await f.worker.submit(next)).attempt,1);
 await assert.rejects(f.worker.submit({...next,eventId:'support-three'}),/PREVIOUS_RESULT_REQUIRED/);
});

test('different event, role or problem cannot reset opportunity attempts; third alternative escalates',async()=>{
 const f=fixture();f.worker=createInteragentCoordinator({...f,acceptance:async()=>f.accepted,gmail:{verify:async()=>({verified:true}),search:async()=>[]}});const base={...event,problem:'NO_RESPONSE'};await f.worker.submit(base);
 await assert.rejects(f.worker.submit({...base,eventId:'reset-role',from:'RSI-02'}),/PREVIOUS_RESULT_REQUIRED/);
 await assert.rejects(f.worker.submit({...base,eventId:'reset-problem',problem:'PRICE_OBJECTION'}),/PREVIOUS_RESULT_REQUIRED/);
 let previous=event.eventId;
 for(let attempt=1;attempt<=3;attempt++){
  await f.worker.acknowledge({from:'RSI-01',eventId:previous,evidenceRef:'crm-result-one',outcome:'FAILED'});
  const next=await f.worker.submit({...base,eventId:`attempt-${attempt}`,attempt:0,previousEventId:previous,previousOutcome:'FAILED',resultEvidenceRef:'crm-result-one'});
  assert.equal(next.attempt,attempt);previous=next.eventId;
  if(attempt===3){assert.equal(next.to,'DIRECTORA');assert.equal(next.alternativeExecuted,false);}
 }
 await assert.rejects(f.worker.submit({...base,eventId:'reset-after-escalation'}),/PREVIOUS_RESULT_REQUIRED/);
});

test('permitted read executes, persists real failed receipt and gates the next alternative without Gmail outage ack',async()=>{
 const f=fixture();let calls=0;
 const worker=createInteragentCoordinator({...f,gmail:{verify:async()=>{calls++;throw Object.assign(Error('GMAIL_DOWN'),{code:'GMAIL_DOWN'});}},now:()=> '2026-10-07T19:00:00Z'});
 const first=await worker.submit({...event,problem:'TOOL_FAILURE'});assert.equal(first.execution.status,'FAILED');assert.equal(first.execution.code,'GMAIL_DOWN');assert.equal(calls,1);
 await worker.submit({...event,problem:'TOOL_FAILURE'});assert.equal(calls,1);
 await assert.rejects(worker.submit({...event,problem:'TOOL_FAILURE',eventId:'next-read',previousEventId:first.eventId,previousOutcome:'FAILED',resultEvidenceRef:'invented'}),/RESULT_UNVERIFIED/);
 const next=await worker.submit({...event,problem:'TOOL_FAILURE',eventId:'next-read',previousEventId:first.eventId,previousOutcome:'FAILED',resultEvidenceRef:first.eventId});
 assert.equal(next.attempt,1);assert.equal(next.execution.status,'PENDING_AUTHORIZED_EXECUTION');assert.equal(next.alternativeExecuted,false);
});

test('migration carries legacy attempts instead of opening a fresh counter',async()=>{
 const f=fixture(),key='boltech:interagent:event:legacy-two';
 f.data.set(key,JSON.stringify({eventId:'legacy-two',opportunityId,from:'RSI-02',problem:'NO_RESPONSE',attempt:2,createdAt:'2026-10-07T18:00:00Z',salesAcceptance:'FAILED',ackEvidence:'crm-result-one'}));f.index.add(key);
 await assert.rejects(f.worker.submit({...event,eventId:'legacy-reset'}),/PREVIOUS_RESULT_REQUIRED/);
 const next=await f.worker.submit({...event,eventId:'legacy-next',problem:'NO_RESPONSE',previousEventId:'legacy-two',previousOutcome:'FAILED',resultEvidenceRef:'crm-result-one'});
 assert.equal(next.attempt,3);assert.equal(next.to,'DIRECTORA');
});

test('concurrent events cannot overwrite opportunity state or bypass the counter',async()=>{
 const f=fixture();const outcomes=await Promise.allSettled([f.worker.submit(event),f.worker.submit({...event,eventId:'concurrent-other'})]);
 assert.equal(outcomes.filter(r=>r.status==='fulfilled').length,1);assert.equal(outcomes.filter(r=>r.status==='rejected').length,1);
 assert.equal(f.index.size,1);const state=JSON.parse(f.data.get(`boltech:interagent:case:v2:${opportunityId}`));assert.equal(state.attempt,0);
});

test('receipt reconciliation is read-only, bound to original actor and content, and survives acknowledgement',async()=>{
 const f=fixture();await f.worker.submit(event);
 const input={eventId:event.eventId,from:event.from,event};
 const first=await f.worker.receipt(input);assert.equal(first.receipt.eventId,event.eventId);
 await assert.rejects(f.worker.receipt({...input,from:'RSI-02',event:{...event,from:'RSI-02'}}),/OWNER_MISMATCH/);
 await assert.rejects(f.worker.receipt({...input,event:{...event,problem:'NO_RESPONSE'}}),/CONFLICT/);
 await assert.rejects(f.worker.receipt({...input,eventId:'absent',event:{...event,eventId:'absent'}}),/NOT_FOUND/);
 await f.worker.acknowledge({from:event.from,eventId:event.eventId,evidenceRef:'crm-result-one'});
 assert.equal((await f.worker.queue(event.from)).pending.length,0);
 assert.ok((await f.worker.receipt(input)).receipt.acknowledgedAt);assert.equal(f.index.size,1);
});
test('closure requires matching production payment; director must provide verification and communication receipt',async()=>{
 const f=fixture(),close={eventId:'close-one',opportunityId,from:'RSI-03',type:'CLOSE_REPORTED',orderId:'order-fixture',acceptanceRef:'crm-acceptance'};
 f.paid.productId='payment-verification';await assert.rejects(f.worker.submit(close),/PAYMENT_UNVERIFIED/);
 f.paid.productId='custom';f.paid.expectedAmountUsd=undefined;await assert.rejects(f.worker.submit(close),/PAYMENT_UNVERIFIED/);f.paid.expectedAmountUsd=495;
 f.paid.productId='custom';f.paid.customerEmail='other@example.test';await assert.rejects(f.worker.submit(close),/ACCOUNT_MISMATCH/);
 f.paid.customerEmail='buyer@example.test';f.accepted.from='spoof@example.test';await assert.rejects(f.worker.submit(close),/CUSTOMER_ACCEPTANCE_UNVERIFIED/);f.accepted.from='buyer@example.test';
 const result=await f.worker.submit(close);assert.equal(result.ricardoNotified,false);assert.equal((await f.worker.queue('DIRECTORA')).pending.length,1);
 await assert.rejects(f.worker.acknowledge({from:'DIRECTORA',eventId:close.eventId,evidenceRef:'verification'}),/NOTIFICATION_RECEIPT_REQUIRED/);
 await assert.rejects(f.worker.acknowledge({from:'DIRECTORA',eventId:close.eventId,evidenceRef:'verification',verified:true,communicationRef:'wrong-message'}),/NOTIFICATION_UNVERIFIED/);
 await f.worker.acknowledge({from:'DIRECTORA',eventId:close.eventId,evidenceRef:'verification',verified:true,communicationRef:'director-message'});
 assert.equal((await f.worker.queue('DIRECTORA')).pending.length,0);
});
test('CRM outage, excluded opportunity and uncertain storage fail without a fake successful result',async()=>{
 const f=fixture();await assert.rejects(createInteragentCoordinator({...f,lead:async()=>{throw new Error('CRM_DOWN');}}).submit(event),/CRM_DOWN/);
 await assert.rejects(createInteragentCoordinator({...f,lead:async id=>({id,fields:{'Do Not Contact':true}})}).submit(event),/EXCLUDED/);
 await assert.rejects(createInteragentCoordinator({...f,command:async()=>{throw new Error('REDIS_DOWN');}}).submit(event),/REDIS_DOWN/);
});
