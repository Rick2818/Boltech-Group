import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRsi01Followups} from '../lib/rsi01_followups.js';
import {syncFollowupWork} from '../lib/followup_work_sync.js';
const qa=JSON.parse(readFileSync(new URL('../config/qa_case.json',import.meta.url)));
const email=qa.answers[8],sender='ricardo.boltechgroup@gmail.com',leadId='recQA202610100000';
function fixture({quality,unsubscribed,dnc,dropReceipt=false,lateExcluded=false}={}){
 const data=new Map(),writes=[],messages=[{id:qa.requestId,threadId:qa.id,from:sender,to:email,sent:true,rfcMessageId:`<${qa.requestId}>`,receivedAt:'2026-10-06T15:00:00Z',subject:qa.purpose}];
 const row={id:leadId,fields:{'Contact Email':email,'Experiment Cohort':'RSI-01','Data Quality':quality,Unsubscribed:unsubscribed,'Do Not Contact':dnc,Notes:qa.purpose}};
 const work={id:'recQA202610100001',fields:{'Source Record ID':leadId,'Work ID':`LEAD_INTAKE:${leadId}`,RSI:'RSI-01',Status:'PENDING_RSI01_RESEARCH',Evidence:qa.purpose}};
 let sends=0,failWork=false,advance=false;
 const command=async([op,key,value,...args])=>{
  if(op==='GET')return data.get(key)||null;
  if(op==='SET'){if(dropReceipt&&key.includes(':receipt:'))return null;if(args.includes('NX')&&data.has(key))return null;data.set(key,value);return 'OK';}
  if(op==='ZCOUNT')return 0;if(op==='ZADD')return 1;
  if(op==='EVAL'){data.delete(args[0]);return 1;}throw Error(op);
 };
 let reads=0;
 const record=async(id,fields)=>{assert.equal(id,leadId);assert.equal(fields,undefined);if(lateExcluded&&++reads===2)row.fields['Do Not Contact']=true;return structuredClone(row);};
 const request=async q=>{
  if(failWork)throw Error('QA persistence outage');
  if(q.fields){writes.push(q);Object.assign(work.fields,q.fields);}
  if(!q.id)return {records:[structuredClone(work)]};
  const snapshot=structuredClone(work);
  if(advance){work.fields.Status='WAITING_DIRECTOR_APPROVAL';work.fields.Evidence+='\n'+qa.id;}
  return snapshot;
 };
 const gmail={verify:async()=>({verified:true}),search:async q=>q==='in:sent newer_than:1d'?[]:messages.map(m=>({id:m.id})),message:async id=>messages.find(m=>m.id===id),send:async job=>{
  sends++;const result={messageId:qa.requestId+'-followup',threadId:qa.id};
  messages.push({id:result.messageId,threadId:qa.id,from:sender,to:email,sent:true,rfcMessageId:job.rfcMessageId,receivedAt:'2026-10-09T20:23:00Z'});return result;
 }};
 const worker=createRsi01Followups({command,record,gmail,syncWork:job=>syncFollowupWork(job,{request}),now:()=>new Date('2026-10-09T20:23:00Z'),plan:{enabled:true,authorization:qa.purpose,maxPerCycle:1,accounts:[{recordId:leadId,email,originalMessageId:qa.requestId,dueAt:'2026-10-09T20:00:00Z',expiresAt:'2026-10-16T23:00:00Z',text:qa.answers[0]}]}});
 return {worker,data,work,row,writes,sends:()=>sends,setWorkFailure:v=>failWork=v,setAdvance:()=>advance=true};
}
test('real worker and real Work adapter preserve concurrent progress and keep durable receipt',async()=>{
 const f=fixture();f.setAdvance();const first=(await f.worker.run()).results[0];
 assert.equal(first.state,'SENT');assert.equal(first.workSyncState,'RECONCILE_REQUIRED');assert.equal(first.crmSyncState,'RECONCILE_REQUIRED');
 assert.equal(f.work.fields.Status,'WAITING_DIRECTOR_APPROVAL');assert.ok(f.work.fields.Evidence.includes(qa.id));
 await f.worker.run();assert.equal(f.sends(),1);assert.equal(f.writes.length,0);
 assert.ok([...f.data.keys()].some(k=>k.includes(':receipt:')));assert.equal(f.row.fields.Notes,qa.purpose);
});
test('storage readback failure prevents sending even when SET returned without throwing',async()=>{
 const f=fixture({dropReceipt:true});const r=(await f.worker.run()).results[0];assert.equal(r.state,'SEND_PENDING');assert.equal(r.sendingPerformed,false);assert.equal(f.sends(),0);
});
test('real adapter outage after confirmed send is recovered without resending or false sync',async()=>{
 const f=fixture();
 // Fail the adapter only for SENT; SEND_PENDING is a no-op before its reads.
 f.setWorkFailure(true);assert.equal((await f.worker.run()).results[0].state,'SENT');assert.equal(f.sends(),1);
 f.setWorkFailure(false);await f.worker.run();assert.equal(f.sends(),1);assert.equal(f.writes.length,0);
 const job=JSON.parse([...f.data].find(([k])=>k.startsWith('boltech:sdr:followup:')&&!k.includes(':receipt:'))[1]);
 assert.equal(job.receiptStored,true);assert.equal(job.crmSynced,false);assert.equal(job.workSynced,false);assert.equal(job.workSyncState,'RECONCILE_REQUIRED');
});
test('each exclusion prevents all provider sends and task writes',async()=>{
 for(const flags of [{quality:'QA'},{unsubscribed:true},{dnc:true}]){
  const f=fixture(flags);assert.equal((await f.worker.run()).results[0].state,'CONTACT_HOLD');assert.equal(f.sends(),0);assert.equal(f.writes.length,0);
  assert.equal([...f.data.keys()].some(k=>k.includes(':receipt:')),false);
 }
});
test('late exclusion before send leaves reservation intact and prevents sending',async()=>{
 const f=fixture({lateExcluded:true});
 assert.equal((await f.worker.run()).results[0].state,'CONTACT_HOLD');assert.equal(f.sends(),0);
 assert.ok([...f.data.values()].some(raw=>{try{return JSON.parse(raw).state==='SEND_PENDING';}catch{return false;}}));
 assert.equal((await f.worker.run()).results[0].state,'CONTACT_HOLD');assert.equal(f.sends(),0);
});
