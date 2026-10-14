begin;
do $$
declare rid uuid:=gen_random_uuid(); t jsonb; old_token uuid; result jsonb; n integer;
begin
 perform asmas.simple_start(rid);perform asmas.simple_start(rid);
 select count(*) into n from asmas.tasks where payload->>'run_id'=rid::text;
 if n<>1 then raise exception 'DUPLICATE_START';end if;
 t:=asmas.simple_claim_one();old_token:=(t->>'lease_token')::uuid;
 update asmas.tasks set lease_until=now()-interval '1 second' where id=(t->>'id')::uuid;
 t:=asmas.simple_claim_one();
 result:=jsonb_build_object('agent',t->>'agent','model','gemini-2.5-flash','text','DB CONTRACT TEST ONLY','provider_verified',true);
 if asmas.simple_finish((t->>'id')::uuid,old_token,result) then raise exception 'STALE_LEASE_ACCEPTED';end if;
 if not asmas.simple_finish((t->>'id')::uuid,(t->>'lease_token')::uuid,result) then raise exception 'COMMIT_FAILED';end if;
 if asmas.simple_finish((t->>'id')::uuid,(t->>'lease_token')::uuid,result) then raise exception 'DUPLICATE_COMMIT';end if;
 for i in 1..4 loop
  t:=asmas.simple_claim_one();if t is null then raise exception 'HANDOFF_MISSING';end if;
  result:=jsonb_build_object('agent',t->>'agent','model','gemini-2.5-flash','text','DB CONTRACT TEST ONLY','provider_verified',true);
  if not asmas.simple_finish((t->>'id')::uuid,(t->>'lease_token')::uuid,result) then raise exception 'HANDOFF_COMMIT_FAILED';end if;
 end loop;
 select count(distinct agent) into n from asmas.tasks where payload->>'run_id'=rid::text and status='SUCCEEDED';
 if n<>5 then raise exception 'MISSING_AGENT';end if;
 select count(*) into n from asmas.outbox where payload->>'run_id'=rid::text;
 if n<>4 then raise exception 'MISSING_OUTBOX';end if;
 if not exists(select 1 from asmas.synthetic_runs where run_id=rid and status='COMPLETED') then raise exception 'RUN_INCOMPLETE';end if;
 if has_function_privilege('anon','asmas.simple_claim_one()','EXECUTE') then raise exception 'PUBLIC_ACCESS';end if;
end$$;
select 'PASS: five-role database handoff, idempotency, stale lease rejection, private functions; results rolled back' as verification;
rollback;