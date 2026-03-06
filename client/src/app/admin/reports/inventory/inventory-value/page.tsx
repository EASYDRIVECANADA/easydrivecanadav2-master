'use client'

import { useEffect, useMemo, useState } from 'react'

type Row = {
  id: string
  stock: string
  year: string
  make: string
  model: string
  trim: string
  vin: string
  dealId: string
  inStockDate: string
  closeDate: string
  currentStatus: string
  vehiclePurchasePrice: number
  actualCashValue: number
  costs: number
  defaultTaxRate: string
  qst9975: number
  gst5: number
  hst13: number
  tax: number
  totalTax: number
  totalInvested: number
  dii: string
  listPrice: number
}

export default function InventoryValuePage() {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('In Stock, Sold, Deal Pending In Trade, In Stock (No Deal)')
  const [valueOn, setValueOn] = useState('2026-01-15')

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
        if (valueOn) qs.set('valueOn', valueOn)

        const res = await fetch(`/api/reports/inventory/inventory-value?${qs.toString()}`, {
          cache: 'no-store',
        })
        const json = await res.json().catch(() => null)
        if (!res.ok || !json?.ok) {
          throw new Error(String(json?.error || `Failed to load inventory value (${res.status})`))
        }

        const r = Array.isArray(json?.rows) ? (json.rows as Row[]) : []
        setRows(r)
      } catch (e: any) {
        setError(e?.message || 'Failed to load inventory value')
        setRows([])
      } finally {
        setLoading(false)
      }
    }

    void run()
  }, [status, valueOn])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return rows.filter((r) => {
      if (!q) return true
      const haystack = `${r.stock} ${r.year} ${r.make} ${r.model} ${r.trim} ${r.vin} ${r.currentStatus} ${r.dealId}`.toLowerCase()
      return haystack.includes(q)
    })
  }, [query, rows])

  return (
    <div className="min-h-screen">
      <div className="edc-page-header">
        <div className="flex items-start justify-between gap-4">
          <div className="max-w-4xl">
            <h1 className="text-2xl font-bold text-slate-900">Inventory Value Report</h1>
            <p className="text-sm text-slate-500 mt-1">
              This report provides important information to help you determine your vehicle inventory on-hand at a specific point in time.
              You should export and save this report monthly so that you have accurate records to look back on. If you are using this report
              to look back on an earlier point in time your inventory status will still display. You can reference the "current status" column
              in the report, plus the "close date" to determine which vehicles were actually in stock at your year-end.
            </p>
          </div>
          <div>
            <button type="button" className="edc-btn-primary text-sm">
              Export
            </button>
          </div>
        </div>
      </div>

      <div className="px-6 py-6">
        <div className="edc-card p-4">
          <div className="flex flex-col xl:flex-row xl:items-center gap-3">
            <div className="flex-1">
              <div className="relative">
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search" className="edc-input pl-10" />
                <svg className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35m1.35-5.65a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>

            <div className="xl:w-[320px]">
              <label className="block text-xs font-semibold text-slate-500 mb-1">Filter by Status</label>
              <select value={status} onChange={(e) => setStatus(e.target.value)} className="edc-input">
                <option value="In Stock, Sold, Deal Pending In Trade, In Stock (No Deal)">In Stock, Sold, Deal Pending In Trade, In Stock (No Deal)</option>
                <option value="In Stock">In Stock</option>
                <option value="Sold">Sold</option>
                <option value="Deal Pending">Deal Pending</option>
              </select>
            </div>

            <div className="xl:w-[220px]">
              <label className="block text-xs font-semibold text-slate-500 mb-1">Inventory value on</label>
              <input type="date" value={valueOn} onChange={(e) => setValueOn(e.target.value)} className="edc-input" />
            </div>

            <div className="flex items-end gap-2">
              <button type="button" className="edc-btn-primary text-sm">Filter</button>
              <button type="button" className="edc-btn-danger text-sm">Clear</button>
            </div>
          </div>
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
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Stock #</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Year</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Make</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Model</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Trim</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Vin</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Deal ID</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">In Stock Date</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Close Date</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Current Status</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Vehicle Purchase price</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Actual Cash Value</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Costs</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Default Tax Rate - 0%</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">QST - 9.975%</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">GST - 5%</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">HST - 13%</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Tax</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Tax</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Invested</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">DII</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">List Price</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id}>
                    <td className="px-4 py-3 text-sm font-medium text-slate-800 whitespace-nowrap">{r.stock}</td>
                    <td className="px-4 py-3 text-sm text-slate-600 whitespace-nowrap">{r.year}</td>
                    <td className="px-4 py-3 text-sm text-slate-600 whitespace-nowrap">{r.make}</td>
                    <td className="px-4 py-3 text-sm text-slate-600 whitespace-nowrap">{r.model}</td>
                    <td className="px-4 py-3 text-sm text-slate-600 whitespace-nowrap">{r.trim}</td>
                    <td className="px-4 py-3 text-sm text-slate-600 whitespace-nowrap">{r.vin}</td>
                    <td className="px-4 py-3 text-sm text-slate-600 whitespace-nowrap">{r.dealId}</td>
                    <td className="px-4 py-3 text-sm text-slate-600 whitespace-nowrap">{r.inStockDate}</td>
                    <td className="px-4 py-3 text-sm text-slate-600 whitespace-nowrap">{r.closeDate}</td>
                    <td className="px-4 py-3 text-sm text-slate-600 whitespace-nowrap">{r.currentStatus}</td>
                    <td className="px-4 py-3 text-sm text-slate-800 whitespace-nowrap text-right">${r.vehiclePurchasePrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="px-4 py-3 text-sm text-slate-800 whitespace-nowrap text-right">${r.actualCashValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="px-4 py-3 text-sm text-slate-800 whitespace-nowrap text-right">${r.costs.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="px-4 py-3 text-sm text-slate-600 whitespace-nowrap text-right">{r.defaultTaxRate}</td>
                    <td className="px-4 py-3 text-sm text-slate-800 whitespace-nowrap text-right">${r.qst9975.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="px-4 py-3 text-sm text-slate-800 whitespace-nowrap text-right">${r.gst5.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="px-4 py-3 text-sm text-slate-800 whitespace-nowrap text-right">${r.hst13.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="px-4 py-3 text-sm text-slate-800 whitespace-nowrap text-right">${r.tax.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="px-4 py-3 text-sm text-slate-800 whitespace-nowrap text-right">${r.totalTax.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="px-4 py-3 text-sm text-slate-800 whitespace-nowrap text-right">${r.totalInvested.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="px-4 py-3 text-sm text-slate-600 whitespace-nowrap">{r.dii}</td>
                    <td className="px-4 py-3 text-sm text-slate-800 whitespace-nowrap text-right">${r.listPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-6 py-3 text-xs text-slate-500 border-t border-slate-100">Value Date: {valueOn}</div>
        </div>
      </div>
    </div>
  )
}
