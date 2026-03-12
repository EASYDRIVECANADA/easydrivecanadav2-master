import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    console.log('[debug-expiry] Starting debug test')
    
    // Test 1: Basic request parsing
    const body = (await request.json().catch(() => ({}))) as { user_id?: string; email?: string }
    const userId = String(body?.user_id ?? '').trim()
    const callerEmail = String(body?.email ?? '').trim().toLowerCase()
    console.log('[debug-expiry] Request parsed:', { userId, callerEmail })

    // Test 2: Environment variables
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    const stripeKey = process.env.STRIPE_SECRET_KEY
    
    console.log('[debug-expiry] Environment check:', {
      hasSupabaseUrl: !!supabaseUrl,
      hasSupabaseKey: !!supabaseKey,
      hasStripeKey: !!stripeKey,
      supabaseUrl: supabaseUrl ? `${supabaseUrl.substring(0, 20)}...` : 'MISSING'
    })

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({
        ok: false,
        error: 'Missing Supabase configuration',
        details: { hasUrl: !!supabaseUrl, hasKey: !!supabaseKey }
      }, { status: 500 })
    }

    // Test 3: Simple Supabase query
    if (userId) {
      console.log('[debug-expiry] Testing Supabase query...')
      const testRes = await fetch(
        `${supabaseUrl}/rest/v1/users?select=id,email,title&user_id=eq.${encodeURIComponent(userId)}&limit=1`,
        {
          method: 'GET',
          headers: { 
            apikey: supabaseKey, 
            Authorization: `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json'
          },
        }
      )
      
      console.log('[debug-expiry] Supabase test result:', { 
        ok: testRes.ok, 
        status: testRes.status,
        headers: Object.fromEntries(testRes.headers.entries())
      })
      
      const testText = await testRes.text().catch(() => '')
      console.log('[debug-expiry] Supabase response text:', testText)
      
      if (!testRes.ok) {
        return NextResponse.json({
          ok: false,
          error: 'Supabase query failed',
          details: { status: testRes.status, response: testText }
        }, { status: 500 })
      }
    }

    return NextResponse.json({
      ok: true,
      message: 'Debug test completed successfully',
      data: { userId, callerEmail }
    })

  } catch (error: any) {
    console.error('[debug-expiry] Error:', error)
    return NextResponse.json({
      ok: false,
      error: 'Debug test failed',
      details: {
        message: error?.message,
        stack: error?.stack,
        name: error?.name
      }
    }, { status: 500 })
  }
}
