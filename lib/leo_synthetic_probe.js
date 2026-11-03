// Operational synthetic-only smoke test, isolated from live customer records.
// No LLM, customer data, bids, payments, emails or third-party messaging.
import {randomUUID} from 'node:crypto';
import {createLeoTenantAgent} from './leo_tenant_autonomy.js';
import {createLeoAutonomousEngine} from './leo_autonomous_engine.js';
import {createLeoRedisStore} from './leo_redis_store.js';
import {redisCommand} from './rsi_handoff_store.js';

const TENANT='qa_synthetic_leo';
const SUBJECT='qa_internal_operator';
const PUBLIC_REFERENCE='https://raw.githubusercontent.com/github/docs/main/README.md';
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));

export async function runLeoSyntheticProbe({store=createLeoRedisStore(),command=redisCommand,engine,delay=pause}={}){
 const id='qa_'+randomUUID().replaceAll('-','');
 const principal={verified:true,tenantId:TENANT,subject:SUBJECT,roles:['tenant_admin']};
 const agent=createLeoTenantAgent({store,principal});
 const executor=engine||createLeoAutonomousEngine({store,command});
 const storageKey='leo:v1:'+TENANT+':'+id;
 const queueMember=TENANT+':'+id;
 let created=false,stage='initialization',cleanup={queue:false,record:false};
 try{
  const objective={
   id,
   source:'SYNTHETIC_QA_DO_NOT_COUNT_AS_CUSTOMER',
   description:'Synthetic QA: inspect an isolated objective and one public GitHub documentation file',
   criteria:'Verify three read-only steps, durable receipts, final review and no external write',
   delegation:{
    expectedResult:'Three auditable read-only receipts for a synthetic system integrity probe',
    sources:[PUBLIC_REFERENCE],
    reviewInstructions:'Only an internal synthetic reviewer may close this QA record',
    preferredChannel:'chat'
   }
  };
  stage='create';
  let record=await agent.objective(objective);created=true;
  stage='prepare';
  record=await executor.prepare({principal,id,expectedVersion:record.version,eventId:'qa_prepare'});
  if(record.status!=='AWAITING_PLAN_APPROVAL'||record.automation.steps.length!==3)throw Error('QA_INVALID_PLAN');
  stage='approve';
  record=await executor.approve({principal,id,expectedVersion:record.version,eventId:'qa_approve',approval:true});
  if(record.status!=='READY')throw Error('QA_NOT_QUEUED');
  const executed=[];
  for(let attempt=0;attempt<3;attempt++){
   stage='step_'+(attempt+1);
   if(attempt)await delay(350);
   const out=await executor.runSyntheticStep({tenantId:TENANT,id});
   if(!['READY','AWAITING_REVIEW'].includes(out.status)||!out.receipt)throw Error('QA_STEP_NOT_CONFIRMED_'+out.status);
   const persisted=await agent.get(id);
   if(persisted.automation.receipts.length!==attempt+1||persisted.lastTool?.receipt!==out.receipt)throw Error('QA_RECEIPT_NOT_PERSISTED');
   executed.push({step:out.step,status:out.status,receipt:out.receipt});
  }
  stage='review';
  const review=await agent.get(id);
  if(review.status!=='AWAITING_REVIEW'||review.automation.receipts.length!==3)throw Error('QA_HUMAN_REVIEW_NOT_REQUIRED');
  const completed=await agent.transition({id,expectedVersion:review.version,action:'complete',eventId:'qa_complete',approval:true});
  if(completed.status!=='COMPLETED')throw Error('QA_REVIEW_COMPLETION_FAILED');
  return {
   synthetic:true,productionEvidence:true,status:'PASS',reviewRequired:true,
   tenant:TENANT,stepCount:3,steps:executed,
   sourceHost:'raw.githubusercontent.com',outputDigest:review.automation.receipts[1].sha256,
   // Not evidence of a real customer or autonomous general-purpose reasoning.
   note:'Synthetic isolated read-only workflow; no customers, sends, charges or bids'
  };
 }catch(error){
  const err=Object.assign(new Error('LEO_SYNTHETIC_PROBE_FAILED'),{statusCode:503,code:'LEO_SYNTHETIC_PROBE_FAILED'});
  err.details={stage,code:String(error.code||error.message||'UNKNOWN').slice(0,100)};
  throw err;
 }finally{
  // A failed cleanup must never falsely claim a clean pass.
  try{await command(['ZREM','leo:autonomy:v1:due',queueMember]);cleanup.queue=true;}
  catch{cleanup.queue=false;}
  try{if(created)await command(['DEL',storageKey]);cleanup.record=true;}
  catch{cleanup.record=false;}
  if(!cleanup.queue||!cleanup.record){
   // Fail closed and report only status, not auth data or internals.
   throw Object.assign(new Error('LEO_SYNTHETIC_CLEANUP_FAILED'),{statusCode:503,code:'LEO_SYNTHETIC_CLEANUP_FAILED'});
  }
 }
}
