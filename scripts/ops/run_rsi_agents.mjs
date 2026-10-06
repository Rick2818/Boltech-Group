import { mkdir, writeFile } from 'node:fs/promises';
import { runIndependentRsiCycle } from '../../lib/rsi_cycle_runner.js';
const base='https://boltech-group.vercel.app/api/partners';
const token=process.env.PARTNER_API_TOKEN;
const report={timestamp:new Date().toISOString(),commit:process.env.GITHUB_SHA||null,results:[],status:'FAIL'};
const cycleId=`workflow-${process.env.GITHUB_RUN_ID||Date.now()}-attempt-${process.env.GITHUB_RUN_ATTEMPT||1}`;
try{
  if(!token)throw new Error('Administrative secret is required');
  // Only read retries while waiting for the deployment. Never retry an uncertain POST.
  let ready=false;
  for(let i=0;i<18;i++){
    try{const res=await fetch(`${base}?action=rsi-agents`,{headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(10000)});const data=await res.json();if(res.ok&&data.execution?.contractVersion===1&&data.executorVersion>=2){ready=true;break;}}catch{}
    await new Promise(r=>setTimeout(r,5000));
  }
  if(!ready)throw new Error('Agent executor deployment not ready');
  report.results=await runIndependentRsiCycle({execute:async rsi=>{
    const res=await fetch(`${base}?action=rsi-execute`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({rsi,cycleId}),signal:AbortSignal.timeout(60000)});
    const data=await res.json();
    if(!res.ok||data.success!==true||!data.receipt)throw Object.assign(new Error('Execution unconfirmed'),{code:data.code});
    return data;
  }});
  report.status=report.results.some(r=>!r.success||r.receipt?.outcome!=='COMPLETED')?'ATTENTION':'PASS';
  if(report.results.some(r=>!r.success))process.exitCode=1;
}catch(error){report.error=String(error.message).slice(0,300);process.exitCode=1;}
finally{await mkdir('ops-output',{recursive:true});await writeFile('ops-output/rsi-agent-execution.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
