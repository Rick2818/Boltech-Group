import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCommercialRoutes, mergeCommercialPacket } from '../lib/rsi_commercial_routes.js';
import { runIndependentRsiCycle } from '../lib/rsi_cycle_runner.js';

const row=(id,fields={})=>({id,fields:{Name:'Industrial company','Experiment Cohort':'RSI-01','Contact Email':'buyer@example.com',...fields}});
test('no accepted audit still produces private qualification and approved proposal, never enrollment',()=>{
  const p=buildCommercialRoutes('RSI-02',[row('sent',{Notes:'SENT: original email logged'})]);
  assert.equal(p.accounts[0].route,'REVIEW_EXISTING_THREAD');assert.equal(p.accounts[0].problemConfirmed,false);
  assert.equal(p.accounts[0].enrollmentReady,false);assert.equal(p.proposal.priceUsd,990);assert.equal(p.proposal.customerAcceptance,'UNCONFIRMED');
  assert.ok(p.accounts[0].questions.length);assert.match(p.nextAction,/audit is optional/);assert.equal(p.proposal.diagnosisRequiresAudit,false);
});
test('deduplicates and excludes QA, partners and stopped contacts without changing source',()=>{
  const rows=[row('a'),row('b'),row('qa',{'Data Quality':'QA'}),row('partner',{'Experiment Cohort':'RSI-03'}),row('stop',{Status:'Unsubscribed'})];
  const before=structuredClone(rows);const p=buildCommercialRoutes('RSI-01',rows);
  assert.equal(p.accounts.length,1);assert.deepEqual(rows,before);
});
test('empty cohort opens research route without fabricated prospects or buyer evidence',()=>{
  const p=buildCommercialRoutes('RSI-02',[]);assert.equal(p.queue,'RESEARCH_COHORT_REQUIRED');assert.equal(p.accounts.length,0);
  const incomplete=buildCommercialRoutes('RSI-01',[row('a',{'Contact Email':''})]);assert.ok(incomplete.accounts[0].missing.includes('CONTACT_EMAIL'));
});
test('RSI-02 own cohort is prepared ahead of waiting threads owned by RSI-01',()=>{
  const waiting=Array.from({length:6},(_,i)=>row(`wait${i}`,{'Contact Email':`wait${i}@example.com`,Notes:'SENT'}));
  const p=buildCommercialRoutes('RSI-02',[...waiting,row('local',{'Experiment Cohort':'RSI-02','Contact Email':'local@example.com'})]);
  assert.equal(p.accounts[0].sourceRecordId,'local');assert.equal(p.accounts.length,5);
});
test('packet update is bounded, stable and preserves historical evidence before and after',()=>{
  const p=buildCommercialRoutes('RSI-01',[row('a')]), first=mergeCommercialPacket('Historical evidence',p)+'\nLater evidence';
  assert.equal(mergeCommercialPacket(first,p),first);
  const changed=mergeCommercialPacket(first,buildCommercialRoutes('RSI-01',[]));
  assert.ok(changed.startsWith('Historical evidence'));assert.ok(changed.endsWith('Later evidence'));
  assert.equal(changed.split('[RSI_COMMERCIAL_ROUTES_V1]').length,2);
});
test('an uncertain RSI failure does not retry the mutation or suppress the other roles',async()=>{
  const calls=[];const result=await runIndependentRsiCycle({execute:async rsi=>{calls.push(rsi);if(rsi==='RSI-01')throw Object.assign(new Error('secret must not leak'),{code:'RSI_TOOL_UNAVAILABLE'});return {success:true};}});
  assert.deepEqual(calls,['RSI-01','RSI-02','RSI-03','MARKETING']);assert.equal(result[0].success,false);assert.equal(result[2].success,true);
  assert.ok(!JSON.stringify(result).includes('secret'));
});

test('public weekday cohort is retained and is owned by RSI-01',()=>{
  const p=buildCommercialRoutes('RSI-01',[row('public',{'Experiment Cohort':'RSI01:WEEKDAY_RESEARCH:2026-10-06','Source Evidence URL':'https://company.example/contact'})]);
  assert.equal(p.accounts.length,1);
  assert.equal(p.accounts[0].route,'REVIEW_COHORT_ELIGIBILITY');
  assert.ok(!p.accounts[0].missing.includes('BUYER_ROLE'));
  assert.ok(p.accounts[0].gates.includes('LIVE_GMAIL_HISTORY'));
  assert.ok(p.accounts[0].gates.includes('BUSINESS_RESEARCH_VERIFIED'));
  assert.equal(p.accounts[0].enrollmentReady,false);
});
test('waiting threads do not starve unsent public contacts, and real reply stages have priority',()=>{
  const waiting=Array.from({length:6},(_,i)=>row(`wait${i}`,{'Contact Email':`wait${i}@example.com`,'Commercial Stage':'Contacted'}));
  const p=buildCommercialRoutes('RSI-01',[...waiting,row('new',{'Contact Email':'new@example.com','Experiment Cohort':'RSI01:WEEKDAY_RESEARCH:2026-10-06','Source Evidence URL':'https://company.example/contact'}),row('reply',{'Contact Email':'reply@example.com','Commercial Stage':'Replied'})]);
  assert.equal(p.accounts[0].sourceRecordId,'reply');
  assert.equal(p.accounts[1].sourceRecordId,'new');
  assert.deepEqual(p.queueCounts,{total:8,selected:5,pendingContact:1,awaitingResponse:6});
  assert.equal(p.sendingImplemented,false);
  assert.match(p.nextAction,/DISPATCH_WORKER_UNVERIFIED/);
});
