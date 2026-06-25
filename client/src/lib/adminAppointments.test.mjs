import test from 'node:test'
import assert from 'node:assert/strict'
import {
  APPOINTMENT_STATUS_OPTIONS,
  buildAppointmentDateRange,
  buildAppointmentSearchText,
  buildAppointmentSummary,
  formatAppointmentCustomerName,
  formatAppointmentVehicleName,
  groupAppointmentsByDate,
  isValidAppointmentStatus,
  normalizeAppointmentStatus,
  vehicleMatchesAppointmentSearch,
} from './adminAppointments.mjs'

const sampleAppointment = {
  id: 'appt-1',
  customer_first_name: 'Avery',
  customer_last_name: 'Stone',
  customer_email: 'avery@example.com',
  customer_phone: '555-1000',
  vehicle_id: 'veh-1',
  appointment_type: 'test_drive',
  source: 'messenger',
  starts_at: '2026-06-25T14:00:00.000Z',
  ends_at: '2026-06-25T14:30:00.000Z',
  status: 'booked',
}

const sampleVehicle = {
  id: 'veh-1',
  year: 2021,
  make: 'Toyota',
  model: 'RAV4',
  stock_number: 'STK123',
}

test('appointment statuses are explicit and normalized', () => {
  assert.deepEqual(APPOINTMENT_STATUS_OPTIONS.map((item) => item.value), ['booked', 'completed', 'cancelled', 'no_show'])
  assert.equal(isValidAppointmentStatus('booked'), true)
  assert.equal(isValidAppointmentStatus('no_show'), true)
  assert.equal(isValidAppointmentStatus('pending'), false)
  assert.equal(normalizeAppointmentStatus('No Show'), 'no_show')
  assert.equal(normalizeAppointmentStatus('cancelled'), 'cancelled')
})

test('formats customer and vehicle names with graceful fallbacks', () => {
  assert.equal(formatAppointmentCustomerName(sampleAppointment), 'Avery Stone')
  assert.equal(formatAppointmentCustomerName({ customer_phone: '555-2000' }), '555-2000')
  assert.equal(formatAppointmentCustomerName({ customer_email: 'lead@example.com' }), 'lead@example.com')
  assert.equal(formatAppointmentCustomerName({}), 'Unknown customer')
  assert.equal(formatAppointmentVehicleName(sampleVehicle), '2021 Toyota RAV4 #STK123')
  assert.equal(formatAppointmentVehicleName(null, 'veh-missing'), 'Vehicle veh-missing')
})

test('builds searchable text from appointment and vehicle fields', () => {
  const haystack = buildAppointmentSearchText(sampleAppointment, sampleVehicle)
  assert.equal(haystack.includes('avery'), true)
  assert.equal(haystack.includes('rav4'), true)
  assert.equal(haystack.includes('stk123'), true)
  assert.equal(vehicleMatchesAppointmentSearch(sampleAppointment, sampleVehicle, 'messenger'), true)
  assert.equal(vehicleMatchesAppointmentSearch(sampleAppointment, sampleVehicle, 'honda'), false)
})

test('groups appointments by dealership date', () => {
  const grouped = groupAppointmentsByDate([
    sampleAppointment,
    { ...sampleAppointment, id: 'appt-2', starts_at: '2026-06-26T15:00:00.000Z' },
  ], 'America/Toronto')
  assert.equal(grouped.length, 2)
  assert.equal(grouped[0].dateKey, '2026-06-25')
  assert.equal(grouped[0].appointments[0].id, 'appt-1')
})

test('builds appointment date ranges', () => {
  const today = buildAppointmentDateRange('today', '2026-06-25T12:00:00.000Z')
  assert.equal(today.from.startsWith('2026-06-25'), true)
  assert.equal(today.to.startsWith('2026-06-26'), true)

  const next7 = buildAppointmentDateRange('next_7', '2026-06-25T12:00:00.000Z')
  assert.equal(next7.from.startsWith('2026-06-25'), true)
  assert.equal(next7.to.startsWith('2026-07-02'), true)

  const past = buildAppointmentDateRange('past', '2026-06-25T12:00:00.000Z')
  assert.equal(past.to, '2026-06-25T12:00:00.000Z')
})

test('summarizes appointment counts', () => {
  const summary = buildAppointmentSummary([
    sampleAppointment,
    { ...sampleAppointment, id: 'appt-2', status: 'completed' },
    { ...sampleAppointment, id: 'appt-3', status: 'no_show' },
  ])
  assert.equal(summary.total, 3)
  assert.equal(summary.booked, 1)
  assert.equal(summary.completed, 1)
  assert.equal(summary.noShow, 1)
})

test('search matching tolerates missing vehicle records', () => {
  assert.equal(vehicleMatchesAppointmentSearch(sampleAppointment, null, 'avery'), true)
  assert.equal(vehicleMatchesAppointmentSearch(sampleAppointment, null, 'veh-1'), true)
  assert.equal(vehicleMatchesAppointmentSearch(sampleAppointment, null, 'rav4'), false)
})
