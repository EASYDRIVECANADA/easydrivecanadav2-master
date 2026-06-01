# Lead Marketing Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an internal Leads page Excel export that includes customer contact info, targeting fields, internal notes, and editable marketing notes for `info@easydrivecanada.com`.

**Architecture:** Keep Supabase as the source of truth. Add a small pure export helper module with tests, add an optional `marketing_notes` SQL column file, and wire the existing Leads page to load/save marketing notes and generate an `.xlsx` workbook client-side with `xlsx-js-style`.

**Tech Stack:** Next.js App Router, React client components, Supabase JS, `xlsx-js-style`, Node test runner.

---

## File Structure

- Create `client/src/lib/leadMarketingExport.mjs`: pure functions for export rows, summary rows, sheet arrays, date formatting, and submitted-message field extraction.
- Create `client/src/lib/leadMarketingExport.test.mjs`: focused tests for PII export rows, optional field normalization, and summary grouping.
- Create `supabase/edc_leads_marketing_notes.sql`: idempotent SQL for the optional `marketing_notes` column.
- Modify `client/src/app/admin/leads/page.tsx`: add `marketingNotes` to lead/draft types, detect column capability, save marketing notes, show master-only marketing notes UI, and generate the Excel workbook.

## Task 1: Add Export Helper Tests

**Files:**
- Create: `client/src/lib/leadMarketingExport.test.mjs`
- Create later: `client/src/lib/leadMarketingExport.mjs`

- [ ] **Step 1: Write the failing tests**

Create `client/src/lib/leadMarketingExport.test.mjs` with:

```js
import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  buildLeadMarketingExportRows,
  buildLeadMarketingSummaryRows,
  LEAD_MARKETING_EXPORT_COLUMNS,
  leadMarketingRowsToAoa,
} from './leadMarketingExport.mjs'

const sampleLeads = [
  {
    id: 'lead-1',
    firstName: 'Jane',
    lastName: 'Smith',
    email: 'jane@example.com',
    phone: '6135550101',
    vehicleInterest: '2018 Honda Civic',
    message: 'Source: Finance Application\nCity: Ottawa\nProvince: ON\nCampaign Source: Facebook Ads',
    employmentStatus: 'Full-time',
    monthlyIncome: 5200,
    downPayment: 2500,
    creditScore: '650',
    adminNotes: '[2026-06-01 10:00] Called customer',
    marketingNotes: 'SUV buyer, low down payment concern',
    managerStatus: 'Contacted',
    financeManager: 'manager@easydrivecanada.com',
    createdAt: '2026-06-01T12:00:00.000Z',
  },
  {
    id: 'lead-2',
    firstName: '',
    lastName: '',
    email: '',
    phone: '6135550202',
    vehicleInterest: '',
    message: 'Source: Contact\nAddress: 4856 Bank St',
    employmentStatus: null,
    monthlyIncome: null,
    downPayment: null,
    creditScore: null,
    adminNotes: null,
    marketingNotes: null,
    managerStatus: null,
    financeManager: null,
    createdAt: '2026-06-02T12:00:00.000Z',
  },
]

test('exports lead rows with personal contact info and marketing notes', () => {
  const [row] = buildLeadMarketingExportRows(sampleLeads)

  assert.equal(row['Lead ID'], 'lead-1')
  assert.equal(row['First name'], 'Jane')
  assert.equal(row['Last name'], 'Smith')
  assert.equal(row['Full name'], 'Jane Smith')
  assert.equal(row.Email, 'jane@example.com')
  assert.equal(row.Phone, '6135550101')
  assert.equal(row.City, 'Ottawa')
  assert.equal(row.Province, 'ON')
  assert.equal(row['Campaign source'], 'Facebook Ads')
  assert.equal(row['Marketing notes'], 'SUV buyer, low down payment concern')
  assert.equal(row['Internal notes transcript'], '[2026-06-01 10:00] Called customer')
})

test('normalizes missing optional export fields to empty strings', () => {
  const [, row] = buildLeadMarketingExportRows(sampleLeads)

  assert.equal(row['Full name'], '')
  assert.equal(row.Email, '')
  assert.equal(row['Monthly income'], '')
  assert.equal(row['Marketing notes'], '')
  assert.equal(row['Finance manager'], '')
  assert.equal(row.Address, '4856 Bank St')
})

test('builds summary rows by source status and finance manager', () => {
  const rows = buildLeadMarketingSummaryRows(sampleLeads)

  assert.deepEqual(rows[0], ['Metric', 'Value', 'Count'])
  assert.ok(rows.some((row) => row[0] === 'Source' && row[1] === 'Finance' && row[2] === 1))
  assert.ok(rows.some((row) => row[0] === 'Status' && row[1] === 'Contacted' && row[2] === 1))
  assert.ok(rows.some((row) => row[0] === 'Finance manager' && row[1] === 'manager@easydrivecanada.com' && row[2] === 1))
  assert.ok(rows.some((row) => row[0] === 'Submitted date' && row[1] === '2026-06-01' && row[2] === 1))
})

test('converts export rows into a stable AOA sheet shape', () => {
  const rows = buildLeadMarketingExportRows(sampleLeads)
  const aoa = leadMarketingRowsToAoa(rows)

  assert.deepEqual(aoa[0], LEAD_MARKETING_EXPORT_COLUMNS)
  assert.equal(aoa.length, 3)
  assert.equal(aoa[1][LEAD_MARKETING_EXPORT_COLUMNS.indexOf('Email')], 'jane@example.com')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
cd client
node --test src/lib/leadMarketingExport.test.mjs
```

Expected: FAIL with module not found or missing named exports from `leadMarketingExport.mjs`.

## Task 2: Implement Export Helper

**Files:**
- Create: `client/src/lib/leadMarketingExport.mjs`
- Test: `client/src/lib/leadMarketingExport.test.mjs`

- [ ] **Step 1: Create the helper module**

Create `client/src/lib/leadMarketingExport.mjs` with:

```js
const clean = (value) => String(value ?? '').trim()

export const LEAD_MARKETING_EXPORT_COLUMNS = [
  'Lead ID',
  'Submitted at',
  'Submitted date',
  'Source',
  'First name',
  'Last name',
  'Full name',
  'Email',
  'Phone',
  'Vehicle interest',
  'City',
  'Province',
  'Address',
  'Campaign source',
  'Employment status',
  'Monthly income',
  'Down payment',
  'Credit profile',
  'Lead status',
  'Finance manager',
  'Internal notes transcript',
  'Marketing notes',
  'Raw submitted message',
]

const parseMessageRows = (message) => {
  const rows = []
  clean(message)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .forEach((line) => {
      const match = line.match(/^([^:]+):\s*(.*)$/)
      if (!match) return
      const label = clean(match[1]).toLowerCase()
      const value = clean(match[2])
      if (label && value && value !== '-') rows.push({ label, value })
    })
  return rows
}

const findMessageValue = (rows, labels) => {
  const wanted = labels.map((label) => clean(label).toLowerCase())
  return rows.find((row) => wanted.includes(row.label))?.value || ''
}

const inferSource = (lead, rows) => {
  const raw = clean(findMessageValue(rows, ['source', 'lead source', 'form source'])).toLowerCase()
  const message = clean(lead?.message).toLowerCase()
  if (raw.includes('insurance') || message.includes('license number')) return 'Insurance'
  if (raw.includes('finance') || raw.includes('financing') || message.includes('credit')) return 'Finance'
  if (raw.includes('contact')) return 'Contact'
  return raw ? raw.replace(/\b\w/g, (char) => char.toUpperCase()) : 'Unknown'
}

const formatDateTime = (value) => {
  const date = new Date(clean(value))
  if (Number.isNaN(date.getTime())) return ''
  return date.toISOString()
}

const formatDate = (value) => formatDateTime(value).slice(0, 10)

const fullName = (lead) => [lead?.firstName, lead?.lastName].map(clean).filter(Boolean).join(' ')

export const buildLeadMarketingExportRows = (leads = []) =>
  leads.map((lead) => {
    const rows = parseMessageRows(lead?.message)
    return {
      'Lead ID': clean(lead?.id),
      'Submitted at': formatDateTime(lead?.createdAt),
      'Submitted date': formatDate(lead?.createdAt),
      Source: inferSource(lead, rows),
      'First name': clean(lead?.firstName),
      'Last name': clean(lead?.lastName),
      'Full name': fullName(lead),
      Email: clean(lead?.email).toLowerCase(),
      Phone: clean(lead?.phone),
      'Vehicle interest': clean(lead?.vehicleInterest),
      City: findMessageValue(rows, ['city', 'town']),
      Province: findMessageValue(rows, ['province', 'state']),
      Address: findMessageValue(rows, ['address', 'street address']),
      'Campaign source': findMessageValue(rows, ['campaign source', 'utm source', 'utm_source', 'ad source']),
      'Employment status': clean(lead?.employmentStatus),
      'Monthly income': lead?.monthlyIncome === null || lead?.monthlyIncome === undefined ? '' : Number(lead.monthlyIncome),
      'Down payment': lead?.downPayment === null || lead?.downPayment === undefined ? '' : Number(lead.downPayment),
      'Credit profile': clean(lead?.creditScore),
      'Lead status': clean(lead?.managerStatus),
      'Finance manager': clean(lead?.financeManager).toLowerCase(),
      'Internal notes transcript': clean(lead?.adminNotes),
      'Marketing notes': clean(lead?.marketingNotes),
      'Raw submitted message': clean(lead?.message),
    }
  })

const countBy = (rows, label, getter) => {
  const counts = new Map()
  rows.forEach((row) => {
    const value = clean(getter(row)) || 'Unassigned'
    counts.set(value, (counts.get(value) || 0) + 1)
  })
  return Array.from(counts.entries())
    .sort((a, b) => a[0].localeCompare(b[0], undefined, { sensitivity: 'base' }))
    .map(([value, count]) => [label, value, count])
}

export const buildLeadMarketingSummaryRows = (leads = []) => {
  const exportRows = buildLeadMarketingExportRows(leads)
  return [
    ['Metric', 'Value', 'Count'],
    ['Total leads', 'All', exportRows.length],
    ...countBy(exportRows, 'Source', (row) => row.Source),
    ...countBy(exportRows, 'Status', (row) => row['Lead status']),
    ...countBy(exportRows, 'Finance manager', (row) => row['Finance manager']),
    ...countBy(exportRows, 'Submitted date', (row) => row['Submitted date']),
  ]
}

export const leadMarketingRowsToAoa = (rows = []) => [
  LEAD_MARKETING_EXPORT_COLUMNS,
  ...rows.map((row) => LEAD_MARKETING_EXPORT_COLUMNS.map((column) => row[column] ?? '')),
]
```

- [ ] **Step 2: Run tests**

Run:

```bash
cd client
node --test src/lib/leadMarketingExport.test.mjs
```

Expected: PASS, 4 tests.

- [ ] **Step 3: Commit helper**

```bash
git add client/src/lib/leadMarketingExport.mjs client/src/lib/leadMarketingExport.test.mjs
git commit -m "Add lead marketing export helpers"
```

## Task 3: Add Marketing Notes SQL File

**Files:**
- Create: `supabase/edc_leads_marketing_notes.sql`

- [ ] **Step 1: Add idempotent SQL**

Create `supabase/edc_leads_marketing_notes.sql` with:

```sql
alter table public.edc_leads
  add column if not exists marketing_notes text;

comment on column public.edc_leads.marketing_notes is
  'Editable internal notes for marketing analysis and customer targeting exports.';
```

- [ ] **Step 2: Commit SQL file**

```bash
git add supabase/edc_leads_marketing_notes.sql
git commit -m "Add lead marketing notes SQL"
```

## Task 4: Wire Marketing Notes Into Leads Page

**Files:**
- Modify: `client/src/app/admin/leads/page.tsx`

- [ ] **Step 1: Extend imports and types**

Add `Download` to the lucide import and import the helper functions:

```ts
import {
  buildLeadMarketingExportRows,
  buildLeadMarketingSummaryRows,
  leadMarketingRowsToAoa,
} from '@/lib/leadMarketingExport.mjs'
```

Add `marketingNotes: string | null` to `Lead`, `marketing_notes?: string | null` to `LeadRow`, and `marketingNotes: string` to `LeadDraft`.

- [ ] **Step 2: Add capability-aware select support**

Change `leadSelectForCapabilities` to accept marketing notes:

```ts
const leadSelectForCapabilities = (
  notesEnabled: boolean,
  statusEnabled: boolean,
  financeManagerEnabled: boolean,
  marketingNotesEnabled: boolean
) => {
  const columns = [BASE_LEAD_SELECT]
  if (notesEnabled) columns.push('admin_notes')
  if (statusEnabled) columns.push('manager_status')
  if (financeManagerEnabled) columns.push('finance_manager')
  if (marketingNotesEnabled) columns.push('marketing_notes')
  return columns.join(', ')
}
```

Set `marketingNotes` in `emptyLeadDraft`, `leadFromDraftPreview`, `mapLeadRow`, and `rowToLeadInsert`.

- [ ] **Step 3: Add page state and fetch fallback**

Add state:

```ts
const [marketingNotesEnabled, setMarketingNotesEnabled] = useState(true)
const [marketingNotesDraft, setMarketingNotesDraft] = useState('')
const [savingMarketingNotes, setSavingMarketingNotes] = useState(false)
const [marketingNotesSaveError, setMarketingNotesSaveError] = useState('')
const [marketingExportError, setMarketingExportError] = useState('')
```

Update `fetchLeads` so it first requests `marketing_notes`, and if Supabase returns a missing-column/schema-cache error, retry without `marketing_notes` and set `marketingNotesEnabled` false. Keep the existing fallback behavior for `finance_manager`, `manager_status`, and `admin_notes`.

- [ ] **Step 4: Add save and export handlers**

Add `handleSaveMarketingNotes`:

```ts
const handleSaveMarketingNotes = async (lead: Lead) => {
  if (!canManageLeadAssignments) return
  if (!marketingNotesEnabled) {
    setMarketingNotesSaveError('Apply the marketing_notes database column before saving marketing notes.')
    return
  }

  setSavingMarketingNotes(true)
  setMarketingNotesSaveError('')
  const nextMarketingNotes = clean(marketingNotesDraft) || null

  try {
    const { error } = await supabase
      .from('edc_leads')
      .update({ marketing_notes: nextMarketingNotes })
      .eq('id', lead.id)

    if (error) throw error

    const localUpdate = { marketingNotes: nextMarketingNotes }
    setLeads((rows) => rows.map((row) => (row.id === lead.id ? { ...row, ...localUpdate } : row)))
    setSelectedLead((current) => (current?.id === lead.id ? { ...current, ...localUpdate } : current))
  } catch (error) {
    console.error('Error saving marketing notes:', error)
    setMarketingNotesSaveError('Unable to save marketing notes. Check that marketing_notes exists on edc_leads.')
  } finally {
    setSavingMarketingNotes(false)
  }
}
```

Add `handleExportMarketingSheet`, using `xlsx-js-style`, `leadMarketingRowsToAoa`, `buildLeadMarketingExportRows`, and `buildLeadMarketingSummaryRows`. Apply header styling, column widths, freeze row one, and write `lead_marketing_export_YYYY-MM-DD.xlsx`.

- [ ] **Step 5: Add UI controls**

Add a master-only export button next to Import / New lead:

```tsx
{canManageLeadAssignments ? (
  <button
    type="button"
    onClick={handleExportMarketingSheet}
    className="inline-flex h-9 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50"
  >
    <Download className="h-4 w-4" />
    Export marketing sheet
  </button>
) : null}
```

Pass marketing note props into `LeadDetailPanel` and `LeadFormModal`. In `LeadDetailPanel`, add a `DetailSection title="Marketing notes"` with a textarea and Save button for master users. In `LeadFormModal`, add a `Marketing notes` textarea for master users.

- [ ] **Step 6: Run focused checks**

Run:

```bash
cd client
node --test src/lib/leadMarketingExport.test.mjs
node --test src/lib/leadWorkflow.test.mjs
```

Expected: both commands pass.

- [ ] **Step 7: Commit UI wiring**

```bash
git add client/src/app/admin/leads/page.tsx
git commit -m "Add lead marketing export UI"
```

## Task 5: Verify Build And Push

**Files:**
- All files from prior tasks.

- [ ] **Step 1: Run production build**

Run:

```bash
cd client
NEXT_PUBLIC_SUPABASE_URL='https://cnmqbbqgnbwvhbpwbyqn.supabase.co' NEXT_PUBLIC_SUPABASE_ANON_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNubXFiYnFnbmJ3dmhicHdieXFuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzMzAxMTksImV4cCI6MjA4MzkwNjExOX0.rhu6hOfGaVY-jpQWUrlgeVcZoabcdun5eeHmStgKdOg' npm run build
```

Expected: exit 0. Existing libheif/type-stripping warnings are acceptable.

- [ ] **Step 2: Run TypeScript check for regression awareness**

Run:

```bash
cd client
npx tsc --noEmit --pretty false
```

Expected: this repo currently has unrelated TypeScript failures. There must be no new errors from `src/app/admin/leads/page.tsx` or `src/lib/leadMarketingExport`.

- [ ] **Step 3: Push all commits**

```bash
git status -sb
git push origin main
```

Expected: `main -> main` pushed and worktree clean.

## Self-Review

- Spec coverage: Tasks cover manual Excel export, PII columns, summary sheet, `marketing_notes`, master-only UI, fallback behavior, and tests.
- Plan audit: every task has concrete files, commands, and code snippets.
- Type consistency: plan uses `marketingNotes` in React state/types and `marketing_notes` for Supabase only.
