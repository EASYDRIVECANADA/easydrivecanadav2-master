'use client'

import { FormEvent, Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
import type { AuthChangeEvent, Session } from '@supabase/supabase-js'

export default function AccountPage() {
  return (
    <Suspense fallback={<div className="min-h-screen" />}> 
      <AccountPageInner />
    </Suspense>
  )
}

function AccountPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [userName, setUserName] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [initLoading, setInitLoading] = useState(true)
  const [isVerified, setIsVerified] = useState(false)

  const [customerAuthEmail, setCustomerAuthEmail] = useState('')
  const [customerAuthPassword, setCustomerAuthPassword] = useState('')
  const [customerCreateMode, setCustomerCreateMode] = useState(false)
  const [editingName, setEditingName] = useState('')
  const [editingAddress, setEditingAddress] = useState('')
  const [editingLicenseNumber, setEditingLicenseNumber] = useState('')
  const [verificationId, setVerificationId] = useState<string | null>(null)
  const [loadingVerification, setLoadingVerification] = useState(false)
  const [savingProfile, setSavingProfile] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [isEditingProfile, setIsEditingProfile] = useState(false)

  const [originalName, setOriginalName] = useState('')
  const [originalAddress, setOriginalAddress] = useState('')
  const [originalLicenseNumber, setOriginalLicenseNumber] = useState('')

  const fromOauth = searchParams.get('from') === 'oauth'

  const syncVerifiedFromDb = async (email: string) => {
    const { data, error: dbError } = await supabase
      .from('edc_account_verifications')
      .select('id')
      .eq('email', email)
      .limit(1)

    if (dbError) {
      setError('Unable to check verification status. Please try again, or continue to verification.')
      return null as unknown as boolean
    }

    const hasRow = Array.isArray(data) && data.length > 0
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('edc_account_verified', hasRow ? 'true' : 'false')
    }
    setIsVerified(hasRow)
    return hasRow
  }

  const loadLatestVerification = async (email: string) => {
    setLoadingVerification(true)
    try {
      const { data, error: dbError } = await supabase
        .from('edc_account_verifications')
        .select('id, full_name, address, license_number')
        .eq('email', email)
        .order('created_at', { ascending: false })
        .limit(1)

      if (dbError) return

      const row = Array.isArray(data) && data.length > 0 ? (data[0] as any) : null
      setVerificationId(row?.id || null)
      const verifiedFullName = typeof row?.full_name === 'string' ? row.full_name : ''
      const nextAddress = typeof row?.address === 'string' ? row.address : ''
      const nextLicenseNumber = typeof row?.license_number === 'string' ? row.license_number : ''

      if (verifiedFullName.trim().length > 0) {
        setEditingName(verifiedFullName)
        setOriginalName(verifiedFullName)
        setUserName(verifiedFullName)
      }
      setEditingAddress(nextAddress)
      setEditingLicenseNumber(nextLicenseNumber)
      setOriginalAddress(nextAddress)
      setOriginalLicenseNumber(nextLicenseNumber)
    } finally {
      setLoadingVerification(false)
    }
  }

  const tryAdminLogin = async (email: string, accessCode: string) => {
    const normalizedEmail = email.trim().toLowerCase()
    if (!normalizedEmail || !accessCode) return false

    const { data, error: dbError } = await supabase
      .from('edc_admin_users')
      .select('email, role, is_active')
      .eq('email', normalizedEmail)
      .eq('access_code', accessCode)
      .limit(1)
      .maybeSingle()

    if (dbError) return false
    if (!data || !data.is_active) return false

    const session = { email: data.email, role: data.role }
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('edc_admin_session', JSON.stringify(session))
      window.dispatchEvent(new Event('edc_admin_session_changed'))
    }
    return true
  }

  const handleUnifiedSignIn = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const email = customerAuthEmail.trim().toLowerCase()
      const passwordOrAccessCode = customerAuthPassword

      if (!email || !passwordOrAccessCode) {
        setError('Email and password are required')
        return
      }

      if (customerCreateMode) {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password: passwordOrAccessCode,
          options: {
            emailRedirectTo: `${window.location.origin}/account?from=oauth`,
          },
        })
        if (signUpError) {
          setError(signUpError.message)
          return
        }
        setError('Account created. Please check your email to confirm, then sign in.')
        setCustomerCreateMode(false)
        return
      }

      const isAdmin = await tryAdminLogin(email, passwordOrAccessCode)
      if (isAdmin) {
        router.push('/admin')
        return
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password: passwordOrAccessCode,
      })
      if (signInError) {
        setError(signInError.message)
        return
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const init = async () => {
      try {
        const { data } = await supabase.auth.getSession()
        const user = data.session?.user
        if (user) {
          setUserEmail(user.email || null)
          const metaName = (user.user_metadata as any)?.full_name
          setUserName(typeof metaName === 'string' ? metaName : null)
          const nextName = typeof metaName === 'string' ? metaName : ''
          setEditingName(nextName)
          setOriginalName(nextName)

          if (user.email) {
            const hasRow = await syncVerifiedFromDb(user.email)
            await loadLatestVerification(user.email)
            if (fromOauth) {
              if (hasRow === true) {
                router.replace('/inventory')
                return
              }
              if (hasRow === false) {
                router.replace('/account/verification')
                return
              }
            }
          }
        }
      } finally {
        setInitLoading(false)
      }
    }

    void init()

    if (typeof window !== 'undefined') {
      setIsVerified(window.localStorage.getItem('edc_account_verified') === 'true')
    }

    const { data: sub } = supabase.auth.onAuthStateChange((_event: AuthChangeEvent, session: Session | null) => {
      const user = session?.user
      setUserEmail(user?.email || null)
      const metaName = (user?.user_metadata as any)?.full_name
      setUserName(typeof metaName === 'string' ? metaName : null)
      const nextName = typeof metaName === 'string' ? metaName : ''
      setEditingName(nextName)
      setOriginalName(nextName)
      setSaveSuccess(false)
      setIsEditingProfile(false)

      if (user?.email) {
        void syncVerifiedFromDb(user.email).then((hasRow) => {
          if (fromOauth) {
            if (hasRow === true) router.replace('/inventory')
            if (hasRow === false) router.replace('/account/verification')
          }
        })
        void loadLatestVerification(user.email)
        return
      }

      if (typeof window !== 'undefined') setIsVerified(window.localStorage.getItem('edc_account_verified') === 'true')
    })

    return () => {
      sub.subscription.unsubscribe()
    }
  }, [])

  if (initLoading) {
    return <div className="min-h-screen" />
  }

  const handleGoogleAuth = async () => {
    setError('')
    setLoading(true)
    try {
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/account?from=oauth`,
        },
      })
      if (oauthError) setError(oauthError.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    window.localStorage.removeItem('edc_customer_verification')
    window.localStorage.removeItem('edc_account_verified')
  }

  const handleSaveProfile = async () => {
    if (!userEmail) return

    setError('')
    setSaveSuccess(false)
    setSavingProfile(true)

    try {
      const nextName = editingName.trim()
      const nextAddress = editingAddress.trim()
      const nextLicenseNumber = editingLicenseNumber.trim()

      setEditingName(nextName)
      setEditingAddress(nextAddress)
      setEditingLicenseNumber(nextLicenseNumber)
      const { error: updateError } = await supabase.auth.updateUser({
        data: {
          full_name: nextName,
        },
      })

      if (updateError) {
        setError(updateError.message || 'Unable to update account')
        return
      }

      setUserName(nextName)
      setOriginalName(nextName)

      if (verificationId) {
        const { error: verificationError } = await supabase
          .from('edc_account_verifications')
          .update({
            full_name: nextName,
            address: nextAddress,
            license_number: nextLicenseNumber,
          })
          .eq('id', verificationId)

        if (verificationError) {
          setError(verificationError.message || 'Unable to update verification details')
          return
        }

        setOriginalAddress(nextAddress)
        setOriginalLicenseNumber(nextLicenseNumber)
      }

      setSaveSuccess(true)
      setIsEditingProfile(false)
      void loadLatestVerification(userEmail)
    } finally {
      setSavingProfile(false)
    }
  }

  const handleCancelEdit = () => {
    setEditingName(originalName)
    setEditingAddress(originalAddress)
    setEditingLicenseNumber(originalLicenseNumber)
    setSaveSuccess(false)
    setIsEditingProfile(false)
  }

  return (
    <div className="min-h-screen">
      {/* Hero Header */}
      <section className="relative overflow-hidden py-16 lg:py-20">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900"></div>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-[#118df0]/20 via-transparent to-transparent"></div>
        <div className="absolute top-10 right-10 w-72 h-72 bg-[#118df0]/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-10 left-10 w-48 h-48 bg-purple-500/10 rounded-full blur-2xl"></div>
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <span className="badge mb-4 bg-white/10 border-white/20 text-white/90">
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              Customer Account
            </span>
            {userEmail ? (
              <>
                <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-4">
                  Your <span className="gradient-text">EDC Account</span>
                </h1>
                <p className="text-slate-300 text-lg max-w-2xl mx-auto">
                  Manage your verification status and continue shopping.
                </p>
              </>
            ) : (
              <>
                <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-4">
                  Create Your <span className="gradient-text">EDC Account</span>
                </h1>
                <p className="text-slate-300 text-lg max-w-2xl mx-auto">
                  Sign in with Google to continue your purchase. You'll then upload your driver's license for verification.
                </p>
              </>
            )}
          </div>
        </div>
      </section>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Process Steps */}
        {!userEmail ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            <div className="glass-card rounded-xl p-6 text-center group hover:shadow-lg transition-shadow">
              <div className="icon-container mx-auto mb-4 group-hover:scale-110 transition-transform">
                <svg className="w-6 h-6 text-[#118df0]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Create EDC Account</h3>
              <p className="text-gray-500 text-sm">Sign in with your Google account</p>
            </div>
            <div className="glass-card rounded-xl p-6 text-center group hover:shadow-lg transition-shadow">
              <div className="icon-container mx-auto mb-4 group-hover:scale-110 transition-transform">
                <svg className="w-6 h-6 text-[#118df0]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Upload License</h3>
              <p className="text-gray-500 text-sm">Upload your driver's license</p>
            </div>
            <div className="glass-card rounded-xl p-6 text-center group hover:shadow-lg transition-shadow">
              <div className="icon-container mx-auto mb-4 group-hover:scale-110 transition-transform">
                <svg className="w-6 h-6 text-[#118df0]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Verification Complete</h3>
              <p className="text-gray-500 text-sm">Start shopping for vehicles</p>
            </div>
          </div>
        ) : null}

        {/* Account Form */}
        <div className="glass-card rounded-2xl p-8">
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 flex items-center gap-3">
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {error}
            </div>
          )}

          {userEmail ? (
            /* Signed In State */
            <div className="text-center">
              <div className="w-20 h-20 bg-gradient-to-br from-green-400 to-green-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-green-500/25">
                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-3xl font-bold text-gray-900 mb-4">Account</h2>
              <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-gray-200/60 p-6 mb-8 max-w-xl mx-auto">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="text-left">
                    <div className="text-sm font-semibold text-gray-900">Profile</div>
                    <div className="mt-1 text-xs text-gray-600">Signed in as</div>
                    <div className="mt-1 text-sm font-medium text-gray-900 break-all">{userEmail}</div>
                  </div>
                  <div className="flex flex-col items-start sm:items-end gap-2">
                    <span className={isVerified ? 'badge badge-success' : 'badge badge-warning'}>
                      {isVerified ? 'Verified' : 'Verification Required'}
                    </span>
                    {!isEditingProfile ? (
                      <button
                        type="button"
                        onClick={() => {
                          setError('')
                          setSaveSuccess(false)
                          setIsEditingProfile(true)
                        }}
                        className="btn-secondary text-sm px-5 py-2.5"
                      >
                        Edit
                      </button>
                    ) : (
                      <div className="flex flex-col sm:flex-row gap-3">
                        <button
                          type="button"
                          onClick={handleSaveProfile}
                          disabled={savingProfile}
                          className="btn-primary text-sm px-5 py-2.5 disabled:opacity-50"
                        >
                          {savingProfile ? 'Saving…' : 'Save'}
                        </button>
                        <button type="button" onClick={handleCancelEdit} className="btn-outline text-sm px-5 py-2.5">
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-6 grid grid-cols-1 gap-4">
                  <div className="text-left">
                    <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="accountFullName">
                      Full name
                    </label>
                    <input
                      id="accountFullName"
                      className={
                        isEditingProfile
                          ? 'input-field'
                          : 'input-field bg-gray-50 text-gray-700 cursor-not-allowed'
                      }
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      placeholder={loadingVerification ? 'Loading…' : 'Full name from verification'}
                      autoComplete="name"
                      disabled={!isEditingProfile}
                    />
                  </div>

                  <div className="text-left">
                    <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="accountAddress">
                      Address
                    </label>
                    <input
                      id="accountAddress"
                      className={
                        isEditingProfile
                          ? 'input-field'
                          : 'input-field bg-gray-50 text-gray-700 cursor-not-allowed'
                      }
                      value={editingAddress}
                      onChange={(e) => setEditingAddress(e.target.value)}
                      placeholder={loadingVerification ? 'Loading…' : 'Address from verification'}
                      autoComplete="street-address"
                      disabled={!isEditingProfile}
                    />
                  </div>

                  <div className="text-left">
                    <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="accountLicenseNumber">
                      Driver license number
                    </label>
                    <input
                      id="accountLicenseNumber"
                      className={
                        isEditingProfile
                          ? 'input-field'
                          : 'input-field bg-gray-50 text-gray-700 cursor-not-allowed'
                      }
                      value={editingLicenseNumber}
                      onChange={(e) => setEditingLicenseNumber(e.target.value)}
                      placeholder={loadingVerification ? 'Loading…' : 'License number from verification'}
                      disabled={!isEditingProfile}
                    />
                  </div>
                </div>

                {saveSuccess ? (
                  <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
                    Account updated successfully.
                  </div>
                ) : null}
              </div>
            </div>
          ) : (
            /* Sign In Form */
            <div className="max-w-md mx-auto text-center">
              <div className="flex items-center gap-3 mb-6 justify-center">
                <span className="w-1 h-8 bg-gradient-to-b from-[#118df0] to-[#0a6bc4] rounded-full"></span>
                <h2 className="text-xl font-bold text-gray-900">Sign In</h2>
              </div>

              {error ? (
                <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
              ) : null}

              <p className="text-gray-600 mb-6">
                {customerCreateMode
                  ? 'Create an account using email and password, or continue with Google.'
                  : 'Sign in using your email and password (or admin access code).'}
              </p>

              <form onSubmit={handleUnifiedSignIn} className="space-y-4 text-left">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="unifiedEmail">
                    Email
                  </label>
                  <input
                    id="unifiedEmail"
                    type="email"
                    value={customerAuthEmail}
                    onChange={(e) => setCustomerAuthEmail(e.target.value)}
                    className="input-field"
                    placeholder="Enter your email"
                    autoComplete="email"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="unifiedPassword">
                    Password
                  </label>
                  <input
                    id="unifiedPassword"
                    type="password"
                    value={customerAuthPassword}
                    onChange={(e) => setCustomerAuthPassword(e.target.value)}
                    className="input-field"
                    placeholder="Enter your password"
                    autoComplete={
                      customerCreateMode ? 'new-password' : 'current-password'
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-sm text-gray-600">
                    <input type="checkbox" className="h-4 w-4 rounded border-gray-300" />
                    Remember me
                  </label>
                  <button
                    type="button"
                    onClick={() => setError('Forgot password is not available yet.')}
                    className="text-sm text-[#118df0] hover:underline"
                  >
                    Forgot Password?
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-[#118df0] text-white px-6 py-4 rounded-full font-semibold shadow-md shadow-black/5 transition-all duration-300 hover:bg-[#0a6bc4] disabled:opacity-50"
                >
                  {loading ? 'Please wait…' : customerCreateMode ? 'Create Account' : 'Sign In'}
                </button>

                <button
                  type="button"
                  onClick={() => setCustomerCreateMode((v) => !v)}
                  className="w-full bg-white/80 text-gray-900 px-6 py-3 rounded-full font-semibold border border-gray-200/60 shadow-sm shadow-black/5 transition-all duration-300 hover:bg-white"
                >
                  {customerCreateMode ? 'I already have an account' : 'Create new account instead'}
                </button>
              </form>

              <div className="my-7 flex items-center gap-3">
                <div className="h-px flex-1 bg-gray-200/70" />
                <div className="text-xs font-semibold text-gray-500">Or login with</div>
                <div className="h-px flex-1 bg-gray-200/70" />
              </div>

              <button
                type="button"
                onClick={handleGoogleAuth}
                disabled={loading}
                className="w-full bg-white/80 backdrop-blur-sm text-gray-900 px-6 py-4 rounded-full font-semibold border border-gray-200/60 shadow-md shadow-black/5 transition-all duration-300 hover:bg-white hover:shadow-lg disabled:opacity-50"
              >
                <span className="flex items-center justify-center gap-3">
                  <span className="inline-flex h-6 w-6 items-center justify-center" aria-hidden="true">
                    <svg width="24" height="24" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                      <path fill="#EA4335" d="M24 9.5c3.54 0 6.73 1.22 9.24 3.6l6.9-6.9C35.9 2.38 30.26 0 24 0 14.62 0 6.51 5.38 2.56 13.22l8.02 6.22C12.5 13.02 17.8 9.5 24 9.5z"/>
                      <path fill="#4285F4" d="M46.98 24.55c0-1.6-.14-3.13-.4-4.6H24v9.02h12.94c-.58 2.98-2.26 5.5-4.86 7.18l7.47 5.8c4.37-4.03 6.43-9.97 6.43-17.4z"/>
                      <path fill="#FBBC05" d="M10.58 28.94c-.48-1.44-.76-2.98-.76-4.54s.28-3.1.76-4.54l-8.02-6.22C.92 16.3 0 20.06 0 24.4c0 4.34.92 8.1 2.56 11.76l8.02-7.22z"/>
                      <path fill="#34A853" d="M24 48c6.26 0 11.54-2.06 15.39-5.6l-7.47-5.8c-2.07 1.39-4.73 2.21-7.92 2.21-6.2 0-11.5-3.52-13.42-8.44l-8.02 7.22C6.51 42.62 14.62 48 24 48z"/>
                      <path fill="none" d="M0 0h48v48H0z"/>
                    </svg>
                  </span>
                  <span>{loading ? 'Redirecting…' : 'Continue with Google'}</span>
                </span>
              </button>
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between mt-10 pt-6 border-t border-gray-200/60">
            <Link href="/" className="text-sm text-[#118df0] hover:underline flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to Home
            </Link>
            <div />
          </div>
        </div>
      </div>
    </div>
  )
}
