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
  console.log('[updateUser] Starting update for:', email, 'patch:', patch)
  const { supabaseUrl, supabaseKey } = getSupabaseServerConfig()
  const patchUrl = `${supabaseUrl}/rest/v1/users?email=eq.${encodeURIComponent(email)}`
  console.log('[updateUser] Patch URL:', patchUrl)
  
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
  console.log('[updateUser] Response:', { ok: res.ok, status: res.status, text })
  
  if (!res.ok) throw new Error(text || `Failed to update user (${res.status})`)
  if (String(text || '').trim() === '[]') throw new Error(`No users row matched email=${email}`)
  
  let rows: any[] = []
  try {
    rows = JSON.parse(text)
  } catch {
    rows = []
  }
  
  const updatedRow = rows?.[0] || null
  console.log('[updateUser] Updated row:', updatedRow)
  return updatedRow
}

export async function POST(request: Request) {
  try {
    console.log('[esign-unlimited-buy] Request received')
    const body = (await request.json().catch(() => ({}))) as any
    const email = normalizeEmail(body?.email)
    console.log('[esign-unlimited-buy] Parsed request:', { email })

    if (!email) return NextResponse.json({ error: 'Missing email' }, { status: 400 })

    console.log('[esign-unlimited-buy] Reading user wallet...')
    const wallet = await readUserWallet(email)
    console.log('[esign-unlimited-buy] Current wallet:', { balance: wallet.balance, unlimitedUntil: wallet.esignUnlimitedUntil })

    const cost = 27.99
    if (wallet.balance < cost) {
      console.log('[esign-unlimited-buy] Insufficient balance:', { current: wallet.balance, required: cost })
      return NextResponse.json(
        { error: 'Insufficient Load Balance to buy Unlimited ($27.99 required).', balance: wallet.balance, required: cost },
        { status: 402 }
      )
    }

    const now = Date.now()
    let baseMs = now
    try {
      const current = wallet.esignUnlimitedUntil ? new Date(String(wallet.esignUnlimitedUntil)) : null
      if (current && !Number.isNaN(current.getTime()) && current.getTime() > now) {
        baseMs = current.getTime()
        console.log('[esign-unlimited-buy] Extending existing unlimited until:', current.toISOString())
      } else {
        console.log('[esign-unlimited-buy] Starting new unlimited period from now')
      }
    } catch {
      baseMs = now
      console.log('[esign-unlimited-buy] Date parsing failed, using current time')
    }

    const until = new Date(baseMs + 30 * 24 * 60 * 60 * 1000)
    const untilIso = until.toISOString()
    console.log('[esign-unlimited-buy] New unlimited until date:', untilIso)

    const nextBalance = Number(wallet.balance) - cost
    console.log('[esign-unlimited-buy] Updating user:', { nextBalance, untilIso })
    
    const updated = await updateUser(email, { balance: nextBalance, esign_unlimited_until: untilIso })
    console.log('[esign-unlimited-buy] User updated successfully:', updated)

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
    console.error('[esign-unlimited-buy] Error:', e?.message, e?.stack)
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 })
  }
}
