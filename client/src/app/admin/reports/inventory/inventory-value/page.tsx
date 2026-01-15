'use client'

import { useMemo, useState } from 'react'

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

  const rows = useMemo<Row[]>(
    () => [
      {
        id: 'iv_1',
        stock: '1010',
        year: '2018',
        make: 'Tesla',
        model: 'Model 3',
        trim: 'LONG RANGE AWD',
        vin: '5YJ3E1EBXJF080845',
        dealId: '01/04/2026',
        inStockDate: '01/04/2026',
        closeDate: 'N/A',
        currentStatus: 'In Stock',
        vehiclePurchasePrice: 25067.6,
        actualCashValue: 0,
        costs: 0,
        defaultTaxRate: '0%',
        qst9975: 0,
        gst5: 0,
        hst13: 0,
        tax: 0,
        totalTax: 0,
        totalInvested: 25067.6,
        dii: '',
        listPrice: 0,
      },
      {
        id: 'iv_2',
        stock: '1008',
        year: '2017',
        make: 'Volkswagen',
        model: 'Jetta',
        trim: '1.4 TSI WOLFSBURG EDITION - MANUAL',
        vin: '3VWB67AJ8HM378317',
        dealId: '402476',
        inStockDate: '12/10/2025',
        closeDate: 'N/A',
        currentStatus: 'Deal Pending',
        vehiclePurchasePrice: 2294.55,
        actualCashValue: 0,
        costs: 733.23,
        defaultTaxRate: '0%',
        qst9975: 0,
        gst5: 0,
        hst13: 0,
        tax: 0,
        totalTax: 0,
        totalInvested: 3027.78,
        dii: '',
        listPrice: 9995,
      },
      {
        id: 'iv_3',
        stock: '1011',
        year: '2010',
        make: 'Subaru',
        model: 'Forester',
        trim: '2.5X Limited',
        vin: 'JF2SHCDC3AH774666',
        dealId: '401233',
        inStockDate: '01/05/2026',
        closeDate: '01/06/2026',
        currentStatus: 'Sold',
        vehiclePurchasePrice: 3800,
        actualCashValue: 0,
        costs: 0,
        defaultTaxRate: '0%',
        qst9975: 0,
        gst5: 0,
        hst13: 0,
        tax: 0,
        totalTax: 0,
        totalInvested: 3800,
        dii: '',
        listPrice: 6995,
      },
    ],
    []
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return rows.filter((r) => {
      if (!q) return true
      const haystack = `${r.stock} ${r.year} ${r.make} ${r.model} ${r.trim} ${r.vin} ${r.currentStatus} ${r.dealId}`.toLowerCase()
      return haystack.includes(q)
    })
  }, [query, rows])

  return (
    <div className="w-full">
      <div className="bg-white shadow">
        <div className="w-full px-4 sm:px-6 lg:px-8 py-4 flex items-start justify-between gap-4">
          <div className="max-w-4xl">
            <h1 className="text-2xl font-bold text-gray-900">Inventory Value Report</h1>
            <p className="text-sm text-gray-500 mt-1">
              This report provides important information to help you determine your vehicle inventory on-hand at a specific point in time.
              You should export and save this report monthly so that you have accurate records to look back on. If you are using this report
              to look back on an earlier point in time your inventory status will still display. You can reference the "current status" column
              in the report, plus the "close date" to determine which vehicles were actually in stock at your year-end.
            </p>
          </div>
          <div>
            <button type="button" className="h-10 px-4 rounded-lg bg-[#118df0] text-white text-sm font-semibold hover:bg-[#0d6ebd]">
              Export
            </button>
          </div>
        </div>
      </div>

      <div className="w-full px-4 sm:px-6 lg:px-8 py-6">
        <div className="bg-white rounded-xl shadow p-4">
          <div className="flex flex-col xl:flex-row xl:items-center gap-3">
            <div className="flex-1">
              <div className="relative">
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search" className="w-full border border-gray-200 rounded-lg pl-10 pr-3 py-2" />
                <svg className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35m1.35-5.65a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>

            <div className="xl:w-[320px]">
              <label className="block text-xs font-semibold text-gray-600 mb-1">Filter by Status</label>
              <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2">
                <option value="In Stock, Sold, Deal Pending In Trade, In Stock (No Deal)">In Stock, Sold, Deal Pending In Trade, In Stock (No Deal)</option>
                <option value="In Stock">In Stock</option>
                <option value="Sold">Sold</option>
                <option value="Deal Pending">Deal Pending</option>
              </select>
            </div>

            <div className="xl:w-[220px]">
              <label className="block text-xs font-semibold text-gray-600 mb-1">Inventory value on</label>
              <input type="date" value={valueOn} onChange={(e) => setValueOn(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2" />
            </div>

            <div className="flex items-end gap-2">
              <button type="button" className="h-10 px-4 rounded-lg bg-[#118df0] text-white text-sm font-semibold hover:bg-[#0d6ebd]">Filter</button>
              <button type="button" className="h-10 px-4 rounded-lg bg-rose-600 text-white text-sm font-semibold hover:bg-rose-700">Clear</button>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow mt-4 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-max w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Stock #</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Year</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Make</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Model</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Trim</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Vin</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Deal ID</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">In Stock Date</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Close Date</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Current Status</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Vehicle Purchase price</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Actual Cash Value</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Costs</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Default Tax Rate - 0%</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">QST - 9.975%</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">GST - 5%</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">HST - 13%</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Tax</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Total Tax</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Total Invested</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">DII</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">List Price</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-[#118df0] whitespace-nowrap">{r.stock}</td>
                    <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">{r.year}</td>
                    <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">{r.make}</td>
                    <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">{r.model}</td>
                    <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">{r.trim}</td>
                    <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">{r.vin}</td>
                    <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">{r.dealId}</td>
                    <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">{r.inStockDate}</td>
                    <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">{r.closeDate}</td>
                    <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">{r.currentStatus}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap text-right">${r.vehiclePurchasePrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap text-right">${r.actualCashValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap text-right">${r.costs.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap text-right">{r.defaultTaxRate}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap text-right">${r.qst9975.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap text-right">${r.gst5.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap text-right">${r.hst13.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap text-right">${r.tax.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap text-right">${r.totalTax.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap text-right">${r.totalInvested.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">{r.dii}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap text-right">${r.listPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-6 py-3 text-xs text-gray-500 border-t border-gray-100">Value Date: {valueOn} (mock)</div>
        </div>
      </div>
    </div>
  )
}
