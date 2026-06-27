export const APPOINTMENT_STATUS_OPTIONS = [
  { value: 'booked', label: 'Booked' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'no_show', label: 'No-show' },
]

const STATUS_VALUES = new Set(APPOINTMENT_STATUS_OPTIONS.map((item) => item.value))
const DEFAULT_ADMIN_APPOINTMENT_DURATION_MINUTES = 45

const clean = (value) => String(value ?? '').trim()
const lower = (value) => clean(value).toLowerCase()
const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object || {}, key)

export function normalizeAppointmentStatus(value) {
  const normalized = lower(value).replace(/[\s-]+/g, '_')
  return normalized === 'noshow' ? 'no_show' : normalized
}

export function isValidAppointmentStatus(value) {
  return STATUS_VALUES.has(normalizeAppointmentStatus(value))
}

export function getAppointmentStatusLabel(value) {
  const normalized = normalizeAppointmentStatus(value)
  return APPOINTMENT_STATUS_OPTIONS.find((item) => item.value === normalized)?.label || clean(value) || 'Booked'
}

export function formatAppointmentCustomerName(appointment = {}) {
  const fullName = [appointment.customer_first_name, appointment.customer_last_name].map(clean).filter(Boolean).join(' ')
  return fullName || clean(appointment.customer_phone) || clean(appointment.customer_email) || 'Unknown customer'
}

export function formatAppointmentVehicleName(vehicle, fallbackId = '') {
  if (!vehicle) return fallbackId ? `Vehicle ${fallbackId}` : 'Vehicle unavailable'
  const year = clean(vehicle.year)
  const make = clean(vehicle.make)
  const model = clean(vehicle.model)
  const stock = clean(vehicle.stock_number || vehicle.stockNumber)
  const name = [year, make, model].filter(Boolean).join(' ')
  return `${name || 'Vehicle'}${stock ? ` #${stock}` : ''}`
}

export function buildAppointmentSearchText(appointment = {}, vehicle = null) {
  return [
    appointment.customer_first_name,
    appointment.customer_last_name,
    appointment.customer_email,
    appointment.customer_phone,
    appointment.appointment_type,
    appointment.source,
    appointment.status,
    appointment.vehicle_id,
    vehicle?.year,
    vehicle?.make,
    vehicle?.model,
    vehicle?.series,
    vehicle?.stock_number,
    vehicle?.vin,
  ].map(lower).filter(Boolean).join(' ')
}

export function vehicleMatchesAppointmentSearch(appointment, vehicle, query) {
  const q = lower(query)
  if (!q) return true
  return buildAppointmentSearchText(appointment, vehicle).includes(q)
}

function isoDateKey(value, timeZone = 'America/Toronto') {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'unknown'
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const year = parts.find((part) => part.type === 'year')?.value || '0000'
  const month = parts.find((part) => part.type === 'month')?.value || '00'
  const day = parts.find((part) => part.type === 'day')?.value || '00'
  return `${year}-${month}-${day}`
}

export function groupAppointmentsByDate(appointments = [], timeZone = 'America/Toronto') {
  const map = new Map()
  appointments.forEach((appointment) => {
    const dateKey = isoDateKey(appointment.starts_at, timeZone)
    if (!map.has(dateKey)) map.set(dateKey, [])
    map.get(dateKey).push(appointment)
  })
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dateKey, rows]) => ({
      dateKey,
      appointments: rows.sort((a, b) => String(a.starts_at).localeCompare(String(b.starts_at))),
    }))
}

function startOfUtcDay(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

function addUtcDays(date, days) {
  const next = new Date(date)
  next.setUTCDate(next.getUTCDate() + days)
  return next
}

export function buildAppointmentDateRange(range = 'next_7', nowIso = new Date().toISOString()) {
  const now = new Date(nowIso)
  const start = startOfUtcDay(now)
  if (range === 'today') return { from: start.toISOString(), to: addUtcDays(start, 1).toISOString() }
  if (range === 'tomorrow') return { from: addUtcDays(start, 1).toISOString(), to: addUtcDays(start, 2).toISOString() }
  if (range === 'past') return { from: '', to: now.toISOString() }
  return { from: start.toISOString(), to: addUtcDays(start, 7).toISOString() }
}

export function buildAppointmentSummary(appointments = []) {
  return appointments.reduce((summary, appointment) => {
    const status = normalizeAppointmentStatus(appointment.status || 'booked')
    summary.total += 1
    if (status === 'booked') summary.booked += 1
    if (status === 'completed') summary.completed += 1
    if (status === 'cancelled') summary.cancelled += 1
    if (status === 'no_show') summary.noShow += 1
    return summary
  }, { total: 0, booked: 0, completed: 0, cancelled: 0, noShow: 0 })
}

function endIsoFromStart(startsAt, durationMinutes = DEFAULT_ADMIN_APPOINTMENT_DURATION_MINUTES) {
  const start = new Date(clean(startsAt))
  const minutes = Number(durationMinutes || DEFAULT_ADMIN_APPOINTMENT_DURATION_MINUTES)
  return new Date(start.getTime() + minutes * 60_000).toISOString()
}

export function buildAdminAppointmentPayload({
  leadId,
  vehicleId,
  appointmentType = 'test_drive',
  source = 'admin',
  firstName,
  lastName,
  email,
  phone,
  note,
  startsAt,
  durationMinutes = DEFAULT_ADMIN_APPOINTMENT_DURATION_MINUTES,
  timeZone = 'America/Toronto',
  status = 'booked',
} = {}) {
  return {
    lead_id: clean(leadId) || null,
    vehicle_id: clean(vehicleId) || null,
    appointment_type: clean(appointmentType) || 'test_drive',
    source: clean(source) || 'admin',
    customer_first_name: clean(firstName) || null,
    customer_last_name: clean(lastName) || null,
    customer_email: lower(email) || null,
    customer_phone: clean(phone) || null,
    customer_note: clean(note) || null,
    starts_at: new Date(clean(startsAt)).toISOString(),
    ends_at: endIsoFromStart(startsAt, durationMinutes),
    time_zone: clean(timeZone) || 'America/Toronto',
    status: normalizeAppointmentStatus(status || 'booked'),
    google_event_id: null,
    google_sync_status: 'skipped',
    google_sync_error: null,
    customer_notification_status: 'skipped',
    customer_notification_error: null,
    staff_notification_status: 'skipped',
    staff_notification_error: null,
  }
}

export function buildAdminAppointmentUpdatePayload(input = {}) {
  const payload = {
    updated_at: new Date().toISOString(),
  }

  if (hasOwn(input, 'leadId')) payload.lead_id = clean(input.leadId) || null
  if (hasOwn(input, 'vehicleId')) payload.vehicle_id = clean(input.vehicleId) || null
  if (hasOwn(input, 'appointmentType')) payload.appointment_type = clean(input.appointmentType) || 'test_drive'
  if (hasOwn(input, 'source')) payload.source = clean(input.source) || 'admin'
  if (hasOwn(input, 'firstName')) payload.customer_first_name = clean(input.firstName) || null
  if (hasOwn(input, 'lastName')) payload.customer_last_name = clean(input.lastName) || null
  if (hasOwn(input, 'email')) payload.customer_email = lower(input.email) || null
  if (hasOwn(input, 'phone')) payload.customer_phone = clean(input.phone) || null
  if (hasOwn(input, 'note')) payload.customer_note = clean(input.note) || null
  if (hasOwn(input, 'timeZone')) payload.time_zone = clean(input.timeZone) || 'America/Toronto'
  if (hasOwn(input, 'status')) payload.status = normalizeAppointmentStatus(input.status)

  if (hasOwn(input, 'startsAt')) {
    payload.starts_at = new Date(clean(input.startsAt)).toISOString()
    payload.ends_at = endIsoFromStart(input.startsAt, input.durationMinutes)
  } else if (hasOwn(input, 'endsAt')) {
    payload.ends_at = new Date(clean(input.endsAt)).toISOString()
  }

  return payload
}
