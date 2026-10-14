-- ASMAS A4/RSI persistent tables snapshot (deployed 2026-10-14).
create table if not exists asmas.director_decisions(
 decision_id uuid primary key default gen_random_uuid(),run_id uuid not null,
 director text not null default 'A4' check(director='A4'),
 target_agent text not null check(target_agent in ('A1','A2','A3')),
 depends_on text not null,idempotency_key text not null unique,
 status text not null check(status in ('PLANNED','ASSIGNED','ALREADY_ASSIGNED')),
 payload jsonb not null,created_at timestamptz not null default now(),
 constraint director_synthetic_only check(payload->>'is_synthetic'='true' and payload->>'external_actions_allowed'='false')
);
create index if not exists director_decisions_run on asmas.director_decisions(run_id);
create table if not exists asmas.director_incidents(
 incident_id uuid primary key default gen_random_uuid(),run_id uuid not null,task_id uuid not null,
 agent text not null,reason text not null,
 status text not null default 'NEEDS_REVIEW' check(status in ('NEEDS_REVIEW','RESOLVED')),
 retry_authorized boolean not null default false,
 diagnostic jsonb not null default '{}'::jsonb,
 first_seen_at timestamptz not null default now(),last_seen_at timestamptz not null default now(),
 classification text,retry_decision text,unique(task_id,reason)
);
alter table asmas.director_decisions enable row level security;
alter table asmas.director_incidents enable row level security;
revoke all on asmas.director_decisions,asmas.director_incidents from public,anon,authenticated;
