'use client'

import { useMemo, useState } from 'react'

type Row = {
  id: string
  year: string
  model: string
  colour: string
  bodyStyle: string
  keyNumber: number
  cyl: number
  odometer: string
  price: number
  stockNumber: string
  type: string
  cert: string
  status: string
  date: string
}

export default function KeylistPage() {
  const [typeFilter, setTypeFilter] = useState('4 selected')
  const [statusFilter, setStatusFilter] = useState('4 selected')
  const [certFilter, setCertFilter] = useState('2 selected')
  const [from, setFrom] = useState('2026-01-01')
  const [to, setTo] = useState('2026-01-31')
  const [query, setQuery] = useState('')

  const rows = useMemo<Row[]>(
    () => [
      {
        id: 'k_1',
        year: '2010',
        model: 'Forester',
        colour: 'Red',
        bodyStyle: 'Body Style',
        keyNumber: 6,
        cyl: 4,
        odometer: '229,192 kms',
        price: 1800,
        stockNumber: '1011',
        type: 'N/A',
        cert: 'As-Is',
        status: 'Sold',
        date: 'Jan 3, 2026',
      },
      {
        id: 'k_2',
        year: '2018',
        model: 'Model 3',
        colour: 'White',
        bodyStyle: 'Sedan',
        keyNumber: 6,
        cyl: 0,
        odometer: '205,128 kms',
        price: 18950,
        stockNumber: '1010',
        type: 'Car',
        cert: 'Certified',
        status: 'In Stock',
        date: 'Jan 4, 2026',
      },
      {
        id: 'k_3',
        year: '2017',
        model: 'Jetta',
        colour: 'Blue',
        bodyStyle: 'Sedan',
        keyNumber: 4,
        cyl: 4,
        odometer: '177,741 kms',
        price: 14995,
        stockNumber: '1008',
        type: 'Car',
        cert: 'Certified',
        status: 'Deal Pending',
        date: 'Dec 10, 2025',
      },
    ],
    []
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return rows.filter((r) => {
      if (!q) return true
      const haystack = `${r.year} ${r.model} ${r.stockNumber} ${r.status} ${r.cert}`.toLowerCase()
      return haystack.includes(q)
    })
  }, [query, rows])

  return (
    <div className="w-full">
      <div className="bg-white shadow">
        <div className="w-full px-4 sm:px-6 lg:px-8 py-4 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Keylist</h1>
            <p className="text-sm text-gray-500">Mock data only (UI design)</p>
          </div>
          <button type="button" className="h-10 px-4 rounded-lg bg-[#118df0] text-white text-sm font-semibold hover:bg-[#0d6ebd]">Export</button>
        </div>
      </div>

      <div className="w-full px-4 sm:px-6 lg:px-8 py-6">
        <div className="bg-white rounded-xl shadow p-4">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
            <div className="lg:col-span-3">
              <label className="block text-xs font-semibold text-gray-600 mb-1">Type</label>
              <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2">
                <option value="4 selected">4 selected</option>
                <option value="Car">Car</option>
                <option value="SUV">SUV</option>
                <option value="Truck">Truck</option>
              </select>
            </div>
            <div className="lg:col-span-3">
              <label className="block text-xs font-semibold text-gray-600 mb-1">Status</label>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2">
                <option value="4 selected">4 selected</option>
                <option value="In Stock">In Stock</option>
                <option value="Sold">Sold</option>
                <option value="Deal Pending">Deal Pending</option>
              </select>
            </div>
            <div className="lg:col-span-3">
              <label className="block text-xs font-semibold text-gray-600 mb-1">Certification</label>
              <select value={certFilter} onChange={(e) => setCertFilter(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2">
                <option value="2 selected">2 selected</option>
                <option value="Certified">Certified</option>
                <option value="As-Is">As-Is</option>
              </select>
            </div>
            <div className="lg:col-span-3 grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">From</label>
                <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">To</label>
                <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2" />
              </div>
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
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">YEAR</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">MODEL</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">COLOUR</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">BODY STYLE</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">KEY #</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">CYL.</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">ODOMETER</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">PRICE</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">STOCK #</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">TYPE</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">CERT.</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">STATUS</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">DATE</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">{r.year}</td>
                    <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">{r.model}</td>
                    <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">{r.colour}</td>
                    <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">{r.bodyStyle}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap text-right">{r.keyNumber}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap text-right">{r.cyl}</td>
                    <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">{r.odometer}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap text-right">${r.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">{r.stockNumber}</td>
                    <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">{r.type}</td>
                    <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">{r.cert}</td>
                    <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">{r.status}</td>
                    <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">{r.date}</td>
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
