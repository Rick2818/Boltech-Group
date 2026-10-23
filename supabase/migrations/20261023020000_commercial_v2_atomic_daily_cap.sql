-- Atomic send cap for V2 reservations, rolling 24 hours.
create or replace function public.commercial_v2_reserve(
 p_key text,p_sender text,p_recipient text,p_campaign text,p_purpose text)
returns jsonb language plpgsql security invoker set search_path=public
as $$
declare r public.commercial_v2_dispatch%rowtype; newly_created boolean; sender text;
begin
 if p_key is null or length(p_key)<>64 or p_sender is null or p_recipient is null or p_campaign is null
 then raise exception 'INVALID_RESERVATION'; end if;
 sender:=lower(trim(p_sender));
 perform pg_advisory_xact_lock(hashtext(sender),23023);
 select * into r from public.commercial_v2_dispatch where dispatch_key=p_key;
 if found then return jsonb_build_object('created',false,'status',r.status);end if;
 if (select count(*) from public.commercial_v2_dispatch
     where sender_email=sender and created_at>=now()-interval '24 hours'
       and status in('RESERVED','SENDING','SEND_UNKNOWN','SENT'))>=5
 then return '{"created":false,"status":"DAILY_CAP_REACHED"}'::jsonb;end if;
 insert into public.commercial_v2_dispatch(dispatch_key,sender_email,recipient_email,campaign_id,purpose)
 values (p_key,sender,lower(trim(p_recipient)),p_campaign,coalesce(p_purpose,'INITIAL'))
 on conflict(dispatch_key) do nothing;
 newly_created:=found;
 select * into strict r from public.commercial_v2_dispatch where dispatch_key=p_key;
 return jsonb_build_object('created',newly_created,'status',r.status);
end $$;
revoke all on function public.commercial_v2_reserve(text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.commercial_v2_reserve(text,text,text,text,text) to service_role;
