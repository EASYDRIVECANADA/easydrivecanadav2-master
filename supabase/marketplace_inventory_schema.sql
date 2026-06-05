alter table public.edc_vehicles
  add column if not exists images text[] not null default '{}',
  add column if not exists marketplace_source text,
  add column if not exists marketplace_source_url text,
  add column if not exists marketplace_source_vehicle_id text,
  add column if not exists marketplace_last_seen_at timestamptz,
  add column if not exists marketplace_last_synced_at timestamptz,
  add column if not exists marketplace_sync_status text not null default 'active',
  add column if not exists marketplace_original_vin text,
  add column if not exists marketplace_original_stock_number text,
  add column if not exists retail_price numeric,
  add column if not exists finance_price numeric,
  add column if not exists source_price_payload jsonb not null default '{}'::jsonb;

create index if not exists edc_vehicles_marketplace_source_idx
  on public.edc_vehicles (marketplace_source);

create unique index if not exists edc_vehicles_marketplace_source_url_idx
  on public.edc_vehicles (marketplace_source_url)
  where marketplace_source_url is not null;

create index if not exists edc_vehicles_marketplace_source_vehicle_id_idx
  on public.edc_vehicles (marketplace_source, marketplace_source_vehicle_id)
  where marketplace_source_vehicle_id is not null;

create table if not exists public.dealer_inventory_sources (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  source_name text not null,
  website_url text,
  inventory_url text not null,
  source_type text not null default 'dealer_site',
  enabled boolean not null default true,
  schedule_cron text not null default '0 */6 * * *',
  last_run_at timestamptz,
  last_run_status text,
  last_run_counts jsonb not null default '{}'::jsonb,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists dealer_inventory_sources_user_source_name_idx
  on public.dealer_inventory_sources (user_id, source_name);

create index if not exists dealer_inventory_sources_user_enabled_idx
  on public.dealer_inventory_sources (user_id, enabled);

create table if not exists public.dealer_inventory_sync_runs (
  id uuid primary key default gen_random_uuid(),
  source_id uuid references public.dealer_inventory_sources(id) on delete cascade,
  user_id text not null,
  source_name text not null,
  dry_run boolean not null default false,
  started_at timestamptz not null,
  finished_at timestamptz,
  status text not null default 'running',
  counts jsonb not null default '{}'::jsonb,
  errors jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists dealer_inventory_sync_runs_source_started_idx
  on public.dealer_inventory_sync_runs (source_id, started_at desc);
