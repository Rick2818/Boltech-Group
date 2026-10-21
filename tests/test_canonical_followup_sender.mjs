import test from 'node:test';
import assert from 'node:assert/strict';
import {followupDueAt,followupWindow,processFirstFollowup} from '../lib/canonical_followup_sender.js';
import {reconcileCanonicalFollowups} from '../lib/canonical_followups.js';

const original={id:'original',threadId:'thread',sent:true,from:'ricardo.boltechgroup@gmail.com',to:'buyer@example.com',subject:'Quoting workflow',text:'Hello, about your workflow.',rfcMessageId:'<original@example.com>',receivedAt:'2026-10-20T15:00:00Z'};
const lead={id:'lead',contact_email:'buyer@example.com',status:'CONTACTED',source_payload:{gmail_sent_message_id:'original'}};
function sender({unknown=false,dnc=false}={}){
 const receipt={sendEligible:true},saved=[],sent=[];
 const gmail={search:async()=>[],thread:async()=>[original],send:async job=>{assert.equal(saved.at(-1),'SEND_PENDING');assert.equal(receipt.sendState,'SEND_PENDING');sent.push(job);if(unknown)throw Error('TIMEOUT');return {messageId:'provider-sent',threadId:'thread'};},message:async()=>({...sent[0],id:'provider-sent',sent:true,from:original.from,to:lead.contact_email,receivedAt:'2026-10-23T15:00:00Z'})};
 const command=async args=>args[0]==='GET'&&dnc?'blocked':args[0]==='ZCOUNT'?0:null;
 return {lead,original,messages:[original],receipt,gmail,db:async()=>[lead],save:async state=>{saved.push(state);},now:new Date('2026-10-23T15:00:00Z'),command,suppressionCheck:async()=>false,saved,sent};
}
test('three calendar days include Saturday and Sunday and weekend send windows remain open',()=>{
 assert.equal(followupDueAt('2026-10-22T15:00:00Z'),'2026-10-25T15:00:00.000Z');
 assert.equal(followupDueAt('2026-10-23T16:25:00Z'),'2026-10-26T16:25:00.000Z');
 assert.equal(followupWindow(new Date('2026-10-25T15:00:00Z')),true);
 assert.equal(followupWindow(new Date('2026-10-25T14:59:59Z')),false);
 assert.throws(()=>followupDueAt('invalid'),/CADENCE_INVALID/);
});
test('not due never calls send, but exact due date sends once with durable intent',async()=>{
 const x=sender();const early=await processFirstFollowup({...x,now:new Date('2026-10-22T15:00:00Z')});assert.equal(early.state,'FOLLOWUP_SCHEDULED');assert.equal(x.sent.length,0);
 const due=await processFirstFollowup(x);assert.equal(due.sent,true);assert.equal(x.receipt.sendState,'SENT');assert.equal(x.receipt.messageId,'provider-sent');
 await processFirstFollowup(x);assert.equal(x.sent.length,1);assert.match(x.sent[0].rfcMessageId,/^boltech-followup-/);
});
test('uncertain provider POST is never resent and exact provider receipt reconciles it',async()=>{
 const x=sender({unknown:true});let r=await processFirstFollowup(x);assert.equal(r.state,'UNKNOWN_SEND_STATE');assert.equal(x.sent.length,1);
 r=await processFirstFollowup(x);assert.equal(r.state,'UNKNOWN_SEND_STATE');assert.equal(x.sent.length,1);
 x.gmail.search=async()=>[{id:'provider-sent'}];r=await processFirstFollowup(x);assert.equal(r.reconciled,true);assert.equal(x.receipt.sendState,'SENT');assert.equal(x.sent.length,1);
});
test('DNC, response and prior manual followup prevent sending',async()=>{
 const d=sender({dnc:true});assert.equal((await processFirstFollowup(d)).state,'DNC_CONTACT_HOLD');assert.equal(d.sent.length,0);
 const r=sender();r.receipt.sendEligible=false;r.receipt.sequenceCancelled=true;assert.equal((await processFirstFollowup(r)).state,'SEQUENCE_CANCELLED');
 const p=sender();p.messages.push({...original,id:'manual',receivedAt:'2026-10-21T15:00:00Z'});assert.equal((await processFirstFollowup(p)).state,'EXISTING_FOLLOWUP_HOLD');assert.equal(p.sent.length,0);
});
test('fresh thread change immediately before POST cancels the send',async()=>{
 const x=sender();x.gmail.thread=async()=>[original,{sent:false,from:lead.contact_email,receivedAt:'2026-10-22T15:00:00Z'}];assert.equal((await processFirstFollowup(x)).state,'THREAD_CHANGED_HOLD');assert.equal(x.sent.length,0);
});
test('two simultaneous canonical cycles acquire one lease and permit one send',async()=>{
 const rows=new Map(),sent=[];let runReads=0;
 const db=async(url,opts={})=>{
  const u=new URL('https://db.test'+url),key=u.searchParams.get('work_id')?.slice(3);
  if(u.pathname==='/leads')return opts.method==='PATCH'?null:[lead];
  if(opts.method==='POST'){const [v]=JSON.parse(opts.body);if(!rows.has(v.work_id))rows.set(v.work_id,structuredClone(v));return null;}
  const row=rows.get(key),f=u.searchParams.get('execution_run_id');
  if(opts.method==='PATCH'){if(f&&(f==='is.null'?row.execution_run_id!=null:row.execution_run_id!==f.slice(3)))return [];Object.assign(row,JSON.parse(opts.body));return [structuredClone(row)];}
  runReads++;return row?[structuredClone(row)]:[];
 };
 const gmail={verify:async()=>{},message:async()=>original,thread:async()=>[original],search:async()=>[],send:async()=>{sent.push(1);return {messageId:'provider-sent',threadId:'thread'};}};
 const args={leads:[structuredClone(lead)],gmail,db,now:new Date('2026-10-23T15:00:00Z'),command:async a=>a[0]==='ZCOUNT'?0:null};
 const result=await Promise.all([reconcileCanonicalFollowups(args),reconcileCanonicalFollowups(args)]);assert.equal(sent.length,1);assert.equal(result.reduce((n,r)=>n+r.sent,0),1);assert.ok(runReads>0);
});
