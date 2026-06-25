# Admin Appointment Calendar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an admin appointment calendar/list page and dashboard widget for native scheduler bookings stored in `edc_appointments`.

**Architecture:** Add tested appointment helper functions first, then admin-only API routes for listing and status updates, then the admin page, then dashboard/sidebar wiring. The UI fetches from admin API routes and does not talk to Supabase directly. Vehicle summaries are fetched separately and merged in code because the appointment SQL does not define a foreign key.

**Tech Stack:** Next.js App Router, React client components, Supabase JS server client, Node `node:test`, existing `requireAdminSession` API guard, Tailwind CSS, lucide-react icons.

---

## File Structure

- Create: `client/src/lib/adminAppointments.mjs`
  - Owns status validation, display mapping, appointment normalization, date range calculation, grouping, summary calculation, and search matching.
- Create: `client/src/lib/adminAppointments.d.ts`
  - Gives TypeScript pages/routes typed imports for the `.mjs` helper.
- Create: `client/src/lib/adminAppointments.test.mjs`
  - Covers status validation, grouping, summary, range calculation, search, and merge-safe display names.
- Create: `client/src/app/api/admin/appointments/route.ts`
  - Admin-only appointment list API.
- Create: `client/src/app/api/admin/appointments/[id]/route.ts`
  - Admin-only appointment status update API.
- Create: `client/src/app/admin/appointments/page.tsx`
  - Full admin appointments UI.
- Modify: `client/src/app/admin/AdminLayoutClient.tsx`
  - Adds `Appointments` navigation and a calendar icon.
- Modify: `client/src/app/admin/page.tsx`
  - Adds dashboard widget for today's appointments.
- Reference: `docs/superpowers/specs/2026-06-25-admin-appointment-calendar-design.md`
  - Approved product spec.

---

## Task 1: Appointment Helper Library

**Files:**
- Create: `client/src/lib/adminAppointments.mjs`
- Create: `client/src/lib/adminAppointments.d.ts`
- Create: `client/src/lib/adminAppointments.test.mjs`

- [ ] **Step 1: Write the failing helper tests**

Create `client/src/lib/adminAppointments.test.mjs`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  APPOINTMENT_STATUS_OPTIONS,
  buildAppointmentDateRange,
  buildAppointmentSearchText,
  buildAppointmentSummary,
  formatAppointmentCustomerName,
  formatAppointmentVehicleName,
  groupAppointmentsByDate,
  isValidAppointmentStatus,
  normalizeAppointmentStatus,
  vehicleMatchesAppointmentSearch,
} from './adminAppointments.mjs'

const sampleAppointment = {
  id: 'appt-1',
  customer_first_name: 'Avery',
  customer_last_name: 'Stone',
  customer_email: 'avery@example.com',
  customer_phone: '555-1000',
  vehicle_id: 'veh-1',
  appointment_type: 'test_drive',
  source: 'messenger',
  starts_at: '2026-06-25T14:00:00.000Z',
  ends_at: '2026-06-25T14:30:00.000Z',
  status: 'booked',
}

const sampleVehicle = {
  id: 'veh-1',
  year: 2021,
  make: 'Toyota',
  model: 'RAV4',
  stock_number: 'STK123',
}

test('appointment statuses are explicit and normalized', () => {
  assert.deepEqual(APPOINTMENT_STATUS_OPTIONS.map((item) => item.value), ['booked', 'completed', 'cancelled', 'no_show'])
  assert.equal(isValidAppointmentStatus('booked'), true)
  assert.equal(isValidAppointmentStatus('no_show'), true)
  assert.equal(isValidAppointmentStatus('pending'), false)
  assert.equal(normalizeAppointmentStatus('No Show'), 'no_show')
  assert.equal(normalizeAppointmentStatus('cancelled'), 'cancelled')
})

test('formats customer and vehicle names with graceful fallbacks', () => {
  assert.equal(formatAppointmentCustomerName(sampleAppointment), 'Avery Stone')
  assert.equal(formatAppointmentCustomerName({ customer_phone: '555-2000' }), '555-2000')
  assert.equal(formatAppointmentCustomerName({ customer_email: 'lead@example.com' }), 'lead@example.com')
  assert.equal(formatAppointmentCustomerName({}), 'Unknown customer')
  assert.equal(formatAppointmentVehicleName(sampleVehicle), '2021 Toyota RAV4 #STK123')
  assert.equal(formatAppointmentVehicleName(null, 'veh-missing'), 'Vehicle veh-missing')
})

test('builds searchable text from appointment and vehicle fields', () => {
  const haystack = buildAppointmentSearchText(sampleAppointment, sampleVehicle)
  assert.equal(haystack.includes('avery'), true)
  assert.equal(haystack.includes('rav4'), true)
  assert.equal(haystack.includes('stk123'), true)
  assert.equal(vehicleMatchesAppointmentSearch(sampleAppointment, sampleVehicle, 'messenger'), true)
  assert.equal(vehicleMatchesAppointmentSearch(sampleAppointment, sampleVehicle, 'honda'), false)
})

test('groups appointments by dealership date', () => {
  const grouped = groupAppointmentsByDate([
    sampleAppointment,
    { ...sampleAppointment, id: 'appt-2', starts_at: '2026-06-26T15:00:00.000Z' },
  ], 'America/Toronto')
  assert.equal(grouped.length, 2)
  assert.equal(grouped[0].dateKey, '2026-06-25')
  assert.equal(grouped[0].appointments[0].id, 'appt-1')
})

test('builds appointment date ranges', () => {
  const today = buildAppointmentDateRange('today', '2026-06-25T12:00:00.000Z')
  assert.equal(today.from.startsWith('2026-06-25'), true)
  assert.equal(today.to.startsWith('2026-06-26'), true)

  const next7 = buildAppointmentDateRange('next_7', '2026-06-25T12:00:00.000Z')
  assert.equal(next7.from.startsWith('2026-06-25'), true)
  assert.equal(next7.to.startsWith('2026-07-02'), true)

  const past = buildAppointmentDateRange('past', '2026-06-25T12:00:00.000Z')
  assert.equal(past.to, '2026-06-25T12:00:00.000Z')
})

test('summarizes appointment counts', () => {
  const summary = buildAppointmentSummary([
    sampleAppointment,
    { ...sampleAppointment, id: 'appt-2', status: 'completed' },
    { ...sampleAppointment, id: 'appt-3', status: 'no_show' },
  ])
  assert.equal(summary.total, 3)
  assert.equal(summary.booked, 1)
  assert.equal(summary.completed, 1)
  assert.equal(summary.noShow, 1)
})
```

- [ ] **Step 2: Run the helper tests and confirm they fail**

Run:

```bash
node --test client/src/lib/adminAppointments.test.mjs
```

Expected: fail because `client/src/lib/adminAppointments.mjs` does not exist.

- [ ] **Step 3: Implement the helper library**

Create `client/src/lib/adminAppointments.mjs`:

```js
export const APPOINTMENT_STATUS_OPTIONS = [
  { value: 'booked', label: 'Booked' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'no_show', label: 'No-show' },
]

const STATUS_VALUES = new Set(APPOINTMENT_STATUS_OPTIONS.map((item) => item.value))

const clean = (value) => String(value ?? '').trim()
const lower = (value) => clean(value).toLowerCase()

export function normalizeAppointmentStatus(value) {
  const normalized = lower(value).replace(/[\s-]+/g, '_')
  return normalized === 'noshow' ? 'no_show' : normalized
}

export function isValidAppointmentStatus(value) {
  return STATUS_VALUES.has(normalizeAppointmentStatus(value))
}

export function getAppointmentStatusLabel(value) {
  const normalized = normalizeAppointmentStatus(value)
  return APPOINTMENT_STATUS_OPTIONS.find((item) => item.value === normalized)?.label || clean(value) || 'Booked'
}

export function formatAppointmentCustomerName(appointment = {}) {
  const fullName = [appointment.customer_first_name, appointment.customer_last_name].map(clean).filter(Boolean).join(' ')
  return fullName || clean(appointment.customer_phone) || clean(appointment.customer_email) || 'Unknown customer'
}

export function formatAppointmentVehicleName(vehicle, fallbackId = '') {
  if (!vehicle) return fallbackId ? `Vehicle ${fallbackId}` : 'Vehicle unavailable'
  const year = clean(vehicle.year)
  const make = clean(vehicle.make)
  const model = clean(vehicle.model)
  const stock = clean(vehicle.stock_number || vehicle.stockNumber)
  const name = [year, make, model].filter(Boolean).join(' ')
  return `${name || 'Vehicle'}${stock ? ` #${stock}` : ''}`
}

export function buildAppointmentSearchText(appointment = {}, vehicle = null) {
  return [
    appointment.customer_first_name,
    appointment.customer_last_name,
    appointment.customer_email,
    appointment.customer_phone,
    appointment.appointment_type,
    appointment.source,
    appointment.status,
    appointment.vehicle_id,
    vehicle?.year,
    vehicle?.make,
    vehicle?.model,
    vehicle?.series,
    vehicle?.stock_number,
    vehicle?.vin,
  ].map(lower).filter(Boolean).join(' ')
}

export function vehicleMatchesAppointmentSearch(appointment, vehicle, query) {
  const q = lower(query)
  if (!q) return true
  return buildAppointmentSearchText(appointment, vehicle).includes(q)
}

function isoDateKey(value, timeZone = 'America/Toronto') {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'unknown'
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const year = parts.find((part) => part.type === 'year')?.value || '0000'
  const month = parts.find((part) => part.type === 'month')?.value || '00'
  const day = parts.find((part) => part.type === 'day')?.value || '00'
  return `${year}-${month}-${day}`
}

export function groupAppointmentsByDate(appointments = [], timeZone = 'America/Toronto') {
  const map = new Map()
  appointments.forEach((appointment) => {
    const dateKey = isoDateKey(appointment.starts_at, timeZone)
    if (!map.has(dateKey)) map.set(dateKey, [])
    map.get(dateKey).push(appointment)
  })
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dateKey, rows]) => ({
      dateKey,
      appointments: rows.sort((a, b) => String(a.starts_at).localeCompare(String(b.starts_at))),
    }))
}

function startOfUtcDay(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

function addUtcDays(date, days) {
  const next = new Date(date)
  next.setUTCDate(next.getUTCDate() + days)
  return next
}

export function buildAppointmentDateRange(range = 'next_7', nowIso = new Date().toISOString()) {
  const now = new Date(nowIso)
  const start = startOfUtcDay(now)
  if (range === 'today') return { from: start.toISOString(), to: addUtcDays(start, 1).toISOString() }
  if (range === 'tomorrow') return { from: addUtcDays(start, 1).toISOString(), to: addUtcDays(start, 2).toISOString() }
  if (range === 'past') return { from: '', to: now.toISOString() }
  return { from: start.toISOString(), to: addUtcDays(start, 7).toISOString() }
}

export function buildAppointmentSummary(appointments = []) {
  return appointments.reduce((summary, appointment) => {
    const status = normalizeAppointmentStatus(appointment.status || 'booked')
    summary.total += 1
    if (status === 'booked') summary.booked += 1
    if (status === 'completed') summary.completed += 1
    if (status === 'cancelled') summary.cancelled += 1
    if (status === 'no_show') summary.noShow += 1
    return summary
  }, { total: 0, booked: 0, completed: 0, cancelled: 0, noShow: 0 })
}
```

- [ ] **Step 4: Add TypeScript declarations**

Create `client/src/lib/adminAppointments.d.ts`:

```ts
export type AppointmentStatus = 'booked' | 'completed' | 'cancelled' | 'no_show'

export type AppointmentStatusOption = {
  value: AppointmentStatus
  label: string
}

export type AppointmentSummary = {
  total: number
  booked: number
  completed: number
  cancelled: number
  noShow: number
}

export const APPOINTMENT_STATUS_OPTIONS: AppointmentStatusOption[]
export function normalizeAppointmentStatus(value: unknown): string
export function isValidAppointmentStatus(value: unknown): boolean
export function getAppointmentStatusLabel(value: unknown): string
export function formatAppointmentCustomerName(appointment?: Record<string, unknown>): string
export function formatAppointmentVehicleName(vehicle?: Record<string, unknown> | null, fallbackId?: string): string
export function buildAppointmentSearchText(appointment?: Record<string, unknown>, vehicle?: Record<string, unknown> | null): string
export function vehicleMatchesAppointmentSearch(appointment: Record<string, unknown>, vehicle: Record<string, unknown> | null, query: unknown): boolean
export function groupAppointmentsByDate<T extends Record<string, unknown>>(appointments?: T[], timeZone?: string): Array<{ dateKey: string; appointments: T[] }>
export function buildAppointmentDateRange(range?: string, nowIso?: string): { from: string; to: string }
export function buildAppointmentSummary(appointments?: Array<Record<string, unknown>>): AppointmentSummary
```

- [ ] **Step 5: Run helper tests and commit**

Run:

```bash
node --test client/src/lib/adminAppointments.test.mjs
```

Expected: pass.

Commit:

```bash
git add client/src/lib/adminAppointments.mjs client/src/lib/adminAppointments.d.ts client/src/lib/adminAppointments.test.mjs
git commit -m "Add admin appointment helpers"
```

---

## Task 2: Admin Appointment API Routes

**Files:**
- Create: `client/src/app/api/admin/appointments/route.ts`
- Create: `client/src/app/api/admin/appointments/[id]/route.ts`
- Modify: `client/src/lib/adminAppointments.test.mjs`

- [ ] **Step 1: Extend helper tests for API-safe merging**

Add this test to `client/src/lib/adminAppointments.test.mjs`:

```js
test('search matching tolerates missing vehicle records', () => {
  assert.equal(vehicleMatchesAppointmentSearch(sampleAppointment, null, 'avery'), true)
  assert.equal(vehicleMatchesAppointmentSearch(sampleAppointment, null, 'veh-1'), true)
  assert.equal(vehicleMatchesAppointmentSearch(sampleAppointment, null, 'rav4'), false)
})
```

- [ ] **Step 2: Run the focused helper test**

Run:

```bash
node --test client/src/lib/adminAppointments.test.mjs
```

Expected: pass after Task 1 helpers already tolerate missing vehicles.

- [ ] **Step 3: Implement list API**

Create `client/src/app/api/admin/appointments/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { requireAdminSession } from '@/lib/apiAuth'
import {
  buildAppointmentDateRange,
  buildAppointmentSummary,
  normalizeAppointmentStatus,
  vehicleMatchesAppointmentSearch,
} from '@/lib/adminAppointments.mjs'

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

async function loadVehiclesById(supabase: SupabaseClient, vehicleIds: string[]) {
  const ids = Array.from(new Set(vehicleIds.map(clean).filter(Boolean)))
  if (ids.length === 0) return new Map<string, Record<string, unknown>>()

  const result = await supabase
    .from('edc_vehicles')
    .select('id,year,make,model,series,stock_number,vin')
    .in('id', ids)

  if (result.error) throw new Error(result.error.message)
  return new Map((result.data || []).map((vehicle: any) => [clean(vehicle.id), vehicle]))
}

export async function GET(request: Request) {
  try {
    const authError = await requireAdminSession(request)
    if (authError) return authError

    const supabase = createSupabase()
    if (!supabase) return NextResponse.json({ error: 'Server not configured' }, { status: 500, headers: noStore })

    const url = new URL(request.url)
    const q = clean(url.searchParams.get('q'))
    const status = clean(url.searchParams.get('status'))
    const range = clean(url.searchParams.get('range')) || 'next_7'
    const from = clean(url.searchParams.get('from'))
    const to = clean(url.searchParams.get('to'))
    const limit = Math.min(Math.max(Number(url.searchParams.get('limit') || 100), 1), 500)
    const computedRange = buildAppointmentDateRange(range)

    let query = supabase
      .from('edc_appointments')
      .select('*')
      .order('starts_at', { ascending: range !== 'past' })
      .limit(limit)

    const fromIso = from || computedRange.from
    const toIso = to || computedRange.to
    if (fromIso) query = query.gte('starts_at', fromIso)
    if (toIso) query = query.lt('starts_at', toIso)
    if (status) query = query.eq('status', normalizeAppointmentStatus(status))

    const appointmentsResult = await query
    if (appointmentsResult.error) {
      return NextResponse.json({
        error: appointmentsResult.error.message,
        setupRequired: appointmentsResult.error.message.toLowerCase().includes('edc_appointments'),
      }, { status: 500, headers: noStore })
    }

    const appointments = Array.isArray(appointmentsResult.data) ? appointmentsResult.data : []
    const vehiclesById = await loadVehiclesById(supabase, appointments.map((row: any) => row.vehicle_id))
    const rows = appointments
      .map((appointment: any) => {
        const vehicle = vehiclesById.get(clean(appointment.vehicle_id)) || null
        return { ...appointment, vehicle }
      })
      .filter((row: any) => vehicleMatchesAppointmentSearch(row, row.vehicle, q))

    return NextResponse.json({
      appointments: rows,
      summary: buildAppointmentSummary(rows),
      filters: { q, status, range, from: fromIso, to: toIso, limit },
    }, { headers: noStore })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to load appointments' }, { status: 500, headers: noStore })
  }
}
```

- [ ] **Step 4: Implement status update API**

Create `client/src/app/api/admin/appointments/[id]/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAdminSession } from '@/lib/apiAuth'
import { isValidAppointmentStatus, normalizeAppointmentStatus } from '@/lib/adminAppointments.mjs'

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

export async function PATCH(request: Request, context: { params: { id: string } }) {
  try {
    const authError = await requireAdminSession(request)
    if (authError) return authError

    const supabase = createSupabase()
    if (!supabase) return NextResponse.json({ error: 'Server not configured' }, { status: 500, headers: noStore })

    const appointmentId = clean(context.params.id)
    if (!appointmentId) return NextResponse.json({ error: 'Appointment ID is required.' }, { status: 400, headers: noStore })

    const body = await request.json().catch(() => ({}))
    const status = normalizeAppointmentStatus(body?.status)
    if (!isValidAppointmentStatus(status)) {
      return NextResponse.json({ error: 'Status must be booked, completed, cancelled, or no_show.' }, { status: 400, headers: noStore })
    }

    const result = await supabase
      .from('edc_appointments')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', appointmentId)
      .select('*')
      .single()

    if (result.error) {
      return NextResponse.json({
        error: result.error.message,
        setupRequired: result.error.message.toLowerCase().includes('edc_appointments'),
      }, { status: 500, headers: noStore })
    }

    return NextResponse.json({ appointment: result.data }, { headers: noStore })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to update appointment' }, { status: 500, headers: noStore })
  }
}
```

- [ ] **Step 5: Run tests and lint API files**

Run:

```bash
node --test client/src/lib/adminAppointments.test.mjs
npm --prefix client run lint -- --file src/app/api/admin/appointments/route.ts --file src/app/api/admin/appointments/[id]/route.ts
```

Expected: helper tests pass and targeted lint passes.

- [ ] **Step 6: Commit**

```bash
git add client/src/lib/adminAppointments.test.mjs client/src/app/api/admin/appointments/route.ts client/src/app/api/admin/appointments/[id]/route.ts
git commit -m "Add admin appointment APIs"
```

---

## Task 3: Admin Appointments Page

**Files:**
- Create: `client/src/app/admin/appointments/page.tsx`

- [ ] **Step 1: Create the appointments page component**

Create `client/src/app/admin/appointments/page.tsx` as a client component with these required pieces:

```tsx
'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { CalendarDays, CheckCircle2, Clock, Mail, Phone, RefreshCw, Search, XCircle } from 'lucide-react'
import {
  APPOINTMENT_STATUS_OPTIONS,
  formatAppointmentCustomerName,
  formatAppointmentVehicleName,
  getAppointmentStatusLabel,
  groupAppointmentsByDate,
} from '@/lib/adminAppointments.mjs'

type AppointmentVehicle = {
  id: string
  year?: string | number | null
  make?: string | null
  model?: string | null
  series?: string | null
  stock_number?: string | null
  vin?: string | null
}

type AppointmentRow = {
  id: string
  lead_id?: string | null
  vehicle_id?: string | null
  appointment_type: string
  source: string
  customer_first_name?: string | null
  customer_last_name?: string | null
  customer_email?: string | null
  customer_phone?: string | null
  customer_note?: string | null
  starts_at: string
  ends_at: string
  time_zone: string
  status: string
  google_sync_status?: string | null
  created_at?: string | null
  updated_at?: string | null
  vehicle?: AppointmentVehicle | null
}

type ApiSummary = {
  total: number
  booked: number
  completed: number
  cancelled: number
  noShow: number
}

const DATE_FILTERS = [
  { value: 'today', label: 'Today' },
  { value: 'tomorrow', label: 'Tomorrow' },
  { value: 'next_7', label: 'Next 7 days' },
  { value: 'past', label: 'Past' },
]

function readAdminHeaders(): Record<string, string> {
  if (typeof window === 'undefined') return {}
  try {
    const session = JSON.parse(window.localStorage.getItem('edc_admin_session') || '{}')
    return {
      'x-admin-email': String(session?.email || ''),
      'x-admin-token': String(session?.session_token || session?.token || ''),
    }
  } catch {
    return {}
  }
}

function formatDateTime(value: string, timeZone = 'America/Toronto') {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Invalid time'
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

function formatTime(value: string, timeZone = 'America/Toronto') {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Invalid time'
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

export default function AdminAppointmentsPage() {
  const [appointments, setAppointments] = useState<AppointmentRow[]>([])
  const [summary, setSummary] = useState<ApiSummary | null>(null)
  const [selected, setSelected] = useState<AppointmentRow | null>(null)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('')
  const [range, setRange] = useState('next_7')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    const params = new URLSearchParams({ range, limit: '200' })
    if (query.trim()) params.set('q', query.trim())
    if (status) params.set('status', status)

    const res = await fetch(`/api/admin/appointments?${params.toString()}`, {
      cache: 'no-store',
      headers: readAdminHeaders(),
    })
    const json = await res.json().catch(() => null)
    if (!res.ok) {
      setError(json?.setupRequired ? 'Run supabase/edc_appointments.sql before using the appointment calendar.' : json?.error || 'Failed to load appointments.')
      setAppointments([])
      setSummary(null)
      setLoading(false)
      return
    }
    setAppointments(Array.isArray(json?.appointments) ? json.appointments : [])
    setSummary(json?.summary || null)
    setLoading(false)
  }, [query, range, status])

  useEffect(() => {
    void load()
  }, [load])

  const grouped = useMemo(() => groupAppointmentsByDate(appointments, 'America/Toronto'), [appointments])
  const counts = summary || { total: 0, booked: 0, completed: 0, cancelled: 0, noShow: 0 }

  const updateStatus = async (appointment: AppointmentRow, nextStatus: string) => {
    setSaving(true)
    setError('')
    const res = await fetch(`/api/admin/appointments/${encodeURIComponent(appointment.id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...readAdminHeaders() },
      body: JSON.stringify({ status: nextStatus }),
    })
    const json = await res.json().catch(() => null)
    setSaving(false)
    if (!res.ok) {
      setError(json?.error || 'Failed to update appointment.')
      return
    }
    const updated = json?.appointment as AppointmentRow
    setAppointments((rows) => rows.map((row) => row.id === appointment.id ? { ...row, ...updated, vehicle: row.vehicle } : row))
    setSelected((current) => current && current.id === appointment.id ? { ...current, ...updated, vehicle: current.vehicle } : current)
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-950">Appointments</h1>
            <p className="mt-1 text-sm text-slate-600">Track scheduled test drives and customer appointments.</p>
          </div>
          <button onClick={() => void load()} className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
        </div>

        <div className="mb-4 grid gap-3 md:grid-cols-5">
          {[
            ['Total', counts.total],
            ['Booked', counts.booked],
            ['Completed', counts.completed],
            ['Cancelled', counts.cancelled],
            ['No-show', counts.noShow],
          ].map(([label, value]) => (
            <div key={String(label)} className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
              <div className="mt-1 text-2xl font-semibold text-slate-950">{value}</div>
            </div>
          ))}
        </div>

        <div className="mb-4 grid gap-3 rounded-lg border border-slate-200 bg-white p-4 lg:grid-cols-[1fr_auto_auto]">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search customer, vehicle, stock, phone, source" className="w-full rounded-md border border-slate-300 py-2 pl-9 pr-3 text-sm" />
          </label>
          <select value={range} onChange={(event) => setRange(event.target.value)} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
            {DATE_FILTERS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
          <select value={status} onChange={(event) => setStatus(event.target.value)} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
            <option value="">All statuses</option>
            {APPOINTMENT_STATUS_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </div>

        {error ? <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

        <div className="space-y-4">
          {loading ? (
            <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">Loading appointments...</div>
          ) : grouped.length === 0 ? (
            <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">No appointments match these filters.</div>
          ) : grouped.map((group) => (
            <section key={group.dateKey} className="rounded-lg border border-slate-200 bg-white">
              <div className="border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-900">{group.dateKey}</div>
              <div className="divide-y divide-slate-100">
                {group.appointments.map((appointment) => (
                  <button key={appointment.id} onClick={() => setSelected(appointment)} className="grid w-full gap-3 px-4 py-4 text-left hover:bg-slate-50 md:grid-cols-[120px_1fr_1fr_120px]">
                    <div className="font-medium text-slate-950">{formatTime(appointment.starts_at, appointment.time_zone)}</div>
                    <div>
                      <div className="font-medium text-slate-950">{formatAppointmentCustomerName(appointment)}</div>
                      <div className="text-xs text-slate-500">{appointment.customer_phone || appointment.customer_email || 'No contact saved'}</div>
                    </div>
                    <div>
                      <div className="text-sm text-slate-800">{formatAppointmentVehicleName(appointment.vehicle, appointment.vehicle_id || '')}</div>
                      <div className="text-xs text-slate-500">{appointment.source || 'website'} · {appointment.appointment_type || 'appointment'}</div>
                    </div>
                    <div className="text-sm font-medium text-slate-700">{getAppointmentStatusLabel(appointment.status)}</div>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>

      {selected ? (
        <div className="fixed inset-0 z-50 bg-slate-950/40" onClick={() => setSelected(null)}>
          <aside className="ml-auto h-full w-full max-w-xl overflow-y-auto bg-white p-6 shadow-xl" onClick={(event) => event.stopPropagation()}>
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-slate-950">{formatAppointmentCustomerName(selected)}</h2>
                <p className="mt-1 text-sm text-slate-500">{formatDateTime(selected.starts_at, selected.time_zone)}</p>
              </div>
              <button onClick={() => setSelected(null)} className="rounded-md p-2 text-slate-500 hover:bg-slate-100"><XCircle className="h-5 w-5" /></button>
            </div>

            <div className="space-y-5 text-sm">
              <div className="rounded-lg border border-slate-200 p-4">
                <div className="mb-2 font-semibold text-slate-900">Customer</div>
                <div className="space-y-2 text-slate-700">
                  <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-slate-400" />{selected.customer_phone || 'No phone'}</div>
                  <div className="flex items-center gap-2"><Mail className="h-4 w-4 text-slate-400" />{selected.customer_email || 'No email'}</div>
                  {selected.customer_note ? <p className="rounded-md bg-slate-50 p-3 text-slate-600">{selected.customer_note}</p> : null}
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 p-4">
                <div className="mb-2 font-semibold text-slate-900">Appointment</div>
                <div className="space-y-2 text-slate-700">
                  <div className="flex items-center gap-2"><Clock className="h-4 w-4 text-slate-400" />{formatDateTime(selected.starts_at, selected.time_zone)} to {formatTime(selected.ends_at, selected.time_zone)}</div>
                  <div className="flex items-center gap-2"><CalendarDays className="h-4 w-4 text-slate-400" />{getAppointmentStatusLabel(selected.status)} · {selected.source}</div>
                  <div>Google sync: {selected.google_sync_status || 'skipped'}</div>
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 p-4">
                <div className="mb-2 font-semibold text-slate-900">Vehicle and lead</div>
                <div className="space-y-2">
                  {selected.vehicle_id ? <Link className="font-medium text-blue-700 hover:underline" href={`/admin/inventory/${encodeURIComponent(selected.vehicle_id)}`}>{formatAppointmentVehicleName(selected.vehicle, selected.vehicle_id)}</Link> : <div className="text-slate-500">No vehicle linked</div>}
                  <div>{selected.lead_id ? `Lead ID: ${selected.lead_id}` : 'No lead linked'}</div>
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                {APPOINTMENT_STATUS_OPTIONS.map((item) => (
                  <button key={item.value} disabled={saving || selected.status === item.value} onClick={() => void updateStatus(selected, item.value)} className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-300 px-3 py-2 font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50">
                    <CheckCircle2 className="h-4 w-4" /> {item.label}
                  </button>
                ))}
              </div>
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  )
}
```

- [ ] **Step 2: Run targeted lint for the page**

Run:

```bash
npm --prefix client run lint -- --file src/app/admin/appointments/page.tsx
```

Expected: pass. If the local lint command reports unrelated project warnings, fix only errors from this file.

- [ ] **Step 3: Commit**

```bash
git add client/src/app/admin/appointments/page.tsx
git commit -m "Add admin appointments page"
```

---

## Task 4: Admin Navigation And Dashboard Widget

**Files:**
- Modify: `client/src/app/admin/AdminLayoutClient.tsx`
- Modify: `client/src/app/admin/page.tsx`

- [ ] **Step 1: Add sidebar navigation**

In `client/src/app/admin/AdminLayoutClient.tsx`, add the appointments nav item after Leads:

```ts
{ href: '/admin/appointments', label: 'Appointments', icon: 'calendar', disabled: !isVerified, visible: canShow('customers') || canShow('access_all_leads_customers') || canShow('inventory') },
```

Add a `calendar` branch to `Icon`:

```tsx
if (name === 'calendar') {
  return (
    <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 2v4m8-4v4M4 9h16M6 5h12a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V7a2 2 0 012-2z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 13h3m2 0h3M8 17h3" />
    </svg>
  )
}
```

- [ ] **Step 2: Add dashboard widget state and loader**

In `client/src/app/admin/page.tsx`, add state beside the other dashboard state:

```ts
type DashboardAppointment = {
  id: string
  customer_first_name?: string | null
  customer_last_name?: string | null
  customer_phone?: string | null
  customer_email?: string | null
  starts_at: string
  time_zone: string
  status: string
  vehicle?: { year?: string | number | null; make?: string | null; model?: string | null; stock_number?: string | null } | null
}

const [appointmentsToday, setAppointmentsToday] = useState<DashboardAppointment[]>([])
const [appointmentsLoading, setAppointmentsLoading] = useState(false)
const [appointmentsError, setAppointmentsError] = useState('')
```

Add a local admin header helper near other admin session helpers if one is not already available:

```ts
const getAdminHeaders = (): Record<string, string> => {
  try {
    const session = JSON.parse(localStorage.getItem('edc_admin_session') || '{}')
    return {
      'x-admin-email': String(session?.email || ''),
      'x-admin-token': String(session?.session_token || session?.token || ''),
    }
  } catch {
    return {}
  }
}
```

Add loader:

```ts
const loadTodayAppointments = async () => {
  setAppointmentsLoading(true)
  setAppointmentsError('')
  try {
    const res = await fetch('/api/admin/appointments?range=today&status=booked&limit=5', {
      cache: 'no-store',
      headers: getAdminHeaders(),
    })
    const json = await res.json().catch(() => null)
    if (!res.ok) {
      setAppointmentsError(json?.setupRequired ? 'Appointment calendar setup required.' : json?.error || 'Unable to load appointments.')
      setAppointmentsToday([])
      return
    }
    setAppointmentsToday(Array.isArray(json?.appointments) ? json.appointments : [])
  } finally {
    setAppointmentsLoading(false)
  }
}
```

Call `loadTodayAppointments()` after admin authentication succeeds and dashboard stats are loaded. Do not call it for unauthenticated users.

- [ ] **Step 3: Render dashboard widget**

Add a dashboard card in the existing admin dashboard content:

```tsx
<div className="rounded-lg border border-slate-200 bg-white p-5">
  <div className="mb-4 flex items-center justify-between gap-3">
    <div>
      <h2 className="text-base font-semibold text-slate-950">Today's Appointments</h2>
      <p className="text-sm text-slate-500">{appointmentsToday.length} booked today</p>
    </div>
    <Link href="/admin/appointments" className="text-sm font-medium text-blue-700 hover:underline">View all</Link>
  </div>
  {appointmentsLoading ? (
    <div className="text-sm text-slate-500">Loading appointments...</div>
  ) : appointmentsError ? (
    <div className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">{appointmentsError}</div>
  ) : appointmentsToday.length === 0 ? (
    <div className="text-sm text-slate-500">No appointments booked for today.</div>
  ) : (
    <div className="space-y-3">
      {appointmentsToday.map((appointment) => (
        <div key={appointment.id} className="flex items-start justify-between gap-3 rounded-md border border-slate-100 p-3">
          <div>
            <div className="font-medium text-slate-900">
              {[appointment.customer_first_name, appointment.customer_last_name].filter(Boolean).join(' ') || appointment.customer_phone || appointment.customer_email || 'Unknown customer'}
            </div>
            <div className="text-xs text-slate-500">{appointment.customer_phone || appointment.customer_email || 'No contact saved'}</div>
          </div>
          <div className="text-right text-sm font-medium text-slate-700">
            {new Intl.DateTimeFormat('en-CA', { timeZone: appointment.time_zone || 'America/Toronto', hour: 'numeric', minute: '2-digit' }).format(new Date(appointment.starts_at))}
          </div>
        </div>
      ))}
    </div>
  )}
</div>
```

- [ ] **Step 4: Run targeted lint**

Run:

```bash
npm --prefix client run lint -- --file src/app/admin/AdminLayoutClient.tsx --file src/app/admin/page.tsx
```

Expected: pass for changed files.

- [ ] **Step 5: Commit**

```bash
git add client/src/app/admin/AdminLayoutClient.tsx client/src/app/admin/page.tsx
git commit -m "Surface appointments in admin dashboard"
```

---

## Task 5: End-To-End Verification

**Files:**
- No required source files.
- Optional screenshots/logs must remain uncommitted unless deliberately requested.

- [ ] **Step 1: Run focused unit tests**

```bash
node --test client/src/lib/adminAppointments.test.mjs client/src/lib/schedulerBooking.test.mjs
```

Expected: all tests pass.

- [ ] **Step 2: Run targeted lint**

```bash
npm --prefix client run lint -- --file src/lib/adminAppointments.d.ts --file src/app/api/admin/appointments/route.ts --file src/app/api/admin/appointments/[id]/route.ts --file src/app/admin/appointments/page.tsx --file src/app/admin/AdminLayoutClient.tsx --file src/app/admin/page.tsx
```

Expected: lint passes for changed files.

- [ ] **Step 3: Run production build**

```bash
npm --prefix client run build
```

Expected: build completes. Existing warnings about HEIC dynamic dependencies or Browserslist can be noted if they remain unrelated.

- [ ] **Step 4: Start local dev server**

```bash
npm --prefix client run dev -- --hostname 127.0.0.1 --port 3000
```

Expected: server starts at `http://127.0.0.1:3000`.

- [ ] **Step 5: Browser smoke test with Playwright**

Use Playwright to verify:

1. Open `http://127.0.0.1:3000/admin/appointments`.
2. If unauthenticated, use the existing local admin login/session flow available in this repo environment.
3. Confirm the page renders the `Appointments` heading.
4. Confirm the page either shows appointment rows, an empty state, or the setup-required message for `supabase/edc_appointments.sql`.
5. Open `http://127.0.0.1:3000/admin`.
6. Confirm the dashboard renders the `Today's Appointments` widget.

- [ ] **Step 6: Confirm git state and final commit**

Run:

```bash
git status --short
```

Expected: only deliberate feature changes are staged or committed. Leave unrelated `.claude`, `.gitignore`, logs, and Facebook rollback test files untouched unless the user explicitly asks to include them.

If Task 5 required fixes, commit them:

```bash
git add <only appointment-calendar files that changed>
git commit -m "Verify admin appointment calendar"
```

---

## Spec Coverage Checklist

- Dedicated `/admin/appointments` page: Task 3.
- Dashboard widget: Task 4.
- Admin navigation: Task 4.
- Date/status/search filters: Task 3.
- Detail drawer: Task 3.
- Status updates: Task 2 and Task 3.
- Vehicle context without foreign key: Task 2.
- Missing SQL setup state: Task 2 and Task 3.
- No Google sync dependency: Task 3 displays reserved/skipped only.
- Focused tests and Playwright verification: Task 1, Task 2, and Task 5.
