# Marketplace Inventory Schema Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add proper marketplace inventory columns, source tracking tables, DriveTown backfill, and sync-run logging so Dealer Select vehicles no longer store source metadata in `notes` or drop scraped images.

**Architecture:** Keep editable inventory in `edc_vehicles`, add marketplace display/source columns there, and add `dealer_inventory_sources` plus `dealer_inventory_sync_runs` for feed configuration and history. Update the DriveTown worker to write the new schema directly, while retaining legacy notes parsing only for backfill and transition.

**Tech Stack:** Supabase/Postgres SQL, Node 20+, `node:test`, `@supabase/supabase-js`, existing `scripts/sync-drivetown.js`, existing `client/src/lib/dealerSelectSync.mjs`.

---

## File Structure

- Create `supabase/marketplace_inventory_schema.sql`: Idempotent SQL migration for `edc_vehicles` marketplace columns, indexes, source table, and sync run table.
- Create `scripts/marketplace-schema.test.mjs`: Unit test that verifies the migration contains required columns, tables, and indexes.
- Create `client/src/lib/marketplaceBackfill.mjs`: Pure helpers for parsing legacy source metadata from `notes`, building backfill updates, and building DriveTown source rows.
- Create `client/src/lib/marketplaceBackfill.test.mjs`: Unit tests for legacy notes parsing, backfill row generation, and source row generation.
- Modify `client/src/lib/dealerSelectSync.mjs`: Add marketplace-aware row mapping and matching using `marketplace_*` fields.
- Modify `client/src/lib/dealerSelectSync.test.mjs`: Add tests for images, marketplace metadata, marketplace matching, original VIN/stock preservation.
- Modify `scripts/sync-drivetown.js`: Create/update source row, create sync run rows, write marketplace columns/images directly, backfill legacy matching, and fail if migration columns are unavailable.
- Modify `scripts/sync-drivetown.test.mjs`: Add tests for sync run status helpers and marketplace schema detection behavior.
- Create `scripts/backfill-drivetown-marketplace.js`: One-off backfill worker that updates the 148 existing DriveTown Dealer Select rows and creates the source row.
- Create `docs/marketplace-inventory-schema.md`: Operator notes for applying the SQL migration, running backfill, running the sync, and verifying counts.

---

### Task 1: Schema Migration File

**Files:**
- Create: `supabase/marketplace_inventory_schema.sql`
- Create: `scripts/marketplace-schema.test.mjs`

- [ ] **Step 1: Write failing migration content test**

Create `scripts/marketplace-schema.test.mjs`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const sqlPath = new URL('../supabase/marketplace_inventory_schema.sql', import.meta.url)

test('marketplace schema migration declares required vehicle columns and tables', async () => {
  const sql = await readFile(sqlPath, 'utf8')

  for (const column of [
    'images',
    'marketplace_source',
    'marketplace_source_url',
    'marketplace_source_vehicle_id',
    'marketplace_last_seen_at',
    'marketplace_last_synced_at',
    'marketplace_sync_status',
    'marketplace_original_vin',
    'marketplace_original_stock_number',
  ]) {
    assert.match(sql, new RegExp(`add column if not exists ${column}\\b`, 'i'))
  }

  assert.match(sql, /create table if not exists public\.dealer_inventory_sources/i)
  assert.match(sql, /create table if not exists public\.dealer_inventory_sync_runs/i)
  assert.match(sql, /edc_vehicles_marketplace_source_url_idx/i)
  assert.match(sql, /dealer_inventory_sources_user_source_name_idx/i)
  assert.match(sql, /dealer_inventory_sync_runs_source_started_idx/i)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
node --test scripts/marketplace-schema.test.mjs
```

Expected: FAIL because `supabase/marketplace_inventory_schema.sql` does not exist.

- [ ] **Step 3: Create SQL migration**

Create `supabase/marketplace_inventory_schema.sql`:

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
```

- [ ] **Step 4: Run migration test to verify it passes**

Run:

```powershell
node --test scripts/marketplace-schema.test.mjs
```

Expected: PASS, 1 test.

- [ ] **Step 5: Commit**

Run:

```powershell
git add supabase/marketplace_inventory_schema.sql scripts/marketplace-schema.test.mjs
git commit -m "db: add marketplace inventory schema"
```

Expected: commit succeeds.

---

### Task 2: Backfill Helper

**Files:**
- Create: `client/src/lib/marketplaceBackfill.test.mjs`
- Create: `client/src/lib/marketplaceBackfill.mjs`

- [ ] **Step 1: Write failing backfill helper tests**

Create `client/src/lib/marketplaceBackfill.test.mjs`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildDriveTownSourceRow,
  buildMarketplaceBackfillUpdate,
  parseLegacySourceNotes,
} from './marketplaceBackfill.mjs'

const legacyVehicle = {
  id: 'vehicle-1',
  user_id: 'dealer-user-1',
  vin: '1C6RR7NT1HS840918',
  stock_number: 'A6450',
  updated_at: '2026-06-05T08:16:28.218Z',
  notes: 'Imported from DriveTown Ottawa feed; source_url=https://drivetownottawa.com/inventory/2017-ram-1500/14205830; source_vehicle_id=14205830',
}

test('parseLegacySourceNotes extracts source URL and id', () => {
  assert.deepEqual(parseLegacySourceNotes(legacyVehicle.notes), {
    sourceUrl: 'https://drivetownottawa.com/inventory/2017-ram-1500/14205830',
    sourceVehicleId: '14205830',
  })
})

test('buildMarketplaceBackfillUpdate creates marketplace fields from legacy row', () => {
  const update = buildMarketplaceBackfillUpdate(legacyVehicle)

  assert.equal(update.marketplace_source, 'DriveTown Ottawa')
  assert.equal(update.marketplace_source_url, 'https://drivetownottawa.com/inventory/2017-ram-1500/14205830')
  assert.equal(update.marketplace_source_vehicle_id, '14205830')
  assert.equal(update.marketplace_last_seen_at, legacyVehicle.updated_at)
  assert.equal(update.marketplace_last_synced_at, legacyVehicle.updated_at)
  assert.equal(update.marketplace_sync_status, 'active')
  assert.equal(update.marketplace_original_vin, '1C6RR7NT1HS840918')
  assert.equal(update.marketplace_original_stock_number, 'A6450')
})

test('buildDriveTownSourceRow creates the source configuration row', () => {
  const row = buildDriveTownSourceRow('dealer-user-1')

  assert.equal(row.user_id, 'dealer-user-1')
  assert.equal(row.source_name, 'DriveTown Ottawa')
  assert.equal(row.website_url, 'https://drivetownottawa.com/')
  assert.equal(row.inventory_url, 'https://drivetownottawa.com/vehicles/')
  assert.equal(row.source_type, 'dealer_site')
  assert.equal(row.enabled, true)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
node --test client/src/lib/marketplaceBackfill.test.mjs
```

Expected: FAIL with module not found for `./marketplaceBackfill.mjs`.

- [ ] **Step 3: Implement backfill helper**

Create `client/src/lib/marketplaceBackfill.mjs`:

```js
export const DRIVE_TOWN_SOURCE_NAME = 'DriveTown Ottawa'
export const DRIVE_TOWN_WEBSITE_URL = 'https://drivetownottawa.com/'
export const DRIVE_TOWN_INVENTORY_URL = 'https://drivetownottawa.com/vehicles/'

const clean = (value) => String(value ?? '').trim()

export function parseLegacySourceNotes(notes) {
  const raw = clean(notes)
  return {
    sourceUrl: raw.match(/source_url=([^;]+)/)?.[1]?.trim() || '',
    sourceVehicleId: raw.match(/source_vehicle_id=([^;]+)/)?.[1]?.trim() || '',
  }
}

export function buildMarketplaceBackfillUpdate(row) {
  const parsed = parseLegacySourceNotes(row?.notes)
  return {
    marketplace_source: DRIVE_TOWN_SOURCE_NAME,
    marketplace_source_url: parsed.sourceUrl || null,
    marketplace_source_vehicle_id: parsed.sourceVehicleId || null,
    marketplace_last_seen_at: row?.updated_at || null,
    marketplace_last_synced_at: row?.updated_at || null,
    marketplace_sync_status: 'active',
    marketplace_original_vin: clean(row?.vin) || null,
    marketplace_original_stock_number: clean(row?.stock_number) || null,
  }
}

export function buildDriveTownSourceRow(userId) {
  return {
    user_id: userId,
    source_name: DRIVE_TOWN_SOURCE_NAME,
    website_url: DRIVE_TOWN_WEBSITE_URL,
    inventory_url: DRIVE_TOWN_INVENTORY_URL,
    source_type: 'dealer_site',
    enabled: true,
    schedule_cron: '0 */6 * * *',
  }
}
```

- [ ] **Step 4: Run backfill tests to verify they pass**

Run:

```powershell
node --test client/src/lib/marketplaceBackfill.test.mjs
```

Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

Run:

```powershell
git add client/src/lib/marketplaceBackfill.mjs client/src/lib/marketplaceBackfill.test.mjs
git commit -m "test: add marketplace backfill helpers"
```

Expected: commit succeeds.

---

### Task 3: Marketplace-Aware Vehicle Mapping

**Files:**
- Modify: `client/src/lib/dealerSelectSync.mjs`
- Modify: `client/src/lib/dealerSelectSync.test.mjs`

- [ ] **Step 1: Add failing marketplace mapping tests**

Append to `client/src/lib/dealerSelectSync.test.mjs`:

```js
test('maps scraped vehicle images and marketplace metadata when schema supports it', () => {
  const now = '2026-06-05T00:00:00.000Z'
  const row = buildVehicleUpsertRow(scraped, {
    userId: 'dealer-user-1',
    now,
    supportsDealerSelectType: false,
  })

  assert.deepEqual(row.images, scraped.imageUrls)
  assert.equal(row.marketplace_source, 'DriveTown Ottawa')
  assert.equal(row.marketplace_source_url, scraped.sourceUrl)
  assert.equal(row.marketplace_source_vehicle_id, scraped.sourceVehicleId)
  assert.equal(row.marketplace_last_seen_at, now)
  assert.equal(row.marketplace_last_synced_at, now)
  assert.equal(row.marketplace_sync_status, 'active')
  assert.equal(row.marketplace_original_vin, scraped.vin)
  assert.equal(row.marketplace_original_stock_number, scraped.stockNumber)
})

test('chooses existing vehicle by marketplace source URL before legacy source URL', () => {
  const existing = [
    {
      id: 'marketplace-hit',
      user_id: 'dealer-user-1',
      marketplace_source_url: scraped.sourceUrl,
      source_url: '',
      vin: 'OTHER',
      stock_number: 'OTHER',
    },
  ]

  assert.equal(chooseExistingVehicle(scraped, existing, 'dealer-user-1')?.id, 'marketplace-hit')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
node --test client/src/lib/dealerSelectSync.test.mjs
```

Expected: FAIL because marketplace fields and marketplace matching are not implemented.

- [ ] **Step 3: Update vehicle mapping**

Modify `buildVehicleUpsertRow()` in `client/src/lib/dealerSelectSync.mjs` by adding these fields to the returned object:

```js
    marketplace_source: DRIVE_TOWN_SOURCE_NAME,
    marketplace_source_url: clean(vehicle.sourceUrl),
    marketplace_source_vehicle_id: clean(vehicle.sourceVehicleId),
    marketplace_last_seen_at: now,
    marketplace_last_synced_at: now,
    marketplace_sync_status: 'active',
    marketplace_original_vin: upper(vehicle.vin) || null,
    marketplace_original_stock_number: clean(vehicle.stockNumber) || null,
```

Modify `chooseExistingVehicle()` so the first match is:

```js
    scoped.find((row) => clean(row.marketplace_source_url) && clean(row.marketplace_source_url) === sourceUrl) ||
```

Keep the existing legacy `source_url`, VIN, and stock fallback matches after that.

- [ ] **Step 4: Run mapping tests to verify they pass**

Run:

```powershell
node --test client/src/lib/dealerSelectSync.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```powershell
git add client/src/lib/dealerSelectSync.mjs client/src/lib/dealerSelectSync.test.mjs
git commit -m "feat: map Dealer Select marketplace fields"
```

Expected: commit succeeds.

---

### Task 4: Backfill Worker

**Files:**
- Create: `scripts/backfill-drivetown-marketplace.js`

- [ ] **Step 1: Create backfill worker**

Create `scripts/backfill-drivetown-marketplace.js`:

```js
#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js')

const clean = (value) => {
  const trimmed = String(value ?? '').trim()
  const quote = trimmed[0]
  if ((quote === '"' || quote === "'") && trimmed.endsWith(quote)) return trimmed.slice(1, -1).trim()
  return trimmed
}

async function main() {
  const supabaseUrl = clean(process.env.NEXT_PUBLIC_SUPABASE_URL).replace(/\/+$/, '')
  const supabaseKey = clean(process.env.SUPABASE_SERVICE_ROLE_KEY)
  const userId = clean(process.env.DRIVETOWN_DEALER_USER_ID)

  if (!supabaseUrl || !supabaseKey) throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required')

  const backfill = await import('../client/src/lib/marketplaceBackfill.mjs')
  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })

  const resolvedUserId = userId || await resolveDriveTownUserId(supabase)
  if (!resolvedUserId) throw new Error('DriveTown user_id could not be resolved')

  const sourceRow = backfill.buildDriveTownSourceRow(resolvedUserId)
  const { error: sourceError } = await supabase
    .from('dealer_inventory_sources')
    .upsert(sourceRow, { onConflict: 'user_id,source_name' })
  if (sourceError) throw sourceError

  const { data: rows, error: rowsError } = await supabase
    .from('edc_vehicles')
    .select('id,user_id,vin,stock_number,notes,updated_at')
    .eq('user_id', resolvedUserId)
    .eq('categories', 'dealer_select')
    .ilike('notes', '%Imported from DriveTown Ottawa feed%')
    .limit(1000)
  if (rowsError) throw rowsError

  let updated = 0
  for (const row of rows || []) {
    const update = backfill.buildMarketplaceBackfillUpdate(row)
    const { error } = await supabase.from('edc_vehicles').update(update).eq('id', row.id)
    if (error) throw error
    updated += 1
  }

  console.log(JSON.stringify({ userId: resolvedUserId, source: sourceRow.source_name, updated }, null, 2))
}

async function resolveDriveTownUserId(supabase) {
  const { data, error } = await supabase
    .from('users')
    .select('user_id')
    .eq('email', 'inventory@drivetownottawa.com')
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return String(data?.user_id || '').trim()
}

main().catch((error) => {
  console.error('[backfill-drivetown-marketplace] failed:', error)
  process.exit(1)
})
```

- [ ] **Step 2: Run env guard verification**

Run:

```powershell
node scripts/backfill-drivetown-marketplace.js
```

Expected: FAIL with `NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required`.

- [ ] **Step 3: Commit**

Run:

```powershell
git add scripts/backfill-drivetown-marketplace.js
git commit -m "feat: add DriveTown marketplace backfill worker"
```

Expected: commit succeeds.

---

### Task 5: Sync Worker Source And Run Logging

**Files:**
- Modify: `scripts/sync-drivetown.js`
- Modify: `scripts/sync-drivetown.test.mjs`

- [ ] **Step 1: Add failing sync-run helper tests**

Append to `scripts/sync-drivetown.test.mjs`:

```js
const { buildRunStatus, requireMarketplaceColumns } = require('./sync-drivetown.js')

test('buildRunStatus reports success, partial, and failed from counts and fatal error', () => {
  assert.equal(buildRunStatus({ failed: 0, writeFailed: 0 }, null), 'success')
  assert.equal(buildRunStatus({ failed: 1, writeFailed: 0 }, null), 'partial')
  assert.equal(buildRunStatus({ failed: 0, writeFailed: 2 }, null), 'partial')
  assert.equal(buildRunStatus({ failed: 0, writeFailed: 0 }, new Error('boom')), 'failed')
})

test('requireMarketplaceColumns fails when migration columns are unavailable', () => {
  assert.throws(
    () => requireMarketplaceColumns(new Set(['id', 'vin'])),
    /Apply supabase\/marketplace_inventory_schema.sql/
  )

  assert.doesNotThrow(() => requireMarketplaceColumns(new Set([
    'id',
    'images',
    'marketplace_source',
    'marketplace_source_url',
    'marketplace_source_vehicle_id',
    'marketplace_last_seen_at',
    'marketplace_last_synced_at',
    'marketplace_sync_status',
    'marketplace_original_vin',
    'marketplace_original_stock_number',
  ])))
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
node --test scripts/sync-drivetown.test.mjs
```

Expected: FAIL because `buildRunStatus` and `requireMarketplaceColumns` are not exported.

- [ ] **Step 3: Implement worker helpers**

In `scripts/sync-drivetown.js`, add:

```js
const REQUIRED_MARKETPLACE_COLUMNS = [
  'images',
  'marketplace_source',
  'marketplace_source_url',
  'marketplace_source_vehicle_id',
  'marketplace_last_seen_at',
  'marketplace_last_synced_at',
  'marketplace_sync_status',
  'marketplace_original_vin',
  'marketplace_original_stock_number',
]

function requireMarketplaceColumns(vehicleColumns) {
  const missing = REQUIRED_MARKETPLACE_COLUMNS.filter((column) => !vehicleColumns.has(column))
  if (missing.length > 0) {
    throw new Error(`Apply supabase/marketplace_inventory_schema.sql before running DriveTown sync. Missing: ${missing.join(', ')}`)
  }
}

function buildRunStatus(counts, fatalError) {
  if (fatalError) return 'failed'
  if (Number(counts?.failed || 0) > 0 || Number(counts?.writeFailed || 0) > 0) return 'partial'
  return 'success'
}
```

Export them:

```js
module.exports = {
  buildRunStatus,
  isDuplicateConstraintError,
  normalizeEnvValue,
  pickKnownColumns,
  requireMarketplaceColumns,
  stripSourceColumns,
}
```

- [ ] **Step 4: Update worker flow**

In `main()` after `const vehicleColumns = await loadVehicleColumns(supabase)`, call:

```js
  requireMarketplaceColumns(vehicleColumns)
```

Then remove source-column compatibility stripping from the normal write path. Replace:

```js
const sourceColumnsSupported = vehicleColumns.has('source_name')
```

with:

```js
const sourceColumnsSupported = false
```

This keeps the legacy `source_*` columns out of new writes while marketplace columns become required. The row passed to Supabase should be:

```js
const row = pickKnownColumns(mergedRow, vehicleColumns)
```

The fallback insert should also use:

```js
const fallbackRow = pickKnownColumns(fallback, vehicleColumns)
```

Keep `hydrateLegacySourceFields()` for legacy rows, but update it to populate `source_url` from `marketplace_source_url` first:

```js
source_url: row?.marketplace_source_url || row?.source_url || parsedNotesUrl,
```

Update missing-vehicle marking so it writes marketplace sync status instead of legacy source sync status:

```js
const soldRow = pickKnownColumns({
  status: 'Sold',
  marketplace_sync_status: 'missing',
  marketplace_last_synced_at: now,
  updated_at: now,
}, vehicleColumns)
```

- [ ] **Step 5: Add source and run table writes**

Add helper functions to `scripts/sync-drivetown.js`:

```js
async function ensureInventorySource(supabase, sync, userId) {
  const row = {
    user_id: userId,
    source_name: sync.DRIVE_TOWN_SOURCE_NAME,
    website_url: sync.DRIVE_TOWN_WEBSITE,
    inventory_url: 'https://drivetownottawa.com/vehicles/',
    source_type: 'dealer_site',
    enabled: true,
    schedule_cron: '0 */6 * * *',
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await supabase
    .from('dealer_inventory_sources')
    .upsert(row, { onConflict: 'user_id,source_name' })
    .select('id')
    .single()
  if (error) throw error
  return String(data?.id || '')
}

async function createSyncRun(supabase, { sourceId, userId, sourceName, dryRun, startedAt }) {
  const { data, error } = await supabase
    .from('dealer_inventory_sync_runs')
    .insert({
      source_id: sourceId,
      user_id: userId,
      source_name: sourceName,
      dry_run: dryRun,
      started_at: startedAt.toISOString(),
      status: 'running',
    })
    .select('id')
    .single()
  if (error) throw error
  return String(data?.id || '')
}

async function finishSyncRun(supabase, { runId, sourceId, status, counts, errors, finishedAt }) {
  const { error: runError } = await supabase
    .from('dealer_inventory_sync_runs')
    .update({
      status,
      counts,
      errors,
      finished_at: finishedAt.toISOString(),
    })
    .eq('id', runId)
  if (runError) throw runError

  const { error: sourceError } = await supabase
    .from('dealer_inventory_sources')
    .update({
      last_run_at: finishedAt.toISOString(),
      last_run_status: status,
      last_run_counts: counts,
      last_error: errors?.[0]?.error || null,
      updated_at: finishedAt.toISOString(),
    })
    .eq('id', sourceId)
  if (sourceError) throw sourceError
}
```

Call `ensureInventorySource()` before scraping. Call `createSyncRun()` before scraping. Shape `main()` like this so the sync run is always finished:

```js
  const sourceId = dryRun ? 'dry-run' : await ensureInventorySource(supabase, sync, userId)
  const runId = dryRun ? 'dry-run' : await createSyncRun(supabase, {
    sourceId,
    userId,
    sourceName: sync.DRIVE_TOWN_SOURCE_NAME,
    dryRun,
    startedAt,
  })

  let fatalError = null
  let counts = null
  let scrapeFailures = []
  let writeFailures = []

  try {
    const scrape = await scraper.scrapeDriveTownInventory()
    if (!scrape.detailUrls.length) throw new Error('DriveTown listing discovery returned zero vehicle URLs')

    counts = {
      listingUrls: scrape.detailUrls.length,
      scraped: scrape.vehicles.length,
      failed: scrape.failures.length,
      inserted: 0,
      updated: 0,
      preserved: 0,
      markedSold: 0,
      writeFailed: 0,
    }

    // Move the current prepareScrapedVehiclesForUniqueVin loop, insert/update writes,
    // computeMissingSyncedVehicles call, and marked-sold writes into this try block.
    scrapeFailures = scrape.failures.slice(0, 20)
  } catch (error) {
    fatalError = error
    throw error
  } finally {
    if (!dryRun && runId) {
      const finishedAt = new Date()
      const errors = [
        ...(scrapeFailures || []).map((failure) => ({ type: 'scrape', ...failure })),
        ...(writeFailures || []).map((failure) => ({ type: 'write', ...failure })),
        ...(fatalError ? [{ type: 'fatal', error: fatalError.message }] : []),
      ]

      await finishSyncRun(supabase, {
        runId,
        sourceId,
        status: buildRunStatus(counts || {}, fatalError),
        counts: counts || {},
        errors,
        finishedAt,
      })
    }
  }
```

- [ ] **Step 6: Run worker tests**

Run:

```powershell
node --test scripts/sync-drivetown.test.mjs
```

Expected: PASS.

- [ ] **Step 7: Commit**

Run:

```powershell
git add scripts/sync-drivetown.js scripts/sync-drivetown.test.mjs
git commit -m "feat: log Dealer Select sync runs"
```

Expected: commit succeeds.

---

### Task 6: Apply Migration And Backfill

**Files:**
- No source edits expected.

- [ ] **Step 1: Apply SQL migration**

Run the contents of `supabase/marketplace_inventory_schema.sql` in the Supabase SQL editor for the deployed project.

Expected: SQL completes without errors.

- [ ] **Step 2: Verify columns and tables exist**

Run in Supabase SQL editor:

```sql
select column_name
from information_schema.columns
where table_schema = 'public'
  and table_name = 'edc_vehicles'
  and column_name in (
    'images',
    'marketplace_source',
    'marketplace_source_url',
    'marketplace_source_vehicle_id',
    'marketplace_last_seen_at',
    'marketplace_last_synced_at',
    'marketplace_sync_status',
    'marketplace_original_vin',
    'marketplace_original_stock_number'
  )
order by column_name;

select to_regclass('public.dealer_inventory_sources') as sources_table,
       to_regclass('public.dealer_inventory_sync_runs') as runs_table;
```

Expected: 9 `edc_vehicles` columns and both table names are returned.

- [ ] **Step 3: Run backfill worker**

Run from the repo root:

```powershell
Get-Content client\.env | ForEach-Object { if ($_ -match '^\s*([^#=]+)=(.*)$') { [Environment]::SetEnvironmentVariable($matches[1].Trim(), $matches[2].Trim(), 'Process') } }
$env:DRIVETOWN_SYNC_DRY_RUN='0'
node scripts/backfill-drivetown-marketplace.js
```

Expected: JSON output with `updated` equal to the current DriveTown Dealer Select row count, expected `148`.

- [ ] **Step 4: Verify backfilled rows**

Run in Supabase SQL editor:

```sql
select count(*) as marketplace_backfilled
from public.edc_vehicles
where marketplace_source = 'DriveTown Ottawa'
  and marketplace_source_url is not null
  and marketplace_source_vehicle_id is not null;

select source_name, inventory_url, enabled
from public.dealer_inventory_sources
where source_name = 'DriveTown Ottawa';
```

Expected: `marketplace_backfilled = 148` and one DriveTown source row.

---

### Task 7: Marketplace Sync Verification

**Files:**
- No source edits expected unless verification exposes a bug.

- [ ] **Step 1: Run live dry run**

Run:

```powershell
Get-Content client\.env | ForEach-Object { if ($_ -match '^\s*([^#=]+)=(.*)$') { [Environment]::SetEnvironmentVariable($matches[1].Trim(), $matches[2].Trim(), 'Process') } }
$env:DRIVETOWN_SYNC_DRY_RUN='1'
node scripts/sync-drivetown.js
```

Expected: JSON output with `scraped = 148`, `failed = 0`, and no fatal schema errors.

- [ ] **Step 2: Run live write sync**

Run:

```powershell
$env:DRIVETOWN_SYNC_DRY_RUN='0'
node scripts/sync-drivetown.js
```

Expected: JSON output with `scraped = 148`, `writeFailed = 0`, and a `success` sync run status in Supabase.

- [ ] **Step 3: Verify images and source metadata**

Run in Supabase SQL editor:

```sql
select count(*) as with_images
from public.edc_vehicles
where marketplace_source = 'DriveTown Ottawa'
  and array_length(images, 1) > 0;

select status, counts
from public.dealer_inventory_sync_runs
where source_name = 'DriveTown Ottawa'
order by started_at desc
limit 3;
```

Expected: `with_images` is greater than zero, and the latest run has `status = 'success'`.

---

### Task 8: Operator Documentation

**Files:**
- Create: `docs/marketplace-inventory-schema.md`

- [ ] **Step 1: Add operator notes**

Create `docs/marketplace-inventory-schema.md`:

````md
# Marketplace Inventory Schema

## Apply Migration

Run `supabase/marketplace_inventory_schema.sql` in the deployed Supabase SQL editor.

## Backfill DriveTown

```powershell
Get-Content client\.env | ForEach-Object { if ($_ -match '^\s*([^#=]+)=(.*)$') { [Environment]::SetEnvironmentVariable($matches[1].Trim(), $matches[2].Trim(), 'Process') } }
node scripts/backfill-drivetown-marketplace.js
```

Expected output includes the DriveTown `userId` and `updated: 148`.

## Run DriveTown Sync

Dry run:

```powershell
$env:DRIVETOWN_SYNC_DRY_RUN='1'
node scripts/sync-drivetown.js
```

Write run:

```powershell
$env:DRIVETOWN_SYNC_DRY_RUN='0'
node scripts/sync-drivetown.js
```

## Verify

```sql
select count(*)
from public.edc_vehicles
where marketplace_source = 'DriveTown Ottawa';

select status, counts
from public.dealer_inventory_sync_runs
where source_name = 'DriveTown Ottawa'
order by started_at desc
limit 5;
```
````

- [ ] **Step 2: Commit docs**

Run:

```powershell
git add docs/marketplace-inventory-schema.md
git commit -m "docs: add marketplace schema operations"
```

Expected: commit succeeds.

---

### Task 9: Final Verification

**Files:**
- No source edits expected.

- [ ] **Step 1: Run all marketplace and sync tests**

Run:

```powershell
node --test scripts/marketplace-schema.test.mjs client/src/lib/marketplaceBackfill.test.mjs client/src/lib/dealerSelectSync.test.mjs scripts/sync-drivetown.test.mjs client/src/lib/drivetownScraper.test.mjs
```

Expected: PASS for all tests.

- [ ] **Step 2: Run worker env guards**

Run:

```powershell
node scripts/backfill-drivetown-marketplace.js
node scripts/sync-drivetown.js
```

Expected: both commands fail safely with required env errors when env vars are not set in the process.

- [ ] **Step 3: Verify git status**

Run:

```powershell
git status --short
```

Expected: only pre-existing unrelated local changes remain (`.claude/settings.local.json`, `.gitignore`, and dev log files), or a clean worktree if those were handled separately.
