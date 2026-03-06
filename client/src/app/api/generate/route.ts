import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

const WEBHOOK_URL = 'https://primary-production-6722.up.railway.app/webhook/generate'

const normalizeEmail = (email: unknown) => String(email || '').trim().toLowerCase()

const getSupabaseServerConfig = () => {
  const supabaseUrl = String(process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '')
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseKey) throw new Error('Supabase server not configured')
  return { supabaseUrl, supabaseKey }
}

const readUserBalance = async (email: string) => {
  const { supabaseUrl, supabaseKey } = getSupabaseServerConfig()
  const q = `${supabaseUrl}/rest/v1/users?select=email,balance&email=eq.${encodeURIComponent(email)}&limit=1`
  const res = await fetch(q, {
    method: 'GET',
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
    },
  })
  const text = await res.text().catch(() => '')
  if (!res.ok) throw new Error(text || `Failed to fetch balance (${res.status})`)
  let rows: any[] = []
  try {
    rows = JSON.parse(text)
  } catch {
    rows = []
  }
  const row = rows?.[0]
  if (!row) throw new Error(`No users row matched email=${email}`)
  const balance = Number(row?.balance ?? 0)
  return { email: String(row?.email ?? email), balance: Number.isFinite(balance) ? balance : 0 }
}

const updateUserBalance = async (email: string, nextBalance: number) => {
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
    body: JSON.stringify({ balance: nextBalance }),
  })
  const text = await res.text().catch(() => '')
  if (!res.ok) throw new Error(text || `Failed to update user balance (${res.status})`)
  if (String(text || '').trim() === '[]') throw new Error(`No users row matched email=${email}`)
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))

    const email = normalizeEmail((body as any)?.email)
    if (!email) {
      return NextResponse.json({ error: 'Missing email' }, { status: 400 })
    }

    const cost = 0.5
    const wallet = await readUserBalance(email)
    if (wallet.balance < cost) {
      return NextResponse.json(
        {
          error: 'Insufficient Load Balance for image generation ($0.50 required).',
          balance: wallet.balance,
          required: cost,
        },
        { status: 402 }
      )
    }

    const res = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body ?? {}),
    })

    const text = await res.text().catch(() => '')
    const contentType = res.headers.get('content-type') || ''

    if (res.ok) {
      try {
        const nextBalance = Number(wallet.balance) - cost
        await updateUserBalance(email, nextBalance)
      } catch (e) {
        console.error('[generate] failed to deduct balance', e)
      }
    }

    if (contentType.includes('application/json')) {
      try {
        return NextResponse.json(JSON.parse(text || '{}'), { status: res.status })
      } catch {
        return NextResponse.json({ raw: text }, { status: res.status })
      }
    }

    return new NextResponse(text, { status: res.status })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: msg || 'Proxy error' }, { status: 500 })
  }
}
