import { appendFile, mkdir, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
const mode=process.argv[2],base='https://boltech-group.vercel.app/api/partners?action=client-order';
const orderId=process.env.ORDER_ID;
if(!/^[A-Za-z0-9_.:-]{1,120}$/.test(orderId||''))throw Error('DELIVERY_INVALID_ORDER');
async function api(body){
 const token=process.env.PARTNER_API_TOKEN;if(!token)throw Error('DELIVERY_AUTH_NOT_CONFIGURED');
 const r=await fetch(body?base:base+'&orderId='+encodeURIComponent(orderId),{method:body?'POST':'GET',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(30000)});
 const result=await r.json();if(!r.ok||!result.success)throw Error(result.code||'DELIVERY_API_UNCONFIRMED');return result.record;
}
if(mode==='prepare'){
 const r=await api();if(!r.plan||!['READY_FOR_BUILD_AND_QA','BLOCKED'].includes(r.execution))throw Error('DELIVERY_PLAN_REQUIRED');
 await appendFile(process.env.GITHUB_OUTPUT,`commit=${r.plan.commit}\nplan=${Buffer.from(JSON.stringify({orderId,plan:r.plan})).toString('base64')}\n`);
}else if(mode==='build'){
 const {plan,orderId:bound}=JSON.parse(Buffer.from(process.env.APPROVED_PLAN||'','base64').toString());
 if(bound!==orderId||!plan.tests?.length||!plan.tests.every(p=>/^tests\/[A-Za-z0-9_/-]+\.(mjs|js)$/.test(p)&&!p.includes('..')))throw Error('DELIVERY_INVALID_PLAN');
 const actual=spawnSync('git',['rev-parse','HEAD'],{encoding:'utf8'});if(actual.stdout.trim()!==plan.commit)throw Error('DELIVERY_COMMIT_MISMATCH');
 const receipts=[];
 const childEnv={...process.env};delete childEnv.NODE_TEST_CONTEXT;delete childEnv.NODE_OPTIONS;
 for(const [stage,command,args] of [['dependencies','npm',['ci','--ignore-scripts','--no-audit','--no-fund']],['implementation','npm',['run','build']],['qa',process.execPath,['--test','--test-reporter=tap',...plan.tests]]]){
  const r=spawnSync(command,args,{encoding:'utf8',timeout:240000,maxBuffer:10*1024*1024,env:childEnv});
  receipts.push({stage,exitCode:r.status,stdout:r.stdout,stderr:r.stderr});
  await mkdir('ops-output',{recursive:true});await writeFile('ops-output/client-order-build.json',JSON.stringify({orderId,commit:plan.commit,criteria:plan.criteria,tests:plan.tests,receipts},null,2));
  if(stage==='qa'&&!/^# tests [1-9][0-9]*$/m.test(r.stdout||''))throw Error('DELIVERY_NO_TESTS_EXECUTED');
  if(r.status!==0)throw Error('DELIVERY_'+stage.toUpperCase()+'_FAILED');
 }
 // Export actual versioned source with its build/QA receipt; no generated placeholder agent.
 const archive=spawnSync('git',['archive','--format=tar.gz','--output=ops-output/implementation.tar.gz',plan.commit]);
 if(archive.status!==0)throw Error('DELIVERY_ARTIFACT_FAILED');
}else if(mode==='failed'){
 const r=await api();await api({operation:'block',orderId,expectedVersion:r.version,eventId:`blocked-${process.env.GITHUB_RUN_ID}-${process.env.GITHUB_RUN_ATTEMPT}`,reason:`Approved build/QA failed: https://github.com/Rick2818/Boltech-Group/actions/runs/${process.env.GITHUB_RUN_ID}`});
}else if(mode==='finish'){
 const r=await api();await api({operation:'qa',orderId,expectedVersion:r.version,eventId:`qa-${process.env.GITHUB_RUN_ID}-${process.env.GITHUB_RUN_ATTEMPT}`,runId:Number(process.env.GITHUB_RUN_ID)});
}else throw Error('DELIVERY_WORKFLOW_MODE_INVALID');
