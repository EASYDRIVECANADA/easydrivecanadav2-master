'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

export default function Header() {
  const router = useRouter()
  const pathname = usePathname()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [isVerified, setIsVerified] = useState(false)
  const [adminRole, setAdminRole] = useState<string | null>(null)
  const [showAdminSignOutModal, setShowAdminSignOutModal] = useState(false)
  const [showUserSignOutModal, setShowUserSignOutModal] = useState(false)

  const hideHeader = pathname.startsWith('/admin') || pathname.startsWith('/account')

  useEffect(() => {
    const refreshVerified = () => {
      if (typeof window === 'undefined') return
      setIsVerified(window.localStorage.getItem('edc_account_verified') === 'true')
    }

    const refreshAdminSession = () => {
      if (typeof window === 'undefined') return
      const sessionStr = window.localStorage.getItem('edc_admin_session')
      if (!sessionStr) {
        setAdminRole(null)
        return
      }
      try {
        const parsed = JSON.parse(sessionStr) as { role?: string }
        setAdminRole(parsed?.role || 'STAFF')
      } catch {
        setAdminRole('STAFF')
      }
    }

    const syncVerifiedIfNeeded = async (email: string | null) => {
      if (!email) return
      const existing = typeof window !== 'undefined' ? window.localStorage.getItem('edc_account_verified') : null
      if (existing !== null) return
      try {
        const { data } = await supabase
          .from('edc_account_verifications')
          .select('id')
          .eq('email', email.trim().toLowerCase())
          .limit(1)
        const hasRow = Array.isArray(data) && data.length > 0
        if (typeof window !== 'undefined') {
          window.localStorage.setItem('edc_account_verified', hasRow ? 'true' : 'false')
        }
        setIsVerified(hasRow)
      } catch { /* ignore */ }
    }

    const init = async () => {
      const { data } = await supabase.auth.getSession()
      const email = data.session?.user?.email || null
      setUserEmail(email)
      refreshVerified()
      refreshAdminSession()
      await syncVerifiedIfNeeded(email)
    }

    void init()

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      const email = session?.user?.email || null
      setUserEmail(email)
      refreshVerified()
      refreshAdminSession()
      if (event !== 'SIGNED_OUT') {
        void syncVerifiedIfNeeded(email)
      }
    })

    const onStorage = (e: StorageEvent) => {
      if (e.key === 'edc_account_verified') {
        setIsVerified(e.newValue === 'true')
      }
      if (e.key === 'edc_admin_session') {
        refreshAdminSession()
      }
    }

    const onAdminSessionChanged = () => {
      refreshAdminSession()
    }

    const onFocus = () => {
      refreshVerified()
      refreshAdminSession()
    }
    const onVisibility = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        refreshVerified()
        refreshAdminSession()
      }
    }

    const interval =
      typeof window !== 'undefined'
        ? window.setInterval(() => {
            refreshVerified()
            refreshAdminSession()
          }, 2000)
        : null

    if (typeof window !== 'undefined') {
      window.addEventListener('storage', onStorage)
      window.addEventListener('edc_admin_session_changed', onAdminSessionChanged)
      window.addEventListener('focus', onFocus)
      document.addEventListener('visibilitychange', onVisibility)
    }

    return () => {
      sub.subscription.unsubscribe()
      if (typeof window !== 'undefined') {
        window.removeEventListener('storage', onStorage)
        window.removeEventListener('edc_admin_session_changed', onAdminSessionChanged)
        window.removeEventListener('focus', onFocus)
        document.removeEventListener('visibilitychange', onVisibility)
        if (interval) window.clearInterval(interval)
      }
    }
  }, [])

  const handleSignOut = async () => {
    // Clear local state immediately so UI updates before redirect
    setUserEmail(null)
    setIsVerified(false)
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem('edc_customer_verification')
      window.localStorage.removeItem('edc_account_verified')
      window.localStorage.removeItem('edc_oauth_flow')
      window.localStorage.removeItem('edc_admin_session')
      window.dispatchEvent(new Event('edc_admin_session_changed'))
      // Nuke all Supabase session keys so the OAuth token can't be auto-restored
      Object.keys(window.localStorage)
        .filter((k) => k.startsWith('sb-') || k.includes('supabase'))
        .forEach((k) => window.localStorage.removeItem(k))
    }
    // Sign out of Supabase
    await supabase.auth.signOut({ scope: 'local' })
    // Hard reload to / so no in-memory session state survives
    window.location.href = '/'
  }

  const handleAdminSignOut = async () => {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem('edc_admin_session')
      window.localStorage.removeItem('edc_account_verified')
      window.localStorage.removeItem('edc_customer_verification')
      window.localStorage.removeItem('edc_oauth_flow')
      Object.keys(window.localStorage)
        .filter((k) => k.startsWith('sb-') || k.includes('supabase'))
        .forEach((k) => window.localStorage.removeItem(k))
      window.dispatchEvent(new Event('edc_admin_session_changed'))
    }
    await supabase.auth.signOut({ scope: 'local' })
    window.location.href = '/'
  }

  const isAdmin = !!adminRole && pathname.startsWith('/admin')

  if (hideHeader) return null

  return (
    <>
      {/* Skip to main content for accessibility */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 bg-primary-600 text-white px-4 py-2 rounded-lg font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600"
      >
        Skip to main content
      </a>
      
      <header className="relative sticky top-0 z-50 border-b border-gray-200/60 bg-white/85 backdrop-blur supports-[backdrop-filter]:bg-white/70" role="banner">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Logo */}
          <Link href="/" className="flex items-center shrink-0">
            <Image
              src="/images/logo.png"
              alt="Easy Drive Canada"
              width={180}
              height={48}
              className="h-9 w-auto"
              priority
            />
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1" aria-label="Main navigation">
            {isAdmin ? (
              <Link href="/admin" className={`rounded-full px-4 py-2 text-sm font-medium transition hover:text-gray-900 ${pathname === '/admin' ? 'bg-gray-100 text-gray-900' : 'text-gray-500'}`}>
                Admin Dashboard
              </Link>
            ) : userEmail && isVerified ? (
              <>
                <Link href="/inventory" className={`rounded-full px-4 py-2 text-sm font-medium transition hover:text-gray-900 ${pathname === '/inventory' ? 'bg-gray-100 text-gray-900' : 'text-gray-500'}`}>
                  Dashboard
                </Link>
                <Link href="/admin/account" className={`rounded-full px-4 py-2 text-sm font-medium transition hover:text-gray-900 ${pathname === '/admin/account' ? 'bg-gray-100 text-gray-900' : 'text-gray-500'}`}>
                  Account
                </Link>
              </>
            ) : (
              <>
                <Link href="/" className={`rounded-full px-4 py-2 text-sm font-medium transition hover:text-gray-900 ${pathname === '/' ? 'bg-gray-100 text-gray-900' : 'text-gray-500'}`}>
                  Home
                </Link>
                <Link href="/inventory" className={`rounded-full px-4 py-2 text-sm font-medium transition hover:text-gray-900 ${pathname.startsWith('/inventory') ? 'bg-gray-100 text-gray-900' : 'text-gray-500'}`}>
                  Shop Cars
                </Link>
                <Link href="/financing" className={`rounded-full px-4 py-2 text-sm font-medium transition hover:text-gray-900 ${pathname === '/financing' ? 'bg-gray-100 text-gray-900' : 'text-gray-500'}`}>
                  Financing
                </Link>
                <Link href="/warranty" className={`rounded-full px-4 py-2 text-sm font-medium transition hover:text-gray-900 ${pathname === '/warranty' ? 'bg-gray-100 text-gray-900' : 'text-gray-500'}`}>
                  Warranty
                </Link>
                <Link href="/sell" className={`rounded-full px-4 py-2 text-sm font-medium transition hover:text-gray-900 ${pathname === '/sell' ? 'bg-gray-100 text-gray-900' : 'text-gray-500'}`}>
                  Sell Your Car
                </Link>
                <Link href="/contact" className={`rounded-full px-4 py-2 text-sm font-medium transition hover:text-gray-900 ${pathname === '/contact' ? 'bg-gray-100 text-gray-900' : 'text-gray-500'}`}>
                  Contact
                </Link>
              </>
            )}
          </nav>

          {/* CTA Buttons */}
          <div className="hidden md:flex items-center gap-2">
            {userEmail ? (
              <button type="button" onClick={() => setShowUserSignOutModal(true)} className="rounded-full border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                Sign Out
              </button>
            ) : (
              <>
                <Link href="/account" className="rounded-full px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors">
                  Login
                </Link>
                <Link href="/financing" className="rounded-full bg-[#118df0] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0d7fd8] transition-colors">
                  Get Pre-Approved
                </Link>
              </>
            )}
          </div>

          {/* Mobile menu button */}
          <button
            className="md:hidden rounded-md p-2 text-gray-600 hover:bg-gray-100 transition-colors"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            aria-expanded={isMenuOpen}
            aria-label="Toggle navigation menu"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              {isMenuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>

      {/* Mobile Navigation */}
      {isMenuOpen && (
        <div className="absolute left-0 right-0 top-full border-t border-gray-100 bg-white shadow-lg md:hidden" role="navigation" aria-label="Mobile navigation">
          <nav className="flex flex-col gap-1 px-4 py-3">
            {isAdmin ? (
              <Link href="/admin" onClick={() => setIsMenuOpen(false)} className="flex items-center justify-between px-3 py-3 rounded-xl text-gray-700 font-medium hover:bg-gray-50 transition-colors">
                Admin Dashboard
                <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>
              </Link>
            ) : userEmail && isVerified ? (
              <>
                <Link href="/inventory" onClick={() => setIsMenuOpen(false)} className="flex items-center justify-between px-3 py-3 rounded-xl text-gray-700 font-medium hover:bg-gray-50 transition-colors">
                  Dashboard
                  <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>
                </Link>
                <Link href="/admin/account" onClick={() => setIsMenuOpen(false)} className="flex items-center justify-between px-3 py-3 rounded-xl text-gray-700 font-medium hover:bg-gray-50 transition-colors">
                  Account
                  <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>
                </Link>
              </>
            ) : (
              <>
                <Link href="/" onClick={() => setIsMenuOpen(false)} className="flex items-center justify-between px-3 py-3 rounded-xl text-gray-700 font-medium hover:bg-gray-50 transition-colors">
                  Home
                  <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>
                </Link>
                <Link href="/inventory" onClick={() => setIsMenuOpen(false)} className="flex items-center justify-between px-3 py-3 rounded-xl text-gray-700 font-medium hover:bg-gray-50 transition-colors">
                  Shop Cars
                  <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>
                </Link>
                <Link href="/financing" onClick={() => setIsMenuOpen(false)} className="flex items-center justify-between px-3 py-3 rounded-xl text-gray-700 font-medium hover:bg-gray-50 transition-colors">
                  Financing
                  <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>
                </Link>
                <Link href="/warranty" onClick={() => setIsMenuOpen(false)} className="flex items-center justify-between px-3 py-3 rounded-xl text-gray-700 font-medium hover:bg-gray-50 transition-colors">
                  Warranty
                  <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>
                </Link>
                <Link href="/sell" onClick={() => setIsMenuOpen(false)} className="flex items-center justify-between px-3 py-3 rounded-xl text-gray-700 font-medium hover:bg-gray-50 transition-colors">
                  Sell Your Car
                  <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>
                </Link>
                <Link href="/contact" onClick={() => setIsMenuOpen(false)} className="flex items-center justify-between px-3 py-3 rounded-xl text-gray-700 font-medium hover:bg-gray-50 transition-colors">
                  Contact
                  <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>
                </Link>
              </>
            )}
          </nav>
          {/* CTA row */}
          <div className="flex gap-3 border-t border-gray-100 px-4 py-4">
            {userEmail ? (
              <button
                type="button"
                onClick={() => { setIsMenuOpen(false); setShowUserSignOutModal(true) }}
                className="flex-1 text-center border border-gray-200 text-gray-700 rounded-full py-2.5 font-semibold text-sm hover:bg-gray-50 transition-colors"
              >
                Sign Out
              </button>
            ) : (
              <>
                <Link href="/account" onClick={() => setIsMenuOpen(false)} className="flex-1 text-center border border-gray-200 text-gray-700 rounded-full py-2.5 font-semibold text-sm hover:bg-gray-50 transition-colors">
                  Login
                </Link>
                <Link href="/financing" onClick={() => setIsMenuOpen(false)} className="flex-1 text-center bg-[#118df0] text-white rounded-full py-2.5 font-semibold text-sm hover:bg-[#0d7fd8] transition-colors">
                  Get Pre-Approved
                </Link>
              </>
            )}
          </div>
        </div>
      )}
      </header>

      {showAdminSignOutModal ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setShowAdminSignOutModal(false)
          }}
        >
          <div className="absolute inset-0 bg-black/50" />
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
              <div className="text-lg font-semibold text-gray-900">Sign out</div>
              <button
                type="button"
                className="w-10 h-10 rounded-xl hover:bg-gray-100 flex items-center justify-center"
                onClick={() => setShowAdminSignOutModal(false)}
                aria-label="Close"
              >
                <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="px-6 py-5">
              <div className="text-sm text-gray-600">Are you sure you want to sign out?</div>
            </div>

            <div className="px-6 pb-6 flex items-center justify-end gap-3">
              <button
                type="button"
                className="h-10 px-4 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-700 hover:bg-gray-50"
                onClick={() => setShowAdminSignOutModal(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="h-10 px-4 rounded-xl bg-[#118df0] text-white text-sm font-semibold hover:bg-[#0d6ebd]"
                onClick={() => {
                  setShowAdminSignOutModal(false)
                  void handleAdminSignOut()
                }}
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showUserSignOutModal ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setShowUserSignOutModal(false)
          }}
        >
          <div className="absolute inset-0 bg-black/50" />
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
              <div className="text-lg font-semibold text-gray-900">Sign out</div>
              <button
                type="button"
                className="w-10 h-10 rounded-xl hover:bg-gray-100 flex items-center justify-center"
                onClick={() => setShowUserSignOutModal(false)}
                aria-label="Close"
              >
                <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="px-6 py-5">
              <div className="text-sm text-gray-600">Are you sure you want to sign out?</div>
            </div>

            <div className="px-6 pb-6 flex items-center justify-end gap-3">
              <button
                type="button"
                className="h-10 px-4 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-700 hover:bg-gray-50"
                onClick={() => setShowUserSignOutModal(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="h-10 px-4 rounded-xl bg-[#118df0] text-white text-sm font-semibold hover:bg-[#0d6ebd]"
                onClick={() => {
                  setShowUserSignOutModal(false)
                  setIsMenuOpen(false)
                  void handleSignOut()
                }}
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
