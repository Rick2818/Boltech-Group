import test from 'node:test';
import assert from 'node:assert/strict';
import {createSupabaseCommercialExecutor} from '../lib/supabase_commercial_executor.js';
const row={state:'AUTHORIZED',channel:'gmail',recipient_email:'buyer@example.com',subject:'Hello',body_text:'Body',authorization_evidence:{approved:true},eligibility_evidence:{approved:true},suppression_evidence:{clear:true,checkedAt:'2026-10-22T18:00:00.000Z'}};
test('rejects missing authorization without Gmail access',async()=>{
 let called=false;
 const executor=createSupabaseCommercialExecutor({gate:{get:async()=>({...row,state:'HELD'})},gmail:{verify:async()=>{called=true}},now:()=>new Date('2026-10-22T18:10:00Z')});
 await assert.rejects(executor.dispatch('id'),/DISPATCH_NOT_AUTHORIZED/);
 assert.equal(called,false);
});
test('rejects stale suppression before Gmail access',async()=>{
 let called=false;
 const executor=createSupabaseCommercialExecutor({gate:{get:async()=>row},gmail:{verify:async()=>{called=true}},now:()=>new Date('2026-10-22T20:00:00Z')});
 await assert.rejects(executor.dispatch('id'),/DISPATCH_SUPPRESSION_STALE/);
 assert.equal(called,false);
});
test('rejects existing Gmail history before reservation',async()=>{
 let reserved=false;
 const executor=createSupabaseCommercialExecutor({gate:{get:async()=>row,reserve:async()=>{reserved=true}},gmail:{verify:async()=>({verified:true}),search:async()=>[{id:'old'}]},now:()=>new Date('2026-10-22T18:10:00Z')});
 await assert.rejects(executor.dispatch('id'),/DISPATCH_EXISTING_GMAIL_HISTORY/);
 assert.equal(reserved,false);
});
test('sends once after durable reservation and records receipt',async()=>{
 const order=[];
 const gate={get:async()=>row,reserve:async()=>{order.push('reserve');return row},markSending:async()=>{order.push('sending');return row},receipt:async(_,receipt)=>{order.push('receipt');return receipt}};
 const gmail={verify:async()=>{order.push('verify')},search:async()=>{order.push('search');return []},send:async job=>{order.push('send');assert.equal(job.email,row.recipient_email);return {messageId:'msg-1'}}};
 const result=await createSupabaseCommercialExecutor({gate,gmail,now:()=>new Date('2026-10-22T18:10:00Z')}).dispatch('id');
 assert.equal(result.messageId,'msg-1');
 assert.deepEqual(order,['verify','search','reserve','sending','send','receipt']);
});
test('unknown Gmail result never records sent receipt',async()=>{
 let receipt=false;
 const gate={get:async()=>row,reserve:async()=>row,markSending:async()=>row,receipt:async()=>{receipt=true}};
 const gmail={verify:async()=>{},search:async()=>[],send:async()=>{throw Error('timeout')}};
 await assert.rejects(createSupabaseCommercialExecutor({gate,gmail,now:()=>new Date('2026-10-22T18:10:00Z')}).dispatch('id'),/DISPATCH_PROVIDER_OUTCOME_UNCERTAIN/);
 assert.equal(receipt,false);
});
