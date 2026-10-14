import test from 'node:test';import assert from 'node:assert/strict';import {RedisStreamsBroker} from '../asmas/redis-streams.mjs';
test('stream naming and isolation',()=>{const b=new RedisStreamsBroker({});assert.equal(b.stream('A4'),'asmas:agent_4_queue');assert.throws(()=>b.stream('A6'));});
test('real messaging command contract against fake redis',async()=>{
 const calls=[];
 const redis={xgroup:async(...v)=>calls.push(['group',...v]),xadd:async(...v)=>{calls.push(['add',...v]);return '1-0'},xreadgroup:async(...v)=>{calls.push(['read',...v]);return [['asmas:agent_2_queue',[['1-0',['envelope',JSON.stringify({destination_agent:'A2',action:'PING'})]]]]]},xack:async(...v)=>{calls.push(['ack',...v]);return 1}};
 const b=new RedisStreamsBroker(redis);
 const msg={destination_agent:'A2',action:'PING'};
 await b.publish('A2',msg);
 const result=await b.read('A2','consumer-2');
 assert.equal(result.message.action,'PING');
 assert.equal(await b.ack('A2',result.id),1);
 assert.deepEqual(calls.map(x=>x[0]),['add','group','read','ack']);
});
test('cannot publish to incorrect destination',async()=>{
 const b=new RedisStreamsBroker({xadd:async()=>{throw Error('should not send')}});
 await assert.rejects(()=>b.publish('A1',{destination_agent:'A2'}),/DESTINATION_MISMATCH/);
});
