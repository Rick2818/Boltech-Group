import test from 'node:test';
import assert from 'node:assert/strict';
import {runAgent1Rsi} from '../scripts/ops/run_agent1_v2_rsi.mjs';
const env={GITHUB_REPOSITORY:'Rick2818/Boltech-Group',GITHUB_TOKEN:'synthetic'};
test('read-only GitHub observation returns scoped RSI receipt',async()=>{
 const r=await runAgent1Rsi({env,fetcher:async(url,opts)=>{
  assert.match(url,/agent1_v2_market_skills_qa.yml/);
  assert.match(url,/branch=agent1-rebuild-20261020/);
  assert.equal(opts.redirect,'error');
  return {ok:true,json:async()=>({workflow_runs:[{status:'completed',conclusion:'success'},{status:'completed',conclusion:'failure'}]})};
 }});
 assert.equal(r.scope,'AGENT1_V2');assert.equal(r.checked,2);assert.equal(r.failed,1);assert.equal(r.rsi.outboundSent,false);assert.equal(r.productiveActions,false);
});
test('missing token or failed provider blocked',async()=>{
 await assert.rejects(runAgent1Rsi({env:{GITHUB_REPOSITORY:'Rick2818/Boltech-Group'}}),/TOKEN_REQUIRED/);
 await assert.rejects(runAgent1Rsi({env,fetcher:async()=>({ok:false,status:403})}),/GITHUB_READ_403/);
});
test('CI workflow failure cannot execute autonomous code changes or emails',async()=>{
 const r=await runAgent1Rsi({env,fetcher:async()=>({ok:true,json:async()=>({workflow_runs:[{status:'completed',conclusion:'failure'}]})})});
 assert.equal(r.rsi.codeModified,false);assert.equal(r.rsi.deploymentChanged,false);assert.equal(r.rsi.outboundSent,false);
});
