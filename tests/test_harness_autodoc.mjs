import test from 'node:test';
import assert from 'node:assert/strict';
import {MARKER,normalizeRun,readState,mergeRun,renderIssue,updateHarness} from '../lib/harness_autodoc.js';
import {verifyDeployedRevision} from '../lib/verify_deployed_revision.js';
const repo='Rick2818/Boltech-Group',sha='a'.repeat(40);
const run=(overrides={})=>({id:123,run_attempt:1,path:'.github/workflows/sdr_connection_verification.yml',status:'completed',head_branch:'main',head_sha:sha,conclusion:'failure',updated_at:'2026-10-16T03:00:00Z',repository:{full_name:repo},head_repository:{full_name:repo},...overrides});
function fixture(){
  let body=MARKER+'\nPending',comments=[],corrupt=false;const calls=[];
  const api=async(method,path,data)=>{
    calls.push({method,path});
    if(path.endsWith('/issues/86')){if(method==='PATCH'){body=data.body;return {body};}return {body:corrupt?'changed':body};}
    if(path.includes('/actions/workflows?'))return {workflows:[{id:1,path:'.github/workflows/sdr_connection_verification.yml'},{id:2,path:'.github/workflows/harness_autodoc.yml'}]};
    if(path.includes('/workflows/1/runs?'))return {workflow_runs:[run()]};
    if(path.includes('/artifacts?'))return {artifacts:[{id:9,name:'secret-looking-untrusted-content',expired:false,archive_download_url:'https://evil.test/'}]};
    if(path.includes('/comments?'))return comments;
    if(path.endsWith('/comments')&&method==='POST'){const c={id:comments.length+1,body:data.body};comments.push(c);return c;}
    throw Error('UNEXPECTED_API_CALL');
  };
  return {api,calls,body:()=>body,comments:()=>comments,corruptReadback:()=>{corrupt=true;}};
}
test('forks, previews, unfinished runs and untracked producers cannot update the live harness',async()=>{
  for(const change of [{head_repository:{full_name:'fork/repo'}},{head_branch:'feature'},{status:'in_progress'},{path:'.github/workflows/harness_autodoc.yml'}]){
    const f=fixture();assert.equal(normalizeRun(run(change),repo),null);
    assert.match((await updateHarness({api:f.api,repository:repo,eventName:'workflow_run',event:{workflow_run:run(change)}})).status,/IGNORED/);assert.equal(f.calls.length,0);
  }
});
test('historical retries update by completion time and do not regress after an older event',()=>{
  let state=readState(MARKER),first=normalizeRun(run(),repo);state=mergeRun(state,first);
  const retry=normalizeRun(run({run_attempt:2,conclusion:'success',updated_at:'2026-10-16T04:00:00Z'}),repo);state=mergeRun(state,retry);state=mergeRun(state,first);
  assert.equal(state.latest[first.workflow].attempt,2);assert.equal(state.history.length,2);
});
test('run attempt replay is idempotent and artifact content is never downloaded or rendered',async()=>{
  const f=fixture(),args={api:f.api,repository:repo,eventName:'workflow_run',event:{workflow_run:run()}};
  const first=await updateHarness(args),second=await updateHarness(args);
  assert.equal(first.newComments,1);assert.equal(second.newComments,0);assert.equal(f.comments().length,1);
  assert.equal(readState(f.body()).latest['sdr_connection_verification.yml'].conclusion,'failure');
  assert.ok(!f.body().includes('secret-looking'));assert.ok(!f.body().includes('evil.test'));assert.ok(!f.calls.some(c=>/download|secrets|logs/.test(c.path)));
});
test('bootstrap reconstructs the latest main result and never calls the producer or sends mail',async()=>{
  const f=fixture(),r=await updateHarness({api:f.api,repository:repo,eventName:'push',event:{}});
  assert.equal(r.tracked,1);assert.ok(f.body().includes('failure'));assert.ok(f.body().includes('SIN_EVIDENCIA'));
  assert.ok(f.calls.filter(c=>c.method==='POST').every(c=>c.path.endsWith('/issues/86/comments')));
});
test('coalesced workflow events reconstruct other workflow results instead of losing them',async()=>{
  const f=fixture(),other=run({id:124,path:'.github/workflows/boltech_validation.yml'});
  await updateHarness({api:f.api,repository:repo,eventName:'workflow_run',event:{workflow_run:other}});
  assert.equal(Object.keys(readState(f.body()).latest).length,2);
});
test('corrupt state, wrong issue and failed readback fail visibly without fabricated success',async()=>{
  assert.throws(()=>readState('other issue'),/WRONG_ISSUE/);
  assert.throws(()=>readState(MARKER+'\n<!-- HARNESS_STATE\ninvalid\nHARNESS_STATE -->'),/STATE_CORRUPT/);
  const f=fixture();let patched=false;const api=async(m,p,b)=>{const r=await f.api(m,p,b);if(m==='PATCH')patched=true;else if(p.endsWith('/issues/86')&&patched)r.body='lost';return r;};
  await assert.rejects(updateHarness({api,repository:repo,eventName:'push',event:{}}),/READBACK_FAILED/);assert.equal(f.comments().length,0);
});
test('rendering preserves explicit limits and never treats success as a commercial certification',()=>{
  const body=renderIssue(mergeRun(readState(MARKER),normalizeRun(run({conclusion:'success'}),repo)),'2026-10-16T03:00:00Z');
  assert.match(body,/no una certificación funcional/);assert.match(body,/no demuestra Gmail operativo/);assert.match(body,/no activa campañas ni pagos/);
});
test('exact revision probe waits for the new commit before checking Gmail and never sends mail',async()=>{
  const calls=[];let tries=0;
  const fetcher=async(url,options)=>{calls.push({url,method:options.method||'GET'});return {ok:true,status:200,json:async()=>url.includes('rsi-agents')?{success:true,deploymentCommit:++tries===1?'b'.repeat(40):sha}:{success:true,verified:true,sender:'ricardo.boltechgroup@gmail.com'}};};
  const r=await verifyDeployedRevision({expectedCommit:sha,token:'test-only',fetcher,wait:async()=>{},attempts:2});
  assert.equal(r.status,'VERIFIED_EXACT_REVISION_AND_GMAIL');assert.equal(r.sameCommit,true);assert.equal(calls.length,3);
  assert.ok(calls.every(c=>c.url.startsWith('https://boltech-group.vercel.app/')));assert.ok(!calls.some(c=>/send|campaign|execute/.test(c.url)));
});
test('old deployments, wrong sender and rejected OAuth cannot be certified',async()=>{
  const old=await verifyDeployedRevision({expectedCommit:sha,token:'test-only',attempts:1,fetcher:async()=>({ok:true,status:200,json:async()=>({success:true,deploymentCommit:'b'.repeat(40)})})});assert.equal(old.status,'FAILED');
  for(const payload of [{success:false,code:'GMAIL_OAUTH_AUTH_FAILED'},{success:true,verified:true,sender:'wrong@example.test'}]){
    const r=await verifyDeployedRevision({expectedCommit:sha,token:'test-only',attempts:1,fetcher:async url=>({ok:true,status:200,json:async()=>url.includes('rsi-agents')?{success:true,deploymentCommit:sha}:payload})});assert.equal(r.status,'FAILED');assert.equal(r.gmailVerified,false);
  }
});
test('unauthenticated deployment probe fails without contacting providers',async()=>{
  let calls=0;const r=await verifyDeployedRevision({expectedCommit:sha,fetcher:async()=>{calls++;}});assert.equal(r.code,'SDR_ADMIN_AUTH_MISSING');assert.equal(calls,0);
});
test('deployment probe is published separately from ordinary workflow success',async()=>{
  const f=fixture(),probe={scope:'VERCEL_READ_ONLY_PRODUCTION_PROBE',at:'2026-10-16T04:00:00Z',expectedCommit:sha,deploymentCommit:sha,status:'VERIFIED_EXACT_REVISION_AND_GMAIL',gmailVerified:true};
  await updateHarness({api:f.api,repository:repo,eventName:'push',event:{},deploymentProbe:probe});
  assert.equal(readState(f.body()).deployment.gmailVerified,true);assert.match(f.body(),/VERIFIED_EXACT_REVISION_AND_GMAIL/);
});
test('preview deployment status is ignored without any write',async()=>{
  const f=fixture(),r=await updateHarness({api:f.api,repository:repo,eventName:'deployment_status',event:{repository:{full_name:repo},deployment:{environment:'Preview'}}});assert.match(r.status,/IGNORED/);assert.equal(f.calls.length,0);
});
