-- Boltech only. Apply after staging review; never share with other projects.
create table if not exists public.agent_tenant_memberships (
 id uuid primary key default gen_random_uuid(),
 auth_user_id uuid not null references auth.users(id) on delete cascade,
 order_id text not null,
 tenant_id text not null,
 customer_id text not null,
 status text not null default 'active' check (status in ('active','revoked')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique (auth_user_id,order_id,tenant_id)
);
create index if not exists idx_agent_tenant_memberships_scope
  on public.agent_tenant_memberships (order_id,tenant_id,auth_user_id);
alter table public.agent_tenant_memberships enable row level security;
revoke all on public.agent_tenant_memberships from anon;
revoke insert,update,delete on public.agent_tenant_memberships from authenticated;
grant select on public.agent_tenant_memberships to authenticated;
create policy "members may view only their memberships"
 on public.agent_tenant_memberships for select to authenticated
 using (auth_user_id = (select auth.uid()));
