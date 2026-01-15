'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'

// Extend Window interface for Google Identity Services
declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string
            callback: (response: { credential: string }) => void
            use_fedcm_for_prompt?: boolean
          }) => void
          renderButton: (
            element: HTMLElement | null,
            options: {
              theme?: string
              size?: string
              width?: number
              text?: string
              shape?: string
            }
          ) => void
        }
      }
    }
  }
}

interface User {
  email: string
  role: string
}

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [user, setUser] = useState<User | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [checkingAuth, setCheckingAuth] = useState(true)
  // const router = useRouter(); // Uncomment if needed for navigation

  useEffect(() => {
    checkAuth()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const checkAuth = async () => {
    const sessionStr = localStorage.getItem('edc_admin_session')
    if (!sessionStr) {
      setCheckingAuth(false)
      return
    }

    try {
      const parsed = JSON.parse(sessionStr) as { email?: string; role?: string }
      if (parsed?.email && parsed?.role) {
        setUser({ email: parsed.email, role: parsed.role })
        setIsAuthenticated(true)
      } else {
        localStorage.removeItem('edc_admin_session')
      }
    } catch {
      localStorage.removeItem('edc_admin_session')
    } finally {
      setCheckingAuth(false)
    }
  }

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const normalizedEmail = email.trim().toLowerCase()
      const accessCode = password

      if (!normalizedEmail || !accessCode) {
        setError('Email and access code required')
        return
      }

      const { data, error: dbError } = await supabase
        .from('edc_admin_users')
        .select('email, role, is_active')
        .eq('email', normalizedEmail)
        .eq('access_code', accessCode)
        .limit(1)
        .maybeSingle()

      if (dbError) {
        setError('Login failed')
        return
      }

      if (!data || !data.is_active) {
        setError('Invalid email or access code')
        return
      }

      const session = { email: data.email, role: data.role }
      localStorage.setItem('edc_admin_session', JSON.stringify(session))
      setUser({ email: data.email, role: data.role })
      setIsAuthenticated(true)
    } catch {
      setError('Failed to connect to server')
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    localStorage.removeItem('edc_admin_session')
    setUser(null)
    setIsAuthenticated(false)
  }

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#118df0] mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <>
        <div className="min-h-screen bg-gray-100 flex items-center justify-center">
          <div className="bg-white rounded-xl shadow-lg p-8 w-full max-w-md">
            <h1 className="text-2xl font-bold text-center mb-6">Admin Login</h1>
            {error && (
              <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm">
                {error}
              </div>
            )}

            {/* Email/Password Login */}
            <form onSubmit={handleEmailLogin}>
              <div className="mb-4">
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent"
                  placeholder="your@email.com"
                  autoComplete="email"
                  required
                />
              </div>
              <div className="mb-4">
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent"
                  placeholder="Enter access code"
                  autoComplete="current-password"
                  required
                />
              </div>
              <div className="mb-6 text-right">
                <Link href="/forgot-password" className="text-sm text-[#118df0] hover:underline">
                  Forgot Password?
                </Link>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#118df0] text-white py-2 rounded-lg font-semibold hover:bg-[#0d6ebd] transition-colors disabled:opacity-50"
              >
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
            </form>
          </div>
        </div>
      </>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="w-full px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
            <p className="text-sm text-gray-500">Welcome back, {user?.email}</p>
          </div>
        </div>
      </div>

      <div className="w-full px-4 sm:px-6 lg:px-8 py-8">
        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Link href="/admin/inventory" className="bg-white rounded-xl shadow p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-[#118df0]/10 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-[#118df0]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <div className="ml-4">
                <h3 className="text-lg font-semibold text-gray-900">Inventory</h3>
                <p className="text-gray-500">Manage vehicles</p>
              </div>
            </div>
          </Link>

          <Link href="/admin/leads" className="bg-white rounded-xl shadow p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <h3 className="text-lg font-semibold text-gray-900">Leads</h3>
                <p className="text-gray-500">View inquiries</p>
              </div>
            </div>
          </Link>

          <Link href="/admin/import" className="bg-white rounded-xl shadow p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <div className="ml-4">
                <h3 className="text-lg font-semibold text-gray-900">CSV Import</h3>
                <p className="text-gray-500">Bulk upload vehicles</p>
              </div>
            </div>
          </Link>

          {user?.role === 'ADMIN' && (
            <Link href="/admin/users" className="bg-white rounded-xl shadow p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <h3 className="text-lg font-semibold text-gray-900">Users</h3>
                  <p className="text-gray-500">Manage staff</p>
                </div>
              </div>
            </Link>
          )}
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
          <div className="flex flex-wrap gap-4">
            <Link
              href="/admin/inventory/new"
              className="bg-[#118df0] text-white px-6 py-2 rounded-lg font-medium hover:bg-[#0d6ebd] transition-colors"
            >
              + Add Vehicle
            </Link>
            <Link
              href="/admin/import"
              className="border border-[#118df0] text-[#118df0] px-6 py-2 rounded-lg font-medium hover:bg-[#118df0] hover:text-white transition-colors"
            >
              Import CSV
            </Link>
            {user?.role === 'ADMIN' && (
              <Link
                href="/admin/users"
                className="border border-orange-500 text-orange-600 px-6 py-2 rounded-lg font-medium hover:bg-orange-500 hover:text-white transition-colors"
              >
                + Add User
              </Link>
            )}
            <a
              href={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/vehicles/template/csv`}
              className="border border-gray-300 text-gray-700 px-6 py-2 rounded-lg font-medium hover:bg-gray-50 transition-colors"
            >
              Download CSV Template
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
