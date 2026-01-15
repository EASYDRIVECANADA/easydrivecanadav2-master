'use client'

import { useMemo, useState } from 'react'

type Row = {
  id: string
  date: string
  name: string
  description: string
  vehicle: string
  invoice: string
  vendor: string
  subtotal: number
  hst13: number
  exempt0: number
  total: number
}

export default function InventoryCostsPage() {
  const [status, setStatus] = useState('In Stock, Sold, Deal Pending In Trade, In Stock (No Deal)')
  const [query, setQuery] = useState('')
  const [perPage, setPerPage] = useState('50')

  const rows = useMemo<Row[]>(
    () => [
      {
        id: 'ic_1',
        date: 'Jan 14, 2026',
        name: 'Windshield',
        description: '-',
        vehicle: 'Stock # 1000 2011 Toyota Sienna : 5TDZK3DC2BS153048',
        invoice: '1000',
        vendor: "ANDY'S AUTO GLASS",
        subtotal: 320,
        hst13: 41.6,
        exempt0: 0,
        total: 361.6,
      },
      {
        id: 'ic_2',
        date: 'Jan 14, 2026',
        name: 'Tires',
        description: 'Used Winter Tires',
        vehicle: 'Stock # 1000 2011 Toyota Sienna : 5TDZK3DC2BS153048',
        invoice: '1000',
        vendor: 'Tire Truck',
        subtotal: 280,
        hst13: 36.4,
        exempt0: 0,
        total: 316.4,
      },
      {
        id: 'ic_3',
        date: 'Dec 10, 2025',
        name: 'Mechanical Parts',
        description: '-',
        vehicle: 'Stock # 1007 2016 Nissan Pathfinder : 5N1AR2MM4GC606768',
        invoice: '01005',
        vendor: "Mark's Parts",
        subtotal: 475,
        hst13: 61.75,
        exempt0: 0,
        total: 536.75,
      },
    ],
    []
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return rows.filter((r) => {
      if (!q) return true
      const haystack = `${r.date} ${r.name} ${r.description} ${r.vehicle} ${r.invoice} ${r.vendor}`.toLowerCase()
      return haystack.includes(q)
    })
  }, [query, rows])

  const grand = filtered.reduce((sum, r) => sum + r.total, 0)

  return (
    <div className="w-full">
      <div className="bg-white shadow">
        <div className="w-full px-4 sm:px-6 lg:px-8 py-4 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Inventory Costs</h1>
            <p className="text-sm text-gray-500">Mock data only (UI design)</p>
          </div>
          <div className="text-sm text-gray-600">Grand Total: <span className="font-semibold">${grand.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
        </div>
      </div>

      <div className="w-full px-4 sm:px-6 lg:px-8 py-6">
        <div className="bg-white rounded-xl shadow p-4">
          <div className="flex flex-col xl:flex-row xl:items-center gap-3">
            <div className="flex-1">
              <label className="block text-xs font-semibold text-gray-600 mb-1">Filter by Status</label>
              <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2">
                <option value="In Stock, Sold, Deal Pending In Trade, In Stock (No Deal)">In Stock, Sold, Deal Pending In Trade, In Stock (No Deal)</option>
                <option value="In Stock">In Stock</option>
                <option value="Sold">Sold</option>
              </select>
            </div>

            <div className="xl:w-[420px] relative">
              <label className="block text-xs font-semibold text-gray-600 mb-1">&nbsp;</label>
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="search" className="w-full border border-gray-200 rounded-lg pl-10 pr-3 py-2" />
              <svg className="w-4 h-4 text-gray-400 absolute left-3 top-[42px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35m1.35-5.65a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>

            <button type="button" className="h-10 px-4 rounded-lg bg-white border border-gray-200 text-sm hover:bg-gray-50 xl:mt-6">Advanced</button>

            <div className="xl:w-[120px] xl:ml-auto">
              <label className="block text-xs font-semibold text-gray-600 mb-1">&nbsp;</label>
              <select value={perPage} onChange={(e) => setPerPage(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2">
                <option value="50">50</option>
                <option value="100">100</option>
                <option value="150">150</option>
                <option value="500">500</option>
              </select>
            </div>

            <div className="flex items-center gap-2 xl:mt-6">
              <button type="button" className="h-10 w-10 rounded-lg bg-white border border-gray-200 hover:bg-gray-50" title="Export">
                <svg className="w-5 h-5 mx-auto text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v10m0 0l-3-3m3 3l3-3M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2" />
                </svg>
              </button>
              <button type="button" className="h-10 w-10 rounded-lg bg-white border border-gray-200 hover:bg-gray-50" title="Print">
                <svg className="w-5 h-5 mx-auto text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2M6 14h12v8H6v-8z" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow mt-4 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-max w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Description</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Vehicle</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Invoice</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Vendor</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Subtotal</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">HST 13%</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Exempt 0%</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">{r.date}</td>
                    <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">{r.name}</td>
                    <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">{r.description}</td>
                    <td className="px-4 py-3 text-sm text-gray-700 min-w-[420px]">{r.vehicle}</td>
                    <td className="px-4 py-3 text-sm text-[#118df0] whitespace-nowrap">{r.invoice}</td>
                    <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">{r.vendor}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap text-right">${r.subtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap text-right">${r.hst13.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap text-right">${r.exempt0.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap text-right">${r.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
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
