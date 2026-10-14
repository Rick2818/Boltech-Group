-- ASMAS-only simplified worker; no Redis, no exposed public RPC.
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
alter table asmas.tasks add column if not exists lease_token uuid;
alter table asmas.tasks add column if not exists result jsonb;
create table if not exists asmas.simple_runtime(
 id boolean primary key default true check(id),
 google_free_tier_verified boolean not null default false,
 last_status text not null default 'BLOCKED_GOOGLE_SETUP',
 last_checked_at timestamptz,
 last_request_id bigint);
insert into asmas.simple_runtime(id) values(true) on conflict do nothing;
alter table asmas.simple_runtime enable row level security;
revoke all on asmas.simple_runtime from public,anon,authenticated;
do $$begin
 if not exists(select 1 from vault.secrets where name='asmas_worker_token') then
  perform vault.create_secret(encode(extensions.gen_random_bytes(32),'hex'),'asmas_worker_token','ASMAS synthetic batch endpoint only');
 end if;
end$$;
create or replace function asmas.simple_authorized(p_token text) returns boolean
language sql security invoker set search_path='' as $$
 select exists(select 1 from vault.decrypted_secrets where name='asmas_worker_token'
 and extensions.digest(decrypted_secret,'sha256')=extensions.digest(p_token,'sha256'));
$$;
create or replace function asmas.simple_start(p_run uuid) returns uuid
language plpgsql security invoker set search_path='' as $$
begin
 insert into asmas.synthetic_runs(run_id) values(p_run) on conflict do nothing;
 insert into asmas.tasks(case_id,agent,action,idempotency_key,payload)
 values('SYN-E2E-001','A5','SYNTHETIC_ANALYSIS',p_run::text||':A5',
 jsonb_build_object('run_id',p_run,'is_synthetic',true,'prompt',
 'Cliente Sintético: empresa ficticia con solicitudes de cotización lentas. Analiza un agente de IA para ordenar solicitudes y preparar borradores. No enviar correos, cobrar ni afirmar aceptación real.'))
 on conflict(idempotency_key) do nothing;
 return p_run;
end$$;
create or replace function asmas.simple_claim_one() returns jsonb
language plpgsql security invoker set search_path='' as $$
declare t asmas.tasks%rowtype;
begin
 select * into t from asmas.tasks where case_id='SYN-E2E-001'
 and action='SYNTHETIC_ANALYSIS' and payload->>'run_id' is not null and attempts<3
 and (status='QUEUED' or (status='LEASED' and lease_until<now()))
 order by created_at,id for update skip locked limit 1;
 if not found then return null;end if;
 update asmas.tasks set status='LEASED',lease_until=now()+interval '120 seconds',
 attempts=attempts+1,lease_token=gen_random_uuid() where id=t.id returning * into t;
 return to_jsonb(t);
end$$;
create or replace function asmas.simple_finish(p_id uuid,p_token uuid,p_result jsonb) returns boolean
language plpgsql security invoker set search_path='' as $$
declare t asmas.tasks%rowtype; nxt text; evt jsonb; rid uuid; n integer;
begin
 select * into t from asmas.tasks where id=p_id and status='LEASED'
 and lease_token=p_token and lease_until>now() for update;
 if not found then return false;end if;
 if p_result->>'model' is distinct from 'gemini-2.5-flash' or p_result->>'agent' is distinct from t.agent
 or coalesce(length(p_result->>'text'),0)=0 or p_result->>'provider_verified' is distinct from 'true'
 then raise exception 'INVALID_MODEL_RESULT';end if;
 rid:=(t.payload->>'run_id')::uuid;
 update asmas.tasks set status='SUCCEEDED',lease_until=null,result=p_result where id=p_id;
 insert into asmas.activities(task_id,case_id,agent,action,result,synthetic)
 values(p_id,t.case_id,t.agent,t.action,'SUCCEEDED',true);
 nxt:=case t.agent when 'A5' then 'A1' when 'A1' then 'A2' when 'A2' then 'A3' when 'A3' then 'A4' end;
 if nxt is not null then
  evt:=jsonb_build_object('run_id',rid,'source_agent',t.agent,'destination_agent',nxt,'is_synthetic',true);
  insert into asmas.outbox(topic,payload,published_at) values('asmas:db_task_queue',evt,now());
  insert into asmas.messages(correlation_id,task_id,from_agent,to_agent,status,payload)
  values(rid::text,p_id,t.agent,nxt,'DELIVERED_TO_DB_QUEUE',evt);
  insert into asmas.tasks(case_id,agent,action,idempotency_key,payload)
  values(t.case_id,nxt,t.action,rid::text||':'||nxt,t.payload||jsonb_build_object('previous_agent',t.agent,'previous_output',left(p_result->>'text',4000)))
  on conflict(idempotency_key) do nothing;
 else
  select count(distinct agent) into n from asmas.tasks where payload->>'run_id'=rid::text
  and status='SUCCEEDED' and result->>'provider_verified'='true' and result->>'model'='gemini-2.5-flash';
  if n=5 then update asmas.synthetic_runs set status='COMPLETED',finished_at=now(),
  result=jsonb_build_object('agents_completed',n,'model','gemini-2.5-flash','is_synthetic',true,
  'commercial_flow_certified',false,'emails_sent',0,'payments',0) where run_id=rid;end if;
 end if;
 return true;
end$$;
create or replace function asmas.simple_fail(p_id uuid,p_token uuid) returns boolean
language sql security invoker set search_path='' as $$
 with u as(update asmas.tasks set status='NEEDS_REVIEW',lease_until=null
 where id=p_id and status='LEASED' and lease_token=p_token returning id)
 select exists(select 1 from u);
$$;
create or replace function asmas.simple_dispatch(p_probe boolean default false) returns bigint
language plpgsql security invoker set search_path='' as $$
declare k text; r bigint;
begin
 if not p_probe and not(select google_free_tier_verified from asmas.simple_runtime where id) then
  update asmas.simple_runtime set last_status='BLOCKED_GOOGLE_SETUP',last_checked_at=now() where id;return null;
 end if;
 if not p_probe and not exists(select 1 from asmas.tasks where case_id='SYN-E2E-001' and status in ('QUEUED','LEASED')) then return null;end if;
 select decrypted_secret into k from vault.decrypted_secrets where name='asmas_worker_token';
 if k is null then raise exception 'WORKER_AUTH_MISSING';end if;
 r:=net.http_post(url:='https://pkgztteqtyebsggxnett.supabase.co/functions/v1/asmas-batch',
 headers:=jsonb_build_object('Content-Type','application/json','X-ASMAS-Worker-Token',k),
 body:='{}'::jsonb,timeout_milliseconds:=60000);
 update asmas.simple_runtime set last_request_id=r where id;return r;
end$$;
revoke all on all functions in schema asmas from public,anon,authenticated;
select cron.schedule('asmas-batch-15m','*/15 * * * *','select asmas.simple_dispatch();');
