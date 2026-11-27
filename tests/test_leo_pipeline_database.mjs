// Real PostgreSQL in isolated WASM memory. No production customer data or network.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from './db/node_modules/@electric-sql/pglite/dist/index.js';
import {preparePipelineRecord,pipelineTransition,pipelineQuestions} from '../cloudflare/leo-pipeline.mjs';
import worker from '../cloudflare/pages-leo-audio-worker.mjs';
const migration=await readFile(new URL('../supabase/migrations/20261127160000_leo_inbound_pipeline.sql',import.meta.url),'utf8');
async function database(){
 const db=new PGlite();
 await db.exec(`
 create role anon;create role authenticated;create role service_role bypassrls;
 create table public.crm_leads(id uuid primary key,company text not null,contact text,source text not null,source_id text,need text,status text not null,owner text,consent_record jsonb,updated_at timestamptz default now(),unique(source,source_id));
 create table public.crm_opportunities(id uuid primary key,lead_id uuid not null references crm_leads(id),platform text not null,state text not null,evidence jsonb,updated_at timestamptz default now());
 create table public.crm_approvals(id uuid primary key,scope text not null,approved_by text not null,status text not null,evidence jsonb);
 create table public.crm_proposals(id uuid primary key,opportunity_id uuid not null references crm_opportunities(id),status text not null,scope jsonb,quote jsonb,approval_id uuid references crm_approvals(id));
 create table public.crm_followups(id uuid primary key,opportunity_id uuid not null references crm_opportunities(id),scheduled_at timestamptz not null,status text not null,idempotency_key text unique,stop_reason text);
 create table public.crm_events(id uuid primary key default gen_random_uuid(),event_type text not null,entity_type text,entity_id uuid,idempotency_key text not null unique,payload jsonb);
 create function public.claim_crm_jobs(text,integer,integer) returns void language sql security definer as 'select';
 grant all on all tables in schema public to service_role;
 alter table public.crm_leads enable row level security;
 alter table public.crm_events enable row level security;
 `);
 await db.exec(migration);return db;
}
function record(){return preparePipelineRecord({id:crypto.randomUUID(),version:1,company:'Isolated fixture',contact:'',source:'LEO_INBOUND_V1',need:'Solicitudes',
  answers:Object.fromEntries(pipelineQuestions.map(([key])=>[key,{value:'Fixture '+key,source:'CUSTOMER_VERBATIM'}])),followups:[],closure:null,consent:{externalFollowupAuthorized:false},processedMessageIds:[]});}
const save=(db,rec,expected,key)=>db.query('select public.save_leo_inquiry($1::jsonb,$2,$3) as record',[JSON.stringify(rec),expected,key]);
test('actual migration compiles and transactional save projects a qualified inquiry exactly once',async()=>{
 const db=await database();try{
  const rec=record(),key='chat:'+rec.id+':'+crypto.randomUUID();await save(db,rec,0,key);await save(db,rec,0,key);
  for(const table of ['crm_leads','crm_opportunities','crm_proposals','crm_events'])assert.equal((await db.query('select count(*)::int as n from public.'+table)).rows[0].n,1);
  await assert.rejects(save(db,{...rec,version:2},0,'different:'+crypto.randomUUID()),/INVALID_INQUIRY/);
  await assert.rejects(save(db,{...rec,version:2},1-1,'stale:'+crypto.randomUUID()),/INVALID_INQUIRY/);
 }finally{await db.close();}
});
test('real row versions reject competing updates and all projections roll back on a write failure',async()=>{
 const db=await database();try{
  const rec=record();await save(db,rec,0,'seed:'+rec.id);
  const next=pipelineTransition(rec,{action:'proposal',scope:'Un flujo',exclusions:'Sin cobros',amountCents:60000});await save(db,next,1,'update:'+rec.id);
  await assert.rejects(save(db,{...next,company:'Competing write'},1,'conflict:'+rec.id),/STALE_VERSION/);
  await db.exec("alter table public.crm_events add constraint fail_test check(event_type<>'LEO_INQUIRY_SAVED') not valid");
  const third=pipelineTransition(next,{action:'approve',confirmed:true,proposalRevision:next.proposal.revision});
  await assert.rejects(save(db,third,2,'fail:'+rec.id),/fail_test/);
  assert.equal((await db.query('select leo_version from public.crm_leads where id=$1',[rec.id])).rows[0].leo_version,2);
  assert.equal((await db.query('select count(*)::int as n from public.crm_approvals')).rows[0].n,0);
 }finally{await db.close();}
});
test('SQL enforces private RPCs, revokes legacy public claim, and keeps public rows hidden',async()=>{
 const db=await database();try{
  for(const role of ['anon','authenticated']){
   const result=await db.query("select has_function_privilege($1,'public.save_leo_inquiry(jsonb,integer,text)','EXECUTE') as save,has_function_privilege($1,'public.tick_leo_followups()','EXECUTE') as tick,has_function_privilege($1,'public.claim_crm_jobs(text,integer,integer)','EXECUTE') as claim",[role]);
   assert.deepEqual(result.rows[0],{save:false,tick:false,claim:false});
  }
  assert.equal((await db.query("select has_function_privilege('service_role','public.save_leo_inquiry(jsonb,integer,text)','EXECUTE') as ok")).rows[0].ok,true);
  const rec=record();await save(db,rec,0,'private:'+rec.id);await db.exec('grant select on public.crm_leads to anon;set role anon');
  assert.equal((await db.query('select count(*)::int as n from public.crm_leads')).rows[0].n,0);
 }finally{await db.close();}
});
test('proposal changes revoke prior approval in SQL and scheduled reminders never dispatch',async()=>{
 const db=await database();try{
  let rec=record();await save(db,rec,0,'seed:'+rec.id);
  rec=pipelineTransition(rec,{action:'proposal',scope:'Flujo',exclusions:'Sin pagos',amountCents:60000});await save(db,rec,1,'quote:'+rec.id);
  rec=pipelineTransition(rec,{action:'approve',confirmed:true,proposalRevision:rec.proposal.revision});await save(db,rec,2,'approve:'+rec.id);
  await db.exec("update public.crm_followups set scheduled_at=now()-interval '1 minute'");
  const tick=(await db.query('select public.tick_leo_followups() as result')).rows[0].result;
  assert.equal(tick.due,1);assert.equal(tick.externalMessagesSent,0);
  rec=pipelineTransition(rec,{action:'proposal',scope:'Nuevo alcance',exclusions:'Sin pagos',amountCents:70000});await save(db,rec,3,'edit:'+rec.id);
  assert.equal((await db.query('select status from public.crm_approvals')).rows[0].status,'REVOKED');
  assert.equal((await db.query('select approval_id from public.crm_proposals')).rows[0].approval_id,null);
  assert.equal((await db.query('select status from public.crm_followups')).rows[0].status,'STOPPED');
 }finally{await db.close();}
});
test('actual Pages HTTP routes persist to PostgreSQL, encrypt public session, protect review and stop on withdrawal',async()=>{
 const db=await database(),originalFetch=globalThis.fetch,kv=new Map();
 const env={LEO_PIPELINE_ENABLED:'true',SUPABASE_URL:'https://uxwfqhromoicrwzyylbn.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'isolated-service-key-not-production',LEO_PLATFORM_TOKEN:'isolated-owner-key-not-production',
  COMMERCE:{get:async k=>kv.get(k)||null,put:async(k,v)=>kv.set(k,v),delete:async k=>kv.delete(k),list:async()=>({keys:[...kv.keys()].map(name=>({name}))})}};
 const auth={Origin:'https://boltech-group.pages.dev',Authorization:'Bearer '+env.LEO_PLATFORM_TOKEN,'Content-Type':'application/json'};
 let outsideCalls=0;
 globalThis.fetch=async(url,options)=>{
  const parsed=new URL(url);if(parsed.origin!==env.SUPABASE_URL){outsideCalls++;throw Error('Unexpected external action');}
  let data;
  if(parsed.pathname.endsWith('/rpc/save_leo_inquiry')){
   const args=JSON.parse(options.body);data=(await db.query('select public.save_leo_inquiry($1::jsonb,$2,$3) as result',[JSON.stringify(args.p_record),args.p_expected_version,args.p_event_key])).rows[0].result;
  }else if(parsed.pathname.endsWith('/crm_leads')){
   const id=parsed.searchParams.get('id')?.slice(3);
   data=id?(await db.query("select leo_record from public.crm_leads where id=$1 and source='LEO_INBOUND_V1'",[id])).rows:(await db.query("select leo_record from public.crm_leads where source='LEO_INBOUND_V1' order by updated_at desc limit 50")).rows;
  }else throw Error('Unexpected REST path');
  return Response.json(data);
 };
 try{
  let cookie='',answerTo='need',reference;const conversationId=crypto.randomUUID();
  const messages=['Necesito automatizar solicitudes entrantes',...pipelineQuestions.map(([key])=>'Detalle realista aislado: '+key)];
  for(const message of messages){
   const response=await worker.fetch(new Request('https://boltech-group.pages.dev/api?leo_sales=1',{method:'POST',headers:{Origin:'https://boltech-group.pages.dev','Content-Type':'application/json',Cookie:cookie},
    body:JSON.stringify({message,answerTo,conversationId,messageId:crypto.randomUUID(),pipelineConsent:true})}),env);
   assert.equal(response.status,200);const value=await response.json();reference=value.reference;answerTo=value.questionKey;cookie=response.headers.get('Set-Cookie').split(';')[0];
   assert.ok(!cookie.includes('Detalle'));assert.equal(value.persistence,'SUPABASE_CONFIRMED');
  }
  const anonymous=await worker.fetch(new Request('https://boltech-group.pages.dev/api/leo-pipeline'),env);assert.equal(anonymous.status,401);
  const list=await worker.fetch(new Request('https://boltech-group.pages.dev/api/leo-pipeline',{headers:auth}),env);assert.equal(list.status,200);let rec=(await list.json()).records[0];assert.equal(rec.id,reference);
  for(const action of [{action:'proposal',scope:'Un flujo confirmado',exclusions:'Sin pagos',amountCents:60000},{action:'approve',confirmed:true}]){
   const response=await worker.fetch(new Request('https://boltech-group.pages.dev/api/leo-pipeline',{method:'POST',headers:auth,body:JSON.stringify({...action,id:rec.id,requestId:crypto.randomUUID(),expectedVersion:rec.version,proposalRevision:rec.proposal.revision})}),env);
   assert.equal(response.status,200);rec=(await response.json()).record;
  }
  assert.equal(rec.followups[0].status,'PREPARED');
  const withdraw=await worker.fetch(new Request('https://boltech-group.pages.dev/api?leo_sales=1',{method:'POST',headers:{Origin:'https://boltech-group.pages.dev','Content-Type':'application/json',Cookie:cookie},body:JSON.stringify({message:'retirar consentimiento',messageId:crypto.randomUUID(),pipelineConsent:true,answerTo:'review'})}),env);
  assert.equal(withdraw.status,200);assert.match(withdraw.headers.get('Set-Cookie'),/Max-Age=0/);
  assert.equal((await db.query('select status from crm_followups')).rows[0].status,'STOPPED');assert.equal(outsideCalls,0);
 }finally{globalThis.fetch=originalFetch;await db.close();}
});
