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
 const paid={orderId:'order-fixture',status:'PAID',environment:'production',productId:'custom-agent',providerEvidence:'provider-receipt',paidAt:'2026-10-07T19:00:00Z',providerTransactionId:'provider-fixture',expectedAmountUsd:495,customerEmail:'buyer@example.test'};
 return {data,index,command,lead,paid,worker:createInteragentCoordinator({command,lead,order:async()=>paid,now:()=> '2026-10-07T19:00:00Z'})};
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
 await assert.rejects(f.worker.submit({...event,problem:'NO_RESPONSE'}),/EVENT_CONFLICT/);
});
test('alternative requires stored failed result and acknowledgement is owned and idempotent',async()=>{
 const f=fixture();await f.worker.submit(event);
 const next={...event,eventId:'support-two',previousEventId:event.eventId,previousOutcome:'FAILED',resultEvidenceRef:'crm-result-one',attempt:0};
 await assert.rejects(f.worker.submit(next),/RESULT_UNVERIFIED/);
 await assert.rejects(f.worker.acknowledge({from:'RSI-02',eventId:event.eventId,evidenceRef:'crm-result-one'}),/OWNER_MISMATCH/);
 const ack={from:'RSI-01',eventId:event.eventId,evidenceRef:'crm-result-one',outcome:'FAILED',usedBySales:true};
 await f.worker.acknowledge(ack);assert.equal((await f.worker.acknowledge(ack)).reused,true);
 assert.equal((await f.worker.submit(next)).attempt,1);
 await assert.rejects(f.worker.submit({...next,eventId:'support-three'}),/PREVIOUS_RESULT_REQUIRED/);
});
test('closure requires matching production payment; director must provide verification and communication receipt',async()=>{
 const f=fixture(),close={eventId:'close-one',opportunityId,from:'RSI-03',type:'CLOSE_REPORTED',orderId:'order-fixture',acceptanceRef:'crm-acceptance'};
 f.paid.productId='payment-verification';await assert.rejects(f.worker.submit(close),/PAYMENT_UNVERIFIED/);
 f.paid.productId='custom-agent';f.paid.customerEmail='other@example.test';await assert.rejects(f.worker.submit(close),/ACCOUNT_MISMATCH/);
 f.paid.customerEmail='buyer@example.test';const result=await f.worker.submit(close);assert.equal(result.ricardoNotified,false);assert.equal((await f.worker.queue('DIRECTORA')).pending.length,1);
 await assert.rejects(f.worker.acknowledge({from:'DIRECTORA',eventId:close.eventId,evidenceRef:'verification'}),/NOTIFICATION_RECEIPT_REQUIRED/);
 await f.worker.acknowledge({from:'DIRECTORA',eventId:close.eventId,evidenceRef:'verification',verified:true,communicationRef:'director-message'});
 assert.equal((await f.worker.queue('DIRECTORA')).pending.length,0);
});
test('CRM outage, excluded opportunity and uncertain storage fail without a fake successful result',async()=>{
 const f=fixture();await assert.rejects(createInteragentCoordinator({...f,lead:async()=>{throw new Error('CRM_DOWN');}}).submit(event),/CRM_DOWN/);
 await assert.rejects(createInteragentCoordinator({...f,lead:async id=>({id,fields:{'Do Not Contact':true}})}).submit(event),/EXCLUDED/);
 await assert.rejects(createInteragentCoordinator({...f,command:async()=>{throw new Error('REDIS_DOWN');}}).submit(event),/REDIS_DOWN/);
});
