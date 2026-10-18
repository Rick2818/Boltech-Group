import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

const script=fileURLToPath(new URL('../scripts/ops/audit_director_cycle.mjs',import.meta.url));
async function audit({blockers=[],prior=[],absent=[],missingRole=false,resolutions=[]}={}) {
 const dir=await mkdtemp(join(tmpdir(),'boltech-director-'));
 try {
  await mkdir(join(dir,'ops-output'));
  const results=['RSI-02','RSI-03'].filter(r=>!missingRole||r!=='RSI-02').map(r=>({rsi:r,success:true,receipt:{outcome:'COMPLETED',blockers:r==='RSI-03'?blockers:[],resolutions:r==='RSI-03'?resolutions:[]}}));
  await writeFile(join(dir,'ops-output/rsi-agent-execution.json'),JSON.stringify({results,directorNotification:{success:true,status:'NO_VERIFIED_CLOSURE_PENDING'}}));
  await writeFile(join(dir,'ops-output/marketing-autonomy-execution.json'),JSON.stringify({results:[{rsi:'MARKETING',success:true,receipt:{outcome:'COMPLETED',actionCount:2}}]}));
  await writeFile(join(dir,'ops-output/director-blockers-history.json'),JSON.stringify({active:prior,absent}));
  const run=spawnSync(process.execPath,[script],{cwd:dir,encoding:'utf8'});
  const report=JSON.parse(await readFile(join(dir,'ops-output/director-hourly-audit.json'),'utf8'));
  return {code:run.status,report};
 }finally{await rm(dir,{recursive:true,force:true});}
}
test('completed roles with commercial blockers never produce a green report',async()=>{
 const {code,report}=await audit({blockers:['COST_EVIDENCE_INCOMPLETE']});
 assert.equal(code,1);assert.equal(report.status,'ATTENTION_REQUIRED');
 assert.equal(report.technicalCycleVerified,true);assert.equal(report.followupRequired,true);
 assert.equal(report.blockers[0].owner,'RSI-03');assert.equal(report.customerFollowupVerified,false);
});
test('disappearing blocker still requires resolution evidence',async()=>{
 const {report}=await audit({prior:[{role:'RSI-03',code:'COST_EVIDENCE_INCOMPLETE',owner:'RSI-03',firstSeenAt:'2026-10-18T15:00:00Z',lastSeenAt:'2026-10-18T15:00:00Z',cycles:1}]});
 assert.equal(report.status,'ATTENTION_REQUIRED');assert.equal(report.tracking.absent.length,1);
});
test('clean technical receipt is explicitly limited and never certifies customer sending',async()=>{
 const {code,report}=await audit();assert.equal(code,0);assert.equal(report.status,'VERIFIED');
 assert.equal(report.scope,'TECHNICAL_OVERSIGHT_ONLY');assert.equal(report.customerFollowupVerified,false);
 assert.equal(report.saleInferred,false);
});
test('unresolved absent blocker survives later hourly cycles',async()=>{
 const first=await audit({prior:[{role:'RSI-03',code:'COST_EVIDENCE_INCOMPLETE',owner:'RSI-03',checks:2}]});
 const second=await audit({absent:first.report.tracking.absent});
 assert.equal(second.report.status,'ATTENTION_REQUIRED');
 assert.equal(second.report.tracking.absent[0].code,'COST_EVIDENCE_INCOMPLETE');
});
test('missing agent receipt remains a technical failure',async()=>{
 const {code,report}=await audit({missingRole:true});assert.equal(code,1);
 assert.equal(report.status,'FAILED');assert.equal(report.technicalCycleVerified,false);
});
test('verified resolution receipt retires an absent blocker without deleting history manually',async()=>{
 const {report,code}=await audit({absent:[{role:'RSI-03',code:'COST_EVIDENCE_INCOMPLETE',checks:2}],resolutions:[{code:'COST_EVIDENCE_INCOMPLETE',verified:true,evidenceRef:'cost-ledger-receipt-1',resolvedAt:'2026-10-18T18:00:00Z'}]});
 assert.equal(code,0);assert.equal(report.status,'VERIFIED');assert.equal(report.tracking.absent.length,0);assert.equal(report.tracking.resolved.length,1);
});
