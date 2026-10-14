import test from 'node:test';import assert from 'node:assert/strict';import {consumeOne,publishOutbox} from '../asmas/queue-worker.mjs';import {message} from '../asmas/core.mjs';
const m=message({source:'A1',destination:'A2',action:'TRANSFER',caseId:'SYN-E2E-001',runId:'test',taskId:'t'});
test('ack only after durable commit',async()=>{
 const order=[];
 const broker={read:async()=>({id:'evt',message:m}),ack:async()=>order.push('ack')};
 const repository={claim:async()=>({id:'task',status:'CLAIMED'}),commit:async()=>order.push('commit'),fail:async()=>order.push('fail')};
 const out=await consumeOne({broker,repository,executor:async()=>({status:'SUCCEEDED'})});
 assert.deepEqual(order,['commit','ack']);assert.equal(out.status,'COMPLETED');
});
test('uncertain external operation requires reconciliation; never ACK',async()=>{
 let ack=false,unknown=false;
 const out=await consumeOne({broker:{read:async()=>({id:'evt',message:m}),ack:async()=>{ack=true}},repository:{claim:async()=>({id:'task',status:'CLAIMED'}),commit:async()=>{},flagUnknown:async()=>{unknown=true}},executor:async()=>({status:'UNKNOWN_RESULT'})});
 assert.equal(out.status,'RECONCILIATION_REQUIRED');assert.equal(ack,false);assert.equal(unknown,true);
});
test('duplicate tasks acknowledged without executing',async()=>{
 let invoked=false,ack=false;
 const out=await consumeOne({broker:{read:async()=>({id:'evt',message:m}),ack:async()=>{ack=true}},repository:{claim:async()=>({status:'COMPLETED'}),commit:async()=>{}},executor:async()=>{invoked=true}});
 assert.equal(out.status,'DUPLICATE_ACKED');assert.equal(ack,true);assert.equal(invoked,false);
});
test('transaction failure must not ACK',async()=>{
 let ack=false,failed=false;
 const out=await consumeOne({broker:{read:async()=>({id:'evt',message:m}),ack:async()=>{ack=true}},repository:{claim:async()=>({id:'t',status:'CLAIMED'}),commit:async()=>{throw Error('DB_DOWN')},fail:async()=>{failed=true}},executor:async()=>({status:'SUCCEEDED'})});
 assert.equal(out.status,'FAILED');assert.equal(ack,false);assert.equal(failed,true);
});
test('outbox is published before mark, safe for duplicate broker deliveries',async()=>{
 const order=[];
 const n=await publishOutbox({repository:{pendingOutbox:async()=>[{id:'x',topic:'q',payload:{}}],markPublished:async()=>order.push('mark')},broker:{publish:async()=>order.push('publish')}});
 assert.equal(n,1);assert.deepEqual(order,['publish','mark']);
});
