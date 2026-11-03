import test from 'node:test';
import assert from 'node:assert/strict';
import {createLeoAutonomousEngine} from '../lib/leo_autonomous_engine.js';
import {runLeoSyntheticProbe} from '../lib/leo_synthetic_probe.js';
import {handleLeoAutonomyWorker} from '../lib/leo_objectives_http.js';

function fixture({httpFails=false,cleanupFails=false}={}){
 const records=new Map(),queue=new Map();
 let clock=1700000000000,publicFetches=0;
 const store={
  read:async key=>structuredClone(records.get(key)??null),
  writeIfVersion:async(key,expected,record)=>{
   if((records.get(key)?.version??null)!==expected)return false;
   records.set(key,structuredClone(record));return true;
  }
 };
 const command=async args=>{
  if(args[0]==='ZADD'){queue.set(args[3],Number(args[2]));return 1;}
  if(args[0]==='ZREM'){queue.delete(args[2]);return 1;}
  if(args[0]==='ZSCORE')return queue.has(args[2])?String(queue.get(args[2])):null;
  if(args[0]==='DEL'){if(cleanupFails)throw Error('SIMULATED_CLEANUP_FAILURE');records.delete(args[1]);return 1;}
  throw Error('UNEXPECTED_REDIS_'+args[0]);
 };
 const fetcher=async(url,init)=>{
  assert.equal(url,'https://raw.githubusercontent.com/github/docs/main/README.md');
  assert.equal(init.redirect,'error');
  publicFetches++;
  return new Response(httpFails?'unavailable':'# Verified synthetic public documentation\nThis is read-only evidence.',{
   status:httpFails?503:200,headers:{'content-type':'text/plain'}
  });
 };
 const engine=createLeoAutonomousEngine({store,command,fetcher,now:()=>clock});
 return {store,command,engine,records,queue,
  getFetches:()=>publicFetches,
  delay:async()=>{clock+=350;}
 };
}
test('full synthetic flow uses approved steps, receipts, real queue and cleanup',async()=>{
 const f=fixture();
 const result=await runLeoSyntheticProbe({store:f.store,command:f.command,engine:f.engine,delay:f.delay});
 assert.equal(result.synthetic,true);
 assert.equal(result.status,'PASS');
 assert.equal(result.stepCount,3);
 assert.deepEqual(result.steps.map(x=>x.step),['inspect','source_1','report']);
 assert.ok(result.steps.every(x=>/^leo-readonly:[a-f0-9]{64}$/.test(x.receipt)));
 assert.match(result.outputDigest,/^[a-f0-9]{64}$/);
 assert.equal(f.getFetches(),1);
 assert.equal(f.queue.size,0);
 assert.equal(f.records.size,0);
});
test('synthetic failure cannot be counted as a customer completion and cleans up',async()=>{
 const f=fixture({httpFails:true});
 await assert.rejects(runLeoSyntheticProbe({store:f.store,command:f.command,engine:f.engine,delay:f.delay}),{
  code:'LEO_SYNTHETIC_PROBE_FAILED'
 });
 assert.equal(f.queue.size,0);assert.equal(f.records.size,0);
});
test('failed synthetic cleanup never reports a clean PASS',async()=>{
 const f=fixture({cleanupFails:true});
 await assert.rejects(runLeoSyntheticProbe({store:f.store,command:f.command,engine:f.engine,delay:f.delay}),{
  code:'LEO_SYNTHETIC_CLEANUP_FAILED'
 });
});
test('scheduler endpoint synthetic mode requires both secret and explicit temporary gate',async()=>{
 let runs=0;
 const auth='Bearer only-scheduler-secret-not-tenant';
 const probe=async()=>{runs++;return {status:'PASS',synthetic:true,stepCount:3}};
 const invoke=async({authorization=auth,flag='1',mode='synthetic_probe'}={})=>{
  let status,payload;
  const res={setHeader(){},status(n){status=n;return this},json(body){payload=body;return this}};
  await handleLeoAutonomyWorker({method:'POST',headers:{authorization},body:{operation:mode}},res,{
   env:{CRON_SECRET:'only-scheduler-secret-not-tenant',LEO_AUTONOMY_ENABLED:'1',LEO_SYNTHETIC_PROBE_ENABLED:flag},
   syntheticProbe:probe,
   engine:{tick:async()=>({status:'WORKER_TICK',processed:0,receipts:[]})}
  });
  return {status,payload};
 };
 assert.equal((await invoke({authorization:'Bearer invalid'})).status,401);
 assert.equal((await invoke({flag:'0'})).status,403);
 assert.equal((await invoke()).status,200);
 assert.equal(runs,1);
});
