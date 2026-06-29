'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Calculator, Check, Copy, Loader2, RefreshCw, Search } from 'lucide-react'

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

type QuoteRow = {
  publicToken: string
  customerName: string
  customerPhoneLast4: string
  quoteUrl: string
  suggestedVehicleIds: string[]
  selectedVehicleIds: string[]
  submittedAt?: string | null
  createdAt?: string | null
}

const DEFAULT_FORM = {
  customerName: '',
  customerPhone: '',
  province: 'ON',
  apr: '0.0799',
  termMonths: '96',
  warrantyTier: '3yr',
  maxBiweeklyPayment: '',
  staffNote: '',
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

export default function FleetFinanceAdminClient() {
  const [vehicles, setVehicles] = useState<QuoteVehicle[]>([])
  const [quotes, setQuotes] = useState<QuoteRow[]>([])
  const [form, setForm] = useState(DEFAULT_FORM)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState('')

  const quoteParams = useMemo(() => {
    const params = new URLSearchParams()
    params.set('province', form.province)
    params.set('apr', form.apr)
    params.set('termMonths', form.termMonths)
    params.set('warrantyTier', form.warrantyTier)
    return params
  }, [form.apr, form.province, form.termMonths, form.warrantyTier])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/admin/fleet-quotes?${quoteParams.toString()}`, {
        headers: readAdminHeaders(),
        cache: 'no-store',
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Unable to load fleet finance data')
      setVehicles(Array.isArray(data?.vehicles) ? data.vehicles : [])
      setQuotes(Array.isArray(data?.quotes) ? data.quotes : [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load fleet finance data')
    } finally {
      setLoading(false)
    }
  }, [quoteParams])

  useEffect(() => {
    void load()
  }, [load])

  const filteredVehicles = useMemo(() => {
    const q = query.trim().toLowerCase()
    return vehicles
      .filter((vehicle) => {
        if (!q) return true
        return [
          vehicle.title,
          vehicle.vehicle.stockNumber,
          vehicle.vehicle.vin,
          vehicle.vehicle.exteriorColor,
        ].filter(Boolean).join(' ').toLowerCase().includes(q)
      })
      .filter((vehicle) => {
        const max = Number(form.maxBiweeklyPayment || 0)
        if (!max) return true
        return Number(vehicle.biweeklyWithProtection || 0) <= max
      })
  }, [form.maxBiweeklyPayment, query, vehicles])

  const toggleVehicle = (vehicleId: string) => {
    setSelectedIds((current) => {
      if (current.includes(vehicleId)) return current.filter((id) => id !== vehicleId)
      return [...current, vehicleId].slice(0, 3)
    })
  }

  const copyText = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(label)
      window.setTimeout(() => setCopied(''), 1800)
    } catch {
      setError('Unable to copy to clipboard.')
    }
  }

  const createQuote = async () => {
    setCreating(true)
    setError('')
    try {
      const res = await fetch('/api/admin/fleet-quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...readAdminHeaders() },
        body: JSON.stringify({
          ...form,
          apr: Number(form.apr),
          termMonths: Number(form.termMonths),
          maxBiweeklyPayment: form.maxBiweeklyPayment ? Number(form.maxBiweeklyPayment) : null,
          suggestedVehicleIds: selectedIds,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Unable to create quote')
      const quote = data?.quote as QuoteRow
      setQuotes((current) => [quote, ...current])
      setForm(DEFAULT_FORM)
      setSelectedIds([])
      if (quote?.quoteUrl) await copyText('quote link', quote.quoteUrl)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create quote')
    } finally {
      setCreating(false)
    }
  }

  return (
    <main className="min-h-screen bg-slate-100 p-4 sm:p-6">
      <div className="mx-auto max-w-7xl space-y-5">
        <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-5 shadow-sm md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Fleet Select</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-950">Fleet Finance Calculator</h1>
            <p className="mt-1 text-sm text-slate-600">Create customer-safe fleet quote links from existing EasyDrive inventory.</p>
          </div>
          <button type="button" onClick={() => void load()} className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>

        {error ? <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
        {copied ? <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{copied} copied.</div> : null}

        <div className="grid gap-5 lg:grid-cols-[360px_1fr]">
          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <Calculator className="h-5 w-5 text-blue-700" />
              <h2 className="text-lg font-bold text-slate-950">Create quote</h2>
            </div>
            <div className="mt-4 space-y-3">
              <Input label="Customer name" value={form.customerName} onChange={(value) => setForm((prev) => ({ ...prev, customerName: value }))} />
              <Input label="Customer phone" value={form.customerPhone} onChange={(value) => setForm((prev) => ({ ...prev, customerPhone: value }))} />
              <div className="grid grid-cols-2 gap-3">
                <Input label="APR" value={form.apr} onChange={(value) => setForm((prev) => ({ ...prev, apr: value }))} />
                <Input label="Term" value={form.termMonths} onChange={(value) => setForm((prev) => ({ ...prev, termMonths: value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Select label="Province" value={form.province} onChange={(value) => setForm((prev) => ({ ...prev, province: value }))} options={['ON', 'QC', 'BC', 'AB', 'MB', 'SK', 'NS', 'NB', 'NL', 'PE']} />
                <Select label="Warranty" value={form.warrantyTier} onChange={(value) => setForm((prev) => ({ ...prev, warrantyTier: value }))} options={['3yr', '2yr', 'none']} />
              </div>
              <Input label="Max biweekly payment" value={form.maxBiweeklyPayment} onChange={(value) => setForm((prev) => ({ ...prev, maxBiweeklyPayment: value }))} />
              <label className="block">
                <span className="text-sm font-semibold text-slate-800">Staff note</span>
                <textarea value={form.staffNote} onChange={(event) => setForm((prev) => ({ ...prev, staffNote: event.target.value }))} className="mt-1 min-h-20 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100" />
              </label>
              <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                Selected top picks: <span className="font-semibold text-slate-950">{selectedIds.length}/3</span>
              </div>
              <button type="button" onClick={() => void createQuote()} disabled={creating || !form.customerName.trim() || !form.customerPhone.trim()} className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-blue-700 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-300">
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Create quote
              </button>
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-slate-200 p-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="font-bold text-slate-950">Fleet vehicles</h2>
                <p className="text-sm text-slate-500">{filteredVehicles.length} vehicles available for this quote.</p>
              </div>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search stock, VIN, model" className="w-full rounded-md border border-slate-300 py-2 pl-9 pr-3 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 md:w-72" />
              </div>
            </div>
            {loading ? (
              <div className="flex min-h-72 items-center justify-center text-sm text-slate-500">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading fleet vehicles
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {filteredVehicles.slice(0, 80).map((vehicle) => {
                  const selected = selectedIds.includes(vehicle.vehicleId)
                  return (
                    <button key={vehicle.vehicleId} type="button" onClick={() => toggleVehicle(vehicle.vehicleId)} className={`grid w-full gap-3 px-4 py-3 text-left hover:bg-slate-50 md:grid-cols-[1fr_130px_130px_96px] md:items-center ${selected ? 'bg-blue-50' : ''}`}>
                      <div>
                        <div className="font-semibold text-slate-950">{vehicle.title || 'Untitled vehicle'}</div>
                        <div className="mt-1 text-xs text-slate-500">Stock {vehicle.vehicle.stockNumber || '-'} · {vehicle.vehicle.mileage ? `${Number(vehicle.vehicle.mileage).toLocaleString()} km` : 'Mileage unavailable'}</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-500">Selling price</div>
                        <div className="font-semibold text-slate-900">{formatCad(vehicle.sellingPrice)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-500">Biweekly</div>
                        <div className="font-semibold text-slate-900">{formatPayment(vehicle.biweeklyWithProtection)}</div>
                      </div>
                      <div className={`rounded-md px-2 py-1 text-center text-xs font-semibold ${selected ? 'bg-blue-700 text-white' : 'bg-slate-100 text-slate-600'}`}>
                        {selected ? 'Selected' : 'Pick'}
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </section>
        </div>

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold text-slate-950">Recent quote links</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {quotes.slice(0, 9).map((quote) => (
              <div key={quote.publicToken} className="rounded-lg border border-slate-200 p-4">
                <div className="font-semibold text-slate-950">{quote.customerName}</div>
                <div className="mt-1 text-sm text-slate-500">Phone ending {quote.customerPhoneLast4}</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" onClick={() => void copyText('quote link', quote.quoteUrl)} className="inline-flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                    <Copy className="h-4 w-4" />
                    Copy quote link
                  </button>
                  <a href={quote.quoteUrl} target="_blank" rel="noreferrer" className="inline-flex items-center rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800">Open</a>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  )
}

function Input({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-slate-800">{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100" />
    </label>
  )
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: string[] }) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-slate-800">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100">
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    </label>
  )
}
