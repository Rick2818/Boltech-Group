import test from 'node:test';
import assert from 'node:assert/strict';
import {createRedisAgentCheckpoints} from '../lib/redis_agent_checkpoints.js';
const a={orderId:'order-a',customerId:'customer-a',tenantId:'tenant-a'};
const b={orderId:'order-b',customerId:'customer-b',tenantId:'tenant-b'};
function redis(){
 const store=new Map();
 return async function command(cmd){
  if(cmd[0]==='GET')return store.get(cmd[1])||null;
  if(cmd[0]==='SET'){if(cmd.includes('NX')&&store.has(cmd[1]))return null;store.set(cmd[1],cmd[2]);return 'OK';}
  if(cmd[0]==='EVAL'){
   const key=cmd[3],old=JSON.parse(store.get(key)||'null'),expected=Number(cmd[4]);
   if(!old||old.version!==expected)return 'CONFLICT';
   if(cmd[1].includes('v.status~=')&&old.status!=='AUTHORIZED')return 'CONFLICT';
   store.set(key,cmd[5]);return 'OK';
  }
  throw Error('Unexpected command '+cmd[0]);
 };
}
test('two tenant checkpoints remain isolated after worker restart',async()=>{
 const command=redis();
 const worker1=createRedisAgentCheckpoints({command});
 await worker1.initialize(a);await worker1.initialize(b);
 await worker1.save({...a,expectedVersion:1,receipt:{status:'TASK_COMPLETED_NOT_DELIVERED',output:'Tenant A completed'}});
 const worker2=createRedisAgentCheckpoints({command});
 assert.equal((await worker2.load(a)).lastReceipt.output,'Tenant A completed');
 assert.equal((await worker2.load(b)).lastReceipt,undefined);
 await assert.rejects(worker2.save({...b,expectedVersion:1,receipt:{status:'TASK_COMPLETED_NOT_DELIVERED',output:'Tenant B completed'}}).then(async()=>worker2.save({...b,expectedVersion:1,receipt:{status:'TASK_COMPLETED_NOT_DELIVERED',output:'duplicate'}})),/CHECKPOINT_STALE_OR_REVOKED/);
 assert.equal((await worker2.load(a)).lastReceipt.output,'Tenant A completed');
});
test('revocation survives restart and prevents subsequent checkpoint writes',async()=>{
 const command=redis(),w=createRedisAgentCheckpoints({command});
 await w.initialize(a);await w.revoke(a);
 const restarted=createRedisAgentCheckpoints({command});
 assert.equal((await restarted.load(a)).status,'REVOKED');
 await assert.rejects(restarted.save({...a,expectedVersion:2,receipt:{status:'TASK_COMPLETED_NOT_DELIVERED',output:'bad'}}),/CHECKPOINT_STALE_OR_REVOKED/);
});
