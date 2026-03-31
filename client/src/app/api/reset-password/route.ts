import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'

export const dynamic = 'force-dynamic'

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const token = String(body?.token || '').trim()
    const password = String(body?.password || '').trim()

    if (!token || !password) {
      return NextResponse.json({ error: 'Token and password are required' }, { status: 400 })
    }

    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    })

    // Look up the reset token in the users table
    const { data: user, error: findError } = await supabase
      .from('users')
      .select('id, reset_token, reset_token_expires_at')
      .eq('reset_token', token)
      .maybeSingle()

    if (findError || !user) {
      return NextResponse.json({ error: 'Invalid or expired reset token' }, { status: 400 })
    }

    // Check expiry if the column exists
    if (user.reset_token_expires_at) {
      const expiresAt = new Date(user.reset_token_expires_at)
      if (expiresAt < new Date()) {
        return NextResponse.json({ error: 'Reset token has expired' }, { status: 400 })
      }
    }

    // Store hashed password + clear the token
    const hashed = sha256(password)
    const { error: updateError } = await supabase
      .from('users')
      .update({ password: hashed, reset_token: null, reset_token_expires_at: null })
      .eq('id', user.id)

    if (updateError) {
      return NextResponse.json({ error: 'Failed to update password' }, { status: 500 })
    }

    return NextResponse.json({ ok: true }, { status: 200 })
  } catch (err) {
    console.error('reset-password error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
