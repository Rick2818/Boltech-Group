import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {verifyDeployedRevision} from '../../lib/verify_deployed_revision.js';
const event=JSON.parse(await readFile(process.env.GITHUB_EVENT_PATH,'utf8'));
if(process.env.GITHUB_EVENT_NAME==='deployment_status'&&(!['production','Production'].includes(event.deployment?.environment)||event.repository?.full_name!=='Rick2818/Boltech-Group'||event.deployment_status?.state!=='success')){
  console.log('HARNESS_VERCEL_EVENT_NOT_ELIGIBLE');process.exit(0);
}
const expectedCommit=process.env.GITHUB_EVENT_NAME==='deployment_status'?event.deployment.sha:process.env.GITHUB_SHA;
const report=await verifyDeployedRevision({expectedCommit,token:process.env.PARTNER_API_TOKEN});
if(report.sameCommit===true&&process.env.PARTNER_API_TOKEN){
 try{
  const r=await fetch('https://boltech-group.vercel.app/api/partners?action=client-order',{method:'POST',headers:{Authorization:`Bearer ${process.env.PARTNER_API_TOKEN}`,'Content-Type':'application/json'},body:JSON.stringify({operation:'storage-check'}),signal:AbortSignal.timeout(25000)});
  const body=await r.json();report.clientOrderStorage=r.ok&&body.status==='VERIFIED'?body:{status:'FAILED',code:body.code||'DELIVERY_PROBE_REJECTED'};
 }catch{report.clientOrderStorage={status:'FAILED',code:'DELIVERY_PROBE_UNAVAILABLE'};}
}
await mkdir('ops-output',{recursive:true});await writeFile('ops-output/harness-vercel-probe.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report));if(report.status!=='VERIFIED_EXACT_REVISION_AND_GMAIL')process.exitCode=1;
