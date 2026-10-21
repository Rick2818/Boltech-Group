import test from 'node:test';
import assert from 'node:assert/strict';
import {runCanonicalOutreach} from '../lib/canonical_outreach.js';

function setup({amount=1,unknown=false,blocked=false,history=false}={}){
 const leads=Array.from({length:amount},(_,i)=>({id:'lead'+i,name:'Company '+i,company_url:'https://company'+i+'.com',contact_email:'owner@company'+i+'.com',country:'US',status:'NEW',commercial_stage:'PREPARED',data_quality:'PREPARED_PENDING_HISTORY_CHECK',source_payload:{campaignDraft:{subject:'Workflow',body:'Draft'}}}));
 const rows=new Map(),sent=[],messages=new Map();
 const db=async(raw,opts={})=>{
  const u=new URL('https://db.test'+raw),key=u.searchParams.get('work_id')?.slice(3);
  if(u.pathname==='/leads'){
   const row=leads.find(l=>l.id===u.searchParams.get('id')?.slice(3));if(!row)return [];
   const status=u.searchParams.get('status');if(status&&row.status!==status.slice(3))return [];
   if(opts.method==='PATCH')Object.assign(row,JSON.parse(opts.body));return [structuredClone(row)];
  }
  if(opts.method==='POST'){const [v]=JSON.parse(opts.body);if(!rows.has(v.work_id))rows.set(v.work_id,structuredClone(v));return null;}
  const row=rows.get(key),f=u.searchParams.get('execution_run_id');
  if(opts.method==='PATCH'){if(f&&(f==='is.null'?row.execution_run_id!=null:row.execution_run_id!==f.slice(3)))return [];Object.assign(row,JSON.parse(opts.body));return [structuredClone(row)];}
  return row?[structuredClone(row)]:[];
 };
 const gmail={search:async q=>q.includes('rfc822msgid:')?[...messages.values()].filter(m=>q.endsWith(m.rfcMessageId)).map(m=>({id:m.id})):history?[{id:'old-contact'}]:[],send:async job=>{assert.ok([...rows.values()].some(r=>r.execution_receipt.sendState==='SEND_PENDING'&&r.execution_receipt.rfcMessageId===job.rfcMessageId));sent.push(job);const id='gmail-'+sent.length,m={id,threadId:'thread-'+id,sent:true,from:'ricardo.boltechgroup@gmail.com',to:job.email,rfcMessageId:job.rfcMessageId,receivedAt:'2026-10-21T16:00:00Z'};messages.set(id,m);if(unknown)throw Error('NETWORK_TIMEOUT');return {messageId:id,threadId:m.threadId};},message:async id=>messages.get(id)};
 const verifyCandidate=async()=>({draft:{subject:'Verified workflow question',body:'Individual draft based on official evidence.'},verification:{emailSyntax:true,emailPublished:true,namedContactPublished:true,rolePublished:true,mxVerified:true,publishedWorkflow:'QUOTE_REQUEST'}});
 return {leads,db,gmail,verifyCandidate,command:async args=>args[0]==='ZCOUNT'?0:null,suppressionCheck:async()=>blocked,now:new Date('2026-10-21T16:00:00Z'),sent,rows};
}
test('canonical prepared queue sends any eligible size, including fewer than five, and persists provider receipts',async()=>{
 const x=setup({amount:2});const result=await runCanonicalOutreach(x);assert.equal(result.sent,2);assert.equal(result.pending,0);assert.ok(x.leads.every(l=>l.status==='CONTACTED'&&l.source_payload.gmail_sent_message_id&&l.source_payload.campaign==='2026-10-21'));
 await runCanonicalOutreach(x);assert.equal(x.sent.length,2);
});
test('concurrent inbox and daily cron share account leases and never double-send',async()=>{
 const x=setup();await Promise.all([runCanonicalOutreach(x),runCanonicalOutreach(x)]);assert.equal(x.sent.length,1);
});
test('lost Gmail response reconciles the provider message rather than sending again',async()=>{
 const x=setup({unknown:true});const first=await runCanonicalOutreach(x);assert.equal(first.sent,0);assert.equal(x.sent.length,1);assert.equal(x.leads[0].status,'NEW');
 const second=await runCanonicalOutreach(x);assert.equal(second.reconciled,1);assert.equal(x.sent.length,1);assert.equal(x.leads[0].status,'CONTACTED');
});
test('DNC, previous account history and incomplete official evidence prevent sending',async()=>{
 const d=setup({blocked:true});await runCanonicalOutreach(d);assert.equal(d.sent.length,0);
 const h=setup({history:true});await runCanonicalOutreach(h);assert.equal(h.sent.length,0);
 const v=setup();v.verifyCandidate=async()=>({draft:{subject:'x',body:'x'},verification:{mxVerified:false}});await runCanonicalOutreach(v);assert.equal(v.sent.length,0);
});
test('time budget checkpoints pending opportunities without an exact-five threshold',async()=>{
 const x=setup({amount:8});let time=0;const original=x.gmail.send;x.gmail.send=async j=>{const r=await original(j);time+=100;return r;};
 const r=await runCanonicalOutreach({...x,clock:()=>time,budgetMs:150});assert.equal(r.sent,2);assert.equal(r.pending,6);
});
test('initial outreach respects the configured weekday business window',async()=>{
 const x=setup();const r=await runCanonicalOutreach({...x,now:new Date('2026-10-25T16:00:00Z')});assert.equal(r.status,'OUTSIDE_INITIAL_SEND_WINDOW');assert.equal(x.sent.length,0);
});
