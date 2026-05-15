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

export type PermissionScope = 'deals' | 'leadsCustomers'
export type DeleteEntity = 'vendors' | 'customers' | 'sales' | 'inventory'

export type AdminSession = {
  email?: string
  role?: string
  user_id?: string
  permissions?: Partial<Record<PermissionKey, boolean>>
}

export type PermissionState = {
  loading: boolean
  session: AdminSession | null
  userId: string
  email: string
  isAdmin: boolean
  permissions: Record<PermissionKey, boolean>
  can: (key: PermissionKey) => boolean
  canAccessRoute: (pathname: string) => boolean
  canViewAll: (scope: PermissionScope) => boolean
  canDelete: (entity: DeleteEntity) => boolean
  refresh: () => Promise<void>
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

const permissionFromRow = (row: any, key: PermissionKey) => Boolean(row?.[key])

export function readAdminSession(): AdminSession | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem('edc_admin_session')
    return raw ? (JSON.parse(raw) as AdminSession) : null
  } catch {
    return null
  }
}

export function pathAllowedByPermissions(
  pathname: string,
  permissions: Record<PermissionKey, boolean>,
  session: AdminSession | null,
  isAdmin: boolean,
) {
  const path = (pathname || '/admin').split('?')[0].replace(/\/+$/, '') || '/admin'
  const email = String(session?.email || '').trim().toLowerCase()
  const can = (key: PermissionKey) => isAdmin || Boolean(permissions[key])
  const isMasterAccount = email === 'info@easydrivecanada.com'

  if (path === '/admin') return true
  if (path === '/admin/sales/deals/signature') return true
  if (path.startsWith('/admin/marketplace')) return true
  if (path.startsWith('/admin/esignature')) return true
  if (path.startsWith('/admin/account')) return true
  if (path.startsWith('/admin/users')) return isAdmin
  if (path.startsWith('/admin/directory')) return isAdmin
  if (path.startsWith('/admin/configuration')) return isAdmin || isMasterAccount
  if (path.startsWith('/admin/settings')) return can('settings')
  if (path.startsWith('/admin/billing')) return can('settings')
  if (path.startsWith('/admin/leads')) return can('customers') || can('access_all_leads_customers')
  if (path.startsWith('/admin/customer') || path.startsWith('/admin/customers')) return can('customers') || can('access_all_leads_customers')
  if (path.startsWith('/admin/vendors')) return can('vendors')
  if (path.startsWith('/admin/inventory')) return can('inventory')
  if (path.startsWith('/admin/import')) return can('inventory')
  if (path.startsWith('/admin/sales')) return can('sales') || can('access_all_deals')
  if (path.startsWith('/admin/reports/sales')) return can('sales_reports_access')
  if (path.startsWith('/admin/reports/inventory/inventory-costs')) return can('inventory_reports_access') && can('costs')
  if (path.startsWith('/admin/reports/inventory')) return can('inventory_reports_access')
  if (path.startsWith('/admin/reports')) return can('sales_reports_access') || can('inventory_reports_access')

  return true
}

export function usePermissions(): PermissionState {
  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState<AdminSession | null>(null)
  const [permissions, setPermissions] = useState<Record<PermissionKey, boolean>>(DEFAULT_PERMISSIONS)
  const [accountValue, setAccountValue] = useState('')

  const refresh = useCallback(async () => {
    const currentSession = readAdminSession()
    setSession(currentSession)

    if (!currentSession?.email && !currentSession?.user_id) {
      setPermissions(DEFAULT_PERMISSIONS)
      setAccountValue('')
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const email = String(currentSession?.email || '').trim().toLowerCase()
      let query = supabase.from('users').select('*').limit(1)
      query = email ? query.ilike('email', email) : query.eq('user_id', String(currentSession?.user_id || '').trim())
      const { data } = await query.maybeSingle()
      const row = data as any
      const next = { ...DEFAULT_PERMISSIONS }
      for (const key of PERMISSION_KEYS) next[key] = permissionFromRow(row, key) || Boolean(currentSession.permissions?.[key])
      setPermissions(next)
      setAccountValue(String(row?.account || '').trim().toLowerCase())
    } catch {
      setPermissions({ ...DEFAULT_PERMISSIONS, ...(currentSession?.permissions || {}) })
      setAccountValue('')
    } finally {
      setLoading(false)
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

  const can = useCallback((key: PermissionKey) => isAdmin || Boolean(permissions[key]), [isAdmin, permissions])

  const canAccessRoute = useCallback(
    (pathname: string) => pathAllowedByPermissions(pathname, permissions, session, isAdmin),
    [isAdmin, permissions, session],
  )

  const canViewAll = useCallback(
    (scope: PermissionScope) => {
      if (isAdmin) return true
      if (scope === 'deals') return Boolean(permissions.access_all_deals)
      return Boolean(permissions.access_all_leads_customers)
    },
    [isAdmin, permissions.access_all_deals, permissions.access_all_leads_customers],
  )

  const canDelete = useCallback(
    (entity: DeleteEntity) => {
      if (isAdmin) return true
      if (entity === 'vendors') return Boolean(permissions.delete_vendors)
      if (entity === 'customers') return Boolean(permissions.delete_customers)
      if (entity === 'sales') return Boolean(permissions.delete_sales)
      return Boolean(permissions.delete_inventory)
    },
    [isAdmin, permissions.delete_customers, permissions.delete_inventory, permissions.delete_sales, permissions.delete_vendors],
  )

  return {
    loading,
    session,
    userId: String(session?.user_id || '').trim(),
    email: String(session?.email || '').trim().toLowerCase(),
    isAdmin,
    permissions,
    can,
    canAccessRoute,
    canViewAll,
    canDelete,
    refresh,
  }
}
