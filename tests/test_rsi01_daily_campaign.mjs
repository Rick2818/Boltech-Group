import test from 'node:test';
import assert from 'node:assert/strict';
import {createDailyCampaign,campaignDay} from '../lib/rsi01_daily_campaign.js';
function fixture(overrides={}){
 const rows=new Map();let executions=0,sends=0,now='2026-10-17T15:00:00Z';
 const command=async a=>{
  if(a[0]==='GET')return rows.get(a[1])||null;
  if(a[0]==='SET'){if(a.includes('NX')&&rows.has(a[1]))return null;rows.set(a[1],a[2]);return 'OK'}
  if(a[0]==='EVAL'){
   if(a[2]===2){if(rows.get(a[3])!==a[5])return 'LEASE_LOST';rows.set(a[4],a[6]);return 'OK'}
   if(rows.get(a[3])===a[4])rows.delete(a[3]);return 1;
  }
  throw Error('Unexpected operation');
 };
 const deps={command,now:()=>now,execute:async input=>{executions++;assert.deepEqual(input,{rsi:'RSI-01',cycleId:'daily-'+campaignDay(now)});return {receipt:{outcome:'COMPLETED',runId:'RSI-01:receipt'}}},campaign:async()=>{sends++;return {reviewed:5,approvedTotal:1,eligible:1,cycleStatus:'EXECUTED',results:[{status:'SENT',attempted:true}]};},...overrides};
 return {worker:createDailyCampaign(deps),deps,rows,counts:()=>({executions,sends}),advance:()=>{now='2026-10-18T15:00:00Z'}};
}
test('Vercel and GitHub share one durable execution per Salvador day',async()=>{
 const f=fixture();const first=await f.worker.run();
 assert.equal(first.status,'EXECUTED');assert.equal(first.campaign.sent,1);
 assert.equal((await createDailyCampaign(f.deps).run()).reused,true);
 assert.deepEqual(f.counts(),{executions:1,sends:1});
 f.advance();assert.equal((await f.worker.run()).reused,false);assert.deepEqual(f.counts(),{executions:2,sends:2});
});
test('parallel trigger is rejected while the first executor holds the lease',async()=>{
 let resume;const f=fixture({execute:()=>new Promise(r=>{resume=r})});
 const running=f.worker.run();while(!resume)await new Promise(r=>setImmediate(r));
 await assert.rejects(createDailyCampaign(f.deps).run(),e=>e.code==='RSI01_DAILY_BUSY');
 resume({receipt:{outcome:'COMPLETED'}});await running;
});
test('unknown send is preserved and never restarted by the second scheduler',async()=>{
 const f=fixture({campaign:async()=>{throw Error('SECRET_CANARY')}});
 await assert.rejects(f.worker.run(),e=>e.code==='RSI01_DAILY_RECONCILIATION_REQUIRED');
 const report=await f.worker.status();assert.equal(report.state,'UNKNOWN');assert.doesNotMatch(JSON.stringify(report),/SECRET_CANARY/);
 await assert.rejects(f.worker.run(),e=>e.code==='RSI01_DAILY_RECONCILIATION_REQUIRED');assert.equal(f.counts().executions,1);
});
test('blocked agent and zero approved leads remain visible as attention',async()=>{
 const f=fixture({execute:async()=>({receipt:{outcome:'BLOCKED'}}),campaign:async()=>({cycleStatus:'NO_APPROVED_LEADS',reviewed:226,approvedTotal:0,eligible:0,results:[]})});
 const r=await f.worker.run();assert.equal(r.status,'ATTENTION');assert.equal(r.agentOutcome,'BLOCKED');assert.equal(r.campaign.status,'NO_APPROVED_LEADS');assert.equal(r.campaign.sent,0);
});
test('uncertain campaign is never counted as sent',async()=>{
 const f=fixture({campaign:async()=>({cycleStatus:'ATTENTION',results:[{status:'UNKNOWN',attempted:true}]})});
 const r=await f.worker.run();assert.equal(r.status,'ATTENTION');assert.equal(r.campaign.sent,0);assert.equal(r.campaign.uncertain,1);
});
test('Salvador midnight defines the day; status reads do not execute',async()=>{
 assert.equal(campaignDay('2026-10-18T05:59:59Z'),'2026-10-17');assert.equal(campaignDay('2026-10-18T06:00:00Z'),'2026-10-18');
 const f=fixture();assert.equal((await f.worker.status()).state,'NOT_STARTED');assert.deepEqual(f.counts(),{executions:0,sends:0});
});
test('zero-attempt finished diagnosis can resume after preparing the queue; uncertain sends stay held',async()=>{
 let approved=false,executions=0;
 const f=fixture({execute:async()=>{executions++;return {receipt:{outcome:'COMPLETED'}}},campaign:async()=>approved?{cycleStatus:'EXECUTED',reviewed:5,approvedTotal:5,eligible:5,results:Array.from({length:5},()=>({status:'SENT',attempted:true}))}:{cycleStatus:'NO_APPROVED_LEADS',reviewed:0,approvedTotal:0,eligible:0,results:[]}});
 assert.equal((await f.worker.run()).status,'ATTENTION');approved=true;
 const next=await f.worker.run();assert.equal(next.campaign.sent,5);assert.equal(next.status,'EXECUTED');assert.equal(executions,2);assert.equal((await f.worker.run()).reused,true);
});
