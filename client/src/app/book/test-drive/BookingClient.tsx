'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { CalendarClock, Car, CheckCircle2, Loader2 } from 'lucide-react'

type Slot = {
  label: string
  startsAt: string
  timeZone: string
}

type Vehicle = {
  id?: string
  year?: number | string
  make?: string
  model?: string
  series?: string
  stock_number?: string
}

type AvailabilityResponse = {
  timeZone: string
  schedulerReady: boolean
  setupError?: string
  vehicle: Vehicle | null
  slots: Slot[]
}

const clean = (value: unknown) => String(value ?? '').trim()

const vehicleName = (vehicle: Vehicle | null) =>
  [vehicle?.year, vehicle?.make, vehicle?.model, vehicle?.series]
    .map(clean)
    .filter(Boolean)
    .join(' ')

export default function BookingClient() {
  const searchParams = useSearchParams()
  const vehicleId = clean(searchParams.get('vehicleId'))
  const source = clean(searchParams.get('source')) || 'messenger'
  const embedded = clean(searchParams.get('embedded')) === '1'
  const [availability, setAvailability] = useState<AvailabilityResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState<Record<string, string> | null>(null)
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    note: '',
    startsAt: '',
  })

  useEffect(() => {
    const loadAvailability = async () => {
      setLoading(true)
      setError('')
      try {
        const query = new URLSearchParams()
        if (vehicleId) query.set('vehicleId', vehicleId)
        const res = await fetch(`/api/scheduler/availability?${query.toString()}`, { cache: 'no-store' })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data?.error || 'Unable to load available times')
        setAvailability(data)
        setForm((current) => ({ ...current, startsAt: data?.slots?.[0]?.startsAt || '' }))
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load available times')
      } finally {
        setLoading(false)
      }
    }

    loadAvailability()
  }, [vehicleId])

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    setSuccess(null)
    try {
      const res = await fetch('/api/scheduler/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          vehicleId,
          source,
          appointmentType: 'test_drive',
          timeZone: availability?.timeZone,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Unable to book appointment')
      setSuccess(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to book appointment')
    } finally {
      setSubmitting(false)
    }
  }

  const title = vehicleName(availability?.vehicle || null) || 'EasyDrive vehicle'

  return (
    <main className={embedded ? 'min-h-screen bg-white' : 'min-h-screen bg-slate-50'}>
      <div className={embedded ? 'mx-auto max-w-5xl px-4 py-5' : 'mx-auto max-w-5xl px-4 py-8 sm:py-12'}>
        <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                <Car className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">EasyDrive Scheduler</p>
                <h1 className="mt-1 text-2xl font-bold text-slate-950">Schedule a test drive</h1>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Pick a time and the appointment will be sent to the EasyDrive team.
                </p>
              </div>
            </div>

            <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Vehicle</div>
              <div className="mt-1 text-lg font-semibold text-slate-950">{title}</div>
              {availability?.vehicle?.stock_number ? (
                <div className="mt-1 text-sm text-slate-500">Stock #{availability.vehicle.stock_number}</div>
              ) : null}
            </div>

            <div className="mt-4 flex items-center gap-2 rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-600">
              <CalendarClock className="h-4 w-4 text-blue-700" />
              Times are shown in {availability?.timeZone || 'America/Toronto'}.
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            {loading ? (
              <div className="flex min-h-64 items-center justify-center text-sm text-slate-500">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading available times
              </div>
            ) : success ? (
              <div className="min-h-64">
                <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <h2 className="mt-4 text-xl font-bold text-slate-950">Appointment booked</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  EasyDrive has your request. A team member can follow up from the lead inbox.
                </p>
                <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
                  <div className="font-semibold text-slate-950">EasyDrive appointment</div>
                  <div className="mt-1 text-slate-600">
                    Booking saved inside EasyDrive. The team can manage this appointment from the lead workflow.
                  </div>
                </div>
              </div>
            ) : (
              <form onSubmit={submit} className="space-y-4">
                <div>
                  <label className="text-sm font-semibold text-slate-800" htmlFor="startsAt">Available time</label>
                  <select
                    id="startsAt"
                    value={form.startsAt}
                    onChange={(event) => setForm((current) => ({ ...current, startsAt: event.target.value }))}
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                    required
                  >
                    {(availability?.slots || []).map((slot) => (
                      <option key={slot.startsAt} value={slot.startsAt}>{slot.label}</option>
                    ))}
                  </select>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="text-sm font-semibold text-slate-800" htmlFor="firstName">First name</label>
                    <input
                      id="firstName"
                      value={form.firstName}
                      onChange={(event) => setForm((current) => ({ ...current, firstName: event.target.value }))}
                      className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-slate-800" htmlFor="lastName">Last name</label>
                    <input
                      id="lastName"
                      value={form.lastName}
                      onChange={(event) => setForm((current) => ({ ...current, lastName: event.target.value }))}
                      className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                    />
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="text-sm font-semibold text-slate-800" htmlFor="phone">Phone</label>
                    <input
                      id="phone"
                      value={form.phone}
                      onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
                      className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                      inputMode="tel"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-slate-800" htmlFor="email">Email</label>
                    <input
                      id="email"
                      value={form.email}
                      onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                      className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                      type="email"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-semibold text-slate-800" htmlFor="note">Note</label>
                  <textarea
                    id="note"
                    value={form.note}
                    onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))}
                    className="mt-1 min-h-24 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                    placeholder="Trade-in, questions, or preferred contact method"
                  />
                </div>

                {availability?.schedulerReady === false ? (
                  <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                    Scheduler setup is pending. Run the appointment table migration before accepting bookings.
                  </div>
                ) : null}

                {error ? (
                  <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
                ) : null}

                <button
                  type="submit"
                  disabled={submitting || availability?.schedulerReady === false || !form.startsAt || (availability?.slots || []).length === 0}
                  className="inline-flex w-full items-center justify-center rounded-md bg-blue-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CalendarClock className="mr-2 h-4 w-4" />}
                  Book test drive
                </button>
              </form>
            )}
          </section>
        </div>
      </div>
    </main>
  )
}
