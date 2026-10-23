-- Commercial V2 outbox. Isolated from legacy sender; no Wompi changes.
create table if not exists public.commercial_v2_dispatch (
 dispatch_key text primary key,
 sender_email text not null,
 recipient_email text not null,
 campaign_id text not null,
 purpose text not null,
 status text not null default 'RESERVED'
   check (status in ('RESERVED','SENDING','SEND_UNKNOWN','SENT')),
 provider_message_id text,
 provider_thread_id text,
 failure_code text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table public.commercial_v2_dispatch enable row level security;
revoke all on public.commercial_v2_dispatch from anon, authenticated;
create or replace function public.commercial_v2_reserve(
 p_key text, p_sender text, p_recipient text, p_campaign text, p_purpose text)
returns jsonb language plpgsql security definer
set search_path = public
as $$
declare r public.commercial_v2_dispatch%rowtype; newly_created boolean;
begin
 if p_key is null or length(p_key)<>64 or p_sender is null or p_recipient is null or p_campaign is null
 then raise exception 'INVALID_RESERVATION'; end if;
 insert into public.commercial_v2_dispatch(dispatch_key,sender_email,recipient_email,campaign_id,purpose)
 values (p_key,lower(trim(p_sender)),lower(trim(p_recipient)),p_campaign,coalesce(p_purpose,'INITIAL'))
 on conflict (dispatch_key) do nothing;
 newly_created := found;
 select * into strict r from public.commercial_v2_dispatch where dispatch_key=p_key;
 return jsonb_build_object('created',newly_created,'status',r.status);
end $$;
create or replace function public.commercial_v2_transition(
 p_key text, p_expected text, p_status text, p_message_id text default null,
 p_thread_id text default null, p_failure_code text default null)
returns boolean language plpgsql security definer
set search_path = public
as $$
declare transitions_ok boolean;
begin
 transitions_ok := (p_expected='RESERVED' and p_status='SENDING')
   or (p_expected='SENDING' and p_status in ('SEND_UNKNOWN','SENT'))
   or (p_expected='SEND_UNKNOWN' and p_status='SENT');
 if not transitions_ok then return false; end if;
 if p_status='SENT' and (nullif(p_message_id,'') is null or nullif(p_thread_id,'') is null)
 then return false; end if;
 update public.commercial_v2_dispatch
 set status=p_status,provider_message_id=case when p_status='SENT' then p_message_id else provider_message_id end,
 provider_thread_id=case when p_status='SENT' then p_thread_id else provider_thread_id end,
 failure_code=p_failure_code,updated_at=now()
 where dispatch_key=p_key and status=p_expected;
 return found;
end $$;
revoke all on function public.commercial_v2_reserve(text,text,text,text,text) from public, anon, authenticated;
revoke all on function public.commercial_v2_transition(text,text,text,text,text,text) from public, anon, authenticated;
grant execute on function public.commercial_v2_reserve(text,text,text,text,text) to service_role;
grant execute on function public.commercial_v2_transition(text,text,text,text,text,text) to service_role;
