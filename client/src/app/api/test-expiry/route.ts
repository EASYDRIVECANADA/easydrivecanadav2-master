import { NextResponse } from 'next/server'

export async function GET() {
  try {
    console.log('[test-expiry] Manual test triggered')
    
    // Test with a sample user_id and email
    const testUserId = 'test-user-id'
    const testEmail = 'test@example.com'
    
    const res = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/subscription/check-expiry`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: testUserId, email: testEmail }),
    })
    
    const json = await res.json().catch(() => null)
    
    console.log('[test-expiry] Check-expiry response:', { 
      ok: res.ok, 
      status: res.status,
      json 
    })
    
    return NextResponse.json({
      ok: true,
      checkExpiryResponse: {
        ok: res.ok,
        status: res.status,
        data: json
      }
    })
  } catch (e: any) {
    console.error('[test-expiry] Error:', e?.message)
    return NextResponse.json({ ok: false, error: e?.message }, { status: 500 })
  }
}
