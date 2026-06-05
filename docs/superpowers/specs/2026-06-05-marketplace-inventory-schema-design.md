# Marketplace Inventory Schema Design

## Goal

Upgrade Dealer Select inventory from compatibility-mode scraped rows into a proper marketplace data model that stores source metadata, images, and sync health without packing those details into `notes`.

## Current Context

DriveTown Ottawa has already been created as a dealership account and synced into `edc_vehicles` with 148 Dealer Select rows. The current deployed `edc_vehicles` table supports editable admin inventory, but it does not have `images` or `source_*` columns. The sync worker therefore stores `source_url` and `source_vehicle_id` inside `notes` and drops scraped image URLs at write time.

The admin and public inventory surfaces already read `edc_vehicles`, so Dealer Select vehicles must remain normal `edc_vehicles` rows. The marketplace upgrade should improve schema and sync tracking without moving vehicles into a separate read-only feed table.

## Recommended Model

Use a hybrid model:

1. `edc_vehicles` remains the editable vehicle record.
2. Marketplace display/search fields live directly on `edc_vehicles`.
3. Dealer source configuration and sync health live in dedicated source/run tables.

This keeps vehicle editing simple while making feed operations reliable and observable.

## `edc_vehicles` Additions

Add these nullable/backward-compatible columns:

```sql
alter table public.edc_vehicles
  add column if not exists images text[] not null default '{}',
  add column if not exists marketplace_source text,
  add column if not exists marketplace_source_url text,
  add column if not exists marketplace_source_vehicle_id text,
  add column if not exists marketplace_last_seen_at timestamptz,
  add column if not exists marketplace_last_synced_at timestamptz,
  add column if not exists marketplace_sync_status text not null default 'active',
  add column if not exists marketplace_original_vin text,
  add column if not exists marketplace_original_stock_number text;
```

Column meaning:

- `images`: scraped or uploaded image URLs used by public cards/detail pages.
- `marketplace_source`: human-readable source name, such as `DriveTown Ottawa`.
- `marketplace_source_url`: canonical source listing URL.
- `marketplace_source_vehicle_id`: upstream inventory id.
- `marketplace_last_seen_at`: last time the scraper saw this vehicle in the source inventory.
- `marketplace_last_synced_at`: last time the sync worker wrote or intentionally preserved this row.
- `marketplace_sync_status`: `active`, `missing`, `sold`, `error`, or `manual`.
- `marketplace_original_vin`: VIN as published by the source before any compatibility fallback.
- `marketplace_original_stock_number`: stock number as published by the source before any compatibility fallback.

Add indexes:

```sql
create index if not exists edc_vehicles_marketplace_source_idx
  on public.edc_vehicles (marketplace_source);

create unique index if not exists edc_vehicles_marketplace_source_url_idx
  on public.edc_vehicles (marketplace_source_url)
  where marketplace_source_url is not null;

create index if not exists edc_vehicles_marketplace_source_vehicle_id_idx
  on public.edc_vehicles (marketplace_source, marketplace_source_vehicle_id)
  where marketplace_source_vehicle_id is not null;
```

## Source Configuration Table

Create `dealer_inventory_sources`:

```sql
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
```

For DriveTown:

- `user_id`: DriveTown account user id
- `source_name`: `DriveTown Ottawa`
- `website_url`: `https://drivetownottawa.com/`
- `inventory_url`: `https://drivetownottawa.com/vehicles/`
- `source_type`: `dealer_site`
- `enabled`: `true`

## Sync Runs Table

Create `dealer_inventory_sync_runs`:

```sql
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
```

Each worker run creates one row. On success it sets `status = 'success'`; on partial data issues it sets `status = 'partial'`; on fatal failure it sets `status = 'failed'`.

## DriveTown Backfill

Backfill existing DriveTown rows after adding the new columns and source table.

Rules:

- Find DriveTown rows by `user_id`, `categories = 'dealer_select'`, and `notes` containing `Imported from DriveTown Ottawa feed`.
- Parse `source_url=...` and `source_vehicle_id=...` from `notes`.
- Set:
  - `marketplace_source = 'DriveTown Ottawa'`
  - `marketplace_source_url = parsed source_url`
  - `marketplace_source_vehicle_id = parsed source_vehicle_id`
  - `marketplace_last_seen_at = updated_at`
  - `marketplace_last_synced_at = updated_at`
  - `marketplace_sync_status = 'active'`
  - `marketplace_original_vin = vin`
  - `marketplace_original_stock_number = stock_number`
- Re-run the DriveTown scraper once after migration to populate `images` and refresh original VIN/stock values from the scraped source data.

After backfill, `notes` should remain intact for audit history. New sync runs should stop appending source metadata into `notes`.

## Sync Worker Changes

Update `scripts/sync-drivetown.js` and sync helpers to prefer the marketplace schema:

- Detect new columns and write them directly.
- Match existing rows by `marketplace_source_url` first.
- Fall back to legacy `notes` parsing only for old rows that have not been backfilled.
- Store scraped image URLs in `images`.
- Store scraped VIN in `marketplace_original_vin`.
- Store scraped stock number in `marketplace_original_stock_number`.
- Continue using compatibility `vin` and `stock_number` fallbacks when the source has duplicates or blanks, because current deployed constraints are global.
- Create/update the DriveTown `dealer_inventory_sources` row.
- Create a `dealer_inventory_sync_runs` row for each run and update it with final counts/errors.
- Update `dealer_inventory_sources.last_run_at`, `last_run_status`, `last_run_counts`, and `last_error`.

## VIN And Stock Constraints

Do not remove current global unique VIN or stock constraints in this phase.

Reason: several app areas still query vehicles, purchases, costs, disclosures, reports, and documents by `vin` or `stock_number`. Changing uniqueness to `(user_id, vin)` or `(user_id, stock_number)` may affect more workflows than the marketplace sync alone.

Instead:

- Keep compatibility values in `vin` and `stock_number`.
- Store the real scraped values in `marketplace_original_vin` and `marketplace_original_stock_number`.
- Later, audit all VIN/stock lookups and migrate to scoped uniqueness as a separate project.

## Public And Admin Display

Admin/dealer editing remains unchanged because rows stay in `edc_vehicles`.

Public vehicle cards and detail pages should use `images` when present. Dealer Select labels can continue to come from `categories = 'dealer_select'`, but detail pages can display marketplace source context from `marketplace_source` and `marketplace_source_url`.

## Error Handling

If the marketplace columns are missing, the worker should fail fast after migration is expected. Compatibility stripping remains acceptable only until the migration is applied.

If source table writes fail, the worker should not write vehicle rows because sync history would become unreliable.

If sync run logging fails after vehicle writes succeed, the worker should report a fatal operational error so Kamatera logs make the issue visible.

## Testing

Add tests for:

- SQL migration file contains required columns and indexes.
- Backfill parser extracts `source_url` and `source_vehicle_id` from legacy notes.
- Vehicle row mapping writes `images` and marketplace metadata.
- Matching prefers `marketplace_source_url` over VIN and stock.
- Sync run summary rows are built with success, partial, and failed statuses.
- Worker no longer strips `images` when marketplace schema columns exist.

## Future Work

After this schema is stable, create an admin "Dealer Feeds" screen to show each source, last run status, counts, and failed URLs. A separate follow-up project should audit VIN/stock usage and migrate uniqueness to dealer-scoped constraints.
