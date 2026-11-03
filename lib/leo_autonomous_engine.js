// Leo's opt-in autonomous read-only execution engine.
// Uses the existing verified tenant objectives, Redis CAS and production scheduler.
// NO email, bidding, payment, shell, arbitrary URLs or LLM billing are supported.
import {createHash} from 'node:crypto';
import {createLeoRedisStore} from './leo_redis_store.js';
import {redisCommand} from './rsi_handoff_store.js';

const QUEUE='leo:autonomy:v1:due';
const HOSTS=new Set([
 'github.com','raw.githubusercontent.com','docs.github.com',
 'supabase.com','docs.supabase.com','vercel.com',
 'developers.google.com','ai.google.dev','learn.microsoft.com','docs.python.org'
]);
const idOk=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{3,100}$/.test(x);
const failure=(code,http=409)=>{throw Object.assign(new Error(code),{code,statusCode:http});};
const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const clean=x=>String(x??'').replace(/[\u0000-\u001F\u007F]/g,' ').slice(0,2500);
const moment=now=>new Date(now()).toISOString();
const key=(tenant,id)=>'leo:v1:'+tenant+':'+id;
const member=(tenant,id)=>tenant+':'+id;
const addEvent=(record,kind,at,data={})=>{
 if(!Array.isArray(record.events)||record.events.length>=70)failure('LEO_AUTONOMY_EVENT_LIMIT');
 record.events.push({kind,at,...data});
};
function parseReference(value){
 if(typeof value!=='string'||value.length>360)return null;
 let url;try{url=new URL(value)}catch{return null}
 if(url.protocol!=='https:'||!HOSTS.has(url.hostname)||url.username||url.password||url.port||url.search||url.hash)return null;
 return url.toString();
}
function requirePrincipal(principal,id,admin=false){
 if(!principal?.verified||!idOk(principal.tenantId)||!idOk(principal.subject)||!idOk(id))failure('LEO_AUTONOMY_AUTH_REQUIRED',401);
 if(admin&&!principal.roles?.includes('tenant_admin'))failure('LEO_AUTONOMY_ADMIN_REQUIRED',403);
}
function assertOwner(record,principal){
 if(!record||record.tenantId!==principal.tenantId)failure('LEO_AUTONOMY_NOT_FOUND',404);
 if(record.owner!==principal.subject&&!principal.roles?.includes('tenant_admin'))failure('LEO_AUTONOMY_ACCESS_DENIED',403);
}
function stepReceipt(step,result,at){
 const sha256=digest({step:step.id,tool:step.tool,output:result});
 return {step:step.id,tool:step.tool,at,receipt:'leo-readonly:'+sha256,summary:clean(result.summary),sourceUrl:result.sourceUrl||null,sha256:result.sha256||sha256,excerpt:clean(result.excerpt||'')};
}
async function fetchReference(url,fetcher){
 const canonical=parseReference(url);
 if(canonical!==url)failure('LEO_PUBLIC_REFERENCE_NOT_ALLOWED');
 const response=await fetcher(canonical,{redirect:'error',headers:{Accept:'text/html,text/plain,application/json'},signal:AbortSignal.timeout(8500)});
 if(!response?.ok)failure('LEO_REFERENCE_HTTP_UNAVAILABLE',503);
 const ct=(response.headers?.get?.('content-type')||'').toLowerCase();
 if(!(/text\/html|text\/plain|application\/json/.test(ct)))failure('LEO_REFERENCE_CONTENT_TYPE_REJECTED');
 const len=Number(response.headers?.get?.('content-length')||0);
 if(len>120000)failure('LEO_REFERENCE_TOO_LARGE');
 // Read bounded streaming bytes; do not fetch the entire untrusted response into memory.
 if(!response.body?.getReader)failure('LEO_REFERENCE_STREAM_REQUIRED',503);
 const reader=response.body.getReader();let bytes=0;const parts=[];
 try{
  while(true){
   const {done,value}=await reader.read();if(done)break;
   bytes+=value.byteLength;if(bytes>120000)failure('LEO_REFERENCE_TOO_LARGE');
   parts.push(value);
  }
 }finally{await reader.cancel().catch(()=>{});}
 const raw=Buffer.concat(parts.map(p=>Buffer.from(p))).toString('utf8');
 const excerpt=raw.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ')
   .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ')
   .replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim().slice(0,1600);
 if(excerpt.length<10)failure('LEO_REFERENCE_EMPTY');
 return {sourceUrl:canonical,sha256:createHash('sha256').update(raw).digest('hex'),excerpt,summary:'HTTPS public source fetched and content hashed; no factual interpretation or external action'};
}
export function createLeoAutonomousEngine({store=createLeoRedisStore(),command=redisCommand,fetcher=fetch,now=Date.now}={}){
 if(typeof store?.read!=='function'||typeof store?.writeIfVersion!=='function'||typeof command!=='function')failure('LEO_AUTONOMY_DEPENDENCY_REQUIRED',503);
 const read=async(tenant,id)=>store.read(key(tenant,id));
 const cas=async(before,after)=>{
  after.version=before.version+1;after.updatedAt=moment(now);
  if(!await store.writeIfVersion(key(before.tenantId,before.id),before.version,after))failure('LEO_AUTONOMY_VERSION_CONFLICT');
  return after;
 };
 const enqueue=async(record,at=now())=>{
  const out=await command(['ZADD',QUEUE,String(at),member(record.tenantId,record.id)]);
  if(out===null||out===undefined)failure('LEO_AUTONOMY_QUEUE_UNAVAILABLE',503);
 };
 const dequeue=async(record)=>command(['ZREM',QUEUE,member(record.tenantId,record.id)]);
 async function prepare({principal,id,expectedVersion,eventId}={}){
  requirePrincipal(principal,id,true);
  if(!idOk(eventId))failure('LEO_AUTONOMY_EVENT_INVALID',400);
  const old=await read(principal.tenantId,id);assertOwner(old,principal);
  if(old.automation&&old.events.some(x=>x.id===eventId))return old;
  if(old.version!==expectedVersion||old.status!=='AWAITING_PLAN_APPROVAL'||old.automation)failure('LEO_AUTONOMY_PREPARE_CONFLICT');
  const refs=[...new Set((old.delegation?.sources||[]).map(parseReference).filter(Boolean))].slice(0,3);
  if(!refs.length)failure('LEO_PUBLIC_SOURCES_REQUIRED',400);
  const steps=[
   {id:'inspect',tool:'inspect_objective'},
   ...refs.map((url,i)=>({id:'source_'+(i+1),tool:'fetch_public_reference',url})),
   {id:'report',tool:'compile_evidence_report'}
  ];
  const next=structuredClone(old);
  next.plan=steps.map(step=>step.tool+(step.url?' '+step.url:''));
  next.automation={
   version:1,steps,stepIndex:0,receipts:[],approved:false,approvedAt:null,
   status:'AWAITING_APPROVAL',maxAttemptsPerStep:3,attemptsForStep:0,
   policy:'READ_ONLY_APPROVED_SOURCES',planDigest:digest(steps)
  };
  addEvent(next,'AUTONOMY_PREPARED',moment(now),{id:eventId});
  return cas(old,next);
 }
 async function approve({principal,id,expectedVersion,eventId,approval=false}={}){
  requirePrincipal(principal,id,true);
  if(!approval||!idOk(eventId))failure('LEO_AUTONOMY_APPROVAL_REQUIRED',403);
  const old=await read(principal.tenantId,id);assertOwner(old,principal);
  if(old.events.some(x=>x.id===eventId)){if(old.automation?.approved)await enqueue(old);return old;}
  if(old.version!==expectedVersion||old.status!=='AWAITING_PLAN_APPROVAL'||!old.automation||
     old.automation.approved||old.automation.planDigest!==digest(old.automation.steps))
   failure('LEO_AUTONOMY_APPROVAL_CONFLICT');
  const next=structuredClone(old);next.status='READY';next.automation.approved=true;
  next.automation.approvedAt=moment(now);next.automation.status='QUEUED';
  addEvent(next,'AUTONOMY_APPROVED',moment(now),{id:eventId,subject:principal.subject});
  const saved=await cas(old,next);
  await enqueue(saved); // A failed enqueue is recoverable via requeue, never a fake execution.
  return saved;
 }
 async function requeue({principal,id,expectedVersion,eventId,approval=false}={}){
  requirePrincipal(principal,id,true);if(!approval||!idOk(eventId))failure('LEO_AUTONOMY_REQUEUE_APPROVAL_REQUIRED',403);
  const old=await read(principal.tenantId,id);assertOwner(old,principal);
  if(old.events.some(x=>x.id===eventId)){if(old.status==='READY')await enqueue(old);return old;}
  if(old.version!==expectedVersion||!old.automation?.approved||!['READY','BLOCKED'].includes(old.status))
   failure('LEO_AUTONOMY_REQUEUE_NOT_ALLOWED');
  const next=structuredClone(old);next.status='READY';next.automation.status='QUEUED';
  next.automation.attemptsForStep=0;next.automation.blockedCode=null;
  addEvent(next,'AUTONOMY_REQUEUED',moment(now),{id:eventId,subject:principal.subject});
  const saved=await cas(old,next);await enqueue(saved);return saved;
 }
 async function cancel({principal,id,expectedVersion,eventId}={}){
  requirePrincipal(principal,id,true);if(!idOk(eventId))failure('LEO_AUTONOMY_EVENT_INVALID',400);
  const old=await read(principal.tenantId,id);assertOwner(old,principal);
  if(old.events.some(x=>x.id===eventId))return old;
  if(old.version!==expectedVersion||!old.automation||!['READY','BLOCKED','AWAITING_PLAN_APPROVAL'].includes(old.status))
   failure('LEO_AUTONOMY_CANCEL_NOT_ALLOWED');
  const next=structuredClone(old);next.status='BLOCKED';next.automation.approved=false;next.automation.status='CANCELLED';
  addEvent(next,'AUTONOMY_CANCELLED',moment(now),{id:eventId,subject:principal.subject});
  const saved=await cas(old,next);await dequeue(saved);return saved;
 }
 async function runTool(record,step){
  if(step.tool==='inspect_objective')return {summary:'Owner objective and acceptance criteria inspected from the authenticated tenant record',
    excerpt:clean(record.description)+' | Acceptance: '+clean(record.criteria)};
  if(step.tool==='fetch_public_reference')return fetchReference(step.url,fetcher);
  if(step.tool==='compile_evidence_report'){
   if(!record.automation.receipts.some(r=>r.tool==='fetch_public_reference'))failure('LEO_AUTONOMY_EVIDENCE_MISSING');
   return {summary:'Source inventory with verified HTTP receipts prepared for human review',
    excerpt:record.automation.receipts.filter(r=>r.sourceUrl).map(r=>r.sourceUrl+' sha256='+r.sha256).join(' | ')};
  }
  failure('LEO_AUTONOMY_TOOL_NOT_APPROVED',403);
 }
 async function processMember(value){
  if(typeof value!=='string'||!/^[A-Za-z0-9_-]{3,100}:[A-Za-z0-9_-]{3,100}$/.test(value))return {status:'INVALID_QUEUE_MEMBER'};
  const [tenant,id]=value.split(':');
  let old=await read(tenant,id);
  if(!old){await command(['ZREM',QUEUE,value]);return {status:'MISSING'};}
  if(!old.automation?.approved||old.automation?.planDigest!==digest(old.automation.steps)){
   await dequeue(old);return {status:'NOT_APPROVED'};
  }
  if(old.status==='EXECUTING'&&old.automation?.claim){
   const age=now()-Date.parse(old.automation.claim.at);
   if(!Number.isFinite(age)||age<150000)return {status:'IN_FLIGHT'};
   const next=structuredClone(old);
   if(next.automation.attemptsForStep>=3){
    next.status='BLOCKED';next.automation.status='REVIEW_REQUIRED';next.automation.blockedCode='STALE_CLAIM_MAX_ATTEMPTS';
    addEvent(next,'AUTONOMY_UNCERTAIN',moment(now),{step:next.automation.claim.step});
   }else{
    next.status='READY';next.automation.status='RETRY_READ_ONLY';
    addEvent(next,'AUTONOMY_RECOVERED_READ_ONLY',moment(now),{step:next.automation.claim.step});
   }
   next.automation.claim=null;
   const saved=await cas(old,next);
   if(saved.status==='BLOCKED')await dequeue(saved);else await enqueue(saved);
   return {status:saved.status,objectiveId:id};
  }
  if(old.status!=='READY'){await dequeue(old);return {status:'SKIPPED_STATE'};}
  const idx=old.automation.stepIndex,step=old.automation.steps[idx];
  if(!step||idx>=5||old.automation.attemptsForStep>=3){
   const next=structuredClone(old);next.status='BLOCKED';next.automation.status='REVIEW_REQUIRED';next.automation.blockedCode='PLAN_LIMIT';
   addEvent(next,'AUTONOMY_BLOCKED',moment(now));await cas(old,next);await dequeue(next);return {status:'BLOCKED'};
  }
  const claim=structuredClone(old);
  claim.status='EXECUTING';claim.automation.status='RUNNING';
  claim.automation.attemptsForStep++;
  claim.automation.claim={step:step.id,at:moment(now)};
  addEvent(claim,'AUTONOMY_STEP_CLAIMED',moment(now),{step:step.id});
  try{await cas(old,claim)}catch(e){if(e.code==='LEO_AUTONOMY_VERSION_CONFLICT')return {status:'CONCURRENT_SKIP'};throw e;}
  try{
   const result=await runTool(claim,step);
   const receipt=stepReceipt(step,result,moment(now));
   const done=structuredClone(claim);
   done.automation.receipts.push(receipt);done.automation.stepIndex++;
   done.automation.claim=null;done.automation.attemptsForStep=0;
   done.lastTool={name:step.tool,receipt:receipt.receipt,at:receipt.at};
   const finished=done.automation.stepIndex===done.automation.steps.length;
   done.status=finished?'AWAITING_REVIEW':'READY';
   done.automation.status=finished?'AWAITING_REVIEW':'QUEUED';
   addEvent(done,'AUTONOMY_STEP_DONE',moment(now),{step:step.id,receipt:receipt.receipt});
   const saved=await cas(claim,done);
   if(finished)await dequeue(saved);else await enqueue(saved,now()+250);
   return {status:saved.status,step:step.id,receipt:receipt.receipt,objectiveId:id};
  }catch(e){
   // Outcome may be uncertain; never auto-repeat before the expired-claim check.
   const current=await read(tenant,id);
   if(current?.status==='EXECUTING'&&current.version===claim.version){
    const blocked=structuredClone(current);blocked.status='BLOCKED';
    blocked.automation.status='REVIEW_REQUIRED';blocked.automation.blockedCode=clean(e.code||'READ_ONLY_TOOL_FAILED');
    blocked.automation.claim=null;
    addEvent(blocked,'AUTONOMY_STEP_FAILED',moment(now),{step:step.id,code:blocked.automation.blockedCode});
    await cas(current,blocked);await dequeue(blocked);
   }
   return {status:'BLOCKED_OR_UNCERTAIN',step:step.id,objectiveId:id,code:clean(e.code||'READ_ONLY_TOOL_FAILED')};
  }
 }
 async function tick({limit=4}={}){
  if(!Number.isSafeInteger(limit)||limit<1||limit>6)failure('LEO_AUTONOMY_WORKER_LIMIT',400);
  const members=await command(['ZRANGEBYSCORE',QUEUE,'-inf',String(now()),'LIMIT','0',String(limit)]);
  if(!Array.isArray(members))failure('LEO_AUTONOMY_QUEUE_UNAVAILABLE',503);
  const receipts=[];
  for(const m of members){try{receipts.push(await processMember(m))}catch(err){receipts.push({status:'WORKER_ERROR',code:clean(err.code||'UNAVAILABLE')})}}
  return {status:'WORKER_TICK',processed:receipts.length,receipts};
 }
 return {prepare,approve,requeue,cancel,tick};
}
