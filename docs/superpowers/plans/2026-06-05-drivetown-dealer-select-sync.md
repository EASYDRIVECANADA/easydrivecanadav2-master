# DriveTown Dealer Select Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a repeatable DriveTown Ottawa scraper/sync that creates a DriveTown dealership account and imports its vehicles into `edc_vehicles` as editable Dealer Select inventory.

**Architecture:** Keep parsing and sync decisions in pure tested `.mjs` helpers under `client/src/lib`, then wire them to Supabase from a root `scripts/sync-drivetown.js` worker for Kamatera cron. The worker writes directly to Supabase with the service role key, supports dry runs, scopes all writes to the DriveTown `user_id`, and marks missing synced vehicles sold only after complete listing discovery.

**Tech Stack:** Node 20+, built-in `fetch`, `node:test`, `cheerio` for HTML parsing, `@supabase/supabase-js`, Supabase `edc_vehicles`, existing `users` and `dealership` tables.

---

## File Structure

- Create `client/src/lib/drivetownScraper.mjs`: Pure HTML parsing, URL discovery, detail normalization, live fetch orchestration.
- Create `client/src/lib/drivetownScraper.test.mjs`: Unit tests for listing/detail fixture parsing and fetch error behavior.
- Create `client/src/lib/fixtures/drivetown-listing.html`: Small listing fixture with two vehicle cards and a total count marker.
- Create `client/src/lib/fixtures/drivetown-detail.html`: Detail fixture with VIN, stock, price, mileage, specs, features, and image URLs.
- Create `client/src/lib/dealerSelectSync.mjs`: Pure DriveTown account rows, vehicle row mapping, match keys, edit-preservation decisions, and missing-vehicle marking decisions.
- Create `client/src/lib/dealerSelectSync.test.mjs`: Unit tests for account rows, Dealer Select rows, match priority, edit preservation, and sold marking safeguards.
- Create `scripts/sync-drivetown.js`: Kamatera worker that imports helpers, scrapes DriveTown, creates/updates account/profile rows, reads existing synced rows, inserts/updates vehicles, marks missing vehicles sold, logs counts, and supports dry run.
- Modify `package.json` and `package-lock.json`: Add `cheerio` to root dependencies.

---

### Task 1: Add HTML Parser Dependency

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`

- [ ] **Step 1: Install `cheerio` at the repo root**

Run:

```powershell
npm install cheerio
```

Expected: `package.json` gains a root dependency like `"cheerio": "^1.x.x"` and `package-lock.json` updates.

- [ ] **Step 2: Verify the dependency can load in Node**

Run:

```powershell
node -e "const { load } = require('cheerio'); const $ = load('<h1>ok</h1>'); console.log($('h1').text())"
```

Expected:

```text
ok
```

- [ ] **Step 3: Commit**

Run:

```powershell
git add package.json package-lock.json
git commit -m "chore: add html parser for dealer sync"
```

Expected: commit succeeds.

---

### Task 2: DriveTown Scraper Parser

**Files:**
- Create: `client/src/lib/fixtures/drivetown-listing.html`
- Create: `client/src/lib/fixtures/drivetown-listing-page-2.html`
- Create: `client/src/lib/fixtures/drivetown-detail.html`
- Create: `client/src/lib/drivetownScraper.test.mjs`
- Create: `client/src/lib/drivetownScraper.mjs`

- [ ] **Step 1: Add listing fixture**

Create `client/src/lib/fixtures/drivetown-listing.html`:

```html
<!doctype html>
<html>
  <body>
    <div class="inventory-count">Showing 1-2 of 148 vehicles</div>
    <a class="vehicle-card" href="/vehicles/2019-ford-f-150-xlt-a1234/">2019 Ford F-150 XLT</a>
    <a class="vehicle-card" href="https://drivetownottawa.com/vehicles/2021-honda-civic-ex-b5678/">2021 Honda Civic EX</a>
    <a href="/financing/">Financing</a>
  </body>
</html>
```

Also create `client/src/lib/fixtures/drivetown-listing-page-2.html`:

```html
<!doctype html>
<html>
  <body>
    <div class="inventory-count">Showing 3-3 of 3 vehicles</div>
    <a class="vehicle-card" href="/vehicles/2022-toyota-rav4-le-c9012/">2022 Toyota RAV4 LE</a>
  </body>
</html>
```

- [ ] **Step 2: Add detail fixture**

Create `client/src/lib/fixtures/drivetown-detail.html`:

```html
<!doctype html>
<html>
  <head>
    <meta property="og:title" content="2019 Ford F-150 XLT 4WD" />
    <meta property="og:image" content="https://images.example.com/f150-main.jpg" />
  </head>
  <body>
    <h1>2019 Ford F-150 XLT 4WD</h1>
    <div class="price">$32,995</div>
    <div class="finance">$214 bi-weekly</div>
    <dl>
      <dt>VIN</dt><dd>1FTEW1E50KFA12345</dd>
      <dt>Stock #</dt><dd>A1234</dd>
      <dt>Mileage</dt><dd>91,200 km</dd>
      <dt>Transmission</dt><dd>Automatic</dd>
      <dt>Drivetrain</dt><dd>4WD</dd>
      <dt>Fuel Type</dt><dd>Gasoline</dd>
      <dt>Body Style</dt><dd>Truck</dd>
      <dt>Exterior Colour</dt><dd>Black</dd>
      <dt>Interior Colour</dt><dd>Grey</dd>
    </dl>
    <section class="description">Clean local truck with heated seats and backup camera.</section>
    <ul class="features">
      <li>Heated Seats</li>
      <li>Backup Camera</li>
    </ul>
    <img src="https://images.example.com/f150-main.jpg" />
    <img src="/wp-content/uploads/f150-side.jpg" />
  </body>
</html>
```

- [ ] **Step 3: Write failing scraper tests**

Create `client/src/lib/drivetownScraper.test.mjs`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

import {
  cleanNumber,
  discoverDriveTownDetailUrls,
  parseDriveTownDetail,
  parseDriveTownListing,
} from './drivetownScraper.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const fixture = (name) => readFile(path.join(__dirname, 'fixtures', name), 'utf8')

test('cleanNumber extracts dollars and kilometers', () => {
  assert.equal(cleanNumber('$32,995'), 32995)
  assert.equal(cleanNumber('91,200 km'), 91200)
  assert.equal(cleanNumber('Call for price'), null)
})

test('parseDriveTownListing returns absolute detail URLs and source total', async () => {
  const html = await fixture('drivetown-listing.html')
  const result = parseDriveTownListing(html, 'https://drivetownottawa.com/vehicles/')

  assert.equal(result.totalCount, 148)
  assert.deepEqual(result.detailUrls, [
    'https://drivetownottawa.com/vehicles/2019-ford-f-150-xlt-a1234/',
    'https://drivetownottawa.com/vehicles/2021-honda-civic-ex-b5678/',
  ])
})

test('discoverDriveTownDetailUrls follows inventory pages until source total is reached', async () => {
  const page1 = await fixture('drivetown-listing.html')
  const page2 = await fixture('drivetown-listing-page-2.html')
  const calls = []
  const fetchImpl = async (url) => {
    calls.push(url)
    return {
      ok: true,
      text: async () => calls.length === 1 ? page1.replace('148 vehicles', '3 vehicles') : page2,
    }
  }

  const result = await discoverDriveTownDetailUrls({ fetchImpl })

  assert.equal(result.completeListing, true)
  assert.equal(result.totalCount, 3)
  assert.equal(result.detailUrls.length, 3)
  assert.deepEqual(calls, [
    'https://drivetownottawa.com/vehicles/',
    'https://drivetownottawa.com/vehicles/page/2/',
  ])
})

test('parseDriveTownDetail normalizes vehicle detail fields', async () => {
  const html = await fixture('drivetown-detail.html')
  const vehicle = parseDriveTownDetail(html, 'https://drivetownottawa.com/vehicles/2019-ford-f-150-xlt-a1234/')

  assert.equal(vehicle.sourceUrl, 'https://drivetownottawa.com/vehicles/2019-ford-f-150-xlt-a1234/')
  assert.equal(vehicle.year, 2019)
  assert.equal(vehicle.make, 'Ford')
  assert.equal(vehicle.model, 'F-150')
  assert.equal(vehicle.trim, 'XLT 4WD')
  assert.equal(vehicle.vin, '1FTEW1E50KFA12345')
  assert.equal(vehicle.stockNumber, 'A1234')
  assert.equal(vehicle.price, 32995)
  assert.equal(vehicle.mileage, 91200)
  assert.equal(vehicle.transmission, 'Automatic')
  assert.equal(vehicle.drivetrain, '4WD')
  assert.equal(vehicle.fuelType, 'Gasoline')
  assert.equal(vehicle.bodyStyle, 'Truck')
  assert.equal(vehicle.exteriorColor, 'Black')
  assert.equal(vehicle.interiorColor, 'Grey')
  assert.match(vehicle.description, /Clean local truck/)
  assert.deepEqual(vehicle.features, ['Heated Seats', 'Backup Camera'])
  assert.deepEqual(vehicle.imageUrls, [
    'https://images.example.com/f150-main.jpg',
    'https://drivetownottawa.com/wp-content/uploads/f150-side.jpg',
  ])
})
```

- [ ] **Step 4: Run tests to verify they fail**

Run:

```powershell
node --test client/src/lib/drivetownScraper.test.mjs
```

Expected: FAIL with module not found for `./drivetownScraper.mjs`.

- [ ] **Step 5: Implement scraper helper**

Create `client/src/lib/drivetownScraper.mjs`:

```js
import { load } from 'cheerio'

export const DRIVETOWN_BASE_URL = 'https://drivetownottawa.com'
export const DRIVETOWN_INVENTORY_URL = `${DRIVETOWN_BASE_URL}/vehicles/`

const clean = (value) => String(value ?? '').replace(/\s+/g, ' ').trim()

export function cleanNumber(value) {
  const raw = clean(value).replace(/[^0-9.]/g, '')
  if (!raw) return null
  const num = Number(raw)
  return Number.isFinite(num) ? num : null
}

const absoluteUrl = (href, baseUrl = DRIVETOWN_INVENTORY_URL) => {
  try {
    return new URL(href, baseUrl).toString()
  } catch {
    return ''
  }
}

const unique = (items) => [...new Set(items.filter(Boolean))]

export function parseDriveTownListing(html, pageUrl = DRIVETOWN_INVENTORY_URL) {
  const $ = load(html)
  const bodyText = clean($('body').text())
  const totalMatch = bodyText.match(/of\s+([0-9,]+)\s+vehicles/i)
  const totalCount = totalMatch ? cleanNumber(totalMatch[1]) : null

  const detailUrls = unique(
    $('a[href]')
      .toArray()
      .map((el) => absoluteUrl($(el).attr('href'), pageUrl))
      .filter((url) => {
        if (!url.startsWith(`${DRIVETOWN_BASE_URL}/vehicles/`)) return false
        if (url === DRIVETOWN_INVENTORY_URL) return false
        return /\/vehicles\/[^/?#]+\/?$/i.test(url)
      })
  )

  return { detailUrls, totalCount }
}

const dlValue = ($, label) => {
  const target = label.toLowerCase()
  let found = ''
  $('dt').each((_, el) => {
    if (found) return
    const key = clean($(el).text()).toLowerCase()
    if (key === target || key.replace(/[#:]/g, '').trim() === target.replace(/[#:]/g, '').trim()) {
      found = clean($(el).next('dd').text())
    }
  })
  return found
}

const inferTitleParts = (title) => {
  const parts = clean(title).split(/\s+/)
  const year = Number(parts[0])
  const make = parts[1] || ''
  const model = parts[2] || ''
  const trim = parts.slice(3).join(' ')
  return {
    year: Number.isInteger(year) ? year : null,
    make,
    model,
    trim: trim || null,
  }
}

export function parseDriveTownDetail(html, detailUrl) {
  const $ = load(html)
  const title = clean($('h1').first().text() || $('meta[property="og:title"]').attr('content'))
  const titleParts = inferTitleParts(title)

  const imageUrls = unique([
    $('meta[property="og:image"]').attr('content'),
    ...$('img[src]').toArray().map((el) => $(el).attr('src')),
  ].map((src) => absoluteUrl(src, detailUrl)))

  const features = unique($('.features li, [class*="feature"] li')
    .toArray()
    .map((el) => clean($(el).text())))

  const description = clean($('.description, [class*="description"]').first().text())

  return {
    sourceName: 'DriveTown Ottawa',
    sourceUrl: detailUrl,
    sourceVehicleId: detailUrl.split('/').filter(Boolean).pop() || detailUrl,
    title,
    year: titleParts.year,
    make: titleParts.make,
    model: titleParts.model,
    trim: titleParts.trim,
    vin: clean(dlValue($, 'VIN')).toUpperCase(),
    stockNumber: clean(dlValue($, 'Stock #') || dlValue($, 'Stock')),
    price: cleanNumber($('.price, [class*="price"]').first().text()),
    financePriceText: clean($('.finance, [class*="finance"]').first().text()) || null,
    mileage: cleanNumber(dlValue($, 'Mileage')),
    transmission: dlValue($, 'Transmission'),
    drivetrain: dlValue($, 'Drivetrain'),
    fuelType: dlValue($, 'Fuel Type'),
    bodyStyle: dlValue($, 'Body Style'),
    exteriorColor: dlValue($, 'Exterior Colour') || dlValue($, 'Exterior Color'),
    interiorColor: dlValue($, 'Interior Colour') || dlValue($, 'Interior Color'),
    description,
    features,
    imageUrls,
  }
}

export async function fetchText(url, fetchImpl = fetch) {
  const res = await fetchImpl(url, {
    headers: {
      'user-agent': 'EasyDriveCanadaBot/1.0 (+https://easydrivecanada.com)',
      accept: 'text/html,application/xhtml+xml',
    },
  })
  if (!res.ok) throw new Error(`GET ${url} failed with ${res.status}`)
  return res.text()
}

export function inventoryPageUrl(pageNumber, inventoryUrl = DRIVETOWN_INVENTORY_URL) {
  if (pageNumber <= 1) return inventoryUrl
  return new URL(`page/${pageNumber}/`, inventoryUrl).toString()
}

export async function discoverDriveTownDetailUrls({
  fetchImpl = fetch,
  inventoryUrl = DRIVETOWN_INVENTORY_URL,
  maxPages = 20,
} = {}) {
  const allUrls = []
  let totalCount = null

  for (let pageNumber = 1; pageNumber <= maxPages; pageNumber += 1) {
    const pageUrl = inventoryPageUrl(pageNumber, inventoryUrl)
    const html = await fetchText(pageUrl, fetchImpl)
    const parsed = parseDriveTownListing(html, pageUrl)
    if (parsed.totalCount && !totalCount) totalCount = parsed.totalCount

    const before = allUrls.length
    for (const url of parsed.detailUrls) {
      if (!allUrls.includes(url)) allUrls.push(url)
    }

    if (totalCount && allUrls.length >= totalCount) break
    if (allUrls.length === before && pageNumber > 1) break
  }

  return {
    detailUrls: allUrls,
    totalCount,
    completeListing: allUrls.length > 0 && (!totalCount || allUrls.length >= totalCount),
  }
}

export async function scrapeDriveTownInventory({ fetchImpl = fetch, inventoryUrl = DRIVETOWN_INVENTORY_URL } = {}) {
  const listing = await discoverDriveTownDetailUrls({ fetchImpl, inventoryUrl })
  const vehicles = []
  const failures = []

  for (const detailUrl of listing.detailUrls) {
    try {
      const detailHtml = await fetchText(detailUrl, fetchImpl)
      vehicles.push(parseDriveTownDetail(detailHtml, detailUrl))
    } catch (error) {
      failures.push({ url: detailUrl, error: error instanceof Error ? error.message : String(error) })
    }
  }

  return {
    completeListing: listing.completeListing,
    totalCount: listing.totalCount,
    detailUrls: listing.detailUrls,
    vehicles,
    failures,
  }
}
```

- [ ] **Step 6: Run scraper tests to verify they pass**

Run:

```powershell
node --test client/src/lib/drivetownScraper.test.mjs
```

Expected: PASS, 4 tests.

- [ ] **Step 7: Commit**

Run:

```powershell
git add client/src/lib/drivetownScraper.mjs client/src/lib/drivetownScraper.test.mjs client/src/lib/fixtures/drivetown-listing.html client/src/lib/fixtures/drivetown-listing-page-2.html client/src/lib/fixtures/drivetown-detail.html
git commit -m "test: add DriveTown scraper parser"
```

Expected: commit succeeds.

---

### Task 3: Dealer Select Sync Mapping

**Files:**
- Create: `client/src/lib/dealerSelectSync.test.mjs`
- Create: `client/src/lib/dealerSelectSync.mjs`

- [ ] **Step 1: Write failing sync mapping tests**

Create `client/src/lib/dealerSelectSync.test.mjs`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'

import {
  DRIVE_TOWN_SYNC_MARKER,
  buildDriveTownDealershipRow,
  buildDriveTownOwnerRow,
  buildVehicleUpsertRow,
  chooseExistingVehicle,
  computeMissingSyncedVehicles,
  shouldPreserveEditableFields,
} from './dealerSelectSync.mjs'

const scraped = {
  sourceName: 'DriveTown Ottawa',
  sourceUrl: 'https://drivetownottawa.com/vehicles/2019-ford-f-150-xlt-a1234/',
  sourceVehicleId: '2019-ford-f-150-xlt-a1234',
  title: '2019 Ford F-150 XLT 4WD',
  year: 2019,
  make: 'Ford',
  model: 'F-150',
  trim: 'XLT 4WD',
  vin: '1FTEW1E50KFA12345',
  stockNumber: 'A1234',
  price: 32995,
  mileage: 91200,
  transmission: 'Automatic',
  drivetrain: '4WD',
  fuelType: 'Gasoline',
  bodyStyle: 'Truck',
  exteriorColor: 'Black',
  interiorColor: 'Grey',
  description: 'Clean local truck.',
  features: ['Heated Seats'],
  imageUrls: ['https://images.example.com/f150-main.jpg'],
}

test('builds DriveTown dealership account rows', () => {
  assert.deepEqual(buildDriveTownOwnerRow('dealer-user-1'), {
    user_id: 'dealer-user-1',
    email: 'inventory@drivetownottawa.com',
    first_name: 'DriveTown',
    last_name: 'Ottawa',
    title: 'Owner',
    role: 'Medium dealership',
    status: 'enable',
  })

  assert.equal(buildDriveTownDealershipRow('dealer-user-1').company_name, 'DriveTown Ottawa')
  assert.equal(buildDriveTownDealershipRow('dealer-user-1').website, 'https://drivetownottawa.com/')
})

test('maps scraped vehicle to editable Dealer Select row', () => {
  const now = '2026-06-05T00:00:00.000Z'
  const row = buildVehicleUpsertRow(scraped, {
    userId: 'dealer-user-1',
    now,
    supportsDealerSelectType: true,
  })

  assert.equal(row.user_id, 'dealer-user-1')
  assert.equal(row.inventory_type, 'DEALER_SELECT')
  assert.equal(row.categories, 'dealer_select')
  assert.equal(row.status, 'In Stock')
  assert.equal(row.notes, DRIVE_TOWN_SYNC_MARKER)
  assert.equal(row.make, 'Ford')
  assert.equal(row.stock_number, 'A1234')
  assert.equal(row.vin, '1FTEW1E50KFA12345')
  assert.equal(row.price, 32995)
  assert.equal(row.mileage, 91200)
  assert.equal(row.odometer, 91200)
  assert.equal(row.source_name, 'DriveTown Ottawa')
  assert.equal(row.source_url, scraped.sourceUrl)
  assert.deepEqual(row.images, scraped.imageUrls)
})

test('falls back when DEALER_SELECT enum is not available', () => {
  const row = buildVehicleUpsertRow(scraped, {
    userId: 'dealer-user-1',
    now: '2026-06-05T00:00:00.000Z',
    supportsDealerSelectType: false,
  })

  assert.equal(row.inventory_type, 'FLEET')
  assert.equal(row.categories, 'dealer_select')
})

test('chooses existing vehicle by source URL then VIN then stock scoped to dealer', () => {
  const existing = [
    { id: 'stock-hit', user_id: 'dealer-user-1', stock_number: 'A1234', vin: 'OTHER', source_url: null },
    { id: 'vin-hit', user_id: 'dealer-user-1', stock_number: 'OTHER', vin: scraped.vin, source_url: null },
    { id: 'source-hit', user_id: 'dealer-user-1', stock_number: 'OTHER', vin: 'OTHER', source_url: scraped.sourceUrl },
    { id: 'other-dealer', user_id: 'dealer-user-2', stock_number: 'A1234', vin: scraped.vin, source_url: scraped.sourceUrl },
  ]

  assert.equal(chooseExistingVehicle(scraped, existing, 'dealer-user-1')?.id, 'source-hit')
})

test('preserves editable fields when row was manually edited after last sync', () => {
  const existing = {
    updated_at: '2026-06-05T02:00:00.000Z',
    source_last_synced_at: '2026-06-05T01:00:00.000Z',
  }

  assert.equal(shouldPreserveEditableFields(existing), true)
})

test('marks only previously synced missing vehicles as sold after complete scrape', () => {
  const previous = [
    { id: 'still-present', source_url: scraped.sourceUrl, notes: DRIVE_TOWN_SYNC_MARKER },
    { id: 'missing', source_url: 'https://drivetownottawa.com/vehicles/missing/', notes: DRIVE_TOWN_SYNC_MARKER },
    { id: 'manual', source_url: '', notes: '' },
  ]

  assert.deepEqual(
    computeMissingSyncedVehicles(previous, [scraped], { completeListing: true }).map((row) => row.id),
    ['missing']
  )
  assert.deepEqual(computeMissingSyncedVehicles(previous, [scraped], { completeListing: false }), [])
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```powershell
node --test client/src/lib/dealerSelectSync.test.mjs
```

Expected: FAIL with module not found for `./dealerSelectSync.mjs`.

- [ ] **Step 3: Implement sync mapping helper**

Create `client/src/lib/dealerSelectSync.mjs`:

```js
export const DRIVE_TOWN_SYNC_MARKER = 'Imported from DriveTown Ottawa feed'
export const DRIVE_TOWN_SOURCE_NAME = 'DriveTown Ottawa'
export const DRIVE_TOWN_WEBSITE = 'https://drivetownottawa.com/'
export const DRIVE_TOWN_EMAIL = 'inventory@drivetownottawa.com'

const clean = (value) => String(value ?? '').trim()
const upper = (value) => clean(value).toUpperCase()

const uuid = () => {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export function buildDriveTownOwnerRow(userId) {
  return {
    user_id: userId,
    email: DRIVE_TOWN_EMAIL,
    first_name: 'DriveTown',
    last_name: 'Ottawa',
    title: 'Owner',
    role: 'Medium dealership',
    status: 'enable',
  }
}

export function buildDriveTownDealershipRow(userId) {
  return {
    user_id: userId,
    company_name: DRIVE_TOWN_SOURCE_NAME,
    phone: null,
    email: DRIVE_TOWN_EMAIL,
    province: 'ON',
    website: DRIVE_TOWN_WEBSITE,
    auto_close_deals_in: 'Dealer Select source account; inventory synced from DriveTown Ottawa website',
  }
}

export function buildVehicleUpsertRow(vehicle, { userId, now, supportsDealerSelectType = true } = {}) {
  const mileage = Number(vehicle.mileage || 0)
  const description = clean(vehicle.description || vehicle.title)

  return {
    user_id: userId,
    make: clean(vehicle.make),
    model: clean(vehicle.model),
    year: Number(vehicle.year || 0),
    trim: clean(vehicle.trim) || null,
    stock_number: clean(vehicle.stockNumber) || null,
    series: clean(vehicle.trim) || null,
    equipment: clean(vehicle.title) || null,
    vin: upper(vehicle.vin),
    price: Number(vehicle.price || 0),
    mileage,
    odometer: mileage,
    odometer_unit: 'kms',
    status: 'In Stock',
    inventory_type: supportsDealerSelectType ? 'DEALER_SELECT' : 'FLEET',
    categories: 'dealer_select',
    condition: 'Used',
    exterior_color: clean(vehicle.exteriorColor) || null,
    interior_color: clean(vehicle.interiorColor) || null,
    transmission: clean(vehicle.transmission) || null,
    drivetrain: clean(vehicle.drivetrain) || null,
    fuel_type: clean(vehicle.fuelType) || null,
    body_style: clean(vehicle.bodyStyle) || null,
    description,
    ad_description: description,
    features: Array.isArray(vehicle.features) ? vehicle.features : [],
    images: Array.isArray(vehicle.imageUrls) ? vehicle.imageUrls : [],
    city: 'Ottawa',
    province: 'ON',
    notes: DRIVE_TOWN_SYNC_MARKER,
    source_name: DRIVE_TOWN_SOURCE_NAME,
    source_url: clean(vehicle.sourceUrl),
    source_vehicle_id: clean(vehicle.sourceVehicleId),
    source_last_seen_at: now,
    source_last_synced_at: now,
    source_sync_status: 'active',
    updated_at: now,
    created_at: now,
    vehicleId: uuid(),
  }
}

export function chooseExistingVehicle(vehicle, existingRows, userId) {
  const scoped = (existingRows || []).filter((row) => clean(row.user_id) === clean(userId))
  const sourceUrl = clean(vehicle.sourceUrl)
  const vin = upper(vehicle.vin)
  const stock = upper(vehicle.stockNumber)

  return (
    scoped.find((row) => clean(row.source_url) && clean(row.source_url) === sourceUrl) ||
    scoped.find((row) => upper(row.vin) && upper(row.vin) === vin) ||
    scoped.find((row) => upper(row.stock_number) && upper(row.stock_number) === stock) ||
    null
  )
}

export function shouldPreserveEditableFields(existingRow) {
  const updatedAt = Date.parse(clean(existingRow?.updated_at))
  const syncedAt = Date.parse(clean(existingRow?.source_last_synced_at))
  if (!Number.isFinite(updatedAt) || !Number.isFinite(syncedAt)) return false
  return updatedAt > syncedAt
}

export function mergePreservingEditableFields(nextRow, existingRow) {
  if (!shouldPreserveEditableFields(existingRow)) return nextRow

  return {
    ...nextRow,
    price: existingRow.price,
    description: existingRow.description,
    ad_description: existingRow.ad_description,
    features: existingRow.features,
    images: existingRow.images,
    body_style: existingRow.body_style,
    fuel_type: existingRow.fuel_type,
    transmission: existingRow.transmission,
    drivetrain: existingRow.drivetrain,
    status: existingRow.status,
    notes: existingRow.notes || DRIVE_TOWN_SYNC_MARKER,
  }
}

export function computeMissingSyncedVehicles(previousRows, scrapedVehicles, { completeListing } = {}) {
  if (!completeListing) return []
  const currentSourceUrls = new Set((scrapedVehicles || []).map((vehicle) => clean(vehicle.sourceUrl)).filter(Boolean))

  return (previousRows || []).filter((row) => {
    const hasMarker = clean(row.notes) === DRIVE_TOWN_SYNC_MARKER || clean(row.source_name) === DRIVE_TOWN_SOURCE_NAME
    const sourceUrl = clean(row.source_url)
    return hasMarker && sourceUrl && !currentSourceUrls.has(sourceUrl)
  })
}
```

- [ ] **Step 4: Run sync mapping tests to verify they pass**

Run:

```powershell
node --test client/src/lib/dealerSelectSync.test.mjs
```

Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

Run:

```powershell
git add client/src/lib/dealerSelectSync.mjs client/src/lib/dealerSelectSync.test.mjs
git commit -m "test: add Dealer Select sync mapping"
```

Expected: commit succeeds.

---

### Task 4: Kamatera Supabase Worker

**Files:**
- Create: `scripts/sync-drivetown.js`

- [ ] **Step 1: Create the worker**

Create `scripts/sync-drivetown.js`:

```js
#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js')

const clean = (value) => String(value ?? '').trim()

async function main() {
  const startedAt = new Date()
  const dryRun = ['1', 'true', 'yes'].includes(clean(process.env.DRIVETOWN_SYNC_DRY_RUN).toLowerCase())
  const supabaseUrl = clean(process.env.NEXT_PUBLIC_SUPABASE_URL).replace(/\/+$/, '')
  const supabaseKey = clean(process.env.SUPABASE_SERVICE_ROLE_KEY)
  const configuredUserId = clean(process.env.DRIVETOWN_DEALER_USER_ID)

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required')
  }

  const scraper = await import('../client/src/lib/drivetownScraper.mjs')
  const sync = await import('../client/src/lib/dealerSelectSync.mjs')

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })

  const account = await ensureDriveTownAccount(supabase, sync, configuredUserId, dryRun)
  const userId = account.userId
  if (!userId) throw new Error('DriveTown account user_id could not be resolved')

  const scrape = await scraper.scrapeDriveTownInventory()
  if (!scrape.detailUrls.length) throw new Error('DriveTown listing discovery returned zero vehicle URLs')

  const supportsDealerSelectType = dryRun ? true : await detectDealerSelectSupport(supabase, sync, userId)
  const now = new Date().toISOString()
  const existingRows = await loadExistingDriveTownRows(supabase, userId)

  const counts = {
    listingUrls: scrape.detailUrls.length,
    scraped: scrape.vehicles.length,
    failed: scrape.failures.length,
    inserted: 0,
    updated: 0,
    preserved: 0,
    markedSold: 0,
  }

  for (const vehicle of scrape.vehicles) {
    const existing = sync.chooseExistingVehicle(vehicle, existingRows, userId)
    const baseRow = sync.buildVehicleUpsertRow(vehicle, { userId, now, supportsDealerSelectType })
    const row = existing ? sync.mergePreservingEditableFields(baseRow, existing) : baseRow

    if (existing && sync.shouldPreserveEditableFields(existing)) counts.preserved += 1

    if (dryRun) {
      if (existing) counts.updated += 1
      else counts.inserted += 1
      continue
    }

    if (existing?.id) {
      const { error } = await supabase.from('edc_vehicles').update({
        ...row,
        created_at: existing.created_at || row.created_at,
        vehicleId: existing.vehicleId || row.vehicleId,
      }).eq('id', existing.id)
      if (error) throw error
      counts.updated += 1
    } else {
      const { error } = await supabase.from('edc_vehicles').insert(row)
      if (error) {
        if (String(error.message || '').includes('DEALER_SELECT')) {
          const fallback = sync.buildVehicleUpsertRow(vehicle, { userId, now, supportsDealerSelectType: false })
          const { error: fallbackError } = await supabase.from('edc_vehicles').insert(fallback)
          if (fallbackError) throw fallbackError
        } else {
          throw error
        }
      }
      counts.inserted += 1
    }
  }

  const missing = sync.computeMissingSyncedVehicles(existingRows, scrape.vehicles, {
    completeListing: scrape.detailUrls.length > 0 && scrape.failures.length <= Math.max(3, Math.floor(scrape.detailUrls.length * 0.05)),
  })

  counts.markedSold = missing.length
  if (!dryRun && missing.length) {
    for (const row of missing) {
      const { error } = await supabase.from('edc_vehicles').update({
        status: 'Sold',
        source_sync_status: 'missing',
        source_last_synced_at: now,
        updated_at: now,
      }).eq('id', row.id)
      if (error) throw error
    }
  }

  const endedAt = new Date()
  console.log(JSON.stringify({
    source: sync.DRIVE_TOWN_SOURCE_NAME,
    dryRun,
    startedAt: startedAt.toISOString(),
    endedAt: endedAt.toISOString(),
    durationMs: endedAt.getTime() - startedAt.getTime(),
    account,
    counts,
    failures: scrape.failures.slice(0, 20),
  }, null, 2))
}

async function ensureDriveTownAccount(supabase, sync, configuredUserId, dryRun) {
  if (configuredUserId) {
    return { userId: configuredUserId, configured: true }
  }

  const ownerRow = sync.buildDriveTownOwnerRow(globalThis.crypto?.randomUUID?.() || `${Date.now()}`)
  const { data: existingOwner, error: ownerLookupError } = await supabase
    .from('users')
    .select('id,user_id')
    .ilike('email', ownerRow.email)
    .limit(1)
    .maybeSingle()

  if (ownerLookupError) throw ownerLookupError

  let userId = clean(existingOwner?.user_id || ownerRow.user_id)
  if (dryRun) return { userId, configured: false, dryRunCreated: !existingOwner }

  if (existingOwner?.id) {
    const { error } = await supabase.from('users').update(sync.buildDriveTownOwnerRow(userId)).eq('id', existingOwner.id)
    if (error) throw error
  } else {
    const { data, error } = await supabase.from('users').insert({
      ...sync.buildDriveTownOwnerRow(userId),
      created_at: new Date().toISOString(),
    }).select('id,user_id').single()
    if (error) throw error
    userId = clean(data?.user_id || userId)
  }

  const profileRow = sync.buildDriveTownDealershipRow(userId)
  const { data: existingDealer, error: dealerLookupError } = await supabase
    .from('dealership')
    .select('id')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle()

  if (dealerLookupError) throw dealerLookupError
  if (existingDealer?.id) {
    const { error } = await supabase.from('dealership').update(profileRow).eq('id', existingDealer.id)
    if (error) throw error
  } else {
    const { error } = await supabase.from('dealership').insert(profileRow)
    if (error) throw error
  }

  return { userId, configured: false }
}

async function detectDealerSelectSupport(supabase, sync, userId) {
  const probe = sync.buildVehicleUpsertRow({
    sourceUrl: 'probe',
    sourceVehicleId: 'probe',
    title: '2020 Test Probe',
    year: 2020,
    make: 'Test',
    model: 'Probe',
    vin: `PROBE${Date.now()}`,
    stockNumber: `PROBE${Date.now()}`,
    price: 1,
    mileage: 1,
  }, { userId, now: new Date().toISOString(), supportsDealerSelectType: true })

  const { error } = await supabase.from('edc_vehicles').insert(probe)
  if (!error) {
    await supabase.from('edc_vehicles').delete().eq('vin', probe.vin)
    return true
  }
  return !String(error.message || '').includes('DEALER_SELECT') && !String(error.message || '').includes('inventory_type')
}

async function loadExistingDriveTownRows(supabase, userId) {
  const { data, error } = await supabase
    .from('edc_vehicles')
    .select('*')
    .eq('user_id', userId)
    .or('notes.eq.Imported from DriveTown Ottawa feed,source_name.eq.DriveTown Ottawa,categories.eq.dealer_select')
    .limit(1000)

  if (error) throw error
  return Array.isArray(data) ? data : []
}

main().catch((error) => {
  console.error('[sync-drivetown] failed:', error)
  process.exit(1)
})
```

- [ ] **Step 2: Run dry script without env to verify required env error**

Run:

```powershell
node scripts/sync-drivetown.js
```

Expected: FAIL with `NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required`.

- [ ] **Step 3: Run helper tests together**

Run:

```powershell
node --test client/src/lib/drivetownScraper.test.mjs client/src/lib/dealerSelectSync.test.mjs
```

Expected: PASS for all scraper and sync tests.

- [ ] **Step 4: Commit**

Run:

```powershell
git add scripts/sync-drivetown.js
git commit -m "feat: add DriveTown sync worker"
```

Expected: commit succeeds.

---

### Task 5: Live Dry Run And Schema Compatibility

**Files:**
- Modify: `client/src/lib/dealerSelectSync.mjs` only if live schema rejects new source columns.
- Modify: `scripts/sync-drivetown.js` only if live schema rejects new source columns.

- [ ] **Step 1: Run a no-write live dry run**

Run from the repo root after setting real environment values in the current shell:

```powershell
if (-not $env:NEXT_PUBLIC_SUPABASE_URL) { throw "Set NEXT_PUBLIC_SUPABASE_URL first" }
if (-not $env:SUPABASE_SERVICE_ROLE_KEY) { throw "Set SUPABASE_SERVICE_ROLE_KEY first" }
$env:DRIVETOWN_SYNC_DRY_RUN="1"
node scripts/sync-drivetown.js
```

Expected: PASS and print JSON with nonzero `counts.listingUrls` and `counts.scraped`. `counts.inserted` and `counts.updated` are simulated because dry run is enabled.

- [ ] **Step 2: If source metadata columns are missing, add compatibility stripping**

If Supabase errors mention missing columns such as `source_name`, `source_url`, `source_vehicle_id`, `source_last_seen_at`, `source_last_synced_at`, or `source_sync_status`, update `scripts/sync-drivetown.js` before writes:

```js
const SOURCE_COLUMNS = [
  'source_name',
  'source_url',
  'source_vehicle_id',
  'source_last_seen_at',
  'source_last_synced_at',
  'source_sync_status',
]

function stripSourceColumns(row) {
  const copy = { ...row }
  for (const key of SOURCE_COLUMNS) delete copy[key]
  copy.notes = [copy.notes, `source_url=${row.source_url}`, `source_vehicle_id=${row.source_vehicle_id}`]
    .filter(Boolean)
    .join('; ')
  return copy
}
```

Then wrap insert/update payloads with `stripSourceColumns(row)` when the schema does not support source metadata. Keep `notes` containing the DriveTown marker and source URL.

- [ ] **Step 3: Re-run dry run after compatibility changes**

Run:

```powershell
$env:DRIVETOWN_SYNC_DRY_RUN="1"
node scripts/sync-drivetown.js
```

Expected: PASS and print JSON counts. No Supabase writes occur.

- [ ] **Step 4: Commit compatibility changes when files changed**

Run:

```powershell
git add scripts/sync-drivetown.js client/src/lib/dealerSelectSync.mjs
git commit -m "fix: support deployed Dealer Select schema"
```

Expected: commit succeeds when files changed. Skip this command when `git diff -- scripts/sync-drivetown.js client/src/lib/dealerSelectSync.mjs` shows no changes.

---

### Task 6: Controlled Write Sync

**Files:**
- No planned source edits.

- [ ] **Step 1: Run the first real sync**

Run:

```powershell
if (-not $env:NEXT_PUBLIC_SUPABASE_URL) { throw "Set NEXT_PUBLIC_SUPABASE_URL first" }
if (-not $env:SUPABASE_SERVICE_ROLE_KEY) { throw "Set SUPABASE_SERVICE_ROLE_KEY first" }
$env:DRIVETOWN_SYNC_DRY_RUN="0"
node scripts/sync-drivetown.js
```

Expected: PASS and print JSON with inserted/updated counts. The DriveTown account exists in `users`, its profile exists in `dealership`, and DriveTown vehicles exist in `edc_vehicles` with `user_id` set to the DriveTown account.

- [ ] **Step 2: Verify rows through Supabase**

Run this SQL in Supabase SQL editor:

```sql
select user_id, email, role, status
from users
where email = 'inventory@drivetownottawa.com';

select user_id, company_name, website
from dealership
where company_name = 'DriveTown Ottawa';

select count(*) as drivetown_vehicle_count
from edc_vehicles
where user_id = (
  select user_id from users where email = 'inventory@drivetownottawa.com' limit 1
)
and (categories = 'dealer_select' or notes ilike '%DriveTown Ottawa%');
```

Expected: one user row, one dealership row, and a nonzero vehicle count.

- [ ] **Step 3: Verify admin editability**

Manual browser verification:

1. Open the admin inventory page.
2. Confirm DriveTown vehicles appear.
3. Open one DriveTown vehicle.
4. Edit a safe field such as `notes` or `ad_description`.
5. Save.
6. Confirm the row remains attached to the DriveTown `user_id`.

Expected: the admin can edit and save the imported vehicle.

- [ ] **Step 4: Verify preservation on second sync**

Run:

```powershell
$env:DRIVETOWN_SYNC_DRY_RUN="0"
node scripts/sync-drivetown.js
```

Expected: PASS. The manually edited field from Step 3 is preserved.

---

### Task 7: Kamatera Cron Deployment Notes

**Files:**
- Create: `docs/drivetown-kamatera-cron.md`

- [ ] **Step 1: Add deployment notes**

Create `docs/drivetown-kamatera-cron.md`:

```md
# DriveTown Ottawa Dealer Select Sync On Kamatera

## Environment

Create `/etc/easydrive/drivetown-sync.env` on the Kamatera server with these variable names and real values:

```bash
EDC_APP_DIR=
NEXT_PUBLIC_SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
DRIVETOWN_DEALER_USER_ID=
DRIVETOWN_SYNC_DRY_RUN=0
```

`DRIVETOWN_DEALER_USER_ID` can stay empty after the first run because the worker can resolve the account by `inventory@drivetownottawa.com`.

## Manual Dry Run

```bash
set -a
. /etc/easydrive/drivetown-sync.env
set +a
cd "$EDC_APP_DIR"
DRIVETOWN_SYNC_DRY_RUN=1 node scripts/sync-drivetown.js
```

## Manual Write Run

```bash
set -a
. /etc/easydrive/drivetown-sync.env
set +a
cd "$EDC_APP_DIR"
DRIVETOWN_SYNC_DRY_RUN=0 node scripts/sync-drivetown.js
```

## Cron

Run every six hours:

```cron
0 */6 * * * set -a && . /etc/easydrive/drivetown-sync.env && set +a && cd "$EDC_APP_DIR" && DRIVETOWN_SYNC_DRY_RUN=0 node scripts/sync-drivetown.js >> /var/log/easydrive-drivetown-sync.log 2>&1
```

## Monitoring

Check:

```bash
tail -n 200 /var/log/easydrive-drivetown-sync.log
```

The log should contain JSON with `inserted`, `updated`, `preserved`, `markedSold`, and `failed` counts.
```

- [ ] **Step 2: Commit deployment notes**

Run:

```powershell
git add docs/drivetown-kamatera-cron.md
git commit -m "docs: add DriveTown cron deployment notes"
```

Expected: commit succeeds.

---

### Task 8: Final Verification

**Files:**
- No planned source edits.

- [ ] **Step 1: Run all new unit tests**

Run:

```powershell
node --test client/src/lib/drivetownScraper.test.mjs client/src/lib/dealerSelectSync.test.mjs
```

Expected: PASS.

- [ ] **Step 2: Run dependency load check**

Run:

```powershell
node -e "require('cheerio'); require('@supabase/supabase-js'); console.log('ok')"
```

Expected:

```text
ok
```

- [ ] **Step 3: Run worker env validation**

Run:

```powershell
node scripts/sync-drivetown.js
```

Expected: FAIL with the required env error. This confirms the worker does not run with missing credentials.

- [ ] **Step 4: Check git status**

Run:

```powershell
git status --short
```

Expected: only pre-existing unrelated local files remain, or a clean worktree if those were already handled separately.
