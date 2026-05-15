/**
 * apiAuth.ts — Server-side auth guard for admin API routes.
 *
 * Usage in any route.ts:
 *   import { requireAdminSession } from '@/lib/apiAuth'
 *   const authError = await requireAdminSession(request)
 *   if (authError) return authError
 */

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

type ServerPermissionKey =
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

type DeleteEntity = 'vendors' | 'customers' | 'sales' | 'inventory'

const PERMISSION_KEYS: ServerPermissionKey[] = [
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

const permissionColumns = [
  'id',
  'user_id',
  'email',
  'role',
  'account',
  'status',
  'session_token',
  ...PERMISSION_KEYS,
].join(',')

export type AdminAuthContext = {
  user: Record<string, any>
  userId: string
  email: string
  isAdmin: boolean
  permissions: Record<ServerPermissionKey, boolean>
  can: (permission: ServerPermissionKey) => boolean
  canViewAll: (scope: 'deals' | 'leadsCustomers') => boolean
  canDelete: (entity: DeleteEntity) => boolean
}

const buildPermissionContext = (row: Record<string, any>, email: string): AdminAuthContext => {
  const permissions = PERMISSION_KEYS.reduce((acc, key) => {
    acc[key] = Boolean(row?.[key])
    return acc
  }, {} as Record<ServerPermissionKey, boolean>)
  const role = String(row?.role || '').trim().toLowerCase()
  const account = String(row?.account || '').trim().toLowerCase()
  const isAdmin = Boolean(permissions.administrator) || role === 'admin' || account === 'admin'
  const userId = String(row?.user_id || row?.id || '').trim()

  return {
    user: row,
    userId,
    email,
    isAdmin,
    permissions,
    can: (permission) => isAdmin || Boolean(permissions[permission]),
    canViewAll: (scope) => {
      if (isAdmin) return true
      if (scope === 'deals') return Boolean(permissions.access_all_deals)
      return Boolean(permissions.access_all_leads_customers)
    },
    canDelete: (entity) => {
      if (isAdmin) return true
      if (entity === 'vendors') return Boolean(permissions.delete_vendors)
      if (entity === 'customers') return Boolean(permissions.delete_customers)
      if (entity === 'sales') return Boolean(permissions.delete_sales)
      return Boolean(permissions.delete_inventory)
    },
  }
}

export async function getAdminAuthContext(request: Request): Promise<{ context: AdminAuthContext | null; error: NextResponse | null }> {
  try {
    const email = String(request.headers.get('x-admin-email') || '').trim().toLowerCase()
    const token = String(request.headers.get('x-admin-token') || '').trim()

    if (!email || !token) {
      return { context: null, error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!supabaseUrl || !supabaseKey) {
      return { context: null, error: NextResponse.json({ error: 'Server not configured' }, { status: 500 }) }
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    })

    const { data, error } = await supabase
      .from('users')
      .select(permissionColumns)
      .ilike('email', email)
      .limit(1)
      .maybeSingle()

    if (error || !data) {
      return { context: null, error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
    }

    const accountStatus = String((data as any)?.status || '').trim().toLowerCase()
    if (accountStatus === 'disable') {
      return { context: null, error: NextResponse.json({ error: 'Account disabled' }, { status: 403 }) }
    }

    const storedToken = String((data as any)?.session_token || '').trim()
    if (storedToken && storedToken !== token) {
      return { context: null, error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
    }

    return { context: buildPermissionContext(data as Record<string, any>, email), error: null }
  } catch {
    return { context: null, error: NextResponse.json({ error: 'Auth check failed' }, { status: 500 }) }
  }
}

export async function requireAdminPermission(request: Request, permission: ServerPermissionKey): Promise<NextResponse | null> {
  const { context, error } = await getAdminAuthContext(request)
  if (error) return error
  if (!context?.can(permission)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  return null
}

export async function requireAdminDeletePermission(request: Request, entity: DeleteEntity): Promise<NextResponse | null> {
  const { context, error } = await getAdminAuthContext(request)
  if (error) return error
  if (!context?.canDelete(entity)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  return null
}

/**
 * Verifies that the request carries a valid admin session.
 * Checks the `x-admin-email` + `x-admin-token` headers sent by the client.
 * Returns a 401 NextResponse if invalid, or null if authorized.
 */
export async function requireAdminSession(request: Request): Promise<NextResponse | null> {
  try {
    const email = String(request.headers.get('x-admin-email') || '').trim().toLowerCase()
    const token = String(request.headers.get('x-admin-token') || '').trim()

    if (!email || !token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    })

    // Verify the session token exists and belongs to an active admin/staff user
    const { data, error } = await supabase
      .from('users')
      .select('id, email, administrator, status, session_token')
      .ilike('email', email)
      .limit(1)
      .maybeSingle()

    if (error || !data) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const accountStatus = String((data as any)?.status || '').trim().toLowerCase()
    if (accountStatus === 'disable') {
      return NextResponse.json({ error: 'Account disabled' }, { status: 403 })
    }

    // If session_token column exists, validate it; otherwise fall back to email-only check
    const storedToken = String((data as any)?.session_token || '').trim()
    if (storedToken && storedToken !== token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    return null // authorized
  } catch {
    return NextResponse.json({ error: 'Auth check failed' }, { status: 500 })
  }
}
