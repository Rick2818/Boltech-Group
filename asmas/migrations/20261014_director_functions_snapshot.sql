-- Snapshot from ASMAS deployed functions, 2026-10-14
-- Assumes base ASMAS schema and tables already exist.
CREATE OR REPLACE FUNCTION asmas.director_assign(p_run uuid, p_target text)
 RETURNS text
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare predecessor text; origin asmas.tasks%rowtype; idem text; previously_assigned boolean;
begin
 if p_target not in ('A1','A2','A3') then raise exception 'DIRECTOR_TARGET_INVALID'; end if;
 predecessor := case p_target when 'A1' then 'A5' when 'A2' then 'A1' when 'A3' then 'A2' end;
 select * into origin from asmas.tasks where payload->>'run_id'=p_run::text and agent=predecessor
 and case_id='SYN-E2E-001' and status='SUCCEEDED'
 and result->>'provider_verified'='true' and result->>'model'='gemini-3.5-flash-lite'
 order by created_at desc limit 1;
 if not found then raise exception 'DIRECTOR_PREREQUISITE_UNVERIFIED'; end if;
 idem:=p_run::text||':'||p_target;
 select exists(select 1 from asmas.tasks where idempotency_key=idem) into previously_assigned;
 insert into asmas.tasks(case_id,agent,action,idempotency_key,payload)
 values ('SYN-E2E-001',p_target,'SYNTHETIC_ANALYSIS',idem,
 origin.payload||jsonb_build_object('director_mode',true,'previous_agent',predecessor,'previous_output',origin.result->>'text',
 'orchestration',jsonb_build_object('schema_version','asmas.director.v1','director','A4',
 'destination_agent',p_target,'depends_on',predecessor,'is_synthetic',true,
 'external_actions_allowed',false,'instructions','Execute your assigned synthetic role only')))
 on conflict(idempotency_key) do nothing;
 insert into asmas.director_decisions(run_id,director,target_agent,depends_on,idempotency_key,status,payload)
 values (p_run,'A4',p_target,predecessor,idem,
 case when previously_assigned then 'ALREADY_ASSIGNED' else 'ASSIGNED' end,
 jsonb_build_object('is_synthetic',true,'external_actions_allowed',false,'source_task_id',origin.id))
 on conflict(idempotency_key) do nothing;
 if not previously_assigned then
 insert into asmas.messages(correlation_id,task_id,from_agent,to_agent,status,payload) values(p_run::text,origin.id,'A4',p_target,'DIRECTOR_ASSIGNED',jsonb_build_object('director','A4','source_agent',predecessor,'is_synthetic',true));
 insert into asmas.outbox(topic,payload,published_at) values('asmas:director_queue',jsonb_build_object('run_id',p_run,'director','A4','destination_agent',p_target,'is_synthetic',true),now());
 end if;
 return case when previously_assigned then 'ALREADY_ASSIGNED' else 'ASSIGNED' end;
end $function$
;

CREATE OR REPLACE FUNCTION asmas.director_coordinate()
 RETURNS integer
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare current_run record; next_agent text; assigned integer:=0; result text;
begin
 for current_run in
   select distinct r.run_id
   from asmas.synthetic_runs r
   join asmas.tasks t on t.payload->>'run_id'=r.run_id::text
   where r.case_id='SYN-E2E-001' and r.status='STARTED'
   and t.payload->>'director_mode'='true'
   order by r.run_id
   limit 20
 loop
   next_agent:=null;
   if exists(select 1 from asmas.tasks where payload->>'run_id'=current_run.run_id::text and agent='A5' and status='SUCCEEDED') and
      not exists(select 1 from asmas.tasks where payload->>'run_id'=current_run.run_id::text and agent='A1')
   then next_agent:='A1';
   elsif exists(select 1 from asmas.tasks where payload->>'run_id'=current_run.run_id::text and agent='A1' and status='SUCCEEDED') and
      not exists(select 1 from asmas.tasks where payload->>'run_id'=current_run.run_id::text and agent='A2')
   then next_agent:='A2';
   elsif exists(select 1 from asmas.tasks where payload->>'run_id'=current_run.run_id::text and agent='A2' and status='SUCCEEDED') and
      not exists(select 1 from asmas.tasks where payload->>'run_id'=current_run.run_id::text and agent='A3')
   then next_agent:='A3'; end if;
   if next_agent is not null then
     result:=asmas.director_assign(current_run.run_id,next_agent);
     if result='ASSIGNED' then assigned:=assigned+1; end if;
   end if;
 end loop;
 return assigned;
end $function$
;

CREATE OR REPLACE FUNCTION asmas.director_rsi_audit()
 RETURNS integer
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare affected integer;
begin
 insert into asmas.director_incidents(run_id,task_id,agent,reason,diagnostic)
 select (t.payload->>'run_id')::uuid,t.id,t.agent,
 case when t.status='NEEDS_REVIEW' then 'TASK_NEEDS_REVIEW' else 'LEASE_EXPIRED' end,
 jsonb_build_object('task_status',t.status,'attempts',t.attempts,'director_mode',true,'external_actions_allowed',false,'automatic_retry',false)
 from asmas.tasks t
 where t.case_id='SYN-E2E-001' and t.payload->>'director_mode'='true'
 and (t.status='NEEDS_REVIEW' or (t.status='LEASED' and t.lease_until<now()))
 on conflict(task_id,reason) do update set last_seen_at=now();
 get diagnostics affected=row_count;
 return affected;
end $function$
;

CREATE OR REPLACE FUNCTION asmas.director_rsi_classify(p_reason text, p_status text, p_attempts integer, p_lease_expired boolean DEFAULT false)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
 select case
 when p_status='SUCCEEDED' then 'RESOLVED_NO_RETRY'
 when p_reason in ('UNSAFE_TASK','FORBIDDEN','MODEL_NAME_MISMATCH','MODEL_AGENT_MISMATCH','INVALID_MODEL_RESULT','DATABASE_MODEL_RESULT_REJECTED','LEASE_CONFLICT','GEMINI_PROVIDER_HTTP_400','GEMINI_PROVIDER_HTTP_401','GEMINI_PROVIDER_HTTP_403','GEMINI_PROVIDER_HTTP_404') then 'NON_RECOVERABLE_REVIEW'
 when p_status='LEASED' and p_lease_expired then 'UNCERTAIN_OUTCOME_RECONCILE'
 when p_reason in ('MODEL_TIMEOUT','MODEL_EXECUTION_FAILED','GEMINI_PROVIDER_HTTP_503','GEMINI_PROVIDER_HTTP_429','GEMINI_EMPTY_RESPONSE') then 'TRANSIENT_RECONCILE'
 when p_status='NEEDS_REVIEW' then 'UNKNOWN_REVIEW'
 else 'NO_ACTION' end
$function$
;

CREATE OR REPLACE FUNCTION asmas.director_rsi_evaluate()
 RETURNS integer
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare changed integer;
begin
 perform asmas.director_rsi_audit();
 update asmas.director_incidents i
 set classification=asmas.director_rsi_classify(i.reason,t.status,t.attempts,i.reason='LEASE_EXPIRED'),
 retry_decision=asmas.director_rsi_retry_decision(
   asmas.director_rsi_classify(i.reason,t.status,t.attempts,i.reason='LEASE_EXPIRED'),
   true,t.status='SUCCEEDED',false,false,t.attempts),
 retry_authorized=false,last_seen_at=now()
 from asmas.tasks t
 where t.id=i.task_id and t.case_id='SYN-E2E-001' and t.payload->>'director_mode'='true'
 and i.status='NEEDS_REVIEW';
 get diagnostics changed=row_count;
 return changed;
end $function$
;

CREATE OR REPLACE FUNCTION asmas.director_rsi_retry_decision(p_classification text, p_provider_call_started boolean, p_committed_output_exists boolean, p_external_side_effect_possible boolean, p_evidence_complete boolean, p_attempts integer)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
 select case
 when p_committed_output_exists then 'DO_NOT_RETRY_ALREADY_COMPLETED'
 when p_external_side_effect_possible then 'HOLD_RECONCILE_EXTERNAL_EFFECT'
 when not p_evidence_complete then 'HOLD_INSUFFICIENT_EVIDENCE'
 when p_provider_call_started then 'HOLD_PROVIDER_OUTCOME_UNCERTAIN'
 when p_classification='TRANSIENT_RECONCILE' and p_attempts between 1 and 2 then 'ELIGIBLE_FOR_CONTROLLED_RETRY'
 else 'HOLD_MANUAL_REVIEW' end
$function$
;
