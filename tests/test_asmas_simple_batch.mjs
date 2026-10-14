import test from 'node:test';import assert from 'node:assert/strict';
import {createBatchHandler} from '../asmas/simple-batch.mjs';
const token='a'.repeat(64);const request=()=>new Request('https://asmas.test',{method:'POST',headers:{'X-ASMAS-Worker-Token':token}});
function fixture(){
 const roles=['A5','A1','A2','A3','A4'];let i=0;const done=[],failed=[],statuses=[];
 const repository={authorized:async t=>t===token,settings:async()=>({google_free_tier_verified:true}),status:async s=>statuses.push(s),
 claim:async()=>i<roles.length?{id:i,lease_token:'lease-'+i,agent:roles[i++],case_id:'SYN-E2E-001',action:'SYNTHETIC_ANALYSIS',payload:{is_synthetic:true}}:null,
 finish:async(id,lease,result)=>{done.push(result);return true},fail:async(id)=>failed.push(id)};
 return{repository,done,failed,statuses};
}
test('one bounded host processes each of five roles in separate batches; no sale certification',async()=>{
 const f=fixture();let calls=0;
 const handler=createBatchHandler({repository:f.repository,apiKeyPresent:true,runModel:async(agent)=>{calls++;return{agent,model:'gemini-3.5-flash-lite',text:'test-only response'}}});
 for(let n=0;n<5;n++){
  const r=await handler(request());const body=await r.json();
  assert.equal(r.status,200);assert.equal(body.processed,1);
  assert.equal(body.certified,false);assert.equal(body.payments,0);
 }
 assert.equal(calls,5);
 assert.deepEqual(f.done.map(x=>x.agent),['A5','A1','A2','A3','A4']);
 assert.equal(f.done[0].model,'gemini-3.5-flash-lite');
 assert.equal(f.done[1].model,'gemini-3.5-flash-lite');
 assert.ok(f.done.every(x=>x.model==='gemini-3.5-flash-lite'));
});
test('missing credential or unverified free tier prevents task claim and inference',async()=>{
 for(const apiKeyPresent of [false,true]){
  const f=fixture();f.repository.settings=async()=>({google_free_tier_verified:false});
  f.repository.claim=async()=>{throw Error('must not claim')};
  const r=await createBatchHandler({repository:f.repository,apiKeyPresent,runModel:async()=>{throw Error('must not call')}})(request());
  assert.equal(r.status,503);assert.equal((await r.json()).model_calls,0);
 }
});
test('unauthorized caller cannot invoke model or read tasks',async()=>{
 const handler=createBatchHandler({repository:{authorized:async()=>false},apiKeyPresent:true,runModel:async()=>{throw Error('must not call')}});
 assert.equal((await handler(new Request('https://asmas.test',{method:'POST'}))).status,403);
 assert.equal((await handler(request())).status,403);
});
test('uncertain model result or lease conflict is held for review without a second attempt',async()=>{
 for(const conflict of [false,true]){
  const f=fixture();let calls=0;f.repository.finish=async()=>false;
  const handler=createBatchHandler({repository:f.repository,apiKeyPresent:true,runModel:async(agent)=>{calls++;if(!conflict)throw Error('secret-provider-detail');return{agent,model:'gemini-3.8-flash',text:'test'};}});
  const r=await handler(request());assert.equal(r.status,502);assert.equal(calls,1);assert.equal(f.failed.length,1);
  assert.ok(!(await r.text()).includes('secret-provider-detail'));
 }
});
test('public readiness exposes no task data and invokes no model',async()=>{
 const f=fixture();const h=createBatchHandler({repository:f.repository,apiKeyPresent:false,runModel:async()=>{throw Error('must not call')}});
 const r=await h(new Request('https://asmas.test'));const b=await r.json();
 assert.equal(r.status,503);assert.equal(b.status,'BLOCKED_GOOGLE_API_KEY');assert.equal(b.model_calls,0);assert.equal(f.done.length,0);
});
