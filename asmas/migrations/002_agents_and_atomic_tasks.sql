-- Applied to dedicated ASMAS project pkgztteqtyebsggxnett on 2026-10-12.
-- Reproducible additive schema, no other project references.
create table if not exists asmas.agent_registry(agent_id text primary key check(agent_id in ('A1','A2','A3','A4','A5')),role text not null,status text not null default 'CONFIGURED',last_heartbeat timestamptz);
create table if not exists asmas.leads(lead_id text primary key,company text not null,domain text,contact_email text,source text not null,score integer check(score between 0 and 100),is_synthetic boolean not null default false,current_agent text not null default 'A1',created_at timestamptz not null default now());
create table if not exists asmas.messages(message_id uuid primary key default gen_random_uuid(),correlation_id text not null,task_id uuid,from_agent text not null,to_agent text not null,status text not null default 'QUEUED',payload jsonb not null default '{}'::jsonb,created_at timestamptz not null default now(),constraint asmas_agents_not_equal check(from_agent<>to_agent));
create table if not exists asmas.incidents(incident_id uuid primary key default gen_random_uuid(),affected_task uuid,category text not null,status text not null default 'OPEN',details jsonb not null default '{}'::jsonb,created_at timestamptz not null default now());
create table if not exists asmas.synthetic_runs(run_id uuid primary key default gen_random_uuid(),case_id text not null default 'SYN-E2E-001',status text not null default 'STARTED',result jsonb not null default '{}'::jsonb,started_at timestamptz not null default now(),finished_at timestamptz);
revoke all on all tables in schema asmas from anon,authenticated,public;
alter table asmas.agent_registry enable row level security;
alter table asmas.leads enable row level security;
alter table asmas.messages enable row level security;
alter table asmas.incidents enable row level security;
alter table asmas.synthetic_runs enable row level security;
create or replace function asmas.claim_task(p_key text,p_agent text,p_lease_seconds integer default 120)
returns table(task_id uuid,claimed boolean,task_status text) language plpgsql security invoker set search_path=asmas,pg_temp as $$
declare v_id uuid;v_status text;
begin
 update asmas.tasks set status='LEASED',lease_until=now()+make_interval(secs=>least(greatest(p_lease_seconds,5),600)),attempts=attempts+1
 where idempotency_key=p_key and agent=p_agent and (status in ('QUEUED','RETRY_WAIT') or (status='LEASED' and lease_until<now()))
 returning id,status into v_id,v_status;
 if found then return query select v_id,true,v_status;return;end if;
 return query select t.id,false,t.status from asmas.tasks t where t.idempotency_key=p_key and t.agent=p_agent;
end $$;
create or replace function asmas.complete_task(p_task_id uuid,p_result jsonb,p_events jsonb default '[]'::jsonb)
returns boolean language plpgsql security invoker set search_path=asmas,pg_temp as $$
declare v_task asmas.tasks%rowtype;v_event jsonb;
begin
 select * into v_task from asmas.tasks where id=p_task_id for update;
 if not found or v_task.status not in ('LEASED','EXECUTING') then return false;end if;
 update asmas.tasks set status='SUCCEEDED',lease_until=null where id=p_task_id;
 insert into asmas.activities(task_id,case_id,agent,action,result,synthetic)
 values(p_task_id,v_task.case_id,v_task.agent,v_task.action,'SUCCEEDED',v_task.case_id='SYN-E2E-001');
 for v_event in select value from jsonb_array_elements(p_events) loop
 insert into asmas.outbox(topic,payload) values(coalesce(v_event->>'topic','asmas:events'),v_event);
 end loop;
 return true;
end $$;
revoke all on function asmas.claim_task(text,text,integer) from public,anon,authenticated;
revoke all on function asmas.complete_task(uuid,jsonb,jsonb) from public,anon,authenticated;
