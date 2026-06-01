# Lead Marketing Export Design

## Goal

Give the EasyDrive team a clean internal Excel export of all lead data, including customer contact information, operational notes, and marketing/customer-profile notes, so Aran or a data analyst can improve marketing targeting without manually copying data out of the portal.

## Scope

This feature is an admin-only workflow on the existing Leads page. It does not replace Supabase as the source of truth, and it does not create a separate always-live spreadsheet in the first version. The first version creates an on-demand `.xlsx` file from the current leads data.

The export includes personal contact information because the client explicitly approved that use. Access must therefore be restricted to trusted admin users, with `info@easydrivecanada.com` allowed by default.

## Recommended Approach

Add a manual `Export marketing sheet` action to `client/src/app/admin/leads/page.tsx`. The button loads `xlsx-js-style` dynamically, formats the currently loaded leads into a workbook, and downloads a dated file such as `lead_marketing_export_2026-06-01.xlsx`.

The export should include two sheets:

1. `Leads`: one row per lead with contact, source, targeting, assignment, status, notes, and timestamps.
2. `Summary`: counts by source, status, finance manager, and submitted date bucket.

This avoids building a fragile Google Sheets sync before the team validates the columns. Once the format is proven useful, a later version can add a scheduled Google Sheet or weekly email.

## Data Model

Add an optional `marketing_notes` text column to `public.edc_leads`. Unlike `admin_notes`, this field is an editable analyst-facing customer profile note rather than an append-only operations transcript.

Suggested SQL:

```sql
alter table public.edc_leads
  add column if not exists marketing_notes text;

comment on column public.edc_leads.marketing_notes is
  'Editable internal notes for marketing analysis and customer targeting exports.';
```

The UI should degrade gracefully if this column is missing, similar to the existing `admin_notes`, `manager_status`, and `finance_manager` capability checks.

## Export Columns

The `Leads` sheet should include:

- Lead ID
- Submitted at
- Source
- First name
- Last name
- Full name
- Email
- Phone
- Vehicle interest
- City / address if parsed from the message
- Employment status
- Monthly income
- Down payment
- Credit profile
- Lead status
- Finance manager
- Internal notes transcript
- Marketing notes
- Raw submitted message

If the message includes submitted form fields such as city, province, address, preferred vehicle, or campaign source, the export should extract them into readable columns where possible. Unknown fields remain available in the raw message column.

## Permissions

Only `info@easydrivecanada.com` should see the export button in the first version. Other users continue to manage leads normally. This matches the existing delete/manual-assignment guard and keeps PII exports narrow.

The client-side guard is useful for UX, but the export still reads from the already loaded client-side leads. If this later becomes an API-generated export, the API must enforce the same email allowlist server-side.

## UI Changes

On the Leads page:

- Add `Export marketing sheet` beside Import / New lead for the master account.
- Add a marketing notes editor in the lead detail panel for the master account.
- Show `Marketing notes` in the new lead form only for the master account.
- Keep internal transcript notes separate from marketing notes, so operations history does not get mixed with analyst annotations.

The marketing notes editor can be a simple textarea with Save / Saving states. It should not block the existing notes/status/assignment flows.

## Error Handling

If the `marketing_notes` column is missing, hide or disable marketing-notes editing and keep the export available with a blank `Marketing notes` column. Show a concise setup message only where editing is attempted.

If Excel generation fails, show a non-blocking page-level error and keep the leads data unchanged.

## Testing

Add focused tests around lead export helpers rather than testing the whole page:

- Marketing export rows include personal contact info.
- Notes, marketing notes, finance manager, and status map into the expected columns.
- Missing optional fields become empty strings, not `undefined`.
- Summary counts group correctly by source/status/finance manager.

Manual verification should include generating the workbook from `/admin/leads` and confirming it opens with the expected sheets and columns.

## Out Of Scope

- Automatic Google Sheets sync.
- Emailing exports on a schedule.
- AI-generated notes or targeting recommendations.
- Anonymized exports, because the approved first version includes personal contact info.
