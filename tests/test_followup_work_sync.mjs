import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {syncFollowupWork} from '../lib/followup_work_sync.js';
const qa=JSON.parse(readFileSync(new URL('../config/qa_case.json',import.meta.url)));
const leadId='recQA202610100000',workId='recQA202610100001';
function fixture(status='PENDING_RSI01_RESEARCH',role='RSI-01'){
 const row={id:workId,fields:{'Work ID':`LEAD_INTAKE:${leadId}`,'Source Record ID':leadId,RSI:role,Owner:qa.answers[7],Status:status,Evidence:qa.purpose,'Execution State':'COMPLETED'}};
 let writes=0;
 const request=async q=>{if(!q.id)return {records:[structuredClone(row)]};if(q.fields){writes++;Object.assign(row.fields,q.fields);}return structuredClone(row);};
 const job={recordId:leadId,state:'SENT',messageId:qa.requestId,threadId:qa.id};
 return {row,job,request,writes:()=>writes};
}
test('same QA receipt updates pending task once, preserving owner and execution',async()=>{
 const f=fixture();await syncFollowupWork(f.job,f);await syncFollowupWork(f.job,f);
 assert.equal(f.row.fields.Status,'WAITING_RESPONSE');assert.equal(f.writes(),1);
 assert.equal(f.row.fields.Owner,qa.answers[7]);assert.equal(f.row.fields['Execution State'],'COMPLETED');
});
test('advanced, blocked and uncertain states are preserved',async()=>{
 for(const status of ['BLOCKED_EMAIL_BOUNCED','WAITING_DIRECTOR_APPROVAL','COMPLETED']){
  const f=fixture(status);assert.equal((await syncFollowupWork(f.job,f)).state,'PRESERVED');assert.equal(f.writes(),0);
 }
 for(const state of ['UNKNOWN','SEND_PENDING','CUSTOMER_REPLY']){
  const f=fixture();f.job.state=state;await syncFollowupWork(f.job,f);assert.equal(f.writes(),0);
 }
});
test('ambiguous or advanced-role tasks cannot be mutated',async()=>{
 const f=fixture();await assert.rejects(syncFollowupWork(f.job,{request:async()=>({records:[f.row,f.row]})}),/RECONCILE_REQUIRED/);
 const advanced=fixture('WAITING_RESPONSE','RSI-02');await assert.rejects(syncFollowupWork(advanced.job,advanced),/RECONCILE_REQUIRED/);assert.equal(advanced.writes(),0);
});
test('write without matching readback remains unconfirmed',async()=>{
 const f=fixture();await assert.rejects(syncFollowupWork(f.job,{request:async q=>q.id?structuredClone(f.row):{records:[f.row]}}),/SYNC_UNCONFIRMED/);
});
