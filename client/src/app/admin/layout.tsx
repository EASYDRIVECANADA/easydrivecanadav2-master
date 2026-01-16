'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'

type AdminSession = {
  email?: string
  role?: string
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [session, setSession] = useState<AdminSession | null>(null)
  const [collapsed, setCollapsed] = useState(false)
  const [salesOpen, setSalesOpen] = useState(false)
  const [reportsOpen, setReportsOpen] = useState(false)
  const [reportsSalesOpen, setReportsSalesOpen] = useState(false)
  const [reportsInventoryOpen, setReportsInventoryOpen] = useState(false)
  const [showSignOutModal, setShowSignOutModal] = useState(false)

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
        return
      }
      try {
        setSession(JSON.parse(s) as AdminSession)
      } catch {
        setSession(null)
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

  const navItems = useMemo(
    () => [
      { href: '/admin', label: 'Home', icon: 'home' },
      { href: '/admin/leads', label: 'Leads', icon: 'phone' },
      { href: '/admin/users', label: 'Customers', icon: 'users' },
      { href: '/admin/import', label: 'Vendors', icon: 'briefcase' },
      { href: '/admin/inventory', label: 'Inventory', icon: 'car' },
      { href: '/admin/sales', label: 'Sales', icon: 'dollar' },
      { href: '/admin', label: 'Service', icon: 'wrench', disabled: true },
      { href: '/admin/reports', label: 'Reports', icon: 'file' },
    ],
    []
  )

  const salesSubItems = useMemo(
    () => [
      { href: '/admin/sales/showroom', label: 'Customer Showroom' },
      { href: '/admin/sales/deals', label: 'Deals' },
      { href: '/admin/sales/deal-adjustor', label: 'Deal Adjustor' },
    ],
    []
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

  const handleSignOut = () => {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem('edc_admin_session')
    }
    setSession(null)
    router.push('/admin')
  }

  if (!isAuthed) {
    return <>{children}</>
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="flex min-h-screen">
        <aside
          className={`${collapsed ? 'w-16' : 'w-60'} bg-gradient-to-b from-slate-900 to-slate-950 text-white flex flex-col transition-[width] duration-200`}
        >
          <div className={`border-b border-white/10 ${collapsed ? 'px-2 py-3' : 'px-4 py-3'}`}>
            {collapsed ? (
              <div className="flex flex-col items-center gap-2">
                <div className="w-11 h-11 rounded-xl bg-[#118df0]/25 border border-[#118df0]/40 flex items-center justify-center overflow-hidden">
                  <Image src="/images/logo.png" alt="EDC" width={28} height={28} className="object-contain" priority />
                </div>
                <button
                  type="button"
                  onClick={toggleCollapsed}
                  className="w-11 h-11 rounded-xl bg-white flex items-center justify-center border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors"
                  aria-label="Expand sidebar"
                  title="Expand"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-11 h-11 rounded-xl bg-[#118df0]/25 border border-[#118df0]/40 flex items-center justify-center overflow-hidden shrink-0">
                      <Image src="/images/logo.png" alt="EDC" width={28} height={28} className="object-contain" priority />
                    </div>
                    <div className="min-w-0 leading-tight">
                      <div className="text-sm font-semibold text-white leading-4">Easy Drive</div>
                      <div className="text-sm font-semibold text-white leading-4">Canada</div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={toggleCollapsed}
                    className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors"
                    aria-label="Collapse sidebar"
                    title="Collapse"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                  </button>
                </div>
                <div className="text-xs text-white/60 mt-1 truncate">{session?.email || ''}</div>
              </>
            )}
          </div>

          <nav className={`${collapsed ? 'px-2 py-3' : 'px-2 py-3'} flex-1`} aria-label="Admin navigation">
            <ul className="space-y-1">
              {navItems.map((item) => {
                const active = pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href))
                const base =
                  `flex items-center ${collapsed ? 'justify-center gap-0 px-2' : 'gap-3 px-4'} py-2.5 rounded-xl text-sm font-medium transition-colors`
                const classes = item.disabled
                  ? `${base} text-white/40 cursor-not-allowed`
                  : active
                    ? `${base} bg-white/10 text-white`
                    : `${base} text-white/80 hover:bg-white/10 hover:text-white`

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
                          <ul className="mt-1 ml-4 pl-3 border-l border-white/10 space-y-1">
                            {salesSubItems.map((sub) => {
                              const subActive = pathname === sub.href
                              const subClasses = subActive
                                ? 'flex items-center justify-between px-4 py-2 rounded-lg text-sm bg-[#118df0]/15 border border-[#118df0]/35 text-white transition-colors'
                                : 'flex items-center justify-between px-4 py-2 rounded-lg text-sm text-white/80 hover:bg-white/10 hover:text-white transition-colors'

                              return (
                                <li key={sub.label}>
                                  <Link
                                    href={sub.href}
                                    className={subClasses}
                                    title={sub.label}
                                  >
                                    <span>{sub.label}</span>
                                  </Link>
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
                          <ul className="mt-1 ml-4 pl-3 border-l border-white/10 space-y-1">
                            <li>
                              <button
                                type="button"
                                onClick={() => {
                                  setReportsSalesOpen((v) => !v)
                                  setReportsInventoryOpen(false)
                                }}
                                className={`w-full flex items-center justify-between px-4 py-2 rounded-lg text-sm transition-colors ${pathname.startsWith('/admin/reports/sales/') ? 'bg-[#118df0]/15 border border-[#118df0]/35 text-white' : 'text-white/80 hover:bg-white/10 hover:text-white'}`}
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
                                <ul className="mt-1 ml-4 pl-3 border-l border-white/10 space-y-1">
                                  {reportsSalesItems.map((sub) => {
                                    const subActive = pathname === sub.href
                                    const subClasses = subActive
                                      ? 'flex items-center justify-between px-4 py-2 rounded-lg text-sm bg-[#118df0]/15 border border-[#118df0]/35 text-white transition-colors'
                                      : 'flex items-center justify-between px-4 py-2 rounded-lg text-sm text-white/80 hover:bg-white/10 hover:text-white transition-colors'

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
                                className={`w-full flex items-center justify-between px-4 py-2 rounded-lg text-sm transition-colors ${pathname.startsWith('/admin/reports/inventory/') ? 'bg-[#118df0]/15 border border-[#118df0]/35 text-white' : 'text-white/80 hover:bg-white/10 hover:text-white'}`}
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
                                <ul className="mt-1 ml-4 pl-3 border-l border-white/10 space-y-1">
                                  {reportsInventoryItems.map((sub) => {
                                    const subActive = pathname === sub.href
                                    const subClasses = subActive
                                      ? 'flex items-center justify-between px-4 py-2 rounded-lg text-sm bg-[#118df0]/15 border border-[#118df0]/35 text-white transition-colors'
                                      : 'flex items-center justify-between px-4 py-2 rounded-lg text-sm text-white/80 hover:bg-white/10 hover:text-white transition-colors'

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
                        <Icon name={item.icon} />
                        {collapsed ? null : <span>{item.label}</span>}
                      </Link>
                    )}
                  </li>
                )
              })}
            </ul>
          </nav>

          <div className={`${collapsed ? 'p-2' : 'p-4'} border-t border-white/10`}>
            <button
              type="button"
              onClick={() => setShowSignOutModal(true)}
              className={`w-full flex items-center justify-center gap-2 ${collapsed ? 'px-2' : 'px-4'} py-2.5 rounded-xl bg-white/10 hover:bg-white/15 transition-colors text-sm font-semibold`}
              title="Sign Out"
            >
              <Icon name="logout" />
              {collapsed ? null : 'Sign Out'}
            </button>
          </div>
        </aside>

        {showSignOutModal ? (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            role="dialog"
            aria-modal="true"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) setShowSignOutModal(false)
            }}
          >
            <div className="absolute inset-0 bg-black/50" />
            <div className="relative w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden">
              <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
                <div className="text-lg font-semibold text-gray-900">Sign out</div>
                <button
                  type="button"
                  className="w-10 h-10 rounded-xl hover:bg-gray-100 flex items-center justify-center"
                  onClick={() => setShowSignOutModal(false)}
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
                  onClick={() => setShowSignOutModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="h-10 px-4 rounded-xl bg-[#118df0] text-white text-sm font-semibold hover:bg-[#0d6ebd]"
                  onClick={() => {
                    setShowSignOutModal(false)
                    handleSignOut()
                  }}
                >
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        ) : null}

        <div className="flex-1 min-w-0">
          <main className="p-0">{children}</main>
        </div>
      </div>
    </div>
  )
}

function Icon({ name }: { name: string }) {
  if (name === 'home') {
    return (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l9-9 9 9M4 10v10a1 1 0 001 1h5m4 0h5a1 1 0 001-1V10" />
      </svg>
    )
  }
  if (name === 'phone') {
    return (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
      </svg>
    )
  }
  if (name === 'users') {
    return (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H2v-2a4 4 0 013-3.87m12 0a4 4 0 00-6 0m6 0a3 3 0 10-6 0M7 11a3 3 0 106 0" />
      </svg>
    )
  }
  if (name === 'briefcase') {
    return (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 6a3 3 0 016 0v1h4a2 2 0 012 2v3H3V9a2 2 0 012-2h4V6z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12v7a2 2 0 002 2h14a2 2 0 002-2v-7" />
      </svg>
    )
  }
  if (name === 'car') {
    return (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 17h10M6 12h12l-1.5-4.5A2 2 0 0014.6 6H9.4a2 2 0 00-1.9 1.5L6 12z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 12v5a1 1 0 001 1h1m8-6v6m0 0h1a1 1 0 001-1v-5" />
      </svg>
    )
  }
  if (name === 'dollar') {
    return (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 1v22m5-18H9a3 3 0 000 6h6a3 3 0 010 6H7" />
      </svg>
    )
  }
  if (name === 'wrench') {
    return (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 2l-2 2m-3 3l-6 6m0 0l-2 2a3 3 0 11-4-4l2-2m4 4l4 4" />
      </svg>
    )
  }
  if (name === 'file') {
    return (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h7l5 5v11a2 2 0 01-2 2z" />
      </svg>
    )
  }
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  )
}
