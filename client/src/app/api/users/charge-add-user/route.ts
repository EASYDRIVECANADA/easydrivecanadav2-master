import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

const normalizeEmail = (email: unknown) => String(email || '').trim().toLowerCase()

const getSupabaseServerConfig = () => {
  const supabaseUrl = String(process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '')
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseKey) throw new Error('Supabase server not configured')
  return { supabaseUrl, supabaseKey }
}

const isPrivateSellerRole = (role: string) => {
  const r = String(role || '').trim().toLowerCase()
  return !r || r === 'starter' || r === 'private seller' || r === 'private' || r === 'starter plan' || r === 'starter_account' || r === 'starteraccount' || r === 'starteraccount'
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as { email?: string; user_id?: string }
    const email = normalizeEmail(body?.email)
    const userId = String(body?.user_id || '').trim()

    if (!email) return NextResponse.json({ ok: false, error: 'Missing email' }, { status: 400 })
    if (!userId) return NextResponse.json({ ok: false, error: 'Missing user_id' }, { status: 400 })

    const { supabaseUrl, supabaseKey } = getSupabaseServerConfig()

    // Load account role from the dealership account.
    const roleRes = await fetch(
      `${supabaseUrl}/rest/v1/users?select=role&user_id=eq.${encodeURIComponent(userId)}&limit=1`,
      {
        method: 'GET',
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
        },
      }
    )
    const roleText = await roleRes.text().catch(() => '')
    if (!roleRes.ok) {
      return NextResponse.json({ ok: false, error: roleText || `Failed to fetch role (${roleRes.status})` }, { status: 500 })
    }

    let role = ''
    try {
      const rows = JSON.parse(roleText || '[]') as any[]
      role = String(rows?.[0]?.role || '')
    } catch {
      role = ''
    }

    // Only Private Seller uses this per-use deduction model. Premier and other paid roles get unlimited access.
    if (!isPrivateSellerRole(role)) {
      return NextResponse.json({ ok: true, charged: false, reason: 'unlimited_access' }, { status: 200 })
    }

    // Count current users for this dealership.
    const countRes = await fetch(
      `${supabaseUrl}/rest/v1/users?select=id&user_id=eq.${encodeURIComponent(userId)}`,
      {
        method: 'GET',
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
        },
      }
    )
    const countText = await countRes.text().catch(() => '')
    if (!countRes.ok) {
      return NextResponse.json({ ok: false, error: countText || `Failed to count users (${countRes.status})` }, { status: 500 })
    }
    let currentCount = 0
    try {
      const rows = JSON.parse(countText || '[]') as any[]
      currentCount = Array.isArray(rows) ? rows.length : 0
    } catch {
      currentCount = 0
    }

    // Private Seller includes 1 user. Only charge when adding beyond 1.
    if (currentCount < 1) {
      return NextResponse.json({ ok: true, charged: false, reason: 'within_included_limit' }, { status: 200 })
    }

    const walletRes = await fetch(
      `${supabaseUrl}/rest/v1/users?select=email,balance&email=eq.${encodeURIComponent(email)}&limit=1`,
      {
        method: 'GET',
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
        },
      }
    )

    const walletText = await walletRes.text().catch(() => '')
    if (!walletRes.ok) {
      return NextResponse.json(
        {
          ok: false,
          error:
            walletText || `Failed to read wallet (${walletRes.status}). Ensure users table has balance column.`,
        },
        { status: 500 }
      )
    }

    let currentBalance = 0
    try {
      const rows = JSON.parse(walletText || '[]') as any[]
      const row = rows?.[0]
      currentBalance = Number(row?.balance ?? 0)
    } catch {
      currentBalance = 0
    }

    const safeBalance = Number.isFinite(currentBalance) ? currentBalance : 0

    const cost = 5
    if (safeBalance < cost) {
      return NextResponse.json(
        { ok: false, error: 'Insufficient Load Balance ($5 required).', balance: safeBalance, required: cost },
        { status: 402 }
      )
    }

    const nextBalance = safeBalance - cost

    const patchRes = await fetch(`${supabaseUrl}/rest/v1/users?email=eq.${encodeURIComponent(email)}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        Prefer: 'return=representation',
      },
      body: JSON.stringify({ balance: nextBalance }),
    })

    const patchText = await patchRes.text().catch(() => '')
    if (!patchRes.ok) {
      return NextResponse.json(
        {
          ok: false,
          error:
            patchText || `Failed to update wallet (${patchRes.status}).`,
        },
        { status: 500 }
      )
    }

    return NextResponse.json(
      {
        ok: true,
        charged: true,
        cost,
        balance: nextBalance,
      },
      { status: 200 }
    )
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Server error' }, { status: 500 })
  }
}
