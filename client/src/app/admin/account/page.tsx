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
  const [showManageAccount, setShowManageAccount] = useState(false)
  const [usersRow, setUsersRow] = useState<any | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [licenseFile, setLicenseFile] = useState<File | null>(null)
  const [licensePreviewUrl, setLicensePreviewUrl] = useState<string | null>(null)
  const [sendingLicense, setSendingLicense] = useState(false)
  const [licenseSendResult, setLicenseSendResult] = useState('')
  const [licenseSendError, setLicenseSendError] = useState('')

  const visibleUserFields = useMemo(
    () => [
      'first_name',
      'last_name',
      'title',
      'email',
      'phone',
      'mobile',
      'password',
    ],
    []
  )

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
        const [{ data: adminData, error: adminErr }, { data: verifyData, error: verifyErr }, { data: userData, error: userErr }] =
          await Promise.all([
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
          supabase.from('users').select('*').eq('email', email).limit(1).maybeSingle(),
        ])

        if (adminErr) throw adminErr
        if (verifyErr) throw verifyErr
        if (userErr) throw userErr

        setAdminUser(adminData ? (adminData as AdminUserRow) : null)
        setVerification(verifyData ? (verifyData as VerificationRow) : null)
        setUsersRow(userData ?? null)
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

  const sendLicenseForValidation = async () => {
    if (sendingLicense) return

    const email = String(session?.email || '').trim().toLowerCase()
    if (!email) {
      setLicenseSendError('Missing email')
      setLicenseSendResult('')
      return
    }

    if (!licenseFile) {
      setLicenseSendError('Please choose an image first')
      setLicenseSendResult('')
      return
    }

    setSendingLicense(true)
    setLicenseSendError('')
    setLicenseSendResult('')

    try {
      const form = new FormData()
      form.append('email', email)
      form.append('file', licenseFile)

      const res = await fetch('/api/validation', {
        method: 'POST',
        body: form,
      })

      const json = await res.json().catch(() => null)
      if (!res.ok) {
        const msg = String(json?.error || 'Request failed')
        setLicenseSendError(msg)
        setLicenseSendResult(String(json?.upstreamBody || ''))
        return
      }

      setLicenseSendResult(String(json?.upstreamBody || ''))
    } catch (e: any) {
      setLicenseSendError(e?.message || 'Request failed')
    } finally {
      setSendingLicense(false)
    }
  }

  useEffect(() => {
    if (!licenseFile) {
      if (licensePreviewUrl) URL.revokeObjectURL(licensePreviewUrl)
      setLicensePreviewUrl(null)
      return
    }

    const url = URL.createObjectURL(licenseFile)
    if (licensePreviewUrl) URL.revokeObjectURL(licensePreviewUrl)
    setLicensePreviewUrl(url)
    return () => {
      URL.revokeObjectURL(url)
    }
  }, [licenseFile])

  const displayRoleLabel = useMemo(() => {
    if (!isFromVerification && displayRole === 'STAFF') return `NOT VALIDATED ${displayRole}`
    return displayRole
  }, [displayRole, isFromVerification])

  return (
    <div className="min-h-screen">
      <div className="edc-page-header">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Account Settings</h1>
            <p className="text-sm text-slate-500 mt-1">Manage your admin session and verification details.</p>
          </div>
          <button
            type="button"
            onClick={() => router.push('/admin')}
            className="edc-btn-ghost text-sm"
          >
            Back to Dashboard
          </button>
        </div>
      </div>

      <div className="px-6 py-6">

        <div className="max-w-3xl">
          {error ? (
            <div className="p-4 rounded-xl border border-red-200 bg-red-50 text-danger-600 text-sm">{error}</div>
          ) : null}

          <div className="mt-4 edc-card p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <div className="text-sm font-semibold text-slate-800">Profile</div>
                <div className="mt-1 text-xs text-slate-500">Signed in as</div>
                <div className="mt-1 text-sm font-medium text-slate-800 break-all">{session?.email || '—'}</div>
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
                      : 'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700'
                  }
                >
                  {isFromVerification ? 'Verified via Gmail' : 'Access-code account'}
                </span>
              </div>
            </div>

            {!showManageAccount ? (
              isFromVerification ? (
                <div className="mt-6 grid grid-cols-1 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-600 mb-1">Full name</label>
                    <input
                      className="edc-input bg-slate-50"
                      value={verification?.full_name || ''}
                      disabled
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-600 mb-1">Address</label>
                    <input
                      className="edc-input bg-slate-50"
                      value={verification?.address || ''}
                      disabled
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-600 mb-1">Driver license number</label>
                    <input
                      className="edc-input bg-slate-50"
                      value={verification?.license_number || ''}
                      disabled
                    />
                  </div>
                </div>
              ) : (
                <div className="mt-6">
                  <div className="text-sm font-medium text-slate-700">Upload Image</div>
                  <div className="mt-2 text-xs text-slate-500">Upload a clear photo of your driver’s license.</div>

                  <div className="mt-4 flex items-center gap-2">
                    <input
                      type="file"
                      accept="image/*"
                      className="block w-full text-sm text-slate-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200"
                      onChange={(e) => {
                        setLicenseFile(e.target.files?.[0] || null)
                        setLicenseSendError('')
                        setLicenseSendResult('')
                      }}
                    />
                    <button
                      type="button"
                      onClick={sendLicenseForValidation}
                      disabled={!licenseFile || sendingLicense}
                      className="px-2 py-1 rounded-md border border-slate-200 bg-slate-50 text-slate-700 text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {sendingLicense ? 'Sending…' : 'Send'}
                    </button>
                  </div>

                  {licensePreviewUrl ? (
                    <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 overflow-hidden">
                      <img src={licensePreviewUrl} alt="License preview" className="w-full max-h-80 object-contain" />
                    </div>
                  ) : null}

                  {licenseSendError ? (
                    <div className="mt-4 text-sm text-danger-600">{licenseSendError}</div>
                  ) : null}

                  {licenseSendResult ? (
                    <div className="mt-4 text-sm text-slate-700 whitespace-pre-wrap break-words">{licenseSendResult}</div>
                  ) : null}
                </div>
              )
            ) : (
              <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {Object.entries(usersRow || {}).length ? (
                  Object.entries(usersRow || {})
                    .filter(([k]) => visibleUserFields.includes(k))
                    .map(([key, value]) => (
                      <div key={key}>
                        <label className="block text-sm font-medium text-slate-600 mb-1">
                          {String(key)
                            .replace(/_/g, ' ')
                            .replace(/\b\w/g, (c) => c.toUpperCase())}
                        </label>
                        {key === 'password' ? (
                          <input
                            type={showPassword ? 'text' : 'password'}
                            className="edc-input bg-slate-50"
                            value={value == null ? '' : String(value)}
                            disabled
                          />
                        ) : (
                          <input
                            className="edc-input bg-slate-50"
                            value={
                              value == null
                                ? '—'
                                : typeof value === 'boolean'
                                  ? value
                                    ? 'True'
                                    : 'False'
                                  : String(value)
                            }
                            disabled
                          />
                        )}
                      </div>
                    ))
                ) : (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-slate-600 mb-1">Email</label>
                      <input className="edc-input bg-slate-50" value={adminUser?.email || session?.email || ''} disabled />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-600 mb-1">Role</label>
                      <input className="edc-input bg-slate-50" value={adminUser?.role || displayRole} disabled />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-600 mb-1">Status</label>
                      <input
                        className="edc-input bg-slate-50"
                        value={adminUser ? (adminUser.is_active ? 'Active' : 'Inactive') : '—'}
                        disabled
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-600 mb-1">Password</label>
                      <input type={showPassword ? 'text' : 'password'} className="edc-input bg-slate-50" value="" disabled />
                    </div>
                  </>
                )}

                <div className="lg:col-span-4">
                  <label className="inline-flex items-center gap-2 text-sm text-slate-600">
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={showPassword}
                      onChange={(e) => setShowPassword(e.target.checked)}
                    />
                    Show password
                  </label>
                </div>
              </div>
            )}

            <div className="mt-6 flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowManageAccount(false)
                }}
                className="edc-btn-ghost text-sm"
              >
                Validate ID
              </button>
              <button
                type="button"
                onClick={() => setShowManageAccount((v) => !v)}
                className="edc-btn-ghost text-sm"
              >
                Manage Account
              </button>
            </div>

            {loading ? (
              <div className="mt-4 text-sm text-slate-400">Loading…</div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
