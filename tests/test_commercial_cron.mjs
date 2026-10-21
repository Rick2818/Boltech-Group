import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../lib/agent1_autonomous_inbox.js';
import {commercialSchedulerAuthorized} from '../lib/commercial_scheduler_auth.js';
test('scheduled GET and recovery POST cannot run without authentication',async()=>{
 for(const req of [{method:'GET',url:'/?scheduled_campaign=1',headers:{}},{method:'POST',headers:{}}]){
  let status,body;const res={status:n=>(status=n,res),json:x=>(body=x,res)};
  await handler(req,res);assert.equal(status,401);assert.equal(body.error,'UNAUTHORIZED');
 }
});
test('ordinary GET cannot dispatch a campaign',async()=>{
 let status;const res={status:n=>(status=n,res),json:()=>res};
 await handler({method:'GET',url:'/',headers:{}},res);assert.equal(status,405);
});
test('only configured scheduler credentials authenticate shared executor',()=>{
 const env={CRON_SECRET:'daily',BOLTECH_SCHEDULER_SECRET:'recovery'};
 for(const key of ['daily','recovery'])assert.equal(commercialSchedulerAuthorized({headers:{authorization:'Bearer '+key}},env),true);
 for(const key of ['', 'Bearer', 'Bearer unknown'])assert.equal(commercialSchedulerAuthorized({headers:{authorization:key}},env),false);
});
