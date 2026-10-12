import test from 'node:test';
import assert from 'node:assert/strict';
import qa from '../config/qa_case.json' with {type:'json'};
import {createRsiMarketingCycle} from '../lib/rsi_marketing_cycle.js';

test('one failed history check keeps other existing materials and management moving without sending',async()=>{
  const calls=[],rows=[1,2].map(n=>({eventId:qa.requestId+'-'+n,material:{fingerprint:'qa-'+n}}));
  const worker={queue:async()=>({pending:rows}),prepareFollowupSupport:async()=>{throw Object.assign(Error('private provider detail'),{code:'GMAIL_OAUTH_AUTH_FAILED'});},
    marketing:{review:async input=>calls.push('review:'+input.eventId),reconcile:async input=>{if(input.eventId===rows[0].eventId)throw Object.assign(Error('private detail'),{code:'MARKETING_CONTACT_UNVERIFIED'});return {status:'NO_VERIFIED_USE'};},manage:async input=>calls.push('manage:'+input.eventId)}};
  const result=await createRsiMarketingCycle(worker)('RSI-01');
  assert.equal(result.reviewed,2);assert.equal(result.historyChecks.length,1);
  assert.deepEqual(result.failures.map(row=>row.code),['GMAIL_OAUTH_AUTH_FAILED','MARKETING_CONTACT_UNVERIFIED']);
  assert.equal(calls.length,4);assert.equal(result.sendingPerformed,false);assert.doesNotMatch(JSON.stringify(result),/private/);
});
test('failed acceptance never reconciles use; later materials still receive review',async()=>{
  const rows=[1,2].map(n=>({eventId:qa.requestId+'-'+n,material:{fingerprint:'qa-'+n}})),history=[];
  const worker={queue:async()=>({pending:rows}),marketing:{review:async input=>{if(input.eventId===rows[0].eventId)throw Error('sensitive error');},reconcile:async input=>history.push(input.eventId),manage:async()=>({})}};
  const result=await createRsiMarketingCycle(worker)('RSI-02');
  assert.equal(result.reviewed,1);assert.deepEqual(history,[rows[1].eventId]);
  assert.equal(result.failures[0].code,'MARKETING_OPERATION_UNCONFIRMED');assert.doesNotMatch(JSON.stringify(result),/sensitive/);
});
