'use client'

import { useMemo, useState } from 'react'

type DealRow = {
  id: string
  primaryCustomer: string
  vehicle: string
  type: 'Cash' | 'Finance' | 'Lease'
  state: 'Open' | 'Closed' | 'Pending'
  dealDate: string
  primarySalesperson: string
}

export default function DealsPage() {
  const [query, setQuery] = useState('')
  const [state, setState] = useState<'ALL' | DealRow['state']>('ALL')
  const [selected, setSelected] = useState<DealRow | null>(null)

  const rows = useMemo<DealRow[]>(
    () => [
      {
        id: '402476',
        primaryCustomer: 'Ben Lefebvre',
        vehicle: 'Stock#1008 - 2017 Volkswagen Jetta 1.4 TSI Wolfsburg Edition - Manual',
        type: 'Cash',
        state: 'Open',
        dealDate: 'Jan 14, 2026',
        primarySalesperson: 'Syed Islam',
      },
      {
        id: '401691',
        primaryCustomer: 'Esmeil Ali Ahmed',
        vehicle: 'Stock#1003 - 2017 Kia Sorento LX FWD',
        type: 'Cash',
        state: 'Pending',
        dealDate: 'Jan 10, 2026',
        primarySalesperson: 'Syed Islam',
      },
      {
        id: '401233',
        primaryCustomer: 'Sarif Bhuiyan',
        vehicle: 'Stock#1011 - 2010 Subaru Forester 2.5X Limited',
        type: 'Finance',
        state: 'Closed',
        dealDate: 'Jan 6, 2026',
        primarySalesperson: 'Syed Islam',
      },
    ],
    []
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return rows.filter((r) => {
      if (state !== 'ALL' && r.state !== state) return false
      if (!q) return true
      return (
        r.id.toLowerCase().includes(q) ||
        r.primaryCustomer.toLowerCase().includes(q) ||
        r.vehicle.toLowerCase().includes(q) ||
        r.type.toLowerCase().includes(q) ||
        r.primarySalesperson.toLowerCase().includes(q)
      )
    })
  }, [query, rows, state])

  return (
    <div className="w-full">
      <div className="bg-white shadow">
        <div className="w-full px-4 sm:px-6 lg:px-8 py-4 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Deals</h1>
            <p className="text-sm text-gray-500">Mock data only (UI design)</p>
          </div>
          <div className="text-sm text-gray-600">Total Deals: <span className="font-semibold">{filtered.length}</span></div>
        </div>
      </div>

      <div className="w-full px-4 sm:px-6 lg:px-8 py-6">
        <div className="bg-white rounded-xl shadow p-4">
          <div className="flex flex-col lg:flex-row lg:items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600">Show Closed</label>
              <input type="checkbox" className="h-4 w-4" checked={state !== 'Closed'} readOnly />
            </div>

            <div className="flex-1">
              <div className="relative">
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search deals..."
                  className="w-full border border-gray-200 rounded-lg px-10 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent"
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

            <div className="w-full lg:w-48">
              <select
                value={state}
                onChange={(e) => setState(e.target.value as any)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent"
              >
                <option value="ALL">All States</option>
                <option value="Open">Open</option>
                <option value="Pending">Pending</option>
                <option value="Closed">Closed</option>
              </select>
            </div>

            <div className="w-full lg:w-28">
              <select className="w-full border border-gray-200 rounded-lg px-3 py-2" defaultValue="5">
                <option value="5">5</option>
                <option value="10">10</option>
                <option value="25">25</option>
              </select>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow mt-4 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-12"></th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">ID</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Primary Customer</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Vehicle</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">State</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Deal Date</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Primary Salesperson</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-3 py-3">
                      <button
                        type="button"
                        onClick={() => setSelected(r)}
                        className="w-9 h-9 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
                        title="Edit deal"
                        aria-label="Edit deal"
                      >
                        <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M11 5h2m-1 0v14m8-7H4"
                          />
                        </svg>
                      </button>
                    </td>
                    <td className="px-6 py-3 text-sm font-medium text-gray-900 whitespace-nowrap">{r.id}</td>
                    <td className="px-6 py-3 text-sm text-gray-700 whitespace-nowrap">{r.primaryCustomer}</td>
                    <td className="px-6 py-3 text-sm text-[#118df0] min-w-[420px]">{r.vehicle}</td>
                    <td className="px-6 py-3 text-sm text-gray-700 whitespace-nowrap">{r.type}</td>
                    <td className="px-6 py-3 text-sm whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                          r.state === 'Open'
                            ? 'bg-blue-100 text-blue-700'
                            : r.state === 'Pending'
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {r.state}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-sm text-gray-700 whitespace-nowrap">{r.dealDate}</td>
                    <td className="px-6 py-3 text-sm text-gray-700 whitespace-nowrap">{r.primarySalesperson}</td>
                  </tr>
                ))}

                {filtered.length === 0 ? (
                  <tr>
                    <td className="px-6 py-10 text-center text-sm text-gray-500" colSpan={8}>
                      No results.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100">
            <div className="text-sm text-gray-500">Previous 1 Next</div>
            <div className="text-sm text-gray-500">Page 1</div>
          </div>
        </div>

        {selected ? (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            role="dialog"
            aria-modal="true"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) setSelected(null)
            }}
          >
            <div className="w-full max-w-6xl max-h-[90vh] bg-white rounded-2xl shadow-xl overflow-hidden flex flex-col">
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <div className="text-sm font-semibold text-gray-900">Deal #{selected.id}</div>
                <button
                  type="button"
                  className="w-10 h-10 rounded-xl hover:bg-gray-100 flex items-center justify-center"
                  onClick={() => setSelected(null)}
                  aria-label="Close"
                >
                  <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="px-6 py-4 border-b border-gray-100">
                <div className="flex flex-col lg:flex-row lg:items-center gap-3">
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-semibold text-gray-600">Deal Date</label>
                    <input type="date" defaultValue="2026-01-14" className="border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-semibold text-gray-600">Deal Type</label>
                    <select defaultValue={selected.type} className="border border-gray-200 rounded-lg px-3 py-2 text-sm">
                      <option value="Cash">Cash</option>
                      <option value="Finance">Finance</option>
                      <option value="Lease">Lease</option>
                    </select>
                  </div>
                  <div className="flex-1" />
                  <div className="flex items-center gap-2">
                    <div className="text-xs font-semibold text-gray-600">Reports</div>
                    <button type="button" className="h-9 px-3 rounded-lg bg-white border border-gray-200 text-sm hover:bg-gray-50">Email</button>
                    <button type="button" className="h-9 px-3 rounded-lg bg-white border border-gray-200 text-sm hover:bg-gray-50">Print</button>
                  </div>
                  <button type="button" className="h-9 px-4 rounded-lg bg-[#118df0] text-white text-sm font-semibold hover:bg-[#0d6ebd]">Share</button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto">
                <div className="px-6 py-5 bg-gray-50">
                  <div className="bg-white rounded-xl shadow p-5">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">First Name</label>
                        <input
                          defaultValue={selected.primaryCustomer.split(' ')[0]}
                          className="w-full border border-gray-200 rounded-lg px-3 py-2"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Middle Name</label>
                        <input defaultValue="" className="w-full border border-gray-200 rounded-lg px-3 py-2" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Last Name</label>
                        <input
                          defaultValue={selected.primaryCustomer.split(' ').slice(1).join(' ')}
                          className="w-full border border-gray-200 rounded-lg px-3 py-2"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Driver's License</label>
                        <input defaultValue="" className="w-full border border-gray-200 rounded-lg px-3 py-2" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Exp. Date</label>
                        <input type="date" defaultValue="" className="w-full border border-gray-200 rounded-lg px-3 py-2" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Date of Birth</label>
                        <input type="date" defaultValue="" className="w-full border border-gray-200 rounded-lg px-3 py-2" />
                      </div>

                      <div className="lg:col-span-3">
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Street Address</label>
                        <input defaultValue="" className="w-full border border-gray-200 rounded-lg px-3 py-2" />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">City</label>
                        <input defaultValue="" className="w-full border border-gray-200 rounded-lg px-3 py-2" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Province</label>
                        <select defaultValue="ON" className="w-full border border-gray-200 rounded-lg px-3 py-2">
                          <option value="ON">ON</option>
                          <option value="BC">BC</option>
                          <option value="AB">AB</option>
                          <option value="MB">MB</option>
                          <option value="QC">QC</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Postal Code</label>
                        <input defaultValue="" className="w-full border border-gray-200 rounded-lg px-3 py-2" />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Country</label>
                        <select defaultValue="CA" className="w-full border border-gray-200 rounded-lg px-3 py-2">
                          <option value="CA">CA</option>
                          <option value="US">US</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Email</label>
                        <input defaultValue="" className="w-full border border-gray-200 rounded-lg px-3 py-2" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Mobile</label>
                        <input defaultValue="" className="w-full border border-gray-200 rounded-lg px-3 py-2" />
                      </div>
                    </div>

                    <div className="mt-5">
                      <label className="block text-xs font-semibold text-gray-600 mb-2">Notes</label>
                      <div className="border border-gray-200 rounded-xl overflow-hidden">
                        <div className="bg-gray-50 px-3 py-2 flex items-center gap-2 text-xs text-gray-500">
                          <button type="button" className="px-2 py-1 rounded bg-white border border-gray-200">B</button>
                          <button type="button" className="px-2 py-1 rounded bg-white border border-gray-200">I</button>
                          <button type="button" className="px-2 py-1 rounded bg-white border border-gray-200">U</button>
                          <button type="button" className="px-2 py-1 rounded bg-white border border-gray-200">Tx</button>
                        </div>
                        <textarea
                          rows={8}
                          className="w-full px-4 py-3 text-sm focus:outline-none"
                          defaultValue={''}
                          placeholder="Write notes here... (mock UI)"
                        />
                      </div>
                      <div className="mt-4 flex items-center justify-end gap-3">
                        <button
                          type="button"
                          onClick={() => setSelected(null)}
                          className="h-10 px-4 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700"
                        >
                          Close
                        </button>
                        <button type="button" className="h-10 px-4 rounded-lg bg-green-600 text-white text-sm font-semibold hover:bg-green-700">
                          Save
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
