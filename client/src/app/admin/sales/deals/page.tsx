'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { motion } from 'framer-motion'

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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<DealRow | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [isAdminRole, setIsAdminRole] = useState(false)
  const [bulkDeleteConfirmOpen, setBulkDeleteConfirmOpen] = useState(false)

  const getAdminHeaders = useCallback((): Record<string, string> => {
    try {
      const raw = window.localStorage.getItem('edc_admin_session')
      if (!raw) return {}
      const parsed = JSON.parse(raw) as { email?: string; session_token?: string; token?: string; user_id?: string }
      const email = String(parsed?.email || '').trim()
      const token = String(parsed?.session_token || parsed?.token || 'no-token').trim()
      if (!email) return {}
      return { 'x-admin-email': email, 'x-admin-token': token }
    } catch { return {} }
  }, [])

  const getLoggedInUserId = useCallback(async (): Promise<string | null> => {
    try {
      if (typeof window === 'undefined') return null
      const raw = window.localStorage.getItem('edc_admin_session')
      if (!raw) return null
      const parsed = JSON.parse(raw) as { email?: string; user_id?: string }
      const sessionUserId = String(parsed?.user_id ?? '').trim()
      if (sessionUserId) return sessionUserId

      const email = String(parsed?.email ?? '').trim().toLowerCase()
      if (!email) return null

      const { data, error } = await supabase
        .from('edc_account_verifications')
        .select('id')
        .eq('email', email)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (error) return null
      return (data as any)?.id ?? null
    } catch {
      return null
    }
  }, [])

  const getIsAdminRole = useCallback(async (): Promise<boolean> => {
    try {
      if (typeof window === 'undefined') return false
      const raw = window.localStorage.getItem('edc_admin_session')
      if (!raw) return false
      const parsed = JSON.parse(raw) as { email?: string; user_id?: string }
      const email = String(parsed?.email ?? '').trim().toLowerCase()
      const uid = String(parsed?.user_id ?? '').trim()

      const { data: byId } = uid
        ? await supabase.from('users').select('role').eq('user_id', uid).maybeSingle()
        : ({ data: null } as any)
      const { data: byEmail } = !byId?.role && email
        ? await supabase.from('users').select('role').eq('email', email).maybeSingle()
        : ({ data: null } as any)

      const r = String((byId as any)?.role ?? (byEmail as any)?.role ?? '').trim().toLowerCase()
      return r === 'admin'
    } catch {
      return false
    }
  }, [])

  useEffect(() => {
    void (async () => {
      const admin = await getIsAdminRole()
      setIsAdminRole(admin)
    })()
  }, [getIsAdminRole])

  const fetchDeals = useCallback(async () => {
    try {
      setLoading(true)
      setFetchError(null)

      const [scopedUserId, admin] = await Promise.all([getLoggedInUserId(), getIsAdminRole()])
      setIsAdminRole(admin)
      if (!admin && !scopedUserId) {
        setRows([])
        return
      }

      const res = await fetch('/api/deals')
      if (!res.ok) throw new Error(`Failed to fetch deals (${res.status})`)
      const json = await res.json()
      if (json.error) throw new Error(json.error)

      const dealsAll: DealRow[] = (json.deals || []).map((d: any) => ({
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

      const deals = admin
        ? dealsAll
        : dealsAll.filter((r) => {
            const uid = String(r.customer?.user_id ?? '').trim()
            return uid && uid === scopedUserId
          })

      setRows(deals)
    } catch (e: any) {
      setFetchError(e?.message || 'Failed to load deals')
    } finally {
      setLoading(false)
    }
  }, [getIsAdminRole, getLoggedInUserId])

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

  const handleOpenSignature = () => {
    router.push('/admin/sales/deals/signature')
  }

  const allSelected = selectedIds.size > 0 && paged.length > 0 && selectedIds.size === paged.length
  const toggleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(paged.map(d => d.dealId)))
    } else {
      setSelectedIds(new Set())
    }
  }
  const toggleSelect = (dealId: string, checked: boolean) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (checked) next.add(dealId)
      else next.delete(dealId)
      return next
    })
  }

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return
    const selected = rows.filter((d) => selectedIds.has(d.dealId))
    if (selected.length === 0) return
    setBulkDeleteConfirmOpen(true)
  }

  const confirmBulkDelete = async () => {
    const selected = rows.filter((d) => selectedIds.has(d.dealId))
    setBulkDeleteConfirmOpen(false)
    try {
      setDeleting(true)
      const authHeaders = getAdminHeaders()
      const results = await Promise.all(
        selected.map((d) =>
          fetch('/api/deals/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...authHeaders },
            body: JSON.stringify({ dealId: d.dealId }),
          }).then(async (res) => {
            const json = await res.json().catch(() => ({}))
            if (!res.ok || json.error) throw new Error(json.error || `Delete failed for ${d.dealId}`)
            return d.dealId
          })
        )
      )
      const deletedIds = new Set(results)
      setRows((prev) => prev.filter((r) => !deletedIds.has(r.dealId)))
      if (selectedDeal && deletedIds.has(selectedDeal.dealId)) setSelectedDeal(null)
      setSelectedIds(new Set())
    } catch (e: any) {
      console.error('[Bulk Delete] Error:', e)
      // Re-fetch to get true state from DB
      await fetchDeals()
    } finally {
      setDeleting(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      setDeleting(true)
      const res = await fetch('/api/deals/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAdminHeaders() },
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
    <div className="min-h-screen">
      <div className="edc-page-header">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-slate-900">Deals</h1>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleCreateNewDeal}
              className="edc-btn-primary text-sm"
              title="Create New Deal"
            >
              + New Deal
            </button>
            <div className="text-sm text-slate-500">
              Total: <span className="font-semibold text-slate-700">{filtered.length}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="px-6 py-6">
        <div className="edc-card p-4">
          <div className="flex flex-col lg:flex-row lg:items-center gap-3">
            <div className="flex items-center gap-2">
            </div>

            <div className="flex-1">
              <div className="relative">
                <input
                  value={query}
                  onChange={(e) => { setQuery(e.target.value); setPage(1) }}
                  placeholder="Search deals..."
                  className="edc-input pl-10"
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
                className="edc-input"
              >
                <option value="ALL">All States</option>
                <option value="Open">Open</option>
                <option value="Pending">Pending</option>
                <option value="Closed">Closed</option>
              </select>
            </div>

            <div className="w-full lg:w-28">
              <select
                className="edc-input"
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
          <div className="mt-4 rounded-xl border border-danger-500/20 bg-danger-500/5 text-danger-600 px-4 py-3 text-sm">{fetchError}</div>
        ) : null}

        {selectedIds.size > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200/60 p-3 mb-5" style={{ boxShadow: '0 1px 3px rgba(0,0,0,.04)' }}>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="text-sm font-semibold text-slate-700">
                {selectedIds.size} selected
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setBulkDeleteConfirmOpen(true)}
                  disabled={deleting}
                  className="edc-btn-danger text-sm"
                >
                  {deleting ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="edc-card mt-4 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="edc-table">
              <thead>
                <tr>
                  <th className="w-10"></th>
                  <th className="w-10">
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={allSelected}
                      onChange={(e) => toggleSelectAll(e.target.checked)}
                    />
                  </th>
                  <th>Primary Customer</th>
                  <th>Vehicle</th>
                  <th>Type</th>
                  <th>State</th>
                  <th>Deal Date</th>
                  <th>Primary Salesperson</th>
                  <th>Other</th>
                  <th>Reference</th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td className="px-6 py-10 text-center text-sm text-slate-400" colSpan={11}>
                      Loading deals...
                    </td>
                  </tr>
                ) : paged.length === 0 ? (
                  <tr>
                    <td className="px-6 py-10 text-center text-sm text-slate-400" colSpan={11}>
                      No results.
                    </td>
                  </tr>
                ) : (
                  paged.map((r, idx) => (
                    <tr
                      key={r.dealId || idx}
                      className={`cursor-pointer ${selectedDeal?.dealId === r.dealId ? 'bg-cyan-50/50' : ''}`}
                      onClick={() => setSelectedDeal(selectedDeal?.dealId === r.dealId ? null : r)}
                    >
                      <td className="px-2 py-3">
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); router.push(`/admin/sales/deals/new?dealId=${encodeURIComponent(r.dealId)}`) }}
                          className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors"
                          title="Edit deal"
                          aria-label="Edit deal"
                        >
                          <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 112.828 2.828L11.828 15.828a2 2 0 01-1.414.586H8v-2.414a2 2 0 01.586-1.414z" />
                          </svg>
                        </button>
                      </td>
                      <td className="px-2 py-3" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          className="h-4 w-4"
                          checked={selectedIds.has(r.dealId)}
                          onChange={(e) => toggleSelect(r.dealId, e.target.checked)}
                        />
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600 whitespace-nowrap">{r.primaryCustomer}</td>
                      <td className="px-4 py-3 text-sm text-slate-600 min-w-[360px]">{r.vehicle}</td>
                      <td className="px-4 py-3 text-sm text-slate-600 whitespace-nowrap">{r.type}</td>
                      <td className="px-4 py-3 text-sm whitespace-nowrap">{r.state}</td>
                      <td className="px-4 py-3 text-sm text-slate-600 whitespace-nowrap">{formatDate(r.dealDate)}</td>
                      <td className="px-4 py-3 text-sm text-slate-600 whitespace-nowrap">{r.primarySalesperson}</td>
                      <td className="px-4 py-3 text-sm text-slate-600 whitespace-nowrap">{r.other}</td>
                      <td className="px-4 py-3 text-sm text-slate-600 whitespace-nowrap">{r.reference}</td>
                      <td className="px-2 py-3 text-center">
                        {/* Delete button removed - use bulk delete instead */}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100">
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <button
                type="button"
                disabled={safePage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-2 py-1 rounded-lg hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Previous
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPage(p)}
                  className={`w-8 h-8 rounded-lg text-sm font-semibold transition-colors ${p === safePage ? 'bg-navy-900 text-white' : 'hover:bg-slate-100 text-slate-600'}`}
                >
                  {p}
                </button>
              ))}
              <button
                type="button"
                disabled={safePage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="px-2 py-1 rounded-lg hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Next
              </button>
            </div>
            <div className="text-sm text-slate-500">Page {safePage}</div>
          </div>
        </div>

      </div>

      {/* Right-side detail panel */}
      {selectedDeal && (
        <div className="fixed top-0 right-0 h-full w-[340px] bg-white shadow-premium border-l border-slate-200/60 z-50 overflow-y-auto">
          {/* Close button */}
          <div className="px-3 pt-3">
            <button
              type="button"
              onClick={() => setSelectedDeal(null)}
              className="text-slate-400 hover:text-slate-600 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>

          {/* Vehicle Section */}
          <div className="px-6 pt-2 pb-5 flex flex-col items-center text-center border-b border-slate-100">
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
                  <div className="text-base font-bold text-slate-900 uppercase leading-tight">{title || 'No Vehicle'}</div>
                  {vin && <div className="text-xs text-gray-500 mt-1">{vin}</div>}
                  {stock && <div className="text-xs text-gray-500">{stock}</div>}
                  {status && <div className="text-xs text-gray-500">{status}</div>}
                  {price && <div className="text-sm font-semibold text-gray-900 mt-1">${Number(price).toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>}
                </>
              )
            })()}
          </div>

          {/* Customers Section */}
          <div className="px-6 py-4 border-b border-slate-100">
            <button type="button" onClick={() => setCustomersOpen(!customersOpen)} className="flex items-center gap-2 w-full text-left mb-3">
              <svg className={`w-4 h-4 text-cyan-500 transition-transform ${customersOpen ? 'rotate-0' : '-rotate-90'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              <span className="text-sm font-semibold text-slate-900">Customers</span>
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
              <svg className={`w-4 h-4 text-cyan-500 transition-transform ${profitOpen ? 'rotate-0' : '-rotate-90'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              <span className="text-sm font-semibold text-slate-900">Profit Analysis</span>
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

              // Donut chart with animation
              const circumference = 2 * Math.PI * 35
              const purchasePct = sellingPrice > 0 ? (purchasePrice / sellingPrice) * 100 : 0
              const expensesPct = sellingPrice > 0 ? (additionalExpenses / sellingPrice) * 100 : 0
              const profitPct = sellingPrice > 0 ? (totalProfit / sellingPrice) * 100 : 0

              const purchaseDash = (purchasePct / 100) * circumference
              const expensesDash = (expensesPct / 100) * circumference
              const profitDash = (profitPct / 100) * circumference

              return (
                <div>
                  <div className="flex justify-center mb-5">
                    <svg viewBox="0 0 100 100" className="w-40 h-40 -rotate-90">
                      <motion.circle
                        cx="50"
                        cy="50"
                        r="35"
                        fill="transparent"
                        stroke="#2563eb"
                        strokeWidth="20"
                        animate={{
                          strokeDasharray: `${purchaseDash} ${circumference}`,
                          strokeDashoffset: 0,
                        }}
                        transition={{ duration: 0.6, ease: 'easeInOut' }}
                      />
                      <motion.circle
                        cx="50"
                        cy="50"
                        r="35"
                        fill="transparent"
                        stroke="#dc2626"
                        strokeWidth="20"
                        animate={{
                          strokeDasharray: `${expensesDash} ${circumference}`,
                          strokeDashoffset: -purchaseDash,
                        }}
                        transition={{ duration: 0.6, ease: 'easeInOut' }}
                      />
                      {totalProfit > 0 && (
                        <motion.circle
                          cx="50"
                          cy="50"
                          r="35"
                          fill="transparent"
                          stroke="#16a34a"
                          strokeWidth="20"
                          animate={{
                            strokeDasharray: `${profitDash} ${circumference}`,
                            strokeDashoffset: -(purchaseDash + expensesDash),
                          }}
                          transition={{ duration: 0.6, ease: 'easeInOut' }}
                        />
                      )}
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
          <div className="edc-overlay absolute inset-0 z-0" onClick={() => !deleting && setDeleteTarget(null)} />
          <div className="edc-modal relative z-10 w-full max-w-sm mx-4 p-6">
              <div className="text-base font-semibold text-slate-900">Delete Deal</div>
              <div className="text-sm text-slate-500 mt-1">Are you sure you want to delete this deal?</div>
              <div className="mt-5 flex items-center justify-end gap-2">
                <button
                  type="button"
                  disabled={deleting}
                  onClick={() => setDeleteTarget(null)}
                  className="edc-btn-ghost text-sm"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={deleting}
                  onClick={handleDelete}
                  className="edc-btn-danger text-sm"
                >
                  {deleting ? 'Deleting...' : 'Delete'}
                </button>
              </div>
          </div>
        </div>
      )}

      {/* Overlay backdrop */}
      {selectedDeal && (
        <div
          className="fixed inset-0 bg-black/10 z-40 backdrop-blur-[1px]"
          onClick={() => setSelectedDeal(null)}
        />
      )}

      {/* Bulk Delete Confirm Modal */}
      {bulkDeleteConfirmOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => { if (!deleting) setBulkDeleteConfirmOpen(false) }} />
          <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            {/* Header */}
            <div className="px-6 pt-5 pb-4 border-b border-slate-100 flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-red-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                </svg>
              </div>
              <div>
                <div className="text-base font-bold text-slate-800">Delete {selectedIds.size} Deal{selectedIds.size > 1 ? 's' : ''}</div>
                <div className="text-xs text-slate-500 mt-0.5">This action cannot be undone</div>
              </div>
            </div>
            {/* Body */}
            <div className="px-6 py-4 text-sm text-slate-600">
              Are you sure you want to permanently delete <span className="font-semibold text-slate-800">{selectedIds.size} selected deal{selectedIds.size > 1 ? 's' : ''}</span>? All associated data will be removed.
            </div>
            {/* Footer */}
            <div className="px-6 pb-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setBulkDeleteConfirmOpen(false)}
                disabled={deleting}
                className="h-9 px-4 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmBulkDelete}
                disabled={deleting}
                className="h-9 px-4 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-50 flex items-center gap-2 transition-colors"
              >
                {deleting ? (
                  <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2a10 10 0 1 0 10 10"/></svg>
                ) : (
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
                )}
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
