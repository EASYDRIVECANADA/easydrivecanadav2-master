create table if not exists public.edc_appointments (
  id uuid primary key default gen_random_uuid(),
  public_token uuid not null default gen_random_uuid(),
  lead_id text,
  vehicle_id text,
  appointment_type text not null default 'test_drive',
  source text not null default 'website',
  customer_first_name text,
  customer_last_name text,
  customer_email text,
  customer_phone text,
  customer_note text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  time_zone text not null default 'America/Toronto',
  status text not null default 'booked',
  google_event_id text,
  google_sync_status text not null default 'skipped',
  google_sync_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists edc_appointments_public_token_idx
  on public.edc_appointments (public_token);

create index if not exists edc_appointments_starts_at_idx
  on public.edc_appointments (starts_at);

create index if not exists edc_appointments_vehicle_starts_at_idx
  on public.edc_appointments (vehicle_id, starts_at)
  where status = 'booked';

comment on table public.edc_appointments is
  'Native EasyDrive scheduler bookings created from public booking links. Google fields are reserved for a future calendar-sync phase.';

comment on column public.edc_appointments.google_sync_status is
  'Calendar sync state reserved for a future phase. Phase 1 bookings use skipped.';
