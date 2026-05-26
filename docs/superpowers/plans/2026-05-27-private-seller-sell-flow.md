# Private Seller Sell Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert `/sell` from email-only inquiry into a private seller draft-account and draft-listing flow.

**Architecture:** Add a small pure helper in `client/src/lib/privateSellerSellFlow.mjs` for validation-independent payload construction and active-listing limit checks. Update `/api/sell` to use the helper with Supabase server credentials and preserve the existing email notification. Update `/sell` to show the verification continuation URL returned by the API.

**Tech Stack:** Next.js app router, Supabase REST/client, Node test runner, Nodemailer.

---

### Task 1: Helper And Tests

**Files:**
- Create: `client/src/lib/privateSellerSellFlow.mjs`
- Create: `client/src/lib/privateSellerSellFlow.test.mjs`

- [ ] Write tests that assert `buildPrivateSellerOwnerRow` creates a private owner, `buildPrivateSellerVehicleRow` creates a draft Private Seller vehicle, `hasActivePrivateSellerListing` ignores closed statuses, and `buildVerificationUrl` points to account verification.
- [ ] Run `node --test client/src/lib/privateSellerSellFlow.test.mjs` and confirm it fails because the helper does not exist.
- [ ] Implement the helper with no database calls.
- [ ] Re-run the helper test and confirm it passes.

### Task 2: API Route

**Files:**
- Modify: `client/src/app/api/sell/route.ts`

- [ ] Import helper functions from `privateSellerSellFlow.mjs`.
- [ ] After validation, use Supabase service credentials to find or create the owner row.
- [ ] Count active private seller listings for that `user_id`; return HTTP 409 when the limit is reached.
- [ ] Insert a draft private seller vehicle and return `vehicleId`, `userId`, `verificationUrl`, and any `emailWarning`.
- [ ] Preserve email delivery as a notification, but do not fail the whole flow when SMTP is missing or sending fails.

### Task 3: Public Sell UI

**Files:**
- Modify: `client/src/app/sell/page.tsx`

- [ ] Store the API success payload.
- [ ] Change the success message to explain the draft listing was started.
- [ ] Add a button linking to the returned verification URL.
- [ ] Keep validation and form behavior unchanged for normal errors.

### Task 4: Verification

**Files:**
- Reuse: `client/src/app/account/verification/page.tsx`

- [ ] Confirm no code change is needed because it already creates/updates a private owner and respects `returnUrl`.

### Task 5: Verification Commands

**Files:**
- No code changes.

- [ ] Run `node --test client/src/lib/privateSellerSellFlow.test.mjs`.
- [ ] Run `npm --prefix client run build`.
- [ ] Run targeted lint where practical and report existing unrelated lint failures if present.
