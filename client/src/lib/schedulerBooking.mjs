const clean = (value) => String(value ?? '').trim()
const lower = (value) => clean(value).toLowerCase()

export const DEFAULT_SCHEDULER_TIME_ZONE = 'America/Toronto'
export const DEFAULT_APPOINTMENT_DURATION_MINUTES = 45

const APPOINTMENT_LABELS = {
  test_drive: 'Test Drive',
  phone_call: 'Phone Call',
  finance_consult: 'Financing Consult',
}

const APPOINTMENT_TASK_LABELS = {
  test_drive: 'Test drive booked',
  phone_call: 'Phone call booked',
  finance_consult: 'Financing consult booked',
}

const SOURCE_LABELS = {
  messenger: 'Messenger',
  marketplace: 'Marketplace',
  vehicle_page: 'Vehicle Page',
  website: 'Website',
}

const pad = (value) => String(value).padStart(2, '0')

const addDays = (date, days) => {
  const next = new Date(`${date}T00:00:00.000Z`)
  next.setUTCDate(next.getUTCDate() + days)
  return `${next.getUTCFullYear()}-${pad(next.getUTCMonth() + 1)}-${pad(next.getUTCDate())}`
}

const minutesToTime = (minutes) => `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`

const vehicleName = (vehicle = {}) =>
  [vehicle.year, vehicle.make, vehicle.model, vehicle.series]
    .map(clean)
    .filter(Boolean)
    .join(' ')

const appointmentLabel = (appointmentType) => APPOINTMENT_LABELS[clean(appointmentType)] || 'Appointment'
const sourceLabel = (source) => SOURCE_LABELS[lower(source)] || clean(source) || 'Website'

function timeZoneOffsetMinutes(timeZone, date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    timeZoneName: 'shortOffset',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(date)
  const raw = clean(parts.find((part) => part.type === 'timeZoneName')?.value)
  const match = raw.match(/^GMT([+-])(\d{1,2})(?::(\d{2}))?$/)
  if (!match) return 0
  const sign = match[1] === '-' ? -1 : 1
  return sign * (Number(match[2]) * 60 + Number(match[3] || 0))
}

export function zonedDateTimeToUtcIso(date, time, timeZone = DEFAULT_SCHEDULER_TIME_ZONE) {
  const [year, month, day] = clean(date).split('-').map(Number)
  const [hour, minute] = clean(time).split(':').map(Number)
  if (![year, month, day, hour, minute].every(Number.isFinite)) return ''

  const localAsUtc = Date.UTC(year, month - 1, day, hour, minute, 0, 0)
  let offset = timeZoneOffsetMinutes(timeZone, new Date(localAsUtc))
  let utc = localAsUtc - offset * 60_000
  const recalculated = timeZoneOffsetMinutes(timeZone, new Date(utc))
  if (recalculated !== offset) {
    utc = localAsUtc - recalculated * 60_000
  }
  return new Date(utc).toISOString()
}

export function buildSchedulerSlots({
  fromDate,
  days = 14,
  timeZone = DEFAULT_SCHEDULER_TIME_ZONE,
  existingAppointments = [],
  startHour = 10,
  endHour = 18,
  stepMinutes = 60,
} = {}) {
  const booked = new Set(
    existingAppointments
      .filter((appointment) => lower(appointment?.status || 'booked') !== 'cancelled')
      .map((appointment) => clean(appointment?.starts_at || appointment?.startsAt))
      .filter(Boolean)
  )
  const startDate = clean(fromDate) || new Date().toISOString().slice(0, 10)
  const slots = []

  for (let dayIndex = 0; dayIndex < days; dayIndex += 1) {
    const date = addDays(startDate, dayIndex)
    const weekday = new Date(`${date}T12:00:00.000Z`).getUTCDay()
    if (weekday === 0) continue

    for (let minutes = startHour * 60; minutes < endHour * 60; minutes += stepMinutes) {
      const time = minutesToTime(minutes)
      const startsAt = zonedDateTimeToUtcIso(date, time, timeZone)
      if (!startsAt || booked.has(startsAt)) continue
      slots.push({
        date,
        time,
        startsAt,
        timeZone,
        label: new Intl.DateTimeFormat('en-CA', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          timeZone,
        }).format(new Date(startsAt)),
      })
    }
  }

  return slots
}

export function buildAppointmentLeadPayload({
  firstName,
  lastName,
  email,
  phone,
  appointmentType = 'test_drive',
  startsAt,
  vehicle = {},
  source = 'website',
  note = '',
} = {}) {
  const vehicleText = vehicleName(vehicle)
  const typeLabel = appointmentLabel(appointmentType)
  const taskLabel = APPOINTMENT_TASK_LABELS[clean(appointmentType)] || `${typeLabel} booked`
  const sourceText = sourceLabel(source)
  const messageRows = [
    ['Source', `EasyDrive Scheduler - ${sourceText}`],
    ['Appointment type', typeLabel],
    ['Appointment time', clean(startsAt)],
    ['Vehicle', vehicleText],
    ['Vehicle ID', vehicle.id],
    ['Customer note', note],
  ]
    .map(([label, value]) => clean(value) ? `${label}: ${clean(value)}` : '')
    .filter(Boolean)

  return {
    first_name: clean(firstName) || null,
    last_name: clean(lastName) || null,
    email: lower(email) || null,
    phone: clean(phone) || null,
    vehicle_interest: vehicleText || null,
    message: messageRows.join('\n') || null,
    manager_status: 'Booked',
    task_note: `${taskLabel}${vehicleText ? ` - ${vehicleText}` : ''}`,
    task_due_at: clean(startsAt) || null,
    task_completed_at: null,
  }
}

export function buildAppointmentInsertPayload({
  leadId,
  vehicleId,
  appointmentType = 'test_drive',
  source = 'website',
  firstName,
  lastName,
  email,
  phone,
  note = '',
  startsAt,
  durationMinutes = DEFAULT_APPOINTMENT_DURATION_MINUTES,
  timeZone = DEFAULT_SCHEDULER_TIME_ZONE,
} = {}) {
  const start = new Date(clean(startsAt))
  const end = new Date(start.getTime() + Number(durationMinutes || DEFAULT_APPOINTMENT_DURATION_MINUTES) * 60_000)

  return {
    lead_id: clean(leadId) || null,
    vehicle_id: clean(vehicleId) || null,
    appointment_type: clean(appointmentType) || 'test_drive',
    source: clean(source) || 'website',
    customer_first_name: clean(firstName) || null,
    customer_last_name: clean(lastName) || null,
    customer_email: lower(email) || null,
    customer_phone: clean(phone) || null,
    customer_note: clean(note) || null,
    starts_at: start.toISOString(),
    ends_at: end.toISOString(),
    time_zone: clean(timeZone) || DEFAULT_SCHEDULER_TIME_ZONE,
    status: 'booked',
    google_event_id: null,
    google_sync_status: 'skipped',
    google_sync_error: null,
    customer_notification_status: 'skipped',
    customer_notification_error: null,
    staff_notification_status: 'skipped',
    staff_notification_error: null,
  }
}
