// Shared batch host: five roles, one durable database queue, no external action tools.
export function createBatchHandler({repository,runModel,apiKeyPresent,now=Date.now}){
 const reply=(status,body)=>new Response(JSON.stringify({project:'ASMAS',certified:false,...body}),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
 return async req=>{
  if(req.method==='GET'){
   try{
    const settings=await repository.settings();
    const status=!apiKeyPresent?'BLOCKED_GOOGLE_API_KEY':!settings.google_free_tier_verified?'BLOCKED_GOOGLE_FREE_TIER':'READY_FOR_SYNTHETIC_TASKS';
    return reply(status.startsWith('BLOCKED')?503:200,{status,model:'gemini-3.5-flash-lite',model_calls:0});
   }catch{return reply(503,{status:'DATABASE_UNAVAILABLE'});}
  }
  if(req.method!=='POST')return reply(405,{error:'POST_REQUIRED'});
  const token=req.headers.get('X-ASMAS-Worker-Token')||'';
  if(!/^[a-f0-9]{64}$/.test(token))return reply(403,{error:'FORBIDDEN'});
  try{
   if(!await repository.authorized(token))return reply(403,{error:'FORBIDDEN'});
   const settings=await repository.settings();
   const blocked=!apiKeyPresent?'BLOCKED_GOOGLE_API_KEY':!settings.google_free_tier_verified?'BLOCKED_GOOGLE_FREE_TIER':'';
   if(blocked){await repository.status(blocked);return reply(503,{status:blocked,model_calls:0});}
   const deadline=now()+50000;let processed=0;
   while(processed<1&&now()<deadline){
    const task=await repository.claim();if(!task)break;
    if(task.case_id!=='SYN-E2E-001'||task.action!=='SYNTHETIC_ANALYSIS'){await repository.fail(task.id,task.lease_token);throw Error('UNSAFE_TASK');}
    try{
     if(task.payload?.director_mode===true){
       if(task.payload?.rsi_fixture_preflight===true&&!task.payload?.rsi_retry_count){
         if(!await repository.recordEvidence(task.id,task.lease_token,'PREFLIGHT_FAILED'))throw Error('EVIDENCE_WRITE_FAILED');
         throw Error('SYNTHETIC_PREFLIGHT_FAILED');
       }
       if(!await repository.recordEvidence(task.id,task.lease_token,'PROVIDER_CALL_STARTED'))throw Error('EVIDENCE_WRITE_FAILED');
     }
     const output=await runModel(task.agent,JSON.stringify(task.payload));
     if(task.payload?.director_mode===true)
       if(!await repository.recordEvidence(task.id,task.lease_token,'PROVIDER_RESPONSE_RECEIVED'))throw Error('EVIDENCE_WRITE_FAILED');
     if(output?.agent!==task.agent)throw Error('MODEL_AGENT_MISMATCH');
     if(output?.model!==('gemini-3.5-flash-lite'))throw Error('MODEL_NAME_MISMATCH');
     if(typeof output?.text!=='string'||!output.text.trim())throw Error('MODEL_TEXT_MISSING');
     let finished;
     try{finished=await repository.finish(task.id,task.lease_token,{...output,provider_verified:true});}
     catch(error){if(error?.message==='INVALID_MODEL_RESULT')throw Error('DATABASE_MODEL_RESULT_REJECTED');throw error;}
     if(!finished)throw Error('LEASE_CONFLICT');
     processed++;
    }catch(error){const reason=/^(GEMINI_PROVIDER_HTTP_[0-9]{3}|GEMINI_EMPTY_RESPONSE|INVALID_MODEL_RESULT|MODEL_AGENT_MISMATCH|MODEL_NAME_MISMATCH|MODEL_TEXT_MISSING|DATABASE_MODEL_RESULT_REJECTED|LEASE_CONFLICT)$/.test(error?.message||'')?error.message:(error?.name==='TimeoutError'||error?.name==='AbortError')?'MODEL_TIMEOUT':'MODEL_EXECUTION_FAILED';await repository.fail(task.id,task.lease_token);await repository.status('TASK_NEEDS_REVIEW');return reply(502,{status:'TASK_NEEDS_REVIEW',processed,reason});}
   }
   await repository.status(processed?'BATCH_COMPLETED':'IDLE');
   return reply(200,{status:processed?'BATCH_COMPLETED':'IDLE',processed,model:'gemini-3.5-flash-lite',execution_mode:'LIVE_SYNTHETIC_INFERENCE',emails_sent:0,payments:0});
  }catch{return reply(503,{status:'DATABASE_OR_AUTH_UNAVAILABLE'});}
 };
}
