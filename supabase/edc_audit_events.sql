create table if not exists public.edc_audit_events (
  id uuid primary key default gen_random_uuid(),
  module text not null,
  action text not null,
  summary text not null,
  actor_name text,
  actor_email text,
  record_type text,
  record_id text,
  ip_address text,
  user_agent text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.edc_audit_events
  add column if not exists module text,
  add column if not exists action text,
  add column if not exists summary text,
  add column if not exists actor_name text,
  add column if not exists actor_email text,
  add column if not exists record_type text,
  add column if not exists record_id text,
  add column if not exists ip_address text,
  add column if not exists user_agent text,
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists created_at timestamptz not null default now();

create index if not exists edc_audit_events_created_idx
  on public.edc_audit_events (created_at desc);

create index if not exists edc_audit_events_module_created_idx
  on public.edc_audit_events (module, created_at desc);

create index if not exists edc_audit_events_actor_created_idx
  on public.edc_audit_events (actor_email, created_at desc);

create index if not exists edc_audit_events_record_idx
  on public.edc_audit_events (record_type, record_id);

grant usage on schema public to anon, authenticated;

alter table public.edc_audit_events enable row level security;

drop policy if exists "edc_audit_events_no_direct_anon_access" on public.edc_audit_events;
create policy "edc_audit_events_no_direct_anon_access"
  on public.edc_audit_events
  for all
  to anon, authenticated
  using (false)
  with check (false);
