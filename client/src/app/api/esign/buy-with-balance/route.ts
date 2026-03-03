import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

type Tier = 'upto_5'

const normalizeEmail = (email: unknown) => String(email || '').trim().toLowerCase()

const getSupabaseServerConfig = () => {
  const supabaseUrl = String(process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '')
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseKey) throw new Error('Supabase server not configured')
  return { supabaseUrl, supabaseKey }
}

const readUserWallet = async (email: string) => {
  const { supabaseUrl, supabaseKey } = getSupabaseServerConfig()
  const q = `${supabaseUrl}/rest/v1/users?select=id,email,balance,esign_credits&email=eq.${encodeURIComponent(email)}&limit=1`
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
  const credits = Number((row as any)?.esign_credits ?? 0)
  return {
    id: String(row?.id || ''),
    email: String(row?.email || email),
    balance: Number.isFinite(balance) ? balance : 0,
    esignCredits: Number.isFinite(credits) ? credits : 0,
  }
}

const updateUserWallet = async (email: string, patch: { balance?: number; esign_credits?: number }) => {
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
  if (!res.ok) throw new Error(text || `Failed to update user wallet (${res.status})`)
  if (String(text || '').trim() === '[]') throw new Error(`No users row matched email=${email}`)
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as any
    const email = normalizeEmail(body?.email)
    const tier = String(body?.tier || '').trim().toLowerCase() as Tier

    if (!email) return NextResponse.json({ error: 'Missing email' }, { status: 400 })
    if (tier !== 'upto_5') return NextResponse.json({ error: 'Invalid tier' }, { status: 400 })

    const wallet = await readUserWallet(email)

    const cost = 14.99
    if (wallet.balance < cost) {
      return NextResponse.json(
        { error: 'Insufficient Load Balance to buy bundle ($14.99 required).', balance: wallet.balance, required: cost },
        { status: 402 }
      )
    }

    const nextBalance = Number(wallet.balance) - cost
    const nextCredits = Number(wallet.esignCredits) + 5

    await updateUserWallet(email, { balance: nextBalance, esign_credits: nextCredits })

    return NextResponse.json({ ok: true, email, balance: nextBalance, esign_credits: nextCredits }, { status: 200 })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 })
  }
}
