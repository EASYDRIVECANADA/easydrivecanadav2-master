'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { CalendarDays, CheckCircle2, Clock, Mail, Pencil, Phone, Plus, RefreshCw, Save, Search, XCircle } from 'lucide-react'
import {
  APPOINTMENT_STATUS_OPTIONS,
  formatAppointmentCustomerName,
  formatAppointmentVehicleName,
  getAppointmentStatusLabel,
  groupAppointmentsByDate,
} from '@/lib/adminAppointments.mjs'

type AppointmentVehicle = {
  id: string
  year?: string | number | null
  make?: string | null
  model?: string | null
  series?: string | null
  stock_number?: string | null
  vin?: string | null
}

type AppointmentRow = {
  id: string
  lead_id?: string | null
  vehicle_id?: string | null
  appointment_type: string
  source: string
  customer_first_name?: string | null
  customer_last_name?: string | null
  customer_email?: string | null
  customer_phone?: string | null
  customer_note?: string | null
  starts_at: string
  ends_at: string
  time_zone: string
  status: string
  google_sync_status?: string | null
  created_at?: string | null
  updated_at?: string | null
  vehicle?: AppointmentVehicle | null
}

type ApiSummary = {
  total: number
  booked: number
  completed: number
  cancelled: number
  noShow: number
}

type AppointmentForm = {
  firstName: string
  lastName: string
  email: string
  phone: string
  note: string
  vehicleId: string
  leadId: string
  appointmentType: string
  source: string
  startsAt: string
  durationMinutes: string
  timeZone: string
  status: string
}

const DATE_FILTERS = [
  { value: 'today', label: 'Today' },
  { value: 'tomorrow', label: 'Tomorrow' },
  { value: 'next_7', label: 'Next 7 days' },
  { value: 'past', label: 'Past' },
]

const EMPTY_FORM: AppointmentForm = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  note: '',
  vehicleId: '',
  leadId: '',
  appointmentType: 'test_drive',
  source: 'admin',
  startsAt: '',
  durationMinutes: '45',
  timeZone: 'America/Toronto',
  status: 'booked',
}

function readAdminHeaders(): Record<string, string> {
  if (typeof window === 'undefined') return {}
  try {
    const session = JSON.parse(window.localStorage.getItem('edc_admin_session') || '{}')
    return {
      'x-admin-email': String(session?.email || ''),
      'x-admin-token': String(session?.session_token || session?.token || 'no-token'),
    }
  } catch {
    return {}
  }
}

function formatDateTime(value: string, timeZone = 'America/Toronto') {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Invalid time'
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

function formatTime(value: string, timeZone = 'America/Toronto') {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Invalid time'
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

function timeZoneOffsetMinutes(timeZone: string, date: Date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    timeZoneName: 'shortOffset',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(date)
  const raw = String(parts.find((part) => part.type === 'timeZoneName')?.value || '').trim()
  const match = raw.match(/^GMT([+-])(\d{1,2})(?::(\d{2}))?$/)
  if (!match) return 0
  const sign = match[1] === '-' ? -1 : 1
  return sign * (Number(match[2]) * 60 + Number(match[3] || 0))
}

function dealershipLocalToUtcIso(value: string, timeZone = 'America/Toronto') {
  const [datePart, timePart] = value.split('T')
  if (!datePart || !timePart) return ''
  const [year, month, day] = datePart.split('-').map(Number)
  const [hour, minute] = timePart.split(':').map(Number)
  if (![year, month, day, hour, minute].every(Number.isFinite)) return ''
  const localAsUtc = Date.UTC(year, month - 1, day, hour, minute, 0, 0)
  const offset = timeZoneOffsetMinutes(timeZone, new Date(localAsUtc))
  let utc = localAsUtc - offset * 60_000
  const recalculated = timeZoneOffsetMinutes(timeZone, new Date(utc))
  if (recalculated !== offset) utc = localAsUtc - recalculated * 60_000
  return new Date(utc).toISOString()
}

function toDealershipDateTimeLocal(value: string, timeZone = 'America/Toronto') {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)
  const get = (type: string) => parts.find((part) => part.type === type)?.value || ''
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`
}

export default function AdminAppointmentsPage() {
  const [appointments, setAppointments] = useState<AppointmentRow[]>([])
  const [summary, setSummary] = useState<ApiSummary | null>(null)
  const [selected, setSelected] = useState<AppointmentRow | null>(null)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('')
  const [range, setRange] = useState('next_7')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create')
  const [formAppointmentId, setFormAppointmentId] = useState('')
  const [form, setForm] = useState<AppointmentForm>(EMPTY_FORM)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    const params = new URLSearchParams({ range, limit: '200' })
    if (query.trim()) params.set('q', query.trim())
    if (status) params.set('status', status)

    const res = await fetch(`/api/admin/appointments?${params.toString()}`, {
      cache: 'no-store',
      headers: readAdminHeaders(),
    })
    const json = await res.json().catch(() => null)
    if (!res.ok) {
      setError(json?.setupRequired ? 'Run supabase/edc_appointments.sql before using the appointment calendar.' : json?.error || 'Failed to load appointments.')
      setAppointments([])
      setSummary(null)
      setLoading(false)
      return
    }
    setAppointments(Array.isArray(json?.appointments) ? json.appointments : [])
    setSummary(json?.summary || null)
    setLoading(false)
  }, [query, range, status])

  useEffect(() => {
    void load()
  }, [load])

  const grouped = useMemo(() => groupAppointmentsByDate(appointments, 'America/Toronto'), [appointments])
  const counts = summary || { total: 0, booked: 0, completed: 0, cancelled: 0, noShow: 0 }

  const updateStatus = async (appointment: AppointmentRow, nextStatus: string) => {
    setSaving(true)
    setError('')
    const res = await fetch(`/api/admin/appointments/${encodeURIComponent(appointment.id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...readAdminHeaders() },
      body: JSON.stringify({ status: nextStatus }),
    })
    const json = await res.json().catch(() => null)
    setSaving(false)
    if (!res.ok) {
      setError(json?.error || 'Failed to update appointment.')
      return
    }
    const updated = json?.appointment as AppointmentRow
    setAppointments((rows) => rows.map((row) => row.id === appointment.id ? { ...row, ...updated, vehicle: row.vehicle } : row))
    setSelected((current) => current && current.id === appointment.id ? { ...current, ...updated, vehicle: current.vehicle } : current)
  }

  const openCreateForm = () => {
    setError('')
    setFormMode('create')
    setFormAppointmentId('')
    setForm(EMPTY_FORM)
    setFormOpen(true)
  }

  const openEditForm = (appointment: AppointmentRow) => {
    setError('')
    setFormMode('edit')
    setFormAppointmentId(appointment.id)
    setForm({
      firstName: appointment.customer_first_name || '',
      lastName: appointment.customer_last_name || '',
      email: appointment.customer_email || '',
      phone: appointment.customer_phone || '',
      note: appointment.customer_note || '',
      vehicleId: appointment.vehicle_id || '',
      leadId: appointment.lead_id || '',
      appointmentType: appointment.appointment_type || 'test_drive',
      source: appointment.source || 'admin',
      startsAt: toDealershipDateTimeLocal(appointment.starts_at, appointment.time_zone),
      durationMinutes: String(Math.max(15, Math.round((new Date(appointment.ends_at).getTime() - new Date(appointment.starts_at).getTime()) / 60_000) || 45)),
      timeZone: appointment.time_zone || 'America/Toronto',
      status: appointment.status || 'booked',
    })
    setFormOpen(true)
  }

  const saveAppointment = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaving(true)
    setError('')

    const startsAt = dealershipLocalToUtcIso(form.startsAt, form.timeZone)
    const payload = {
      ...form,
      startsAt,
      durationMinutes: Number(form.durationMinutes || 45),
    }
    const url = formMode === 'create'
      ? '/api/admin/appointments'
      : `/api/admin/appointments/${encodeURIComponent(formAppointmentId)}`
    const res = await fetch(url, {
      method: formMode === 'create' ? 'POST' : 'PATCH',
      headers: { 'Content-Type': 'application/json', ...readAdminHeaders() },
      body: JSON.stringify(payload),
    })
    const json = await res.json().catch(() => null)
    setSaving(false)
    if (!res.ok) {
      setError(json?.error || 'Failed to save appointment.')
      return
    }
    setFormOpen(false)
    setSelected(null)
    await load()
  }

  const setField = (key: keyof AppointmentForm, value: string) => {
    setForm((current) => ({ ...current, [key]: value }))
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-950">Appointments</h1>
            <p className="mt-1 text-sm text-slate-600">Track scheduled test drives and customer appointments.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={openCreateForm} className="inline-flex items-center gap-2 rounded-md bg-blue-700 px-3 py-2 text-sm font-medium text-white hover:bg-blue-800">
              <Plus className="h-4 w-4" /> New appointment
            </button>
            <button onClick={() => void load()} className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">
              <RefreshCw className="h-4 w-4" /> Refresh
            </button>
          </div>
        </div>

        <div className="mb-4 grid gap-3 md:grid-cols-5">
          {[
            ['Total', counts.total],
            ['Booked', counts.booked],
            ['Completed', counts.completed],
            ['Cancelled', counts.cancelled],
            ['No-show', counts.noShow],
          ].map(([label, value]) => (
            <div key={String(label)} className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
              <div className="mt-1 text-2xl font-semibold text-slate-950">{value}</div>
            </div>
          ))}
        </div>

        <div className="mb-4 grid gap-3 rounded-lg border border-slate-200 bg-white p-4 lg:grid-cols-[1fr_auto_auto]">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search customer, vehicle, stock, phone, source" className="w-full rounded-md border border-slate-300 py-2 pl-9 pr-3 text-sm" />
          </label>
          <select value={range} onChange={(event) => setRange(event.target.value)} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
            {DATE_FILTERS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
          <select value={status} onChange={(event) => setStatus(event.target.value)} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
            <option value="">All statuses</option>
            {APPOINTMENT_STATUS_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </div>

        {error ? <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

        <div className="space-y-4">
          {loading ? (
            <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">Loading appointments...</div>
          ) : grouped.length === 0 ? (
            <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">No appointments match these filters.</div>
          ) : grouped.map((group) => (
            <section key={group.dateKey} className="rounded-lg border border-slate-200 bg-white">
              <div className="border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-900">{group.dateKey}</div>
              <div className="divide-y divide-slate-100">
                {group.appointments.map((appointment) => (
                  <button key={appointment.id} onClick={() => setSelected(appointment)} className="grid w-full gap-3 px-4 py-4 text-left hover:bg-slate-50 md:grid-cols-[120px_1fr_1fr_120px]">
                    <div className="font-medium text-slate-950">{formatTime(appointment.starts_at, appointment.time_zone)}</div>
                    <div>
                      <div className="font-medium text-slate-950">{formatAppointmentCustomerName(appointment)}</div>
                      <div className="text-xs text-slate-500">{appointment.customer_phone || appointment.customer_email || 'No contact saved'}</div>
                    </div>
                    <div>
                      <div className="text-sm text-slate-800">{formatAppointmentVehicleName(appointment.vehicle, appointment.vehicle_id || '')}</div>
                      <div className="text-xs text-slate-500">{appointment.source || 'website'} · {appointment.appointment_type || 'appointment'}</div>
                    </div>
                    <div className="text-sm font-medium text-slate-700">{getAppointmentStatusLabel(appointment.status)}</div>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>

      {selected ? (
        <div className="fixed inset-0 z-50 bg-slate-950/40" onClick={() => setSelected(null)}>
          <aside className="ml-auto h-full w-full max-w-xl overflow-y-auto bg-white p-6 shadow-xl" onClick={(event) => event.stopPropagation()}>
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-slate-950">{formatAppointmentCustomerName(selected)}</h2>
                <p className="mt-1 text-sm text-slate-500">{formatDateTime(selected.starts_at, selected.time_zone)}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => openEditForm(selected)} className="rounded-md p-2 text-slate-500 hover:bg-slate-100" aria-label="Edit appointment"><Pencil className="h-5 w-5" /></button>
                <button onClick={() => setSelected(null)} className="rounded-md p-2 text-slate-500 hover:bg-slate-100" aria-label="Close appointment"><XCircle className="h-5 w-5" /></button>
              </div>
            </div>

            <div className="space-y-5 text-sm">
              <div className="rounded-lg border border-slate-200 p-4">
                <div className="mb-2 font-semibold text-slate-900">Customer</div>
                <div className="space-y-2 text-slate-700">
                  <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-slate-400" />{selected.customer_phone || 'No phone'}</div>
                  <div className="flex items-center gap-2"><Mail className="h-4 w-4 text-slate-400" />{selected.customer_email || 'No email'}</div>
                  {selected.customer_note ? <p className="rounded-md bg-slate-50 p-3 text-slate-600">{selected.customer_note}</p> : null}
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 p-4">
                <div className="mb-2 font-semibold text-slate-900">Appointment</div>
                <div className="space-y-2 text-slate-700">
                  <div className="flex items-center gap-2"><Clock className="h-4 w-4 text-slate-400" />{formatDateTime(selected.starts_at, selected.time_zone)} to {formatTime(selected.ends_at, selected.time_zone)}</div>
                  <div className="flex items-center gap-2"><CalendarDays className="h-4 w-4 text-slate-400" />{getAppointmentStatusLabel(selected.status)} · {selected.source}</div>
                  <div>Google sync: {selected.google_sync_status || 'skipped'}</div>
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 p-4">
                <div className="mb-2 font-semibold text-slate-900">Vehicle and lead</div>
                <div className="space-y-2">
                  {selected.vehicle_id ? <Link className="font-medium text-blue-700 hover:underline" href={`/admin/inventory/${encodeURIComponent(selected.vehicle_id)}`}>{formatAppointmentVehicleName(selected.vehicle, selected.vehicle_id)}</Link> : <div className="text-slate-500">No vehicle linked</div>}
                  <div>{selected.lead_id ? `Lead ID: ${selected.lead_id}` : 'No lead linked'}</div>
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                {APPOINTMENT_STATUS_OPTIONS.map((item) => (
                  <button key={item.value} disabled={saving || selected.status === item.value} onClick={() => void updateStatus(selected, item.value)} className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-300 px-3 py-2 font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50">
                    <CheckCircle2 className="h-4 w-4" /> {item.label}
                  </button>
                ))}
              </div>
            </div>
          </aside>
        </div>
      ) : null}

      {formOpen ? (
        <div className="fixed inset-0 z-[60] bg-slate-950/40" onClick={() => setFormOpen(false)}>
          <aside className="ml-auto h-full w-full max-w-2xl overflow-y-auto bg-white p-6 shadow-xl" onClick={(event) => event.stopPropagation()}>
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-slate-950">{formMode === 'create' ? 'New appointment' : 'Edit appointment'}</h2>
                <p className="mt-1 text-sm text-slate-500">Times are entered in {form.timeZone}.</p>
              </div>
              <button onClick={() => setFormOpen(false)} className="rounded-md p-2 text-slate-500 hover:bg-slate-100" aria-label="Close form"><XCircle className="h-5 w-5" /></button>
            </div>

            <form onSubmit={saveAppointment} className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-sm font-medium text-slate-700">
                  First name
                  <input value={form.firstName} onChange={(event) => setField('firstName', event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" required />
                </label>
                <label className="block text-sm font-medium text-slate-700">
                  Last name
                  <input value={form.lastName} onChange={(event) => setField('lastName', event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
                </label>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-sm font-medium text-slate-700">
                  Phone
                  <input value={form.phone} onChange={(event) => setField('phone', event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" inputMode="tel" />
                </label>
                <label className="block text-sm font-medium text-slate-700">
                  Email
                  <input value={form.email} onChange={(event) => setField('email', event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" type="email" />
                </label>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-sm font-medium text-slate-700">
                  Appointment time
                  <input value={form.startsAt} onChange={(event) => setField('startsAt', event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" type="datetime-local" required />
                </label>
                <label className="block text-sm font-medium text-slate-700">
                  Duration
                  <select value={form.durationMinutes} onChange={(event) => setField('durationMinutes', event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
                    <option value="30">30 minutes</option>
                    <option value="45">45 minutes</option>
                    <option value="60">60 minutes</option>
                    <option value="90">90 minutes</option>
                  </select>
                </label>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-sm font-medium text-slate-700">
                  Vehicle ID
                  <input value={form.vehicleId} onChange={(event) => setField('vehicleId', event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="Optional inventory ID" />
                </label>
                <label className="block text-sm font-medium text-slate-700">
                  Lead ID
                  <input value={form.leadId} onChange={(event) => setField('leadId', event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="Optional lead ID" />
                </label>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-sm font-medium text-slate-700">
                  Source
                  <select value={form.source} onChange={(event) => setField('source', event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
                    <option value="admin">Admin</option>
                    <option value="messenger">Messenger</option>
                    <option value="marketplace">Marketplace</option>
                    <option value="website">Website</option>
                    <option value="vehicle_page">Vehicle page</option>
                  </select>
                </label>
                <label className="block text-sm font-medium text-slate-700">
                  Status
                  <select value={form.status} onChange={(event) => setField('status', event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" disabled={formMode === 'create'}>
                    {APPOINTMENT_STATUS_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                  </select>
                </label>
              </div>

              <label className="block text-sm font-medium text-slate-700">
                Note
                <textarea value={form.note} onChange={(event) => setField('note', event.target.value)} className="mt-1 min-h-24 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
              </label>

              <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
                <button type="button" onClick={() => setFormOpen(false)} className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">Cancel</button>
                <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-300">
                  <Save className="h-4 w-4" /> {saving ? 'Saving...' : 'Save appointment'}
                </button>
              </div>
            </form>
          </aside>
        </div>
      ) : null}
    </div>
  )
}
