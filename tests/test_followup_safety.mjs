// Release regressions. All identities derive from the single permitted QA case.
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {readFileSync} from 'node:fs';
import {syncFollowupWork} from '../lib/followup_work_sync.js';
import {createRsi01Followups} from '../lib/rsi01_followups.js';
const qa=JSON.parse(readFileSync(new URL('../config/qa_case.json',import.meta.url)));
const leadId='recQA202610100000',workId='recQA202610100001',email=qa.answers[8];
test('AUDIT: concurrent advancement must not be overwritten by stale receipt',async()=>{
 const row={id:workId,fields:{'Work ID':`LEAD_INTAKE:${leadId}`,'Source Record ID':leadId,RSI:'RSI-01',Status:'PENDING_RSI01_RESEARCH',Evidence:qa.purpose}};
 const request=async q=>{
  if(!q.id)return {records:[structuredClone(row)]};
  if(q.fields){Object.assign(row.fields,q.fields);return structuredClone(row);}
  const snapshot=structuredClone(row);
  row.fields.Status='WAITING_DIRECTOR_APPROVAL';row.fields.Evidence+='\nAUTHORIZED_NEW_EVIDENCE';
  return snapshot;
 };
 const result=await syncFollowupWork({recordId:leadId,state:'SENT',messageId:qa.requestId,threadId:qa.id},{request});
 assert.equal(result.state,'RECONCILE_REQUIRED');
 assert.equal(row.fields.Status,'WAITING_DIRECTOR_APPROVAL');
 assert.match(row.fields.Evidence,/AUTHORIZED_NEW_EVIDENCE/);
});
function recoveryFixture({quality,unsubscribed,oldState='SENT'}={}){
 const id=crypto.createHash('sha256').update(`boltech:followup:${email}:original`).digest('hex');
 const data=new Map([[`boltech:sdr:followup:${id}`,JSON.stringify({id,recordId:leadId,state:oldState,messageId:qa.requestId,threadId:qa.id,crmSynced:false})]]);
 const row={id:leadId,fields:{Name:qa.answers[7],'Contact Email':email,'Experiment Cohort':'RSI-01','Data Quality':quality,Unsubscribed:unsubscribed,'Commercial Stage':'Paid verified',Notes:qa.purpose,'Next Action':'Preserve approved delivery'}};
 let writes=0,workCalls=0;
 const command=async([op,key,val,...rest])=>{if(op==='GET')return data.get(key)||null;if(op==='SET'){if(rest.includes('NX')&&data.has(key))return null;data.set(key,val);return 'OK';}if(op==='EVAL')return 1;throw Error(op);};
 const record=async(id,fields)=>{if(fields){writes++;Object.assign(row.fields,fields);}return structuredClone(row);};
 const gmail={verify:async()=>{throw Error('Audit must stop before Gmail');}};
 const syncWork=async()=>{workCalls++;return {state:'VERIFIED'};};
 const worker=createRsi01Followups({command,record,gmail,syncWork,now:()=>new Date('2026-10-10T21:00:00Z'),plan:{enabled:true,maxPerCycle:1,accounts:[{recordId:leadId,email,originalMessageId:'original'}]}});
 return {worker,row,writes:()=>writes,workCalls:()=>workCalls};
}
test('AUDIT: exclusions must precede recovery writes',async()=>{
 const f=recoveryFixture({quality:'QA',unsubscribed:true});
 await f.worker.run();assert.equal(f.writes(),0);assert.equal(f.workCalls(),0);
});
test('AUDIT: historical reply recovery must preserve paid commercial stage',async()=>{
 const f=recoveryFixture({oldState:'CUSTOMER_REPLY'});
 await f.worker.run();assert.equal(f.row.fields['Commercial Stage'],'Paid verified');
 assert.equal(f.row.fields['Next Action'],'Preserve approved delivery');
});
