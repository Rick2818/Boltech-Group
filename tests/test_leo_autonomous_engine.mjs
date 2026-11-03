import test from 'node:test';
import assert from 'node:assert/strict';
import {createLeoTenantAgent} from '../lib/leo_tenant_autonomy.js';
import {createLeoAutonomousEngine} from '../lib/leo_autonomous_engine.js';
import {handleLeoAutonomyWorker} from '../lib/leo_objectives_http.js';

function harness({failFetch=false}={}){
 const records=new Map(),queue=new Map();
 let timestamp=1700000000000,fetchCalls=0,blockedFetch=failFetch;
 const now=()=>timestamp,advance=ms=>{timestamp+=ms};
 const store={
  read:async k=>structuredClone(records.get(k)??null),
  writeIfVersion:async(k,v,r)=>{
   if((records.get(k)?.version??null)!==v)return false;
   records.set(k,structuredClone(r));return true;
  }
 };
 const command=async cmd=>{
  if(cmd[0]==='ZADD'){const previous=queue.has(cmd[3]);queue.set(cmd[3],Number(cmd[2]));return previous?0:1;}
  if(cmd[0]==='ZREM'){const previous=queue.has(cmd[2]);queue.delete(cmd[2]);return previous?1:0;}
  if(cmd[0]==='ZRANGEBYSCORE')return [...queue].filter(([,at])=>at<=Number(cmd[3])).sort((a,b)=>a[1]-b[1]).slice(0,Number(cmd[6])).map(([key])=>key);
  throw Error('UNEXPECTED_REDIS_COMMAND_'+cmd[0]);
 };
 const fetcher=async(url,opts)=>{
  assert.match(url,/^https:\/\/docs\.github\.com\//);
  assert.equal(opts.redirect,'error');
  fetchCalls++;
  if(blockedFetch)return new Response('Unavailable',{status:503,headers:{'content-type':'text/plain'}});
  return new Response('<html><body><h1>Documentation</h1> Verified public API guidelines and examples.</body></html>',{headers:{'content-type':'text/html'}});
 };
 const engine=()=>createLeoAutonomousEngine({store,command,fetcher,now});
 const principal=(tenantId='tenant-001',subject='owner-001',roles=['tenant_admin'])=>({verified:true,tenantId,subject,roles});
 const agent=(id='tenant-001')=>createLeoTenantAgent({store,principal:principal(id),clock:()=>new Date(now()).toISOString()});
 const objective={id:'objective-001',description:'Review official documentation to prepare a neutral reference overview',
  criteria:'Provide an evidence inventory with sources and receipts',
  delegation:{expectedResult:'An auditable reference inventory ready for review',
   sources:['https://docs.github.com/en/get-started'],
   reviewInstructions:'No messages, purchases, or modifications',
   preferredChannel:'chat'}};
 return {records,queue,store,now,advance,principal,agent,engine,objective,
  setFetchBlocked:x=>{blockedFetch=x},getFetchCalls:()=>fetchCalls};
}
test('independent worker executes approved multi-step plan, survives restarts and awaits review',async()=>{
 const f=harness();const a=f.agent();
 let r=await a.objective(f.objective);
 r=await f.engine().prepare({principal:f.principal(),id:r.id,expectedVersion:r.version,eventId:'prepare-001'});
 assert.equal(r.status,'AWAITING_PLAN_APPROVAL');
 assert.equal(r.automation.steps.length,3);
 assert.equal(f.queue.size,0);
 r=await f.engine().approve({principal:f.principal(),id:r.id,expectedVersion:r.version,eventId:'approve-001',approval:true});
 assert.equal(r.status,'READY');assert.equal(f.queue.size,1);
 let result=await f.engine().tick();assert.equal(result.receipts[0].step,'inspect');
 f.advance(500);result=await f.engine().tick();assert.equal(result.receipts[0].step,'source_1');
 assert.equal(f.getFetchCalls(),1);
 f.advance(500);result=await f.engine().tick();assert.equal(result.receipts[0].step,'report');
 assert.equal(result.receipts[0].status,'AWAITING_REVIEW');
 const progress=await f.agent().progress(r.id);
 assert.equal(progress.automation.receipts.length,3);
 assert.equal(progress.automation.stepIndex,3);
 assert.equal(progress.lastReceipt,progress.automation.receipts[2].receipt);
 assert.equal(f.queue.size,0);
 const final=await f.agent().transition({id:r.id,expectedVersion:progress.version,action:'complete',eventId:'complete-001',approval:true});
 assert.equal(final.status,'COMPLETED');
 assert.equal(f.getFetchCalls(),1);
});
test('unapproved jobs do not execute, foreign tenants cannot prepare, legacy approval cannot bypass engine',async()=>{
 const f=harness(),admin=f.agent();let r=await admin.objective(f.objective);
 await assert.rejects(f.engine().prepare({principal:f.principal('tenant-002'),id:r.id,expectedVersion:r.version,eventId:'wrong-tenant'}),{code:'LEO_AUTONOMY_NOT_FOUND'});
 await assert.rejects(f.engine().prepare({principal:f.principal('tenant-001','operator-001',['tenant_operator']),id:r.id,expectedVersion:r.version,eventId:'wrong-role'}),{code:'LEO_AUTONOMY_ADMIN_REQUIRED'});
 r=await f.engine().prepare({principal:f.principal(),id:r.id,expectedVersion:r.version,eventId:'prepare-001'});
 await assert.rejects(admin.transition({id:r.id,expectedVersion:r.version,action:'approve',eventId:'old-approve',approval:true}),{code:'LEO_AUTONOMY_MANAGED_ONLY'});
 const empty=await f.engine().tick();assert.equal(empty.processed,0);
 assert.equal(f.getFetchCalls(),0);
});
test('tool failure blocks safely and only new admin approval requeues',async()=>{
 const f=harness({failFetch:true}),e=f.engine();let r=await f.agent().objective(f.objective);
 r=await e.prepare({principal:f.principal(),id:r.id,expectedVersion:r.version,eventId:'prepare-001'});
 r=await e.approve({principal:f.principal(),id:r.id,expectedVersion:r.version,eventId:'approve-001',approval:true});
 await e.tick();f.advance(400);
 let result=await e.tick();assert.equal(result.receipts[0].status,'BLOCKED_OR_UNCERTAIN');
 let blocked=await f.agent().get(r.id);
 assert.equal(blocked.status,'BLOCKED');assert.equal(blocked.automation.stepIndex,1);
 assert.equal(f.queue.size,0);
 await assert.rejects(e.requeue({principal:f.principal(),id:r.id,expectedVersion:blocked.version,eventId:'retry-001',approval:false}),{code:'LEO_AUTONOMY_REQUEUE_APPROVAL_REQUIRED'});
 f.setFetchBlocked(false);
 r=await e.requeue({principal:f.principal(),id:r.id,expectedVersion:blocked.version,eventId:'retry-001',approval:true});
 f.advance(300);await e.tick();f.advance(300);await e.tick();
 const done=await f.agent().get(r.id);
 assert.equal(done.status,'AWAITING_REVIEW');
 assert.equal(done.automation.receipts.length,3);
});
test('concurrent worker ticks use CAS to dispatch a step at most once',async()=>{
 const f=harness();let r=await f.agent().objective(f.objective);
 r=await f.engine().prepare({principal:f.principal(),id:r.id,expectedVersion:r.version,eventId:'prep-001'});
 r=await f.engine().approve({principal:f.principal(),id:r.id,expectedVersion:r.version,eventId:'ok-001',approval:true});
 await f.engine().tick();f.advance(300);
 await Promise.all([f.engine().tick(),f.engine().tick()]);
 assert.equal(f.getFetchCalls(),1);
 const saved=await f.agent().get(r.id);assert.equal(saved.automation.stepIndex,2);
});
test('stale read-only claims recover, cancelled runs stay blocked',async()=>{
 const f=harness();let r=await f.agent().objective(f.objective);
 r=await f.engine().prepare({principal:f.principal(),id:r.id,expectedVersion:r.version,eventId:'prep-001'});
 r=await f.engine().approve({principal:f.principal(),id:r.id,expectedVersion:r.version,eventId:'ok-001',approval:true});
 const damaged={...r,status:'EXECUTING',version:r.version+1,automation:{...r.automation,attemptsForStep:1,claim:{step:'inspect',at:new Date(f.now()-200000).toISOString()}}};
 f.records.set('leo:v1:tenant-001:objective-001',structuredClone(damaged));
 const recovered=await f.engine().tick();assert.equal(recovered.receipts[0].status,'READY');
 f.advance(500);await f.engine().tick();
 const saved=await f.agent().get(r.id);assert.equal(saved.automation.stepIndex,1);
 const cancelled=await f.engine().cancel({principal:f.principal(),id:r.id,expectedVersion:saved.version,eventId:'cancel-001'});
 assert.equal(cancelled.automation.approved,false);
 assert.equal(f.queue.size,0);assert.equal((await f.engine().tick()).processed,0);
});
test('public source URL guard rejects private hosts or third-party endpoints',async()=>{
 const f=harness();const bad={...f.objective,id:'objective-002',
 delegation:{...f.objective.delegation,sources:['https://localhost:8443/secret','http://docs.github.com/bad','https://docs.github.com.evil.invalid/']}};
 let r=await f.agent().objective(bad);
 await assert.rejects(f.engine().prepare({principal:f.principal(),id:r.id,expectedVersion:r.version,eventId:'prep-002'}),{code:'LEO_PUBLIC_SOURCES_REQUIRED'});
});
test('worker is authenticated, flag-gated, and disallows browser tenant tokens',async()=>{
 let calls=0;const fake={tick:async()=>{calls++;return {status:'WORKER_TICK',processed:0,receipts:[]}}};
 const invoke=async(auth,flag,method='POST')=>{
  let status=0,payload;
  const res={setHeader(){},status(n){status=n;return this},json(p){payload=p;return this}};
  await handleLeoAutonomyWorker({method,headers:{authorization:auth}},res,{env:{CRON_SECRET:'server-only-secret-12345678901234567890',LEO_AUTONOMY_ENABLED:flag},engine:fake});
  return {status,payload};
 };
 assert.equal((await invoke('Bearer browser-tenant', '1')).status,401);
 assert.equal((await invoke('Bearer server-only-secret-12345678901234567890','0')).status,503);
 assert.equal((await invoke('Bearer server-only-secret-12345678901234567890','1','GET')).status,405);
 assert.equal((await invoke('Bearer server-only-secret-12345678901234567890','1')).status,200);
 assert.equal(calls,1);
});
