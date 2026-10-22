import test from 'node:test';
import assert from 'node:assert/strict';
import {createCommercialDispatchGate} from '../lib/supabase_commercial_dispatch_gate.js';

test('same idempotency key with different subject or body fails closed',async()=>{
 const stored={lead_id:'lead-1',campaign_key:'campaign-1',idempotency_key:'key-1',recipient_email:'buyer@example.com',subject:'Original',body_text:'Body',channel:'gmail',state:'HELD'};
 const fetcher=async(url,options={})=>({
  ok:true,
  text:async()=>JSON.stringify(options.method==='POST'?[]:[stored])
 });
 const gate=createCommercialDispatchGate({fetcher,env:{SUPABASE_URL:'https://example.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'test'}});
 const base={leadId:'lead-1',campaignKey:'campaign-1',idempotencyKey:'key-1',email:'buyer@example.com',subject:'Original',body:'Body'};
 assert.equal((await gate.hold(base)).state,'HELD');
 await assert.rejects(gate.hold({...base,subject:'Changed'}),/DISPATCH_IDEMPOTENCY_COLLISION/);
 await assert.rejects(gate.hold({...base,body:'Changed'}),/DISPATCH_IDEMPOTENCY_COLLISION/);
 await assert.rejects(gate.hold({...base,email:'other@example.com'}),/DISPATCH_IDEMPOTENCY_COLLISION/);
});

test('unauthorized dispatch cannot be promoted',async()=>{
 const gate=createCommercialDispatchGate({fetcher:async()=>{throw Error('No network expected')},env:{}});
 await assert.rejects(gate.authorize('key',{authorization:{approved:false},eligibility:{approved:true},suppression:{clear:true}}),/DISPATCH_REVIEW_REQUIRED/);
});
