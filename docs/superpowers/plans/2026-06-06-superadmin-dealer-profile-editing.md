# Superadmin Dealer Profile Editing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let `info@easydrivecanada.com` choose and edit any dealership profile from `/admin/configuration?tab=company` while normal dealers remain scoped to their own profile.

**Architecture:** Add a small shared access helper for superadmin detection and profile scope resolution. Update the existing `CompanyProfileTab.tsx` to load all dealership rows only for superadmin, render a selector, and keep all read/write queries scoped by the selected dealership `user_id`.

**Tech Stack:** Next.js App Router, React state/effects, Supabase client, Node built-in test runner.

---

## File Structure

- Create `client/src/lib/superAdminAccess.mjs`
  - Owns superadmin email normalization and the rule for resolving an editable dealership profile scope.
- Create `client/src/lib/superAdminAccess.test.mjs`
  - Tests superadmin email normalization and non-superadmin scope fallback.
- Modify `client/src/app/admin/configuration/CompanyProfileTab.tsx`
  - Uses the helper.
  - Tracks the current admin email and base user id.
  - Loads dealership selector options only for superadmin.
  - Lets superadmin choose another dealership `user_id`.
  - Clears the form when switching to a selected dealer without an existing profile.
  - Saves to the selected `scopedUserId`, preserving existing `.eq('user_id', scopedUserId)` safety.

No schema changes are required.

---

### Task 1: Add Superadmin Access Helper

**Files:**
- Create: `client/src/lib/superAdminAccess.mjs`
- Test: `client/src/lib/superAdminAccess.test.mjs`

- [ ] **Step 1: Write the failing helper tests**

Create `client/src/lib/superAdminAccess.test.mjs`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'

import { isSuperAdminEmail, resolveEditableDealerUserId } from './superAdminAccess.mjs'

test('isSuperAdminEmail accepts info account regardless of casing and whitespace', () => {
  assert.equal(isSuperAdminEmail(' info@easydrivecanada.com '), true)
  assert.equal(isSuperAdminEmail('INFO@EASYDRIVECANADA.COM'), true)
})

test('isSuperAdminEmail rejects other accounts', () => {
  assert.equal(isSuperAdminEmail('owner@drivetownottawa.com'), false)
  assert.equal(isSuperAdminEmail(''), false)
  assert.equal(isSuperAdminEmail(null), false)
})

test('resolveEditableDealerUserId lets superadmin choose another dealership user id', () => {
  assert.equal(
    resolveEditableDealerUserId({
      adminEmail: 'info@easydrivecanada.com',
      ownUserId: 'edc-admin-user',
      selectedDealerUserId: 'drivetown-user',
    }),
    'drivetown-user'
  )
})

test('resolveEditableDealerUserId falls back to own user id for non-superadmin', () => {
  assert.equal(
    resolveEditableDealerUserId({
      adminEmail: 'owner@drivetownottawa.com',
      ownUserId: 'drivetown-user',
      selectedDealerUserId: 'other-dealer-user',
    }),
    'drivetown-user'
  )
})

test('resolveEditableDealerUserId falls back to own user id when superadmin has not selected a dealer', () => {
  assert.equal(
    resolveEditableDealerUserId({
      adminEmail: 'info@easydrivecanada.com',
      ownUserId: 'edc-admin-user',
      selectedDealerUserId: '',
    }),
    'edc-admin-user'
  )
})
```

- [ ] **Step 2: Run the tests and verify they fail**

Run:

```powershell
node --test client/src/lib/superAdminAccess.test.mjs
```

Expected: FAIL because `client/src/lib/superAdminAccess.mjs` does not exist.

- [ ] **Step 3: Implement the helper**

Create `client/src/lib/superAdminAccess.mjs`:

```js
const SUPERADMIN_EMAIL = 'info@easydrivecanada.com'

const clean = (value) => String(value ?? '').trim()

export function isSuperAdminEmail(email) {
  return clean(email).toLowerCase() === SUPERADMIN_EMAIL
}

export function resolveEditableDealerUserId({ adminEmail, ownUserId, selectedDealerUserId } = {}) {
  const own = clean(ownUserId)
  const selected = clean(selectedDealerUserId)
  if (isSuperAdminEmail(adminEmail) && selected) return selected
  return own || null
}
```

- [ ] **Step 4: Run the tests and verify they pass**

Run:

```powershell
node --test client/src/lib/superAdminAccess.test.mjs
```

Expected: PASS, 5 tests.

- [ ] **Step 5: Commit the helper**

Run:

```powershell
git add client/src/lib/superAdminAccess.mjs client/src/lib/superAdminAccess.test.mjs
git commit -m "feat: add superadmin dealer profile scope helper"
```

---

### Task 2: Add Superadmin Dealer Selector to Company Profile

**Files:**
- Modify: `client/src/app/admin/configuration/CompanyProfileTab.tsx`
- Test: `client/src/lib/superAdminAccess.test.mjs`

- [ ] **Step 1: Add imports and selector types**

At the top of `client/src/app/admin/configuration/CompanyProfileTab.tsx`, update imports:

```ts
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { isSuperAdminEmail, resolveEditableDealerUserId } from '@/lib/superAdminAccess.mjs'
```

Add this type below the imports:

```ts
type DealerProfileOption = {
  id: string
  user_id: string
  company_name?: string | null
  email?: string | null
  website?: string | null
}
```

- [ ] **Step 2: Track admin identity and selected dealer state**

Inside `DealershipDetailsSettingsPage`, near the existing `scopedUserId` state, add:

```ts
  const [ownUserId, setOwnUserId] = useState<string | null>(null)
  const [adminEmail, setAdminEmail] = useState('')
  const [selectedDealerUserId, setSelectedDealerUserId] = useState('')
  const [dealerOptions, setDealerOptions] = useState<DealerProfileOption[]>([])
```

- [ ] **Step 3: Add local session reader**

Below `autoCloseDealOptions`, add:

```ts
  const readAdminSession = (): { email?: string; user_id?: string } | null => {
    try {
      if (typeof window === 'undefined') return null
      const raw = window.localStorage.getItem('edc_admin_session')
      return raw ? (JSON.parse(raw) as { email?: string; user_id?: string }) : null
    } catch {
      return null
    }
  }
```

- [ ] **Step 4: Refactor `getLoggedInAdminDbUserId` to use the session reader**

Replace the start of `getLoggedInAdminDbUserId`:

```ts
      if (typeof window === 'undefined') return null
      const raw = window.localStorage.getItem('edc_admin_session')
      if (!raw) return null
      const parsed = JSON.parse(raw) as { email?: string; user_id?: string }
      const sessionUserId = String(parsed?.user_id ?? '').trim()
```

with:

```ts
      const parsed = readAdminSession()
      if (!parsed) return null
      const sessionUserId = String(parsed?.user_id ?? '').trim()
```

Keep the existing email lookup logic below it.

- [ ] **Step 5: Update initial identity loading**

Replace the existing first `useEffect` that calls `getWebhookUserId()` and sets `scopedUserId` with:

```ts
  useEffect(() => {
    const load = async () => {
      try {
        const session = readAdminSession()
        const email = String(session?.email ?? '').trim().toLowerCase()
        const id = await getWebhookUserId()
        setAdminEmail(email)
        setOwnUserId(id)
        setScopedUserId(resolveEditableDealerUserId({
          adminEmail: email,
          ownUserId: id,
          selectedDealerUserId: '',
        }))
      } catch {
        setOwnUserId(null)
        setScopedUserId(null)
      }
    }
    void load()
  }, [])
```

- [ ] **Step 6: Add derived superadmin flag**

Below `persistDealershipId`, add:

```ts
  const isSuperAdmin = isSuperAdminEmail(adminEmail)
```

- [ ] **Step 7: Add form reset helper**

Below `persistDealershipId`, add this helper before `isSuperAdmin` if preferred:

```ts
  const clearProfileForm = () => {
    setDealershipId(null)
    persistDealershipId(null)
    setLogoDataUrl(null)
    setLogoFileName(null)
    setLogoMimeType(null)
    setCompanyName('')
    setMvda('')
    setTimezone('')
    setWebsite('')
    setStreetAddress('')
    setSuiteApt('')
    setCity('')
    setProvince('')
    setPostalCode('')
    setCountry('')
    setPhone('')
    setFax('')
    setEmail('')
    setMobile('')
    setTaxNumber('')
    setRin('')
    setLicenseTransferFee('')
    setNewPlateFee('')
    setRenewalFee('')
    setUseSequentialStockNumbers(false)
    setNextSalesInvoice('')
    setNextPurchaseInvoice('')
    setNextWorkOrder('')
    setServiceRate('')
    setFinanceInterestRate('')
    setAutoCloseDealsIn('')
    setActionMode('save')
  }
```

- [ ] **Step 8: Load dealership selector options only for superadmin**

Add this `useEffect` after `const isSuperAdmin = ...`:

```ts
  useEffect(() => {
    if (!isSuperAdmin) {
      setDealerOptions([])
      setSelectedDealerUserId('')
      return
    }

    const loadDealers = async () => {
      const { data, error } = await supabase
        .from('dealership')
        .select('id, user_id, company_name, email, website')
        .order('company_name', { ascending: true })

      if (error || !Array.isArray(data)) {
        setDealerOptions([])
        return
      }

      setDealerOptions(
        data
          .map((row: any) => ({
            id: String(row.id || ''),
            user_id: String(row.user_id || ''),
            company_name: row.company_name ?? null,
            email: row.email ?? null,
            website: row.website ?? null,
          }))
          .filter((row) => row.id && row.user_id)
      )
    }

    void loadDealers()
  }, [isSuperAdmin])
```

- [ ] **Step 9: Update scoped user when selected dealer changes**

Add this `useEffect` after the selector loading effect:

```ts
  useEffect(() => {
    setScopedUserId(resolveEditableDealerUserId({
      adminEmail,
      ownUserId,
      selectedDealerUserId,
    }))
  }, [adminEmail, ownUserId, selectedDealerUserId])
```

- [ ] **Step 10: Make profile load clear stale selected-dealer fields**

In the existing `useEffect(() => { if (!scopedUserId) return ... }, [scopedUserId])`, replace:

```ts
        if (error) return
        if (!data) return
```

with:

```ts
        if (error) return
        if (!data) {
          clearProfileForm()
          return
        }
```

This prevents DriveTown fields from staying visible after superadmin switches to a dealer without an existing profile row.

- [ ] **Step 11: Use selected scope in webhook save**

In `onSave`, replace:

```ts
      const user_id = await getWebhookUserId()
```

with:

```ts
      const user_id = scopedUserId || await getWebhookUserId()
```

This makes initial profile creation work for the selected dealer when superadmin is creating a missing profile.

- [ ] **Step 12: Render the superadmin selector**

In the JSX return, immediately after the success/error messages:

```tsx
      {isSuperAdmin ? (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Superadmin dealer profile</div>
          <div className="mt-2 grid gap-2 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
            <select
              value={selectedDealerUserId}
              onChange={(event) => setSelectedDealerUserId(event.target.value)}
              className="edc-input"
            >
              <option value="">EasyDrive Canada profile</option>
              {dealerOptions.map((dealer) => {
                const label = dealer.company_name || dealer.email || dealer.website || dealer.user_id
                const context = [dealer.email, dealer.website].filter(Boolean).join(' - ')
                return (
                  <option key={dealer.id} value={dealer.user_id}>
                    {context ? `${label} (${context})` : label}
                  </option>
                )
              })}
            </select>
            <div className="text-xs text-slate-500">
              Editing {selectedDealerUserId ? 'selected dealer' : 'EasyDrive Canada'}
            </div>
          </div>
        </div>
      ) : null}
```

- [ ] **Step 13: Run a TypeScript syntax/build check**

Run:

```powershell
npm run build
```

from `client/`.

Expected: build succeeds. Existing HEIC/type-stripping warnings are acceptable if unchanged.

- [ ] **Step 14: Commit the component change**

Run:

```powershell
git add client/src/app/admin/configuration/CompanyProfileTab.tsx
git commit -m "feat: let superadmin edit dealer profiles"
```

---

### Task 3: Final Verification and Push

**Files:**
- Verify: `client/src/lib/superAdminAccess.test.mjs`
- Verify: `client/src/app/admin/configuration/CompanyProfileTab.tsx`

- [ ] **Step 1: Run focused tests**

Run:

```powershell
node --test client/src/lib/superAdminAccess.test.mjs
```

Expected: PASS, 5 tests.

- [ ] **Step 2: Run broader relevant tests**

Run:

```powershell
node --test client/src/lib/superAdminAccess.test.mjs client/src/lib/dealerOnboarding.test.mjs client/src/lib/dealerSelectSync.test.mjs client/src/lib/purchaseDocumentPackage.test.mjs
```

Expected: all tests pass.

- [ ] **Step 3: Run client build**

Run:

```powershell
npm run build
```

from `client/`.

Expected: build succeeds. Existing HEIC/type-stripping warnings are acceptable if unchanged.

- [ ] **Step 4: Inspect git status**

Run:

```powershell
git status --short --branch
```

Expected: only intended committed work is ahead of `origin/main`. Unrelated local files such as `.claude/settings.local.json`, `.gitignore`, or dev server logs must not be staged.

- [ ] **Step 5: Push**

Run:

```powershell
git push origin main
```

Expected: push succeeds.

---

## Self-Review Notes

- Spec coverage: helper authorization, superadmin selector, normal dealer scoping, existing Bill of Sale path, no schema change, and tests are covered.
- Placeholder scan: no TBD/TODO placeholders are present.
- Type consistency: helper functions use `adminEmail`, `ownUserId`, and `selectedDealerUserId`; the component plan uses the same names.
