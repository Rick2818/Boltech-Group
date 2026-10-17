import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
const runner=resolve('scripts/ops/client_order_workflow.mjs');
async function runFixture(broken=false){
 const dir=await mkdtemp(join(tmpdir(),'boltech-build-'));
 const run=(cmd,args,env={})=>spawnSync(cmd,args,{cwd:dir,encoding:'utf8',env:{...process.env,...env},timeout:30000});
 try{
  for(const p of ['lib','api','config','tests'])await mkdir(join(dir,p));
  await writeFile(join(dir,'lib/agent.js'),"export function quotation(input){if(!input?.email)throw Error('EMAIL_REQUIRED');return {status:'REGISTERED',email:input.email};}\n");
  await writeFile(join(dir,'api/index.js'),"export {quotation} from '../lib/agent.js';\n");
  await writeFile(join(dir,'config/scope.json'),'{}');
  await writeFile(join(dir,'tests/acceptance.mjs'),`import {quotation} from '../lib/agent.js';import assert from 'node:assert/strict';assert.equal(quotation({email:'example@example.test'}).status,'${broken?'WRONG':'REGISTERED'}');assert.throws(()=>quotation({}),/EMAIL_REQUIRED/);`);
  await writeFile(join(dir,'package.json'),JSON.stringify({name:'delivery-fixture',version:'1.0.0',type:'module',scripts:{build:'node --check lib/agent.js'}}));
  await writeFile(join(dir,'package-lock.json'),JSON.stringify({name:'delivery-fixture',version:'1.0.0',lockfileVersion:3,requires:true,packages:{'':{name:'delivery-fixture',version:'1.0.0'}}}));
  for(const args of [['init','-q'],['add','.'],['-c','user.name=QA','-c','user.email=qa@example.test','commit','-qm','approved implementation']])assert.equal(run('git',args).status,0);
  const commit=run('git',['rev-parse','HEAD']).stdout.trim(),orderId='SYN-BUILD-001';
  const plan=Buffer.from(JSON.stringify({orderId,plan:{commit,tests:['tests/acceptance.mjs'],criteria:['Registers quotation and rejects missing email']}})).toString('base64');
  const result=run(process.execPath,[runner,'build'],{ORDER_ID:orderId,APPROVED_PLAN:plan});
  const receipt=JSON.parse(await readFile(join(dir,'ops-output/client-order-build.json'),'utf8'));
  if(broken){assert.notEqual(result.status,0,JSON.stringify({result,receipt}));assert.notEqual(receipt.receipts.at(-1).exitCode,0);}else{assert.equal(result.status,0,result.stderr);assert.equal(receipt.commit,commit);assert.equal(receipt.receipts.length,3);assert.ok((await readFile(join(dir,'ops-output/implementation.tar.gz'))).length>0);}
 }finally{await rm(dir,{recursive:true,force:true});}
}
test('executor actually builds versioned quotation code, runs acceptance tests and packages source',()=>runFixture());
test('real failing customer criterion stops the executor without a successful delivery artifact',()=>runFixture(true));
