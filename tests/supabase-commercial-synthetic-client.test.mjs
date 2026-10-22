import test from 'node:test';
import assert from 'node:assert/strict';
import {createCommercialDispatchGate} from '../lib/supabase_commercial_dispatch_gate.js';
import {createSupabaseCommercialExecutor} from '../lib/supabase_commercial_executor.js';

// Synthetic client, entirely in-memory. No production credentials, recipients or Gmail API.
test('synthetic client: held -> authorized -> reserved -> sending -> sent; duplicate prevented',async()=>{
 const rows=new Map(), calls=[];
 const now='2026-10-22T20:00:00.000Z';
 const fetcher=async(url,options={})=>{
  const u=new URL(url), method=options.method||'GET', key=u.searchParams.get('idempotency_key')?.replace(/^eq\./,'');
  const match=key?rows.get(key):null;
  let result=[];
  if(method==='POST'){
   const incoming=JSON.parse(options.body)[0];
   if(!rows.has(incoming.idempotency_key))rows.set(incoming.idempotency_key,{...incoming,channel:'gmail',authorization_evidence:{},eligibility_evidence:{},suppression_evidence:{}});
  }else if(method==='PATCH'){
   const state=u.searchParams.get('state')?.replace(/^eq\./,'');
   if(match?.state===state){Object.assign(match,JSON.parse(options.body));result=[{...match}];}
  }else if(match)result=[{...match}];
  return {ok:true,text:async()=>JSON.stringify(result)};
 };
 const env={SUPABASE_URL:'https://synthetic.invalid',SUPABASE_SERVICE_ROLE_KEY:'synthetic-only'};
 const gate=createCommercialDispatchGate({fetcher,env});
 const draft={leadId:'synthetic-lead',campaignKey:'qa',idempotencyKey:'qa-unique',email:'synthetic@example.invalid',subject:'Synthetic QA',body:'No real outreach'};
 assert.equal((await gate.hold(draft)).state,'HELD');
 await assert.rejects(gate.authorize('qa-unique',{authorization:{approved:false},eligibility:{approved:true},suppression:{clear:true}}),/DISPATCH_REVIEW_REQUIRED/);
 await gate.authorize('qa-unique',{authorization:{approved:true},eligibility:{approved:true},suppression:{clear:true,checkedAt:now}});
 const gmail={verify:async()=>{calls.push('verify')},search:async()=>{calls.push('history');return []},send:async()=>{calls.push('send');return {messageId:'synthetic-msg-1',threadId:'synthetic-thread'}}};
 const executor=createSupabaseCommercialExecutor({gate,gmail,now:()=>new Date(now)});
 const sent=await executor.dispatch('qa-unique');
 assert.equal(sent.state,'SENT');assert.equal(sent.provider_message_id,'synthetic-msg-1');
 assert.equal(calls.filter(x=>x==='send').length,1);
 await assert.rejects(executor.dispatch('qa-unique'),/DISPATCH_NOT_AUTHORIZED/);
 assert.equal(calls.filter(x=>x==='send').length,1);
 await assert.rejects(gate.hold({...draft,subject:'Changed'}),/DISPATCH_IDEMPOTENCY_COLLISION/);
 assert.equal((await gate.get('qa-unique')).state,'SENT');
});
