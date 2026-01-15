'use client'

import { Fragment, useMemo, useState } from 'react'

type AdjustorRow = {
  id: string
  name: string
  vehicle: string
  type: 'Cash' | 'Finance' | 'Lease'
  dealDate: string
  closeDate: string
  salesperson: string
  bankCommission: number
  status: 'Open' | 'Closed'
}
//DFSAFSA
export default function DealAdjustorPage() {
  const [from, setFrom] = useState('2026-01-01')
  const [to, setTo] = useState('2026-01-31')
  const [query, setQuery] = useState('')
  const [perPage, setPerPage] = useState('10')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const rows = useMemo<AdjustorRow[]>(
    () => [
      {
        id: 'adj_1',
        name: 'Ben Lefebvre',
        vehicle: 'Stock#1008 - 2017 Volkswagen Jetta 1.4 TSI Wolfsburg Edition - Manual',
        type: 'Cash',
        dealDate: 'Jan 14, 2026',
        closeDate: 'N/A',
        salesperson: 'Syed Islam',
        bankCommission: 0,
        status: 'Open',
      },
      {
        id: 'adj_2',
        name: 'Esmeil Ali Ahmed',
        vehicle: 'Stock#1003 - 2017 Kia Sorento LX FWD',
        type: 'Cash',
        dealDate: 'Jan 10, 2026',
        closeDate: 'N/A',
        salesperson: 'Syed Islam',
        bankCommission: 0,
        status: 'Open',
      },
      {
        id: 'adj_3',
        name: 'Sarif Bhuiyan',
        vehicle: 'Stock#1011 - 2010 Subaru Forester 2.5X Limited',
        type: 'Finance',
        dealDate: 'Jan 6, 2026',
        closeDate: 'Jan 8, 2026',
        salesperson: 'Syed Islam',
        bankCommission: 0,
        status: 'Closed',
      },
    ],
    []
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return rows.filter((r) => {
      if (!q) return true
      return (
        r.name.toLowerCase().includes(q) ||
        r.vehicle.toLowerCase().includes(q) ||
        r.salesperson.toLowerCase().includes(q) ||
        r.status.toLowerCase().includes(q)
      )
    })
  }, [query, rows])

  const totalDeals = filtered.length
  const totalCommission = filtered.reduce((sum, r) => sum + (Number.isFinite(r.bankCommission) ? r.bankCommission : 0), 0)

  return (
    <div className="w-full">
      <div className="bg-white shadow">
        <div className="w-full px-4 sm:px-6 lg:px-8 py-4 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Deal Adjustor</h1>
            <p className="text-sm text-gray-500">Mock data only (UI design)</p>
          </div>
          <div className="text-sm text-gray-600">
            Total Deals: <span className="font-semibold">{totalDeals}</span>
          </div>
        </div>
      </div>

      <div className="w-full px-4 sm:px-6 lg:px-8 py-6">
        <div className="bg-white rounded-xl shadow p-4">
          <div className="flex flex-col xl:flex-row xl:items-end gap-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 flex-1">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">From</label>
                <input
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">To</label>
                <input
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Search</label>
                <div className="relative">
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search..."
                    className="w-full border border-gray-200 rounded-lg pl-10 pr-3 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent"
                  />
                  <svg
                    className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35m1.35-5.65a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3">
              <div className="text-sm text-gray-600 whitespace-nowrap">Bank Commission: <span className="font-semibold">${totalCommission.toFixed(2)}</span></div>
              <select
                value={perPage}
                onChange={(e) => setPerPage(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2"
              >
                <option value="10">10</option>
                <option value="25">25</option>
                <option value="50">50</option>
              </select>
            </div>
          </div>

          <div className="mt-3 text-xs text-gray-500">Showing results from {from} to {to} (mock UI only)</div>
        </div>

        <div className="bg-white rounded-xl shadow mt-4 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-12"></th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Vehicle</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Deal Date</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Close Date</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Salesperson</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Bank Commission</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((r) => (
                  <Fragment key={r.id}>
                    <tr className="hover:bg-gray-50">
                      <td className="px-3 py-3">
                        <button
                          type="button"
                          onClick={() => setExpandedId((prev) => (prev === r.id ? null : r.id))}
                          className="w-9 h-9 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
                          title="Fees"
                          aria-label="Fees"
                        >
                          <svg className="w-5 h-5 text-[#118df0]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M3 7a2 2 0 012-2h6l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"
                            />
                          </svg>
                        </button>
                      </td>
                      <td className="px-6 py-3 text-sm text-gray-900 whitespace-nowrap">{r.name}</td>
                      <td className="px-6 py-3 text-sm text-[#118df0] min-w-[420px]">{r.vehicle}</td>
                      <td className="px-6 py-3 text-sm text-gray-700 whitespace-nowrap">{r.type}</td>
                      <td className="px-6 py-3 text-sm text-gray-700 whitespace-nowrap">{r.dealDate}</td>
                      <td className="px-6 py-3 text-sm text-gray-700 whitespace-nowrap">{r.closeDate}</td>
                      <td className="px-6 py-3 text-sm text-gray-700 whitespace-nowrap">{r.salesperson}</td>
                      <td className="px-6 py-3 text-sm text-gray-900 whitespace-nowrap text-right">${r.bankCommission.toFixed(2)}</td>
                      <td className="px-6 py-3 text-sm whitespace-nowrap text-right">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                            r.status === 'Open' ? 'bg-blue-100 text-blue-700' : 'bg-slate-200 text-slate-700'
                          }`}
                        >
                          {r.status}
                        </span>
                      </td>
                    </tr>

                    {expandedId === r.id ? (
                      <tr className="bg-white">
                        <td colSpan={9} className="px-6 py-4">
                          <div className="border border-gray-200 rounded-lg overflow-hidden">
                            <div className="grid grid-cols-12 bg-gray-50 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                              <div className="col-span-3 px-4 py-2">Name</div>
                              <div className="col-span-5 px-4 py-2">Description</div>
                              <div className="col-span-2 px-4 py-2 text-right">Cost</div>
                              <div className="col-span-2 px-4 py-2 text-right">Price</div>
                            </div>
                            <div className="grid grid-cols-12 text-sm">
                              <div className="col-span-3 px-4 py-3">OMVIC FEE</div>
                              <div className="col-span-5 px-4 py-3 text-gray-600">&nbsp;</div>
                              <div className="col-span-2 px-4 py-3 text-right text-[#118df0]">$22.00</div>
                              <div className="col-span-2 px-4 py-3 text-right text-[#118df0]">$22.00</div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                ))}

                {filtered.length === 0 ? (
                  <tr>
                    <td className="px-6 py-10 text-center text-sm text-gray-500" colSpan={9}>
                      No results.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
