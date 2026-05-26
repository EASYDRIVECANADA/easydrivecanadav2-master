# Dealership Onboarding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a public dealership registration path that creates a pending private owner account and routes dealers to verification and Billing.

**Architecture:** Use a pure helper in `client/src/lib/dealerOnboarding.mjs` for data normalization and payload construction. Add a Next API route at `client/src/app/api/dealers/register/route.ts` for Supabase writes. Add a public `/dealers` page and public navigation links.

**Tech Stack:** Next.js app router, Supabase JS client, Node test runner, Tailwind CSS.

---

### Task 1: Helper And Tests

**Files:**
- Create: `client/src/lib/dealerOnboarding.mjs`
- Create: `client/src/lib/dealerOnboarding.test.mjs`

- [ ] Write tests for normalized registration data, owner payload, dealership payload, and verification URL.
- [ ] Run `node --test client/src/lib/dealerOnboarding.test.mjs` and confirm it fails because the helper does not exist.
- [ ] Implement the helper.
- [ ] Re-run the helper test and confirm it passes.

### Task 2: API Route

**Files:**
- Create: `client/src/app/api/dealers/register/route.ts`

- [ ] Validate required dealer fields.
- [ ] Create or update the `users` owner row as `role: private`.
- [ ] Insert or update a matching `dealership` row using existing company profile fields.
- [ ] Return `verificationUrl: /account/verification?returnUrl=/admin/billing`.

### Task 3: Public Page

**Files:**
- Create: `client/src/app/dealers/page.tsx`

- [ ] Build a public form for dealership registration.
- [ ] Submit to `/api/dealers/register`.
- [ ] On success, show a “Continue to verification” button.

### Task 4: Navigation

**Files:**
- Modify: `client/src/components/Header.tsx`
- Modify: `client/src/components/Footer.tsx`

- [ ] Add a public desktop/mobile link to `/dealers`.
- [ ] Add a footer link to `/dealers`.

### Task 5: Verification

**Files:**
- No code changes.

- [ ] Run `node --test client/src/lib/dealerOnboarding.test.mjs`.
- [ ] Run targeted lint for new/changed files.
- [ ] Run `npm --prefix client run build`.
