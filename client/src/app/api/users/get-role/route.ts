import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

const getSupabaseServerConfig = () => {
  const supabaseUrl = String(process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '')
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseKey) throw new Error('Supabase server not configured')
  return { supabaseUrl, supabaseKey }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const email = String(body?.email || '').trim().toLowerCase()

    if (!email) {
      return NextResponse.json({ error: 'Email required' }, { status: 400 })
    }

    const { supabaseUrl, supabaseKey } = getSupabaseServerConfig()

    // Fetch role from users table
    const url = `${supabaseUrl}/rest/v1/users?select=role&email=eq.${encodeURIComponent(email)}&limit=1`
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
      },
    })

    const text = await res.text()
    if (!res.ok) {
      return NextResponse.json({ error: text || 'Failed to fetch role' }, { status: res.status })
    }

    let rows: any[] = []
    try {
      rows = JSON.parse(text || '[]')
    } catch {
      rows = []
    }

    const row = rows?.[0]
    if (!row) {
      return NextResponse.json({ error: 'No user found' }, { status: 404 })
    }

    const role = String(row?.role || 'private').trim()

    return NextResponse.json({ role })
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 })
  }
}
