# EasyDrive Native Scheduler

## Goal

Build a native EasyDrive scheduling flow that can be shared in Marketplace/Messenger chats and vehicle pages. A submitted booking should create an EasyDrive lead, create an appointment record, and set the lead follow-up task due time inside EasyDrive.

## Phase 1 Scope

- Public booking page at `/book/test-drive`.
- Vehicle-aware links with `vehicleId` and `source` query params.
- Fixed dealership slot generation in `America/Toronto`.
- Booking API that creates:
  - `edc_leads` row with source, appointment, customer, and vehicle context.
  - `edc_appointments` row for scheduler history.
  - Lead follow-up task fields for the booked appointment time.
- Existing inventory detail test-drive modal uses the native booking page instead of the external LeadConnector iframe.

## Out Of Scope

- Google account connection UI.
- Google Calendar sync for confirmed bookings.
- Customer self-service rescheduling and cancellation.
- SMS reminders.
- Multi-staff round-robin assignment.

## Configuration

Required server env var:

- `EASYDRIVE_SCHEDULER_TIME_ZONE`

## Data Model

`supabase/edc_appointments.sql` creates `edc_appointments` with appointment timing, customer contact fields, vehicle/lead references, source, and status. Google sync fields are retained as future Phase 2 placeholders and Phase 1 bookings use `google_sync_status = skipped`.

The existing `edc_leads` task fields remain the operational reminder surface:

- `task_note`
- `task_due_at`
- `task_completed_at`

## Error Handling

- Invalid or past appointment times return `400`.
- Already-booked slots return `409`.
- If the appointment table migration has not been applied, the public booking page disables submission and shows a setup-pending notice.

## Verification

Focused tests cover timezone conversion, slot generation, lead payload construction, and internal appointment insert payload construction.
