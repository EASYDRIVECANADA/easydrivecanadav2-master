# Owini-Style Facebook Browser Assistant Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a local browser-assisted Facebook Marketplace posting workflow that fills listing fields from EasyDrive inventory and pauses before final submission.

**Architecture:** Extend the existing Facebook posting assistant with assist status fields, assist payload/token helpers, admin assist APIs, and a UI launch action. Add a local Node/Playwright runner that accepts a short-lived launch token, fetches one prepared payload from EasyDrive, opens a visible browser, fills supported Facebook Marketplace fields, and reports status back. The web app remains source of truth; the runner never stores Facebook credentials and never clicks final submit.

**Tech Stack:** Next.js App Router, React client components, Supabase JS server client, Node `node:test`, Node HTTP server, Playwright for local runner, PowerShell/Node scripts, existing Facebook Marketplace posting helpers.

---

## File Structure

- Create: `supabase/edc_facebook_marketplace_posts_assist.sql`
  - Adds Phase 2 assist columns to `edc_facebook_marketplace_posts`.
- Modify: `client/src/lib/facebookMarketplacePosting.mjs`
  - Adds assist status validation, assist payload shaping, and launch token helpers.
- Modify: `client/src/lib/facebookMarketplacePosting.test.mjs`
  - Covers assist status, payload shaping, and token behavior.
- Create: `scripts/facebook-marketplace-posts-assist-schema.test.mjs`
  - Verifies assist migration columns and idempotence.
- Create: `client/src/app/api/admin/marketplace/facebook/posts/[id]/assist/route.ts`
  - Returns assist payload and records assist status.
- Modify: `client/src/app/admin/marketplace/facebook/FacebookMarketplaceClient.tsx`
  - Adds `Assist Post` action, assist status badges, setup hint, and launch URL/command copy.
- Create: `scripts/facebook-marketplace-assist-runner.mjs`
  - Local dealership-computer runner with health endpoint, token handling, dry-run mode, visible browser launch, and status callbacks.
- Create: `scripts/facebook-marketplace-assist-runner.test.mjs`
  - Tests runner config parsing, token requirement, payload fetch/report helpers, and dry-run fixture behavior without launching Facebook.
- Create: `docs/facebook-marketplace-assist-runner.md`
  - Staff setup and operating guide.

---

## Task 1: Assist Schema And Helper Tests

**Files:**
- Create: `supabase/edc_facebook_marketplace_posts_assist.sql`
- Modify: `client/src/lib/facebookMarketplacePosting.mjs`
- Modify: `client/src/lib/facebookMarketplacePosting.test.mjs`
- Create: `scripts/facebook-marketplace-posts-assist-schema.test.mjs`

- [ ] **Step 1: Write failing helper tests**

Append these tests to `client/src/lib/facebookMarketplacePosting.test.mjs`:

```js
import {
  ASSIST_STATUS_OPTIONS,
  buildFacebookAssistPayload,
  buildFacebookAssistLaunchToken,
  isValidFacebookAssistStatus,
  normalizeFacebookAssistStatus,
  verifyFacebookAssistLaunchToken,
} from './facebookMarketplacePosting.mjs'

test('facebook assist statuses are explicit and normalized', () => {
  assert.deepEqual(ASSIST_STATUS_OPTIONS.map((item) => item.value), ['not_started', 'started', 'needs_review', 'failed', 'cancelled'])
  assert.equal(isValidFacebookAssistStatus('started'), true)
  assert.equal(isValidFacebookAssistStatus('Needs Review'), true)
  assert.equal(isValidFacebookAssistStatus('posted'), false)
  assert.equal(normalizeFacebookAssistStatus('Needs Review'), 'needs_review')
})

test('buildFacebookAssistPayload creates runner-safe payload from merged row', () => {
  const row = mergeFacebookPostRow(buildFacebookMarketplacePayload(completeVehicle, {
    siteUrl: 'https://easydrivecanada.com',
    defaultLocation: 'Mississauga, ON',
  }), {
    id: 'post-1',
    posting_title: 'Custom Civic title',
    posting_description: 'Custom Civic description for Facebook Marketplace.',
    posting_price: 21500,
    posting_location: 'Ottawa, ON',
  })

  const payload = buildFacebookAssistPayload(row)
  assert.equal(payload.postId, 'post-1')
  assert.equal(payload.vehicleId, completeVehicle.id)
  assert.equal(payload.title, 'Custom Civic title')
  assert.equal(payload.price, 21500)
  assert.equal(payload.location, 'Ottawa, ON')
  assert.equal(payload.vin, completeVehicle.vin)
  assert.equal(payload.stockNumber, completeVehicle.stock_number)
  assert.equal(Array.isArray(payload.images), true)
  assert.equal(payload.images.length > 0, true)
  assert.equal(payload.finalSubmitRequired, true)
})

test('facebook assist launch tokens expire and verify without secrets in the runner', () => {
  const token = buildFacebookAssistLaunchToken({
    postId: 'post-1',
    baseUrl: 'https://easydrivecanada.com',
    issuedAt: '2026-06-26T00:00:00.000Z',
    ttlSeconds: 60,
  })

  assert.equal(token.postId, 'post-1')
  assert.equal(token.baseUrl, 'https://easydrivecanada.com')
  assert.equal(verifyFacebookAssistLaunchToken(token, '2026-06-26T00:00:30.000Z').valid, true)
  assert.equal(verifyFacebookAssistLaunchToken(token, '2026-06-26T00:02:00.000Z').valid, false)
})
```

- [ ] **Step 2: Run helper tests and confirm they fail**

Run:

```bash
node --test client/src/lib/facebookMarketplacePosting.test.mjs
```

Expected: fail because the assist exports do not exist.

- [ ] **Step 3: Implement helper functions**

Add this code to `client/src/lib/facebookMarketplacePosting.mjs`:

```js
export const ASSIST_STATUS_OPTIONS = [
  { value: 'not_started', label: 'Not started' },
  { value: 'started', label: 'Started' },
  { value: 'needs_review', label: 'Needs review' },
  { value: 'failed', label: 'Failed' },
  { value: 'cancelled', label: 'Cancelled' },
]

const ASSIST_STATUS_VALUES = new Set(ASSIST_STATUS_OPTIONS.map((item) => item.value))

export function normalizeFacebookAssistStatus(value) {
  const normalized = lower(value).replace(/[\s-]+/g, '_')
  return normalized || 'not_started'
}

export function isValidFacebookAssistStatus(value) {
  return ASSIST_STATUS_VALUES.has(normalizeFacebookAssistStatus(value))
}

export function buildFacebookAssistPayload(row = {}) {
  return {
    postId: clean(row.postId || row.id),
    vehicleId: clean(row.vehicleId || row.vehicle_id),
    title: clean(row.title || row.posting_title),
    description: clean(row.description || row.posting_description),
    price: numberValue(row.price || row.posting_price),
    mileage: numberValue(row.mileage),
    location: clean(row.location || row.posting_location),
    vin: clean(row.vin),
    stockNumber: clean(row.stockNumber || row.stock_number),
    images: imageList(row.images),
    publicUrl: clean(row.publicUrl),
    finalSubmitRequired: true,
  }
}

export function buildFacebookAssistLaunchToken({ postId, baseUrl, issuedAt = new Date().toISOString(), ttlSeconds = 600 } = {}) {
  const issued = new Date(issuedAt)
  const expires = new Date(issued.getTime() + Number(ttlSeconds || 600) * 1000)
  return {
    postId: clean(postId),
    baseUrl: absoluteSiteUrl(baseUrl),
    issuedAt: issued.toISOString(),
    expiresAt: expires.toISOString(),
  }
}

export function verifyFacebookAssistLaunchToken(token = {}, nowIso = new Date().toISOString()) {
  const postId = clean(token.postId)
  const baseUrl = clean(token.baseUrl)
  const expiresAt = Date.parse(token.expiresAt)
  const now = Date.parse(nowIso)
  if (!postId) return { valid: false, reason: 'missing_post_id' }
  if (!baseUrl) return { valid: false, reason: 'missing_base_url' }
  if (!Number.isFinite(expiresAt)) return { valid: false, reason: 'missing_expiry' }
  if (Number.isFinite(now) && now > expiresAt) return { valid: false, reason: 'expired' }
  return { valid: true, reason: '' }
}
```

- [ ] **Step 4: Write schema migration**

Create `supabase/edc_facebook_marketplace_posts_assist.sql`:

```sql
alter table public.edc_facebook_marketplace_posts
  add column if not exists assist_status text not null default 'not_started',
  add column if not exists assist_started_at timestamptz,
  add column if not exists assist_completed_at timestamptz,
  add column if not exists assist_error text,
  add column if not exists assist_payload jsonb not null default '{}'::jsonb;

create index if not exists edc_facebook_marketplace_posts_assist_status_idx
  on public.edc_facebook_marketplace_posts (assist_status);

comment on column public.edc_facebook_marketplace_posts.assist_status is
  'Local browser assistance status: not_started, started, needs_review, failed, or cancelled.';

comment on column public.edc_facebook_marketplace_posts.assist_payload is
  'Last payload sent to the local browser assistant runner.';
```

- [ ] **Step 5: Write schema test**

Create `scripts/facebook-marketplace-posts-assist-schema.test.mjs`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const sql = fs.readFileSync(new URL('../supabase/edc_facebook_marketplace_posts_assist.sql', import.meta.url), 'utf8').toLowerCase()

test('facebook marketplace assist schema adds required columns and index', () => {
  for (const column of ['assist_status', 'assist_started_at', 'assist_completed_at', 'assist_error', 'assist_payload']) {
    assert.match(sql, new RegExp(`add column if not exists ${column}`))
  }
  assert.match(sql, /edc_facebook_marketplace_posts_assist_status_idx/)
  assert.match(sql, /default 'not_started'/)
  assert.match(sql, /jsonb not null default '\\{\\}'::jsonb/)
})
```

- [ ] **Step 6: Run tests and commit**

Run:

```bash
node --test client/src/lib/facebookMarketplacePosting.test.mjs scripts/facebook-marketplace-posts-assist-schema.test.mjs
```

Expected: all tests pass.

Commit:

```bash
git add client/src/lib/facebookMarketplacePosting.mjs client/src/lib/facebookMarketplacePosting.test.mjs supabase/edc_facebook_marketplace_posts_assist.sql scripts/facebook-marketplace-posts-assist-schema.test.mjs
git commit -m "Add Facebook assist helpers and schema"
```

---

## Task 2: Assist API Routes

**Files:**
- Create: `client/src/app/api/admin/marketplace/facebook/posts/[id]/assist/route.ts`
- Modify: `client/src/lib/facebookMarketplacePosting.test.mjs`

- [ ] **Step 1: Add payload behavior test for assist route data**

Append this test to `client/src/lib/facebookMarketplacePosting.test.mjs`:

```js
test('buildFacebookAssistPayload never treats assist completion as posted', () => {
  const payload = buildFacebookAssistPayload({
    postId: 'post-2',
    vehicleId: 'vehicle-2',
    title: '2019 Toyota Corolla',
    description: 'Clean sedan ready for Facebook Marketplace.',
    price: 16995,
    mileage: 89000,
    location: 'Mississauga, ON',
  })

  assert.equal(payload.finalSubmitRequired, true)
  assert.equal(Object.prototype.hasOwnProperty.call(payload, 'status'), false)
  assert.equal(Object.prototype.hasOwnProperty.call(payload, 'postedAt'), false)
})
```

- [ ] **Step 2: Run helper tests**

Run:

```bash
node --test client/src/lib/facebookMarketplacePosting.test.mjs
```

Expected: pass.

- [ ] **Step 3: Implement assist route**

Create `client/src/app/api/admin/marketplace/facebook/posts/[id]/assist/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  buildFacebookAssistPayload,
  buildFacebookAssistLaunchToken,
  isValidFacebookAssistStatus,
  normalizeFacebookAssistStatus,
} from '@/lib/facebookMarketplacePosting.mjs'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

const noStore = { 'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0' }
const clean = (value: unknown) => String(value ?? '').trim()

const createSupabase = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseKey) return null
  return createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
}

export async function GET(request: Request, context: { params: { id: string } }) {
  try {
    const supabase = createSupabase()
    if (!supabase) return NextResponse.json({ error: 'Server not configured' }, { status: 500, headers: noStore })

    const postId = clean(context.params.id)
    const result = await supabase
      .from('edc_facebook_marketplace_posts')
      .select('*')
      .eq('id', postId)
      .single()

    if (result.error) {
      return NextResponse.json({
        error: result.error.message,
        setupRequired: result.error.message.toLowerCase().includes('assist_') || result.error.message.toLowerCase().includes('edc_facebook_marketplace_posts'),
      }, { status: 500, headers: noStore })
    }

    const payload = buildFacebookAssistPayload({
      ...((result.data?.posting_payload || {}) as Record<string, unknown>),
      postId: result.data.id,
      title: result.data.posting_title,
      description: result.data.posting_description,
      price: result.data.posting_price,
      location: result.data.posting_location,
    })
    const launchToken = buildFacebookAssistLaunchToken({
      postId,
      baseUrl: process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin,
    })

    const nowIso = new Date().toISOString()
    await supabase
      .from('edc_facebook_marketplace_posts')
      .update({
        assist_payload: payload,
        assist_status: 'started',
        assist_started_at: nowIso,
        assist_error: null,
        updated_at: nowIso,
      })
      .eq('id', postId)

    return NextResponse.json({ payload, launchToken }, { headers: noStore })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to create assist payload' }, { status: 500, headers: noStore })
  }
}

export async function PATCH(request: Request, context: { params: { id: string } }) {
  try {
    const supabase = createSupabase()
    if (!supabase) return NextResponse.json({ error: 'Server not configured' }, { status: 500, headers: noStore })

    const postId = clean(context.params.id)
    const body = await request.json().catch(() => ({}))
    const assistStatus = normalizeFacebookAssistStatus(body?.assistStatus)
    if (!isValidFacebookAssistStatus(assistStatus)) {
      return NextResponse.json({ error: 'Invalid assist status.' }, { status: 400, headers: noStore })
    }

    const nowIso = new Date().toISOString()
    const update: Record<string, unknown> = {
      assist_status: assistStatus,
      assist_error: clean(body?.assistError) || null,
      updated_at: nowIso,
    }
    if (assistStatus === 'started') update.assist_started_at = nowIso
    if (['needs_review', 'failed', 'cancelled'].includes(assistStatus)) update.assist_completed_at = nowIso

    const result = await supabase
      .from('edc_facebook_marketplace_posts')
      .update(update)
      .eq('id', postId)
      .select('*')
      .single()

    if (result.error) {
      return NextResponse.json({ error: result.error.message }, { status: 500, headers: noStore })
    }

    return NextResponse.json({ post: result.data }, { headers: noStore })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to update assist status' }, { status: 500, headers: noStore })
  }
}
```

- [ ] **Step 4: Run focused tests and lint**

Run:

```bash
node --test client/src/lib/facebookMarketplacePosting.test.mjs
npx --prefix client next lint --file src/app/api/admin/marketplace/facebook/posts/[id]/assist/route.ts
```

Expected: tests pass and route lint reports no errors.

- [ ] **Step 5: Commit**

```bash
git add client/src/lib/facebookMarketplacePosting.test.mjs client/src/app/api/admin/marketplace/facebook/posts/[id]/assist/route.ts
git commit -m "Add Facebook assist API"
```

---

## Task 3: Admin Assist UI

**Files:**
- Modify: `client/src/app/admin/marketplace/facebook/FacebookMarketplaceClient.tsx`

- [ ] **Step 1: Extend row type and UI state**

In `FacebookMarketplaceClient.tsx`, add fields to `FacebookPostRow`:

```ts
assistStatus?: string
assistStartedAt?: string
assistCompletedAt?: string
assistError?: string
```

Add component state:

```ts
const [assistLaunch, setAssistLaunch] = useState<{ command: string; localUrl: string } | null>(null)
```

- [ ] **Step 2: Add assist function**

Add this function inside the component:

```ts
const assistSelected = async () => {
  if (!selected?.postId) {
    setError('Prepare and save this vehicle before launching browser assistance.')
    return
  }
  if (!selected.readiness?.ready) {
    setError('Resolve missing Marketplace fields before launching browser assistance.')
    return
  }

  setSaving(true)
  setError('')
  const res = await fetch(`/api/admin/marketplace/facebook/posts/${encodeURIComponent(selected.postId)}/assist`, {
    cache: 'no-store',
  })
  const json = await res.json().catch(() => null)
  setSaving(false)

  if (!res.ok) {
    setError(json?.setupRequired
      ? 'Run supabase/edc_facebook_marketplace_posts_assist.sql before browser assistance.'
      : json?.error || 'Failed to launch browser assistance.')
    return
  }

  const encodedToken = encodeURIComponent(JSON.stringify(json.launchToken))
  const localUrl = `http://127.0.0.1:4777/assist?token=${encodedToken}`
  const command = `node scripts/facebook-marketplace-assist-runner.mjs --token '${JSON.stringify(json.launchToken)}'`
  setAssistLaunch({ command, localUrl })
  window.open(localUrl, '_blank', 'noopener,noreferrer')
  await load()
}
```

- [ ] **Step 3: Render assist controls in selected drawer**

Inside the selected detail action area, add:

```tsx
<button
  type="button"
  onClick={() => void assistSelected()}
  disabled={saving || !selected.readiness?.ready}
  className="inline-flex items-center justify-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
>
  Assist Post
</button>
```

Add an assist launch panel:

```tsx
{assistLaunch ? (
  <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
    <div className="font-semibold">Local browser assistant</div>
    <p className="mt-1">If the local runner is running, Facebook should open automatically. If not, start it and use this command.</p>
    <button type="button" onClick={() => void copyText('assist command', assistLaunch.command)} className="mt-2 text-xs font-semibold underline">
      Copy runner command
    </button>
  </div>
) : null}
```

Show assist status on rows:

```tsx
{post.assistStatus ? <span className="text-xs text-slate-500">Assist: {post.assistStatus}</span> : null}
```

- [ ] **Step 4: Run targeted lint**

Run:

```bash
npx --prefix client next lint --file src/app/admin/marketplace/facebook/FacebookMarketplaceClient.tsx
```

Expected: no new lint errors in this file. If existing `any` errors appear from this file, fix the touched code only if possible; otherwise record them as pre-existing.

- [ ] **Step 5: Commit**

```bash
git add client/src/app/admin/marketplace/facebook/FacebookMarketplaceClient.tsx
git commit -m "Add Facebook assist launch UI"
```

---

## Task 4: Local Runner Core

**Files:**
- Create: `scripts/facebook-marketplace-assist-runner.mjs`
- Create: `scripts/facebook-marketplace-assist-runner.test.mjs`
- Create: `docs/facebook-marketplace-assist-runner.md`

- [ ] **Step 1: Write runner tests first**

Create `scripts/facebook-marketplace-assist-runner.test.mjs`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  parseRunnerArgs,
  requireLaunchToken,
  buildAssistPayloadUrl,
  buildAssistStatusUrl,
  createStatusBody,
} from './facebook-marketplace-assist-runner.mjs'

const token = {
  postId: 'post-1',
  baseUrl: 'https://easydrivecanada.com',
  issuedAt: '2026-06-26T00:00:00.000Z',
  expiresAt: '2026-06-26T00:10:00.000Z',
}

test('parseRunnerArgs reads token, port, dry-run, and browser options', () => {
  const args = parseRunnerArgs(['--token', JSON.stringify(token), '--port', '4777', '--dry-run', '--browser', 'msedge'])
  assert.equal(args.port, 4777)
  assert.equal(args.dryRun, true)
  assert.equal(args.browser, 'msedge')
  assert.equal(args.token.postId, 'post-1')
})

test('requireLaunchToken rejects missing token', () => {
  assert.throws(() => requireLaunchToken({}), /launch token/i)
})

test('builds assist URLs from token', () => {
  assert.equal(buildAssistPayloadUrl(token), 'https://easydrivecanada.com/api/admin/marketplace/facebook/posts/post-1/assist')
  assert.equal(buildAssistStatusUrl(token), 'https://easydrivecanada.com/api/admin/marketplace/facebook/posts/post-1/assist')
})

test('createStatusBody uses assistStatus and never marks durable posted status', () => {
  const body = createStatusBody('needs_review')
  assert.deepEqual(body, { assistStatus: 'needs_review', assistError: '' })
})
```

- [ ] **Step 2: Run runner tests and confirm failure**

Run:

```bash
node --test scripts/facebook-marketplace-assist-runner.test.mjs
```

Expected: fail because the runner module does not exist.

- [ ] **Step 3: Implement runner core without Facebook automation**

Create `scripts/facebook-marketplace-assist-runner.mjs`:

```js
#!/usr/bin/env node
import http from 'node:http'
import { URL } from 'node:url'

const clean = (value) => String(value ?? '').trim()

export function parseRunnerArgs(argv = []) {
  const args = { port: 4777, dryRun: false, browser: 'msedge', token: null }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--token') args.token = JSON.parse(argv[++i] || '{}')
    if (arg === '--port') args.port = Number(argv[++i] || 4777)
    if (arg === '--dry-run') args.dryRun = true
    if (arg === '--browser') args.browser = clean(argv[++i] || 'msedge')
  }
  return args
}

export function requireLaunchToken(args) {
  if (!args?.token?.postId || !args?.token?.baseUrl) throw new Error('A valid launch token is required.')
  return args.token
}

export function buildAssistPayloadUrl(token) {
  return `${clean(token.baseUrl).replace(/\/+$/, '')}/api/admin/marketplace/facebook/posts/${encodeURIComponent(token.postId)}/assist`
}

export function buildAssistStatusUrl(token) {
  return buildAssistPayloadUrl(token)
}

export function createStatusBody(assistStatus, assistError = '') {
  return { assistStatus, assistError: clean(assistError) }
}

async function fetchJson(url) {
  const res = await fetch(url, { cache: 'no-store' })
  const json = await res.json().catch(() => null)
  if (!res.ok) throw new Error(json?.error || `Request failed (${res.status})`)
  return json
}

async function patchJson(url, body) {
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const json = await res.json().catch(() => null)
  if (!res.ok) throw new Error(json?.error || `Request failed (${res.status})`)
  return json
}

export async function runAssistOnce(args) {
  const token = requireLaunchToken(args)
  const payloadResponse = await fetchJson(buildAssistPayloadUrl(token))
  if (args.dryRun) {
    console.log(JSON.stringify(payloadResponse.payload, null, 2))
    return payloadResponse.payload
  }
  await patchJson(buildAssistStatusUrl(token), createStatusBody('needs_review'))
  return payloadResponse.payload
}

export function startRunnerServer({ port = 4777 } = {}) {
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || '/', `http://127.0.0.1:${port}`)
    if (url.pathname === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ ok: true }))
      return
    }
    if (url.pathname === '/assist') {
      res.writeHead(200, { 'Content-Type': 'text/plain' })
      res.end('Assist request received. Return to the runner terminal for status.')
      return
    }
    res.writeHead(404, { 'Content-Type': 'text/plain' })
    res.end('Not found')
  })
  server.listen(port, '127.0.0.1')
  return server
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))) {
  const args = parseRunnerArgs(process.argv.slice(2))
  if (args.token) {
    runAssistOnce(args).catch((err) => {
      console.error(err.message)
      process.exit(1)
    })
  } else {
    startRunnerServer({ port: args.port })
    console.log(`Facebook Marketplace assistant ready on http://127.0.0.1:${args.port}`)
  }
}
```

- [ ] **Step 4: Add runner docs**

Create `docs/facebook-marketplace-assist-runner.md`:

```md
# Facebook Marketplace Assist Runner

This runner is used on the dealership computer for browser-assisted Facebook Marketplace posting.

It does not store Facebook credentials and it does not click the final Facebook Post button.

## Start Runner

```bash
node scripts/facebook-marketplace-assist-runner.mjs --port 4777
```

## Dry Run A Launch Token

```bash
node scripts/facebook-marketplace-assist-runner.mjs --token '<token json>' --dry-run
```

## Expected Workflow

1. Log into Facebook in the visible browser profile on the dealership computer.
2. Start this runner.
3. Open EasyDrive Admin > Marketplace > Facebook.
4. Pick a ready vehicle.
5. Click Assist Post.
6. Review the filled Facebook form.
7. Manually click Post in Facebook.
8. Paste the final Facebook listing URL into EasyDrive.
```

- [ ] **Step 5: Run tests and commit**

Run:

```bash
node --test scripts/facebook-marketplace-assist-runner.test.mjs
```

Expected: pass.

Commit:

```bash
git add scripts/facebook-marketplace-assist-runner.mjs scripts/facebook-marketplace-assist-runner.test.mjs docs/facebook-marketplace-assist-runner.md
git commit -m "Add Facebook assist runner core"
```

---

## Task 5: Visible Browser Fill Scaffold

**Files:**
- Modify: `scripts/facebook-marketplace-assist-runner.mjs`
- Modify: `scripts/facebook-marketplace-assist-runner.test.mjs`

- [ ] **Step 1: Add selector mapping test**

Append to `scripts/facebook-marketplace-assist-runner.test.mjs`:

```js
import { buildFacebookFieldPlan } from './facebook-marketplace-assist-runner.mjs'

test('buildFacebookFieldPlan maps only supported safe fields', () => {
  const plan = buildFacebookFieldPlan({
    title: '2020 Honda Civic',
    price: 21000,
    description: 'Clean local trade ready for test drive.',
    mileage: 70000,
    location: 'Mississauga, ON',
    vin: '2HGFC2F59LH000000',
  })
  assert.deepEqual(plan.map((item) => item.field), ['title', 'price', 'description', 'mileage', 'location', 'vin'])
  assert.equal(plan.find((item) => item.field === 'price')?.value, '21000')
})
```

- [ ] **Step 2: Run test and confirm failure**

Run:

```bash
node --test scripts/facebook-marketplace-assist-runner.test.mjs
```

Expected: fail because `buildFacebookFieldPlan` does not exist.

- [ ] **Step 3: Implement visible browser scaffold**

Modify `scripts/facebook-marketplace-assist-runner.mjs`:

```js
export function buildFacebookFieldPlan(payload = {}) {
  return [
    { field: 'title', value: clean(payload.title), labels: ['Title'] },
    { field: 'price', value: clean(payload.price), labels: ['Price'] },
    { field: 'description', value: clean(payload.description), labels: ['Description'] },
    { field: 'mileage', value: clean(payload.mileage), labels: ['Mileage', 'Odometer'] },
    { field: 'location', value: clean(payload.location), labels: ['Location'] },
    { field: 'vin', value: clean(payload.vin), labels: ['VIN'] },
  ].filter((item) => item.value)
}

export async function fillFacebookMarketplaceForm(page, payload) {
  const plan = buildFacebookFieldPlan(payload)
  for (const item of plan) {
    let filled = false
    for (const label of item.labels) {
      const locator = page.getByLabel(label, { exact: false }).first()
      if (await locator.count().catch(() => 0)) {
        await locator.fill(item.value)
        filled = true
        break
      }
    }
    if (!filled) console.warn(`Could not fill ${item.field}; Facebook may have changed this field.`)
  }
}

export async function openFacebookMarketplace(payload, { browser = 'msedge' } = {}) {
  const { chromium } = await import('playwright')
  const context = await chromium.launchPersistentContext('./.facebook-assist-profile', {
    channel: browser,
    headless: false,
  })
  const page = await context.newPage()
  await page.goto('https://www.facebook.com/marketplace/create/vehicle', { waitUntil: 'domcontentloaded' })
  await fillFacebookMarketplaceForm(page, payload)
  return { context, page }
}
```

Update `runAssistOnce` so non-dry-run uses `openFacebookMarketplace(payloadResponse.payload, args)`, then patches `needs_review`.

- [ ] **Step 4: Run tests**

Run:

```bash
node --test scripts/facebook-marketplace-assist-runner.test.mjs
```

Expected: pass. This test must not launch a real browser.

- [ ] **Step 5: Commit**

```bash
git add scripts/facebook-marketplace-assist-runner.mjs scripts/facebook-marketplace-assist-runner.test.mjs
git commit -m "Add Facebook form fill scaffold"
```

---

## Task 6: Final Verification

**Files:**
- No new source files unless verification uncovers a bug.

- [ ] **Step 1: Run focused tests**

```bash
node --test client/src/lib/facebookMarketplacePosting.test.mjs scripts/facebook-marketplace-posts-schema.test.mjs scripts/facebook-marketplace-posts-assist-schema.test.mjs scripts/facebook-marketplace-assist-runner.test.mjs
```

Expected: all tests pass.

- [ ] **Step 2: Run targeted lint**

```bash
npx --prefix client next lint --file src/app/api/admin/marketplace/facebook/posts/[id]/assist/route.ts --file src/app/admin/marketplace/facebook/FacebookMarketplaceClient.tsx
```

Expected: no errors from new/touched code. If existing lint debt in `FacebookMarketplaceClient.tsx` appears, record exact lines.

- [ ] **Step 3: Run build**

```bash
npm --prefix client run build
```

Expected: build passes. Existing HEIC and Browserslist warnings may remain unrelated.

- [ ] **Step 4: Dry-run runner**

Use a local token pointing at a running dev server or a mocked endpoint. If no API server is available, run only argument/health tests and record that live runner execution requires a running EasyDrive server.

```bash
node scripts/facebook-marketplace-assist-runner.mjs --port 4777
```

Expected: prints `Facebook Marketplace assistant ready on http://127.0.0.1:4777`.

- [ ] **Step 5: Commit any verification fixes**

If verification required fixes:

```bash
git add <fixed files>
git commit -m "Verify Facebook browser assistant"
```

---

## Spec Coverage Checklist

- Local runner: Tasks 4 and 5.
- No credentials/cookies in Supabase: Tasks 1, 2, and 4 use launch token only.
- Admin `Assist Post` action: Task 3.
- Assist API payload/status routes: Task 2.
- Assist schema fields: Task 1.
- Visible browser and pause before final submit: Task 5.
- No final submit click: Task 5 only fills fields and reports `needs_review`.
- Runner dry-run and health behavior: Task 4 and Task 6.
- Manual verification instructions: Task 4 docs and Task 6.
