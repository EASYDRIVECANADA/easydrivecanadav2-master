import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const ROLE_LIMITS: Record<string, number> = {
  'small dealership': 3,
  'medium dealership': 5,
  'large dealership': 10,
}

const isPrivateSellerRole = (role: string) => {
  const r = String(role || '').trim().toLowerCase()
  return !r || r === 'starter' || r === 'private seller' || r === 'private'
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as { user_id?: string }
    const userId = String(body?.user_id ?? '').trim()

    if (!userId) {
      return NextResponse.json({ error: 'Missing user_id' }, { status: 400 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, supabaseKey)

    // Get the account role
    const { data: roleRow, error: roleError } = await supabase
      .from('users')
      .select('role')
      .eq('user_id', userId)
      .limit(1)
      .maybeSingle()

    if (roleError) {
      return NextResponse.json({ error: 'Failed to fetch account role' }, { status: 500 })
    }

    const role = String((roleRow as any)?.role || '').trim().toLowerCase()

    // Count current users for this dealership
    const { count, error: countError } = await supabase
      .from('users')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)

    if (countError) {
      return NextResponse.json({ error: 'Failed to count users' }, { status: 500 })
    }

    const currentCount = count ?? 0
    const limit =
      role === 'admin' ? Infinity : isPrivateSellerRole(role) ? 1 : (ROLE_LIMITS[role] ?? 2)
    const canAdd = currentCount < limit

    return NextResponse.json({
      role,
      currentCount,
      limit: limit === Infinity ? null : limit,
      canAdd,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal error' }, { status: 500 })
  }
}
