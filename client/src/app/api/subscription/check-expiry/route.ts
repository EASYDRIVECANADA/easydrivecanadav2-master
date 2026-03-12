import { NextResponse } from 'next/server'
import Stripe from 'stripe'

export const runtime = 'nodejs'

const getSupabaseServerConfig = () => {
  const supabaseUrl = String(process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '')
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseKey) throw new Error('Supabase server not configured')
  return { supabaseUrl, supabaseKey }
}

/**
 * Verify directly with Stripe whether the given email has an active subscription.
 * Returns true if active/trialing, false if canceled/no subscription.
 * On error (missing key, network), returns null (unknown).
 */
const checkStripeSubscriptionActive = async (email: string): Promise<boolean | null> => {
  try {
    const secretKey = String(process.env.STRIPE_SECRET_KEY || '').trim()
    if (!secretKey) return null

    const stripe = new Stripe(secretKey)

    // Find Stripe customer by email
    const customers = await stripe.customers.list({ email, limit: 1 })
    if (!customers.data.length) {
      console.log('[check-expiry] No Stripe customer found for', email)
      return false
    }

    const customer = customers.data[0]
    if ((customer as any).deleted) {
      console.log('[check-expiry] Stripe customer deleted for', email)
      return false
    }

    // Check for active or trialing subscriptions
    const subs = await stripe.subscriptions.list({
      customer: customer.id,
      limit: 10,
    })

    const hasActive = subs.data.some(
      (s) => s.status === 'active' || s.status === 'trialing'
    )

    console.log('[check-expiry] Stripe subscription check', {
      email,
      customerId: customer.id,
      totalSubs: subs.data.length,
      statuses: subs.data.map((s) => s.status),
      hasActive,
    })

    return hasActive
  } catch (e: any) {
    console.error('[check-expiry] Stripe check error:', e?.message)
    return null
  }
}

/**
 * Apply subscription expiry: set all users to private+disable, keep owner enable.
 */
const applyExpiry = async (
  supabaseUrl: string,
  supabaseKey: string,
  userId: string,
  ownerId: string
) => {
  console.log('[applyExpiry] Starting expiry process for userId:', userId, 'ownerId:', ownerId)
  
  // 1. Set ALL users' role to 'private' and status to 'disable'
  console.log('[applyExpiry] Setting all users to private + disable')
  const allUsersRes = await fetch(
    `${supabaseUrl}/rest/v1/users?user_id=eq.${encodeURIComponent(userId)}`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({ role: 'private', status: 'disable' }),
    }
  )
  console.log('[applyExpiry] All users update result:', { ok: allUsersRes.ok, status: allUsersRes.status })
  
  if (!allUsersRes.ok) {
    const errorText = await allUsersRes.text().catch(() => '')
    console.error('[applyExpiry] Failed to update all users:', errorText)
  }

  // 2. Owner must always remain 'enable'
  console.log('[applyExpiry] Re-enabling owner account')
  const ownerRes = await fetch(
    `${supabaseUrl}/rest/v1/users?id=eq.${encodeURIComponent(ownerId)}`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({ status: 'enable' }),
    }
  )
  console.log('[applyExpiry] Owner re-enable result:', { ok: ownerRes.ok, status: ownerRes.status })
  
  if (!ownerRes.ok) {
    const errorText = await ownerRes.text().catch(() => '')
    console.error('[applyExpiry] Failed to re-enable owner:', errorText)
  }
  
  console.log('[applyExpiry] Expiry process completed')
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as { user_id?: string; email?: string }
    const userId = String(body?.user_id ?? '').trim()
    const callerEmail = String(body?.email ?? '').trim().toLowerCase()

    console.log('[check-expiry] Request received:', { userId, callerEmail })

    if (!userId) {
      console.log('[check-expiry] Missing user_id')
      return NextResponse.json({ ok: false, error: 'Missing user_id' }, { status: 400 })
    }

    const { supabaseUrl, supabaseKey } = getSupabaseServerConfig()
    console.log('[check-expiry] Supabase config loaded')

    // Fetch all users for this user_id
    const usersRes = await fetch(
      `${supabaseUrl}/rest/v1/users?select=id,email,title,role,status,subscription_end&user_id=eq.${encodeURIComponent(userId)}`,
      {
        method: 'GET',
        headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` },
      }
    )

    const usersText = await usersRes.text().catch(() => '')
    console.log('[check-expiry] Users fetch response:', { ok: usersRes.ok, status: usersRes.status })
    
    if (!usersRes.ok) {
      console.log('[check-expiry] Failed to fetch users:', usersText)
      return NextResponse.json({ ok: false, error: 'Failed to fetch users' }, { status: 500 })
    }

    let users: any[] = []
    try { users = JSON.parse(usersText || '[]') } catch { users = [] }
    console.log('[check-expiry] Users found:', users.length, users.map(u => ({ email: u.email, title: u.title, role: u.role, status: u.status })))

    if (users.length === 0) {
      console.log('[check-expiry] No users found for user_id:', userId)
      return NextResponse.json({ ok: true, expired: false, callerStatus: 'enable' })
    }

    // Find the owner row (title = 'Owner')
    const ownerRow = users.find((u: any) => String(u.title || '').trim().toLowerCase() === 'owner')
    console.log('[check-expiry] Owner row found:', ownerRow ? { email: ownerRow.email, role: ownerRow.role, status: ownerRow.status } : null)
    
    if (!ownerRow) {
      console.log('[check-expiry] No owner row found')
      return NextResponse.json({ ok: true, expired: false, callerStatus: 'enable' })
    }

    const ownerEmail = String(ownerRow.email || '').trim().toLowerCase()
    const currentRole = String(ownerRow.role || '').trim().toLowerCase()
    console.log('[check-expiry] Owner details:', { ownerEmail, currentRole })

    // If already private/no role, just return current caller status
    const isPrivate = !currentRole || currentRole === 'private' || currentRole === 'private seller' || currentRole === 'starter'
    console.log('[check-expiry] Is already private?', isPrivate)

    if (isPrivate) {
      const callerRow = callerEmail
        ? users.find((u: any) => String(u.email || '').trim().toLowerCase() === callerEmail)
        : null
      const callerStatus = callerRow ? String(callerRow.status || 'enable').trim().toLowerCase() : 'enable'
      console.log('[check-expiry] Already private, returning caller status:', callerStatus)
      return NextResponse.json({ ok: true, expired: true, callerStatus })
    }

    // ── Owner has a non-private role → verify with Stripe directly ──
    console.log('[check-expiry] Owner has non-private role, checking Stripe for:', ownerEmail)
    const stripeActive = await checkStripeSubscriptionActive(ownerEmail)
    console.log('[check-expiry] Stripe active result:', stripeActive)

    // Check subscription_end date as fallback
    const subscriptionEnd = String(ownerRow.subscription_end || '').trim()
    const endDate = subscriptionEnd ? new Date(subscriptionEnd) : null
    const endDateValid = endDate && !isNaN(endDate.getTime())
    const now = new Date()
    const dateExpired = endDateValid && endDate <= now
    console.log('[check-expiry] Date check:', { subscriptionEnd, endDateValid, dateExpired, now: now.toISOString() })

    // Determine if subscription should be treated as expired:
    // - Stripe says no active subscription → expired
    // - Stripe unavailable (null) but subscription_end has passed → expired
    // - Stripe unavailable (null) AND owner has paid role but no subscription_end → expired (likely canceled)
    // - Stripe says active → not expired
    const shouldExpire =
      stripeActive === false ||
      (stripeActive === null && dateExpired) ||
      (stripeActive === null && !subscriptionEnd && currentRole !== 'private')
    console.log('[check-expiry] Should expire?', shouldExpire, { stripeActive, dateExpired, hasSubscriptionEnd: !!subscriptionEnd, currentRole })

    if (!shouldExpire) {
      console.log('[check-expiry] Subscription still active, ensuring users are enabled')
      // Subscription still active – ensure all users are enabled
      const disabledUsers = users.filter((u: any) => String(u.status || '').trim().toLowerCase() !== 'enable')
      console.log('[check-expiry] Disabled users to re-enable:', disabledUsers.length)
      
      if (disabledUsers.length > 0) {
        const enableRes = await fetch(
          `${supabaseUrl}/rest/v1/users?user_id=eq.${encodeURIComponent(userId)}`,
          {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              apikey: supabaseKey,
              Authorization: `Bearer ${supabaseKey}`,
              Prefer: 'return=minimal',
            },
            body: JSON.stringify({ status: 'enable' }),
          }
        )
        console.log('[check-expiry] Re-enable result:', { ok: enableRes.ok, status: enableRes.status })
      }

      console.log('[check-expiry] Returning active subscription')
      return NextResponse.json({ ok: true, expired: false, callerStatus: 'enable', active: true })
    }

    // *** SUBSCRIPTION EXPIRED / CANCELED ***
    console.log('[check-expiry] SUBSCRIPTION EXPIRED - Starting expiry process for user_id:', userId, {
      stripeActive,
      dateExpired,
      currentRole,
      ownerEmail,
    })

    console.log('[check-expiry] Applying expiry to all users...')
    await applyExpiry(supabaseUrl, supabaseKey, userId, ownerRow.id)
    console.log('[check-expiry] Expiry applied successfully')

    // Determine caller's new status
    const isCallerOwner = callerEmail && ownerEmail === callerEmail
    const callerStatus = isCallerOwner ? 'enable' : 'disable'
    console.log('[check-expiry] Caller status determined:', { isCallerOwner, callerStatus, callerEmail, ownerEmail })

    const result = {
      ok: true,
      expired: true,
      callerStatus,
      reason: stripeActive === false ? 'stripe_no_active_subscription' : 'subscription_end_passed',
    }
    console.log('[check-expiry] Returning expiry result:', result)
    return NextResponse.json(result)
  } catch (e: any) {
    console.error('[check-expiry] Error:', e?.message)
    return NextResponse.json({ ok: false, error: e?.message || 'Server error' }, { status: 500 })
  }
}
