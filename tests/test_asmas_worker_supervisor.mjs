import test from 'node:test';
import assert from 'node:assert/strict';
import {pollAgent,WORKERS} from '../asmas/worker-supervisor.mjs';
import {message} from '../asmas/core.mjs';
const payload=message({source:'A1',destination:'A2',action:'TRANSFER',caseId:'SYN-E2E-001',runId:'qa',taskId:'t'});
test('five workers registered without external effects',()=>assert.deepEqual(WORKERS,['A1','A2','A3','A4','A5']));
test('supervisor performs durable commit before Redis ACK',async()=>{
 const calls=[];
 const redis={
  xgroup:async()=>calls.push('group'),
  xreadgroup:async()=>[['asmas:agent_2_queue',[['1-0',['envelope',JSON.stringify(payload)]]]]],
  xack:async()=>{calls.push('ack');return 1}
 };
 const repository={
  claim:async()=>({id:'synthetic-task',status:'CLAIMED'}),
  commit:async()=>calls.push('commit'),
  fail:async()=>calls.push('fail')
 };
 const result=await pollAgent({agent:'A2',redis,repository,executor:async()=>({status:'SUCCEEDED'})});
 assert.equal(result.status,'COMPLETED');
 assert.deepEqual(calls,['group','commit','ack']);
});
test('deferred worker cannot acknowledge uncommitted task',async()=>{
 let acknowledged=false;
 const redis={
  xgroup:async()=>{},
  xreadgroup:async()=>[['asmas:agent_2_queue',[['1-0',['envelope',JSON.stringify(payload)]]]]],
  xack:async()=>{acknowledged=true}
 };
 const result=await pollAgent({agent:'A2',redis,repository:{claim:async()=>({status:'LEASED'}),commit:async()=>{}},executor:async()=>({status:'SUCCEEDED'})});
 assert.equal(result.status,'DEFERRED');
 assert.equal(acknowledged,false);
});
