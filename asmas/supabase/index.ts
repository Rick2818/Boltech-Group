import postgres from 'npm:postgres@3.4.3';
import {createBatchHandler} from '../simple-batch.mjs';
import {createGeminiRuntime} from '../gemini-runtime.mjs';
const dbUrl=Deno.env.get('SUPABASE_DB_URL');
const key=Deno.env.get('GOOGLE_API_KEY')||Deno.env.get('GEMINI_API_KEY')||Deno.env.get('GOOGLE_GENERATIVE_AI_API_KEY');
let db;
function database(){if(!dbUrl)throw Error('DB_REQUIRED');return db??=postgres(dbUrl,{prepare:false,max:1,connect_timeout:8,idle_timeout:10});}
const repository={
 authorized:async token=>(await database()`select asmas.simple_authorized(${token}) as ok`)[0].ok,
 settings:async()=>(await database()`select google_free_tier_verified from asmas.simple_runtime where id`)[0],
 status:async status=>{await database()`update asmas.simple_runtime set last_status=${status},last_checked_at=now() where id`;},
 claim:async()=>(await database()`select asmas.simple_claim_one() as task`)[0].task,
 finish:async(id,token,result)=>{try{return (await database()`select asmas.simple_finish(${id}::uuid,${token}::uuid,${database().json(result)}::jsonb) as ok`)[0].ok;}catch(e){console.error('ASMAS_FINISH_DIAGNOSTIC '+JSON.stringify({error_code:e?.code,model:result?.model,agent:result?.agent,provider_verified:result?.provider_verified,text_type:typeof result?.text,text_length:result?.text?.length,db_message:e?.message?.slice(0,140)}));throw e;}},
 fail:async(id,token)=>(await database()`select asmas.simple_fail(${id}::uuid,${token}::uuid) as ok`)[0].ok
};
const runtime=key?createGeminiRuntime({apiKey:key}):null;
Deno.serve(createBatchHandler({repository,apiKeyPresent:!!key,runModel:(agent,input)=>runtime.run(agent,input,{signal:AbortSignal.timeout(45000)})}));
