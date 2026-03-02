import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({} as any))

    const supabaseUrl = String(process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '')
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    const normalizeEmail = (v: unknown) => String(v || '').trim().toLowerCase()
    const userId = String((body as any)?.user_id ?? '').trim()
    const email = normalizeEmail((body as any)?.email)

    let userRole: string | null = null
    if (supabaseUrl && supabaseKey && (userId || email)) {
      try {
        const qs = userId
          ? `user_id=eq.${encodeURIComponent(userId)}`
          : `email=ilike.${encodeURIComponent(email)}`
        const q = `${supabaseUrl}/rest/v1/users?select=role&${qs}&limit=1`
        const r = await fetch(q, {
          method: 'GET',
          headers: {
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
          },
        })
        const text = await r.text().catch(() => '')
        if (r.ok) {
          let rows: any[] = []
          try {
            rows = JSON.parse(text)
          } catch {
            rows = []
          }
          const row = rows?.[0]
          const role = String(row?.role ?? '').trim()
          userRole = role || null
        }
      } catch {
        userRole = null
      }
    }

    const payload = {
      ...(body ?? {}),
      user_role: userRole,
    }

    const res = await fetch('https://primary-production-6722.up.railway.app/webhook/Add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    const text = await res.text().catch(() => '')
    return new NextResponse(text, {
      status: res.status,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
      },
    })
  } catch (err) {
    console.error('inventory-add proxy error', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
