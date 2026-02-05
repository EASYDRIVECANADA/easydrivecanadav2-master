'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

type DealRow = {
  dealId: string
  primaryCustomer: string
  vehicle: string
  type: string
  state: string
  dealDate: string
  primarySalesperson: string
  other: string
  reference: string
  // Full raw data from all tables for future prefill / edit
  customer: any
  vehicles: any[]
  worksheet: any
  disclosures: any
  delivery: any
}

export default function DealsPage() {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [stateFilter, setStateFilter] = useState('ALL')
  const [showClosed, setShowClosed] = useState(true)
  const [pageSize, setPageSize] = useState(5)
  const [page, setPage] = useState(1)
  const [rows, setRows] = useState<DealRow[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)

  const fetchDeals = useCallback(async () => {
    try {
      setLoading(true)
      setFetchError(null)
      const res = await fetch('/api/deals')
      if (!res.ok) throw new Error(`Failed to fetch deals (${res.status})`)
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      const deals: DealRow[] = (json.deals || []).map((d: any) => ({
        dealId: d.dealId || '',
        primaryCustomer: d.primaryCustomer || '',
        vehicle: d.vehicle || '',
        type: d.type || '',
        state: d.state || '',
        dealDate: d.dealDate || '',
        primarySalesperson: d.primarySalesperson || '',
        other: '',
        reference: '',
        customer: d.customer || null,
        vehicles: d.vehicles || [],
        worksheet: d.worksheet || null,
        disclosures: d.disclosures || null,
        delivery: d.delivery || null,
      }))
      setRows(deals)
    } catch (e: any) {
      setFetchError(e?.message || 'Failed to load deals')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchDeals()
  }, [fetchDeals])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return rows.filter((r) => {
      if (!showClosed && r.state.toLowerCase() === 'closed') return false
      if (stateFilter !== 'ALL' && r.state !== stateFilter) return false
      if (!q) return true
      return (
        r.dealId.toLowerCase().includes(q) ||
        r.primaryCustomer.toLowerCase().includes(q) ||
        r.vehicle.toLowerCase().includes(q) ||
        r.type.toLowerCase().includes(q) ||
        r.primarySalesperson.toLowerCase().includes(q)
      )
    })
  }, [query, rows, stateFilter, showClosed])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const paged = filtered.slice((safePage - 1) * pageSize, safePage * pageSize)

  const handleCreateNewDeal = () => {
    router.push('/admin/sales/deals/new')
  }

  const formatDate = (d: string) => {
    if (!d) return ''
    try {
      const dt = new Date(d)
      if (isNaN(dt.getTime())) return d
      return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    } catch {
      return d
    }
  }

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
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={showClosed}
                onChange={(e) => { setShowClosed(e.target.checked); setPage(1) }}
              />
            </div>

            <div className="flex-1">
              <div className="relative">
                <input
                  value={query}
                  onChange={(e) => { setQuery(e.target.value); setPage(1) }}
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
                value={stateFilter}
                onChange={(e) => { setStateFilter(e.target.value); setPage(1) }}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent"
              >
                <option value="ALL">All States</option>
                <option value="Open">Open</option>
                <option value="Pending">Pending</option>
                <option value="Closed">Closed</option>
              </select>
            </div>

            <div className="w-full lg:w-28">
              <select
                className="w-full border border-gray-200 rounded-lg px-3 py-2"
                value={pageSize}
                onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1) }}
              >
                <option value="5">5</option>
                <option value="10">10</option>
                <option value="25">25</option>
              </select>
            </div>
          </div>
        </div>

        {fetchError ? (
          <div className="mt-4 rounded border border-red-200 bg-red-50 text-red-700 px-4 py-3 text-sm">{fetchError}</div>
        ) : null}

        <div className="bg-white rounded-xl shadow mt-4 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-2 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-10"></th>
                  <th className="px-2 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-10"></th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">ID</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Primary Customer</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Vehicle</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">State</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Deal Date</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Primary Salesperson</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Other</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Reference</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td className="px-6 py-10 text-center text-sm text-gray-500" colSpan={11}>
                      Loading deals...
                    </td>
                  </tr>
                ) : paged.length === 0 ? (
                  <tr>
                    <td className="px-6 py-10 text-center text-sm text-gray-500" colSpan={11}>
                      No results.
                    </td>
                  </tr>
                ) : (
                  paged.map((r, idx) => (
                    <tr key={r.dealId || idx} className="hover:bg-gray-50">
                      <td className="px-2 py-3">
                        <button
                          type="button"
                          onClick={() => router.push(`/admin/sales/deals/new?dealId=${encodeURIComponent(r.dealId)}`)}
                          className="w-8 h-8 rounded bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
                          title="Edit deal"
                          aria-label="Edit deal"
                        >
                          <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 112.828 2.828L11.828 15.828a2 2 0 01-1.414.586H8v-2.414a2 2 0 01.586-1.414z" />
                          </svg>
                        </button>
                      </td>
                      <td className="px-2 py-3">
                        <input type="checkbox" className="h-4 w-4" />
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900 whitespace-nowrap">{r.dealId}</td>
                      <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">{r.primaryCustomer}</td>
                      <td className="px-4 py-3 text-sm text-gray-700 min-w-[360px]">{r.vehicle}</td>
                      <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">{r.type}</td>
                      <td className="px-4 py-3 text-sm whitespace-nowrap">{r.state}</td>
                      <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">{formatDate(r.dealDate)}</td>
                      <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">{r.primarySalesperson}</td>
                      <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">{r.other}</td>
                      <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">{r.reference}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <button
                type="button"
                disabled={safePage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-2 py-1 rounded hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPage(p)}
                  className={`w-8 h-8 rounded text-sm font-semibold ${p === safePage ? 'bg-[#118df0] text-white' : 'hover:bg-gray-100 text-gray-700'}`}
                >
                  {p}
                </button>
              ))}
              <button
                type="button"
                disabled={safePage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="px-2 py-1 rounded hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
            <div className="text-sm text-gray-500">Page {safePage}</div>
          </div>
        </div>

      </div>
    </div>
  )
}
