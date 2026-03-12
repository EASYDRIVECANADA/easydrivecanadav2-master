import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as { user_id?: string; email?: string }
    const userId = String(body?.user_id ?? '').trim()
    const callerEmail = String(body?.email ?? '').trim().toLowerCase()

    console.log('[simple-expiry] Processing:', { userId, callerEmail })

    if (!userId) {
      return NextResponse.json({ ok: false, error: 'Missing user_id' }, { status: 400 })
    }

    const supabaseUrl = String(process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '')
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseKey) {
      console.error('[simple-expiry] Missing Supabase config')
      return NextResponse.json({ ok: false, error: 'Server configuration error' }, { status: 500 })
    }

    // Get users for this user_id
    const usersRes = await fetch(
      `${supabaseUrl}/rest/v1/users?select=id,email,title,role,status&user_id=eq.${encodeURIComponent(userId)}`,
      {
        method: 'GET',
        headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` },
      }
    )

    if (!usersRes.ok) {
      const errorText = await usersRes.text().catch(() => '')
      console.error('[simple-expiry] Users fetch failed:', errorText)
      return NextResponse.json({ ok: false, error: 'Database error' }, { status: 500 })
    }

    const users = await usersRes.json().catch(() => [])
    console.log('[simple-expiry] Users found:', users.length)

    if (users.length === 0) {
      return NextResponse.json({ ok: true, expired: false, callerStatus: 'enable' })
    }

    // Find owner
    const ownerRow = users.find((u: any) => String(u.title || '').trim().toLowerCase() === 'owner')
    if (!ownerRow) {
      return NextResponse.json({ ok: true, expired: false, callerStatus: 'enable' })
    }

    const currentRole = String(ownerRow.role || '').trim().toLowerCase()
    console.log('[simple-expiry] Owner role:', currentRole)

    // If owner has a paid role (not private), force expiry since subscription was canceled
    const isPaidRole = currentRole && currentRole !== 'private' && currentRole !== 'starter'
    
    if (isPaidRole) {
      console.log('[simple-expiry] Paid role detected, applying expiry...')
      
      // Set all users to private + disable
      const updateAllRes = await fetch(
        `${supabaseUrl}/rest/v1/users?user_id=eq.${encodeURIComponent(userId)}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
          },
          body: JSON.stringify({ role: 'private', status: 'disable' }),
        }
      )
      
      console.log('[simple-expiry] Update all users result:', updateAllRes.ok)

      // Re-enable owner
      const ownerRes = await fetch(
        `${supabaseUrl}/rest/v1/users?id=eq.${encodeURIComponent(ownerRow.id)}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
          },
          body: JSON.stringify({ status: 'enable' }),
        }
      )
      
      console.log('[simple-expiry] Re-enable owner result:', ownerRes.ok)

      const isCallerOwner = callerEmail && String(ownerRow.email || '').trim().toLowerCase() === callerEmail
      const callerStatus = isCallerOwner ? 'enable' : 'disable'

      return NextResponse.json({
        ok: true,
        expired: true,
        callerStatus,
        reason: 'subscription_canceled'
      })
    }

    // Already private, return current status
    const callerRow = callerEmail ? users.find((u: any) => String(u.email || '').trim().toLowerCase() === callerEmail) : null
    const callerStatus = callerRow ? String(callerRow.status || 'enable').trim().toLowerCase() : 'enable'

    return NextResponse.json({ ok: true, expired: false, callerStatus })

  } catch (error: any) {
    console.error('[simple-expiry] Error:', error?.message)
    return NextResponse.json({ 
      ok: false, 
      error: 'Server error',
      details: error?.message 
    }, { status: 500 })
  }
}
