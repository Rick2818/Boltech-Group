import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyPayments,scheduleEvidence,runWatch,triggerEvidence} from '../scripts/ops/production_watch.mjs';

test('configured payments remain pending verification, missing storage is failure',()=>{
  assert.equal(classifyPayments({success:true,environment:'production',store:{configured:true},fulfillment:{atomicClaimConfigured:true},wompi:{configured:true},strike:{configured:true}}),'PROVIDER_VERIFICATION_PENDING');
  assert.equal(classifyPayments({success:true,environment:'production',store:{configured:false}}),'FAILED');
  assert.equal(classifyPayments({}),'FAILED');
});
test('schedule evidence flags the actual six hour delay and missing commercial run',()=>{
  const findings=scheduleEvidence([{path:'.github/workflows/boltech_health_check.yml',event:'schedule',created_at:'2026-10-01T18:29:43Z',status:'completed',conclusion:'success'}],new Date('2026-10-01T19:35:00Z'));
  assert.ok(findings.some(x=>x.code==='LATE_EXECUTION'&&x.delayMinutes===359));
  assert.ok(findings.some(x=>x.code==='MISSING_EXECUTION'&&x.path.includes('mit_commercial')));
});
test('schedule evidence observes grace, weekdays and stale hourly executions',()=>{
  const recent={path:'.github/workflows/boltech_health_check.yml',event:'schedule',created_at:'2026-10-03T12:17:00Z',status:'completed',conclusion:'success'};
  assert.equal(scheduleEvidence([recent],new Date('2026-10-03T12:25:00Z')).length,0);
  assert.ok(scheduleEvidence([recent],new Date('2026-10-03T15:25:00Z')).some(x=>x.code==='HOURLY_HEALTH_STALE'));
});
test('monitor fails on HTTP-200 Telegram degradation and leaked financial data',async()=>{
  const fetcher=async url=>{
    if(url.endsWith('/api/telegram?deep=1'))return Response.json({status:'DEGRADED',telegramConfigured:true,webhookConfigured:true,pendingUpdates:2,lastError:null});
    if(url.includes('action=metrics'))return Response.json({success:true,metrics:{finance:{pipelineUsd:3000}}});
    return new Response('{}',{status:503});
  };
  const r=await runWatch({fetcher,env:{},now:new Date('2026-10-01T19:00:00Z')});
  assert.equal(r.status,'FAILED');assert.equal(r.checks.find(x=>x.name==='telegram_deep').status,'FAILED');assert.equal(r.checks.find(x=>x.name==='private_metrics_boundary').status,'FAILED');
  assert.equal(r.checks.find(x=>x.name==='a2a_authenticated').status,'PENDING');
  assert.doesNotMatch(JSON.stringify(r),/pipelineUsd|3000/);
});

test('trigger distinguishes schedules and records exact artifact name',()=>{
  assert.deepEqual(triggerEvidence({WATCH_EVENT_NAME:'schedule',WATCH_SCHEDULE:'17 * * * *',WATCH_RUN_ID:'37008334357'}),{
    event:'schedule',schedule:'17 * * * *',kind:'hourly',runId:'37008334357',artifactName:'production-health-37008334357'
  });
  assert.equal(triggerEvidence({WATCH_EVENT_NAME:'schedule',WATCH_SCHEDULE:'30 12 * * 1-5'}).kind,'daily');
  assert.equal(triggerEvidence({WATCH_EVENT_NAME:'push',WATCH_SCHEDULE:'17 * * * *'}).schedule,null);
  assert.equal(triggerEvidence({WATCH_EVENT_NAME:'workflow_dispatch'}).kind,'workflow_dispatch');
});
test('unknown trigger values remain unknown without disclosing arbitrary values',()=>{
  const result=triggerEvidence({WATCH_EVENT_NAME:'secret-value',WATCH_SCHEDULE:'secret-value',WATCH_RUN_ID:'secret-value'});
  assert.equal(result.kind,'unknown');assert.equal(result.artifactName,null);
  assert.doesNotMatch(JSON.stringify(result),/secret-value/);
  assert.equal(triggerEvidence({WATCH_EVENT_NAME:'schedule',WATCH_SCHEDULE:'old cron'}).kind,'unknown');
});

test('backup cron is attributed as hourly',()=>{
  assert.equal(triggerEvidence({WATCH_EVENT_NAME:'schedule',WATCH_SCHEDULE:'47 * * * *'}).kind,'hourly');
});
test('queued run cannot hide stale successful coverage',()=>{
  const path='.github/workflows/boltech_health_check.yml';
  const findings=scheduleEvidence([
    {path,event:'schedule',created_at:'2026-10-03T12:17:00Z',status:'completed',conclusion:'success'},
    {path,event:'schedule',created_at:'2026-10-03T15:17:00Z',status:'queued'}
  ],new Date('2026-10-03T15:25:00Z'));
  assert.ok(findings.some(x=>x.code==='HOURLY_HEALTH_STALE'));
});
test('fresh completed backup provides coverage while failures remain visible',()=>{
  const path='.github/workflows/boltech_health_check.yml';
  const runs=[
    {path,event:'schedule',created_at:'2026-10-03T15:00:00Z',updated_at:'2026-10-03T15:01:00Z',status:'completed',conclusion:'success'},
    {path,event:'schedule',created_at:'2026-10-03T15:17:00Z',status:'completed',conclusion:'failure'}
  ];
  const findings=scheduleEvidence(runs,new Date('2026-10-03T15:25:00Z'));
  assert.ok(!findings.some(x=>x.code==='HOURLY_HEALTH_STALE'));
  assert.ok(findings.some(x=>x.code==='LATEST_HEALTH_FAILED'));
});
