import test from 'node:test';
import assert from 'node:assert/strict';
import {reconcileCanonicalFollowups} from '../lib/canonical_followups.js';
import {commercialSchedulerAuthorized} from '../lib/commercial_scheduler_auth.js';

function setup({incoming=[],badReceipt=false}={}){
 const lead={id:'lead',contact_email:'buyer@example.com',status:'CONTACTED',source_payload:{gmail_sent_message_id:'original'}};
 const original={id:'original',threadId:'thread',sent:true,from:'ricardo.boltechgroup@gmail.com',to:'buyer@example.com',receivedAt:'2026-10-20T15:00:00Z',rfcMessageId:'<original@example.com>',subject:'Workflow inquiry'};
 const writes=[],work=new Map();
 const gmail={search:async()=>[],message:async()=>original,thread:async()=>[original,...incoming.map((x,i)=>({id:'reply'+i,threadId:'thread',from:lead.contact_email,to:original.from,receivedAt:'2026-10-21T15:00:00Z',...x}))]};
 const db=async(url,options={})=>{
  const u=new URL('https://db.test'+url),isWork=u.pathname==='/agent_work';
  if(!isWork){if(options.method==='PATCH'){writes.push(JSON.parse(options.body));return null;}return [lead];}
  if(options.method==='POST'){const [row]=JSON.parse(options.body);if(!work.has(row.work_id))work.set(row.work_id,structuredClone(row));return null;}
  const id=u.searchParams.get('work_id').slice(3),row=work.get(id);
  const filter=u.searchParams.get('execution_run_id');
  const matches=!filter||(filter==='is.null'?row?.execution_run_id==null:row?.execution_run_id===filter.slice(3));
  if(options.method==='PATCH'){if(!row||!matches)return [];const change=JSON.parse(options.body);Object.assign(row,change);writes.push(change);return [structuredClone(row)];}
  if(badReceipt&&u.searchParams.get('select')?.includes('execution_state'))return [];
  return row?[structuredClone(row)]:[];
 };
 return {lead,gmail,db,writes,work,now:new Date('2026-10-21T15:00:00Z'),command:async args=>args[0]==='ZCOUNT'?0:null};
}
test('provider-confirmed contact gets durable followup; research rows do not',async()=>{
 const x=setup();const result=await reconcileCanonicalFollowups({...x,leads:[x.lead,{id:'research',status:'NEW',next_action:'Research'}]});
 assert.equal(result.checked,1);assert.equal(result.waiting,1);assert.equal(x.work.size,1);
 const row=[...x.work.values()][0];assert.equal(row.execution_receipt.threadId,'thread');assert.equal(row.execution_receipt.sendAuthorized,true);assert.equal(row.execution_receipt.dueAt,'2026-10-23T15:00:00.000Z');assert.match(row.next_action,/First follow-up due/);
});
test('human response cancels silent sequence and preserves current provider message',async()=>{
 const x=setup({incoming:[{text:'What is the price?',sent:false}]});const r=await reconcileCanonicalFollowups({...x,leads:[x.lead]});
 assert.equal(r.responded,1);assert.equal([...x.work.values()][0].execution_receipt.sequenceCancelled,true);assert.equal([...x.work.values()][0].execution_receipt.lastCustomerMessageId,'reply0');
});
test('opt out suppresses CRM and in-memory contact before any reply',async()=>{
 const x=setup({incoming:[{text:'Please unsubscribe',sent:false}]});const r=await reconcileCanonicalFollowups({...x,leads:[x.lead]});
 assert.equal(r.suppressed,1);assert.equal(x.lead.status,'SUPPRESSED');assert.ok(x.writes.some(w=>w.commercial_stage==='SUPPRESSED'));
});
test('failed persistence is visible and never counts as successful reconciliation',async()=>{
 const x=setup({badReceipt:true});const r=await reconcileCanonicalFollowups({...x,leads:[x.lead]});assert.equal(r.checked,0);assert.equal(r.errors[0].error,'FOLLOWUP_READBACK_MISSING');
});
test('confirmed delivery failure in a separate thread blocks the sequence',async()=>{
 const x=setup();const original=x.gmail.message;x.gmail.search=async()=>[{id:'bounce'}];x.gmail.message=async id=>id==='bounce'?{id:'bounce',sent:false,from:'mailer-daemon@example.net',subject:'Delivery failed',text:'550 5.1.1 buyer@example.com',receivedAt:'2026-10-21T14:00:00Z'}:original(id);
 const r=await reconcileCanonicalFollowups({...x,leads:[x.lead]});assert.equal(r.suppressed,1);assert.equal([...x.work.values()][0].execution_receipt.reason,'DELIVERY_FAILURE');
});
test('dedicated scheduler credential is fail-closed and preserves existing cron authentication',()=>{
 assert.equal(commercialSchedulerAuthorized({headers:{}},{}),false);
 assert.equal(commercialSchedulerAuthorized({headers:{authorization:'Bearer scheduler'}},{BOLTECH_SCHEDULER_SECRET:'scheduler'}),true);
 assert.equal(commercialSchedulerAuthorized({headers:{authorization:'Bearer old'}},{CRON_SECRET:'old'}),true);
 assert.equal(commercialSchedulerAuthorized({headers:{authorization:'Bearer wrong'}},{BOLTECH_SCHEDULER_SECRET:'scheduler'}),false);
});
test('quota exhaustion stops the scan and releases the current followup lease',async()=>{
 const x=setup();let reads=0;
 x.gmail.message=async()=>{reads++;throw Object.assign(Error('GMAIL_RATE_LIMITED'),{code:'GMAIL_RATE_LIMITED'});};
 await assert.rejects(reconcileCanonicalFollowups({...x,leads:[x.lead,{...x.lead,id:'second'}]}),/GMAIL_RATE_LIMITED/);
 assert.equal(reads,1);assert.equal(x.work.size,1);assert.equal([...x.work.values()][0].execution_receipt.leaseUntil,null);
});
