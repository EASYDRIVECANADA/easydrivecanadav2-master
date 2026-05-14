create table if not exists public.edc_signature_events (
  id uuid primary key default gen_random_uuid(),
  signature_id text not null,
  deal_id text,
  recipient_id text,
  recipient_index integer,
  user_name text,
  user_email text,
  action text not null,
  activity text,
  status text,
  ip_address text,
  user_agent text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.edc_signature_events
  add column if not exists deal_id text,
  add column if not exists recipient_id text,
  add column if not exists recipient_index integer,
  add column if not exists ip_address text,
  add column if not exists user_agent text,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create index if not exists edc_signature_events_signature_created_idx
  on public.edc_signature_events (signature_id, created_at);

create index if not exists edc_signature_events_deal_created_idx
  on public.edc_signature_events (deal_id, created_at);

create index if not exists edc_signature_events_recipient_idx
  on public.edc_signature_events (recipient_id);
