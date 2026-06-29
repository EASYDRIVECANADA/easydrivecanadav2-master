# Fleet Finance Quotes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the Fleet Finance Calc flow into EasyDrive Canada using existing `edc_vehicles` inventory and customer-safe public quote links.

**Architecture:** Keep the calculation logic in a shared tested library, persist quote profiles in Supabase, expose admin-only quote creation through authenticated API routes, and expose customer quote links through passcode-protected public routes. Customer responses must include public vehicle/payment data only and must not expose raw partner/cost prices.

**Tech Stack:** Next.js App Router, Supabase, Node test runner, Tailwind CSS.

---

### Task 1: Finance Calculator

**Files:**
- Create: `client/src/lib/fleetFinanceQuotes.mjs`
- Create: `client/src/lib/fleetFinanceQuotes.test.mjs`

- [ ] Write failing tests for monthly payment, true biweekly payment, protection package totals, and no double-markup behavior.
- [ ] Run `node --test client/src/lib/fleetFinanceQuotes.test.mjs` and confirm it fails because the module does not exist.
- [ ] Implement the shared calculator with public EasyDrive vehicle prices as the selling price.
- [ ] Run `node --test client/src/lib/fleetFinanceQuotes.test.mjs` and confirm it passes.

### Task 2: Quote Schema

**Files:**
- Create: `supabase/edc_fleet_quote_profiles.sql`
- Create: `scripts/fleet-finance-quotes-schema.test.mjs`

- [ ] Write a schema test requiring `edc_fleet_quote_profiles`, public token, passcode hash, quote settings, suggested/selected vehicle ids, and customer/session timestamps.
- [ ] Run `node --test scripts/fleet-finance-quotes-schema.test.mjs` and confirm it fails because the SQL file does not exist.
- [ ] Add the SQL migration.
- [ ] Run the schema test and confirm it passes.

### Task 3: Quote API

**Files:**
- Create: `client/src/app/api/admin/fleet-quotes/route.ts`
- Create: `client/src/app/api/fleet-quotes/[token]/route.ts`
- Create: `scripts/fleet-finance-quotes-api.test.mjs`

- [ ] Write source-level API tests requiring admin auth, `edc_vehicles` reads, `edc_fleet_quote_profiles` writes, passcode hashing, and customer-safe vehicle selects.
- [ ] Run the API source test and confirm it fails because the routes do not exist.
- [ ] Implement admin quote create/list and public unlock/submit routes.
- [ ] Run the API source test and confirm it passes.

### Task 4: Admin and Customer UI

**Files:**
- Create: `client/src/app/admin/fleet-finance/page.tsx`
- Create: `client/src/app/admin/fleet-finance/FleetFinanceAdminClient.tsx`
- Create: `client/src/app/fleet-quote/[token]/page.tsx`
- Create: `client/src/app/fleet-quote/[token]/FleetQuoteClient.tsx`

- [ ] Add admin quote builder with customer inputs, terms, filters, top picks, and copyable share link.
- [ ] Add customer passcode unlock and vehicle selection page.
- [ ] Run focused lint/build checks for touched pages.
