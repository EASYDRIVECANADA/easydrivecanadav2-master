'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { CalendarDays, CheckCircle2, Clock, Mail, Phone, RefreshCw, Search, XCircle } from 'lucide-react'
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

const DATE_FILTERS = [
  { value: 'today', label: 'Today' },
  { value: 'tomorrow', label: 'Tomorrow' },
  { value: 'next_7', label: 'Next 7 days' },
  { value: 'past', label: 'Past' },
]

function readAdminHeaders(): Record<string, string> {
  if (typeof window === 'undefined') return {}
  try {
    const session = JSON.parse(window.localStorage.getItem('edc_admin_session') || '{}')
    return {
      'x-admin-email': String(session?.email || ''),
      'x-admin-token': String(session?.session_token || session?.token || ''),
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

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-950">Appointments</h1>
            <p className="mt-1 text-sm text-slate-600">Track scheduled test drives and customer appointments.</p>
          </div>
          <button onClick={() => void load()} className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
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
              <button onClick={() => setSelected(null)} className="rounded-md p-2 text-slate-500 hover:bg-slate-100"><XCircle className="h-5 w-5" /></button>
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
    </div>
  )
}
