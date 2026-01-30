'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

type AdminSession = {
  email?: string
  role?: string
}

type AdminUserRow = {
  email: string
  role: string
  is_active: boolean
  created_at: string
  updated_at: string
}

type VerificationRow = {
  id: string
  email: string
  full_name: string
  address: string
  license_number: string
  created_at: string
}

export default function AdminAccountPage() {
  const router = useRouter()
  const [session, setSession] = useState<AdminSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [adminUser, setAdminUser] = useState<AdminUserRow | null>(null)
  const [verification, setVerification] = useState<VerificationRow | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return

    const raw = window.localStorage.getItem('edc_admin_session')
    if (!raw) {
      router.replace('/admin')
      return
    }

    try {
      const parsed = JSON.parse(raw) as AdminSession
      if (!parsed?.email) {
        router.replace('/admin')
        return
      }
      setSession(parsed)
    } catch {
      router.replace('/admin')
    }
  }, [router])

  useEffect(() => {
    const email = session?.email?.trim().toLowerCase()
    if (!email) return

    const run = async () => {
      setLoading(true)
      setError('')
      try {
        const [{ data: adminData, error: adminErr }, { data: verifyData, error: verifyErr }] = await Promise.all([
          supabase
            .from('edc_admin_users')
            .select('email, role, is_active, created_at, updated_at')
            .eq('email', email)
            .limit(1)
            .maybeSingle(),
          supabase
            .from('edc_account_verifications')
            .select('id, email, full_name, address, license_number, created_at')
            .eq('email', email)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle(),
        ])

        if (adminErr) throw adminErr
        if (verifyErr) throw verifyErr

        setAdminUser(adminData ? (adminData as AdminUserRow) : null)
        setVerification(verifyData ? (verifyData as VerificationRow) : null)
      } catch (e: any) {
        setError(e?.message || 'Failed to load account settings')
      } finally {
        setLoading(false)
      }
    }

    void run()
  }, [session])

  const displayRole = useMemo(() => {
    const r = (session?.role || adminUser?.role || '').toString().trim()
    return r || 'STAFF'
  }, [adminUser?.role, session?.role])

  const isFromVerification = !!verification

  const displayRoleLabel = useMemo(() => {
    if (!isFromVerification && displayRole === 'STAFF') return `NOT VALIDATED ${displayRole}`
    return displayRole
  }, [displayRole, isFromVerification])

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="w-full px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Account Settings</h1>
            <p className="text-sm text-gray-600 mt-1">Manage your admin session and verification details.</p>
          </div>
          <button
            type="button"
            onClick={() => router.push('/admin')}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-white border border-gray-200 hover:bg-gray-50"
          >
            Back to Dashboard
          </button>
        </div>

        <div className="mt-6 max-w-3xl">
          {error ? (
            <div className="p-4 rounded-xl border border-red-200 bg-red-50 text-red-700 text-sm">{error}</div>
          ) : null}

          <div className="mt-4 bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <div className="text-sm font-semibold text-gray-900">Profile</div>
                <div className="mt-1 text-xs text-gray-600">Signed in as</div>
                <div className="mt-1 text-sm font-medium text-gray-900 break-all">{session?.email || '—'}</div>
              </div>
              <div className="flex flex-col items-start sm:items-end gap-2">
                <span
                  className={
                    displayRole === 'ADMIN'
                      ? 'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-800'
                      : 'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800'
                  }
                >
                  {displayRoleLabel}
                </span>
                <span
                  className={
                    isFromVerification
                      ? 'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800'
                      : 'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-800'
                  }
                >
                  {isFromVerification ? 'Verified via Gmail' : 'Access-code account'}
                </span>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full name</label>
                <input
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 bg-gray-50 text-gray-800"
                  value={verification?.full_name || ''}
                  disabled
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                <input
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 bg-gray-50 text-gray-800"
                  value={verification?.address || ''}
                  disabled
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Driver license number</label>
                <input
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 bg-gray-50 text-gray-800"
                  value={verification?.license_number || ''}
                  disabled
                />
              </div>
            </div>

            <div className="mt-6 flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={() => router.push('/account')}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-white border border-gray-200 hover:bg-gray-50"
              >
                Open Customer Account Page
              </button>
              <button
                type="button"
                onClick={() => router.push('/account/verification')}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-white border border-gray-200 hover:bg-gray-50"
              >
                Validate ID
              </button>
              <button
                type="button"
                onClick={() => router.push('/admin/users')}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-white border border-gray-200 hover:bg-gray-50"
              >
                Manage Users
              </button>
            </div>

            {loading ? (
              <div className="mt-4 text-sm text-gray-500">Loading…</div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
