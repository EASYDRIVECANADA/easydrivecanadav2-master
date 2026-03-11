'use client'

import { useMemo, useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
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
          prompt: (momentListener?: (notification: any) => void) => void
        }
      }
    }
  }
}

function InventoryBarsWithDetails({
  loading,
  vehicles,
  month,
  onMonthChange,
  selectedWeek,
  onSelectWeek,
}: {
  loading: boolean
  vehicles: { id: string; year: string; make: string; model: string; stockNumber: string; createdAtIso: string }[]
  month: string
  onMonthChange: (month: string) => void
  selectedWeek: number
  onSelectWeek: (weekIndex: number) => void
}) {
  const monthStart = useMemo(() => {
    const [y, m] = month.split('-').map((n) => Number(n))
    if (!y || !m) return new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    return new Date(y, m - 1, 1)
  }, [month])

  const monthEnd = useMemo(() => {
    const d = new Date(monthStart)
    d.setMonth(d.getMonth() + 1)
    d.setDate(0)
    d.setHours(23, 59, 59, 999)
    return d
  }, [monthStart])

  const weeks = useMemo(() => {
    const y = monthStart.getFullYear()
    const m = monthStart.getMonth()
    const endDay = monthEnd.getDate()
    const ranges = [
      { label: 'Week 1', start: new Date(y, m, 1), end: new Date(y, m, Math.min(7, endDay), 23, 59, 59, 999) },
      { label: 'Week 2', start: new Date(y, m, 8), end: new Date(y, m, Math.min(14, endDay), 23, 59, 59, 999) },
      { label: 'Week 3', start: new Date(y, m, 15), end: new Date(y, m, Math.min(21, endDay), 23, 59, 59, 999) },
      { label: 'Week 4', start: new Date(y, m, 22), end: new Date(y, m, endDay, 23, 59, 59, 999) },
    ]
    return ranges
  }, [monthEnd, monthStart])

  const weekCounts = useMemo(() => {
    return weeks.map((w) => {
      let count = 0
      for (const v of vehicles) {
        if (!v.createdAtIso) continue
        const dt = new Date(v.createdAtIso)
        if (isNaN(dt.getTime())) continue
        if (dt >= w.start && dt <= w.end) count += 1
      }
      return count
    })
  }, [vehicles, weeks])

  const safeSelectedWeek = Math.min(3, Math.max(0, selectedWeek || 0))
  const selectedRange = weeks[safeSelectedWeek]
  const selectedVehicles = useMemo(() => {
    if (!selectedRange) return []
    return vehicles.filter((v) => {
      const dt = new Date(v.createdAtIso)
      if (isNaN(dt.getTime())) return false
      return dt >= selectedRange.start && dt <= selectedRange.end
    })
  }, [selectedRange, vehicles])

  const max = Math.max(1, ...weekCounts)

  if (loading) {
    return <div className="h-56 rounded-xl bg-slate-50 border border-slate-200/60" />
  }

  const monthLabel = monthStart.toLocaleDateString('en-CA', { year: 'numeric', month: 'long' })
  const prevMonth = new Date(monthStart)
  prevMonth.setMonth(prevMonth.getMonth() - 1)
  const nextMonth = new Date(monthStart)
  nextMonth.setMonth(nextMonth.getMonth() + 1)
  const toMonthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="lg:col-span-1 rounded-xl bg-white border border-slate-200/60 p-4 min-h-[14rem]">
        <div className="text-xs font-semibold text-slate-700">Vehicles registered</div>
        <div className="text-[11px] text-slate-500 mt-0.5">{monthLabel} • {weeks[safeSelectedWeek]?.label}</div>
        <div className="mt-3 max-h-44 overflow-auto pr-1">
          {selectedVehicles.length ? (
            <div className="space-y-2">
              {selectedVehicles.map((v) => (
                <div key={v.id} className="rounded-lg border border-slate-200/60 bg-slate-50 px-3 py-2">
                  <div className="text-xs font-semibold text-slate-800">{[v.year, v.make, v.model].filter(Boolean).join(' ') || 'Vehicle'}</div>
                  {v.stockNumber ? <div className="text-[11px] text-slate-500 mt-0.5">Stock: {v.stockNumber}</div> : null}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-slate-500">No vehicles added this week.</div>
          )}
        </div>
      </div>

      <div className="lg:col-span-2 rounded-xl bg-slate-50 border border-slate-200/60 p-4">
        <div className="flex items-baseline justify-between">
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="h-8 px-2 rounded-lg border border-slate-200/60 bg-white text-xs text-slate-700 hover:bg-slate-50 transition-colors"
              onClick={() => onMonthChange(toMonthKey(prevMonth))}
              aria-label="Previous month"
            >
              {'<'}
            </button>
            <div className="text-xs font-semibold text-slate-700">{monthLabel}</div>
            <button
              type="button"
              className="h-8 px-2 rounded-lg border border-slate-200/60 bg-white text-xs text-slate-700 hover:bg-slate-50 transition-colors"
              onClick={() => onMonthChange(toMonthKey(nextMonth))}
              aria-label="Next month"
            >
              {'>'}
            </button>
          </div>
          <div className="text-xs font-semibold text-slate-600">Added this week: {weekCounts[safeSelectedWeek] ?? 0}</div>
        </div>
        <div className="mt-4 h-32 flex items-end gap-6 px-2">
          {weeks.map((w, idx) => {
            const active = idx === safeSelectedWeek
            const value = weekCounts[idx] ?? 0
            const hPct = Math.max(6, Math.round((value / max) * 100))
            return (
              <button
                key={w.label}
                type="button"
                onClick={() => onSelectWeek(idx)}
                className={`flex-1 rounded-lg transition-colors ${active ? 'bg-[#1EA7FF]' : 'bg-[#0B1F3A]/70 hover:bg-[#0B1F3A]'}`}
                style={{ height: `${hPct}%` }}
                title={`${w.label}: ${value}`}
                aria-label={`${w.label}: ${value}`}
              />
            )
          })}
        </div>
        <div className="mt-3 grid grid-cols-4 gap-6 text-[10px] text-slate-500 px-2">
          {weeks.map((w) => (
            <div key={w.label} className="text-center">{w.label}</div>
          ))}
        </div>
      </div>
    </div>
  )
}

interface User {
  email: string
  role: string
}

type Kpi = {
  label: string
  value: string
  sublabel?: string
}

export default function AdminPage() {
  const router = useRouter()
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [user, setUser] = useState<User | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [scopedUserId, setScopedUserId] = useState<string | null>(null)

  const [inventoryTotal, setInventoryTotal] = useState<number | null>(null)
  const [vendorsTotal, setVendorsTotal] = useState<number | null>(null)
  const [dealsTotal, setDealsTotal] = useState<number | null>(null)
  const [dealsOpen, setDealsOpen] = useState<number | null>(null)
  const [dealsClosed, setDealsClosed] = useState<number | null>(null)
  const [salesSeries, setSalesSeries] = useState<{ iso: string; label: string; value: number }[]>([])
  const [salesDealsByDate, setSalesDealsByDate] = useState<
    Record<string, { dealId: string; customer: string; vehicle: string; salesperson: string }[]>
  >({})
  const [selectedSalesIso, setSelectedSalesIso] = useState<string>('')
  const [inventoryVehicles, setInventoryVehicles] = useState<
    { id: string; year: string; make: string; model: string; stockNumber: string; createdAtIso: string }[]
  >([])
  const [isAdminRole, setIsAdminRole] = useState(false)
  const [inventoryMonth, setInventoryMonth] = useState<string>(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
  const [selectedInventoryWeek, setSelectedInventoryWeek] = useState<number>(0)
  const [statsError, setStatsError] = useState<string | null>(null)
  const [statsLoading, setStatsLoading] = useState(false)
  // const router = useRouter(); // Uncomment if needed for navigation

  useEffect(() => {
    checkAuth()

    if (typeof window !== 'undefined') {
      const onSessionChanged = () => {
        void checkAuth()
      }
      const onStorage = (e: StorageEvent) => {
        if (e.key === 'edc_admin_session') void checkAuth()
      }
      window.addEventListener('edc_admin_session_changed', onSessionChanged)
      window.addEventListener('storage', onStorage)
      return () => {
        window.removeEventListener('edc_admin_session_changed', onSessionChanged)
        window.removeEventListener('storage', onStorage)
      }
    }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (checkingAuth) return
    if (isAuthenticated) return
    router.replace('/account')
  }, [checkingAuth, isAuthenticated, router])

  const checkAuth = async () => {
    const sessionStr = localStorage.getItem('edc_admin_session')
    if (!sessionStr) {
      setUser(null)
      setIsAuthenticated(false)
      setScopedUserId(null)
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
        setUser(null)
        setIsAuthenticated(false)
        setScopedUserId(null)
      }
    } catch {
      localStorage.removeItem('edc_admin_session')
      setUser(null)
      setIsAuthenticated(false)
      setScopedUserId(null)
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
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('edc_admin_session_changed'))
      }
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
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('edc_admin_session_changed'))
    }
    setUser(null)
    setIsAuthenticated(false)
    if (typeof window !== 'undefined') {
      window.location.replace('/')
    }
  }

  const getLoggedInAdminDbUserId = async (): Promise<string | null> => {
    try {
      const sessionStr = localStorage.getItem('edc_admin_session')
      if (!sessionStr) return null
      const parsed = JSON.parse(sessionStr) as { email?: string; user_id?: string }
      const sessionUserId = String((parsed as any)?.user_id ?? '').trim()
      if (sessionUserId) return sessionUserId

      const rawEmail = String(parsed?.email ?? '').trim().toLowerCase()
      if (!rawEmail) return null

      const { data, error } = await supabase
        .from('edc_account_verifications')
        .select('id')
        .eq('email', rawEmail)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (error) return null
      return (data as any)?.id ?? null
    } catch {
      return null
    }
  }

  useEffect(() => {
    if (!isAuthenticated) return
    const load = async () => {
      const id = await getLoggedInAdminDbUserId()
      setScopedUserId(id)

      try {
        const sessionStr = typeof window !== 'undefined' ? window.localStorage.getItem('edc_admin_session') : null
        const parsed = sessionStr ? (JSON.parse(sessionStr) as any) : null
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
  }, [isAuthenticated])

  useEffect(() => {
    if (!isAuthenticated) return

    const loadStats = async () => {
      setStatsLoading(true)
      setStatsError(null)

      try {
        const now = new Date()

        let vehiclesQuery = supabase
          .from('edc_vehicles')
          .select('id, created_at, year, make, model, stock_number', { count: 'exact' })
        let vendorsQuery = supabase.from('edc_vendors').select('id', { count: 'exact' })

        if (!isAdminRole) {
          if (!scopedUserId) {
            setInventoryTotal(0)
            setVendorsTotal(0)
            setDealsTotal(0)
            setDealsOpen(0)
            setDealsClosed(0)
            setSalesSeries([])
        setSalesDealsByDate({})
        setSelectedSalesIso('')
            setInventoryVehicles([])
            return
          }
          vehiclesQuery = vehiclesQuery.eq('user_id', scopedUserId)
          vendorsQuery = vendorsQuery.eq('user_id', scopedUserId)
        }

        const [vehiclesRes, vendorsRes, dealsRes] = await Promise.all([
          vehiclesQuery,
          vendorsQuery,
          fetch('/api/deals').then(async (r) => {
            if (!r.ok) throw new Error(`Failed to fetch deals (${r.status})`)
            return r.json()
          }),
        ])

        if (vehiclesRes.error) throw vehiclesRes.error
        if (vendorsRes.error) throw vendorsRes.error

        setInventoryTotal(typeof vehiclesRes.count === 'number' ? vehiclesRes.count : 0)
        const vehiclesRows = (vehiclesRes.data || []) as any[]
        const vehiclesList = vehiclesRows.map((v) => ({
          id: String(v?.id ?? ''),
          year: String(v?.year ?? ''),
          make: String(v?.make ?? ''),
          model: String(v?.model ?? ''),
          stockNumber: String(v?.stock_number ?? ''),
          createdAtIso: String(v?.created_at ?? ''),
        }))
        setInventoryVehicles(vehiclesList)

        setVendorsTotal(typeof vendorsRes.count === 'number' ? vendorsRes.count : 0)

        const dealsAll = Array.isArray(dealsRes?.deals) ? dealsRes.deals : []
        const scopedDeals = isAdminRole
          ? dealsAll
          : dealsAll.filter((d: any) => String(d?.customer?.user_id ?? '').trim() === scopedUserId)
        setDealsTotal(scopedDeals.length)

        const openDeals = scopedDeals.filter((d: any) => {
          const state = String(d?.state ?? '').trim().toUpperCase()
          return state && state !== 'SOLD' && state !== 'CLOSED' && state !== 'CLOSED ' && state !== 'CLOSED DEAL'
        })

        const closedDeals = scopedDeals.filter((d: any) => {
          const customer = d?.customer ?? {}
          const worksheet = d?.worksheet ?? {}
          const delivery = d?.delivery ?? {}
          const stateRaw = String(
            customer?.deal_state ??
              customer?.dealState ??
              customer?.dealstate ??
              customer?.state ??
              worksheet?.deal_state ??
              worksheet?.dealState ??
              worksheet?.dealstate ??
              delivery?.deal_state ??
              delivery?.dealState ??
              delivery?.dealstate ??
              d?.state ??
              ''
          ).trim()
          return stateRaw.toLowerCase() === 'closed'
        })

        setDealsOpen(openDeals.length)
        setDealsClosed(closedDeals.length)

        const salesStart = new Date(now)
        salesStart.setDate(salesStart.getDate() - 29)
        salesStart.setHours(0, 0, 0, 0)

        const buckets: Record<string, number> = {}
        const byDate: Record<string, { dealId: string; customer: string; vehicle: string; salesperson: string }[]> = {}
        for (let i = 0; i < 30; i++) {
          const d = new Date(salesStart)
          d.setDate(salesStart.getDate() + i)
          const key = d.toISOString().slice(0, 10)
          buckets[key] = 0
          byDate[key] = []
        }

        for (const deal of closedDeals) {
          const customer = deal?.customer ?? {}
          const worksheet = deal?.worksheet ?? {}
          const delivery = deal?.delivery ?? {}
          const raw = String(worksheet?.close_date ?? deal?.closeDate ?? customer?.dealdate ?? worksheet?.deal_date ?? deal?.dealDate ?? '').trim()
          if (!raw) continue
          const dt = new Date(raw)
          if (isNaN(dt.getTime())) continue
          const key = dt.toISOString().slice(0, 10)
          if (key in buckets) {
            buckets[key] += 1

            const dealId = String(deal?.dealId ?? '').trim()
            const custName = String(deal?.primaryCustomer ?? '').trim() || [customer?.firstname, customer?.lastname].filter(Boolean).join(' ')
            const vehicle = String(deal?.vehicle ?? '').trim()
            const salesperson = String(delivery?.salesperson ?? deal?.primarySalesperson ?? '').trim()
            byDate[key].push({
              dealId,
              customer: custName || 'N/A',
              vehicle: vehicle || 'N/A',
              salesperson: salesperson || 'N/A',
            })
          }
        }

        const series = Object.entries(buckets)
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([iso, value]) => {
            const dt = new Date(`${iso}T00:00:00`)
            return { iso, label: dt.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' }), value }
          })
        setSalesSeries(series)
        setSalesDealsByDate(byDate)
        setSelectedSalesIso((prev) => (prev && prev in byDate ? prev : ''))

      } catch (e: any) {
        setStatsError(e?.message || 'Failed to load analytics')
        setInventoryTotal(null)
        setVendorsTotal(null)
        setDealsTotal(null)
        setDealsOpen(null)
        setDealsClosed(null)
        setSalesSeries([])
        setInventoryVehicles([])
      } finally {
        setStatsLoading(false)
      }
    }

    void loadStats()
  }, [isAdminRole, isAuthenticated, scopedUserId])

  const kpis = useMemo<Kpi[]>(() => {
    const fmt = (n: number | null) => (typeof n === 'number' ? n.toLocaleString() : statsLoading ? '—' : '—')

    return [
      {
        label: 'Inventory',
        value: fmt(inventoryTotal),
        sublabel: 'Vehicles in your lot',
      },
      {
        label: 'Deals Open',
        value: fmt(dealsOpen),
        sublabel: 'In progress',
      },
      {
        label: 'Deals Closed',
        value: fmt(dealsClosed),
        sublabel: 'Sold / Closed',
      },
      {
        label: 'Vendors',
        value: fmt(vendorsTotal),
        sublabel: 'Saved contacts',
      },
    ]
  }, [dealsClosed, dealsOpen, inventoryTotal, statsLoading, vendorsTotal])

  if (checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="loading-ring mx-auto" />
          <p className="loading-text">Loading...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4"
        style={{ background: 'linear-gradient(135deg, #0B1C2D 0%, #1a2e44 50%, #0B1C2D 100%)' }}
      >
        <div className="w-full max-w-md animate-scale-in">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-white tracking-tight">Welcome Back</h1>
            <p className="text-sm text-white/50 mt-1">Sign in to your dealership portal</p>
          </div>

          <div className="bg-white/[.06] backdrop-blur-xl rounded-2xl border border-white/[.08] p-8 shadow-2xl">
            {error && (
              <div className="bg-danger-500/10 text-danger-400 border border-danger-500/20 p-3 rounded-xl mb-5 text-sm font-medium">
                {error}
              </div>
            )}

            <form onSubmit={handleEmailLogin}>
              <div className="mb-5">
                <label htmlFor="email" className="block text-[13px] font-medium text-white/70 mb-1.5">Email</label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-white/[.07] border border-white/[.1] rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-500/40 transition-all"
                  placeholder="your@email.com"
                  autoComplete="email"
                  required
                />
              </div>
              <div className="mb-5">
                <label htmlFor="password" className="block text-[13px] font-medium text-white/70 mb-1.5">Password</label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-white/[.07] border border-white/[.1] rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-500/40 transition-all"
                  placeholder="Enter access code"
                  autoComplete="current-password"
                  required
                />
              </div>
              <div className="mb-6 text-right">
                <Link href="/forgot-password" className="text-[13px] text-cyan-400 hover:text-cyan-300 transition-colors">
                  Forgot Password?
                </Link>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="edc-btn-cyan w-full py-3 text-sm"
              >
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
            </form>
          </div>
        </div>
      </div>
    )
  }

  const kpiIcons: Record<string, React.ReactNode> = {
    'Inventory': (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 17h10M6 12h12l-1.5-4.5A2 2 0 0014.6 6H9.4a2 2 0 00-1.9 1.5L6 12z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 12v5a1 1 0 001 1h1m8-6v6m0 0h1a1 1 0 001-1v-5" /></svg>
    ),
    'Deals Open': (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h7l5 5v11a2 2 0 01-2 2z" /></svg>
    ),
    'Deals Closed': (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
    ),
    'Vendors': (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0H5m14 0h2m-16 0H3m5-12h4m-4 4h4" /></svg>
    ),
  }

  const kpiColors: Record<string, string> = {
    'Inventory': '#1EA7FF',
    'Deals Open': '#f59e0b',
    'Deals Closed': '#10b981',
    'Vendors': '#8b5cf6',
  }

  return (
    <div className="min-h-screen">
      <div className="px-6 lg:px-8 pt-8 pb-2">
        <h1 className="text-2xl font-bold text-[#0B1F3A]">Dashboard</h1>
        <p className="text-sm text-slate-500 mt-0.5">Welcome back, {user?.email}</p>
      </div>

      <div className="px-6 lg:px-8 py-6">
        {statsError ? (
          <div className="rounded-xl p-4 mb-6 border border-red-200/60 bg-red-50/40">
            <div className="text-sm font-semibold text-red-700">Analytics failed to load</div>
            <div className="text-sm text-red-600 mt-0.5">{statsError}</div>
          </div>
        ) : null}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
          {kpis.map((k) => {
            const color = kpiColors[k.label] || '#1EA7FF'
            return (
              <div
                key={k.label}
                className="group relative bg-white rounded-2xl border border-slate-200/60 p-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg cursor-default"
                style={{ boxShadow: '0 1px 3px rgba(0,0,0,.04)' }}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{k.label}</div>
                    <div className="mt-2 text-3xl font-bold text-[#0B1F3A]">{k.value}</div>
                    {k.sublabel ? <div className="mt-1 text-xs text-slate-400">{k.sublabel}</div> : null}
                  </div>
                  <div
                    className="flex items-center justify-center w-11 h-11 rounded-xl transition-all duration-300 group-hover:scale-110"
                    style={{ backgroundColor: `${color}10`, color }}
                  >
                    {kpiIcons[k.label]}
                  </div>
                </div>
                <div className="absolute bottom-0 left-4 right-4 h-[2px] rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300" style={{ background: `linear-gradient(90deg, ${color}, transparent)` }} />
              </div>
            )
          })}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl border border-slate-200/60 p-6" style={{ boxShadow: '0 1px 3px rgba(0,0,0,.04)' }}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-bold text-[#0B1F3A]">Sales</div>
                <div className="text-xs text-slate-500 mt-0.5">Closed deals (Sales Report)</div>
              </div>
              <Link href="/admin/reports/sales/sales-report" className="text-xs font-semibold text-[#1EA7FF] hover:text-[#0B1F3A] transition-colors px-3 py-1.5 rounded-lg hover:bg-[#1EA7FF]/5">
                View report
              </Link>
            </div>

            <div className="mt-5 grid grid-cols-1 md:grid-cols-[1fr_280px] gap-4 items-start">
              <BarChart
                data={salesSeries}
                loading={statsLoading}
                selectedIso={selectedSalesIso}
                onSelectIso={(iso) => setSelectedSalesIso(iso)}
              />

              <div className="h-36 rounded-xl bg-slate-50 border border-slate-200/60 p-3 overflow-hidden">
                {selectedSalesIso ? (
                  <>
                    <div className="text-[11px] font-semibold text-slate-700">
                      {selectedSalesIso}
                    </div>
                    <div className="mt-2 h-[92px] overflow-auto pr-1 space-y-2">
                      {(salesDealsByDate[selectedSalesIso] || []).length ? (
                        (salesDealsByDate[selectedSalesIso] || []).map((d) => (
                          <div key={d.dealId || `${d.customer}-${d.vehicle}`} className="text-[11px] text-slate-600">
                            <div className="font-semibold text-slate-800 truncate">{d.customer}</div>
                            <div className="truncate">{d.vehicle}</div>
                            <div className="text-slate-500 truncate">{d.salesperson}</div>
                          </div>
                        ))
                      ) : (
                        <div className="text-[11px] text-slate-500">No closed deals for this date.</div>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="h-full flex items-center justify-center text-xs text-slate-500 text-center px-2">
                    Click a bar to view the closed deals for that close date.
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/60 p-6" style={{ boxShadow: '0 1px 3px rgba(0,0,0,.04)' }}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-bold text-[#0B1F3A]">Inventory</div>
                <div className="text-xs text-slate-500 mt-0.5">Monthly view • Weekly breakdown</div>
              </div>
              <Link href="/admin/inventory" className="text-xs font-semibold text-[#1EA7FF] hover:text-[#0B1F3A] transition-colors px-3 py-1.5 rounded-lg hover:bg-[#1EA7FF]/5">
                View inventory
              </Link>
            </div>

            <div className="mt-5">
              <InventoryBarsWithDetails
                loading={statsLoading}
                vehicles={inventoryVehicles}
                month={inventoryMonth}
                onMonthChange={(m) => {
                  setInventoryMonth(m)
                  setSelectedInventoryWeek(0)
                }}
                selectedWeek={selectedInventoryWeek}
                onSelectWeek={setSelectedInventoryWeek}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function BarChart({
  data,
  loading,
  selectedIso,
  onSelectIso,
}: {
  data: { iso: string; label: string; value: number }[]
  loading: boolean
  selectedIso: string
  onSelectIso: (iso: string) => void
}) {
  const max = Math.max(1, ...data.map((d) => d.value))
  const safe = data.slice(-14)

  if (loading) {
    return <div className="h-36 rounded-xl bg-slate-50 border border-slate-200/60" />
  }

  if (!safe.length) {
    return (
      <div className="h-36 rounded-xl bg-slate-50 border border-slate-200/60 flex items-center justify-center text-sm text-slate-500">
        No data
      </div>
    )
  }

  return (
    <div className="h-36 rounded-xl bg-slate-50 border border-slate-200/60 px-4 py-3">
      <div className="h-full flex items-end gap-2">
        {safe.map((d) => {
          const hPct = Math.max(4, Math.round((d.value / max) * 100))
          const isActive = selectedIso && d.iso === selectedIso
          return (
            <button
              key={d.iso}
              type="button"
              className={
                isActive
                  ? 'flex-1 rounded-lg bg-[#1EA7FF] cursor-pointer ring-2 ring-[#1EA7FF]/30'
                  : 'flex-1 rounded-lg bg-[#0B1F3A]/70 cursor-pointer hover:bg-[#0B1F3A] transition-colors'
              }
              style={{ height: `${hPct}%` }}
              title={`${d.label}: ${d.value}`}
              onClick={() => onSelectIso(d.iso)}
            />
          )
        })}
      </div>
      <div className="mt-2 flex justify-between text-[10px] text-slate-500">
        <span>{safe[0]?.label}</span>
        <span>{safe[safe.length - 1]?.label}</span>
      </div>
    </div>
  )
}

function InventoryMonthWidget({
  loading,
  vehicles,
}: {
  loading: boolean
  vehicles: { id: string; year: string; make: string; model: string; stockNumber: string; createdAtIso: string }[]
}) {
  const [month, setMonth] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
  const [selectedWeek, setSelectedWeek] = useState(0)

  const monthStart = useMemo(() => {
    const [y, m] = month.split('-').map((n) => Number(n))
    if (!y || !m) return new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    return new Date(y, m - 1, 1)
  }, [month])

  const monthEnd = useMemo(() => {
    const d = new Date(monthStart)
    d.setMonth(d.getMonth() + 1)
    d.setDate(0)
    d.setHours(23, 59, 59, 999)
    return d
  }, [monthStart])

  const weeks = useMemo(() => {
    const y = monthStart.getFullYear()
    const m = monthStart.getMonth()
    const endDay = monthEnd.getDate()
    return [
      { label: 'Week 1', start: new Date(y, m, 1), end: new Date(y, m, Math.min(7, endDay), 23, 59, 59, 999) },
      { label: 'Week 2', start: new Date(y, m, 8), end: new Date(y, m, Math.min(14, endDay), 23, 59, 59, 999) },
      { label: 'Week 3', start: new Date(y, m, 15), end: new Date(y, m, Math.min(21, endDay), 23, 59, 59, 999) },
      { label: 'Week 4', start: new Date(y, m, 22), end: new Date(y, m, endDay, 23, 59, 59, 999) },
    ]
  }, [monthEnd, monthStart])

  const weekCounts = useMemo(() => {
    return weeks.map((w) => {
      let count = 0
      for (const v of vehicles) {
        const dt = new Date(v.createdAtIso)
        if (isNaN(dt.getTime())) continue
        if (dt >= w.start && dt <= w.end) count += 1
      }
      return count
    })
  }, [vehicles, weeks])

  const safeSelectedWeek = Math.min(3, Math.max(0, selectedWeek || 0))
  const selectedRange = weeks[safeSelectedWeek]
  const selectedVehicles = useMemo(() => {
    if (!selectedRange) return []
    return vehicles.filter((v) => {
      const dt = new Date(v.createdAtIso)
      if (isNaN(dt.getTime())) return false
      return dt >= selectedRange.start && dt <= selectedRange.end
    })
  }, [selectedRange, vehicles])

  const max = Math.max(1, ...weekCounts)
  const monthLabel = monthStart.toLocaleDateString('en-CA', { year: 'numeric', month: 'long' })
  const prevMonth = new Date(monthStart)
  prevMonth.setMonth(prevMonth.getMonth() - 1)
  const nextMonth = new Date(monthStart)
  nextMonth.setMonth(nextMonth.getMonth() + 1)
  const toMonthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`

  if (loading) {
    return <div className="h-56 rounded-xl bg-slate-50 border border-slate-200/60" />
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="lg:col-span-1 rounded-xl bg-white border border-slate-200/60 p-4 min-h-[14rem]">
        <div className="text-xs font-semibold text-slate-700">Vehicles registered</div>
        <div className="text-[11px] text-slate-500 mt-0.5">{monthLabel} • {weeks[safeSelectedWeek]?.label}</div>
        <div className="mt-3 max-h-44 overflow-auto pr-1">
          {selectedVehicles.length ? (
            <div className="space-y-2">
              {selectedVehicles.map((v) => (
                <div key={v.id} className="rounded-lg border border-slate-200/60 bg-slate-50 px-3 py-2">
                  <div className="text-xs font-semibold text-slate-800">{[v.year, v.make, v.model].filter(Boolean).join(' ') || 'Vehicle'}</div>
                  {v.stockNumber ? <div className="text-[11px] text-slate-500 mt-0.5">Stock: {v.stockNumber}</div> : null}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-slate-500">No vehicles added this week.</div>
          )}
        </div>
      </div>

      <div className="lg:col-span-2 rounded-xl bg-slate-50 border border-slate-200/60 p-4">
        <div className="flex items-baseline justify-between">
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="h-8 px-2 rounded-lg border border-slate-200/60 bg-white text-xs text-slate-700 hover:bg-slate-50 transition-colors"
              onClick={() => {
                setMonth(toMonthKey(prevMonth))
                setSelectedWeek(0)
              }}
              aria-label="Previous month"
            >
              {'<'}
            </button>
            <div className="text-xs font-semibold text-slate-700">{monthLabel}</div>
            <button
              type="button"
              className="h-8 px-2 rounded-lg border border-slate-200/60 bg-white text-xs text-slate-700 hover:bg-slate-50 transition-colors"
              onClick={() => {
                setMonth(toMonthKey(nextMonth))
                setSelectedWeek(0)
              }}
              aria-label="Next month"
            >
              {'>'}
            </button>
          </div>
          <div className="text-xs font-semibold text-slate-600">Added this week: {weekCounts[safeSelectedWeek] ?? 0}</div>
        </div>
        <div className="mt-4 h-32 flex items-end gap-6 px-2">
          {weeks.map((w, idx) => {
            const active = idx === safeSelectedWeek
            const value = weekCounts[idx] ?? 0
            const hPct = Math.max(6, Math.round((value / max) * 100))
            return (
              <button
                key={w.label}
                type="button"
                onClick={() => setSelectedWeek(idx)}
                className={`flex-1 rounded-lg transition-colors ${active ? 'bg-[#1EA7FF]' : 'bg-[#0B1F3A]/70 hover:bg-[#0B1F3A]'}`}
                style={{ height: `${hPct}%` }}
                title={`${w.label}: ${value}`}
                aria-label={`${w.label}: ${value}`}
              />
            )
          })}
        </div>
        <div className="mt-3 grid grid-cols-4 gap-6 text-[10px] text-slate-500 px-2">
          {weeks.map((w) => (
            <div key={w.label} className="text-center">{w.label}</div>
          ))}
        </div>
      </div>
    </div>
  )
}
