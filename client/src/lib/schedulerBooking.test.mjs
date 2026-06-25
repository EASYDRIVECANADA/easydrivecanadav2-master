import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  buildAppointmentInsertPayload,
  buildAppointmentLeadPayload,
  buildSchedulerSlots,
  zonedDateTimeToUtcIso,
} from './schedulerBooking.mjs'

test('converts dealership local appointment time to UTC ISO using the configured timezone', () => {
  assert.equal(
    zonedDateTimeToUtcIso('2026-06-25', '10:30', 'America/Toronto'),
    '2026-06-25T14:30:00.000Z'
  )
})

test('builds bookable test-drive slots and removes already booked times', () => {
  const slots = buildSchedulerSlots({
    fromDate: '2026-06-25',
    days: 2,
    timeZone: 'America/Toronto',
    existingAppointments: [
      { starts_at: '2026-06-25T14:00:00.000Z', status: 'booked' },
      { starts_at: '2026-06-26T16:00:00.000Z', status: 'cancelled' },
    ],
  })

  assert.equal(slots.some((slot) => slot.startsAt === '2026-06-25T14:00:00.000Z'), false)
  assert.equal(slots.some((slot) => slot.startsAt === '2026-06-25T15:00:00.000Z'), true)
  assert.equal(slots.some((slot) => slot.startsAt === '2026-06-26T16:00:00.000Z'), true)
  assert.equal(slots.every((slot) => slot.timeZone === 'America/Toronto'), true)
})

test('builds lead payload with appointment task fields for a Marketplace booking', () => {
  const payload = buildAppointmentLeadPayload({
    firstName: 'Ava',
    lastName: 'Stone',
    email: 'AVA@example.com',
    phone: ' 555-111-2222 ',
    appointmentType: 'test_drive',
    startsAt: '2026-06-25T14:30:00.000Z',
    vehicle: { year: 2021, make: 'Honda', model: 'Civic', id: 'vehicle-1' },
    source: 'messenger',
    note: 'Can bring trade-in.',
  })

  assert.equal(payload.first_name, 'Ava')
  assert.equal(payload.last_name, 'Stone')
  assert.equal(payload.email, 'ava@example.com')
  assert.equal(payload.phone, '555-111-2222')
  assert.equal(payload.vehicle_interest, '2021 Honda Civic')
  assert.equal(payload.manager_status, 'Booked')
  assert.equal(payload.task_due_at, '2026-06-25T14:30:00.000Z')
  assert.equal(payload.task_completed_at, null)
  assert.match(payload.task_note, /Test drive booked/)
  assert.match(payload.message, /Source: EasyDrive Scheduler - Messenger/)
  assert.match(payload.message, /Vehicle ID: vehicle-1/)
})

test('builds internal appointment insert payload with Google sync skipped for phase 1', () => {
  const payload = buildAppointmentInsertPayload({
    leadId: 'lead-1',
    vehicleId: 'vehicle-1',
    appointmentType: 'test_drive',
    source: 'messenger',
    firstName: 'Ava',
    lastName: 'Stone',
    email: 'ava@example.com',
    phone: '555-111-2222',
    note: 'Can bring trade-in.',
    startsAt: '2026-06-25T14:30:00.000Z',
    durationMinutes: 45,
    timeZone: 'America/Toronto',
  })

  assert.equal(payload.lead_id, 'lead-1')
  assert.equal(payload.vehicle_id, 'vehicle-1')
  assert.equal(payload.ends_at, '2026-06-25T15:15:00.000Z')
  assert.equal(payload.google_sync_status, 'skipped')
  assert.equal(payload.google_event_id, null)
  assert.equal(payload.google_sync_error, null)
})
