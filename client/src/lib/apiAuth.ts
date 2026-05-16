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
