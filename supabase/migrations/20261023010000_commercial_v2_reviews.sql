-- V2 current verification receipts. One persisted decision per lead, no growth per retry.
create table if not exists public.commercial_v2_reviews (
 lead_id uuid primary key references public.leads(id) on delete restrict,
 recipient_email text not null,
 decision text not null check (decision in ('CLEAR','BLOCKED','REVIEW_REQUIRED')),
 reason text not null,
 checked_at timestamptz not null,
 evidence jsonb not null default '{}'::jsonb,
 updated_at timestamptz not null default now()
);
create index if not exists commercial_v2_reviews_pending_idx
 on public.commercial_v2_reviews(decision,checked_at);
alter table public.commercial_v2_reviews enable row level security;
revoke all on public.commercial_v2_reviews from anon, authenticated;
grant select, insert, update on public.commercial_v2_reviews to service_role;
