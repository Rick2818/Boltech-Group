import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const path=process.argv[2];
if(!path)throw Error('Provide local event JSON path');
const event=JSON.parse(await readFile(path,'utf8'));
if(!/^[a-zA-Z0-9_.:-]{1,120}$/.test(event.eventId||''))throw Error('INVALID_EVENT_ID');
const dir='scratch/commercial-scale/interagent-ledger';await mkdir(dir,{recursive:true});
const file=`${dir}/${createHash('sha256').update(event.eventId).digest('hex')}.json`;
const fingerprint=createHash('sha256').update(JSON.stringify(event)).digest('hex');
try { const saved=JSON.parse(await readFile(file,'utf8'));if(saved.fingerprint!==fingerprint)throw Error('EVENT_ID_CONFLICT');console.log(JSON.stringify({eventId:event.eventId,status:saved.status,response:saved.response||null,reused:true}));process.exit(0); }
catch(error){if(error.code!=='ENOENT')throw error;}
const runtime=JSON.parse(await readFile('scratch/commercial-scale/n8n-runtime/client-auth.json','utf8'));
const record={eventId:event.eventId,fingerprint,status:'PENDING',at:new Date().toISOString()};await writeFile(file,JSON.stringify(record),{flag:'wx'});
try{
 const response=await fetch('http://127.0.0.1:5678/webhook/boltech-sales-marketing',{method:'POST',headers:{'Content-Type':'application/json','X-Boltech-Agent-Key':runtime.key},body:JSON.stringify(event),signal:AbortSignal.timeout(25000)});
 const data=await response.json();record.status=response.ok&&data.success?'RECEIVED':'REJECTED';record.response=data;
}catch{record.status='UNKNOWN';record.code='N8N_RESULT_UNCONFIRMED_NO_AUTO_RETRY';}
await writeFile(file,JSON.stringify(record,null,2));console.log(JSON.stringify({eventId:event.eventId,status:record.status,response:record.response||null}));
if(record.status!=='RECEIVED')process.exitCode=1;
