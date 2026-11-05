-- Migration: leads table for the commercial plan (Boltech Group)
-- Destination: private Supabase project (encargado: solo Ricardo).
-- Retention: see docs/CONSERVACION-DATOS.md (30 days if no reply, then delete).

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  email text not null,
  company text,
  job_title text,
  contact_name text,
  pain_point text,
  asset_id text,
  language text default 'es',
  page_url text,
  source text default 'web_solicitud',
  consent_granted boolean not null default false,
  consent_text text,
  consent_at timestamptz,
  planned_deletion_at timestamptz not null default (now() + interval '30 days'),
  deleted_at timestamptz,
  deletion_reason text
);

create index if not exists leads_email_idx on public.leads (email);
create index if not exists leads_created_at_idx on public.leads (created_at);
create index if not exists leads_planned_deletion_idx on public.leads (planned_deletion_at);

-- RLS: only service role can read/write (no anon access).
alter table public.leads enable row level security;
-- No policies for anon/authenticated: only service_role (bypasses RLS) accesses.
