import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

const normalizeEmail = (email: unknown) => String(email || '').trim().toLowerCase()

const getSupabaseServerConfig = () => {
  const supabaseUrl = String(process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '')
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseKey) throw new Error('Supabase server not configured')
  return { supabaseUrl, supabaseKey }
}

const readUserWallet = async (email: string) => {
  const { supabaseUrl, supabaseKey } = getSupabaseServerConfig()
  const q = `${supabaseUrl}/rest/v1/users?select=id,email,balance,esign_unlimited_until&email=eq.${encodeURIComponent(email)}&limit=1`
  const res = await fetch(q, {
    method: 'GET',
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
    },
  })
  const text = await res.text().catch(() => '')
  if (!res.ok) throw new Error(text || `Failed to read user wallet (${res.status})`)
  let rows: any[] = []
  try {
    rows = JSON.parse(text)
  } catch {
    rows = []
  }
  const row = rows?.[0]
  if (!row) throw new Error(`No users row matched email=${email}`)
  const balance = Number(row?.balance ?? 0)
  return {
    id: String(row?.id || ''),
    email: String(row?.email || email),
    balance: Number.isFinite(balance) ? balance : 0,
    esignUnlimitedUntil: (row as any)?.esign_unlimited_until ?? null,
  }
}

const updateUser = async (email: string, patch: { balance?: number; esign_unlimited_until?: string | null }) => {
  const { supabaseUrl, supabaseKey } = getSupabaseServerConfig()
  const patchUrl = `${supabaseUrl}/rest/v1/users?email=eq.${encodeURIComponent(email)}`
  const res = await fetch(patchUrl, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      Prefer: 'return=representation',
    },
    body: JSON.stringify(patch),
  })
  const text = await res.text().catch(() => '')
  if (!res.ok) throw new Error(text || `Failed to update user (${res.status})`)
  if (String(text || '').trim() === '[]') throw new Error(`No users row matched email=${email}`)
  let rows: any[] = []
  try {
    rows = JSON.parse(text)
  } catch {
    rows = []
  }
  return rows?.[0] || null
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as any
    const email = normalizeEmail(body?.email)
    if (!email) return NextResponse.json({ error: 'Missing email' }, { status: 400 })

    const wallet = await readUserWallet(email)

    const cost = 27.99
    if (wallet.balance < cost) {
      return NextResponse.json(
        { error: 'Insufficient Load Balance to buy Unlimited ($27.99 required).', balance: wallet.balance, required: cost },
        { status: 402 }
      )
    }

    const now = Date.now()
    const until = new Date(now + 30 * 24 * 60 * 60 * 1000)
    const untilIso = until.toISOString()

    const nextBalance = Number(wallet.balance) - cost
    const updated = await updateUser(email, { balance: nextBalance, esign_unlimited_until: untilIso })

    return NextResponse.json(
      {
        ok: true,
        email,
        balance: nextBalance,
        esign_unlimited_until: (updated as any)?.esign_unlimited_until ?? untilIso,
      },
      { status: 200 }
    )
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 })
  }
}
