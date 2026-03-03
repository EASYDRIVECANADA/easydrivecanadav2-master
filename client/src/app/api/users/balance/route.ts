import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as { email?: string }
    const email = String(body?.email ?? '').trim().toLowerCase()
    if (!email) return NextResponse.json({ ok: false, error: 'Missing email' }, { status: 400 })

    const supabaseUrl = String(process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '')
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!supabaseUrl || !supabaseKey) return NextResponse.json({ ok: false, error: 'Server not configured' }, { status: 500 })

    const q = `${supabaseUrl}/rest/v1/users?select=email,balance&email=eq.${encodeURIComponent(email)}&limit=1`
    const res = await fetch(q, {
      method: 'GET',
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
      },
    })

    const text = await res.text()
    if (!res.ok) return NextResponse.json({ ok: false, error: text || `Failed to fetch balance (${res.status})` }, { status: 500 })

    let rows: any[] = []
    try {
      rows = JSON.parse(text)
    } catch {
      rows = []
    }

    const row = rows?.[0]
    const balanceRaw = row?.balance
    const balance = Number(balanceRaw ?? 0)

    return NextResponse.json(
      {
        ok: true,
        email: String(row?.email ?? email),
        balance: Number.isFinite(balance) ? balance : 0,
      },
      { status: 200 }
    )
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || 'Server error' }, { status: 500 })
  }
}
