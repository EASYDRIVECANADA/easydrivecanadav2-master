'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

type AdminUserRow = {
  id: string
  email: string
  role: string
  is_active: boolean
  created_at: string
}

const toTitle = (s: string) => {
  const cleaned = (s || '').replace(/[_\-.]+/g, ' ').replace(/\s+/g, ' ').trim()
  if (!cleaned) return ''
  return cleaned
    .split(' ')
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ')
}

const deriveNameFromEmail = (email: string) => {
  const local = (email || '').split('@')[0] || ''
  if (!local) return ''
  return toTitle(local)
}

const deriveTitleFromRole = (role: string) => {
  const r = (role || '').toUpperCase()
  if (r === 'ADMIN') return 'Owner'
  if (r === 'STAFF') return 'General Manager'
  return toTitle(role)
}

export default function SettingsUsersPage() {
  const router = useRouter()
  const [rows, setRows] = useState<AdminUserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [pageSize, setPageSize] = useState(5)

  useEffect(() => {
    const run = async () => {
      setLoading(true)
      try {
        const { data, error } = await supabase
          .from('edc_admin_users')
          .select('id, email, role, is_active, created_at')
          .order('created_at', { ascending: true })

        if (error) throw error
        setRows((data as any as AdminUserRow[]) || [])
      } catch {
        setRows([])
      } finally {
        setLoading(false)
      }
    }

    void run()
  }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((r) => {
      const name = deriveNameFromEmail(r.email)
      const title = deriveTitleFromRole(r.role)
      return (
        r.email.toLowerCase().includes(q) ||
        name.toLowerCase().includes(q) ||
        title.toLowerCase().includes(q)
      )
    })
  }, [rows, search])

  const visible = useMemo(() => filtered.slice(0, pageSize), [filtered, pageSize])

  const handleDelete = async (id: string, email: string) => {
    if (!confirm(`Delete user ${email}? This cannot be undone.`)) return
    try {
      const { error } = await supabase.from('edc_admin_users').delete().eq('id', id)
      if (error) return
      setRows((prev) => prev.filter((r) => r.id !== id))
    } catch {
      // ignore
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-4 py-2">
        <button
          type="button"
          className="h-7 w-7 flex items-center justify-center text-[#118df0]"
          title="Add user"
          onClick={() => router.push('/admin/users')}
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
            <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M8.5 11a4 4 0 100-8 4 4 0 000 8z" />
            <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M20 8v6" />
            <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M17 11h6" />
          </svg>
        </button>

        <div className="flex-1 flex items-center gap-2">
          <div className="relative w-full max-w-[360px]">
            <div className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500">
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35" />
                <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M11 19a8 8 0 110-16 8 8 0 010 16z" />
              </svg>
            </div>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="search"
              className="h-7 w-full border border-gray-300 pl-7 pr-2 text-xs"
            />
          </div>
        </div>

        <select
          className="h-7 border border-gray-300 px-2 text-xs bg-white"
          value={pageSize}
          onChange={(e) => setPageSize(parseInt(e.target.value, 10))}
        >
          <option value={5}>5</option>
          <option value={10}>10</option>
          <option value={20}>20</option>
        </select>
      </div>

      <div className="mt-2 border border-gray-200">
        <div className="grid grid-cols-[48px_1fr_1fr_1fr] gap-0 border-b border-gray-200 bg-white">
          <div className="h-8" />
          <div className="h-8 flex items-center text-[11px] font-semibold text-gray-700">Name</div>
          <div className="h-8 flex items-center text-[11px] font-semibold text-gray-700">Email</div>
          <div className="h-8 flex items-center text-[11px] font-semibold text-gray-700">Title</div>
        </div>

        {loading ? (
          <div className="p-6 text-xs text-gray-500">Loading…</div>
        ) : visible.length === 0 ? (
          <div className="p-6 text-xs text-gray-500">No users found.</div>
        ) : (
          <div>
            {visible.map((r) => {
              const name = deriveNameFromEmail(r.email)
              const title = deriveTitleFromRole(r.role)
              return (
                <div key={r.id} className="grid grid-cols-[48px_1fr_1fr_1fr] border-b border-gray-100">
                  <div className="h-10 flex items-center gap-2 px-2">
                    <button
                      type="button"
                      className="h-6 w-6 flex items-center justify-center text-gray-500 hover:text-gray-800"
                      title="Edit"
                      onClick={() => router.push('/admin/users')}
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M12 20h9" />
                        <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4 12.5-12.5z" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      className="h-6 w-6 flex items-center justify-center text-red-600 hover:text-red-700"
                      title="Delete"
                      onClick={() => void handleDelete(r.id, r.email)}
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M3 6h18" />
                        <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M8 6V4h8v2" />
                        <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M19 6l-1 14H6L5 6" />
                      </svg>
                    </button>
                  </div>
                  <div className="h-10 flex items-center text-xs text-gray-800">{name}</div>
                  <div className="h-10 flex items-center text-xs text-gray-800">{r.email}</div>
                  <div className="h-10 flex items-center text-xs text-gray-800">{title}</div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between pt-8">
        <button type="button" className="h-8 px-3 bg-gray-600 text-white text-xs font-semibold">
          <span className="inline-flex items-center gap-2">
            <span className="text-sm leading-none">×</span>
            Cancel
          </span>
        </button>
        <button type="button" className="h-8 px-4 bg-[#118df0] text-white text-xs font-semibold">
          <span className="inline-flex items-center gap-2">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" />
              <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M17 21v-8H7v8" />
              <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M7 3v5h8" />
            </svg>
            Save
          </span>
        </button>
      </div>
    </div>
  )
}
