'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

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
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [state, setState] = useState<'ALL' | DealRow['state']>('ALL')

  const handleCreateNewDeal = () => {
    router.push('/admin/sales/deals/new')
  }

  const rows = useMemo<DealRow[]>(() => [], [])

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
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleCreateNewDeal}
              className="h-10 px-4 rounded-lg bg-[#118df0] text-white text-sm font-semibold hover:bg-[#0d6ebd] flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Create New Deal
            </button>
            <div className="text-sm text-gray-600">
              Total Deals: <span className="font-semibold">{filtered.length}</span>
            </div>
          </div>
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
                        onClick={() => router.push('/admin/sales/deals/new')}
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

      </div>
    </div>
  )
}
