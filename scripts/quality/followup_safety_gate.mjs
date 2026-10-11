import {spawnSync} from 'node:child_process';
import {mkdirSync,cpSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const tests=['tests/test_followup_work_sync.mjs','tests/test_rsi01_followups.mjs','tests/test_followup_safety.mjs','tests/test_followup_integration.mjs'];
if(process.argv.includes('--preflight')){
 console.log('AVISO PREVIO: seguimiento modifica estado compartido. Antes de editar: inventariar escritores, exclusiones, transiciones y recuperación; antes de publicar: ejecutar --self-test. No interpretar un recibo como etapa CRM conciliada.');
 process.exit(0);
}
function run(cwd,args){return spawnSync(process.execPath,args,{cwd,encoding:'utf8',timeout:60000,env:{...process.env,AIRTABLE_TOKEN:'',AIRTABLE_PAT:'',UPSTASH_REDIS_REST_TOKEN:'',SDR_GMAIL_REFRESH_TOKEN:''}});}
if(process.argv.includes('--self-test')){
 const sandbox=path.join(root,'scratch','followup-gate',String(Date.now()));mkdirSync(sandbox,{recursive:true});
 for(const dir of ['lib','config'])cpSync(path.join(root,dir),path.join(sandbox,dir),{recursive:true});
 mkdirSync(path.join(sandbox,'tests'));cpSync(path.join(root,'tests/test_followup_safety.mjs'),path.join(sandbox,'tests/test_followup_safety.mjs'));
 cpSync(path.join(root,'tests/followup_no_network.mjs'),path.join(sandbox,'tests/followup_no_network.mjs'));
 writeFileSync(path.join(sandbox,'package.json'),'{"type":"module"}');
 for(const file of ['lib/rsi01_followups.js','lib/followup_work_sync.js']){
  const old=spawnSync('git',['show',`891e875:${file}`],{cwd:root,encoding:'utf8',timeout:10000});
  if(old.status!==0)throw Error('NEGATIVE_CONTROL_BASELINE_UNAVAILABLE');writeFileSync(path.join(sandbox,file),old.stdout);
 }
 const bad=run(sandbox,['--import','./tests/followup_no_network.mjs','--test','tests/test_followup_safety.mjs']);
 // A crash, missing import or no tests is not evidence of detecting defects.
 if(bad.status!==1||!bad.stdout.includes('tests 3')||!bad.stdout.includes('fail 3')||!bad.stdout.includes('AssertionError')){
  process.stderr.write(bad.stdout+bad.stderr);throw Error('NEGATIVE_CONTROL_DID_NOT_REPRODUCE_THREE_DEFECTS');
 }
 console.log('NEGATIVE CONTROL PASS: the three known defects are rejected.');
}
const good=run(root,['--import','./tests/followup_no_network.mjs','--test',...tests]);process.stdout.write(good.stdout||'');process.stderr.write(good.stderr||'');
if(good.error||good.status!==0)process.exitCode=1;
else console.log('FOLLOWUP SAFETY PASS: local tests only; production and required branch protection remain separate.');
