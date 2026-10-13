-- ASMAS ONLY. Run solely on a dedicated ASMAS Supabase project.
create schema if not exists asmas;
create table if not exists asmas.opportunities(
 id text primary key, lead_id text not null, stage text not null default 'NEW_LEAD',
 owner text not null default 'A1', version bigint not null default 0,
 is_synthetic boolean not null default false,
 quote_amount numeric(12,2), currency text default 'USD', updated_at timestamptz not null default now()
);
create table if not exists asmas.tasks(
 id uuid primary key default gen_random_uuid(), case_id text not null,
 agent text not null check(agent in ('A1','A2','A3','A4','A5')),
 action text not null, status text not null default 'QUEUED',
 idempotency_key text unique not null, payload jsonb not null default '{}'::jsonb,
 attempts integer not null default 0, lease_until timestamptz, created_at timestamptz not null default now()
);
create table if not exists asmas.outbox(
 id uuid primary key default gen_random_uuid(), message_id uuid unique not null default gen_random_uuid(),
 topic text not null, payload jsonb not null, published_at timestamptz, created_at timestamptz not null default now()
);
create table if not exists asmas.activities(
 id uuid primary key default gen_random_uuid(), task_id uuid references asmas.tasks(id),
 case_id text not null, agent text not null, action text not null, result text not null,
 synthetic boolean not null default false, created_at timestamptz not null default now()
);
create index if not exists asmas_tasks_pending_idx on asmas.tasks(status,lease_until);
create index if not exists asmas_outbox_pending_idx on asmas.outbox(created_at) where published_at is null;
-- Private schema; no public Data API role access.
revoke all on schema asmas from anon, authenticated, public;
revoke all on all tables in schema asmas from anon, authenticated, public;
alter table asmas.opportunities enable row level security;
alter table asmas.tasks enable row level security;
alter table asmas.outbox enable row level security;
alter table asmas.activities enable row level security;
