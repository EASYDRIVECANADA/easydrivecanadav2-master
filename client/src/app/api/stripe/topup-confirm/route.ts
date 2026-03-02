import Stripe from 'stripe'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

const getSupabaseServerConfig = () => {
  const supabaseUrl = String(process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '')
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseKey) throw new Error('Supabase server not configured')
  return { supabaseUrl, supabaseKey }
}

const normalizeEmail = (email: unknown) => String(email || '').trim().toLowerCase()

const getUserBalanceByEmail = async (email: string) => {
  const { supabaseUrl, supabaseKey } = getSupabaseServerConfig()

  const q = `${supabaseUrl}/rest/v1/users?select=id,email,balance&email=ilike.${encodeURIComponent(email)}&limit=1`
  const res = await fetch(q, {
    method: 'GET',
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
    },
  })
  const text = await res.text()
  if (!res.ok) throw new Error(text || `Failed to read balance (${res.status})`)

  let rows: any[] = []
  try {
    rows = JSON.parse(text)
  } catch {
    rows = []
  }

  const row = rows?.[0]
  if (!row) throw new Error(`No users row matched email=${email}`)

  const current = Number(row?.balance ?? 0)
  return { id: String(row?.id || ''), email: String(row?.email || email), balance: Number.isFinite(current) ? current : 0 }
}

const setUserBalanceByEmail = async (email: string, balance: number) => {
  const { supabaseUrl, supabaseKey } = getSupabaseServerConfig()
  const patchUrl = `${supabaseUrl}/rest/v1/users?email=ilike.${encodeURIComponent(email)}`

  const res = await fetch(patchUrl, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      Prefer: 'return=representation',
    },
    body: JSON.stringify({ balance: String(balance) }),
  })

  const text = await res.text()
  if (!res.ok) throw new Error(text || `Failed to update balance (${res.status})`)
  if (String(text || '').trim() === '[]') {
    throw new Error(`No users row matched email=${email}`)
  }

  return text
}

export async function POST(req: Request) {
  try {
    const secretKey = String(process.env.STRIPE_SECRET_KEY || '').trim()
    if (!secretKey) return NextResponse.json({ ok: false, error: 'Missing STRIPE_SECRET_KEY' }, { status: 500 })

    const body = (await req.json().catch(() => ({}))) as { session_id?: string }
    const sessionId = String(body?.session_id || '').trim()
    if (!sessionId) return NextResponse.json({ ok: false, error: 'Missing session_id' }, { status: 400 })

    const stripe = new Stripe(secretKey)

    const session = (await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['line_items', 'customer'],
    })) as any as Stripe.Checkout.Session

    const product = String((session.metadata as any)?.product || '').trim().toLowerCase()
    if (product !== 'topup') {
      return NextResponse.json({ ok: false, error: 'Not a topup session' }, { status: 400 })
    }

    const paymentStatus = String((session as any)?.payment_status || '').toLowerCase()
    const isSettled = paymentStatus === 'paid' || paymentStatus === 'no_payment_required'
    if (!isSettled) {
      return NextResponse.json({ ok: false, error: 'Session not paid' }, { status: 400 })
    }

    let email = normalizeEmail((session as any)?.customer_details?.email || session.customer_email)
    if (!email && (session as any)?.customer) {
      const cust: any = (session as any).customer
      email = normalizeEmail(cust?.email)
    }
    if (!email) return NextResponse.json({ ok: false, error: 'Missing customer email' }, { status: 400 })

    const subtotalCents = Number((session as any)?.amount_subtotal ?? 0)
    const totalCents = Number((session as any)?.amount_total ?? 0)
    const creditCents = Number.isFinite(subtotalCents) && subtotalCents > 0 ? subtotalCents : totalCents
    const amount = Number.isFinite(creditCents) ? creditCents / 100 : 0
    if (!(amount > 0)) {
      return NextResponse.json({ ok: false, error: 'Topup amount is 0' }, { status: 400 })
    }

    const { balance: current } = await getUserBalanceByEmail(email)
    const nextBalance = Number((current || 0) + amount)
    await setUserBalanceByEmail(email, nextBalance)

    return NextResponse.json({ ok: true, email, amount, balance: nextBalance })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Failed to confirm topup' }, { status: 500 })
  }
}
