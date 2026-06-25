# Facebook Marketplace Posting Assistant Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a human-in-the-loop Facebook Marketplace posting assistant that turns EasyDrive inventory rows into copy-ready listing content and tracks posting status.

**Architecture:** Keep vehicle data in `edc_vehicles` and store Facebook posting workflow state in a new `edc_facebook_marketplace_posts` table. Put deterministic payload/readiness/status logic in a small `.mjs` helper with Node tests, expose admin-only Next API routes for queue/prepare/update, then build a dense admin queue page at `/admin/marketplace/facebook`.

**Tech Stack:** Next.js App Router, React client components, Supabase JS, SQL migrations, Node `node:test`, existing EasyDrive admin layout and Tailwind utility classes.

---

## File Structure

- Create `client/src/lib/facebookMarketplacePosting.mjs`
  - Owns all deterministic payload generation, readiness checks, status resolution, copy text, and vehicle search matching for the Facebook queue.
- Create `client/src/lib/facebookMarketplacePosting.test.mjs`
  - Tests complete vehicle payloads, partial fallback payloads, readiness, status transitions, and saved-post merge behavior.
- Create `supabase/edc_facebook_marketplace_posts.sql`
  - Adds the workflow table and indexes.
- Create `scripts/facebook-marketplace-posts-schema.test.mjs`
  - Verifies the SQL file stays idempotent and contains required columns/indexes.
- Create `client/src/app/api/admin/marketplace/facebook/posts/route.ts`
  - Lists vehicles plus post rows, supports search/status filters, and creates/refreshes post rows in bulk with `POST`.
- Create `client/src/app/api/admin/marketplace/facebook/posts/[id]/route.ts`
  - Updates saved posting fields, status, URL, and notes.
- Create `client/src/app/admin/marketplace/facebook/page.tsx`
  - Server entry that renders the client queue component.
- Create `client/src/app/admin/marketplace/facebook/FacebookMarketplaceClient.tsx`
  - Admin queue UI, detail drawer, copy actions, open Facebook action, and persistence.
- Modify `client/src/app/admin/AdminLayoutClient.tsx`
  - Add a sidebar item for Facebook Posts or route marketplace users through the existing Market Place navigation.
- Modify `client/src/app/admin/marketplace/page.tsx`
  - Add a clear admin link to the Facebook posting assistant near the marketplace page header.

---

### Task 1: Posting Payload And Readiness Helper

**Files:**
- Create: `client/src/lib/facebookMarketplacePosting.test.mjs`
- Create: `client/src/lib/facebookMarketplacePosting.mjs`

- [ ] **Step 1: Write failing helper tests**

Create `client/src/lib/facebookMarketplacePosting.test.mjs`:

```js
import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  buildFacebookMarketplacePayload,
  mergeFacebookPostRow,
  scoreFacebookMarketplaceReadiness,
  resolveFacebookMarketplaceStatus,
  vehicleMatchesFacebookSearch,
} from './facebookMarketplacePosting.mjs'

const completeVehicle = {
  id: 'vehicle-1',
  user_id: 'dealer-1',
  year: 2021,
  make: 'Honda',
  model: 'Civic',
  series: 'EX',
  retail_price: 21995,
  price: 22495,
  mileage: 68120,
  city: 'Toronto',
  province: 'ON',
  transmission: 'Automatic',
  fuel_type: 'Gasoline',
  drivetrain: 'FWD',
  exterior_color: 'Blue',
  stock_number: 'A123',
  vin: '2HGFC2F59MH000001',
  ad_description: 'Clean Civic with strong service history.',
  images: ['https://example.com/1.jpg', 'https://example.com/2.jpg'],
  status: 'ACTIVE',
  updated_at: '2026-06-25T10:00:00.000Z',
}

test('buildFacebookMarketplacePayload builds copy-ready listing data from a complete vehicle', () => {
  const payload = buildFacebookMarketplacePayload(completeVehicle, {
    siteUrl: 'https://easydrivecanada.com',
    defaultLocation: 'Mississauga, ON',
  })

  assert.equal(payload.vehicleId, 'vehicle-1')
  assert.equal(payload.userId, 'dealer-1')
  assert.equal(payload.title, '2021 Honda Civic EX')
  assert.equal(payload.price, 21995)
  assert.equal(payload.mileage, 68120)
  assert.equal(payload.location, 'Toronto, ON')
  assert.deepEqual(payload.images, ['https://example.com/1.jpg', 'https://example.com/2.jpg'])
  assert.equal(payload.publicUrl, 'https://easydrivecanada.com/inventory/vehicle-1')
  assert.match(payload.description, /Clean Civic with strong service history/)
  assert.match(payload.description, /Stock: A123/)
  assert.match(payload.description, /VIN: 2HGFC2F59MH000001/)
  assert.match(payload.description, /Schedule a test drive/)
})

test('buildFacebookMarketplacePayload falls back across common vehicle field variants', () => {
  const payload = buildFacebookMarketplacePayload({
    id: 'vehicle-2',
    year: '2018',
    make: 'Toyota',
    model: 'RAV4',
    trim: 'LE',
    finance_price: '17500',
    odometer: '91000',
    image_urls: '["https://example.com/rav4.jpg"]',
    description: 'AWD SUV.',
  }, {
    siteUrl: 'https://edc.test/',
    defaultLocation: 'Ottawa, ON',
  })

  assert.equal(payload.title, '2018 Toyota RAV4 LE')
  assert.equal(payload.price, 17500)
  assert.equal(payload.mileage, 91000)
  assert.equal(payload.location, 'Ottawa, ON')
  assert.deepEqual(payload.images, ['https://example.com/rav4.jpg'])
  assert.equal(payload.publicUrl, 'https://edc.test/inventory/vehicle-2')
})

test('scoreFacebookMarketplaceReadiness reports required missing fields', () => {
  const payload = buildFacebookMarketplacePayload({ id: 'vehicle-3', make: 'Ford' })
  const readiness = scoreFacebookMarketplaceReadiness(payload)

  assert.equal(readiness.status, 'needs_info')
  assert.deepEqual(readiness.missing.sort(), ['images', 'location', 'mileage', 'price', 'title'].sort())
  assert.equal(readiness.ready, false)
})

test('resolveFacebookMarketplaceStatus promotes posted sold vehicles to sold_remove', () => {
  assert.equal(
    resolveFacebookMarketplaceStatus({
      vehicle: { status: 'SOLD' },
      post: { status: 'posted', facebook_listing_url: 'https://facebook.com/marketplace/item/1' },
      readiness: { ready: true },
    }),
    'sold_remove'
  )

  assert.equal(
    resolveFacebookMarketplaceStatus({
      vehicle: { status: 'ACTIVE' },
      post: null,
      readiness: { ready: true },
    }),
    'ready'
  )
})

test('mergeFacebookPostRow preserves staff overrides over generated payload', () => {
  const payload = buildFacebookMarketplacePayload(completeVehicle)
  const merged = mergeFacebookPostRow(payload, {
    status: 'posted',
    posting_title: 'Custom Marketplace title',
    posting_description: 'Custom staff description',
    posting_price: 20995,
    posting_location: 'Brampton, ON',
    facebook_listing_url: 'https://facebook.com/marketplace/item/posted',
    notes: 'Posted by Sam.',
  })

  assert.equal(merged.title, 'Custom Marketplace title')
  assert.equal(merged.description, 'Custom staff description')
  assert.equal(merged.price, 20995)
  assert.equal(merged.location, 'Brampton, ON')
  assert.equal(merged.status, 'posted')
  assert.equal(merged.facebookListingUrl, 'https://facebook.com/marketplace/item/posted')
  assert.equal(merged.notes, 'Posted by Sam.')
})

test('vehicleMatchesFacebookSearch searches title, VIN, stock, and status text', () => {
  const row = mergeFacebookPostRow(buildFacebookMarketplacePayload(completeVehicle), { status: 'ready' })

  assert.equal(vehicleMatchesFacebookSearch(row, 'civic'), true)
  assert.equal(vehicleMatchesFacebookSearch(row, '2HGFC2F59'), true)
  assert.equal(vehicleMatchesFacebookSearch(row, 'A123'), true)
  assert.equal(vehicleMatchesFacebookSearch(row, 'ready'), true)
  assert.equal(vehicleMatchesFacebookSearch(row, 'camry'), false)
})
```

- [ ] **Step 2: Run helper tests to verify failure**

Run:

```powershell
node --test client/src/lib/facebookMarketplacePosting.test.mjs
```

Expected: FAIL because `client/src/lib/facebookMarketplacePosting.mjs` does not exist.

- [ ] **Step 3: Implement helper**

Create `client/src/lib/facebookMarketplacePosting.mjs`:

```js
const clean = (value) => String(value ?? '').trim()
const lower = (value) => clean(value).toLowerCase()

const numberValue = (value) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  const parsed = Number(clean(value).replace(/[$,\s]/g, ''))
  return Number.isFinite(parsed) ? parsed : 0
}

const imageList = (value) => {
  if (Array.isArray(value)) return value.map(clean).filter(Boolean)
  const raw = clean(value)
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) return parsed.map(clean).filter(Boolean)
  } catch {
    // Fall through to comma parsing.
  }
  return raw.split(',').map(clean).filter(Boolean)
}

const firstText = (...values) => values.map(clean).find(Boolean) || ''
const firstNumber = (...values) => values.map(numberValue).find((value) => value > 0) || 0

const absoluteSiteUrl = (siteUrl) => clean(siteUrl || process.env.NEXT_PUBLIC_SITE_URL || 'https://easydrivecanada.com').replace(/\/+$/, '')

const vehicleTitle = (vehicle) =>
  [vehicle.year, vehicle.make, vehicle.model, vehicle.series || vehicle.trim]
    .map(clean)
    .filter(Boolean)
    .join(' ')

const vehicleLocation = (vehicle, fallback) => {
  const city = firstText(vehicle.city, vehicle.location_city)
  const province = firstText(vehicle.province, vehicle.location_province)
  if (city && province) return `${city}, ${province}`
  if (city) return city
  return clean(fallback)
}

const buildDescription = ({ vehicle, title, mileage, publicUrl }) => {
  const intro = firstText(vehicle.ad_description, vehicle.description, `${title} available at EasyDrive Canada.`)
  const specs = [
    mileage > 0 ? `Mileage: ${mileage.toLocaleString('en-CA')} km` : '',
    firstText(vehicle.transmission) ? `Transmission: ${firstText(vehicle.transmission)}` : '',
    firstText(vehicle.fuel_type, vehicle.fuelType) ? `Fuel: ${firstText(vehicle.fuel_type, vehicle.fuelType)}` : '',
    firstText(vehicle.drivetrain) ? `Drivetrain: ${firstText(vehicle.drivetrain)}` : '',
    firstText(vehicle.exterior_color, vehicle.exteriorColor, vehicle.color) ? `Exterior: ${firstText(vehicle.exterior_color, vehicle.exteriorColor, vehicle.color)}` : '',
    firstText(vehicle.stock_number, vehicle.stockNumber) ? `Stock: ${firstText(vehicle.stock_number, vehicle.stockNumber)}` : '',
    firstText(vehicle.vin) ? `VIN: ${firstText(vehicle.vin)}` : '',
  ].filter(Boolean)

  return [
    intro,
    specs.join('\n'),
    `Schedule a test drive or request more details: ${publicUrl}`,
  ].filter(Boolean).join('\n\n')
}

export function buildFacebookMarketplacePayload(vehicle = {}, options = {}) {
  const id = clean(vehicle.id || vehicle.vehicle_id || vehicle.vehicleId)
  const title = vehicleTitle(vehicle)
  const siteUrl = absoluteSiteUrl(options.siteUrl)
  const publicUrl = id ? `${siteUrl}/inventory/${encodeURIComponent(id)}` : siteUrl
  const price = firstNumber(vehicle.retail_price, vehicle.retailPrice, vehicle.price, vehicle.finance_price, vehicle.financePrice)
  const mileage = firstNumber(vehicle.mileage, vehicle.odometer)
  const location = vehicleLocation(vehicle, options.defaultLocation || 'Mississauga, ON')
  const images = [
    ...imageList(vehicle.images),
    ...imageList(vehicle.image_urls),
    ...imageList(vehicle.photos),
    ...imageList(vehicle.image),
  ].filter((value, index, arr) => arr.indexOf(value) === index).slice(0, 20)

  return {
    vehicleId: id,
    userId: clean(vehicle.user_id || vehicle.userId),
    title,
    price,
    mileage,
    location,
    description: buildDescription({ vehicle, title, mileage, publicUrl }),
    images,
    publicUrl,
    vin: clean(vehicle.vin),
    stockNumber: clean(vehicle.stock_number || vehicle.stockNumber),
    vehicleStatus: clean(vehicle.status),
    vehicleUpdatedAt: clean(vehicle.updated_at || vehicle.updatedAt),
  }
}

export function scoreFacebookMarketplaceReadiness(payload = {}) {
  const checks = [
    { key: 'title', label: 'Title', passed: clean(payload.title).split(/\s+/).length >= 3 },
    { key: 'price', label: 'Price', passed: numberValue(payload.price) > 0 },
    { key: 'mileage', label: 'Mileage', passed: numberValue(payload.mileage) > 0 },
    { key: 'location', label: 'Location', passed: Boolean(clean(payload.location)) },
    { key: 'description', label: 'Description', passed: clean(payload.description).length >= 40 },
    { key: 'images', label: 'Photos', passed: imageList(payload.images).length > 0 },
  ]
  const missing = checks.filter((check) => !check.passed).map((check) => check.key)
  return {
    ready: missing.length === 0,
    status: missing.length === 0 ? 'ready' : 'needs_info',
    missing,
    checks,
    score: Math.round((checks.filter((check) => check.passed).length / checks.length) * 100),
  }
}

export function resolveFacebookMarketplaceStatus({ vehicle = {}, post = null, readiness = {} } = {}) {
  const current = lower(post?.status)
  const vehicleStatus = lower(vehicle.status || vehicle.vehicleStatus)
  const hasPostedUrl = Boolean(clean(post?.facebook_listing_url || post?.facebookListingUrl))
  if (['sold', 'void', 'pending', 'deal pending'].includes(vehicleStatus) && (current === 'posted' || hasPostedUrl)) return 'sold_remove'
  if (current) return current
  return readiness.ready ? 'ready' : 'draft'
}

export function mergeFacebookPostRow(payload = {}, post = null) {
  const merged = {
    ...payload,
    postId: clean(post?.id),
    title: firstText(post?.posting_title, payload.title),
    description: firstText(post?.posting_description, payload.description),
    price: firstNumber(post?.posting_price, payload.price),
    location: firstText(post?.posting_location, payload.location),
    facebookListingUrl: clean(post?.facebook_listing_url),
    notes: clean(post?.notes),
    postedAt: clean(post?.posted_at),
    lastPreparedAt: clean(post?.last_prepared_at),
    createdAt: clean(post?.created_at),
    updatedAt: clean(post?.updated_at),
  }
  const readiness = scoreFacebookMarketplaceReadiness(merged)
  return {
    ...merged,
    readiness,
    status: resolveFacebookMarketplaceStatus({ vehicle: payload, post, readiness }),
  }
}

export function buildFacebookPostInsert(payload = {}, readiness = scoreFacebookMarketplaceReadiness(payload), nowIso = new Date().toISOString()) {
  return {
    vehicle_id: clean(payload.vehicleId),
    user_id: clean(payload.userId) || null,
    status: readiness.ready ? 'ready' : 'draft',
    posting_title: clean(payload.title) || null,
    posting_description: clean(payload.description) || null,
    posting_price: numberValue(payload.price) || null,
    posting_location: clean(payload.location) || null,
    posting_payload: payload,
    readiness,
    last_prepared_at: nowIso,
    updated_at: nowIso,
  }
}

export function vehicleMatchesFacebookSearch(row = {}, query = '') {
  const q = lower(query)
  if (!q) return true
  const haystack = [
    row.title,
    row.description,
    row.vehicleId,
    row.vin,
    row.stockNumber,
    row.status,
    row.vehicleStatus,
    row.location,
  ].map(lower).join(' ')
  return q.split(/\s+/).filter(Boolean).every((term) => haystack.includes(term))
}
```

- [ ] **Step 4: Run helper tests to verify pass**

Run:

```powershell
node --test client/src/lib/facebookMarketplacePosting.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Commit helper**

```powershell
git add client/src/lib/facebookMarketplacePosting.mjs client/src/lib/facebookMarketplacePosting.test.mjs
git commit -m "Add Facebook marketplace posting helpers"
```

---

### Task 2: Posting Workflow SQL

**Files:**
- Create: `supabase/edc_facebook_marketplace_posts.sql`
- Create: `scripts/facebook-marketplace-posts-schema.test.mjs`

- [ ] **Step 1: Write failing schema test**

Create `scripts/facebook-marketplace-posts-schema.test.mjs`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const sqlPath = new URL('../supabase/edc_facebook_marketplace_posts.sql', import.meta.url)

test('facebook marketplace posts schema declares required table, columns, and indexes', async () => {
  const sql = await readFile(sqlPath, 'utf8')

  assert.match(sql, /create table if not exists public\.edc_facebook_marketplace_posts/i)
  for (const column of [
    'vehicle_id',
    'user_id',
    'status',
    'facebook_listing_url',
    'posting_title',
    'posting_description',
    'posting_price',
    'posting_location',
    'posting_payload',
    'readiness',
    'notes',
    'posted_at',
    'last_prepared_at',
    'created_at',
    'updated_at',
  ]) {
    assert.match(sql, new RegExp(`\\b${column}\\b`, 'i'))
  }

  assert.match(sql, /edc_facebook_marketplace_posts_vehicle_id_idx/i)
  assert.match(sql, /edc_facebook_marketplace_posts_status_idx/i)
  assert.match(sql, /edc_facebook_marketplace_posts_user_status_idx/i)
  assert.match(sql, /edc_facebook_marketplace_posts_last_prepared_idx/i)
  assert.match(sql, /comment on table public\.edc_facebook_marketplace_posts/i)
})
```

- [ ] **Step 2: Run schema test to verify failure**

Run:

```powershell
node --test scripts/facebook-marketplace-posts-schema.test.mjs
```

Expected: FAIL because `supabase/edc_facebook_marketplace_posts.sql` does not exist.

- [ ] **Step 3: Add idempotent SQL**

Create `supabase/edc_facebook_marketplace_posts.sql`:

```sql
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
```

- [ ] **Step 4: Run schema test to verify pass**

Run:

```powershell
node --test scripts/facebook-marketplace-posts-schema.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Commit schema**

Because SQL files are ignored in this repo, force-add the SQL file:

```powershell
git add -f supabase/edc_facebook_marketplace_posts.sql
git add scripts/facebook-marketplace-posts-schema.test.mjs
git commit -m "Add Facebook marketplace posts schema"
```

---

### Task 3: Admin API Routes

**Files:**
- Create: `client/src/app/api/admin/marketplace/facebook/posts/route.ts`
- Create: `client/src/app/api/admin/marketplace/facebook/posts/[id]/route.ts`

- [ ] **Step 1: Create list and prepare API route**

Create `client/src/app/api/admin/marketplace/facebook/posts/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  buildFacebookMarketplacePayload,
  buildFacebookPostInsert,
  mergeFacebookPostRow,
  scoreFacebookMarketplaceReadiness,
  vehicleMatchesFacebookSearch,
} from '@/lib/facebookMarketplacePosting.mjs'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

const noStore = { 'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0' }

const createSupabase = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseKey) return null
  return createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
}

const clean = (value: unknown) => String(value ?? '').trim()

const loadRows = async (request: Request) => {
  const supabase = createSupabase()
  if (!supabase) return { response: NextResponse.json({ error: 'Server not configured' }, { status: 500, headers: noStore }) }

  const url = new URL(request.url)
  const userId = clean(url.searchParams.get('user_id'))
  const q = clean(url.searchParams.get('q'))
  const status = clean(url.searchParams.get('status'))

  let vehicleQuery = supabase.from('edc_vehicles').select('*').order('created_at', { ascending: false })
  if (userId) vehicleQuery = vehicleQuery.eq('user_id', userId)

  const [vehicleResult, postResult] = await Promise.all([
    vehicleQuery,
    supabase.from('edc_facebook_marketplace_posts').select('*').order('updated_at', { ascending: false }),
  ])

  if (vehicleResult.error) {
    return { response: NextResponse.json({ error: vehicleResult.error.message }, { status: 500, headers: noStore }) }
  }

  if (postResult.error) {
    return {
      response: NextResponse.json({
        error: postResult.error.message,
        setupRequired: postResult.error.message.toLowerCase().includes('edc_facebook_marketplace_posts'),
      }, { status: 500, headers: noStore }),
    }
  }

  const postByVehicleId = new Map((Array.isArray(postResult.data) ? postResult.data : []).map((post: any) => [clean(post.vehicle_id), post]))
  const rows = (Array.isArray(vehicleResult.data) ? vehicleResult.data : []).map((vehicle: any) => {
    const payload = buildFacebookMarketplacePayload(vehicle, {
      siteUrl: process.env.NEXT_PUBLIC_SITE_URL || 'https://easydrivecanada.com',
      defaultLocation: process.env.EASYDRIVE_MARKETPLACE_DEFAULT_LOCATION || 'Mississauga, ON',
    })
    return mergeFacebookPostRow(payload, postByVehicleId.get(clean(vehicle.id)) || null)
  })

  const filtered = rows
    .filter((row: any) => !status || row.status === status)
    .filter((row: any) => vehicleMatchesFacebookSearch(row, q))

  const summary = {
    total: filtered.length,
    ready: filtered.filter((row: any) => row.status === 'ready').length,
    draft: filtered.filter((row: any) => row.status === 'draft').length,
    posted: filtered.filter((row: any) => row.status === 'posted').length,
    needsUpdate: filtered.filter((row: any) => row.status === 'needs_update').length,
    soldRemove: filtered.filter((row: any) => row.status === 'sold_remove').length,
    skipped: filtered.filter((row: any) => row.status === 'skipped').length,
    failed: filtered.filter((row: any) => row.status === 'failed').length,
  }

  return { supabase, rows: filtered, summary }
}

export async function GET(request: Request) {
  try {
    const loaded = await loadRows(request)
    if (loaded.response) return loaded.response
    return NextResponse.json({ posts: loaded.rows, summary: loaded.summary }, { headers: noStore })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to load Facebook posts' }, { status: 500, headers: noStore })
  }
}

export async function POST(request: Request) {
  try {
    const loaded = await loadRows(request)
    if (loaded.response) return loaded.response

    const body = await request.json().catch(() => ({}))
    const vehicleIds = Array.isArray(body?.vehicleIds) ? body.vehicleIds.map(clean).filter(Boolean) : []
    const refreshOverrides = body?.refreshOverrides === true
    const nowIso = new Date().toISOString()
    const selected = vehicleIds.length ? loaded.rows.filter((row: any) => vehicleIds.includes(row.vehicleId)) : loaded.rows

    const upserts = selected.map((row: any) => {
      const readiness = scoreFacebookMarketplaceReadiness(row)
      const insert = buildFacebookPostInsert(row, readiness, nowIso)
      if (!refreshOverrides && row.postId) {
        delete (insert as any).posting_title
        delete (insert as any).posting_description
        delete (insert as any).posting_price
        delete (insert as any).posting_location
      }
      return insert
    })

    if (upserts.length === 0) return NextResponse.json({ updated: 0 }, { headers: noStore })

    const { error } = await loaded.supabase
      .from('edc_facebook_marketplace_posts')
      .upsert(upserts, { onConflict: 'vehicle_id' })

    if (error) return NextResponse.json({ error: error.message }, { status: 500, headers: noStore })
    return NextResponse.json({ updated: upserts.length }, { headers: noStore })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to prepare Facebook posts' }, { status: 500, headers: noStore })
  }
}
```

- [ ] **Step 2: Create update API route**

Create `client/src/app/api/admin/marketplace/facebook/posts/[id]/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

const noStore = { 'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0' }
const allowedStatuses = new Set(['draft', 'ready', 'posted', 'needs_update', 'sold_remove', 'skipped', 'failed'])
const clean = (value: unknown) => String(value ?? '').trim()

const createSupabase = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseKey) return null
  return createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
}

export async function PATCH(request: Request, context: { params: { id: string } }) {
  try {
    const supabase = createSupabase()
    if (!supabase) return NextResponse.json({ error: 'Server not configured' }, { status: 500, headers: noStore })

    const id = clean(context.params.id)
    if (!id) return NextResponse.json({ error: 'Missing post id' }, { status: 400, headers: noStore })

    const body = await request.json().catch(() => ({}))
    const status = clean(body?.status)
    const update: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }

    if (status) {
      if (!allowedStatuses.has(status)) return NextResponse.json({ error: 'Invalid status' }, { status: 400, headers: noStore })
      update.status = status
      if (status === 'posted' && !clean(body?.postedAt)) update.posted_at = new Date().toISOString()
    }

    if ('facebookListingUrl' in body) update.facebook_listing_url = clean(body.facebookListingUrl) || null
    if ('title' in body) update.posting_title = clean(body.title) || null
    if ('description' in body) update.posting_description = clean(body.description) || null
    if ('price' in body) update.posting_price = Number(body.price) || null
    if ('location' in body) update.posting_location = clean(body.location) || null
    if ('notes' in body) update.notes = clean(body.notes) || null

    const { data, error } = await supabase
      .from('edc_facebook_marketplace_posts')
      .update(update)
      .eq('id', id)
      .select('*')
      .maybeSingle()

    if (error) return NextResponse.json({ error: error.message }, { status: 500, headers: noStore })
    if (!data) return NextResponse.json({ error: 'Post not found' }, { status: 404, headers: noStore })
    return NextResponse.json({ post: data }, { headers: noStore })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to update Facebook post' }, { status: 500, headers: noStore })
  }
}
```

- [ ] **Step 3: Run focused tests**

Run:

```powershell
node --test client/src/lib/facebookMarketplacePosting.test.mjs scripts/facebook-marketplace-posts-schema.test.mjs
```

Expected: PASS.

- [ ] **Step 4: Commit API routes**

```powershell
git add client/src/app/api/admin/marketplace/facebook/posts/route.ts client/src/app/api/admin/marketplace/facebook/posts/[id]/route.ts
git commit -m "Add Facebook marketplace posting APIs"
```

---

### Task 4: Admin Queue UI

**Files:**
- Create: `client/src/app/admin/marketplace/facebook/page.tsx`
- Create: `client/src/app/admin/marketplace/facebook/FacebookMarketplaceClient.tsx`

- [ ] **Step 1: Create page entry**

Create `client/src/app/admin/marketplace/facebook/page.tsx`:

```tsx
import FacebookMarketplaceClient from './FacebookMarketplaceClient'

export default function FacebookMarketplacePage() {
  return <FacebookMarketplaceClient />
}
```

- [ ] **Step 2: Create client component**

Create `client/src/app/admin/marketplace/facebook/FacebookMarketplaceClient.tsx` with:

```tsx
'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Copy, ExternalLink, RefreshCw, Search, Save } from 'lucide-react'

type FacebookPostRow = {
  postId: string
  vehicleId: string
  title: string
  description: string
  price: number
  mileage: number
  location: string
  images: string[]
  publicUrl: string
  vin: string
  stockNumber: string
  vehicleStatus: string
  status: string
  facebookListingUrl: string
  notes: string
  readiness: { ready: boolean; score: number; missing: string[] }
}

type Summary = {
  total: number
  ready: number
  draft: number
  posted: number
  needsUpdate: number
  soldRemove: number
  skipped: number
  failed: number
}

const STATUS_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'ready', label: 'Ready' },
  { value: 'draft', label: 'Draft' },
  { value: 'posted', label: 'Posted' },
  { value: 'needs_update', label: 'Needs Update' },
  { value: 'sold_remove', label: 'Sold / Remove' },
  { value: 'skipped', label: 'Skipped' },
  { value: 'failed', label: 'Failed' },
]

const statusLabel = (status: string) =>
  STATUS_OPTIONS.find((item) => item.value === status)?.label || status || 'Draft'

const facebookMarketplaceUrl = 'https://www.facebook.com/marketplace/create/vehicle'

export default function FacebookMarketplaceClient() {
  const [posts, setPosts] = useState<FacebookPostRow[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [selected, setSelected] = useState<FacebookPostRow | null>(null)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState('')
  const [form, setForm] = useState({ title: '', description: '', price: '', location: '', facebookListingUrl: '', notes: '', status: 'draft' })

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    const params = new URLSearchParams()
    if (query.trim()) params.set('q', query.trim())
    if (status) params.set('status', status)
    const res = await fetch(`/api/admin/marketplace/facebook/posts?${params.toString()}`, { cache: 'no-store' })
    const json = await res.json().catch(() => null)
    if (!res.ok) {
      setError(json?.setupRequired ? 'Run supabase/edc_facebook_marketplace_posts.sql before using the Facebook posting queue.' : json?.error || 'Failed to load Facebook posting queue.')
      setPosts([])
      setSummary(null)
      setLoading(false)
      return
    }
    setPosts(Array.isArray(json?.posts) ? json.posts : [])
    setSummary(json?.summary || null)
    setLoading(false)
  }, [query, status])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!selected) return
    setForm({
      title: selected.title || '',
      description: selected.description || '',
      price: selected.price ? String(selected.price) : '',
      location: selected.location || '',
      facebookListingUrl: selected.facebookListingUrl || '',
      notes: selected.notes || '',
      status: selected.status || 'draft',
    })
  }, [selected])

  const filteredSummary = useMemo(() => summary || { total: 0, ready: 0, draft: 0, posted: 0, needsUpdate: 0, soldRemove: 0, skipped: 0, failed: 0 }, [summary])

  const prepareSelected = async (vehicleIds: string[]) => {
    setSaving(true)
    setError('')
    const res = await fetch('/api/admin/marketplace/facebook/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vehicleIds }),
    })
    const json = await res.json().catch(() => null)
    setSaving(false)
    if (!res.ok) {
      setError(json?.error || 'Failed to prepare Facebook posts.')
      return
    }
    await load()
  }

  const copyText = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(label)
      window.setTimeout(() => setCopied(''), 1400)
    } catch {
      setError(`Could not copy ${label}. Select the text manually and copy it.`)
    }
  }

  const saveSelected = async () => {
    if (!selected?.postId) {
      await prepareSelected([selected?.vehicleId || ''])
      return
    }
    setSaving(true)
    setError('')
    const res = await fetch(`/api/admin/marketplace/facebook/posts/${encodeURIComponent(selected.postId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const json = await res.json().catch(() => null)
    setSaving(false)
    if (!res.ok) {
      setError(json?.error || 'Failed to save Facebook post.')
      return
    }
    setSelected(null)
    await load()
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-7xl space-y-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Marketplace</p>
            <h1 className="text-2xl font-bold text-slate-950">Facebook Posting Queue</h1>
            <p className="mt-1 text-sm text-slate-600">Prepare inventory copy, open Facebook Marketplace, and track manual posting status.</p>
          </div>
          <button type="button" onClick={() => void prepareSelected(posts.map((post) => post.vehicleId))} disabled={saving || loading} className="edc-btn-primary text-sm inline-flex items-center gap-2">
            <RefreshCw className="h-4 w-4" />
            Prepare Visible
          </button>
        </div>

        {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

        <div className="grid grid-cols-2 gap-3 md:grid-cols-7">
          {[
            ['Total', filteredSummary.total],
            ['Ready', filteredSummary.ready],
            ['Draft', filteredSummary.draft],
            ['Posted', filteredSummary.posted],
            ['Needs Update', filteredSummary.needsUpdate],
            ['Sold Remove', filteredSummary.soldRemove],
            ['Failed', filteredSummary.failed],
          ].map(([label, value]) => (
            <div key={String(label)} className="rounded-lg border border-slate-200 bg-white p-3">
              <div className="text-xs text-slate-500">{label}</div>
              <div className="mt-1 text-xl font-bold text-slate-950">{String(value)}</div>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-3 md:flex-row">
          <label className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search make, model, VIN, stock, status" className="edc-input pl-9" />
          </label>
          <select value={status} onChange={(event) => setStatus(event.target.value)} className="edc-input md:w-56">
            {STATUS_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </div>

        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <div className="grid grid-cols-[88px_1fr_120px_130px_130px] border-b border-slate-200 bg-slate-50 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
            <div>Photo</div>
            <div>Vehicle</div>
            <div>Readiness</div>
            <div>Status</div>
            <div>Action</div>
          </div>
          {loading ? (
            <div className="p-6 text-sm text-slate-500">Loading Facebook posting queue...</div>
          ) : posts.length === 0 ? (
            <div className="p-6 text-sm text-slate-500">No vehicles match the current filters.</div>
          ) : posts.map((post) => (
            <button key={post.vehicleId} type="button" onClick={() => setSelected(post)} className="grid w-full grid-cols-[88px_1fr_120px_130px_130px] items-center gap-3 border-b border-slate-100 px-4 py-3 text-left hover:bg-slate-50">
              <div>{post.images?.[0] ? <img src={post.images[0]} alt="" className="h-14 w-20 rounded object-cover" /> : <div className="h-14 w-20 rounded bg-slate-100" />}</div>
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-slate-950">{post.title || 'Untitled vehicle'}</div>
                <div className="mt-1 text-xs text-slate-500">{post.stockNumber || 'No stock'} · {post.vin || 'No VIN'} · ${Number(post.price || 0).toLocaleString('en-CA')}</div>
              </div>
              <div className="text-sm font-semibold text-slate-700">{post.readiness?.score || 0}%</div>
              <div className="text-sm text-slate-600">{statusLabel(post.status)}</div>
              <div className="text-sm font-semibold text-[#1EA7FF]">Open</div>
            </button>
          ))}
        </div>
      </div>

      {selected ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/30">
          <button type="button" aria-label="Close drawer" className="flex-1" onClick={() => setSelected(null)} />
          <aside className="h-full w-full max-w-2xl overflow-y-auto bg-white shadow-xl">
            <div className="sticky top-0 z-10 border-b border-slate-200 bg-white px-5 py-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-slate-950">{selected.title}</h2>
                  <p className="text-sm text-slate-500">{statusLabel(selected.status)} · {selected.readiness?.score || 0}% ready</p>
                </div>
                <button type="button" onClick={() => setSelected(null)} className="edc-btn-ghost text-sm">Close</button>
              </div>
            </div>
            <div className="space-y-4 p-5">
              <Field label="Title" value={form.title} onChange={(value) => setForm((prev) => ({ ...prev, title: value }))} onCopy={() => copyText('title', form.title)} />
              <TextArea label="Description" value={form.description} onChange={(value) => setForm((prev) => ({ ...prev, description: value }))} onCopy={() => copyText('description', form.description)} />
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <Field label="Price" value={form.price} onChange={(value) => setForm((prev) => ({ ...prev, price: value }))} onCopy={() => copyText('price', form.price)} />
                <Field label="Location" value={form.location} onChange={(value) => setForm((prev) => ({ ...prev, location: value }))} onCopy={() => copyText('location', form.location)} />
              </div>
              <Field label="Facebook Listing URL" value={form.facebookListingUrl} onChange={(value) => setForm((prev) => ({ ...prev, facebookListingUrl: value }))} />
              <TextArea label="Internal Notes" value={form.notes} onChange={(value) => setForm((prev) => ({ ...prev, notes: value }))} />
              <select value={form.status} onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value }))} className="edc-input">
                {STATUS_OPTIONS.filter((item) => item.value).map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => window.open(facebookMarketplaceUrl, '_blank', 'noopener,noreferrer')} className="edc-btn-primary text-sm inline-flex items-center gap-2">
                  <ExternalLink className="h-4 w-4" />
                  Open Facebook
                </button>
                <button type="button" onClick={() => copyText('vehicle link', selected.publicUrl)} className="edc-btn-ghost text-sm inline-flex items-center gap-2">
                  <Copy className="h-4 w-4" />
                  Copy Vehicle Link
                </button>
                <button type="button" onClick={() => void saveSelected()} disabled={saving} className="edc-btn-primary text-sm inline-flex items-center gap-2">
                  <Save className="h-4 w-4" />
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
              {copied ? <div className="text-sm text-emerald-700">Copied {copied}.</div> : null}
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  )
}

function Field({ label, value, onChange, onCopy }: { label: string; value: string; onChange: (value: string) => void; onCopy?: () => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</span>
      <div className="flex gap-2">
        <input value={value} onChange={(event) => onChange(event.target.value)} className="edc-input" />
        {onCopy ? <button type="button" onClick={onCopy} className="edc-btn-ghost text-sm"><Copy className="h-4 w-4" /></button> : null}
      </div>
    </label>
  )
}

function TextArea({ label, value, onChange, onCopy }: { label: string; value: string; onChange: (value: string) => void; onCopy?: () => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</span>
      <div className="space-y-2">
        <textarea value={value} onChange={(event) => onChange(event.target.value)} rows={8} className="edc-input min-h-40" />
        {onCopy ? <button type="button" onClick={onCopy} className="edc-btn-ghost text-sm inline-flex items-center gap-2"><Copy className="h-4 w-4" />Copy</button> : null}
      </div>
    </label>
  )
}
```

- [ ] **Step 3: Run focused lint**

Run:

```powershell
cd client
npx next lint --file src/app/admin/marketplace/facebook/page.tsx --file src/app/admin/marketplace/facebook/FacebookMarketplaceClient.tsx
cd ..
```

Expected: PASS or only pre-existing warnings unrelated to these files.

- [ ] **Step 4: Commit UI page**

```powershell
git add client/src/app/admin/marketplace/facebook/page.tsx client/src/app/admin/marketplace/facebook/FacebookMarketplaceClient.tsx
git commit -m "Add Facebook marketplace posting queue UI"
```

---

### Task 5: Navigation Entry Points

**Files:**
- Modify: `client/src/app/admin/AdminLayoutClient.tsx`
- Modify: `client/src/app/admin/marketplace/page.tsx`

- [ ] **Step 1: Add sidebar route**

In `client/src/app/admin/AdminLayoutClient.tsx`, change the marketplace nav item to point directly at the posting assistant only if the product owner wants the sidebar shortcut there:

```ts
{ href: '/admin/marketplace/facebook', label: 'FB Posts', icon: 'market', disabled: !isVerified, visible: true },
```

If keeping the current `Market Place` nav destination, leave the existing nav item unchanged and rely on Step 2. The preferred Phase 1 choice is to keep `/admin/marketplace` and add the assistant link there, because `/admin/marketplace` already exists.

- [ ] **Step 2: Add assistant link to marketplace page**

Near the header area in `client/src/app/admin/marketplace/page.tsx`, add:

```tsx
<Link
  href="/admin/marketplace/facebook"
  className="inline-flex items-center justify-center rounded-lg bg-[#1EA7FF] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0d7ed6]"
>
  Facebook Posting Queue
</Link>
```

Add the import at the top if the file does not already import `Link`:

```tsx
import Link from 'next/link'
```

- [ ] **Step 3: Run targeted lint**

Run:

```powershell
cd client
npx next lint --file src/app/admin/AdminLayoutClient.tsx --file src/app/admin/marketplace/page.tsx
cd ..
```

Expected: PASS or existing `<img>` warnings from `admin/marketplace/page.tsx`.

- [ ] **Step 4: Commit navigation**

```powershell
git add client/src/app/admin/AdminLayoutClient.tsx client/src/app/admin/marketplace/page.tsx
git commit -m "Link Facebook posting queue from marketplace admin"
```

---

### Task 6: End-To-End Verification

**Files:**
- No code files unless verification finds a bug.

- [ ] **Step 1: Run focused tests**

Run:

```powershell
node --test client/src/lib/facebookMarketplacePosting.test.mjs scripts/facebook-marketplace-posts-schema.test.mjs
```

Expected: PASS.

- [ ] **Step 2: Run existing adjacent tests**

Run:

```powershell
node --test client/src/lib/vehiclePhotoUrls.test.mjs client/src/lib/inventoryFilters.test.mjs client/src/lib/dealerSelectSync.test.mjs
```

Expected: PASS.

- [ ] **Step 3: Build the client**

Run:

```powershell
cd client
npm run build
cd ..
```

Expected: PASS. Existing warnings about `libheif-js` or Browserslist can be noted if they appear.

- [ ] **Step 4: Apply SQL manually in Supabase**

Run `supabase/edc_facebook_marketplace_posts.sql` in the Supabase SQL editor for the active project.

Verify:

```sql
select count(*)
from public.edc_facebook_marketplace_posts;
```

Expected: returns `0` before staff prepares posts.

- [ ] **Step 5: Start local dev server**

Run:

```powershell
cd client
npm run dev
```

Expected: Next.js starts on an available localhost port.

- [ ] **Step 6: Browser QA with Playwright**

Use Playwright against the local dev server:

1. Sign in to admin if needed using the existing local admin session pattern.
2. Open `/admin/marketplace/facebook`.
3. Confirm the queue loads or shows the setup-pending schema message.
4. Click `Prepare Visible`.
5. Open a vehicle row.
6. Copy title, description, price, and vehicle link.
7. Click `Open Facebook` and confirm a new tab opens to Facebook Marketplace create flow.
8. Add a fake posted URL, set status to `Posted`, save, refresh, and confirm it persists.
9. Clean up any QA rows if real data should remain untouched.

- [ ] **Step 7: Final git status and commit any verification fixes**

Run:

```powershell
git status --short
```

Expected: only intentional feature files are modified. Do not stage `.claude/settings.local.json`, `.gitignore`, or local dev-server logs unless the user explicitly asks.

If verification caused fixes, commit those exact files:

```powershell
git add <intentional files only>
git commit -m "Verify Facebook marketplace posting assistant"
```

---

## Execution Notes

- The first implementation pass must not add direct Facebook automation.
- The app must not store Facebook credentials, cookies, or 2FA data.
- SQL files are ignored in this repo, so use `git add -f` for `supabase/edc_facebook_marketplace_posts.sql`.
- Keep any existing dirty files out of commits unless they are directly part of this feature.
- If the API returns `setupRequired`, apply the SQL migration before continuing browser QA.
