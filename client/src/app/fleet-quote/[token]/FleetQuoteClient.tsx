'use client'

import { useMemo, useState } from 'react'
import { Calculator, CheckCircle2, Loader2, LockKeyhole, Send } from 'lucide-react'

type QuoteVehicle = {
  vehicleId: string
  title: string
  sellingPrice: number
  monthlyNoProtection: number
  biweeklyNoProtection: number
  biweeklyWithProtection: number
  protectionBiweeklyUpcharge: number
  vehicle: {
    stockNumber?: string
    vin?: string
    mileage?: number | null
    exteriorColor?: string
  }
}

type Quote = {
  customerName: string
  province: string
  apr: number
  termMonths: number
  warrantyTier: string
  maxBiweeklyPayment?: number | null
  selectedVehicleIds?: string[]
  submittedAt?: string | null
  expiresAt?: string | null
}

function formatCad(value: number | string | null | undefined) {
  const num = Number(value)
  if (!Number.isFinite(num)) return '$0'
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(num)
}

function formatPayment(value: number | string | null | undefined) {
  const num = Number(value)
  if (!Number.isFinite(num)) return '$0.00'
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num)
}

export default function FleetQuoteClient({ token }: { token: string }) {
  const [passcode, setPasscode] = useState('')
  const [quote, setQuote] = useState<Quote | null>(null)
  const [vehicles, setVehicles] = useState<QuoteVehicle[]>([])
  const [selectedVehicleIds, setSelectedVehicleIds] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  const sortedVehicles = useMemo(() => {
    const max = Number(quote?.maxBiweeklyPayment || 0)
    return [...vehicles].sort((a, b) => {
      if (!max) return a.biweeklyWithProtection - b.biweeklyWithProtection
      const aFits = a.biweeklyWithProtection <= max
      const bFits = b.biweeklyWithProtection <= max
      if (aFits !== bFits) return aFits ? -1 : 1
      return a.biweeklyWithProtection - b.biweeklyWithProtection
    })
  }, [quote?.maxBiweeklyPayment, vehicles])

  const unlock = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/fleet-quotes/${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Unable to open quote')
      setQuote(data?.quote || null)
      setVehicles(Array.isArray(data?.vehicles) ? data.vehicles : [])
      setSelectedVehicleIds(Array.isArray(data?.quote?.selectedVehicleIds) ? data.quote.selectedVehicleIds : [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to open quote')
    } finally {
      setLoading(false)
    }
  }

  const toggleVehicle = (vehicleId: string) => {
    setSelectedVehicleIds((current) => {
      if (current.includes(vehicleId)) return current.filter((id) => id !== vehicleId)
      return [...current, vehicleId].slice(0, 3)
    })
  }

  const submit = async () => {
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch(`/api/fleet-quotes/${encodeURIComponent(token)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode, selectedVehicleIds }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Unable to submit picks')
      setQuote(data?.quote || quote)
      setSubmitted(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to submit picks')
    } finally {
      setSubmitting(false)
    }
  }

  if (!quote) {
    return (
      <main className="min-h-screen bg-slate-100 px-4 py-8">
        <section className="mx-auto max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
            <LockKeyhole className="h-5 w-5" />
          </div>
          <h1 className="mt-4 text-2xl font-bold text-slate-950">Open your fleet quote</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">Enter the Last 4 digits of your phone number to view the vehicles selected for you.</p>
          <label className="mt-5 block">
            <span className="text-sm font-semibold text-slate-800">Last 4 digits</span>
            <input value={passcode} onChange={(event) => setPasscode(event.target.value.replace(/\D/g, '').slice(0, 4))} inputMode="numeric" className="mt-1 w-full rounded-md border border-slate-300 px-3 py-3 text-center text-xl tracking-widest outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100" />
          </label>
          {error ? <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
          <button type="button" onClick={() => void unlock()} disabled={loading || passcode.length !== 4} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-md bg-blue-700 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-300">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Calculator className="h-4 w-4" />}
            View quote
          </button>
        </section>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-6 sm:py-8">
      <div className="mx-auto max-w-6xl space-y-5">
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">EasyDrive Fleet Select</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-950">Your fleet finance quote</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Review the vehicles below and choose up to three picks for the EasyDrive team.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-4">
            <Metric label="Province" value={quote.province} />
            <Metric label="APR" value={`${(Number(quote.apr) * 100).toFixed(2)}%`} />
            <Metric label="Term" value={`${quote.termMonths} months`} />
            <Metric label="Max biweekly" value={quote.maxBiweeklyPayment ? formatPayment(quote.maxBiweeklyPayment) : 'Open'} />
          </div>
        </section>

        {submitted ? (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
            <CheckCircle2 className="mr-2 inline h-4 w-4" />
            Your picks were submitted. EasyDrive will follow up with the next steps.
          </div>
        ) : null}
        {error ? <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {sortedVehicles.map((vehicle) => {
            const selected = selectedVehicleIds.includes(vehicle.vehicleId)
            return (
              <article key={vehicle.vehicleId} className={`rounded-lg border bg-white p-4 shadow-sm ${selected ? 'border-blue-500 ring-2 ring-blue-100' : 'border-slate-200'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-bold text-slate-950">{vehicle.title || 'Fleet vehicle'}</h2>
                    <p className="mt-1 text-sm text-slate-500">Stock {vehicle.vehicle.stockNumber || '-'}</p>
                  </div>
                  <button type="button" onClick={() => toggleVehicle(vehicle.vehicleId)} className={`rounded-md px-3 py-2 text-sm font-semibold ${selected ? 'bg-blue-700 text-white' : 'border border-slate-200 text-slate-700 hover:bg-slate-50'}`}>
                    {selected ? 'Picked' : 'Pick'}
                  </button>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <Metric label="Price" value={formatCad(vehicle.sellingPrice)} />
                  <Metric label="Biweekly" value={formatPayment(vehicle.biweeklyWithProtection)} />
                  <Metric label="Monthly" value={formatPayment(vehicle.monthlyNoProtection)} />
                  <Metric label="Protection add-on" value={`+${formatPayment(vehicle.protectionBiweeklyUpcharge)}`} />
                </div>
                <div className="mt-4 text-sm text-slate-500">
                  {vehicle.vehicle.mileage ? `${Number(vehicle.vehicle.mileage).toLocaleString()} km` : 'Mileage unavailable'}
                  {vehicle.vehicle.exteriorColor ? ` · ${vehicle.vehicle.exteriorColor}` : ''}
                </div>
              </article>
            )
          })}
        </section>

        <div className="sticky bottom-0 rounded-lg border border-slate-200 bg-white p-4 shadow-lg">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-slate-600">
              Selected <span className="font-bold text-slate-950">{selectedVehicleIds.length}/3</span> vehicles.
            </div>
            <button type="button" onClick={() => void submit()} disabled={submitting || selectedVehicleIds.length === 0} className="inline-flex items-center justify-center gap-2 rounded-md bg-blue-700 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-300">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Submit picks
            </button>
          </div>
        </div>
      </div>
    </main>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 font-bold text-slate-950">{value}</div>
    </div>
  )
}
