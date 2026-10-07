import {readFile,writeFile} from 'node:fs/promises';
import {signInteragent} from '../../lib/interagent_coordinator.js';
const auth=JSON.parse(await readFile('scratch/commercial-scale/n8n-runtime/client-auth.json','utf8'));
const report={at:new Date().toISOString(),status:'FAIL',scope:'CLOUD_PERSISTENCE_READ_ONLY_NO_N8N_CALLS',checks:[]};
try{
 const snapshots=[];
 for(let i=0;i<2;i++){
  const body={operation:'queue',from:'RSI-01',signedAt:new Date().toISOString()};
  const response=await fetch('https://boltech-group.vercel.app/api/partners?action=interagent',{method:'POST',headers:{'Content-Type':'application/json','X-Boltech-Signature':signInteragent(body,auth.roleKeys['RSI-01']),'Connection':'close'},body:JSON.stringify(body),signal:AbortSignal.timeout(30000)});
  const result=await response.json();if(!response.ok||result.success!==true)throw Error('CLOUD_QUEUE_UNAVAILABLE');
  const row=result.pending.find(e=>e.eventId==='adk-support-RSI-01-2026-10-07');
  if(!row||row.deliveredTo!=='RSI-01'||!row.createdAt)throw Error('PERSISTED_EVENT_NOT_FOUND');
  snapshots.push(JSON.stringify({eventId:row.eventId,createdAt:row.createdAt,fingerprint:row.fingerprint}));
 }
 if(snapshots[0]!==snapshots[1])throw Error('PERSISTED_EVENT_CHANGED');
 report.checks.push('existing event survives independent HTTPS requests','durable creation and fingerprint unchanged','cloud reads do not call localhost');
 report.status='PASS';report.limitations=['Does not prove a Vercel instance restarted','Does not prove Windows/n8n restart recovery or continuous availability'];
}catch(error){report.code=error.message;process.exitCode=1;}
await writeFile('scratch/commercial-scale/cloud-recovery-verification.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
