-- Runtime configuration for the existing Boltech database. No credentials in Git.
-- Install first, provision Vault secret boltech_scheduler_secret separately,
-- deploy the matching Vercel code, then activate the three jobs at the end.
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
create schema if not exists boltech_ops;
revoke all on schema boltech_ops from public, anon, authenticated;

create table if not exists boltech_ops.http_receipts (
 request_id bigint primary key,
 route text not null check(route in ('research','inbox','explee')),
 requested_at timestamptz not null default now(),
 completed_at timestamptz,
 status_code integer,
 error_code text,
 result jsonb
);
alter table boltech_ops.http_receipts enable row level security;
revoke all on boltech_ops.http_receipts from public, anon, authenticated;

create or replace function boltech_ops.collect_receipts() returns void
language sql security invoker set search_path = '' as $$
 update boltech_ops.http_receipts r
 set completed_at=now(), status_code=n.status_code,
     error_code=case when n.timed_out then 'HTTP_TIMEOUT' when n.error_msg is not null then 'HTTP_TRANSPORT_ERROR' when n.status_code>=400 then 'HTTP_'||n.status_code else null end,
     result=case when n.headers->>'content-type' like '%application/json%' and n.content is json then n.content::jsonb else null end
 from net._http_response n where n.id=r.request_id and r.completed_at is null;
 update boltech_ops.http_receipts set completed_at=now(),error_code='HTTP_RESPONSE_MISSING'
 where completed_at is null and requested_at < now()-interval '5 minutes';
 delete from boltech_ops.http_receipts where requested_at < now()-interval '14 days';
$$;
revoke all on function boltech_ops.collect_receipts() from public,anon,authenticated;

create or replace function boltech_ops.invoke(route_name text) returns bigint
language plpgsql security invoker set search_path = '' as $$
declare endpoint text; credential text; rid bigint;
begin
 if not pg_try_advisory_xact_lock(hashtext('boltech-scheduler:'||route_name)) then return null; end if;
 perform boltech_ops.collect_receipts();
 if exists(select 1 from boltech_ops.http_receipts where route=route_name and completed_at is null) then return null; end if;
 endpoint=case route_name when 'research' then 'agent1-continuous-cycle' when 'inbox' then 'agent1-autonomous-inbox' when 'explee' then 'explee-hot-leads-sync' end;
 if endpoint is null then raise exception 'SCHEDULER_ROUTE_NOT_ALLOWED'; end if;
 select decrypted_secret into credential from vault.decrypted_secrets where name='boltech_scheduler_secret';
 if credential is null or length(credential)<32 then raise exception 'SCHEDULER_CREDENTIAL_MISSING'; end if;
 select net.http_post(url:='https://boltech-group.vercel.app/api/'||endpoint,
  headers:=jsonb_build_object('Authorization','Bearer '||credential,'Content-Type','application/json'),
  body:='{}'::jsonb, timeout_milliseconds:=180000) into rid;
 insert into boltech_ops.http_receipts(request_id,route) values(rid,route_name);
 return rid;
end;
$$;
revoke all on function boltech_ops.invoke(text) from public,anon,authenticated;

-- ACTIVATION: execute only after the production revision accepts the Vault key.
-- select cron.schedule('boltech-research','3-59/10 * * * *',$$select boltech_ops.invoke('research');$$);
-- select cron.schedule('boltech-inbox','8-59/10 * * * *',$$select boltech_ops.invoke('inbox');$$);
-- select cron.schedule('boltech-explee','6-59/10 * * * *',$$select boltech_ops.invoke('explee');$$);
-- select cron.schedule('boltech-receipts','* * * * *',$$select boltech_ops.collect_receipts();$$);
