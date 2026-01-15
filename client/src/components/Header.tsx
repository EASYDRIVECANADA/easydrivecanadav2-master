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

  if (pathname.startsWith('/admin')) return null

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

    const init = async () => {
      const { data } = await supabase.auth.getSession()
      setUserEmail(data.session?.user?.email || null)
      refreshVerified()
      refreshAdminSession()
    }

    void init()

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserEmail(session?.user?.email || null)
      refreshVerified()
      refreshAdminSession()
    })

    const onStorage = (e: StorageEvent) => {
      if (e.key === 'edc_account_verified') {
        setIsVerified(e.newValue === 'true')
      }
      if (e.key === 'edc_admin_session') {
        refreshAdminSession()
      }
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
      window.addEventListener('focus', onFocus)
      document.addEventListener('visibilitychange', onVisibility)
    }

    return () => {
      sub.subscription.unsubscribe()
      if (typeof window !== 'undefined') {
        window.removeEventListener('storage', onStorage)
        window.removeEventListener('focus', onFocus)
        document.removeEventListener('visibilitychange', onVisibility)
        if (interval) window.clearInterval(interval)
      }
    }
  }, [])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem('edc_customer_verification')
      window.localStorage.removeItem('edc_account_verified')
    }
  }

  const handleAdminSignOut = () => {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem('edc_admin_session')
    }
    router.push('/admin')
  }

  const isAdmin = !!adminRole

  return (
    <>
      {/* Skip to main content for accessibility */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 bg-primary-600 text-white px-4 py-2 rounded-lg font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600"
      >
        Skip to main content
      </a>
      
      <header className="bg-white/80 backdrop-blur-xl border-b border-white/50 shadow-soft sticky top-0 z-50" role="banner">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-18 py-3">
          {/* Logo */}
          <Link href="/" className="flex items-center">
            <Image
              src="/images/logo.png"
              alt="Easy Drive Canada"
              width={180}
              height={48}
              className="h-10 w-auto"
              priority
            />
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex space-x-8 ml-10" aria-label="Main navigation">
            {isAdmin ? (
              <>
                <Link href="/admin" className="text-gray-600 hover:text-primary-600 focus-visible:text-primary-600 transition-all duration-300 font-medium relative group focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary-600 rounded">
                  Admin Dashboard
                  <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-gradient-to-r from-primary-600 to-primary-700 group-hover:w-full transition-all duration-300"></span>
                </Link>
                <Link href="/admin/inventory" className="text-gray-600 hover:text-primary-600 focus-visible:text-primary-600 transition-all duration-300 font-medium relative group focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary-600 rounded">
                  Inventory
                  <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-gradient-to-r from-primary-600 to-primary-700 group-hover:w-full transition-all duration-300"></span>
                </Link>
                <Link href="/admin/leads" className="text-gray-600 hover:text-primary-600 focus-visible:text-primary-600 transition-all duration-300 font-medium relative group focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary-600 rounded">
                  Leads
                  <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-gradient-to-r from-primary-600 to-primary-700 group-hover:w-full transition-all duration-300"></span>
                </Link>
                {adminRole === 'ADMIN' ? (
                  <Link href="/admin/users" className="text-gray-600 hover:text-primary-600 focus-visible:text-primary-600 transition-all duration-300 font-medium relative group focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary-600 rounded">
                    Users
                    <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-gradient-to-r from-primary-600 to-primary-700 group-hover:w-full transition-all duration-300"></span>
                  </Link>
                ) : null}
              </>
            ) : userEmail && isVerified ? (
              <>
                <Link href="/inventory" className="text-gray-600 hover:text-primary-600 focus-visible:text-primary-600 transition-all duration-300 font-medium relative group focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary-600 rounded">
                  Dashboard
                  <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-gradient-to-r from-primary-600 to-primary-700 group-hover:w-full transition-all duration-300"></span>
                </Link>
                <Link href="/account" className="text-gray-600 hover:text-primary-600 focus-visible:text-primary-600 transition-all duration-300 font-medium relative group focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary-600 rounded">
                  Account
                  <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-gradient-to-r from-primary-600 to-primary-700 group-hover:w-full transition-all duration-300"></span>
                </Link>
              </>
            ) : (
              <>
                <Link href="/" className="text-gray-600 hover:text-primary-600 focus-visible:text-primary-600 transition-all duration-300 font-medium relative group focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary-600 rounded">
                  Home
                  <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-gradient-to-r from-primary-600 to-primary-700 group-hover:w-full transition-all duration-300"></span>
                </Link>
                <Link href="/inventory" className="text-gray-600 hover:text-primary-600 focus-visible:text-primary-600 transition-all duration-300 font-medium relative group focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary-600 rounded">
                  Shop Cars
                  <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-gradient-to-r from-primary-600 to-primary-700 group-hover:w-full transition-all duration-300"></span>
                </Link>
                <Link href="/financing" className="text-gray-600 hover:text-primary-600 focus-visible:text-primary-600 transition-all duration-300 font-medium relative group focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary-600 rounded">
                  Financing
                  <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-gradient-to-r from-primary-600 to-primary-700 group-hover:w-full transition-all duration-300"></span>
                </Link>
                <Link href="/contact" className="text-gray-600 hover:text-primary-600 focus-visible:text-primary-600 transition-all duration-300 font-medium relative group focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary-600 rounded">
                  Contact
                  <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-gradient-to-r from-primary-600 to-primary-700 group-hover:w-full transition-all duration-300"></span>
                </Link>
              </>
            )}
          </nav>

          {/* Spacer to push CTA to the right */}
          <div className="flex-1"></div>

          {/* CTA Buttons */}
          <div className="hidden md:flex items-center gap-3">
            {isAdmin ? (
              <button type="button" onClick={handleAdminSignOut} className="btn-secondary text-sm px-5 py-2.5">
                Admin Sign Out
              </button>
            ) : userEmail ? (
              <button type="button" onClick={handleSignOut} className="btn-secondary text-sm px-5 py-2.5">
                Sign Out
              </button>
            ) : (
              <>
                <Link href="/account" className="btn-secondary text-sm px-5 py-2.5">
                  Login
                </Link>
                <Link href="/financing" className="btn-primary text-sm px-5 py-2.5">
                  Get Pre-Approved
                </Link>
              </>
            )}
          </div>

          {/* Mobile menu button */}
          <button
            className="md:hidden p-2 rounded-lg hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600 transition-colors"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            aria-expanded={isMenuOpen}
            aria-label="Toggle navigation menu"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
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
          <div className="md:hidden py-4 border-t" role="navigation" aria-label="Mobile navigation">
            <nav className="flex flex-col space-y-4">
              {isAdmin ? (
                <>
                  <Link href="/admin" className="text-gray-700 hover:text-primary-600 focus-visible:text-primary-600 transition-colors font-medium px-2 py-1 rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600">
                    Admin Dashboard
                  </Link>
                  <Link href="/admin/inventory" className="text-gray-700 hover:text-primary-600 focus-visible:text-primary-600 transition-colors font-medium px-2 py-1 rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600">
                    Inventory
                  </Link>
                  <Link href="/admin/leads" className="text-gray-700 hover:text-primary-600 focus-visible:text-primary-600 transition-colors font-medium px-2 py-1 rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600">
                    Leads
                  </Link>
                  {adminRole === 'ADMIN' ? (
                    <Link href="/admin/users" className="text-gray-700 hover:text-primary-600 focus-visible:text-primary-600 transition-colors font-medium px-2 py-1 rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600">
                      Users
                    </Link>
                  ) : null}
                </>
              ) : userEmail && isVerified ? (
                <>
                  <Link href="/inventory" className="text-gray-700 hover:text-primary-600 focus-visible:text-primary-600 transition-colors font-medium px-2 py-1 rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600">
                    Dashboard
                  </Link>
                  <Link href="/account" className="text-gray-700 hover:text-primary-600 focus-visible:text-primary-600 transition-colors font-medium px-2 py-1 rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600">
                    Account
                  </Link>
                </>
              ) : (
                <>
                  <Link href="/" className="text-gray-700 hover:text-primary-600 focus-visible:text-primary-600 transition-colors font-medium px-2 py-1 rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600">
                    Home
                  </Link>
                  <Link href="/inventory" className="text-gray-700 hover:text-primary-600 focus-visible:text-primary-600 transition-colors font-medium px-2 py-1 rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600">
                    Shop Cars
                  </Link>
                  <Link href="/financing" className="text-gray-700 hover:text-primary-600 focus-visible:text-primary-600 transition-colors font-medium px-2 py-1 rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600">
                    Financing
                  </Link>
                  <Link href="/contact" className="text-gray-700 hover:text-primary-600 focus-visible:text-primary-600 transition-colors font-medium px-2 py-1 rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600">
                    Contact
                  </Link>
                </>
              )}
              {isAdmin ? (
                <button
                  type="button"
                  onClick={handleAdminSignOut}
                  className="text-left text-gray-700 hover:text-primary-600 focus-visible:text-primary-600 transition-colors font-medium px-2 py-1 rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600"
                >
                  Admin Sign Out
                </button>
              ) : userEmail ? (
                <>
                  {isVerified ? null : (
                    <Link href="/account" className="text-gray-700 hover:text-primary-600 focus-visible:text-primary-600 transition-colors font-medium px-2 py-1 rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600">
                      Account
                    </Link>
                  )}
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="text-left text-gray-700 hover:text-primary-600 focus-visible:text-primary-600 transition-colors font-medium px-2 py-1 rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600"
                  >
                    Sign Out
                  </button>
                </>
              ) : (
                <Link href="/account" className="text-gray-700 hover:text-primary-600 focus-visible:text-primary-600 transition-colors font-medium px-2 py-1 rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600">
                  Login
                </Link>
              )}
              {isAdmin || userEmail ? null : (
                <Link 
                  href="/financing" 
                  className="bg-primary-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-primary-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600 transition-colors text-center"
                >
                  Get Pre-Approved
                </Link>
              )}
            </nav>
          </div>
        )}
      </div>
    </header>
    </>
  )
}
