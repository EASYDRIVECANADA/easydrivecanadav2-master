'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

type VendorRow = {
  id: string
  vendor_name: string | null
  phone: string | null
  mobile: string | null
  email: string | null
}

export default function VendorsList({ compact }: { compact?: boolean }) {
  const router = useRouter()
  const [rows, setRows] = useState<VendorRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [scopedUserId, setScopedUserId] = useState<string | null>(null)
  const [isAdminRole, setIsAdminRole] = useState(false)

  const [query, setQuery] = useState('')
  const [pageSize, setPageSize] = useState(10)
  const [page, setPage] = useState(1)

  const [confirmOpen, setConfirmOpen] = useState(false)
  const confirmActionRef = useRef<null | (() => Promise<void>)>(null)
  const [confirmLoading, setConfirmLoading] = useState(false)
  const [confirmTitle, setConfirmTitle] = useState('')
  const [confirmMessage, setConfirmMessage] = useState('')

  const [checked, setChecked] = useState<Record<string, boolean>>({})
  const [checkedAll, setCheckedAll] = useState(false)

  const getLoggedInAdminDbUserId = useCallback(async (): Promise<string | null> => {
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

  useEffect(() => {
    const load = async () => {
      const id = await getLoggedInAdminDbUserId()
      setScopedUserId(id)

      try {
        const raw = typeof window !== 'undefined' ? window.localStorage.getItem('edc_admin_session') : null
        const parsed = raw ? (JSON.parse(raw) as any) : null
        const email = String(parsed?.email || '').trim().toLowerCase()
        const uid = String(parsed?.user_id || '').trim()

        const { data: byId } = uid
          ? await supabase.from('users').select('role').eq('user_id', uid).maybeSingle()
          : ({ data: null } as any)
        const { data: byEmail } = !byId?.role && email
          ? await supabase.from('users').select('role').eq('email', email).maybeSingle()
          : ({ data: null } as any)

        const r = String((byId as any)?.role ?? (byEmail as any)?.role ?? '').trim().toLowerCase()
        setIsAdminRole(r === 'admin')
      } catch {
        setIsAdminRole(false)
      }
    }
    void load()
  }, [getLoggedInAdminDbUserId])

  const fetchRows = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      let q = supabase
        .from('edc_vendors')
        .select('id, vendor_name, phone, mobile, email')
        .order('vendor_name', { ascending: true })
        .limit(1000)

      if (!isAdminRole) {
        if (!scopedUserId) {
          setRows([])
          return
        }
        q = q.eq('user_id', scopedUserId)
      }

      const { data, error: dbError } = await q

      if (dbError) throw dbError
      setRows(Array.isArray(data) ? (data as any) : [])
    } catch (e: any) {
      setError(e?.message || 'Failed to load vendors')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [isAdminRole, scopedUserId])

  useEffect(() => {
    void fetchRows()
  }, [fetchRows])

  useEffect(() => {
    setPage(1)
  }, [query, pageSize])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((r) => {
      const h = [r.vendor_name, r.phone, r.mobile, r.email].filter(Boolean).join(' ').toLowerCase()
      return h.includes(q)
    })
  }, [rows, query])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const paged = filtered.slice((safePage - 1) * pageSize, safePage * pageSize)

  const openAdd = () => {
    router.push('/admin/vendors/new')
  }

  const openEdit = (row: VendorRow) => {
    router.push(`/admin/vendors/new?id=${encodeURIComponent(row.id)}`)
  }

  const confirmDelete = (row: VendorRow) => {
    setConfirmTitle('Delete Vendor')
    setConfirmMessage(`Are you sure you want to delete "${row.vendor_name || ''}"?`)
    confirmActionRef.current = async () => {
      const { error: delErr } = await supabase.from('edc_vendors').delete().eq('id', row.id)
      if (delErr) throw delErr
      await fetchRows()
      setChecked((prev) => { const next = { ...prev }; delete next[row.id]; return next })
    }
    setConfirmOpen(true)
  }

  const confirmBulkDelete = () => {
    const ids = Object.keys(checked).filter((k) => checked[k])
    if (!ids.length) return
    setConfirmTitle('Delete Vendors')
    setConfirmMessage(`Are you sure you want to delete ${ids.length} vendor${ids.length > 1 ? 's' : ''}?`)
    confirmActionRef.current = async () => {
      const { error: delErr } = await supabase.from('edc_vendors').delete().in('id', ids)
      if (delErr) throw delErr
      await fetchRows()
      setChecked({})
      setCheckedAll(false)
    }
    setConfirmOpen(true)
  }

  const toggleAll = (next: boolean) => {
    setCheckedAll(next)
    if (!next) { setChecked({}); return }
    const nextChecked: Record<string, boolean> = {}
    for (const r of paged) nextChecked[r.id] = true
    setChecked(nextChecked)
  }

  const runConfirm = async () => {
    const fn = confirmActionRef.current
    if (!fn) return
    setConfirmLoading(true)
    try {
      await fn()
      setConfirmOpen(false)
    } catch (e: any) {
      alert(e?.message || 'Action failed')
    } finally {
      setConfirmLoading(false)
    }
  }

  const anyChecked = Object.values(checked).some(Boolean)
  const checkedCount = Object.values(checked).filter(Boolean).length

  return (
    <div className="w-full">
      {/* Page header */}
      <div className="px-6 lg:px-8 py-6 flex flex-col gap-4 border-b border-slate-200 bg-white sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#0B1F3A]">Vendors</h1>
          <p className="mt-0.5 text-sm text-slate-500">{rows.length} active vendor{rows.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center gap-3">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search vendors..."
            className="h-10 w-64 max-w-full pl-4 pr-4 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1EA7FF]/30 focus:border-[#1EA7FF]/40 transition-all"
          />
          {anyChecked ? (
            <button
              type="button"
              onClick={confirmBulkDelete}
              className="inline-flex h-10 items-center gap-2 px-4 rounded-full bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-colors"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 11v6m4-6v6" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6m2 0H7m2 0V5a2 2 0 012-2h2a2 2 0 012 2v2" />
              </svg>
              Delete ({checkedCount})
            </button>
          ) : (
            <button
              type="button"
              onClick={openAdd}
              className="inline-flex h-10 items-center gap-2 px-4 rounded-full bg-[#0B1F3A] text-white text-sm font-semibold hover:bg-[#1EA7FF] transition-colors"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Add vendor
            </button>
          )}
        </div>
      </div>

      {/* Card grid */}
      <div className="p-6 lg:p-8">
        {error ? <div className="mb-4 text-sm text-red-600">{error}</div> : null}

        {loading ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-slate-200 bg-white p-5 animate-pulse">
                <div className="h-4 w-40 rounded bg-slate-200" />
                <div className="mt-1 h-3 w-20 rounded bg-slate-100" />
                <div className="mt-4 space-y-2">
                  <div className="h-3 w-32 rounded bg-slate-100" />
                  <div className="h-3 w-28 rounded bg-slate-100" />
                  <div className="h-3 w-36 rounded bg-slate-100" />
                </div>
              </div>
            ))}
          </div>
        ) : paged.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <svg className="h-10 w-10 mb-3 opacity-40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M1 21h22" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 21V9h6v12" />
            </svg>
            <p className="text-sm font-medium">No vendors found</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {paged.map((r) => (
              <div
                key={r.id}
                className="group rounded-2xl border border-slate-200 bg-white p-5 transition-shadow hover:shadow-md"
                style={{ boxShadow: '0 1px 3px rgba(0,0,0,.04)' }}
              >
                {/* Card header */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2 min-w-0">
                    <input
                      type="checkbox"
                      className="mt-0.5 h-4 w-4 shrink-0 accent-[#1EA7FF]"
                      checked={!!checked[r.id]}
                      onChange={(e) => setChecked((prev) => ({ ...prev, [r.id]: e.target.checked }))}
                      aria-label={`Select ${r.vendor_name || ''}`}
                    />
                    <div className="font-semibold text-[#0B1F3A] leading-snug truncate">
                      {r.vendor_name || <span className="text-slate-400 italic">Unnamed</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={() => openEdit(r)}
                      className="h-7 w-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-[#1EA7FF] hover:bg-slate-50 transition-colors"
                      title="Edit"
                      aria-label="Edit"
                    >
                      <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 3.5a2.121 2.121 0 113 3L7 19l-4 1 1-4 12.5-12.5z" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => confirmDelete(r)}
                      className="h-7 w-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                      title="Delete"
                      aria-label="Delete"
                    >
                      <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M10 11v6m4-6v6" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6m2 0H7m2 0V5a2 2 0 012-2h2a2 2 0 012 2v2" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Contact details */}
                <div className="mt-4 space-y-1 text-sm">
                  {r.phone ? (
                    <div className="text-slate-700">{r.phone}</div>
                  ) : null}
                  {r.mobile ? (
                    <div className="text-slate-500">{r.mobile}</div>
                  ) : null}
                  {r.email ? (
                    <div className="text-[#1EA7FF]">{r.email}</div>
                  ) : null}
                  {!r.phone && !r.mobile && !r.email ? (
                    <div className="text-slate-300 italic text-xs">No contact info</div>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-6 flex items-center justify-between text-xs text-slate-500">
            <div>Page {safePage} of {totalPages} &middot; {filtered.length} vendor{filtered.length !== 1 ? 's' : ''}</div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={safePage <= 1}
                className="h-8 px-3 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-40"
              >
                ← Prev
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage >= totalPages}
                className="h-8 px-3 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-40"
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Confirm modal */}
      {confirmOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onMouseDown={() => setConfirmOpen(false)} />
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md relative">
            <div className="px-6 py-4 border-b border-slate-100">
              <div className="text-sm font-semibold text-slate-800">{confirmTitle}</div>
            </div>
            <div className="px-6 py-4 text-sm text-slate-600">{confirmMessage}</div>
            <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                disabled={confirmLoading}
                className="h-10 px-4 rounded-lg bg-slate-100 text-slate-600 text-sm font-semibold hover:bg-slate-200 transition-colors disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void runConfirm()}
                disabled={confirmLoading}
                className="h-10 px-4 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-colors disabled:opacity-60"
              >
                {confirmLoading ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
