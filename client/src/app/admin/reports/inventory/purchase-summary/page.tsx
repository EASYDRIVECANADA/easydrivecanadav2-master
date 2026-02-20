'use client'

import { useMemo, useState } from 'react'

type Row = {
  id: string
  vehicle: string
  purchasedFrom: string
  auction: string
  purchasedDate: string
  purchasedPrice: number
  actualCashValue: number
  discount: number
  hst13: number
  taxOverride: number
  gst5: number
  qst9975: number
  taxExempt0: number
}

export default function PurchaseSummaryPage() {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('In Stock, Sold, Deal Pending In Trade, In Stock (No Deal)')
  const [from, setFrom] = useState('2026-01-01')
  const [to, setTo] = useState('2026-01-31')

  const rows = useMemo<Row[]>(
    () => [
      {
        id: 'ps_1',
        vehicle: 'Stock#1011 - 2010 Subaru Forester 2.5X Limited',
        purchasedFrom: 'Owais Ahmed',
        auction: 'N/A',
        purchasedDate: 'Jan 6, 2026',
        purchasedPrice: 3800,
        actualCashValue: 0,
        discount: 0,
        hst13: 0,
        taxOverride: 0,
        gst5: 0,
        qst9975: 0,
        taxExempt0: 0,
      },
      {
        id: 'ps_2',
        vehicle: 'Stock#1008 - 2017 Volkswagen Jetta 1.4 TSI Wolfsburg Edition - Manual',
        purchasedFrom: 'Adesa Ottawa',
        auction: 'Adesa Ottawa',
        purchasedDate: 'Jun 12, 2025',
        purchasedPrice: 2294.55,
        actualCashValue: 0,
        discount: 0,
        hst13: 0,
        taxOverride: 0,
        gst5: 0,
        qst9975: 0,
        taxExempt0: 0,
      },
      {
        id: 'ps_3',
        vehicle: 'Stock#1003 - 2017 Kia Sorento LX FWD',
        purchasedFrom: 'Adesa Ottawa',
        auction: 'Adesa Ottawa',
        purchasedDate: 'Apr 2, 2025',
        purchasedPrice: 6945.55,
        actualCashValue: 0,
        discount: 0,
        hst13: 0,
        taxOverride: 0,
        gst5: 0,
        qst9975: 0,
        taxExempt0: 0,
      },
    ],
    []
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return rows.filter((r) => {
      if (!q) return true
      return (
        r.vehicle.toLowerCase().includes(q) ||
        r.purchasedFrom.toLowerCase().includes(q) ||
        r.auction.toLowerCase().includes(q)
      )
    })
  }, [query, rows])

  const total = filtered.reduce((sum, r) => sum + r.purchasedPrice, 0)

  return (
    <div className="min-h-screen">
      <div className="edc-page-header">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Inventory Purchase Summary</h1>
            <p className="text-sm text-slate-500 mt-0.5">Mock data only (UI design)</p>
          </div>
          <div className="text-sm text-slate-500">Total: <span className="font-semibold text-slate-700">${total.toLocaleString()}</span></div>
        </div>
      </div>

      <div className="px-6 py-6">
        <div className="edc-card p-4">
          <div className="flex flex-col xl:flex-row xl:items-end gap-3">
            <div className="flex-1">
              <label className="block text-xs font-semibold text-slate-500 mb-1">Filter by Status</label>
              <select value={status} onChange={(e) => setStatus(e.target.value)} className="edc-input">
                <option value="In Stock, Sold, Deal Pending In Trade, In Stock (No Deal)">In Stock, Sold, Deal Pending In Trade, In Stock (No Deal)</option>
                <option value="In Stock">In Stock</option>
                <option value="Sold">Sold</option>
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 xl:w-[520px]">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Start</label>
                <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="edc-input" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">End</label>
                <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="edc-input" />
              </div>
              <div className="flex items-end justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setFrom('')
                    setTo('')
                  }}
                  className="edc-btn-danger text-sm"
                >
                  Clear
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 xl:justify-end">
              <button type="button" className="edc-btn-primary text-sm">Export</button>
              <button type="button" className="edc-btn-ghost text-sm">Print</button>
            </div>
          </div>

          <div className="mt-3 relative">
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="search" className="edc-input pl-10" />
            <svg className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35m1.35-5.65a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>

        <div className="edc-card mt-4 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="edc-table min-w-max">
              <thead>
                <tr>
                  <th>Vehicle</th>
                  <th>Purchased From</th>
                  <th>Auction</th>
                  <th>Purchased Date</th>
                  <th className="text-right">Purchased Price</th>
                  <th className="text-right">Actual Cash Value</th>
                  <th className="text-right">Discount</th>
                  <th className="text-right">HST - 13%</th>
                  <th className="text-right">Tax - Override</th>
                  <th className="text-right">GST - 5%</th>
                  <th className="text-right">QST - 9.975%</th>
                  <th className="text-right">Tax Exempt - 0%</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id}>
                    <td className="px-4 py-3 text-sm font-medium text-slate-800 whitespace-nowrap">{r.vehicle}</td>
                    <td className="px-4 py-3 text-sm text-slate-600 whitespace-nowrap">{r.purchasedFrom}</td>
                    <td className="px-4 py-3 text-sm text-slate-600 whitespace-nowrap">{r.auction}</td>
                    <td className="px-4 py-3 text-sm text-slate-600 whitespace-nowrap">{r.purchasedDate}</td>
                    <td className="px-4 py-3 text-sm text-slate-800 whitespace-nowrap text-right">${r.purchasedPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="px-4 py-3 text-sm text-slate-800 whitespace-nowrap text-right">${r.actualCashValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="px-4 py-3 text-sm text-slate-800 whitespace-nowrap text-right">${r.discount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="px-4 py-3 text-sm text-slate-800 whitespace-nowrap text-right">${r.hst13.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="px-4 py-3 text-sm text-slate-800 whitespace-nowrap text-right">${r.taxOverride.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="px-4 py-3 text-sm text-slate-800 whitespace-nowrap text-right">${r.gst5.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="px-4 py-3 text-sm text-slate-800 whitespace-nowrap text-right">${r.qst9975.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="px-4 py-3 text-sm text-slate-800 whitespace-nowrap text-right">${r.taxExempt0.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
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
