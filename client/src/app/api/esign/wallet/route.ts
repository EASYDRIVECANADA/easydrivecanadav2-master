import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

const normalizeEmail = (email: unknown) => String(email || '').trim().toLowerCase()

const getSupabaseServerConfig = () => {
  const supabaseUrl = String(process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '')
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseKey) throw new Error('Supabase server not configured')
  return { supabaseUrl, supabaseKey }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as any
    const email = normalizeEmail(body?.email)
    if (!email) return NextResponse.json({ error: 'Missing email' }, { status: 400 })

    const { supabaseUrl, supabaseKey } = getSupabaseServerConfig()
    const q = `${supabaseUrl}/rest/v1/users?select=email,balance,esign_credits,esign_unlimited_until&email=eq.${encodeURIComponent(email)}&limit=1`

    const res = await fetch(q, {
      method: 'GET',
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
      },
    })

    const text = await res.text().catch(() => '')
    if (!res.ok) return NextResponse.json({ error: text || `Supabase error (${res.status})` }, { status: 500 })

    let rows: any[] = []
    try {
      rows = JSON.parse(text)
    } catch {
      rows = []
    }
    const row = rows?.[0]
    if (!row) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    const balance = Number(row?.balance ?? 0)
    const credits = Number((row as any)?.esign_credits ?? 0)
    const unlimitedUntil = (row as any)?.esign_unlimited_until ?? null

    return NextResponse.json(
      {
        email,
        balance: Number.isFinite(balance) ? balance : 0,
        esign_credits: Number.isFinite(credits) ? credits : 0,
        esign_unlimited_until: unlimitedUntil,
      },
      { status: 200 }
    )
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 })
  }
}
