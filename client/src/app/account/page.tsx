'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
import type { AuthChangeEvent, Session } from '@supabase/supabase-js'

export default function AccountPage() {
  const router = useRouter()
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [userName, setUserName] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getSession()
      const user = data.session?.user
      if (user) {
        setUserEmail(user.email || null)
        const metaName = (user.user_metadata as any)?.full_name
        setUserName(typeof metaName === 'string' ? metaName : null)
      }
    }

    void init()

    const { data: sub } = supabase.auth.onAuthStateChange((_event: AuthChangeEvent, session: Session | null) => {
      const user = session?.user
      setUserEmail(user?.email || null)
      const metaName = (user?.user_metadata as any)?.full_name
      setUserName(typeof metaName === 'string' ? metaName : null)
    })

    return () => {
      sub.subscription.unsubscribe()
    }
  }, [])

  const handleGoogleAuth = async () => {
    setError('')
    setLoading(true)
    try {
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/account/verification`,
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
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-4">
              Create Your <span className="gradient-text">EDC Account</span>
            </h1>
            <p className="text-slate-300 text-lg max-w-2xl mx-auto">
              Sign in with Google to continue your purchase. You'll then upload your driver's license for verification.
            </p>
          </div>
        </div>
      </section>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Process Steps */}
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
              <h2 className="text-3xl font-bold text-gray-900 mb-4">Account Created!</h2>
              <div className="bg-white/70 backdrop-blur-sm rounded-xl p-6 mb-8 max-w-md mx-auto">
                <div className="text-sm text-gray-500 mb-1">Signed in as</div>
                <div className="font-semibold text-gray-900 text-lg">{userName || 'Customer'}</div>
                <div className="text-gray-600">{userEmail}</div>
              </div>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <button 
                  type="button" 
                  onClick={() => router.push('/account/verification')} 
                  className="btn-primary flex items-center gap-2"
                >
                  Continue to Verification
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </button>
                <button 
                  type="button" 
                  onClick={handleSignOut} 
                  className="btn-outline"
                >
                  Sign Out
                </button>
              </div>
            </div>
          ) : (
            /* Sign In Form */
            <div className="max-w-md mx-auto text-center">
              <div className="flex items-center gap-3 mb-6 justify-center">
                <span className="w-1 h-8 bg-gradient-to-b from-[#118df0] to-[#0a6bc4] rounded-full"></span>
                <h2 className="text-xl font-bold text-gray-900">Sign In with Google</h2>
              </div>
              
              <p className="text-gray-600 mb-8">
                Use your Google account to create your EDC customer profile. This ensures secure access to your account and verification process.
              </p>

              <button
                type="button"
                onClick={handleGoogleAuth}
                disabled={loading}
                className="w-full bg-white/80 backdrop-blur-sm text-gray-900 px-6 py-4 rounded-full font-semibold border border-gray-200/60 shadow-md shadow-black/5 transition-all duration-300 hover:bg-white hover:shadow-lg disabled:opacity-50 mb-6"
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

              <div className="bg-[#118df0]/5 border border-[#118df0]/20 rounded-xl p-4">
                <p className="text-sm text-gray-600 flex items-start gap-2">
                  <svg className="w-5 h-5 text-[#118df0] flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  EDC account creation and login is exclusively via Google authentication for security and convenience.
                </p>
              </div>
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
            {userEmail && (
              <Link href="/account/verification" className="text-sm text-gray-700 hover:text-[#118df0] transition-colors flex items-center gap-1">
                Go to Verification
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
