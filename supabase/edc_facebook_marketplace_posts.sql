create table if not exists public.edc_facebook_marketplace_posts (
  id uuid primary key default gen_random_uuid(),
  vehicle_id text not null,
  user_id text,
  status text not null default 'draft',
  facebook_listing_url text,
  posting_title text,
  posting_description text,
  posting_price numeric,
  posting_location text,
  posting_payload jsonb not null default '{}'::jsonb,
  readiness jsonb not null default '{}'::jsonb,
  notes text,
  posted_at timestamptz,
  last_prepared_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists edc_facebook_marketplace_posts_vehicle_id_idx
  on public.edc_facebook_marketplace_posts (vehicle_id);

create index if not exists edc_facebook_marketplace_posts_status_idx
  on public.edc_facebook_marketplace_posts (status);

create index if not exists edc_facebook_marketplace_posts_user_status_idx
  on public.edc_facebook_marketplace_posts (user_id, status);

create index if not exists edc_facebook_marketplace_posts_last_prepared_idx
  on public.edc_facebook_marketplace_posts (last_prepared_at desc);

comment on table public.edc_facebook_marketplace_posts is
  'Human-in-the-loop Facebook Marketplace posting workflow state for EasyDrive inventory.';

comment on column public.edc_facebook_marketplace_posts.status is
  'Posting status: draft, ready, posted, needs_update, sold_remove, skipped, or failed.';

comment on column public.edc_facebook_marketplace_posts.posting_payload is
  'Generated vehicle listing payload used to prepare Facebook Marketplace copy.';

comment on column public.edc_facebook_marketplace_posts.readiness is
  'Posting readiness details generated from required Facebook Marketplace fields.';
