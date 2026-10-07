import {createHash} from 'node:crypto';
import {signInteragent} from './interagent_coordinator.js';
const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
const hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const confirmed=(event,row)=>row?.success===true&&row.eventId===event.eventId&&row.opportunityId===event.opportunityId&&row.from===event.from&&!!row.createdAt&&!!row.fingerprint;
export async function runN8nMessage({event,runtime,store,fetcher=fetch,reconcile=false,now=()=>new Date().toISOString()}){
 if(!/^[a-zA-Z0-9_.:-]{1,120}$/.test(event.eventId||''))throw Error('INVALID_EVENT_ID');
 const fingerprint=hash(canonical(event));let record=await store.read();
 if(record&&record.fingerprint!==fingerprint&&record.fingerprint!==hash(event))throw Error('EVENT_ID_CONFLICT');
 const finish=()=>({exitCode:record.status==='RECEIVED'&&confirmed(event,record.response)?0:1,result:{eventId:event.eventId,status:record.status,response:record.response||null,reused:!!record.reused}});
 if(record){
  record.reused=true;
  if(record.status==='RECEIVED'&&confirmed(event,record.response))return finish();
  if(record.status==='RECEIVED'){record.status='UNKNOWN';record.code='LEGACY_RECEIPT_REQUIRES_RECONCILIATION';await store.save(record);}
  if(!reconcile)return finish();
  const key=runtime.roleKeys?.[event.from];if(!key)throw Error('AGENT_SIGNING_KEY_MISSING');
  const body={operation:'receipt',from:event.from,eventId:event.eventId,event,signedAt:now()};
  try{
   const response=await fetcher('https://boltech-group.vercel.app/api/partners?action=interagent',{method:'POST',headers:{'Content-Type':'application/json','X-Boltech-Signature':signInteragent(body,key)},body:JSON.stringify(body),signal:AbortSignal.timeout(25000)});
   const data=await response.json();
   record.reconciledAt=now();record.reconciliationCode=data.code||'RECEIPT_UNCONFIRMED';
   if(response.ok&&data.success===true&&confirmed(event,data.receipt)){record.status='RECEIVED';record.response=data.receipt;record.reconciliationCode='CLOUD_RECEIPT_VERIFIED';}
  }catch{record.reconciledAt=now();record.reconciliationCode='CLOUD_RECONCILIATION_UNCONFIRMED';}
  await store.save(record);return finish();
 }
 if(reconcile){record={eventId:event.eventId,fingerprint,status:'UNKNOWN',at:now()};await store.reserve(record);return runN8nMessage({event,runtime,store,fetcher,reconcile:true,now});}
 const key=runtime.roleKeys?.[event.from];if(!key)throw Error('AGENT_SIGNING_KEY_MISSING');
 record={eventId:event.eventId,fingerprint,status:'PENDING',at:now()};
 try{await store.reserve(record);}catch(error){if(error.code==='EEXIST')return runN8nMessage({event,runtime,store,fetcher,reconcile:false,now});throw error;}
 const signed={...event,signedAt:now()};
 try{
  const response=await fetcher('http://127.0.0.1:5678/webhook/boltech-sales-marketing',{method:'POST',headers:{'Content-Type':'application/json','X-Boltech-Agent-Key':runtime.key,'X-Boltech-Signature':signInteragent(signed,key)},body:JSON.stringify(signed),signal:AbortSignal.timeout(25000)});
  const data=await response.json();record.status=response.ok&&confirmed(event,data)?'RECEIVED':response.ok?'UNKNOWN':'REJECTED';record.response=data;
 }catch{record.status='UNKNOWN';record.code='N8N_RESULT_UNCONFIRMED_NO_AUTO_RETRY';}
 await store.save(record);return finish();
}
