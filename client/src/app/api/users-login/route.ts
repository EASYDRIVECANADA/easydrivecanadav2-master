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

    const queryPromise = supabase
      .from('users')
      .select('id, user_id, email, administrator, status')
      .ilike('email', email)
      .eq('password', password)
      .limit(1)
      .maybeSingle()

    const timeoutMs = 4000
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('timeout')), timeoutMs)
    })

    const { data, error } = await Promise.race([queryPromise, timeoutPromise])

    if ((error as any)?.message === 'timeout') {
      return NextResponse.json({ ok: false, error: 'Login timed out' }, { status: 504 })
    }

    if (error) return NextResponse.json({ ok: false, error: 'Login failed' }, { status: 500 })

    if (!data) return NextResponse.json({ ok: false, error: 'Invalid credentials' }, { status: 401 })

    // Block login if account is disabled
    const accountStatus = String((data as any)?.status || '').trim().toLowerCase()
    if (accountStatus === 'disable') {
      return NextResponse.json(
        { ok: false, error: 'Your account has been disabled. Please contact your administrator.' },
        { status: 403 }
      )
    }

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
