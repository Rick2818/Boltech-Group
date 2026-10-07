import test from 'node:test';
import assert from 'node:assert/strict';
import {BaseAgent} from '@google/adk';
import {COMMERCIAL_AGENT_IDS, createGoogleAdkTeam} from '../lib/google_adk_agents.js';

test('official ADK runs exactly the four existing identities without network or model calls', async()=>{
  const original=globalThis.fetch;
  globalThis.fetch=async()=>{throw new Error('Unexpected network/model call');};
  try {
    const calls=[];
    const team=createGoogleAdkTeam({execute:async input=>{calls.push(input);return {receipt:{rsi:input.rsi,outcome:'COMPLETED'},reused:false};}});
    assert.equal(team.agents.size,4);
    for(const rsi of COMMERCIAL_AGENT_IDS) {
      assert.ok(team.agents.get(rsi) instanceof BaseAgent);
      const result=await team.run({rsi,cycleId:'adk-verification'});
      assert.equal(result.receipt.rsi,rsi);
      assert.equal(result.orchestration.modelCalls,0);
      assert.equal(result.orchestration.sdk,'@google/adk');
    }
    assert.deepEqual(calls.map(x=>x.rsi),COMMERCIAL_AGENT_IDS);
  } finally {globalThis.fetch=original;}
});
test('invalid identity, ambiguous input and model enabling fail before tools',async()=>{
  let calls=0;const team=createGoogleAdkTeam({execute:async()=>{calls++;}});
  await assert.rejects(team.run({rsi:'NEW_AGENT',cycleId:'x'}),/ADK_INVALID_AGENT/);
  await assert.rejects(team.run({rsi:'RSI-01',cycleId:''}),/ADK_INVALID_INPUT/);
  assert.throws(()=>createGoogleAdkTeam({modelMode:'GEMINI'}),/ADK_MODEL_BUDGET_NOT_AUTHORIZED/);
  assert.equal(calls,0);
});
test('tool failures propagate without automatic retries or invented receipts',async()=>{
  let calls=0;const team=createGoogleAdkTeam({execute:async()=>{calls++;throw new Error('CREDENTIAL_EXPIRED');}});
  await assert.rejects(team.run({rsi:'RSI-03',cycleId:'outage'}),/CREDENTIAL_EXPIRED/);
  assert.equal(calls,1);
});
