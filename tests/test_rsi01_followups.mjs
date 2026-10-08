import test from 'node:test';
import assert from 'node:assert/strict';
import {createRsi01Followups} from '../lib/rsi01_followups.js';
import {sdrWindow} from '../lib/sdr_dispatch.js';
const sender='ricardo.boltechgroup@gmail.com',email='business@example.test';
function fixture(){
 const data=new Map();let sends=0,clock=new Date('2026-10-09T20:23:00Z'),unknown=false,crmDown=false;
 const row={id:'recFixture1234567',fields:{'Contact Email':email,'Experiment Cohort':'RSI-01',Notes:'Initial SENT authorized'}};
 const initial={id:'original',threadId:'thread',from:sender,to:email,sent:true,rfcMessageId:'<original@test>',subject:'Process tracking',text:'Original',receivedAt:'2026-10-06T15:00:00Z'};const messages=[initial];
 const command=async([op,key,val,...rest])=>{if(op==='GET')return data.get(key)||null;if(op==='SET'){if(rest.includes('NX')&&data.has(key))return null;data.set(key,val);return 'OK';}if(op==='ZCOUNT')return 0;if(op==='ZADD')return 1;if(op==='EVAL'){if(data.get(rest[0])===rest[1])data.delete(rest[0]);return 1;}throw Error(op);};
 const gmail={verify:async()=>({verified:true}),search:async q=>q.includes('rfc822')?messages.filter(m=>m.id!=='original'&&m.sent).map(m=>({id:m.id})):q==='in:sent newer_than:1d'?[]:messages.map(m=>({id:m.id})),message:async id=>messages.find(m=>m.id===id),send:async job=>{sends++;assert.equal(JSON.parse([...data.entries()].find(([k])=>k.startsWith('boltech:sdr:followup:'))[1]).state,'SEND_PENDING');assert.equal(job.threadId,'thread');assert.equal(job.inReplyTo,'<original@test>');if(unknown)throw Object.assign(Error('timeout'),{code:'GMAIL_SEND_UNKNOWN'});messages.push({id:'followup',threadId:'thread',from:sender,to:email,sent:true,rfcMessageId:`<${job.rfcMessageId}>`,receivedAt:clock.toISOString()});return {messageId:'followup',threadId:'thread'};}};
 const record=async(id,fields)=>{if(crmDown)throw Error('CRM down');assert.equal(id,row.id);if(fields)Object.assign(row.fields,fields);return structuredClone(row);};
 const plan={enabled:true,authorization:'Authorized fixture',maxPerCycle:1,accounts:[{recordId:row.id,email,originalMessageId:'original',dueAt:'2026-10-09T20:00:00Z',expiresAt:'2026-10-16T23:00:00Z',text:'Written question; reply no to stop.'}]};
 const worker=createRsi01Followups({command,gmail,record,now:()=>clock,plan});return {worker,data,messages,row,sends:()=>sends,setClock:v=>clock=new Date(v),setUnknown:v=>unknown=v,setCrmDown:v=>crmDown=v};
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
