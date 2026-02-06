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
  const [selectedDeal, setSelectedDeal] = useState<DealRow | null>(null)
  const [customersOpen, setCustomersOpen] = useState(true)
  const [profitOpen, setProfitOpen] = useState(false)

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<DealRow | null>(null)
  const [deleting, setDeleting] = useState(false)

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

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      setDeleting(true)
      const res = await fetch('/api/deals/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dealId: deleteTarget.dealId }),
      })
      const json = await res.json()
      if (!res.ok || json.error) throw new Error(json.error || 'Delete failed')
      // Remove from local state and close modal
      setRows((prev) => prev.filter((r) => r.dealId !== deleteTarget.dealId))
      if (selectedDeal?.dealId === deleteTarget.dealId) setSelectedDeal(null)
      setDeleteTarget(null)
    } catch (e: any) {
      console.error('[Delete] Error:', e)
      alert(e?.message || 'Failed to delete deal')
    } finally {
      setDeleting(false)
    }
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
                  <th className="px-2 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td className="px-6 py-10 text-center text-sm text-gray-500" colSpan={12}>
                      Loading deals...
                    </td>
                  </tr>
                ) : paged.length === 0 ? (
                  <tr>
                    <td className="px-6 py-10 text-center text-sm text-gray-500" colSpan={12}>
                      No results.
                    </td>
                  </tr>
                ) : (
                  paged.map((r, idx) => (
                    <tr
                      key={r.dealId || idx}
                      className={`hover:bg-gray-50 cursor-pointer ${selectedDeal?.dealId === r.dealId ? 'bg-blue-50' : ''}`}
                      onClick={() => setSelectedDeal(selectedDeal?.dealId === r.dealId ? null : r)}
                    >
                      <td className="px-2 py-3">
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); router.push(`/admin/sales/deals/new?dealId=${encodeURIComponent(r.dealId)}`) }}
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
                      <td className="px-2 py-3 text-center">
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setDeleteTarget(r) }}
                          className="w-8 h-8 rounded bg-red-50 hover:bg-red-100 flex items-center justify-center transition-colors"
                          title="Delete deal"
                          aria-label="Delete deal"
                        >
                          <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </td>
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

      {/* Right-side detail panel */}
      {selectedDeal && (
        <div className="fixed top-0 right-0 h-full w-[340px] bg-white shadow-2xl border-l border-gray-200 z-50 overflow-y-auto">
          {/* Close button */}
          <div className="px-3 pt-3">
            <button
              type="button"
              onClick={() => setSelectedDeal(null)}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>

          {/* Vehicle Section */}
          <div className="px-6 pt-2 pb-5 flex flex-col items-center text-center border-b border-gray-200">
            <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mb-3">
              <svg className="w-7 h-7 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17a2 2 0 11-4 0 2 2 0 014 0zm10 0a2 2 0 11-4 0 2 2 0 014 0zM3 11l1.5-4.5A2 2 0 016.4 5h11.2a2 2 0 011.9 1.5L21 11M3 11h18M3 11v5a1 1 0 001 1h1m14 0h1a1 1 0 001-1v-5" /></svg>
            </div>
            {(() => {
              const v = selectedDeal.vehicles?.[0]
              const sv = v || {}
              const yr = sv.selected_year || sv.year || ''
              const mk = sv.selected_make || sv.make || ''
              const md = sv.selected_model || sv.model || ''
              const tr = sv.selected_trim || sv.trim || ''
              const title = [yr, mk, md, tr].filter(Boolean).join(' ')
              const vin = sv.selected_vin || sv.vin || ''
              const stock = sv.selected_stock_number || ''
              const status = sv.selected_status || ''
              const ws = selectedDeal.worksheet
              const price = ws?.purchase_price || ws?.total_balance_due || ''
              return (
                <>
                  <div className="text-base font-bold text-red-600 uppercase leading-tight">{title || 'No Vehicle'}</div>
                  {vin && <div className="text-xs text-gray-500 mt-1">{vin}</div>}
                  {stock && <div className="text-xs text-gray-500">{stock}</div>}
                  {status && <div className="text-xs text-gray-500">{status}</div>}
                  {price && <div className="text-sm font-semibold text-gray-900 mt-1">${Number(price).toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>}
                </>
              )
            })()}
          </div>

          {/* Customers Section */}
          <div className="px-6 py-4 border-b border-gray-200">
            <button type="button" onClick={() => setCustomersOpen(!customersOpen)} className="flex items-center gap-2 w-full text-left mb-3">
              <svg className={`w-4 h-4 text-blue-500 transition-transform ${customersOpen ? 'rotate-0' : '-rotate-90'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              <span className="text-base font-bold text-gray-900">Customers</span>
            </button>
            {customersOpen && (() => {
              const c = selectedDeal.customer
              if (!c) return <div className="text-xs text-gray-400">No customer data</div>
              const name = [c.firstname, c.lastname].filter(Boolean).join(' ')
              const initials = [(c.firstname || '')[0], (c.lastname || '')[0]].filter(Boolean).join('').toUpperCase()
              return (
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded bg-green-600 text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
                    {initials || '?'}
                  </div>
                  <div className="text-sm space-y-0.5">
                    <div className="font-semibold text-gray-900">{name || 'Unknown'}</div>
                    {c.email && <div className="text-gray-500 flex items-center gap-1.5 text-xs"><span className="mr-0.5">&#9993;</span>{c.email}</div>}
                    {c.phone && <div className="text-gray-500 flex items-center gap-1.5 text-xs"><span className="mr-0.5">&#9742;</span>{c.phone}</div>}
                    {(c.city || c.province) && <div className="text-gray-500 text-xs">{[c.city, c.province].filter(Boolean).join(', ')}</div>}
                  </div>
                </div>
              )
            })()}
          </div>

          {/* Profit Analysis Section */}
          <div className="px-6 py-4">
            <button type="button" onClick={() => setProfitOpen(!profitOpen)} className="flex items-center gap-2 w-full text-left mb-4">
              <svg className={`w-4 h-4 text-blue-500 transition-transform ${profitOpen ? 'rotate-0' : '-rotate-90'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              <span className="text-base font-bold text-gray-900">Profit Analysis</span>
            </button>
            {profitOpen && (() => {
              const ws = selectedDeal.worksheet
              const fmt = (n: number) => '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
              const purchasePrice = Number(ws?.purchase_price) || 0
              const discount = Number(ws?.discount) || 0
              const sellingPrice = purchasePrice - discount
              const feesTotal = (Array.isArray(ws?.fees) ? ws.fees : []).reduce((s: number, f: any) => s + (Number(f.amount) || 0), 0)
              const accTotal = (Array.isArray(ws?.accessories) ? ws.accessories : []).reduce((s: number, a: any) => s + (Number(a.price) || 0), 0)
              const warTotal = (Array.isArray(ws?.warranties) ? ws.warranties : []).reduce((s: number, w: any) => s + (Number(w.amount) || 0), 0)
              const insTotal = (Array.isArray(ws?.insurances) ? ws.insurances : []).reduce((s: number, i: any) => s + (Number(i.amount) || 0), 0)
              const additionalExpenses = feesTotal + accTotal + warTotal + insTotal
              const vehicleProfit = sellingPrice - purchasePrice + additionalExpenses
              const totalProfit = vehicleProfit + feesTotal + accTotal + warTotal + insTotal

              // Donut chart
              const total = sellingPrice || 1
              const profitPct = Math.min(100, Math.max(5, ((totalProfit / total) * 100)))
              const rd = 50
              const circ = 2 * Math.PI * rd
              const offset = circ - (profitPct / 100) * circ

              return (
                <div>
                  <div className="flex justify-center mb-5">
                    <svg width="140" height="140" viewBox="0 0 120 120">
                      <circle cx="60" cy="60" r="56" fill="#16a34a" />
                      <line x1="60" y1="6" x2="60" y2="60" stroke="#ffffff" strokeWidth="4" strokeLinecap="round" />
                    </svg>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-gray-700 font-semibold">Vehicle Purchase Price:</span><span>{fmt(purchasePrice)}</span></div>
                    <div className="flex justify-between"><span className="text-gray-700 font-semibold">Additional Expenses:</span><span>{fmt(additionalExpenses)}</span></div>
                    <div className="flex justify-between"><span className="text-gray-700 font-semibold">Vehicle Selling Price:</span><span>{fmt(sellingPrice)}</span></div>
                    <div className="flex justify-between"><span className="text-gray-700 font-semibold">Vehicle Profit:</span><span>{fmt(vehicleProfit)}</span></div>
                    <div className="flex justify-between"><span className="text-gray-700 font-semibold">Fees Profit:</span><span>{fmt(feesTotal)}</span></div>
                    <div className="flex justify-between"><span className="text-gray-700 font-semibold">Accessories Profit:</span><span>{fmt(accTotal)}</span></div>
                    <div className="flex justify-between"><span className="text-gray-700 font-semibold">Warranties Profit:</span><span>{fmt(warTotal)}</span></div>
                    <div className="flex justify-between"><span className="text-gray-700 font-semibold">Insurance Profit:</span><span>{fmt(insTotal)}</span></div>
                    <div className="flex justify-between"><span className="text-gray-700 font-semibold">Bank Commission:</span><span>{fmt(0)}</span></div>
                    <div className="flex justify-between"><span className="text-gray-700 font-bold">Total Profit:</span><span className="font-bold">{fmt(totalProfit)}</span></div>
                  </div>
                </div>
              )
            })()}
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => !deleting && setDeleteTarget(null)} />
          <div className="relative w-full max-w-md rounded-xl bg-white shadow-xl border border-gray-200">
            <div className="px-5 py-4 border-b border-gray-200 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <div className="text-sm font-semibold text-gray-900">Delete Deal</div>
                <div className="text-xs text-gray-500">This action cannot be undone</div>
              </div>
            </div>
            <div className="px-5 py-5">
              <div className="text-sm text-gray-700">
                Are you sure you want to delete deal <span className="font-bold">#{deleteTarget.dealId}</span>
                {deleteTarget.primaryCustomer ? <> for <span className="font-bold">{deleteTarget.primaryCustomer}</span></> : null}?
                This will permanently remove all data (Customers, Vehicles, Worksheet, Disclosures, and Delivery) associated with this deal.
              </div>
              <div className="mt-5 flex items-center justify-end gap-2">
                <button
                  type="button"
                  disabled={deleting}
                  onClick={() => setDeleteTarget(null)}
                  className="h-9 px-4 rounded bg-gray-100 text-gray-700 text-sm font-semibold hover:bg-gray-200 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={deleting}
                  onClick={handleDelete}
                  className="h-9 px-4 rounded bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-50"
                >
                  {deleting ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Overlay backdrop */}
      {selectedDeal && (
        <div
          className="fixed inset-0 bg-black/20 z-40"
          onClick={() => setSelectedDeal(null)}
        />
      )}
    </div>
  )
}
