'use client'

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

type LineItem = { name: string; description?: string; cost?: number; price?: number; amount?: number }

type AdjustorRow = {
  id: string
  dealId: string
  name: string
  vehicle: string
  type: 'Cash' | 'Finance' | 'Lease'
  dealDateRaw: string
  dealDate: string
  closeDate: string
  closeDateRaw: string
  salesperson: string
  bankCommission: number
  status: 'Open' | 'Closed'
  worksheet: any
  fees: LineItem[]
  accessories: LineItem[]
  warranties: LineItem[]
  insurances: LineItem[]
}

export default function DealAdjustorPage() {
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [query, setQuery] = useState('')
  const [perPage, setPerPage] = useState('10')
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set())

  const [rows, setRows] = useState<AdjustorRow[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)

  const [editing, setEditing] = useState<{ rowId: string; field: string; feeIndex?: number } | null>(null)
  const [editValue, setEditValue] = useState<string>('')
  const [saving, setSaving] = useState(false)

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

  const toDateInputValue = (raw: string) => {
    const s = String(raw || '').trim()
    if (!s) return ''
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
    const ts = Date.parse(s)
    if (!Number.isFinite(ts)) return ''
    const dt = new Date(ts)
    const yyyy = dt.getFullYear()
    const mm = String(dt.getMonth() + 1).padStart(2, '0')
    const dd = String(dt.getDate()).padStart(2, '0')
    return `${yyyy}-${mm}-${dd}`
  }

  const startEdit = (rowId: string, field: string, initial: string, feeIndex?: number) => {
    setEditing({ rowId, field, feeIndex })
    setEditValue(initial)
  }

  const cancelEdit = () => {
    setEditing(null)
    setEditValue('')
  }

  const applyLocalUpdate = useCallback(
    (rowId: string, updater: (r: AdjustorRow) => AdjustorRow) => {
      setRows((prev) => prev.map((r) => (r.id === rowId ? updater(r) : r)))
    },
    []
  )

  const savePatch = useCallback(async (table: string, id: string, data: Record<string, any>) => {
    const res = await fetch('/api/deals/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ table, id, data }),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok || json?.error) throw new Error(json?.error || `Update failed (${res.status})`)
    return json
  }, [])

  const commitEdit = useCallback(async () => {
    if (!editing) return
    const { rowId, field, feeIndex } = editing
    const row = rows.find((r) => r.id === rowId)
    if (!row) return

    const value = editValue
    setSaving(true)
    try {
      if (field === 'dealDate') {
        const v = value ? value : null
        await savePatch('edc_deals_customers', row.dealId, { dealdate: v })
        applyLocalUpdate(rowId, (r) => ({
          ...r,
          dealDateRaw: String(v ?? ''),
          dealDate: formatDate(String(v ?? '')),
        }))
      } else if (field === 'closeDate') {
        const v = value ? value : null
        await savePatch('edc_deals_worksheet', row.dealId, { close_date: v })
        applyLocalUpdate(rowId, (r) => ({
          ...r,
          closeDateRaw: String(v ?? ''),
          closeDate: r.status === 'Closed' ? formatDate(String(v ?? '')) || 'N/A' : 'N/A',
          worksheet: { ...(r.worksheet || {}), close_date: v },
        }))
      } else if (field === 'bankCommission') {
        const n = Number(String(value || '').replace(/[^0-9.-]/g, ''))
        const v = Number.isFinite(n) ? n : 0
        await savePatch('edc_deals_worksheet', row.dealId, { bank_commission: v })
        applyLocalUpdate(rowId, (r) => ({
          ...r,
          bankCommission: v,
          worksheet: { ...(r.worksheet || {}), bank_commission: v },
        }))
      } else if (field === 'status') {
        const nextStatus: AdjustorRow['status'] = value === 'Closed' ? 'Closed' : 'Open'
        const nextState = nextStatus
        await savePatch('edc_deals_customers', row.dealId, { deal_state: nextState })

        applyLocalUpdate(rowId, (r) => ({
          ...r,
          status: nextStatus,
          closeDate: nextStatus === 'Closed' ? (formatDate(r.closeDateRaw) || 'N/A') : 'N/A',
        }))
      } else if (field === 'feeCost' || field === 'feePrice') {
        const idx = typeof feeIndex === 'number' ? feeIndex : 0
        const n = Number(String(value || '').replace(/[^0-9.-]/g, ''))
        const v = Number.isFinite(n) ? n : 0
        const prevFees = Array.isArray(row.fees) ? row.fees : []
        const nextFees = prevFees.map((f, i) => {
          if (i !== idx) return f
          if (field === 'feeCost') return { ...f, cost: v }
          return { ...f, price: v }
        })

        await savePatch('edc_deals_worksheet', row.dealId, {
          fees: nextFees.map((f) => ({
            name: f.name,
            desc: f.description ?? '',
            description: f.description ?? '',
            cost: Number(f.cost ?? 0),
            price: Number(f.price ?? 0),
          })),
        })

        applyLocalUpdate(rowId, (r) => ({
          ...r,
          fees: nextFees,
          worksheet: { ...(r.worksheet || {}), fees: nextFees },
        }))
      } else if (field === 'accPrice') {
        const idx = typeof feeIndex === 'number' ? feeIndex : 0
        const n = Number(String(value || '').replace(/[^0-9.-]/g, ''))
        const v = Number.isFinite(n) ? n : 0
        const prev = Array.isArray(row.accessories) ? row.accessories : []
        const next = prev.map((a, i) => (i === idx ? { ...a, price: v } : a))

        await savePatch('edc_deals_worksheet', row.dealId, {
          accessories: next.map((a) => ({
            name: a.name,
            desc: a.description ?? '',
            description: a.description ?? '',
            cost: Number(a.cost ?? 0),
            price: Number(a.price ?? 0),
          })),
        })

        applyLocalUpdate(rowId, (r) => ({
          ...r,
          accessories: next,
          worksheet: { ...(r.worksheet || {}), accessories: next },
        }))
      } else if (field === 'accCost') {
        const idx = typeof feeIndex === 'number' ? feeIndex : 0
        const n = Number(String(value || '').replace(/[^0-9.-]/g, ''))
        const v = Number.isFinite(n) ? n : 0
        const prev = Array.isArray(row.accessories) ? row.accessories : []
        const next = prev.map((a, i) => (i === idx ? { ...a, cost: v } : a))

        await savePatch('edc_deals_worksheet', row.dealId, {
          accessories: next.map((a) => ({
            name: a.name,
            desc: a.description ?? '',
            description: a.description ?? '',
            cost: Number(a.cost ?? 0),
            price: Number(a.price ?? 0),
          })),
        })

        applyLocalUpdate(rowId, (r) => ({
          ...r,
          accessories: next,
          worksheet: { ...(r.worksheet || {}), accessories: next },
        }))
      } else if (field === 'warAmount') {
        const idx = typeof feeIndex === 'number' ? feeIndex : 0
        const n = Number(String(value || '').replace(/[^0-9.-]/g, ''))
        const v = Number.isFinite(n) ? n : 0
        const prev = Array.isArray(row.warranties) ? row.warranties : []
        const next = prev.map((w, i) => (i === idx ? { ...w, amount: v } : w))

        await savePatch('edc_deals_worksheet', row.dealId, {
          warranties: next.map((w) => ({
            name: w.name,
            desc: w.description ?? '',
            description: w.description ?? '',
            amount: Number(w.amount ?? 0),
          })),
        })

        applyLocalUpdate(rowId, (r) => ({
          ...r,
          warranties: next,
          worksheet: { ...(r.worksheet || {}), warranties: next },
        }))
      } else if (field === 'insAmount') {
        const idx = typeof feeIndex === 'number' ? feeIndex : 0
        const n = Number(String(value || '').replace(/[^0-9.-]/g, ''))
        const v = Number.isFinite(n) ? n : 0
        const prev = Array.isArray(row.insurances) ? row.insurances : []
        const next = prev.map((ins, i) => (i === idx ? { ...ins, amount: v } : ins))

        await savePatch('edc_deals_worksheet', row.dealId, {
          insurances: next.map((ins) => ({
            name: ins.name,
            desc: ins.description ?? '',
            description: ins.description ?? '',
            amount: Number(ins.amount ?? 0),
          })),
        })

        applyLocalUpdate(rowId, (r) => ({
          ...r,
          insurances: next,
          worksheet: { ...(r.worksheet || {}), insurances: next },
        }))
      }

      cancelEdit()
    } catch (e: any) {
      alert(e?.message || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }, [applyLocalUpdate, cancelEdit, editValue, editing, formatDate, rows, savePatch])

  const fetchDeals = useCallback(async () => {
    try {
      setLoading(true)
      setFetchError(null)

      const scopedUserId = await getLoggedInUserId()
      if (!scopedUserId) {
        setRows([])
        return
      }

      const res = await fetch('/api/deals', { cache: 'no-store' })
      if (!res.ok) throw new Error(`Failed to fetch deals (${res.status})`)
      const json = await res.json()
      if (json.error) throw new Error(json.error)

      const dealsAll: any[] = Array.isArray(json.deals) ? json.deals : []
      const dealsScoped = dealsAll.filter((d: any) => String(d?.customer?.user_id ?? '').trim() === scopedUserId)

      const mapped: AdjustorRow[] = dealsScoped.map((d: any) => {
        const customer = d.customer || {}
        const vehicles = Array.isArray(d.vehicles) ? d.vehicles : []
        const firstVehicle = vehicles[0] || {}
        const worksheet = d.worksheet || {}

        const first = String(customer.firstname ?? customer.first_name ?? '').trim()
        const last = String(customer.lastname ?? customer.last_name ?? '').trim()
        const name = [first, last].filter(Boolean).join(' ') || String(d.primaryCustomer || '').trim()

        const stock = String(firstVehicle.selected_stock_number ?? '').trim()
        const vehicleText = String(d.vehicle || '').trim()
        const vehicle = stock ? `Stock#${stock} - ${vehicleText}` : vehicleText

        const typeRaw = String(d.type || worksheet.deal_type || customer.dealtype || '').trim()
        const type = typeRaw === 'Finance' || typeRaw === 'Lease' ? typeRaw : 'Cash'

        const state = String(d.state || '').trim()
        const status: AdjustorRow['status'] = state.toLowerCase() === 'closed' ? 'Closed' : 'Open'

        const dealDateRaw = String(d.dealDate || customer.dealdate || worksheet.deal_date || '').trim()
        const closeDateRaw = String(d.closeDate || worksheet.close_date || '').trim()
        const closeDate = status === 'Closed' ? formatDate(closeDateRaw) || 'N/A' : 'N/A'

        const salesperson = String(d.primarySalesperson || customer.salesperson || '').trim()

        const bankCommission =
          Number(worksheet.bank_commission ?? worksheet.bankCommission ?? customer.bank_commission ?? customer.bankCommission ?? 0) || 0

        const mapFees = (arr: any[]): LineItem[] =>
          arr.map((f: any) => ({
            name: String(f?.name ?? f?.title ?? 'Fee').trim() || 'Fee',
            description: String(f?.description ?? f?.desc ?? f?.fee_desc ?? f?.feeDesc ?? '').trim(),
            cost: Number(f?.cost ?? 0) || 0,
            price: Number(f?.price ?? f?.amount ?? 0) || 0,
          }))

        const mapAccessories = (arr: any[]): LineItem[] =>
          arr.map((a: any) => ({
            name: String(a?.name ?? a?.title ?? 'Accessory').trim() || 'Accessory',
            description: String(a?.description ?? a?.desc ?? a?.accessory_desc ?? a?.accessoryDesc ?? '').trim(),
            cost: Number(a?.cost ?? 0) || 0,
            price: Number(a?.price ?? a?.amount ?? 0) || 0,
          }))

        const mapWarranties = (arr: any[]): LineItem[] =>
          arr.map((w: any) => ({
            name: String(w?.name ?? w?.title ?? 'Warranty').trim() || 'Warranty',
            description: String(w?.description ?? w?.desc ?? w?.warranty_desc ?? w?.warrantyDesc ?? '').trim(),
            amount: Number(w?.amount ?? w?.price ?? 0) || 0,
          }))

        const mapInsurances = (arr: any[]): LineItem[] =>
          arr.map((i: any) => ({
            name: String(i?.name ?? i?.title ?? 'Insurance').trim() || 'Insurance',
            description: String(i?.description ?? i?.desc ?? i?.insurance_desc ?? i?.insuranceDesc ?? '').trim(),
            amount: Number(i?.amount ?? i?.price ?? 0) || 0,
          }))

        const feesRaw = Array.isArray(worksheet?.fees) ? worksheet.fees : []
        const fees: AdjustorRow['fees'] = feesRaw.length ? mapFees(feesRaw) : []

        const accessoriesRaw = Array.isArray(worksheet?.accessories) ? worksheet.accessories : []
        const accessories: AdjustorRow['accessories'] = accessoriesRaw.length ? mapAccessories(accessoriesRaw) : []

        const warrantiesRaw = Array.isArray(worksheet?.warranties) ? worksheet.warranties : []
        const warranties: AdjustorRow['warranties'] = warrantiesRaw.length ? mapWarranties(warrantiesRaw) : []

        const insurancesRaw = Array.isArray(worksheet?.insurances) ? worksheet.insurances : []
        const insurances: AdjustorRow['insurances'] = insurancesRaw.length ? mapInsurances(insurancesRaw) : []

        const dealId = String(d.dealId || d.id || '').trim()
        return {
          id: dealId || crypto.randomUUID(),
          dealId: dealId || crypto.randomUUID(),
          name,
          vehicle,
          type,
          dealDateRaw,
          dealDate: formatDate(dealDateRaw),
          closeDate,
          closeDateRaw,
          salesperson,
          bankCommission,
          status,
          worksheet,
          fees,
          accessories,
          warranties,
          insurances,
        }
      })

      setRows(mapped)
    } catch (e: any) {
      setFetchError(e?.message || 'Failed to load deals')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [getLoggedInUserId])

  useEffect(() => {
    fetchDeals()
  }, [fetchDeals])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const fromTs = from ? Date.parse(from) : NaN
    const toTs = to ? Date.parse(to) : NaN
    const fromOk = Number.isFinite(fromTs)
    const toOk = Number.isFinite(toTs)

    return rows.filter((r) => {
      if (String(r.status || '').toLowerCase() === 'closed') return false
      if (fromOk || toOk) {
        const rt = Date.parse(r.dealDateRaw)
        if (Number.isFinite(rt)) {
          if (fromOk && rt < fromTs) return false
          if (toOk && rt > toTs + 24 * 60 * 60 * 1000 - 1) return false
        }
      }
      if (!q) return true
      return (
        r.name.toLowerCase().includes(q) ||
        r.vehicle.toLowerCase().includes(q) ||
        r.salesperson.toLowerCase().includes(q) ||
        r.status.toLowerCase().includes(q)
      )
    })
  }, [from, query, rows, to])

  const totalDeals = filtered.length
  const totalCommission = filtered.reduce((sum, r) => sum + (Number.isFinite(r.bankCommission) ? r.bankCommission : 0), 0)

  return (
    <div className="min-h-screen">
      <div className="edc-page-header">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-slate-900">Deal Adjustor</h1>
          <div className="text-sm text-slate-500">
            Total: <span className="font-semibold text-slate-700">{totalDeals}</span>
          </div>
        </div>
      </div>

      <div className="px-6 py-6">
        <div className="edc-card p-4">
          <div className="flex flex-col xl:flex-row xl:items-end gap-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 flex-1">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">From</label>
                <input
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  className="edc-input"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">To</label>
                <input
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  className="edc-input"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Search</label>
                <div className="relative">
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search..."
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
            </div>

            <div className="flex items-center justify-between gap-3">
              <div className="text-sm text-slate-500 whitespace-nowrap">Bank Commission: <span className="font-semibold text-slate-700">${totalCommission.toFixed(2)}</span></div>
              <select
                value={perPage}
                onChange={(e) => setPerPage(e.target.value)}
                className="edc-input w-auto"
              >
                <option value="10">10</option>
                <option value="25">25</option>
                <option value="50">50</option>
              </select>
            </div>
          </div>

          <div className="mt-3 text-xs text-slate-400">Showing results from {from} to {to}</div>
        </div>

        {fetchError ? (
          <div className="mt-4 rounded-xl border border-danger-500/20 bg-danger-500/5 text-danger-600 px-4 py-3 text-sm">{fetchError}</div>
        ) : null}

        <div className="edc-card mt-4 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="edc-table">
              <thead>
                <tr>
                  <th className="w-12"></th>
                  <th>Name</th>
                  <th>Vehicle</th>
                  <th>Type</th>
                  <th>Deal Date</th>
                  <th>Close Date</th>
                  <th>Salesperson</th>
                  <th className="text-right">Bank Commission</th>
                  <th className="text-right">Status</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td className="px-6 py-10 text-center text-sm text-slate-400" colSpan={9}>
                      Loading deals...
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td className="px-6 py-10 text-center text-sm text-slate-400" colSpan={9}>
                      No results.
                    </td>
                  </tr>
                ) : (
                  filtered.slice(0, Number(perPage) || 10).map((r) => (
                  <Fragment key={r.id}>
                    <tr>
                      <td className="px-3 py-3">
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedIds((prev) => {
                              const next = new Set(prev)
                              if (next.has(r.id)) next.delete(r.id)
                              else next.add(r.id)
                              return next
                            })
                          }
                          className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors"
                          title="Fees"
                          aria-label="Fees"
                        >
                          <svg className="w-4 h-4 text-cyan-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M3 7a2 2 0 012-2h6l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"
                            />
                          </svg>
                        </button>
                      </td>
                      <td className="px-6 py-3 text-sm font-medium text-slate-800 whitespace-nowrap">{r.name}</td>
                      <td className="px-6 py-3 text-sm text-cyan-700 min-w-[420px]">{r.vehicle}</td>
                      <td className="px-6 py-3 text-sm text-slate-600 whitespace-nowrap">{r.type}</td>
                      <td className="px-6 py-3 text-sm whitespace-nowrap">
                        {editing?.rowId === r.id && editing.field === 'dealDate' ? (
                          <input
                            autoFocus
                            type="date"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={() => commitEdit()}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') commitEdit()
                              if (e.key === 'Escape') cancelEdit()
                            }}
                            className="h-8 border border-slate-200 rounded-lg px-2 text-sm focus:ring-1 focus:ring-cyan-500/30 focus:border-cyan-500/40"
                            disabled={saving}
                          />
                        ) : (
                          <button
                            type="button"
                            onClick={() => startEdit(r.id, 'dealDate', toDateInputValue(r.dealDateRaw))}
                            className="text-cyan-600 hover:text-cyan-700 hover:underline transition-colors"
                            title="Edit deal date"
                          >
                            {r.dealDate || 'N/A'}
                          </button>
                        )}
                      </td>

                      <td className="px-6 py-3 text-sm whitespace-nowrap">
                        {editing?.rowId === r.id && editing.field === 'closeDate' ? (
                          <input
                            autoFocus
                            type="date"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={() => commitEdit()}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') commitEdit()
                              if (e.key === 'Escape') cancelEdit()
                            }}
                            className="h-8 border border-slate-200 rounded-lg px-2 text-sm focus:ring-1 focus:ring-cyan-500/30 focus:border-cyan-500/40"
                            disabled={saving}
                          />
                        ) : (
                          <button
                            type="button"
                            onClick={() => startEdit(r.id, 'closeDate', toDateInputValue(r.closeDateRaw))}
                            className="text-cyan-600 hover:text-cyan-700 hover:underline transition-colors"
                            title="Edit close date"
                          >
                            {r.closeDate || 'N/A'}
                          </button>
                        )}
                      </td>
                      <td className="px-6 py-3 text-sm text-slate-600 whitespace-nowrap">{r.salesperson}</td>

                      <td className="px-6 py-3 text-sm whitespace-nowrap text-right">
                        {editing?.rowId === r.id && editing.field === 'bankCommission' ? (
                          <input
                            autoFocus
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={() => commitEdit()}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') commitEdit()
                              if (e.key === 'Escape') cancelEdit()
                            }}
                            className="h-8 w-28 border border-gray-200 rounded px-2 text-sm text-right"
                            disabled={saving}
                          />
                        ) : (
                          <button
                            type="button"
                            onClick={() => startEdit(r.id, 'bankCommission', String(r.bankCommission ?? 0))}
                            className="text-cyan-600 hover:text-cyan-700 hover:underline transition-colors"
                            title="Edit bank commission"
                          >
                            ${(Number(r.bankCommission) || 0).toFixed(2)}
                          </button>
                        )}
                      </td>

                      <td className="px-6 py-3 text-sm whitespace-nowrap text-right">
                        {editing?.rowId === r.id && editing.field === 'status' ? (
                          <select
                            autoFocus
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={() => commitEdit()}
                            className="h-8 border border-slate-200 rounded-lg px-2 text-sm focus:ring-1 focus:ring-cyan-500/30 focus:border-cyan-500/40"
                            disabled={saving}
                          >
                            <option value="Open">Open</option>
                            <option value="Closed">Closed</option>
                          </select>
                        ) : (
                          <button
                            type="button"
                            onClick={() => startEdit(r.id, 'status', r.status)}
                            className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold transition-colors ${
                              r.status === 'Open' ? 'bg-cyan-500/10 text-cyan-700' : 'bg-slate-100 text-slate-600'
                            }`}
                            title="Edit status"
                          >
                            {r.status}
                          </button>
                        )}
                      </td>
                    </tr>

                    {expandedIds.has(r.id) ? (
                      <tr className="bg-white">
                        <td colSpan={9} className="px-6 py-4">
                          {(() => {
                            const money = (n: number) => `$${(Number(n) || 0).toFixed(2)}`

                            const fees = Array.isArray(r.fees) ? r.fees : []
                            const accessories = Array.isArray(r.accessories) ? r.accessories : []
                            const warranties = Array.isArray(r.warranties) ? r.warranties : []
                            const insurances = Array.isArray(r.insurances) ? r.insurances : []

                            const merged: Array<{ kind: 'fee' | 'acc' | 'war' | 'ins'; idx: number; item: LineItem }> = [
                              ...fees.map((item, idx) => ({ kind: 'fee' as const, idx, item })),
                              ...accessories.map((item, idx) => ({ kind: 'acc' as const, idx, item })),
                              ...warranties.map((item, idx) => ({ kind: 'war' as const, idx, item })),
                              ...insurances.map((item, idx) => ({ kind: 'ins' as const, idx, item })),
                            ]

                            if (merged.length === 0) return null

                            return (
                              <div className="overflow-x-auto border border-slate-200/60 rounded-xl">
                                <table className="w-full">
                                  <thead className="bg-slate-50/80">
                                    <tr className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                                      <th className="px-4 py-2 text-left w-[25%]">Name</th>
                                      <th className="px-4 py-2 text-left w-[35%]">Description</th>
                                      <th className="px-4 py-2 text-right w-[20%]">Cost</th>
                                      <th className="px-4 py-2 text-right w-[20%]">Price</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {merged.map(({ kind, idx, item }, rowIdx) => {
                                      const costVal = kind === 'fee' || kind === 'acc' ? Number(item.cost) || 0 : 0
                                      const priceVal =
                                        kind === 'fee'
                                          ? Number(item.price) || 0
                                          : kind === 'acc'
                                            ? Number(item.price) || 0
                                            : Number(item.amount) || 0

                                      const priceField =
                                        kind === 'fee' ? 'feePrice' : kind === 'acc' ? 'accPrice' : kind === 'war' ? 'warAmount' : 'insAmount'

                                      const costField = kind === 'fee' ? 'feeCost' : kind === 'acc' ? 'accCost' : null

                                      const isEditingCost =
                                        Boolean(costField) && editing?.rowId === r.id && editing.field === costField && editing.feeIndex === idx
                                      const isEditingPrice = editing?.rowId === r.id && editing.field === priceField && editing.feeIndex === idx

                                      return (
                                        <tr key={`${r.id}_merged_${kind}_${rowIdx}`} className="text-sm border-t border-slate-100">
                                          <td className="px-4 py-3">{item.name || 'Item'}</td>
                                          <td className="px-4 py-3 text-slate-500">{item.description || ''}</td>
                                          <td className="px-4 py-3 text-right">
                                            {!costField ? (
                                              money(0)
                                            ) : isEditingCost ? (
                                              <input
                                                autoFocus
                                                value={editValue}
                                                onChange={(e) => setEditValue(e.target.value)}
                                                onBlur={() => commitEdit()}
                                                onKeyDown={(e) => {
                                                  if (e.key === 'Enter') commitEdit()
                                                  if (e.key === 'Escape') cancelEdit()
                                                }}
                                                className="h-8 w-24 border border-gray-200 rounded px-2 text-sm text-right"
                                                disabled={saving}
                                              />
                                            ) : (
                                              <button
                                                type="button"
                                                onClick={() => startEdit(r.id, costField, String(costVal), idx)}
                                                className="text-cyan-600 hover:text-cyan-700 hover:underline transition-colors"
                                              >
                                                {money(costVal)}
                                              </button>
                                            )}
                                          </td>
                                          <td className="px-4 py-3 text-right">
                                            {isEditingPrice ? (
                                              <input
                                                autoFocus
                                                value={editValue}
                                                onChange={(e) => setEditValue(e.target.value)}
                                                onBlur={() => commitEdit()}
                                                onKeyDown={(e) => {
                                                  if (e.key === 'Enter') commitEdit()
                                                  if (e.key === 'Escape') cancelEdit()
                                                }}
                                                className="h-8 w-24 border border-gray-200 rounded px-2 text-sm text-right"
                                                disabled={saving}
                                              />
                                            ) : (
                                              <button
                                                type="button"
                                                onClick={() => startEdit(r.id, priceField, String(priceVal), idx)}
                                                className="text-cyan-600 hover:text-cyan-700 hover:underline transition-colors"
                                              >
                                                {money(priceVal)}
                                              </button>
                                            )}
                                          </td>
                                        </tr>
                                      )
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            )
                          })()}
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
