# Admin Appointment Calendar Design

## Goal

Give dealership staff a clear admin view of every appointment created by the native EasyDrive scheduler. Phase 1 focuses on visibility and basic appointment management inside the admin dashboard. Google Calendar sync, reminders, staff assignment, and customer self-service rescheduling stay out of scope for this phase.

## Current Context

The public test-drive scheduler already creates rows in `public.edc_appointments` and links each booking to a lead through `lead_id`. Booking rows include customer contact fields, vehicle ID, appointment type, source, start/end times, timezone, status, and reserved Google sync fields. The admin app already has a dashboard, sidebar navigation, lead management, vehicle detail pages, and server-side admin API auth via `requireAdminSession`.

## Recommended Product Shape

Build a dedicated `Admin > Appointments` page backed by admin-only API routes, and add a compact "Today's Appointments" widget to the existing admin home page. The page should feel like an operations view, not a marketing calendar. Staff need to scan the day, find customer contact info, jump to the related lead or vehicle, and update simple appointment status.

## User Stories

- As a staff member, I can see today's appointments from the dashboard immediately after login.
- As a staff member, I can open a full appointments page and filter by date range, status, and search text.
- As a staff member, I can inspect an appointment and see customer contact details, note, vehicle, source, and linked lead.
- As a staff member, I can mark an appointment as completed, cancelled, or no-show.
- As a staff member, I can jump from an appointment to the related lead or vehicle record.
- As an admin, I can tell when the database table has not been installed yet instead of seeing a broken page.

## Phase 1 Scope

### Admin Navigation

Add an `Appointments` item to the admin sidebar. It should be visible to verified staff who can access leads/customers or inventory, because appointments sit between those workflows.

### Appointments Page

Create `/admin/appointments` as a client admin page that fetches appointments from a new admin API route. The default view should show upcoming appointments grouped by date, starting with today. It should include a compact day/week calendar strip or grouped date list rather than a large drag-and-drop calendar.

Required controls:

- Date filters: Today, Tomorrow, Next 7 days, Past, and custom date range.
- Status filters: Booked, Completed, Cancelled, and No-show.
- Search across customer name, phone, email, vehicle display name, stock number, and source.
- Manual refresh.

Required row content:

- Appointment time.
- Customer name.
- Phone and email when available.
- Vehicle year/make/model and stock number when available.
- Appointment type.
- Booking source.
- Status.

### Appointment Detail Drawer

Selecting an appointment opens a drawer or modal with the full booking context:

- Customer first name, last name, email, phone, and note.
- Start/end time in dealership timezone.
- Appointment type and source.
- Vehicle summary with link to `/admin/inventory/[id]`.
- Lead link to `/admin/leads` with enough context to find the lead.
- Created and updated timestamps.
- Google sync status shown as reserved/skipped, not as an active integration.

### Appointment Actions

Support status updates from the detail drawer and row actions:

- Mark completed.
- Mark no-show.
- Cancel.
- Restore to booked if the user made a mistake.

Status updates should persist to `edc_appointments.status` and update `updated_at`. Phase 1 does not need additional status timestamp columns. If more auditability is required later, add `cancelled_at`, `completed_at`, `no_show_at`, and `admin_note` in Phase 2.

### Dashboard Widget

Add a compact widget to `/admin`:

- Count of today's booked appointments.
- Next appointment time and customer.
- Next 3 to 5 upcoming appointments.
- Empty state when no appointments are scheduled.
- Link to `/admin/appointments`.

The dashboard widget should not replace the full page. It is a fast operational summary.

## API Design

Add admin-only routes:

- `GET /api/admin/appointments`
- `PATCH /api/admin/appointments/[id]`

`GET` accepts query params for date range, status, search, and limit. It returns appointment rows plus vehicle summary data. The implementation can fetch `edc_appointments` and `edc_vehicles` separately and merge in code to avoid depending on a foreign key that does not exist in the current SQL.

`PATCH` accepts a status update limited to `booked`, `completed`, `cancelled`, or `no_show`. It validates admin auth, validates the status transition, updates `status` and `updated_at`, and returns the updated appointment.

Both routes should return a setup-required response when `edc_appointments` is missing, matching the existing pattern used by the Facebook Marketplace posting queue.

## Data Model

No schema change is required for Phase 1. The existing table has enough data:

- `id`
- `lead_id`
- `vehicle_id`
- `appointment_type`
- `source`
- customer fields
- `customer_note`
- `starts_at`
- `ends_at`
- `time_zone`
- `status`
- Google fields reserved for later
- `created_at`
- `updated_at`

Allowed Phase 1 statuses:

- `booked`
- `completed`
- `cancelled`
- `no_show`

The public scheduler should continue creating bookings with `status = 'booked'` and `google_sync_status = 'skipped'`.

## Lead And Vehicle Integration

Each booking already creates an `edc_leads` row. The admin appointment page should expose the linked `lead_id`, but Phase 1 does not need to mutate lead tasks when appointment status changes. Vehicle details should be fetched from `edc_vehicles` when `vehicle_id` is present. Missing vehicle rows should not break the page; show the stored ID and a muted "vehicle unavailable" state.

## Error Handling

- Missing Supabase configuration: show a server configuration error.
- Missing `edc_appointments` table: show a setup-required state with the SQL filename.
- Empty result: show a professional empty state based on active filters.
- Failed status update: keep the drawer open and show the API error.
- Unknown vehicle or lead: keep appointment visible and degrade the link/label.

## Non-Goals

Do not include these in Phase 1:

- Google Calendar sync.
- SMS or email appointment reminders.
- Customer cancel/reschedule link.
- Admin rescheduling.
- Drag-and-drop calendar editing.
- Staff assignment.
- Multi-location scheduling rules.
- Exports or printed daily schedule.

## Testing Plan

Unit tests:

- Appointment status validation.
- Appointment date grouping and display helpers.
- Query filtering helper if extracted from the route.

API tests:

- List appointments with vehicle summaries.
- Return setup-required when the table is missing.
- Reject invalid status updates.
- Persist valid status updates.

Browser verification:

- Create or seed an appointment.
- Open `/admin/appointments`.
- Confirm it appears with correct customer, vehicle, time, source, and status.
- Change status and verify persistence.
- Confirm the dashboard widget shows today's appointment count and links to the full page.

## Acceptance Criteria

- A public scheduler booking appears in the admin appointments page.
- Today's booked appointments appear on the admin dashboard.
- Admin can filter by date/status and search by customer or vehicle.
- Admin can open appointment details.
- Admin can mark booked appointments completed, cancelled, or no-show.
- Vehicle and lead context are visible without breaking when either record is missing.
- Missing SQL setup produces a clear setup-required state.
- Google sync remains visibly reserved for a future phase and is not required for appointment management.
