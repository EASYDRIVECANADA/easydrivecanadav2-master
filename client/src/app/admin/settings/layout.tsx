'use client'

import { type ReactNode, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function AdminSettingsLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const [dealership, setDealership] = useState('EASYDRIVE CANADA')
  const [isVerified, setIsVerified] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return

    const read = () => {
      try {
        setIsVerified(window.localStorage.getItem('edc_account_verified') === 'true')
      } catch {
        setIsVerified(false)
      }
    }

    read()

    const onStorage = (e: StorageEvent) => {
      if (e.key === 'edc_account_verified') read()
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

  const tabs = useMemo(
    () =>
      [
        { key: 'dealership', label: 'Dealership Details', href: '/admin/settings/dealership' },
        { key: 'reports', label: 'Reports', href: '/admin/settings/reports' },
        { key: 'users', label: 'Users', href: '/admin/settings/users' },
        { key: 'presets', label: 'Presets', href: '/admin/settings/presets' },
        { key: 'integrations', label: 'Integrations', href: '/admin/settings/integrations' },
        { key: 'billing', label: 'Billing', href: '/admin/settings/billing' },
      ],
    []
  )

  const activeKey = useMemo(() => {
    const p = pathname || ''
    if (p.includes('/admin/settings/reports')) return 'reports'
    if (p.includes('/admin/settings/users')) return 'users'
    if (p.includes('/admin/settings/presets')) return 'presets'
    if (p.includes('/admin/settings/integrations')) return 'integrations'
    if (p.includes('/admin/settings/billing')) return 'billing'
    return 'dealership'
  }, [pathname])

  return (
    <div className="min-h-screen bg-white">
      <div className="w-full px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex items-center gap-3">
          <select
            value={dealership}
            onChange={(e) => setDealership(e.target.value)}
            className="h-8 w-full max-w-[420px] px-2 rounded border border-gray-300 bg-white text-xs font-medium text-gray-800"
          >
            <option value="EASYDRIVE CANADA">EASYDRIVE CANADA</option>
          </select>
        </div>

        <div className="mt-3 border-b border-gray-200">
          <div className="flex flex-wrap items-center gap-4 text-xs font-medium text-gray-600">
            {tabs.map((t) => {
              const selected = activeKey === t.key
              const disabled = !isVerified
              return (
                <Link
                  key={t.key}
                  href={t.href}
                  aria-disabled={disabled}
                  tabIndex={disabled ? -1 : 0}
                  onClick={(e) => {
                    if (disabled) {
                      e.preventDefault()
                      e.stopPropagation()
                    }
                  }}
                  className={
                    disabled
                      ? 'inline-flex items-center gap-1.5 px-2 py-2 border-b-2 border-transparent text-gray-400 cursor-not-allowed'
                      : selected
                        ? 'inline-flex items-center gap-1.5 px-2 py-2 border-b-2 border-[#118df0] text-[#118df0]'
                        : 'inline-flex items-center gap-1.5 px-2 py-2 border-b-2 border-transparent hover:text-gray-900'
                  }
                >
                  {t.key === 'dealership' ? (
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M3 7h18M3 12h18M3 17h18" />
                    </svg>
                  ) : null}
                  {t.key === 'reports' ? (
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M4 19h16M7 16V8m5 8V5m5 11v-6" />
                    </svg>
                  ) : null}
                  {t.key === 'users' ? (
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                      <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M9 11a4 4 0 100-8 4 4 0 000 8z" />
                      <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M23 21v-2a4 4 0 00-3-3.87" />
                      <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M16 3.13a4 4 0 010 7.75" />
                    </svg>
                  ) : null}
                  {t.key === 'presets' ? (
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
                      <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M12 17a5 5 0 100-10 5 5 0 000 10z" />
                    </svg>
                  ) : null}
                  {t.key === 'integrations' ? (
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M10 13a5 5 0 007.07 0l1.41-1.41a5 5 0 00-7.07-7.07L10 4" />
                      <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M14 11a5 5 0 01-7.07 0L5.52 9.59a5 5 0 017.07-7.07L14 4" />
                    </svg>
                  ) : null}
                  {t.key === 'billing' ? (
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M12 1v22" />
                      <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M17 5H9.5a3.5 3.5 0 000 7H14a3.5 3.5 0 010 7H6" />
                    </svg>
                  ) : null}
                  <span>{t.label}</span>
                </Link>
              )
            })}
          </div>
        </div>

        <div className="pt-3">{children}</div>
      </div>
    </div>
  )
}
