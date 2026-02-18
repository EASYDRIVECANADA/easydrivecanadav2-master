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

  const [query, setQuery] = useState('')
  const [pageSize, setPageSize] = useState(10)
  const [page, setPage] = useState(1)

  const [confirmOpen, setConfirmOpen] = useState(false)
  const confirmActionRef = useRef<null | (() => Promise<void>)>(null)
  const [confirmLoading, setConfirmLoading] = useState(false)
  const [confirmTitle, setConfirmTitle] = useState('')
  const [confirmMessage, setConfirmMessage] = useState('')

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
    }
    void load()
  }, [getLoggedInAdminDbUserId])

  const fetchRows = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      if (!scopedUserId) {
        setRows([])
        return
      }
      const { data, error: dbError } = await supabase
        .from('edc_vendors')
        .select('id, vendor_name, phone, mobile, email')
        .eq('user_id', scopedUserId)
        .order('vendor_name', { ascending: true })
        .limit(1000)

      if (dbError) throw dbError
      setRows(Array.isArray(data) ? (data as any) : [])
    } catch (e: any) {
      setError(e?.message || 'Failed to load vendors')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [scopedUserId])

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
    }
    setConfirmOpen(true)
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

  return (
    <div className={compact ? 'w-full' : 'w-full px-4 sm:px-6 lg:px-8 py-6'}>
      <div className={compact ? 'bg-white rounded-xl shadow p-4' : 'bg-white rounded-xl shadow p-6'}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search"
              className="h-9 w-72 max-w-full rounded border border-gray-200 px-3 text-sm outline-none focus:ring-2 focus:ring-[#118df0]/40"
            />
            <button
              type="button"
              onClick={openAdd}
              className="inline-flex h-9 w-9 items-center justify-center rounded border border-green-200 bg-green-50 text-green-700 hover:bg-green-100"
              title="Add Vendor"
              aria-label="Add Vendor"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value) || 10)}
              className="h-9 rounded border border-gray-200 bg-white px-2 text-sm outline-none"
              aria-label="Rows per page"
              title="Rows per page"
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        </div>

        {error ? <div className="mt-3 text-sm text-red-600">{error}</div> : null}

        <div className="mt-4 overflow-hidden rounded border border-gray-200">
          <table className="w-full table-auto text-sm">
            <thead className="bg-gray-50 text-gray-700">
              <tr>
                <th className="w-10 px-3 py-3 text-left font-semibold"></th>
                <th className="w-10 px-2 py-3 text-left font-semibold"></th>
                <th className="px-3 py-3 text-left font-semibold">NAME</th>
                <th className="w-52 px-3 py-3 text-left font-semibold">PHONE</th>
                <th className="w-52 px-3 py-3 text-left font-semibold">MOBILE</th>
                <th className="w-72 px-3 py-3 text-left font-semibold">EMAIL</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td className="px-4 py-4 text-gray-600" colSpan={6}>Loading…</td>
                </tr>
              ) : paged.length === 0 ? (
                <tr>
                  <td className="px-4 py-4 text-gray-600" colSpan={6}>No records found.</td>
                </tr>
              ) : (
                paged.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() => openEdit(r)}
                        className="text-gray-500 hover:text-gray-800"
                        title="Edit"
                        aria-label="Edit"
                      >
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 3.5a2.121 2.121 0 113 3L7 19l-4 1 1-4 12.5-12.5z" />
                        </svg>
                      </button>
                    </td>
                    <td className="px-2 py-2">
                      <button
                        type="button"
                        onClick={() => confirmDelete(r)}
                        className="text-red-500 hover:text-red-700"
                        title="Delete"
                        aria-label="Delete"
                      >
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 6h18" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8 6V4h8v2" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 6l-1 14H6L5 6" />
                        </svg>
                      </button>
                    </td>
                    <td className="px-3 py-2">{r.vendor_name || ''}</td>
                    <td className="px-3 py-2 text-[#118df0]">{r.phone || ''}</td>
                    <td className="px-3 py-2 text-[#118df0]">{r.mobile || ''}</td>
                    <td className="px-3 py-2">{r.email || ''}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-3 flex items-center justify-between text-xs text-gray-600">
          <div>
            {filtered.length > 0 ? `Page ${safePage} of ${totalPages}` : ''}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage <= 1}
              className="rounded border border-gray-200 px-2 py-1 disabled:opacity-50"
            >
              {'<'}
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage >= totalPages}
              className="rounded border border-gray-200 px-2 py-1 disabled:opacity-50"
            >
              {'>'}
            </button>
          </div>
        </div>
      </div>

      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg bg-white shadow-lg">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="text-sm font-semibold text-gray-900">{confirmTitle}</div>
            </div>
            <div className="px-6 py-4 text-sm text-gray-700">{confirmMessage}</div>
            <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                disabled={confirmLoading}
                className="h-10 px-4 rounded bg-gray-100 text-gray-700 text-sm font-semibold hover:bg-gray-200 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void runConfirm()}
                disabled={confirmLoading}
                className="h-10 px-4 rounded bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-60"
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
