'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { motion } from 'framer-motion'

type PurchaseSubmission = {
  id: string
  vehicle_year: number
  vehicle_make: string
  vehicle_model: string
  vehicle_trim: string
  vehicle_vin: string
  vehicle_stock_number: string
  vehicle_price: number
  customer_first_name: string
  customer_last_name: string
  customer_email: string
  customer_phone: string
  customer_address: string
  customer_city: string
  customer_province: string
  customer_postal_code: string
  deposit_amount: number
  total_price: number
  hst: number
  warranty_name: string | null
  warranty_total: number | null
  add_ons: string[]
  status: string
  deal_stage: string | null
  submitted_at: string
  approved_at: string | null
  deal_id: string | null
  order_data: any
}

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

  // Purchase submissions
  const [submissions, setSubmissions] = useState<PurchaseSubmission[]>([])
  const [submissionsLoading, setSubmissionsLoading] = useState(true)
  const [approvingId, setApprovingId] = useState<string | null>(null)
  const [approveError, setApproveError] = useState<string | null>(null)
  const [expandedSubmission, setExpandedSubmission] = useState<string | null>(null)
  const [decliningId, setDecliningId] = useState<string | null>(null)
  const [declineTarget, setDeclineTarget] = useState<PurchaseSubmission | null>(null)
  const [declineReason, setDeclineReason] = useState('')
  const [activeWebDeals, setActiveWebDeals] = useState<PurchaseSubmission[]>([])
  const [activeWebDealsLoading, setActiveWebDealsLoading] = useState(true)
  const [stagingId, setStagingId] = useState<string | null>(null)
  const [expandedWebDeal, setExpandedWebDeal] = useState<string | null>(null)

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

  const fetchSubmissions = useCallback(async () => {
    try {
      setSubmissionsLoading(true)
      setActiveWebDealsLoading(true)
      const res = await fetch('/api/purchase-submissions')
      const json = await res.json()
      const all: PurchaseSubmission[] = json.submissions || []
      setSubmissions(all.filter((s) => s.status === 'pending'))
      setActiveWebDeals(all.filter((s) => s.status === 'approved' && s.deal_stage !== 'closed'))
    } catch {
      // silent
    } finally {
      setSubmissionsLoading(false)
      setActiveWebDealsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSubmissions()
  }, [fetchSubmissions])

  const handleDecline = async () => {
    if (!declineTarget) return
    setDecliningId(declineTarget.id)
    try {
      const res = await fetch('/api/purchase-submissions/decline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ submissionId: declineTarget.id, reason: declineReason.trim() || undefined }),
      })
      const json = await res.json()
      if (!res.ok || json.error) throw new Error(json.error || 'Decline failed')
      setSubmissions((prev) => prev.filter((s) => s.id !== declineTarget.id))
      setDeclineTarget(null)
      setDeclineReason('')
    } catch (e: any) {
      setApproveError(e?.message || 'Failed to decline')
    } finally {
      setDecliningId(null)
    }
  }

  const STAGE_LABELS: Record<string, string> = {
    insurance_pending: 'Insurance Pending',
    delivery_pending: 'Delivery Pending',
    closed: 'Closed',
  }
  const STAGE_ORDER = ['insurance_pending', 'delivery_pending', 'closed']

  const handleAdvanceStage = async (sub: PurchaseSubmission) => {
    const currentIdx = STAGE_ORDER.indexOf(sub.deal_stage || 'insurance_pending')
    const nextStage = STAGE_ORDER[currentIdx + 1]
    if (!nextStage) return
    setStagingId(sub.id)
    try {
      const res = await fetch('/api/purchase-submissions/stage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ submissionId: sub.id, stage: nextStage }),
      })
      const json = await res.json()
      if (!res.ok || json.error) throw new Error(json.error || 'Stage update failed')
      if (nextStage === 'closed') {
        setActiveWebDeals((prev) => prev.filter((s) => s.id !== sub.id))
        await fetchDeals()
      } else {
        setActiveWebDeals((prev) => prev.map((s) => s.id === sub.id ? { ...s, deal_stage: nextStage } : s))
      }
    } catch (e: any) {
      alert(e?.message || 'Failed to update stage')
    } finally {
      setStagingId(null)
    }
  }

  const handleApprove = async (sub: PurchaseSubmission) => {
    setApprovingId(sub.id)
    setApproveError(null)
    try {
      const res = await fetch('/api/purchase-submissions/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ submissionId: sub.id }),
      })
      const json = await res.json()
      if (!res.ok || json.error) throw new Error(json.error || 'Approval failed')
      setSubmissions((prev) => prev.filter((s) => s.id !== sub.id))
      await Promise.all([fetchDeals(), fetchSubmissions()])
    } catch (e: any) {
      setApproveError(e?.message || 'Failed to approve')
    } finally {
      setApprovingId(null)
    }
  }

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

        {/* Pending Approvals Section */}
        {(submissionsLoading || submissions.length > 0) && (
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-3">
              <h2 className="text-base font-bold text-slate-900">Pending Approvals</h2>
              {submissions.length > 0 && (
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-500 text-white text-xs font-bold">{submissions.length}</span>
              )}
            </div>
            {approveError && (
              <div className="mb-3 rounded-xl border border-red-200 bg-red-50 text-red-600 px-4 py-2 text-sm">{approveError}</div>
            )}
            {submissionsLoading ? (
              <div className="edc-card p-6 text-sm text-slate-400">Loading submissions...</div>
            ) : (
              <div className="space-y-3">
                {submissions.map((sub) => {
                  const vehicleLabel = [sub.vehicle_year, sub.vehicle_make, sub.vehicle_model, sub.vehicle_trim].filter(Boolean).join(' ')
                  const customerName = [sub.customer_first_name, sub.customer_last_name].filter(Boolean).join(' ')
                  const isExpanded = expandedSubmission === sub.id
                  const isApproving = approvingId === sub.id
                  return (
                    <div key={sub.id} className="edc-card overflow-hidden">
                      <div className="flex items-center justify-between gap-4 px-5 py-4">
                        <div className="flex items-center gap-4 min-w-0">
                          <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                            <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-slate-900 truncate">{vehicleLabel}</div>
                            <div className="text-xs text-slate-500 truncate">{customerName} &middot; {sub.customer_email}</div>
                            <div className="text-xs text-slate-400 mt-0.5">{new Date(sub.submitted_at).toLocaleString('en-CA', { dateStyle: 'medium', timeStyle: 'short' })}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <div className="text-right hidden sm:block">
                            <div className="text-sm font-bold text-slate-900">${Number(sub.deposit_amount).toLocaleString('en-CA')}</div>
                            <div className="text-xs text-slate-400">deposit</div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setExpandedSubmission(isExpanded ? null : sub.id)}
                            className="h-8 px-3 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                          >
                            {isExpanded ? 'Hide' : 'Details'}
                          </button>
                          <button
                            type="button"
                            onClick={() => { setDeclineTarget(sub); setDeclineReason('') }}
                            disabled={isApproving || decliningId === sub.id}
                            className="h-8 px-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-xs font-semibold hover:bg-red-100 disabled:opacity-50 flex items-center gap-1.5 transition-colors"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            Decline
                          </button>
                          <button
                            type="button"
                            onClick={() => handleApprove(sub)}
                            disabled={isApproving || decliningId === sub.id}
                            className="h-8 px-4 rounded-lg bg-green-600 text-white text-xs font-semibold hover:bg-green-700 disabled:opacity-50 flex items-center gap-1.5 transition-colors"
                          >
                            {isApproving ? (
                              <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2a10 10 0 1 0 10 10"/></svg>
                            ) : (
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                            )}
                            {isApproving ? 'Approving...' : 'Approve'}
                          </button>
                        </div>
                      </div>
                      {isExpanded && (() => {
                        const od = sub.order_data || {}
                        const docs = od.documents || {}
                        const sigs = od.signatures || {}
                        const licFront = docs.licenceFront?.dataUrl
                        const licBack = docs.licenceBack?.dataUrl
                        const carfaxInitial = od.carfax?.initialDataUrl
                        const carfaxTypedInitials = od.carfax?.typedInitials
                        const sigBoS = sigs.billOfSaleCustomer
                        const sigDG = sigs.dealerGuaranteeCustomer
                        return (
                          <div className="border-t border-slate-100 px-5 py-4 bg-slate-50 text-sm space-y-5">
                            {/* Core details */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2">
                              <div><span className="text-slate-500 font-medium">VIN:</span> <span className="text-slate-800">{sub.vehicle_vin || '—'}</span></div>
                              <div><span className="text-slate-500 font-medium">Stock #:</span> <span className="text-slate-800">{sub.vehicle_stock_number || '—'}</span></div>
                              <div><span className="text-slate-500 font-medium">Vehicle Price:</span> <span className="text-slate-800">${Number(sub.vehicle_price).toLocaleString('en-CA')}</span></div>
                              <div><span className="text-slate-500 font-medium">Total (incl. HST):</span> <span className="text-slate-800">${Number(sub.total_price).toLocaleString('en-CA')}</span></div>
                              <div><span className="text-slate-500 font-medium">Phone:</span> <span className="text-slate-800">{sub.customer_phone || '—'}</span></div>
                              <div><span className="text-slate-500 font-medium">Address:</span> <span className="text-slate-800">{[sub.customer_address, sub.customer_city, sub.customer_province, sub.customer_postal_code].filter(Boolean).join(', ') || '—'}</span></div>
                              {sub.warranty_name && <div><span className="text-slate-500 font-medium">Warranty:</span> <span className="text-slate-800">{sub.warranty_name} (${Number(sub.warranty_total).toLocaleString('en-CA')})</span></div>}
                              {sub.add_ons?.length > 0 && <div><span className="text-slate-500 font-medium">Add-ons:</span> <span className="text-slate-800">{sub.add_ons.join(', ')}</span></div>}
                              {od.customer?.dob && <div><span className="text-slate-500 font-medium">Date of Birth:</span> <span className="text-slate-800">{od.customer.dob}</span></div>}
                              {od.customer?.licenceNumber && <div><span className="text-slate-500 font-medium">Licence #:</span> <span className="text-slate-800">{od.customer.licenceNumber}</span></div>}
                              {od.customer?.licenceExpiry && <div><span className="text-slate-500 font-medium">Licence Expiry:</span> <span className="text-slate-800">{od.customer.licenceExpiry}</span></div>}
                            </div>

                            {/* Licence images */}
                            {(licFront || licBack) && (
                              <div>
                                <div className="text-slate-700 font-semibold mb-2">Driver's Licence</div>
                                <div className="flex flex-wrap gap-3">
                                  {licFront && (
                                    <div>
                                      <div className="text-xs text-slate-400 mb-1">Front</div>
                                      <img src={licFront} alt="Licence front" className="h-28 rounded-lg border border-slate-200 object-cover" />
                                    </div>
                                  )}
                                  {licBack && (
                                    <div>
                                      <div className="text-xs text-slate-400 mb-1">Back</div>
                                      <img src={licBack} alt="Licence back" className="h-28 rounded-lg border border-slate-200 object-cover" />
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Signatures */}
                            {(carfaxInitial || carfaxTypedInitials || sigBoS || sigDG) && (
                              <div>
                                <div className="text-slate-700 font-semibold mb-2">Signatures &amp; Initials</div>
                                <div className="flex flex-wrap gap-6">
                                  {(carfaxInitial || carfaxTypedInitials) && (
                                    <div>
                                      <div className="text-xs text-slate-400 mb-1">CARFAX</div>
                                      {carfaxInitial
                                        ? <img src={carfaxInitial} alt="CARFAX initials" className="h-14 rounded border border-slate-200 bg-white object-contain px-2" />
                                        : <div className="flex items-center justify-center h-14 rounded border border-slate-200 bg-white px-4" style={{ fontFamily: '"Brush Script MT","Segoe Script",cursive', fontSize: '1.4rem', color: '#1e293b' }}>{carfaxTypedInitials}</div>
                                      }
                                      {od.carfax?.acknowledgedAt && (
                                        <div className="text-xs text-slate-400 mt-1">{new Date(od.carfax.acknowledgedAt).toLocaleString('en-CA', { dateStyle: 'medium', timeStyle: 'short' })}</div>
                                      )}
                                    </div>
                                  )}
                                  {sigBoS && (
                                    <div>
                                      <div className="text-xs text-slate-400 mb-1">Bill of Sale</div>
                                      {sigBoS.drawnDataUrl
                                        ? <img src={sigBoS.drawnDataUrl} alt="Bill of Sale signature" className="h-14 rounded border border-slate-200 bg-white object-contain px-2" />
                                        : <div className="text-slate-700 italic text-sm border border-slate-200 rounded px-3 py-1 bg-white">{sigBoS.typedName}</div>
                                      }
                                      <div className="text-xs text-slate-400 mt-1">{sigBoS.signedAt ? new Date(sigBoS.signedAt).toLocaleString('en-CA', { dateStyle: 'medium', timeStyle: 'short' }) : ''}</div>
                                    </div>
                                  )}
                                  {sigDG && (
                                    <div>
                                      <div className="text-xs text-slate-400 mb-1">Dealer Guarantee</div>
                                      {sigDG.drawnDataUrl
                                        ? <img src={sigDG.drawnDataUrl} alt="Dealer guarantee signature" className="h-14 rounded border border-slate-200 bg-white object-contain px-2" />
                                        : <div className="text-slate-700 italic text-sm border border-slate-200 rounded px-3 py-1 bg-white">{sigDG.typedName}</div>
                                      }
                                      <div className="text-xs text-slate-400 mt-1">{sigDG.signedAt ? new Date(sigDG.signedAt).toLocaleString('en-CA', { dateStyle: 'medium', timeStyle: 'short' }) : ''}</div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      })()}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Decline Confirmation Modal */}
        {declineTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="edc-card w-full max-w-md p-6 shadow-premium">
              <div className="flex items-start gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0 mt-0.5">
                  <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </div>
                <div>
                  <div className="text-base font-bold text-slate-900 mb-0.5">Decline Submission</div>
                  <div className="text-sm text-slate-500">
                    {[declineTarget.vehicle_year, declineTarget.vehicle_make, declineTarget.vehicle_model].filter(Boolean).join(' ')} &mdash; {[declineTarget.customer_first_name, declineTarget.customer_last_name].filter(Boolean).join(' ')}
                  </div>
                </div>
              </div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Reason <span className="text-slate-400 font-normal">(optional — sent to customer)</span>
              </label>
              <textarea
                value={declineReason}
                onChange={(e) => setDeclineReason(e.target.value)}
                rows={3}
                placeholder="e.g. Deposit not received within the required timeframe."
                className="edc-input resize-none text-sm"
              />
              <div className="flex justify-end gap-2 mt-4">
                <button
                  type="button"
                  onClick={() => { setDeclineTarget(null); setDeclineReason('') }}
                  className="h-9 px-4 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDecline}
                  disabled={decliningId === declineTarget.id}
                  className="h-9 px-4 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-50 flex items-center gap-1.5 transition-colors"
                >
                  {decliningId === declineTarget.id ? (
                    <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2a10 10 0 1 0 10 10"/></svg>
                  ) : null}
                  {decliningId === declineTarget.id ? 'Declining...' : 'Confirm Decline'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Active Web Deals Section */}
        {(activeWebDealsLoading || activeWebDeals.length > 0) && (
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-3">
              <h2 className="text-base font-bold text-slate-900">Active Web Deals</h2>
              {activeWebDeals.length > 0 && (
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-600 text-white text-xs font-bold">{activeWebDeals.length}</span>
              )}
            </div>
            {activeWebDealsLoading ? (
              <div className="edc-card p-6 text-sm text-slate-400">Loading active deals...</div>
            ) : (
              <div className="space-y-3">
                {activeWebDeals.map((sub) => {
                  const vehicleLabel = [sub.vehicle_year, sub.vehicle_make, sub.vehicle_model, sub.vehicle_trim].filter(Boolean).join(' ')
                  const customerName = [sub.customer_first_name, sub.customer_last_name].filter(Boolean).join(' ')
                  const currentStage = sub.deal_stage || 'insurance_pending'
                  const currentIdx = STAGE_ORDER.indexOf(currentStage)
                  const isAdvancing = stagingId === sub.id
                  const canAdvance = currentIdx < STAGE_ORDER.length - 1
                  const isExpanded = expandedWebDeal === sub.id
                  return (
                    <div key={sub.id} className="edc-card overflow-hidden">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-4 px-5 py-4">
                        {/* Left: vehicle / customer */}
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-slate-900 truncate">{vehicleLabel}</div>
                            <div className="text-xs text-slate-500 truncate">{customerName} &middot; {sub.deal_id || '—'}</div>
                            <div className="text-xs text-slate-400 mt-0.5">Approved {sub.approved_at ? new Date(sub.approved_at).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}</div>
                          </div>
                        </div>
                        {/* Centre: stage pills */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {STAGE_ORDER.map((stage, idx) => {
                            const isPast = idx < currentIdx
                            const isCurrent = idx === currentIdx
                            return (
                              <span
                                key={stage}
                                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${
                                  isPast
                                    ? 'bg-green-100 text-green-700'
                                    : isCurrent
                                    ? 'bg-amber-100 text-amber-700'
                                    : 'bg-slate-100 text-slate-400'
                                }`}
                              >
                                {isPast && (
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                                )}
                                {STAGE_LABELS[stage]}
                              </span>
                            )
                          })}
                        </div>
                        {/* Right: actions */}
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => setExpandedWebDeal(isExpanded ? null : sub.id)}
                            className="h-8 px-3 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                          >
                            {isExpanded ? 'Hide' : 'Details'}
                          </button>
                          {canAdvance && (
                            <button
                              type="button"
                              onClick={() => handleAdvanceStage(sub)}
                              disabled={isAdvancing}
                              className="h-8 px-4 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1.5 transition-colors"
                            >
                              {isAdvancing ? (
                                <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2a10 10 0 1 0 10 10"/></svg>
                              ) : (
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                              )}
                              {isAdvancing ? 'Updating...' : `Move to ${STAGE_LABELS[STAGE_ORDER[currentIdx + 1]]}`}
                            </button>
                          )}
                        </div>
                      </div>
                      {isExpanded && (() => {
                        const od = sub.order_data || {}
                        return (
                          <div className="border-t border-slate-100 px-5 py-4 bg-slate-50 text-sm space-y-3">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2">
                              <div><span className="text-slate-500 font-medium">VIN:</span> <span className="text-slate-800">{sub.vehicle_vin || '—'}</span></div>
                              <div><span className="text-slate-500 font-medium">Deal ID:</span> <span className="text-slate-800">{sub.deal_id || '—'}</span></div>
                              <div><span className="text-slate-500 font-medium">Phone:</span> <span className="text-slate-800">{sub.customer_phone || '—'}</span></div>
                              <div><span className="text-slate-500 font-medium">Email:</span> <span className="text-slate-800">{sub.customer_email || '—'}</span></div>
                              <div><span className="text-slate-500 font-medium">Total:</span> <span className="text-slate-800">${Number(sub.total_price).toLocaleString('en-CA')}</span></div>
                              {sub.warranty_name && <div><span className="text-slate-500 font-medium">Warranty:</span> <span className="text-slate-800">{sub.warranty_name}</span></div>}
                            </div>
                          </div>
                        )
                      })()}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

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
