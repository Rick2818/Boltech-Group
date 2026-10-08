import {DatabaseSync} from 'node:sqlite';
import {uptime} from 'node:os';
import {readFile,writeFile,stat} from 'node:fs/promises';
const dir='scratch/commercial-scale',file=dir+'/n8n-restart-baseline.json';
const now=Date.now(),bootEstimate=now-uptime()*1000;
const databasePath=dir+'/n8n-runtime/.n8n/database.sqlite';
const database=new DatabaseSync(databasePath,{readOnly:true});
let workflow;try{workflow=database.prepare('SELECT id, active FROM workflow_entity WHERE id = ?').get('boltechSalesMarketing');}finally{database.close();}
if(!workflow||!workflow.active)throw Error('N8N_WORKFLOW_NOT_ACTIVE');
const response=await fetch('http://127.0.0.1:5678/healthz',{signal:AbortSignal.timeout(5000)});if(!response.ok)throw Error('N8N_LOCAL_HEALTH_FAILED');
const facts={at:new Date(now).toISOString(),bootEstimateUtc:new Date(bootEstimate).toISOString(),workflowId:workflow.id,workflowActive:!!workflow.active,databaseCreatedAt:(await stat(databasePath)).birthtime.toISOString(),healthStatus:response.status};
if(process.argv.includes('--baseline')){await writeFile(file,JSON.stringify(facts,null,2));console.log(JSON.stringify({status:'BASELINE_SAVED',...facts,restartVerified:false}));}
else{const previous=JSON.parse(await readFile(file,'utf8'));const rebootObserved=Math.abs(bootEstimate-Date.parse(previous.bootEstimateUtc))>60000&&bootEstimate>Date.parse(previous.at);const preserved=previous.workflowId===facts.workflowId&&previous.databaseCreatedAt===facts.databaseCreatedAt;const report={...facts,status:rebootObserved&&preserved?'RESTART_STATE_RECOVERED':'RESTART_NOT_YET_VERIFIED',rebootObserved,existingDatabasePreserved:preserved,automaticStartupProven:false,note:'Run the communication check as well. A healthy service alone does not prove it started automatically.'};await writeFile(dir+'/n8n-restart-verification.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));if(report.status!=='RESTART_STATE_RECOVERED')process.exitCode=1;}
