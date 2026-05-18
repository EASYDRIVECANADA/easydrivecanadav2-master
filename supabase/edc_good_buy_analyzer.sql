create table if not exists public.edc_good_buy_uploads (
  id uuid primary key default gen_random_uuid(),
  user_id text,
  email text,
  filename text not null,
  region text default 'ON',
  status text not null default 'parsed',
  settings_snapshot jsonb not null default '{}'::jsonb,
  summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.edc_good_buy_rows (
  id uuid primary key default gen_random_uuid(),
  upload_id uuid not null references public.edc_good_buy_uploads(id) on delete cascade,
  source_row integer,
  stock_number text,
  vin text,
  year integer,
  make text,
  model text,
  trim text,
  mileage integer,
  listed_price numeric,
  decoded jsonb not null default '{}'::jsonb,
  market_stats jsonb not null default '{}'::jsonb,
  validation_flags jsonb not null default '[]'::jsonb,
  risk_flags jsonb not null default '[]'::jsonb,
  reasons jsonb not null default '[]'::jsonb,
  score integer,
  recommendation text default 'Needs Manual Review',
  suggested_max_purchase_price numeric,
  estimated_resale_value numeric,
  projected_profit numeric,
  projected_margin_percent numeric,
  factor_scores jsonb not null default '{}'::jsonb,
  raw jsonb not null default '{}'::jsonb,
  imported_vehicle_id text,
  imported_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.edc_good_buy_market_comps (
  id uuid primary key default gen_random_uuid(),
  upload_id uuid not null references public.edc_good_buy_uploads(id) on delete cascade,
  row_id uuid references public.edc_good_buy_rows(id) on delete cascade,
  source text not null default 'manual',
  url text,
  title text,
  price numeric,
  mileage integer,
  region text,
  confidence text default 'manual',
  captured_at timestamptz not null default now()
);

create table if not exists public.edc_good_buy_settings (
  id uuid primary key default gen_random_uuid(),
  user_id text,
  region text not null default 'ON',
  minimum_profit_margin numeric not null default 2500,
  maximum_mileage integer not null default 180000,
  preferred_makes jsonb not null default '[]'::jsonb,
  excluded_makes jsonb not null default '[]'::jsonb,
  scoring_weights jsonb not null default '{"priceBelowMarket":30,"mileageCondition":20,"margin":20,"demand":15,"vehicleAge":10,"riskFlags":5}'::jsonb,
  source_toggles jsonb not null default '{"manual":true,"autotrader":false,"cargurus":false,"cars":false,"dealerSites":false,"facebookManual":true}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists edc_good_buy_rows_upload_id_idx on public.edc_good_buy_rows(upload_id);
create index if not exists edc_good_buy_market_comps_upload_id_idx on public.edc_good_buy_market_comps(upload_id);
create index if not exists edc_good_buy_market_comps_row_id_idx on public.edc_good_buy_market_comps(row_id);
create index if not exists edc_good_buy_uploads_user_id_idx on public.edc_good_buy_uploads(user_id);

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.edc_good_buy_uploads to anon, authenticated;
grant select, insert, update, delete on public.edc_good_buy_rows to anon, authenticated;
grant select, insert, update, delete on public.edc_good_buy_market_comps to anon, authenticated;
grant select, insert, update, delete on public.edc_good_buy_settings to anon, authenticated;

alter table public.edc_good_buy_uploads enable row level security;
alter table public.edc_good_buy_rows enable row level security;
alter table public.edc_good_buy_market_comps enable row level security;
alter table public.edc_good_buy_settings enable row level security;

drop policy if exists "edc_good_buy_uploads_admin_api_access" on public.edc_good_buy_uploads;
create policy "edc_good_buy_uploads_admin_api_access"
  on public.edc_good_buy_uploads
  for all
  to anon, authenticated
  using (true)
  with check (true);

drop policy if exists "edc_good_buy_rows_admin_api_access" on public.edc_good_buy_rows;
create policy "edc_good_buy_rows_admin_api_access"
  on public.edc_good_buy_rows
  for all
  to anon, authenticated
  using (true)
  with check (true);

drop policy if exists "edc_good_buy_market_comps_admin_api_access" on public.edc_good_buy_market_comps;
create policy "edc_good_buy_market_comps_admin_api_access"
  on public.edc_good_buy_market_comps
  for all
  to anon, authenticated
  using (true)
  with check (true);

drop policy if exists "edc_good_buy_settings_admin_api_access" on public.edc_good_buy_settings;
create policy "edc_good_buy_settings_admin_api_access"
  on public.edc_good_buy_settings
  for all
  to anon, authenticated
  using (true)
  with check (true);
