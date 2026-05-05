'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

type AdminSession = {
  email?: string
  role?: string
  user_id?: string
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [session, setSession] = useState<AdminSession | null>(null)
  const [userName, setUserName] = useState<string | null>(null)
  const [profileB64, setProfileB64] = useState<string | null>(null)
  const [accountType, setAccountType] = useState<string | null>(null)
  const [isVerified, setIsVerified] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [accountMenuOpen, setAccountMenuOpen] = useState(false)
  const [salesOpen, setSalesOpen] = useState(false)
  const [reportsOpen, setReportsOpen] = useState(false)
  const [reportsSalesOpen, setReportsSalesOpen] = useState(false)
  const [reportsInventoryOpen, setReportsInventoryOpen] = useState(false)
  const [showSignOutModal, setShowSignOutModal] = useState(false)

  const accountMenuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const inSales = pathname.startsWith('/admin/sales/')
    const inReports = pathname.startsWith('/admin/reports/')
    const inReportsSales = pathname.startsWith('/admin/reports/sales/')
    const inReportsInventory = pathname.startsWith('/admin/reports/inventory/')

    if (inSales) setSalesOpen(true)
    if (inReports) setReportsOpen(true)
    if (inReportsSales) {
      setReportsSalesOpen(true)
      setReportsInventoryOpen(false)
    }
    if (inReportsInventory) {
      setReportsInventoryOpen(true)
      setReportsSalesOpen(false)
    }
  }, [pathname])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const read = () => {
      const s = window.localStorage.getItem('edc_admin_session')
      if (!s) {
        setSession(null)
        setAccountType(null)
        return
      }
      try {
        const parsed = JSON.parse(s) as AdminSession
        setSession(parsed)
        const sessionUserId = String(parsed?.user_id ?? '').trim()
        if (sessionUserId) {
          setIsVerified(true)
          return
        }
      } catch {
        setSession(null)
        setAccountType(null)
      }

      try {
        setIsVerified(window.localStorage.getItem('edc_account_verified') === 'true')
      } catch {
        setIsVerified(false)
      }
    }

    read()

    try {
      const saved = window.localStorage.getItem('edc_admin_sidebar_collapsed')
      if (saved === 'true') setCollapsed(true)
    } catch {
      // ignore
    }

    const onStorage = (e: StorageEvent) => {
      if (e.key === 'edc_admin_session') read()
      if (e.key === 'edc_admin_sidebar_collapsed') setCollapsed(e.newValue === 'true')
      if (e.key === 'edc_account_verified') setIsVerified(e.newValue === 'true')
    }

    const onAdminSessionChanged = () => {
      read()
    }

    window.addEventListener('storage', onStorage)
    window.addEventListener('edc_admin_session_changed', onAdminSessionChanged)
    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener('edc_admin_session_changed', onAdminSessionChanged)
    }
  }, [])

  useEffect(() => {
    const run = async () => {
      try {
        const { data } = await supabase.auth.getSession()
        const fullName = (data.session?.user?.user_metadata as any)?.full_name
        setUserName(typeof fullName === 'string' ? fullName : null)
      } catch {
        setUserName(null)
      }
    }

    void run()
  }, [])

  // Check subscription expiry on page load
  useEffect(() => {
    const userId = String(session?.user_id ?? '').trim()
    const email = String(session?.email ?? '').trim().toLowerCase()

    if (!userId) {
      return
    }

    const checkExpiry = async () => {
      try {
        const res = await fetch('/api/simple-expiry', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: userId, email }),
        })

        const json = await res.json().catch(() => null)

        if (json?.callerStatus === 'disable') {
          // User's account is disabled – log them out
          if (typeof window !== 'undefined') {
            window.localStorage.removeItem('edc_admin_session')
            window.localStorage.removeItem('edc_account_verified')
            window.dispatchEvent(new Event('edc_admin_session_changed'))
            window.location.replace('/account')
          }
        }
      } catch (e: any) {
        console.error('[admin-layout] Expiry check error:', e?.message)
        // Don't block page load on API failure
      }
    }

    void checkExpiry()
  }, [session?.user_id, session?.email])

  useEffect(() => {
    const email = String(session?.email || '').trim().toLowerCase()
    if (!email) {
      setProfileB64(null)
      setAccountType(null)
      return
    }

    const run = async () => {
      try {
        const { data } = await supabase.from('users').select('profile, account').eq('email', email).limit(1).maybeSingle()
        const raw = String((data as any)?.profile || '').trim()
        const accountRaw = String((data as any)?.account || '').trim()
        setProfileB64(raw || null)
        setAccountType(accountRaw || null)
      } catch {
        setProfileB64(null)
        setAccountType(null)
      }
    }

    void run()
  }, [session?.email])

  const profileImgSrc = useMemo(() => {
    const raw = String(profileB64 || '').trim()
    if (!raw) return null
    if (raw.startsWith('data:')) return raw
    if (raw.startsWith('http://') || raw.startsWith('https://')) return raw
    return `data:image/jpeg;base64,${raw}`
  }, [profileB64])

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev
      try {
        if (typeof window !== 'undefined') {
          window.localStorage.setItem('edc_admin_sidebar_collapsed', next ? 'true' : 'false')
        }
      } catch {
        // ignore
      }
      return next
    })
  }

  const isAuthed = !!session
  const hideSidebar = pathname === '/admin/sales/deals/signature'

  const accountFirstName = useMemo(() => {
    const base = (userName || session?.email || '').toString().trim()
    if (!base) return 'Account'

    const cleaned = base.replace(/\s+/g, ' ').trim()
    if (cleaned.includes('@')) {
      const local = cleaned.split('@')[0] || ''
      const part = local.split(/[._-]/).filter(Boolean)[0]
      return part ? `${part[0].toUpperCase()}${part.slice(1)}` : 'Account'
    }

    const first = cleaned.split(' ').filter(Boolean)[0]
    return first ? `${first[0].toUpperCase()}${first.slice(1)}` : 'Account'
  }, [session?.email, userName])

  const accountInitial = useMemo(() => {
    const n = accountFirstName.trim()
    return (n[0] || 'A').toUpperCase()
  }, [accountFirstName])

  const isAdminAccount = useMemo(() => {
    return String(accountType || '').trim().toLowerCase() === 'admin'
  }, [accountType])

  useEffect(() => {
    if (!accountMenuOpen) return

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAccountMenuOpen(false)
    }

    const onMouseDown = (e: MouseEvent) => {
      const el = accountMenuRef.current
      if (!el) return
      if (e.target instanceof Node && !el.contains(e.target)) {
        setAccountMenuOpen(false)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('mousedown', onMouseDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('mousedown', onMouseDown)
    }
  }, [accountMenuOpen])

  const navItems = useMemo(() => {
    const items = [
      { href: '/admin', label: 'Home', icon: 'home', disabled: false },
      { href: '/admin/leads', label: 'Leads', icon: 'phone', disabled: !isVerified },
      { href: '/admin/customer?view=list', label: 'Customers', icon: 'users', disabled: !isVerified },
      { href: '/admin/vendors', label: 'Vendors', icon: 'briefcase', disabled: !isVerified },
      { href: '/admin/marketplace', label: 'Market Place', icon: 'market', disabled: !isVerified },
      { href: '/admin/inventory', label: 'Inventory', icon: 'car', disabled: !isVerified },
      { href: '/admin/sales', label: 'Sales', icon: 'dollar', disabled: false },
      { href: '/admin/esignature', label: 'E-Signature', icon: 'pen', disabled: !isVerified },
      { href: '/admin/reports', label: 'Reports', icon: 'file', disabled: !isVerified },
      { href: '/admin/billing', label: 'Billing', icon: 'billing', disabled: !isVerified },
    ]

    if (isAdminAccount) {
      items.push({ href: '/admin/directory', label: 'Directory', icon: 'users', disabled: false })
    }

    const isMasterAccount = String(session?.email || '').trim().toLowerCase() === 'info@easydrivecanada.com'
    if (isMasterAccount) {
      items.push({ href: '/admin/configuration', label: 'Configuration', icon: 'config', disabled: !isVerified })
    }

    return items
  }, [isVerified, isAdminAccount])

  const salesSubItems = useMemo(
    () => [
      { href: '/admin/sales/showroom', label: 'Customer Showroom', disabled: !isVerified },
      { href: '/admin/sales/deals', label: 'Deals', disabled: !isVerified },
      { href: '/admin/sales/deal-adjustor', label: 'Deal Adjustor', disabled: !isVerified },
    ],
    [isVerified]
  )

  const reportsSalesItems = useMemo(
    () => [
      { href: '/admin/reports/sales/sales-report', label: 'Sales Report' },
      { href: '/admin/reports/sales/transaction-fee-report', label: 'Transaction Fee Report' },
    ],
    []
  )

  const reportsInventoryItems = useMemo(
    () => [
      { href: '/admin/reports/inventory/purchase-summary', label: 'Purchase Summary' },
      { href: '/admin/reports/inventory/keylist', label: 'Keylist' },
      { href: '/admin/reports/inventory/garage-register', label: 'Garage Register' },
      { href: '/admin/reports/inventory/inventory-value', label: 'Inventory Value' },
      { href: '/admin/reports/inventory/inventory-costs', label: 'Inventory Costs' },
    ],
    []
  )

  const handleSignOut = async () => {
    setAccountMenuOpen(false)
    setShowSignOutModal(false)
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.removeItem('edc_admin_session')
        window.localStorage.removeItem('edc_customer_verification')
        window.localStorage.removeItem('edc_account_verified')
        window.localStorage.removeItem('edc_new_vehicle_wizard')
        window.localStorage.removeItem('edc_prefill_next_stock_number')
        window.localStorage.removeItem('edc_oauth_flow')
        Object.keys(window.localStorage)
          .filter((k) => k.startsWith('sb-') || k.includes('supabase'))
          .forEach((k) => window.localStorage.removeItem(k))
      } catch {
        // ignore
      }
      window.dispatchEvent(new Event('edc_admin_session_changed'))
    }

    try {
      await supabase.auth.signOut({ scope: 'local' })
    } catch {
      // ignore
    }
    window.location.href = '/'
  }

  return (
    <div className="min-h-screen">
      <div className="flex min-h-screen">
        {isAuthed && !hideSidebar ? (
          <aside
            className={
              collapsed
                ? 'fixed inset-y-0 left-0 z-40 w-[72px] transition-all duration-300 ease-out flex flex-col min-h-0 h-screen'
                : 'fixed inset-y-0 left-0 z-40 w-60 transition-all duration-300 ease-out flex flex-col min-h-0 h-screen'
            }
            style={{
              background: 'linear-gradient(180deg, #0B1F3A 0%, #081726 60%, #060f1a 100%)',
              borderRight: '1px solid rgba(30,167,255,.08)',
              boxShadow: '4px 0 24px rgba(0,0,0,.3)',
            }}
          >
            <div className={collapsed ? 'py-3 px-2 flex items-center justify-center border-b border-white/[.06]' : 'py-2 px-4 flex items-center border-b border-white/[.06]'}>
              {collapsed ? (
                <Link href="/admin" className="flex items-center justify-center">
                  <div className="relative h-10 w-10 shrink-0">
                    <Image src="/images/logo.png" alt="EDC" fill className="object-contain" />
                  </div>
                </Link>
              ) : (
                <Link href="/admin" className="flex items-center gap-2">
                  <div className="relative h-14 w-14 shrink-0">
                    <Image src="/images/logo.png" alt="EDC" fill className="object-contain" />
                  </div>
                  <div className="leading-tight">
                    <div className="text-[10px] font-semibold uppercase tracking-widest text-white/60">Dealer Portal</div>
                  </div>
                </Link>
              )}
            </div>

            <nav className={`${collapsed ? 'px-2' : 'px-3'} py-4 flex-1 overflow-y-auto min-h-0`} aria-label="Admin navigation" style={{ scrollbarWidth: 'none' }}>
              <ul className="space-y-1">
                {navItems.map((item) => {
                  const hrefPath = item.href.split('?')[0]
                  const active = pathname === hrefPath || (hrefPath !== '/admin' && pathname.startsWith(hrefPath))
                  const base =
                    `relative flex items-center ${collapsed ? 'justify-center gap-0 px-2' : 'gap-3 px-3'} py-2.5 rounded-xl text-[13px] font-medium transition-all duration-300 ease-out`
                  const classes = item.disabled
                    ? `${base} text-white/25 cursor-not-allowed`
                    : active
                      ? `${base} bg-[#1EA7FF]/10 text-white shadow-[inset_0_0_20px_rgba(30,167,255,0.06)]`
                      : `${base} text-white/55 hover:bg-white/[.04] hover:text-white hover:translate-x-0.5`

                  const isSales = item.label === 'Sales'
                  const isReports = item.label === 'Reports'

                  return (
                    <li key={item.label}>
                      {isSales ? (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              if (collapsed) {
                                try {
                                  if (typeof window !== 'undefined') {
                                    window.localStorage.setItem('edc_admin_sidebar_collapsed', 'false')
                                  }
                                } catch {
                                  // ignore
                                }
                                setCollapsed(false)
                                setSalesOpen(true)
                                return
                              }
                              setSalesOpen((v) => !v)
                            }}
                            className={`${classes} w-full ${collapsed ? '' : 'justify-between'}`}
                            title={item.label}
                            aria-expanded={salesOpen}
                          >
                            <span className={`flex items-center ${collapsed ? 'justify-center w-full' : 'gap-3'}`}>
                              <Icon name={item.icon} />
                              {collapsed ? null : <span>{item.label}</span>}
                            </span>
                            {collapsed ? null : (
                              <svg
                                className={`w-4 h-4 transition-transform ${salesOpen ? 'rotate-90' : ''}`}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                            )}
                          </button>

                          {!collapsed && salesOpen ? (
                            <ul className="mt-1 ml-4 pl-3 border-l border-white/[.08] space-y-0.5">
                              {salesSubItems.map((sub) => {
                                const subActive = pathname === sub.href
                                const subClasses = subActive
                                  ? 'flex items-center justify-between px-3 py-1.5 rounded-lg text-[13px] bg-cyan-500/10 text-cyan-400 transition-all duration-200'
                                  : 'flex items-center justify-between px-3 py-1.5 rounded-lg text-[13px] text-white/55 hover:bg-white/[.05] hover:text-white/85 transition-all duration-200'

                                return (
                                  <li key={sub.label}>
                                    {sub.disabled ? (
                                      <div className="flex items-center justify-between px-3 py-1.5 rounded-lg text-[13px] text-white/30 cursor-not-allowed" title={sub.label}>
                                        <span>{sub.label}</span>
                                      </div>
                                    ) : (
                                      <Link href={sub.href} className={subClasses} title={sub.label}>
                                        <span>{sub.label}</span>
                                      </Link>
                                    )}
                                  </li>
                                )
                              })}
                            </ul>
                          ) : null}
                        </>
                      ) : isReports ? (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              if (collapsed) {
                                try {
                                  if (typeof window !== 'undefined') {
                                    window.localStorage.setItem('edc_admin_sidebar_collapsed', 'false')
                                  }
                                } catch {
                                  // ignore
                                }
                                setCollapsed(false)
                                setReportsOpen(true)
                                return
                              }
                              setReportsOpen((v) => !v)
                            }}
                            className={`${classes} w-full ${collapsed ? '' : 'justify-between'}`}
                            title={item.label}
                            aria-expanded={reportsOpen}
                          >
                            <span className={`flex items-center ${collapsed ? 'justify-center w-full' : 'gap-3'}`}>
                              <Icon name={item.icon} />
                              {collapsed ? null : <span>{item.label}</span>}
                            </span>
                            {collapsed ? null : (
                              <svg
                                className={`w-4 h-4 transition-transform ${reportsOpen ? 'rotate-90' : ''}`}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                            )}
                          </button>

                          {!collapsed && reportsOpen ? (
                            <ul className="mt-1 ml-4 pl-3 border-l border-white/[.08] space-y-0.5">
                              <li>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setReportsSalesOpen((v) => !v)
                                    setReportsInventoryOpen(false)
                                  }}
                                  className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-[13px] transition-all duration-200 ${pathname.startsWith('/admin/reports/sales/') ? 'bg-cyan-500/10 text-cyan-400' : 'text-white/55 hover:bg-white/[.05] hover:text-white/85'}`}
                                  aria-expanded={reportsSalesOpen}
                                >
                                  <span className="flex items-center gap-2">
                                    <Icon name="dollar" />
                                    <span>Sales Reports</span>
                                  </span>
                                  <svg
                                    className={`w-4 h-4 transition-transform ${reportsSalesOpen ? 'rotate-90' : ''}`}
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                  </svg>
                                </button>

                                {reportsSalesOpen ? (
                                  <ul className="mt-1 ml-4 pl-3 border-l border-white/[.08] space-y-0.5">
                                    {reportsSalesItems.map((sub) => {
                                      const subActive = pathname === sub.href
                                      const subClasses = subActive
                                        ? 'flex items-center justify-between px-3 py-1.5 rounded-lg text-[13px] bg-cyan-500/10 text-cyan-400 transition-all duration-200'
                                        : 'flex items-center justify-between px-3 py-1.5 rounded-lg text-[13px] text-white/55 hover:bg-white/[.05] hover:text-white/85 transition-all duration-200'

                                      return (
                                        <li key={sub.label}>
                                          <Link
                                            href={sub.href}
                                            className={subClasses}
                                            title={sub.label}
                                          >
                                            <span className="flex items-center gap-2">
                                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 19h16M7 16V8m5 8V5m5 11v-6" />
                                              </svg>
                                              <span>{sub.label}</span>
                                            </span>
                                          </Link>
                                        </li>
                                      )
                                    })}
                                  </ul>
                                ) : null}
                              </li>

                              <li>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setReportsInventoryOpen((v) => !v)
                                    setReportsSalesOpen(false)
                                  }}
                                  className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-[13px] transition-all duration-200 ${pathname.startsWith('/admin/reports/inventory/') ? 'bg-cyan-500/10 text-cyan-400' : 'text-white/55 hover:bg-white/[.05] hover:text-white/85'}`}
                                  aria-expanded={reportsInventoryOpen}
                                >
                                  <span className="flex items-center gap-2">
                                    <Icon name="car" />
                                    <span>Inventory Reports</span>
                                  </span>
                                  <svg
                                    className={`w-4 h-4 transition-transform ${reportsInventoryOpen ? 'rotate-90' : ''}`}
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                  </svg>
                                </button>

                                {reportsInventoryOpen ? (
                                  <ul className="mt-1 ml-4 pl-3 border-l border-white/[.08] space-y-0.5">
                                    {reportsInventoryItems.map((sub) => {
                                      const subActive = pathname === sub.href
                                      const subClasses = subActive
                                        ? 'flex items-center justify-between px-3 py-1.5 rounded-lg text-[13px] bg-cyan-500/10 text-cyan-400 transition-all duration-200'
                                        : 'flex items-center justify-between px-3 py-1.5 rounded-lg text-[13px] text-white/55 hover:bg-white/[.05] hover:text-white/85 transition-all duration-200'

                                      return (
                                        <li key={sub.label}>
                                          <Link
                                            href={sub.href}
                                            className={subClasses}
                                            title={sub.label}
                                          >
                                            <span className="flex items-center gap-2">
                                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h10" />
                                              </svg>
                                              <span>{sub.label}</span>
                                            </span>
                                          </Link>
                                        </li>
                                      )
                                    })}
                                  </ul>
                                ) : null}
                              </li>
                            </ul>
                          ) : null}
                        </>
                      ) : item.disabled ? (
                        <div className={classes} title={item.label}>
                          <Icon name={item.icon} />
                          {collapsed ? null : <span>{item.label}</span>}
                        </div>
                      ) : (
                        <Link href={item.href} className={classes} title={item.label}>
                          {active && !collapsed && (
                            <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-[#1EA7FF]" style={{ boxShadow: '0 0 8px rgba(30,167,255,0.6)' }} />
                          )}
                          <span className={active ? 'text-[#1EA7FF]' : ''}><Icon name={item.icon} /></span>
                          {collapsed ? null : <span>{item.label}</span>}
                        </Link>
                      )}
                    </li>
                  )
                })}
              </ul>
            </nav>

            <div className={`${collapsed ? 'px-2' : 'px-3'} py-3 border-t border-white/[.06]`}>
              <button
                type="button"
                onClick={() => setShowSignOutModal(true)}
                className={`relative flex items-center ${collapsed ? 'justify-center gap-0 px-2' : 'gap-3 px-3'} py-2.5 rounded-xl text-[13px] font-medium text-white/55 hover:bg-white/[.04] hover:text-white transition-all duration-300 ease-out w-full`}
                title="Sign out"
              >
                <svg className="w-[18px] h-[18px] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                {collapsed ? null : <span>Sign out</span>}
              </button>
            </div>
          </aside>
        ) : null}

        <div
          className={`flex flex-1 flex-col min-w-0 ${isAuthed && !hideSidebar ? (collapsed ? 'ml-[72px]' : 'ml-60') : ''} transition-[margin] duration-300 ease-out`}
        >
          {isAuthed && !hideSidebar ? (
            <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-gray-200 bg-white px-4">
              <button
                type="button"
                onClick={toggleCollapsed}
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
                title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <rect x="3" y="3" width="18" height="18" rx="2" strokeWidth={1.5} />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 3v18" />
                </svg>
              </button>
              <div className="hidden flex-1 md:flex">
                <div className="relative w-full max-w-sm">
                  <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    type="search"
                    placeholder="Search vehicles, leads, customers..."
                    className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2 pl-9 pr-3 text-sm text-gray-900 placeholder-gray-400 focus:border-[#1EA7FF] focus:outline-none focus:ring-1 focus:ring-[#1EA7FF]"
                  />
                </div>
              </div>
              <div className="ml-auto flex items-center gap-3">
                <button
                  type="button"
                  className="relative rounded-full p-2 text-gray-500 hover:bg-gray-100 transition-colors"
                  aria-label="Notifications"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                </button>
                <div ref={accountMenuRef} className="relative">
                  <button
                    type="button"
                    onClick={() => setAccountMenuOpen((v) => !v)}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1EA7FF] text-xs font-semibold text-white transition hover:opacity-90 focus:outline-none overflow-hidden"
                    aria-haspopup="menu"
                    aria-expanded={accountMenuOpen}
                    title="Account"
                  >
                    {profileImgSrc ? (
                      <img src={profileImgSrc} alt="Profile" className="h-8 w-8 rounded-full object-cover" />
                    ) : (
                      <span>{accountInitial}</span>
                    )}
                  </button>
                  {accountMenuOpen ? (
                    <div
                      role="menu"
                      className="absolute right-0 top-full mt-1.5 w-48 rounded-xl border border-gray-200 bg-white shadow-lg z-[9999] overflow-hidden"
                    >
                      <Link
                        href="/admin/account"
                        role="menuitem"
                        className="block px-4 py-2.5 text-[13px] text-gray-700 hover:bg-gray-50 transition-colors"
                        onClick={() => setAccountMenuOpen(false)}
                      >
                        My Profile
                      </Link>
                      {isVerified ? (
                        <Link
                          href="/admin/settings/dealership"
                          role="menuitem"
                          className="block px-4 py-2.5 text-[13px] text-gray-700 hover:bg-gray-50 transition-colors"
                          onClick={() => setAccountMenuOpen(false)}
                        >
                          Settings
                        </Link>
                      ) : (
                        <button
                          type="button"
                          role="menuitem"
                          className="w-full text-left px-4 py-2.5 text-[13px] text-gray-300 cursor-not-allowed"
                          disabled
                        >
                          Settings
                        </button>
                      )}
                      <div className="border-t border-gray-100" />
                      <button
                        type="button"
                        role="menuitem"
                        className="w-full text-left px-4 py-2.5 text-[13px] text-gray-700 hover:bg-gray-50 transition-colors"
                        onClick={() => {
                          setAccountMenuOpen(false)
                          setShowSignOutModal(true)
                        }}
                      >
                        Log Out
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            </header>
          ) : null}
          <main style={{ backgroundColor: '#ffffff', minHeight: '100vh' }}>
            {children}
          </main>
        </div>
      </div>

      {showSignOutModal ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          <button
            type="button"
            aria-label="Close"
            onClick={() => setShowSignOutModal(false)}
            className="edc-overlay z-[100]"
          />
          <div className="edc-modal relative z-[101] w-full max-w-sm mx-4 p-6">
            <div className="text-lg font-semibold text-slate-900">Sign out</div>
            <div className="mt-2 text-sm text-slate-500">Are you sure you want to sign out?</div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowSignOutModal(false)}
                className="edc-btn-ghost text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowSignOutModal(false)
                  void handleSignOut()
                }}
                className="edc-btn-primary text-sm"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function Icon({ name }: { name: string }) {
  const cls = 'w-[18px] h-[18px] shrink-0'
  if (name === 'home') {
    return (
      <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l9-9 9 9M4 10v10a1 1 0 001 1h5m4 0h5a1 1 0 001-1V10" />
      </svg>
    )
  }
  if (name === 'phone') {
    return (
      <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
      </svg>
    )
  }
  if (name === 'users') {
    return (
      <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H2v-2a4 4 0 013-3.87m12 0a4 4 0 00-6 0m6 0a3 3 0 10-6 0M7 11a3 3 0 106 0" />
      </svg>
    )
  }
  if (name === 'briefcase') {
    return (
      <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 6a3 3 0 016 0v1h4a2 2 0 012 2v3H3V9a2 2 0 012-2h4V6z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12v7a2 2 0 002 2h14a2 2 0 002-2v-7" />
      </svg>
    )
  }
  if (name === 'market') {
    return (
      <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7l1 2a2 2 0 001.7 1h12.6A2 2 0 0020 9l1-2" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 10l1 10a2 2 0 002 2h8a2 2 0 002-2l1-10" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 7a3 3 0 016 0" />
      </svg>
    )
  }
  if (name === 'car') {
    return (
      <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 17h10M6 12h12l-1.5-4.5A2 2 0 0014.6 6H9.4a2 2 0 00-1.9 1.5L6 12z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 12v5a1 1 0 001 1h1m8-6v6m0 0h1a1 1 0 001-1v-5" />
      </svg>
    )
  }
  if (name === 'dollar') {
    return (
      <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 1v22m5-18H9a3 3 0 000 6h6a3 3 0 010 6H7" />
      </svg>
    )
  }
  if (name === 'billing') {
    return (
      <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 15h2" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 6h12a3 3 0 013 3v6a3 3 0 01-3 3H6a3 3 0 01-3-3V9a3 3 0 013-3z" />
      </svg>
    )
  }
  if (name === 'config') {
    return (
      <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    )
  }
  if (name === 'wrench') {
    return (
      <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 2l-2 2m-3 3l-6 6m0 0l-2 2a3 3 0 11-4-4l2-2m4 4l4 4" />
      </svg>
    )
  }
  if (name === 'file') {
    return (
      <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h7l5 5v11a2 2 0 01-2 2z" />
      </svg>
    )
  }
  if (name === 'pen') {
    return (
      <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
      </svg>
    )
  }
  if (name === 'account') {
    return (
      <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
      </svg>
    )
  }
  return (
    <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
    </svg>
  )
}
