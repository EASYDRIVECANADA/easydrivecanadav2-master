'use client'

import { useEffect, useMemo, useState } from 'react'

type Row = {
  id: string
  purchasedFromName: string
  purchasedFromAddress: string
  plateNo: string
  odometerReading: string
  make: string
  model: string
  stockNumber: string
  serialNo: string
  colour: string
  dateInStock: string
  inConsignment: string
  dateOut: string
  soldToName: string
  soldToAddress: string
}

export default function GarageRegisterPage() {
  const [status, setStatus] = useState('In Stock, Sold, Deal Pending In Trade, In Stock (No Deal)')
  const [filterType, setFilterType] = useState('Purchased Between')
  const [perPage, setPerPage] = useState('150')
  const [query, setQuery] = useState('')

  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true)
        setError(null)

        const qs = new URLSearchParams()
        if (status) qs.set('status', status)
        if (filterType) qs.set('filterType', filterType)
        if (perPage) qs.set('perPage', perPage)

        const res = await fetch(`/api/reports/inventory/garage-register?${qs.toString()}`, {
          cache: 'no-store',
        })
        const json = await res.json().catch(() => null)
        if (!res.ok || !json?.ok) {
          throw new Error(String(json?.error || `Failed to load garage register (${res.status})`))
        }

        const r = Array.isArray(json?.rows) ? (json.rows as Row[]) : []
        setRows(r)
      } catch (e: any) {
        setError(e?.message || 'Failed to load garage register')
        setRows([])
      } finally {
        setLoading(false)
      }
    }

    void run()
  }, [filterType, perPage, status])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return rows.filter((r) => {
      if (!q) return true
      const haystack = `${r.purchasedFromName} ${r.purchasedFromAddress} ${r.plateNo} ${r.odometerReading} ${r.make} ${r.model} ${r.stockNumber} ${r.serialNo} ${r.soldToName}`.toLowerCase()
      return haystack.includes(q)
    })
  }, [query, rows])

  return (
    <div className="min-h-screen">
      <div className="edc-page-header">
        <h1 className="text-2xl font-bold text-slate-900">Garage Register</h1>
        <p className="text-sm text-slate-500 mt-0.5">Garage register entries</p>
      </div>

      <div className="px-6 py-6">
        <div className="edc-card p-4">
          <div className="flex flex-col xl:flex-row xl:items-center gap-3">
            <div className="flex-1">
              <label className="block text-xs font-semibold text-slate-500 mb-1">Filter by Status</label>
              <select value={status} onChange={(e) => setStatus(e.target.value)} className="edc-input">
                <option value="In Stock, Sold, Deal Pending In Trade, In Stock (No Deal)">In Stock, Sold, Deal Pending In Trade, In Stock (No Deal)</option>
                <option value="In Stock">In Stock</option>
                <option value="Sold">Sold</option>
              </select>
            </div>

            <div className="xl:w-[420px]">
              <label className="block text-xs font-semibold text-slate-500 mb-1">Filter Type</label>
              <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="edc-input">
                <option value="Purchased Between">Purchased Between</option>
                <option value="Sold Between">Sold Between</option>
              </select>
            </div>

            <div className="flex items-center gap-2 xl:justify-end">
              <button type="button" className="edc-btn-primary text-sm">Export</button>
              <button type="button" className="edc-btn-ghost text-sm">Print</button>
            </div>

            <div className="xl:w-[120px] xl:ml-auto">
              <label className="block text-xs font-semibold text-slate-500 mb-1">&nbsp;</label>
              <select value={perPage} onChange={(e) => setPerPage(e.target.value)} className="edc-input">
                <option value="50">50</option>
                <option value="100">100</option>
                <option value="150">150</option>
                <option value="500">500</option>
              </select>
            </div>
          </div>

          <div className="mt-3 flex flex-col lg:flex-row lg:items-center gap-3">
            <div className="flex-1 relative">
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="search" className="edc-input pl-10" />
              <svg className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35m1.35-5.65a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <button type="button" className="edc-btn-ghost text-sm">Advanced</button>
          </div>

          <div className="mt-2 text-xs text-slate-500">Total Entries: <span className="font-semibold text-slate-700">{filtered.length}</span></div>
        </div>

        <div className="edc-card mt-4 overflow-hidden">
          {error ? (
            <div className="p-4">
              <div className="text-sm text-danger-600">{error}</div>
            </div>
          ) : null}

          {loading ? (
            <div className="p-4">
              <div className="text-sm text-slate-500">Loading...</div>
            </div>
          ) : null}

          <div className="overflow-x-auto">
            <table className="edc-table min-w-max">
              <thead>
                <tr>
                  <th colSpan={2} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider border-r border-slate-100">Purchased From - Registered Owner</th>
                  <th colSpan={9} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider border-r border-slate-100">Used Motor Vehicle</th>
                  <th colSpan={3} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Sold to - Name of new Owner</th>
                </tr>
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Name</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider border-r border-slate-100">Address</th>

                  <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Plate No.</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Odometer Reading</th>

                  <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Make</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Model</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Stock #</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Serial No.</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Colour</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Date into Stock</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider border-r border-slate-100">In for a re-sale wrecking or consignment</th>

                  <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Date out</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Name</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Address</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id}>
                    <td className="px-4 py-3 text-sm text-slate-600 whitespace-nowrap">{r.purchasedFromName}</td>
                    <td className="px-4 py-3 text-sm text-slate-600 min-w-[280px] border-r border-slate-100">{r.purchasedFromAddress}</td>

                    <td className="px-4 py-3 text-sm text-slate-600 whitespace-nowrap">{r.plateNo}</td>
                    <td className="px-4 py-3 text-sm text-slate-600 whitespace-nowrap">{r.odometerReading}</td>

                    <td className="px-4 py-3 text-sm text-slate-600 whitespace-nowrap">{r.make}</td>
                    <td className="px-4 py-3 text-sm text-slate-600 whitespace-nowrap">{r.model}</td>
                    <td className="px-4 py-3 text-sm text-slate-600 whitespace-nowrap">{r.stockNumber}</td>
                    <td className="px-4 py-3 text-sm text-slate-600 whitespace-nowrap">{r.serialNo}</td>
                    <td className="px-4 py-3 text-sm text-slate-600 whitespace-nowrap">{r.colour}</td>
                    <td className="px-4 py-3 text-sm text-slate-600 whitespace-nowrap">{r.dateInStock}</td>
                    <td className="px-4 py-3 text-sm text-slate-600 min-w-[260px] border-r border-slate-100">{r.inConsignment}</td>

                    <td className="px-4 py-3 text-sm text-slate-600 whitespace-nowrap">{r.dateOut}</td>
                    <td className="px-4 py-3 text-sm text-slate-600 whitespace-nowrap">{r.soldToName}</td>
                    <td className="px-4 py-3 text-sm text-slate-600 min-w-[280px]">{r.soldToAddress}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
