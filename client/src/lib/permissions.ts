'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

export type PermissionKey =
  | 'access_all_deals'
  | 'access_all_leads_customers'
  | 'administrator'
  | 'approver'
  | 'vendors'
  | 'delete_vendors'
  | 'costs'
  | 'customers'
  | 'delete_customers'
  | 'sales'
  | 'delete_sales'
  | 'inventory'
  | 'delete_inventory'
  | 'settings'
  | 'sales_reports_access'
  | 'inventory_reports_access'

type AdminSession = {
  email?: string
  role?: string
  user_id?: string
}

export const PERMISSION_KEYS: PermissionKey[] = [
  'access_all_deals',
  'access_all_leads_customers',
  'administrator',
  'approver',
  'vendors',
  'delete_vendors',
  'costs',
  'customers',
  'delete_customers',
  'sales',
  'delete_sales',
  'inventory',
  'delete_inventory',
  'settings',
  'sales_reports_access',
  'inventory_reports_access',
]

const DEFAULT_PERMISSIONS = PERMISSION_KEYS.reduce((acc, key) => {
  acc[key] = false
  return acc
}, {} as Record<PermissionKey, boolean>)

const readAdminSession = (): AdminSession | null => {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem('edc_admin_session')
    return raw ? (JSON.parse(raw) as AdminSession) : null
  } catch {
    return null
  }
}

export function usePermissionVisibility() {
  const [session, setSession] = useState<AdminSession | null>(null)
  const [permissions, setPermissions] = useState<Record<PermissionKey, boolean>>(DEFAULT_PERMISSIONS)
  const [accountValue, setAccountValue] = useState('')

  const refresh = useCallback(async () => {
    const currentSession = readAdminSession()
    setSession(currentSession)

    const email = String(currentSession?.email || '').trim().toLowerCase()
    if (!email) {
      setPermissions(DEFAULT_PERMISSIONS)
      setAccountValue('')
      return
    }

    try {
      const { data } = await supabase
        .from('users')
        .select(['account', ...PERMISSION_KEYS].join(','))
        .ilike('email', email)
        .limit(1)
        .maybeSingle()

      const next = { ...DEFAULT_PERMISSIONS }
      for (const key of PERMISSION_KEYS) next[key] = Boolean((data as any)?.[key])
      setPermissions(next)
      setAccountValue(String((data as any)?.account || '').trim().toLowerCase())
    } catch {
      setPermissions(DEFAULT_PERMISSIONS)
      setAccountValue('')
    }
  }, [])

  useEffect(() => {
    void refresh()

    const onStorage = (event: StorageEvent) => {
      if (event.key === 'edc_admin_session') void refresh()
    }
    const onSessionChanged = () => void refresh()

    window.addEventListener('storage', onStorage)
    window.addEventListener('edc_admin_session_changed', onSessionChanged)
    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener('edc_admin_session_changed', onSessionChanged)
    }
  }, [refresh])

  const isAdmin = useMemo(() => {
    const role = String(session?.role || '').trim().toUpperCase()
    return role === 'ADMIN' || permissions.administrator || accountValue === 'admin'
  }, [accountValue, permissions.administrator, session?.role])

  const canShow = useCallback((key: PermissionKey) => {
    if (isAdmin) return true
    if (key === 'access_all_leads_customers') return Boolean(permissions.access_all_leads_customers || permissions.customers)
    if (key === 'access_all_deals') return Boolean(permissions.access_all_deals || permissions.sales)
    return Boolean(permissions[key])
  }, [isAdmin, permissions])

  return {
    session,
    permissions,
    isAdmin,
    canShow,
  }
}
