# Facebook Marketplace Posting Assistant Design

## Goal

Build a native EasyDrive workflow that helps the client post inventory to Facebook Marketplace from vehicles already stored in EasyDrive. Phase 1 should make each vehicle easy to prepare, copy, open in Facebook, and track after manual posting.

The first release must reduce duplicate typing and missed listings without storing Facebook credentials, bypassing Facebook controls, or running background Facebook automation.

## Context

EasyDrive already uses `edc_vehicles` as the active inventory source for public marketplace browsing and admin inventory management. Vehicles have make, model, year, price, mileage, VIN, stock number, descriptions, categories, status, location, and image URLs. Admin inventory also has readiness logic for missing photos, CARFAX, and sold visibility.

The requested Owini-like direction has three possible levels:

1. **Posting assistant**: generate Marketplace-ready content from EasyDrive, provide copy buttons, open Facebook Marketplace, and track manual posting status.
2. **Browser-assisted posting**: use Playwright with a local logged-in browser profile to fill Facebook forms, then pause before final submit.
3. **Full automation**: post, repost, remove sold units, and monitor leads in the background.

Phase 1 will implement option 1. It is the lowest-risk useful slice because Meta's terms restrict unauthorized automated access and automated collection. Browser-assisted posting can be explored later after the client accepts the account-risk tradeoff and confirms the exact Facebook account workflow.

## Phase 1 Scope

- Add a Facebook Marketplace posting queue in the EasyDrive admin.
- Generate posting content from `edc_vehicles`.
- Show vehicle readiness for posting, including missing required Marketplace fields.
- Let staff copy title, description, price, mileage, location, and vehicle URL.
- Let staff open Facebook Marketplace in a new tab from the selected queue item.
- Track status per vehicle:
  - `draft`
  - `ready`
  - `posted`
  - `needs_update`
  - `sold_remove`
  - `skipped`
  - `failed`
- Store posting notes, posted URL, posted timestamp, and last prepared timestamp.
- Keep the workflow human-in-the-loop. The system prepares and tracks; the staff member performs final posting on Facebook.

## Out Of Scope

- Storing Facebook username, password, cookies, or two-factor credentials.
- Headless Facebook automation.
- CAPTCHA or 2FA bypass.
- Scraping Facebook leads or Messenger conversations.
- Automatic reposting.
- Automatic removal of sold listings.
- Multi-platform posting beyond Facebook Marketplace.

## Data Model

Create `public.edc_facebook_marketplace_posts`.

Fields:

- `id uuid primary key default gen_random_uuid()`
- `vehicle_id text not null`
- `user_id text`
- `status text not null default 'draft'`
- `facebook_listing_url text`
- `posting_title text`
- `posting_description text`
- `posting_price numeric`
- `posting_location text`
- `posting_payload jsonb not null default '{}'::jsonb`
- `readiness jsonb not null default '{}'::jsonb`
- `notes text`
- `posted_at timestamptz`
- `last_prepared_at timestamptz`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Indexes:

- unique index on `vehicle_id`
- index on `status`
- index on `user_id, status`
- index on `last_prepared_at desc`

`vehicle_id` stays `text` to match the current mixed EasyDrive vehicle ID usage. The application should not enforce a hard foreign key until the active `edc_vehicles.id` type is confirmed across deployed environments.

## Posting Payload

Generate a deterministic payload from the vehicle:

- Title: `{year} {make} {model} {series_or_trim}`
- Price: prefer `retail_price`, then `price`, then `finance_price`
- Mileage: prefer `mileage`, then `odometer`
- Location: vehicle city/province if present, otherwise dealership default
- Description:
  - first paragraph from existing `ad_description` or `description`
  - key specs: mileage, transmission, fuel, drivetrain, exterior color
  - stock number and VIN if available
  - EasyDrive call-to-action and scheduling link
- Images: normalized vehicle image URLs, capped to a practical posting set
- Public vehicle URL: `/inventory/{vehicle_id}`

The generated text must be editable in the posting UI before staff copy it. Saving edits updates the post row, not the core vehicle record.

## Admin Experience

Add an admin page at `/admin/marketplace/facebook`.

Layout:

- Top summary: ready, needs info, posted, sold/remove.
- Filters: status, readiness, search by make/model/year/stock/VIN.
- Queue table or dense card list with:
  - thumbnail
  - vehicle label
  - price and mileage
  - readiness status
  - posting status
  - last prepared/posted date
  - actions
- Detail drawer for a selected vehicle:
  - generated title
  - generated description
  - key fields
  - image preview list
  - copy buttons
  - open Facebook Marketplace button
  - posted URL input
  - status selector
  - internal notes

Navigation should expose the page from the existing admin sidebar or current marketplace area without replacing the customer-facing marketplace inventory page.

## API Surface

Add admin API routes:

- `GET /api/admin/marketplace/facebook/posts`
  - Loads vehicles and matching post rows.
  - Applies admin/dealer scoping consistent with inventory permissions.
  - Returns generated payload, saved overrides, readiness, and status.
- `POST /api/admin/marketplace/facebook/posts/prepare`
  - Creates or refreshes a post row for one or more vehicles.
  - Does not overwrite staff-edited title/description unless explicitly requested.
- `PATCH /api/admin/marketplace/facebook/posts/[id]`
  - Updates status, posted URL, notes, and editable posting fields.

Routes should use the service-role server client where needed and follow existing admin scoping patterns from inventory APIs.

## Status Rules

- `draft`: post row exists but required fields are missing or staff has not prepared it.
- `ready`: required fields and images are present.
- `posted`: staff marked the item posted and optionally added a Facebook URL.
- `needs_update`: vehicle changed after posting, or staff manually marked it for review.
- `sold_remove`: vehicle status is sold/pending/void and an existing Facebook listing may need removal.
- `skipped`: staff chose not to post this vehicle.
- `failed`: staff or the app recorded a preparation/posting issue.

Vehicle status changes should not delete post history. Sold vehicles should surface as `sold_remove` if they were previously posted.

## Error Handling

- Missing schema returns a setup-pending admin message instead of a blank page.
- Missing vehicle fields are shown as readiness issues, not hard failures.
- Copy failures show a local UI error and leave the text visible.
- API save failures preserve local edits in the UI until the staff member retries or leaves the drawer.
- Facebook opening is a normal external link action; the app does not assume posting succeeded.

## Testing

Focused tests should cover:

- Payload generation from complete and partial vehicle rows.
- Price, mileage, title, description, image, and public URL fallbacks.
- Readiness scoring for missing title, price, mileage, location, and images.
- Status transition helper behavior, especially `posted` to `needs_update` and sold vehicle to `sold_remove`.
- SQL migration contains required table, indexes, and idempotent clauses.
- API payload creation preserves saved staff overrides unless refresh is explicit.

Manual verification should cover:

- Admin queue loads with existing vehicles.
- Copy buttons copy the expected values.
- Facebook Marketplace opens in a new tab.
- Posted URL/status/notes persist after refresh.
- Sold vehicles with posted rows appear in the removal bucket.

## Future Phase: Browser Assistance

A later phase can add a local Playwright runner that opens a user-controlled browser profile, navigates to Facebook Marketplace, fills fields from a prepared post, and pauses before final submit.

That phase must stay opt-in, avoid credential storage, avoid CAPTCHA/2FA bypass, and log screenshots/status for support. It should not be implemented until Phase 1 proves useful and the client confirms which Facebook account or staff workflow owns posting.
