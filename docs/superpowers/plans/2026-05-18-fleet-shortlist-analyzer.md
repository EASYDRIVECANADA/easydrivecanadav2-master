# Fleet Shortlist Analyzer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Good Buy Analyzer useful before paid valuation data by ranking uploaded fleet rows as a shortlist and decision-support tool.

**Architecture:** Add a deterministic shortlist scorer beside the existing market-comp scorer. Upload parsing stores the initial shortlist score, recommendation, reasons, and risk flags immediately; later market-comp scoring can still replace those fields for researched finalists.

**Tech Stack:** Next.js App Router, Supabase API routes, `xlsx-js-style`, Node test runner.

---

### Task 1: Shortlist Scoring Helper

**Files:**
- Modify: `client/src/lib/goodBuyAnalyzer.mjs`
- Modify: `client/src/lib/goodBuyAnalyzer.d.ts`
- Test: `client/src/lib/goodBuyAnalyzer.test.mjs`

- [ ] **Step 1: Write failing tests**

Add tests that import `scoreShortlistVehicle` and assert:
- a newer AWD SUV/truck with acceptable mileage becomes `Priority Research`
- a high-mileage old unit becomes `Low Priority` or `Avoid / Risk`
- invalid or incomplete VIN/price/mileage data becomes `Missing Data`

- [ ] **Step 2: Run tests and verify red**

Run: `node client/src/lib/goodBuyAnalyzer.test.mjs`

Expected: fail because `scoreShortlistVehicle` is not exported.

- [ ] **Step 3: Implement helper**

Add `scoreShortlistVehicle(vehicle, settings)` returning:
- `score`
- `recommendation`
- `suggestedMaxPurchasePrice: 0`
- `estimatedResaleValue: 0`
- `projectedProfit: 0`
- `projectedMarginPercent: 0`
- `marketPositionPercent: 0`
- `reasons`
- `riskFlags`
- `factorScores`

Use only free/uploaded facts: VIN validity, year, mileage, listed price, make, model, trim/equipment text, age, AWD/SUV/truck keywords, luxury/risk makes, and missing data.

- [ ] **Step 4: Run tests and verify green**

Run: `node client/src/lib/goodBuyAnalyzer.test.mjs`

Expected: all tests pass.

### Task 2: Upload Integration

**Files:**
- Modify: `client/src/app/api/admin/good-buy/uploads/route.ts`

- [ ] **Step 1: Score rows during upload**

For each parsed vehicle, call `scoreShortlistVehicle(vehicle, settingsSnapshot)` before inserting into `edc_good_buy_rows`.

- [ ] **Step 2: Persist shortlist fields**

Insert `score`, `recommendation`, `risk_flags`, `reasons`, and `factor_scores` from the shortlist score.

- [ ] **Step 3: Set upload status**

Use `status: 'shortlisted'` for the upload record.

### Task 3: Admin UI Copy And Filters

**Files:**
- Modify: `client/src/app/admin/good-buy-analyzer/page.tsx`

- [ ] **Step 1: Update labels**

Add filters for `Priority Research`, `Worth Checking`, `Maybe`, `Low Priority`, `Avoid / Risk`, and `Missing Data`.

- [ ] **Step 2: Update dashboard cards**

Show shortlist-oriented counts: rows, priority research, worth checking, average score, missing data, avoid/risk.

- [ ] **Step 3: Update empty detail reason**

When a row has no market comps, show the shortlist explanation rather than telling the admin that comps are required before any explanation exists.

### Task 4: Verification

**Files:**
- All modified files

- [ ] **Step 1: Run unit tests**

Run: `node client/src/lib/goodBuyAnalyzer.test.mjs`

- [ ] **Step 2: Run targeted lint**

Run from `client`: `npx next lint --file src/lib/goodBuyAnalyzer.mjs --file src/app/api/admin/good-buy/uploads/route.ts --file src/app/admin/good-buy-analyzer/page.tsx`

- [ ] **Step 3: Run build**

Run from `client`: `npm run build`

- [ ] **Step 4: Manual sample parse check**

Run a node script against `C:/Users/Admin/Downloads/Enterprise Grounded Inventory 05.15.26.xlsx` and verify rows receive non-empty shortlist recommendations before market comps.
