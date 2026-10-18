import test from 'node:test';
import assert from 'node:assert/strict';
import {createRsi01Followups} from '../lib/rsi01_followups.js';
import {sdrWindow} from '../lib/sdr_dispatch.js';
import {createRsi02InboxExecutor} from '../lib/rsi02_inbox_executor.js';
import {readFileSync} from 'node:fs';
const qa=JSON.parse(readFileSync(new URL('../config/qa_case.json',import.meta.url)));
const sender='ricardo.boltechgroup@gmail.com',email=qa.answers[8];
function fixture(){
 const data=new Map();let sends=0,clock=new Date('2026-10-09T20:23:00Z'),unknown=false,crmDown=false;
 const row={id:'recQA202610100000',fields:{Name:qa.answers[7],'Contact Email':email,'Experiment Cohort':'RSI-01',Notes:qa.purpose}};
 const initial={id:'original',threadId:'thread',from:sender,to:email,sent:true,rfcMessageId:'<original@test>',subject:'Process tracking',text:'Original',receivedAt:'2026-10-06T15:00:00Z'};const messages=[initial];
 const command=async([op,key,val,...rest])=>{if(op==='GET')return data.get(key)||null;if(op==='SET'){if(rest.includes('NX')&&data.has(key))return null;data.set(key,val);return 'OK';}if(op==='ZCOUNT')return 0;if(op==='ZADD')return 1;if(op==='EVAL'){if(data.get(rest[0])===rest[1])data.delete(rest[0]);return 1;}throw Error(op);};
 const gmail={verify:async()=>({verified:true}),search:async q=>q.includes('rfc822')?messages.filter(m=>m.id!=='original'&&m.sent).map(m=>({id:m.id})):q==='in:sent newer_than:1d'?[]:messages.map(m=>({id:m.id})),message:async id=>messages.find(m=>m.id===id),send:async job=>{sends++;assert.equal(JSON.parse([...data.entries()].find(([k])=>k.startsWith('boltech:sdr:followup:'))[1]).state,'SEND_PENDING');assert.equal(job.threadId,'thread');assert.equal(job.inReplyTo,'<original@test>');if(unknown)throw Object.assign(Error('timeout'),{code:'GMAIL_SEND_UNKNOWN'});messages.push({id:'followup',threadId:'thread',from:sender,to:email,sent:true,rfcMessageId:`<${job.rfcMessageId}>`,receivedAt:clock.toISOString()});return {messageId:'followup',threadId:'thread'};}};
 const record=async(id,fields)=>{if(crmDown)throw Error('CRM down');assert.equal(id,row.id);if(fields)Object.assign(row.fields,fields);return structuredClone(row);};
 const plan={enabled:true,authorization:'Authorized fixture',maxPerCycle:1,accounts:[{recordId:row.id,email,originalMessageId:'original',dueAt:'2026-10-09T20:00:00Z',expiresAt:'2026-10-16T23:00:00Z',text:'Written question; reply no to stop.'}]};
 let workDown=false,workCalls=0;
 const syncWork=async job=>{assert.equal(job.recordId,row.id);workCalls++;if(workDown&&job.state==='SENT')throw Error('Work unavailable');return {state:job.state==='SENT'?'VERIFIED':'PRESERVED'};};
 gmail.thread=async id=>messages.filter(m=>m.threadId===id);
 const worker=createRsi01Followups({command,gmail,record,syncWork,now:()=>clock,plan});return {worker,data,messages,row,plan,gmail,command,sends:()=>sends,workCalls:()=>workCalls,setWorkDown:v=>workDown=v,setClock:v=>clock=new Date(v),setUnknown:v=>unknown=v,setCrmDown:v=>crmDown=v};
}
test('14:00 follow-up window is open; outside business hours is closed',()=>{assert.equal(sdrWindow(new Date('2026-10-09T20:00:00Z')).allowed,true);assert.equal(sdrWindow(new Date('2026-10-09T23:00:00Z')).allowed,false);});
test('due follow-up reserves durably and sends once in original thread',async()=>{const f=fixture();assert.equal((await f.worker.run()).results[0].state,'SENT');assert.equal((await f.worker.run()).results[0].reused,true);assert.equal(f.sends(),1);assert.match(f.row.fields.Notes,/:SENT\]/);});
test('not due and original CRM mismatch never send',async()=>{const f=fixture();f.setClock('2026-10-08T20:00:00Z');assert.equal((await f.worker.run()).results[0].state,'NOT_DUE');f.row.fields['Contact Email']='other@example.test';assert.equal((await f.worker.run()).results[0].state,'CONTACT_HOLD');assert.equal(f.sends(),0);});
test('human reply routes to qualification, no is suppression, bounce blocks sending',async()=>{for(const kind of ['reply','stop','bounce']){const f=fixture();f.messages.push({id:'incoming',threadId:'thread',from:kind==='bounce'?'mailer-daemon@example.test':email,to:sender,sent:false,text:kind==='reply'?'No tenemos un CRM, queremos saber más':kind==='stop'?'No':'Delivery failed',receivedAt:'2026-10-08T20:00:00Z'});assert.equal((await f.worker.run()).results[0].state,kind==='reply'?'CUSTOMER_REPLY':kind==='stop'?'SUPPRESSED':'BOUNCED');assert.equal(f.sends(),0);if(kind==='reply')assert.equal(f.row.fields['Commercial Stage'],'Replied');}});
test('unknown POST is not retried and subsequent cycles preserve uncertainty',async()=>{const f=fixture();f.setUnknown(true);assert.equal((await f.worker.run()).results[0].state,'UNKNOWN');assert.equal((await f.worker.run()).results[0].state,'UNKNOWN');assert.equal(f.sends(),1);});
test('sent follow-up still monitors later replies and hands off without a second send',async()=>{const f=fixture();await f.worker.run();f.messages.push({id:'reply',threadId:'thread',from:email,to:sender,text:'Sí, nos interesa revisar el proceso',receivedAt:'2026-10-09T21:00:00Z'});assert.equal((await f.worker.run()).results[0].state,'CUSTOMER_REPLY');assert.equal(f.sends(),1);assert.equal(f.row.fields['Commercial Stage'],'Replied');});
test('CRM outage produces a visible blocker and cannot send',async()=>{const f=fixture();f.setCrmDown(true);assert.equal((await f.worker.run()).results[0].state,'BLOCKED');assert.equal(f.sends(),0);});
test('an automatic reply does not permanently hide a later human reply',async()=>{
 const f=fixture();f.messages.push({id:'auto',from:email,to:sender,threadId:'thread',automatic:true,text:'Out of office',receivedAt:'2026-10-08T20:00:00Z'});
 assert.equal((await f.worker.run()).results[0].state,'AUTOMATIC_REPLY_HOLD');
 f.messages.push({id:'human',from:email,to:sender,threadId:'thread',text:'Sí, queremos revisar el proceso',receivedAt:'2026-10-09T20:00:00Z'});
 const result=(await f.worker.run()).results[0];assert.equal(result.state,'CUSTOMER_REPLY');assert.equal(result.evidenceRef,'human');assert.equal(f.sends(),0);
});
test('a newer opt-out takes precedence over an older interested reply',async()=>{
 const f=fixture();f.messages.push({id:'interested',from:email,to:sender,threadId:'thread',text:'Me interesa',receivedAt:'2026-10-08T20:00:00Z'},{id:'stop',from:email,to:sender,threadId:'thread',text:'No deseo recibir seguimiento',receivedAt:'2026-10-09T20:00:00Z'});
 assert.equal((await f.worker.run()).results[0].state,'SUPPRESSED');assert.equal(f.sends(),0);
});
test('task sync failure after provider success recovers without resending',async()=>{
 const f=fixture();f.setWorkDown(true);
 const first=(await f.worker.run()).results[0];assert.equal(first.state,'SENT');assert.equal(first.crmSynced,false);assert.equal(f.sends(),1);
 f.setWorkDown(false);await f.worker.run();
 const saved=JSON.parse([...f.data.entries()].find(([k])=>k.startsWith('boltech:sdr:followup:'))[1]);
 assert.equal(saved.workSynced,true);assert.equal(saved.crmSynced,true);assert.equal(f.sends(),1);
});
test('historical synced lead lacking task receipt is reconciled without resending',async()=>{
 const f=fixture();await f.worker.run();
 const [key,raw]=[...f.data.entries()].find(([k])=>k.startsWith('boltech:sdr:followup:'));
 const old=JSON.parse(raw);delete old.workSynced;f.data.set(key,JSON.stringify(old));
 const before=f.workCalls();await f.worker.run();assert.equal(f.workCalls(),before+1);assert.equal(f.sends(),1);
});
test('n8n cohort uses existing dispatcher and remains idempotent',async()=>{
 const f=fixture();f.row.fields['Experiment Cohort']='N8N_FREELANCE_2026-10-10';
 assert.equal((await f.worker.run()).results[0].state,'SENT');await f.worker.run();assert.equal(f.sends(),1);
});
test('prepared unknown-interest contact cannot send without authorization',async()=>{
 const f=fixture();f.plan.accounts[0].sendAuthorized=false;
 assert.equal((await f.worker.run()).results[0].state,'PREPARED_AWAITING_SEND_AUTHORIZATION');assert.equal(f.sends(),0);
 f.messages.push({id:'human',threadId:'thread',from:email,to:sender,sent:false,text:'Interested in your proposal',receivedAt:'2026-10-09T20:00:00Z'});
 assert.equal((await f.worker.run()).results[0].state,'CUSTOMER_REPLY');assert.equal(f.sends(),0);
});
test('English and Spanish opt-outs cannot be handed off as interested replies',async()=>{
 for(const text of ['Not interested, thank you','No nos interesa','No gracias','Please remove me']){
  const f=fixture();f.messages.push({id:'stop',threadId:'thread',from:email,to:sender,sent:false,text,receivedAt:'2026-10-09T20:00:00Z'});
  assert.equal((await f.worker.run()).results[0].state,'SUPPRESSED');assert.equal(f.sends(),0);
 }
});
test('star synthetic client: follow-up, interested response, agent 2 qualification, no duplicate send',async()=>{
 const f=fixture();f.row.fields['Experiment Cohort']='N8N_FREELANCE_2026-10-10';
 assert.equal((await f.worker.run()).results[0].state,'SENT');
 const incoming={id:'star-interested',threadId:'thread',from:email,to:sender,sent:false,text:'Interested in a workflow pilot: can you help with lead follow-up?',subject:'Re: Process tracking',rfcMessageId:'<star-reply@example.test>',receivedAt:'2026-10-09T21:00:00Z'};
 f.messages.push(incoming);
 const handoff=(await f.worker.run()).results[0];
 assert.equal(handoff.state,'CUSTOMER_REPLY');assert.equal(handoff.opportunityId,f.row.id);assert.equal(handoff.evidenceRef,incoming.id);
 let agent2Sends=0;
 const gmail={...f.gmail,send:async job=>{
  agent2Sends++;assert.equal(job.threadId,incoming.threadId);assert.equal(job.inReplyTo,incoming.rfcMessageId);
  assert.match(job.text,/reply in writing/i);assert.doesNotMatch(job.text,/arrange a short discussion/i);
  return {messageId:'star-agent2-qualification',threadId:'thread'};
 }};
 const fetcher=async(url,options)=>{
  if(options.method==='PATCH'){Object.assign(f.row.fields,JSON.parse(options.body).fields);return {ok:true,json:async()=>structuredClone(f.row)};}
  return {ok:true,json:async()=>({records:String(url).includes('tblHVq')?[]:[structuredClone(f.row)]})};
 };
 const agent2=createRsi02InboxExecutor({gmail,command:f.command,fetcher,env:{AIRTABLE_TOKEN:'synthetic-isolated',RSI02_AUTOREPLY_ENABLED:'true'},closing:{runNext:async()=>({state:'WAITING_QUALIFIED_APPROVED_CASE'})}});
 const first=await agent2.run(),again=await agent2.run();
 assert.equal(first.inbox.replied,1);assert.equal(first.inbox.qualified,1);assert.equal(again.inbox.replied,0);
 assert.equal(agent2Sends,1);assert.equal(f.sends(),1);assert.equal(first.rsi03.state,'WAITING_QUALIFIED_APPROVED_CASE');
 const receipt=JSON.parse(f.data.get('boltech:rsi02:inbox:'+incoming.id));
 assert.equal(receipt.state,'SENT');assert.equal(receipt.sentId,'star-agent2-qualification');
 assert.equal(qa.externalMessagesAllowed,false);assert.equal(qa.commercialEvidence,false);
});
