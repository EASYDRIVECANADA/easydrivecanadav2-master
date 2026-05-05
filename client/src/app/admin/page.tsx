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

type RecentDeal = {
  dealId: string
  customer: string
  vehicle: string
  bosNumber: string
  salesperson: string
  salePrice: number | null
  status: string
  dateIso: string
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
  const [visitorsToday, setVisitorsToday] = useState<number | null>(null)
  const [visitorsWeek, setVisitorsWeek] = useState<number | null>(null)
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
  const [recentActivity, setRecentActivity] = useState<RecentDeal[]>([])

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

  // No redirect — unauthenticated users see the login form below

  const checkAuth = async () => {
    const sessionStr = localStorage.getItem('edc_admin_session')
    console.log('[checkAuth] sessionStr:', sessionStr)
    if (!sessionStr) {
      setUser(null)
      setIsAuthenticated(false)
      setScopedUserId(null)
      setCheckingAuth(false)
      return
    }

    try {
      const parsed = JSON.parse(sessionStr) as { email?: string; role?: string; user_id?: string }
      console.log('[checkAuth] parsed session:', parsed)
      if (parsed?.email) {
        // Fetch fresh role from database to sync with subscription changes
        let currentRole = parsed.role || 'private'
        console.log('[checkAuth] cached role:', currentRole)
        try {
          console.log('[checkAuth] fetching fresh role from API for:', parsed.email)
          const roleRes = await fetch('/api/users/get-role', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: parsed.email }),
          })
          console.log('[checkAuth] API response status:', roleRes.status)
          const roleJson = await roleRes.json().catch(() => null)
          console.log('[checkAuth] API response data:', roleJson)
          if (roleRes.ok && roleJson?.role) {
            currentRole = String(roleJson.role).trim()
            console.log('[checkAuth] updated role from API:', currentRole)
            // Update localStorage with fresh role
            let resolvedUserId = String(parsed?.user_id ?? '').trim()
            if (!resolvedUserId && parsed.email) {
              try {
                const { data: ownerRow } = await supabase
                  .from('users')
                  .select('user_id')
                  .eq('email', String(parsed.email).trim().toLowerCase())
                  .limit(1)
                  .maybeSingle()
                resolvedUserId = String((ownerRow as any)?.user_id ?? '').trim()
              } catch {
                // ignore
              }
            }
            const updatedSession = {
              email: parsed.email,
              role: currentRole,
              user_id: resolvedUserId || undefined,
            }
            localStorage.setItem('edc_admin_session', JSON.stringify(updatedSession))
            console.log('[checkAuth] localStorage updated with new role')
          } else {
            console.log('[checkAuth] API failed or no role, using cached:', currentRole)
          }
        } catch (e) {
          console.error('[checkAuth] API error:', e)
          // Use cached role if API fails
        }
        
        console.log('[checkAuth] final role:', currentRole)
        setUser({ email: parsed.email, role: currentRole })
        setIsAuthenticated(true)
      } else {
        localStorage.removeItem('edc_admin_session')
        setUser(null)
        setIsAuthenticated(false)
        setScopedUserId(null)
      }
    } catch (e) {
      console.error('[checkAuth] parse error:', e)
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

      let resolvedUserId = String((data as any)?.user_id ?? '').trim()
      if (!resolvedUserId) {
        try {
          const { data: ownerRow } = await supabase
            .from('users')
            .select('user_id')
            .eq('email', normalizedEmail)
            .limit(1)
            .maybeSingle()
          resolvedUserId = String((ownerRow as any)?.user_id ?? '').trim()
        } catch {
          // ignore
        }
      }

      const session = {
        email: data.email,
        role: data.role,
        user_id: resolvedUserId || undefined,
      }
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
        .from('users')
        .select('user_id')
        .eq('email', rawEmail)
        .limit(1)
        .maybeSingle()

      if (error) return null
      const resolvedUserId = String((data as any)?.user_id ?? '').trim()
      if (resolvedUserId) {
        const nextSession = {
          ...parsed,
          user_id: resolvedUserId,
        }
        localStorage.setItem('edc_admin_session', JSON.stringify(nextSession))
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('edc_admin_session_changed'))
        }
      }
      return resolvedUserId || null
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

        // Recent activity — last 8 deals from all deals (not just closed), sorted by date desc
        const recent: RecentDeal[] = scopedDeals
          .map((deal: any) => {
            const customer = deal?.customer ?? {}
            const worksheet = deal?.worksheet ?? {}
            const delivery = deal?.delivery ?? {}
            const custName = String(deal?.primaryCustomer ?? '').trim() ||
              [customer?.firstname, customer?.lastname].filter(Boolean).join(' ')
            const vehicle = String(deal?.vehicle ?? '').trim()
            const bosNumber = String(deal?.dealId ?? worksheet?.deal_number ?? '').trim()
            const salesperson = String(delivery?.salesperson ?? deal?.primarySalesperson ?? '').trim()
            const rawPrice = worksheet?.sale_price ?? worksheet?.salePrice ?? deal?.salePrice ?? worksheet?.total ?? null
            const salePrice = rawPrice !== null && rawPrice !== '' ? Number(rawPrice) : null
            const statusRaw = String(
              customer?.deal_state ?? customer?.dealState ?? customer?.dealstate ??
              customer?.state ?? worksheet?.deal_state ?? worksheet?.dealState ??
              delivery?.deal_state ?? delivery?.dealState ?? deal?.state ?? ''
            ).trim()
            const dateRaw = String(
              worksheet?.close_date ?? deal?.closeDate ?? customer?.dealdate ??
              worksheet?.deal_date ?? deal?.dealDate ?? deal?.created_at ?? ''
            ).trim()
            return {
              dealId: String(deal?.dealId ?? '').trim(),
              customer: custName || 'N/A',
              vehicle: vehicle || 'N/A',
              bosNumber,
              salesperson: salesperson || 'N/A',
              salePrice: !isNaN(salePrice as number) && salePrice !== null ? salePrice : null,
              status: statusRaw || 'Open',
              dateIso: dateRaw,
            } satisfies RecentDeal
          })
          .sort((a: { dateIso: string | null }, b: { dateIso: string | null }) => {
            const da = a.dateIso ? new Date(a.dateIso).getTime() : 0
            const db = b.dateIso ? new Date(b.dateIso).getTime() : 0
            return db - da
          })
          .slice(0, 8)
        setRecentActivity(recent)

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

  // Fetch visitor stats independently
  useEffect(() => {
    if (!isAuthenticated) return
    fetch('/api/analytics')
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d) {
          setVisitorsToday(d.todayVisitors ?? 0)
          setVisitorsWeek(d.weekVisitors ?? 0)
        }
      })
      .catch(() => {})
  }, [isAuthenticated])

  const accountFirstName = useMemo(() => {
    const base = user?.email?.toString().trim() || ''
    if (!base || !base.includes('@')) return 'there'
    const local = base.split('@')[0] || ''
    const part = local.split(/[._-]/).filter(Boolean)[0]
    return part ? `${part[0].toUpperCase()}${part.slice(1)}` : 'there'
  }, [user?.email])

  const kpis = useMemo<Kpi[]>(() => {
    const fmt = (n: number | null) => (typeof n === 'number' ? n.toLocaleString() : statsLoading ? '—' : '—')
    const fmtV = (n: number | null) => (typeof n === 'number' ? n.toLocaleString() : '—')

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
      {
        label: 'Visitors Today',
        value: fmtV(visitorsToday),
        sublabel: `${visitorsWeek !== null ? visitorsWeek.toLocaleString() : '—'} this week`,
      },
    ]
  }, [dealsClosed, dealsOpen, inventoryTotal, statsLoading, vendorsTotal, visitorsToday, visitorsWeek])

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
      <div className="min-h-screen flex">
        {/* Left — form panel */}
        <div className="flex flex-col justify-center w-full max-w-md px-10 py-12 bg-white">
          {/* Logo */}
          <div className="mb-10">
            <span className="text-sm font-bold tracking-widest uppercase" style={{ color: '#1aa6ff' }}>EDC</span>
          </div>

          <h1 className="text-2xl font-bold text-gray-900 mb-1">Welcome back</h1>
          <p className="text-sm text-gray-500 mb-8">Sign in to your account.</p>

          {error && (
            <div className="bg-red-50 text-red-700 border border-red-200 rounded-lg px-4 py-3 text-sm mb-6">
              {error}
            </div>
          )}

          <form onSubmit={handleEmailLogin} className="space-y-5">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
              <input
                id="email"
                name="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:border-transparent transition-all"
                style={{ ['--tw-ring-color' as string]: '#1aa6ff' }}
                placeholder="you@example.com"
                autoComplete="email"
                required
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
              <input
                id="password"
                name="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:border-transparent transition-all"
                style={{ ['--tw-ring-color' as string]: '#1aa6ff' }}
                placeholder="••••••••"
                autoComplete="current-password"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 text-white font-semibold py-2.5 rounded-full transition-opacity hover:opacity-90 disabled:opacity-60"
              style={{ background: '#1aa6ff' }}
            >
              {loading ? 'Signing in…' : <>Sign in <span aria-hidden>→</span></>}
            </button>
          </form>

          <p className="mt-6 text-xs text-gray-400 text-center">
            <Link href="/" className="hover:underline">Back to site</Link>
          </p>
        </div>

        {/* Right — image panel */}
        <div
          className="hidden lg:flex flex-1 relative flex-col justify-end p-12 overflow-hidden"
          style={{ background: '#0d182b' }}
        >
          {/* Car background image */}
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: "url('/images/login-cars.jpg')" }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0d182b] via-[#0d182b]/40 to-transparent" />
          <div className="absolute inset-0 bg-[#0d182b]/30" />

          {/* Text */}
          <div className="relative z-10">
            <span
              className="inline-block text-xs font-bold tracking-widest uppercase mb-4 px-3 py-1 rounded-full"
              style={{ color: '#1aa6ff', background: '#1aa6ff1a', border: '1px solid #1aa6ff40' }}
            >
              Dealer Portal
            </span>
            <h2 className="text-3xl font-extrabold text-white leading-snug max-w-xs">
              Manage your inventory, leads, and sales — all in one place.
            </h2>
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
    'Visitors Today': (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
    ),
  }

  const kpiColors: Record<string, string> = {
    'Inventory': '#1EA7FF',
    'Deals Open': '#f59e0b',
    'Deals Closed': '#10b981',
    'Vendors': '#8b5cf6',
    'Visitors Today': '#ef4444',
  }

  return (
    <div className="min-h-screen">
      <div className="px-6 lg:px-8 pt-8 pb-2">
        <h1 className="text-2xl font-bold text-[#0B1F3A]">Welcome back, {accountFirstName}</h1>
        <p className="text-sm text-slate-500 mt-0.5">Here&apos;s what&apos;s happening today.</p>
      </div>

      <div className="px-6 lg:px-8 py-6">
        {statsError ? (
          <div className="rounded-xl p-4 mb-6 border border-red-200/60 bg-red-50/40">
            <div className="text-sm font-semibold text-red-700">Analytics failed to load</div>
            <div className="text-sm text-red-600 mt-0.5">{statsError}</div>
          </div>
        ) : null}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5 mb-8">
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

        {/* Recent Activity */}
        <div className="mt-6 bg-white rounded-2xl border border-slate-200/60 p-6" style={{ boxShadow: '0 1px 3px rgba(0,0,0,.04)' }}>
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm font-bold text-[#0B1F3A]">Recent activity</div>
            <Link href="/admin/sales/deals" className="text-xs font-semibold text-[#1EA7FF] hover:text-[#0B1F3A] transition-colors px-3 py-1.5 rounded-lg hover:bg-[#1EA7FF]/5">
              View all deals
            </Link>
          </div>
          {statsLoading ? (
            <div className="space-y-3">
              {[1,2,3].map(i => (
                <div key={i} className="h-12 rounded-lg bg-slate-50 animate-pulse" />
              ))}
            </div>
          ) : recentActivity.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-400">No recent deals found.</div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {recentActivity.map((d, i) => {
                const statusColor = (() => {
                  const s = d.status.toLowerCase()
                  if (s.includes('closed') || s.includes('delivered') || s.includes('sold')) return 'text-emerald-600'
                  if (s.includes('funded')) return 'text-[#1EA7FF]'
                  if (s.includes('signature') || s.includes('pending')) return 'text-amber-500'
                  if (s.includes('open') || s.includes('new')) return 'text-slate-500'
                  return 'text-slate-500'
                })()
                const displayStatus = d.status
                  ? `${d.status.charAt(0).toUpperCase()}${d.status.slice(1)}`
                  : 'Open'
                return (
                  <li key={d.dealId || i} className="flex items-center justify-between py-3 text-sm">
                    <div className="min-w-0">
                      <div className="font-medium text-[#0B1F3A] truncate">
                        {d.customer} — {d.vehicle}
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5 truncate">
                        {d.bosNumber ? <span className="text-[#1EA7FF] font-medium">{d.bosNumber}</span> : null}
                        {d.bosNumber && d.salesperson ? ' · ' : ''}
                        {d.salesperson}
                      </div>
                    </div>
                    <div className="text-right ml-6 shrink-0">
                      <div className="font-semibold text-[#0B1F3A]">
                        {d.salePrice !== null ? `$${d.salePrice.toLocaleString()}` : '—'}
                      </div>
                      <div className={`text-xs mt-0.5 ${statusColor}`}>{displayStatus}</div>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
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
  const safe = data.slice(-14)
  const max = Math.max(1, ...safe.map((d) => d.value))

  // Chart dimensions
  const W = 500
  const H = 160
  const padL = 8
  const padR = 8
  const padT = 12
  const padB = 28

  const chartW = W - padL - padR
  const chartH = H - padT - padB

  const toX = (i: number) => padL + (i / Math.max(safe.length - 1, 1)) * chartW
  const toY = (v: number) => padT + chartH - (v / max) * chartH

  const points = safe.map((d, i) => ({ x: toX(i), y: toY(d.value), ...d }))
  const polyline = points.map((p) => `${p.x},${p.y}`).join(' ')

  if (loading) {
    return <div className="h-44 rounded-xl bg-slate-50 border border-slate-200/60" />
  }

  if (!safe.length) {
    return (
      <div className="h-44 rounded-xl bg-slate-50 border border-slate-200/60 flex items-center justify-center text-sm text-slate-500">
        No data
      </div>
    )
  }

  // Show ~4 evenly spaced x-axis labels
  const labelIndices = safe.length <= 4
    ? safe.map((_, i) => i)
    : [0, Math.floor(safe.length / 3), Math.floor((2 * safe.length) / 3), safe.length - 1]

  return (
    <div className="rounded-xl border border-slate-200/60 bg-white overflow-hidden">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ height: 176 }}
        aria-label="Sales line chart"
      >
        {/* Horizontal grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((t) => {
          const y = padT + chartH * (1 - t)
          return (
            <line
              key={t}
              x1={padL}
              x2={W - padR}
              y1={y}
              y2={y}
              stroke="#e2e8f0"
              strokeWidth={1}
              strokeDasharray={t === 0 ? undefined : '4 3'}
            />
          )
        })}

        {/* Area fill under the line */}
        <defs>
          <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1EA7FF" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#1EA7FF" stopOpacity="0" />
          </linearGradient>
        </defs>
        {points.length > 1 && (
          <polygon
            points={`${points[0].x},${padT + chartH} ${polyline} ${points[points.length - 1].x},${padT + chartH}`}
            fill="url(#salesGrad)"
          />
        )}

        {/* Line */}
        {points.length > 1 && (
          <polyline
            points={polyline}
            fill="none"
            stroke="#1EA7FF"
            strokeWidth={2.5}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}

        {/* Dots & hit targets */}
        {points.map((p) => {
          const isActive = p.iso === selectedIso
          return (
            <g key={p.iso}>
              <circle
                cx={p.x}
                cy={p.y}
                r={isActive ? 5 : 3.5}
                fill="white"
                stroke="#1EA7FF"
                strokeWidth={isActive ? 2.5 : 2}
              />
              {/* Invisible larger hit area */}
              <circle
                cx={p.x}
                cy={p.y}
                r={12}
                fill="transparent"
                className="cursor-pointer"
                onClick={() => onSelectIso(p.iso)}
              >
                <title>{`${p.label}: ${p.value} deal${p.value !== 1 ? 's' : ''}`}</title>
              </circle>
            </g>
          )
        })}

        {/* X-axis labels */}
        {labelIndices.map((i) => {
          const p = points[i]
          if (!p) return null
          return (
            <text
              key={i}
              x={p.x}
              y={H - 6}
              textAnchor="middle"
              fontSize={10}
              fill="#94a3b8"
            >
              {p.label}
            </text>
          )
        })}
      </svg>
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
