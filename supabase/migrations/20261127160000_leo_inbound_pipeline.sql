-- Additive: existing leads/opportunities and retired workflows are unchanged.
alter table public.crm_leads add column if not exists leo_record jsonb;
alter table public.crm_leads add column if not exists leo_version integer not null default 0;

create or replace function public.save_leo_inquiry(p_record jsonb,p_expected_version integer,p_event_key text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
 v_id uuid := (p_record->>'id')::uuid;
 v_existing public.crm_leads%rowtype;
 v_approval uuid;
begin
 if p_expected_version is null or p_expected_version < 0 or v_id is null or (p_record->>'version')::integer is distinct from p_expected_version+1
  or (p_record->>'source') is distinct from 'LEO_INBOUND_V1' or length(p_event_key)>200
  or p_event_key is null or length(p_event_key)<10 or pg_column_size(p_record)>100000 then
  raise exception 'INVALID_INQUIRY';
 end if;
 -- Serialize both first inserts and updates; retrying the same event never creates a second record.
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_id::text,0));
 select * into v_existing from public.crm_leads where id=v_id for update;
 if exists(select 1 from public.crm_events where idempotency_key=p_event_key and entity_id=v_id) then
  return v_existing.leo_record;
 end if;
 if (v_existing.id is null and p_expected_version<>0) or
    (v_existing.id is not null and (v_existing.source<>'LEO_INBOUND_V1' or v_existing.leo_version<>p_expected_version)) then
  raise exception 'STALE_VERSION';
 end if;
 if v_existing.id is null then
  insert into public.crm_leads(id,company,contact,source,source_id,need,status,owner,consent_record,leo_record,leo_version)
  values(v_id,coalesce(p_record->>'company',''),nullif(p_record->>'contact',''),'LEO_INBOUND_V1',v_id::text,
   p_record->>'need',p_record->>'status','LEO',p_record->'consent',p_record,p_expected_version+1);
 else
  update public.crm_leads set company=coalesce(p_record->>'company',''),contact=nullif(p_record->>'contact',''),
   need=p_record->>'need',status=p_record->>'status',consent_record=p_record->'consent',
   leo_record=p_record,leo_version=p_expected_version+1,updated_at=now() where id=v_id;
 end if;
 -- Only qualified inquiries become opportunities. No historical lead is enrolled.
 if p_record#>>'{qualification,status}'='READY_FOR_REVIEW' then
  insert into public.crm_opportunities(id,lead_id,platform,state,evidence)
  values(v_id,v_id,'LEO_WEB',p_record->>'status',jsonb_build_object('inquiryId',v_id,'paymentVerified',false))
  on conflict(id) do update set state=excluded.state,updated_at=now();
 end if;
 if exists(select 1 from public.crm_opportunities where id=v_id and platform='LEO_WEB') then
  update public.crm_approvals set status='REVOKED' where scope='leo:'||v_id::text and status='APPROVED';
  if jsonb_typeof(p_record->'approval')='object' then
   v_approval:=(p_record#>>'{approval,id}')::uuid;
   insert into public.crm_approvals(id,scope,approved_by,status,evidence)
   values(v_approval,'leo:'||v_id::text,'LEO_AUTHENTICATED_OWNER','APPROVED',p_record->'approval')
   on conflict(id) do update set status='APPROVED',evidence=excluded.evidence;
  end if;
  insert into public.crm_proposals(id,opportunity_id,status,scope,quote,approval_id)
  values(v_id,v_id,p_record#>>'{proposal,status}',p_record->'proposal',
   jsonb_build_object('amountCents',p_record#>'{proposal,amountCents}','currency','USD','revision',p_record#>'{proposal,revision}'),v_approval)
  on conflict(id) do update set status=excluded.status,scope=excluded.scope,quote=excluded.quote,approval_id=excluded.approval_id;
  -- Rebuild only internal follow-up projections belonging to this aggregate; never claim dispatch.
  insert into public.crm_followups(id,opportunity_id,scheduled_at,status,idempotency_key,stop_reason)
  select (f->>'id')::uuid,v_id,(f->>'scheduledAt')::timestamptz,f->>'status','leo:'||(f->>'id'),f->>'stopReason'
  from jsonb_array_elements(coalesce(p_record->'followups','[]'::jsonb)) f
  on conflict(id) do update set status=excluded.status,stop_reason=excluded.stop_reason;
 end if;
 insert into public.crm_events(event_type,entity_type,entity_id,idempotency_key,payload)
 values('LEO_INQUIRY_SAVED','crm_leads',v_id,p_event_key,
  jsonb_build_object('version',p_expected_version+1,'record',p_record,'externalMessagesSent',0));
 return p_record;
end $$;

-- This scheduled step only raises owner-panel reminders. It cannot send anything.
create or replace function public.tick_leo_followups()
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v_count integer;
begin
 update public.crm_followups f set status='REVIEW_DUE'
 from public.crm_leads l
 where f.opportunity_id=l.id and l.source='LEO_INBOUND_V1' and f.status='PREPARED' and f.scheduled_at<=now()
  and l.leo_record#>>'{proposal,status}'='OWNER_APPROVED'
  and coalesce(l.leo_record#>>'{consent,withdrawn}','false')<>'true'
  and l.leo_record->'closure'='null'::jsonb
  and coalesce(l.leo_record->>'customerResponsePendingReview','false')<>'true';
 get diagnostics v_count=row_count;
 insert into public.crm_events(event_type,entity_type,idempotency_key,payload)
 values('LEO_PIPELINE_TICK','scheduler','leo:tick:'||gen_random_uuid()::text,jsonb_build_object('due',v_count,'externalMessagesSent',0));
 return jsonb_build_object('due',v_count,'externalMessagesSent',0);
end $$;

revoke execute on function public.save_leo_inquiry(jsonb,integer,text) from public,anon,authenticated;
revoke execute on function public.tick_leo_followups() from public,anon,authenticated;
grant execute on function public.save_leo_inquiry(jsonb,integer,text),public.tick_leo_followups() to service_role;
-- Existing job-claim RPC was unintentionally public; workers retain their service-role access.
revoke execute on function public.claim_crm_jobs(text,integer,integer) from public,anon,authenticated;
grant execute on function public.claim_crm_jobs(text,integer,integer) to service_role;
notify pgrst,'reload schema';
