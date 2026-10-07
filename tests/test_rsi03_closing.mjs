import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {createRsi03Closing,signClosingApproval,validateClosingApproval,isExplicitAcceptance} from '../lib/rsi03_closing.js';
const director='test-only-director-key',now=()=>new Date('2026-10-07T20:00:00Z');
const env={INTERAGENT_ROLE_KEYS:JSON.stringify({DIRECTORA:director})};
function fixture(){
 const a={kind:'RSI03_CLOSE_APPROVED',approvedBy:'DIRECTORA',approvalRecordId:'rec00000000000001',opportunityId:'rec00000000000002',quoteReference:'quote-fixture',productId:'custom',customerEmail:'buyer@example.test',approvedAt:'2026-10-07T19:00:00Z',expiresAt:'2026-10-09T19:00:00Z',totalAmountUsd:990,approvedAmountUsd:495,scope:{summary:'One approved business workflow',deliveryDays:14,acceptanceCriteria:['Verified registration'],exclusions:['Additional integrations']},technicalEvidenceRef:'technical-test',accessEvidenceRef:'access-test',qualificationMessageId:'qualification-id',costs:{totalUsd:200,currency:'USD',evidenceRef:'cost-test'}};
 const row={id:a.approvalRecordId,fields:{RSI:'RSI-03',Authorization:JSON.stringify({...a,signature:signClosingApproval(a,director)})}};
 const data=new Map(),sent=[],replies=[],notifications=[],handoffs=[];let invoice=null,checkoutCalls=0;
 const command=async args=>{
  if(args[0]==='GET')return data.get(args[1])||null;
  if(args[0]==='SET'){if(args.includes('NX')&&data.has(args[1]))return null;data.set(args[1],args[2]);return 'OK';}
  if(args[0]==='EVAL'&&args[2]===2){if(data.get(args[3])!==args[5])return 'LEASE_LOST';data.set(args[4],args[6]);return 'OK';}
  if(args[0]==='EVAL'){if(data.get(args[3])===args[4])data.delete(args[3]);return 1;}
  throw Error('Unexpected Redis command');
 };
 const qualification={id:'qualification-id',from:a.customerEmail,to:'ricardo.boltechgroup@gmail.com',text:'Customer workflow request',threadId:'thread-fixture',rfcMessageId:'<qualification@example.test>',receivedAt:'2026-10-07T18:30:00Z',sent:false,automatic:false};
 const gmail={verify:async()=>({verified:true}),message:async id=>id==='qualification-id'?qualification:sent.find(s=>s.receipt.messageId===id)?.message,thread:async()=>replies,search:async q=>q.includes('rfc822msgid')?sent.filter(s=>q.includes(s.job.rfcMessageId)).map(s=>({id:s.receipt.messageId,threadId:'thread-fixture'})):[],send:async job=>{const receipt={messageId:`sent-${sent.length+1}`,threadId:'thread-fixture'};sent.push({job,receipt,message:{id:receipt.messageId,threadId:receipt.threadId,receivedAt:now().toISOString()}});return receipt;}};
 const lead=async id=>({id,fields:{'Contact Email':a.customerEmail}});
 const checkout=async approval=>{checkoutCalls++;invoice={orderId:'quote-'+crypto.createHash('sha256').update(approval.quoteReference).digest('hex'),productId:a.productId,customerEmail:a.customerEmail,expectedAmountUsd:495,provider:'WOMPI_SV',environment:'production',status:'PENDING_PAYMENT',providerCheckoutUrl:'https://pay.wompi.sv/test-fixture'};return {success:true};};
 const options={command,gmail,lead,checkout,order:async()=>invoice,gateway:async()=>({status:'PASSED',productive:true}),verifyPayment:async()=>true,handoff:async input=>{handoffs.push(input);return {success:true};},coordinator:{submit:async event=>{notifications.push(event);return {success:true,eventId:event.eventId};}},env,now};
 return {a,row,data,sent,replies,notifications,handoffs,qualification,options,worker:createRsi03Closing(options),get invoice(){return invoice;},set invoice(v){invoice=v;},checkoutCalls:()=>checkoutCalls};
}
test('complete scoped written close: proposal, actual acceptance, checkout, provider evidence and director queue; no automatic Ricardo notification',async()=>{
 const f=fixture();const created=await f.worker.register(f.row);
 assert.equal((await f.worker.step(f.a.opportunityId)).state,'PROPOSAL_SENT');assert.equal(f.sent.length,1);assert.equal(f.sent[0].job.threadId,'thread-fixture');
 assert.equal((await f.worker.step(f.a.opportunityId)).state,'PROPOSAL_SENT');assert.equal(f.checkoutCalls(),0);
 f.replies.push({id:'acceptance-id',from:f.a.customerEmail,threadId:'thread-fixture',rfcMessageId:'<acceptance@example.test>',text:created.acceptanceToken,receivedAt:now().toISOString(),sent:false,automatic:false});
 assert.equal((await f.worker.step(f.a.opportunityId)).state,'ACCEPTED');
 assert.equal((await f.worker.step(f.a.opportunityId)).state,'PAYMENT_LINK_READY');assert.equal(f.checkoutCalls(),1);
 assert.equal((await f.worker.step(f.a.opportunityId)).state,'WAITING_PAYMENT');assert.equal(f.sent.length,2);
 assert.equal((await f.worker.step(f.a.opportunityId)).state,'WAITING_PAYMENT');assert.equal(f.notifications.length,0);
 f.invoice.status='PAID';const done=await f.worker.step(f.a.opportunityId);assert.equal(done.state,'DIRECTOR_REVIEW');assert.equal(done.ricardoNotified,false);assert.equal(f.notifications[0].from,'RSI-03');assert.equal(f.notifications[0].acceptanceRef,'acceptance-id');
 await f.worker.step(f.a.opportunityId);assert.equal(f.notifications.length,1);assert.equal(f.sent.length,2);assert.equal(f.checkoutCalls(),1);
});
test('signature binds actual CRM record and price; identity, auto-response, technical scope and costs fail closed',async()=>{
 const f=fixture();validateClosingApproval(f.row,env,now().getTime());
 const tampered=structuredClone(f.row),body=JSON.parse(tampered.fields.Authorization);body.approvedAmountUsd=1;tampered.fields.Authorization=JSON.stringify(body);assert.throws(()=>validateClosingApproval(tampered,env,now().getTime()),/DIRECTOR_SIGNATURE/);
 const invalidCost={...f.a,costs:{totalUsd:1000,currency:'USD',evidenceRef:'cost-test'}};assert.throws(()=>validateClosingApproval({...f.row,fields:{RSI:'RSI-03',Authorization:JSON.stringify({...invalidCost,signature:signClosingApproval(invalidCost,director)})}},env,now().getTime()),/DOCUMENTED_COSTS/);
 f.qualification.from='other@example.test';await assert.rejects(f.worker.register(f.row),/CUSTOMER_EVIDENCE/);f.qualification.from=f.a.customerEmail;f.qualification.automatic=true;await assert.rejects(f.worker.register(f.row),/CUSTOMER_EVIDENCE/);assert.equal(f.sent.length,0);
});
test('quoted, ambiguous, automatic and other-account responses never authorize payment',()=>{
 const f=fixture(),record={approval:f.a,threadId:'thread-fixture',acceptanceToken:'ACEPTO BOLTECH-TOKEN',proposal:{sentAt:now().toISOString()}};
 const base={from:f.a.customerEmail,threadId:record.threadId,text:record.acceptanceToken,receivedAt:now().toISOString(),sent:false,automatic:false};
 for(const change of [{text:'Yes, sounds interesting'},{text:'> '+base.text},{text:base.text+'\n\nBut only for USD1'},{automatic:true},{from:'other@example.test'},{threadId:'wrong-thread'},{receivedAt:'2026-10-06T20:00:00Z'}])assert.equal(isExplicitAcceptance({...base,...change},record),false);
 assert.equal(isExplicitAcceptance(base,record),true);
 assert.equal(isExplicitAcceptance({...base,text:base.text+'\n\n> Original quote'},record),true);
});
test('ambiguous real response creates one handoff to existing RSI-02, never checkout or duplicate handoff',async()=>{
 const f=fixture();await f.worker.register(f.row);await f.worker.step(f.a.opportunityId);
 f.replies.push({id:'ambiguous-reply',from:f.a.customerEmail,threadId:'thread-fixture',text:'Can we change the scope?',receivedAt:now().toISOString()});
 await f.worker.step(f.a.opportunityId);await f.worker.step(f.a.opportunityId);
 assert.equal(f.handoffs.length,1);assert.equal(f.handoffs[0].to,'RSI-02');assert.equal(f.handoffs[0].evidenceRef,'ambiguous-reply');assert.equal(f.checkoutCalls(),0);
});
test('uncertain Gmail mutation reconciles unique sent receipt before moving forward; never resends',async()=>{
 const f=fixture();await f.worker.register(f.row);const original=f.options.gmail.send;
 f.options.gmail.send=async job=>{await original(job);throw Object.assign(Error('timeout'),{code:'GMAIL_SEND_UNKNOWN'});};
 await assert.rejects(f.worker.step(f.a.opportunityId),/timeout/);assert.equal(f.sent.length,1);
 assert.equal((await f.worker.step(f.a.opportunityId)).state,'PROPOSAL_SENT');assert.equal(f.sent.length,1);
});
test('payment POST timeout leaves durable unknown and never generates a second link',async()=>{
 const f=fixture(),w=createRsi03Closing({...f.options,checkout:async()=>{throw Object.assign(Error('timeout'),{code:'CLOSE_CHECKOUT_UNKNOWN'});}});
 const record=await w.register(f.row);record.state='ACCEPTED';record.acceptanceMessageId='acceptance-id';f.data.set(`boltech:closing:case:${f.a.opportunityId}`,JSON.stringify(record));
 await assert.rejects(w.step(f.a.opportunityId),/timeout/);
 await assert.rejects(w.step(f.a.opportunityId),/CHECKOUT_RECONCILIATION_REQUIRED/);assert.equal(f.sent.length,0);
});
test('no qualified approved cases, unavailable gateway and fake payment do not become sales',async()=>{
 const f=fixture();assert.equal((await f.worker.runNext([])).state,'WAITING_QUALIFIED_APPROVED_CASE');
 await assert.rejects(createRsi03Closing({...f.options,gateway:async()=>({status:'FAILED'})}).register(f.row),/GATEWAY/);
 const record=await f.worker.register(f.row);record.state='WAITING_PAYMENT';record.acceptanceMessageId='acceptance-id';f.data.set(`boltech:closing:case:${f.a.opportunityId}`,JSON.stringify(record));f.invoice={status:'PAID'};
 await assert.rejects(createRsi03Closing({...f.options,verifyPayment:async()=>false}).step(f.a.opportunityId),/PROVIDER_PAYMENT_UNVERIFIED/);assert.equal(f.notifications.length,0);
});
