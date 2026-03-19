import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

export async function GET(request: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        { error: 'Server not configured' },
        { status: 500, headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0' } }
      )
    }

    const url = new URL(request.url)
    const userId = url.searchParams.get('user_id')?.trim() || ''

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    })

    let query = supabase.from('edc_vehicles').select('*').order('created_at', { ascending: false })
    if (userId) query = query.eq('user_id', userId)
    const queryPromise = query

    const timeoutMs = 6000
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('timeout')), timeoutMs)
    })

    const { data, error } = await Promise.race([queryPromise, timeoutPromise]).catch(() => ({
      data: null,
      error: { message: 'timeout' } as any,
    }))

    if ((error as any)?.message === 'timeout') {
      return NextResponse.json(
        { error: 'Vehicles request timed out' },
        { status: 504, headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0' } }
      )
    }

    if (error) {
      return NextResponse.json(
        { error: error.message || 'Failed to fetch vehicles' },
        { status: 500, headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0' } }
      )
    }

    const vehicles = Array.isArray(data) ? data : []

    return NextResponse.json(
      { vehicles },
      { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0' } }
    )
  } catch (err: any) {
    console.error('[API /vehicles] Error:', err)
    return NextResponse.json(
      { error: err?.message || 'Failed to fetch vehicles' },
      { status: 500, headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0' } }
    )
  }
}
