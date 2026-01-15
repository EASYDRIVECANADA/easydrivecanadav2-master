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
    <div className="w-full">
      <div className="bg-white shadow">
        <div className="w-full px-4 sm:px-6 lg:px-8 py-4 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Inventory Purchase Summary</h1>
            <p className="text-sm text-gray-500">Mock data only (UI design)</p>
          </div>
          <div className="text-sm text-gray-600">Total: <span className="font-semibold">${total.toLocaleString()}</span></div>
        </div>
      </div>

      <div className="w-full px-4 sm:px-6 lg:px-8 py-6">
        <div className="bg-white rounded-xl shadow p-4">
          <div className="flex flex-col xl:flex-row xl:items-end gap-3">
            <div className="flex-1">
              <label className="block text-xs font-semibold text-gray-600 mb-1">Filter by Status</label>
              <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2">
                <option value="In Stock, Sold, Deal Pending In Trade, In Stock (No Deal)">In Stock, Sold, Deal Pending In Trade, In Stock (No Deal)</option>
                <option value="In Stock">In Stock</option>
                <option value="Sold">Sold</option>
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 xl:w-[520px]">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Start</label>
                <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">End</label>
                <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2" />
              </div>
              <div className="flex items-end justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setFrom('')
                    setTo('')
                  }}
                  className="h-10 px-4 rounded-lg bg-rose-600 text-white text-sm font-semibold hover:bg-rose-700"
                >
                  Clear
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 xl:justify-end">
              <button type="button" className="h-10 px-4 rounded-lg bg-[#118df0] text-white text-sm font-semibold hover:bg-[#0d6ebd]">Export</button>
              <button type="button" className="h-10 px-4 rounded-lg bg-white border border-gray-200 text-sm hover:bg-gray-50">Print</button>
            </div>
          </div>

          <div className="mt-3 relative">
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="search" className="w-full border border-gray-200 rounded-lg pl-10 pr-3 py-2" />
            <svg className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35m1.35-5.65a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow mt-4 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-max w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Vehicle</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Purchased From</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Auction</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Purchased Date</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Purchased Price</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Actual Cash Value</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Discount</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">HST - 13%</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Tax - Override</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">GST - 5%</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">QST - 9.975%</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Tax Exempt - 0%</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-[#118df0] whitespace-nowrap">{r.vehicle}</td>
                    <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">{r.purchasedFrom}</td>
                    <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">{r.auction}</td>
                    <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">{r.purchasedDate}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap text-right">${r.purchasedPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap text-right">${r.actualCashValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap text-right">${r.discount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap text-right">${r.hst13.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap text-right">${r.taxOverride.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap text-right">${r.gst5.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap text-right">${r.qst9975.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap text-right">${r.taxExempt0.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
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
