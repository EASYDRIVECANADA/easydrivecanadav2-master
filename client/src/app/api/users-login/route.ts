import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as { email?: string; password?: string }
    const email = String(body?.email ?? '').trim().toLowerCase()
    const password = String(body?.password ?? '').trim()

    if (!email || !password) {
      return NextResponse.json({ ok: false, error: 'Email and password are required' }, { status: 400 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json({ ok: false, error: 'Server not configured' }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    })

    const { data, error } = await supabase
      .from('users')
      .select('id, user_id, email, administrator')
      .ilike('email', email)
      .eq('password', password)
      .limit(1)
      .maybeSingle()

    if (error) return NextResponse.json({ ok: false, error: 'Login failed' }, { status: 500 })

    if (!data) return NextResponse.json({ ok: false, error: 'Invalid credentials' }, { status: 401 })

    const role = (data as any)?.administrator ? 'ADMIN' : 'STAFF'
    const scopedUserId = String((data as any)?.user_id ?? (data as any)?.id ?? '').trim()

    return NextResponse.json(
      {
        ok: true,
        session: {
          email: String((data as any)?.email ?? email),
          role,
          user_id: scopedUserId,
        },
      },
      { status: 200 }
    )
  } catch (err) {
    console.error('users-login error', err)
    return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 })
  }
}
