import Stripe from 'stripe'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

type Plan = 'starter' | 'small' | 'medium' | 'large'

type Role = string

const planToRole: Record<Plan, Role> = {
  starter: 'STARTER',
  small: 'small dealership',
  medium: 'medium dealership',
  large: 'large dealership',
}

// E‑Sign wallet helpers
const getEsignWalletByEmail = async (email: string) => {
  const { supabaseUrl, supabaseKey } = getSupabaseServerConfig()

  const q = `${supabaseUrl}/rest/v1/users?select=id,email,esign_credits,esign_unlimited_until&email=eq.${encodeURIComponent(email)}&limit=1`
  const res = await fetch(q, {
    method: 'GET',
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
    },
  })
  const text = await res.text()
  if (!res.ok) throw new Error(text || `Failed to read e‑sign wallet (${res.status})`)

  let rows: any[] = []
  try { rows = JSON.parse(text || '[]') } catch { rows = [] }
  const row = rows?.[0]
  if (!row) throw new Error(`No users row matched email=${email}`)
  return {
    id: String(row?.id || ''),
    email: String(row?.email || email),
    esignCredits: Number((row as any)?.esign_credits ?? 0),
    esignUnlimitedUntil: (row as any)?.esign_unlimited_until ?? null,
  }
}

const updateEsignWalletByEmail = async (
  email: string,
  patch: { esign_credits?: number | string; esign_unlimited_until?: string | null }
) => {
  const { supabaseUrl, supabaseKey } = getSupabaseServerConfig()
  const patchUrl = `${supabaseUrl}/rest/v1/users?email=eq.${encodeURIComponent(email)}`

  // Some deployments use varchar for these fields; send as strings to be safe
  const bodyPatch: Record<string, any> = { ...patch }
  if (typeof bodyPatch.esign_credits === 'number') bodyPatch.esign_credits = String(bodyPatch.esign_credits)

  const res = await fetch(patchUrl, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      Prefer: 'return=representation',
    },
    body: JSON.stringify(bodyPatch),
  })

  const text = await res.text()
  if (!res.ok) throw new Error(text || `Failed to update e‑sign wallet (${res.status})`)
  if (String(text || '').trim() === '[]') throw new Error(`No users row matched email=${email}`)
  return text
}

const normalizeEmail = (email: unknown) => String(email || '').trim().toLowerCase()

const getPlanFromPriceId = (priceId: string, smallPrice: string, mediumPrice: string, largePrice: string): Plan | null => {
  const pid = String(priceId || '').trim()
  if (!pid) return null
  if (smallPrice && pid === smallPrice) return 'small'
  if (mediumPrice && pid === mediumPrice) return 'medium'
  if (largePrice && pid === largePrice) return 'large'
  return null
}

const getSupabaseServerConfig = () => {
  const supabaseUrl = String(process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '')
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseKey) throw new Error('Supabase server not configured')
  return { supabaseUrl, supabaseKey }
}

const processedWebhookEvents = new Set<string>()

const markWebhookEventProcessed = async (key: string, type: string) => {
  const id = String(key || '').trim()
  if (!id) return { ok: false, alreadyProcessed: false, reason: 'missing_event_id' }

  // In-memory fallback (helps in dev; not durable across deploys/instances)
  if (processedWebhookEvents.has(id)) {
    return { ok: true, alreadyProcessed: true, durable: false }
  }

  try {
    const { supabaseUrl, supabaseKey } = getSupabaseServerConfig()
    const url = `${supabaseUrl}/rest/v1/stripe_webhook_events?on_conflict=id`

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        Prefer: 'resolution=ignore-duplicates,return=representation',
      },
      body: JSON.stringify([{ id, type }]),
    })

    const text = await res.text().catch(() => '')
    if (res.status === 409) {
      processedWebhookEvents.add(id)
      return { ok: true, alreadyProcessed: true, durable: true }
    }
    if (!res.ok) {
      // If table doesn't exist or permissions, do NOT treat idempotency as safe.
      // We'll rely on caller to "fail closed" for money-moving operations.
      processedWebhookEvents.add(id)
      return { ok: false, alreadyProcessed: false, durable: false, error: text || `status=${res.status}` }
    }

    // If we inserted a row, Supabase returns [] when ignored; representation when inserted.
    const trimmed = String(text || '').trim()
    const inserted = trimmed && trimmed !== '[]'
    processedWebhookEvents.add(id)
    return { ok: true, alreadyProcessed: !inserted, durable: true }
  } catch (e: any) {
    processedWebhookEvents.add(id)
    return { ok: false, alreadyProcessed: false, durable: false, error: String(e?.message || e) }
  }
}

const updateUserRoleByEmail = async (email: string, role: Role) => {
  const { supabaseUrl, supabaseKey } = getSupabaseServerConfig()

  const patchUrl = `${supabaseUrl}/rest/v1/users?email=eq.${encodeURIComponent(email)}`
  const res = await fetch(patchUrl, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      Prefer: 'return=representation',
    },
    body: JSON.stringify({ role }),
  })

  const text = await res.text()
  if (!res.ok) throw new Error(text || `Failed to update role (${res.status})`)
  if (String(text || '').trim() === '[]') {
    throw new Error(`No users row matched email=${email}`)
  }

  let rows: any[] = []
  try {
    rows = JSON.parse(text)
  } catch {
    rows = []
  }

  return { raw: text, rows }
}

const updateAllUsersRoleByOwnerEmail = async (ownerEmail: string, role: Role) => {
  const { supabaseUrl, supabaseKey } = getSupabaseServerConfig()

  // First get the owner's user_id
  const ownerRes = await fetch(
    `${supabaseUrl}/rest/v1/users?select=user_id&email=eq.${encodeURIComponent(ownerEmail)}&limit=1`,
    { method: 'GET', headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
  )
  const ownerText = await ownerRes.text().catch(() => '')
  let ownerRows: any[] = []
  try { ownerRows = JSON.parse(ownerText || '[]') } catch { ownerRows = [] }
  const ownerRow = ownerRows?.[0]
  if (!ownerRow) throw new Error(`No owner found for email=${ownerEmail}`)

  const userId = String(ownerRow.user_id || '').trim()
  if (!userId) throw new Error(`Owner has no user_id for email=${ownerEmail}`)

  // Update ALL users with this user_id
  const patchUrl = `${supabaseUrl}/rest/v1/users?user_id=eq.${encodeURIComponent(userId)}`
  const res = await fetch(patchUrl, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      Prefer: 'return=representation',
    },
    body: JSON.stringify({ role }),
  })

  const text = await res.text()
  if (!res.ok) throw new Error(text || `Failed to update all users role (${res.status})`)

  let rows: any[] = []
  try {
    rows = JSON.parse(text || '[]')
  } catch {
    rows = []
  }

  console.log(`[stripe-webhook] Updated ${rows.length} users to role=${role} for user_id=${userId}`)
  return { raw: text, rows, userId }
}

const getUserBalanceByEmail = async (email: string) => {
  const { supabaseUrl, supabaseKey } = getSupabaseServerConfig()

  const q = `${supabaseUrl}/rest/v1/users?select=id,email,balance&email=eq.${encodeURIComponent(email)}&limit=1`
  const res = await fetch(q, {
    method: 'GET',
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
    },
  })
  const text = await res.text()
  if (!res.ok) throw new Error(text || `Failed to read balance (${res.status})`)

  let rows: any[] = []
  try {
    rows = JSON.parse(text)
  } catch {
    rows = []
  }

  const row = rows?.[0]
  if (!row) throw new Error(`No users row matched email=${email}`)
  const current = Number(row?.balance ?? 0)
  return {
    id: String(row?.id || ''),
    email: String(row?.email || email),
    balance: Number.isFinite(current) ? current : 0,
  }
}

const setUserBalanceByEmail = async (email: string, balance: number) => {
  const { supabaseUrl, supabaseKey } = getSupabaseServerConfig()
  const patchUrl = `${supabaseUrl}/rest/v1/users?email=eq.${encodeURIComponent(email)}`

  const res = await fetch(patchUrl, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      Prefer: 'return=representation',
    },
    body: JSON.stringify({ balance: String(balance) }),
  })

  const text = await res.text()
  if (!res.ok) throw new Error(text || `Failed to update balance (${res.status})`)
  if (String(text || '').trim() === '[]') {
    throw new Error(`No users row matched email=${email}`)
  }

  return text
}

const getUserIdByEmail = async (email: string) => {
  const { supabaseUrl, supabaseKey } = getSupabaseServerConfig()

  const q = `${supabaseUrl}/rest/v1/users?select=user_id&email=eq.${encodeURIComponent(email)}&limit=1`
  const res = await fetch(q, {
    method: 'GET',
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
    },
  })
  const text = await res.text()
  if (!res.ok) throw new Error(text || `Failed to read user_id (${res.status})`)

  let rows: any[] = []
  try {
    rows = JSON.parse(text)
  } catch {
    rows = []
  }

  const row = rows?.[0]
  const userId = String(row?.user_id || '').trim()
  if (!userId) throw new Error(`No users.user_id matched email=${email}`)
  return userId
}

const sendDealershipBadgeWebhook = async (userId: string) => {
  const uid = String(userId || '').trim()
  if (!uid) throw new Error('Missing user_id for badge webhook')

  const res = await fetch('https://primary-production-6722.up.railway.app/webhook/badge', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: uid, subscription: 'dealership' }),
  })
  const text = await res.text().catch(() => '')
  if (!res.ok) throw new Error(text || `Badge webhook responded with ${res.status}`)
  return text
}

const sendDealershipSubscriptWebhook = async (userId: string) => {
  const uid = String(userId || '').trim()
  if (!uid) throw new Error('Missing user_id for subscript webhook')

  const res = await fetch('https://primary-production-6722.up.railway.app/webhook/subscript', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: uid, subscription: 'dealership' }),
  })
  const text = await res.text().catch(() => '')
  if (!res.ok) throw new Error(text || `Subscript webhook responded with ${res.status}`)
  return text
}

const enableSubscriptionUsers = async (email: string) => {
  try {
    const { supabaseUrl, supabaseKey } = getSupabaseServerConfig()

    // Get the owner's row to find user_id
    const userRes = await fetch(
      `${supabaseUrl}/rest/v1/users?select=id,user_id,title&email=eq.${encodeURIComponent(email)}&limit=1`,
      { method: 'GET', headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
    )
    const userText = await userRes.text().catch(() => '')
    let rows: any[] = []
    try { rows = JSON.parse(userText || '[]') } catch { rows = [] }
    const ownerRow = rows?.[0]
    if (!ownerRow) return null

    const userId = String(ownerRow.user_id || '').trim()
    if (!userId) return null

    // Calculate subscription_end (1 month from now)
    const now = new Date()
    const subscriptionEnd = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate())
    const subscriptionEndIso = subscriptionEnd.toISOString()

    // Set status='enable' for ALL users with this user_id
    await fetch(
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

    // Set subscription_end on the owner's row (title=Owner)
    const ownerTitle = String(ownerRow.title || '').trim().toLowerCase()
    const targetId = ownerTitle === 'owner' ? ownerRow.id : ownerRow.id
    await fetch(
      `${supabaseUrl}/rest/v1/users?id=eq.${encodeURIComponent(targetId)}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({ subscription_end: subscriptionEndIso }),
      }
    )

    console.log('[stripe-webhook] subscription enabled', { userId, subscriptionEnd: subscriptionEndIso })
    return { userId, subscriptionEnd: subscriptionEndIso }
  } catch (e: any) {
    console.error('[stripe-webhook] enableSubscriptionUsers failed:', e?.message)
    return null
  }
}

const handleSubscriptionExpiry = async (email: string) => {
  try {
    const { supabaseUrl, supabaseKey } = getSupabaseServerConfig()

    // Get the owner's row
    const userRes = await fetch(
      `${supabaseUrl}/rest/v1/users?select=id,user_id,title&email=eq.${encodeURIComponent(email)}&limit=1`,
      { method: 'GET', headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
    )
    const userText = await userRes.text().catch(() => '')
    let rows: any[] = []
    try { rows = JSON.parse(userText || '[]') } catch { rows = [] }
    const ownerRow = rows?.[0]
    if (!ownerRow) return null

    const userId = String(ownerRow.user_id || '').trim()
    if (!userId) return null

    // Fetch all users for this user_id
    const allRes = await fetch(
      `${supabaseUrl}/rest/v1/users?select=id,title,role&user_id=eq.${encodeURIComponent(userId)}`,
      { method: 'GET', headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
    )
    const allText = await allRes.text().catch(() => '')
    let allUsers: any[] = []
    try { allUsers = JSON.parse(allText || '[]') } catch { allUsers = [] }

    // Set users' role to 'private' + status to 'disable', BUT preserve Premier roles
    const premierUsers = allUsers.filter(u => String(u.role || '').trim().toLowerCase() === 'premier')
    const nonPremierUsers = allUsers.filter(u => String(u.role || '').trim().toLowerCase() !== 'premier')
    
    // Update non-Premier users to private + disable
    if (nonPremierUsers.length > 0) {
      const nonPremierIds = nonPremierUsers.map(u => u.id)
      await fetch(
        `${supabaseUrl}/rest/v1/users?user_id=eq.${encodeURIComponent(userId)}&id=in.(${nonPremierIds.map(id => `"${id}"`).join(',')})`,
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
    }
    
    // Disable Premier users but preserve their Premier role
    if (premierUsers.length > 0) {
      for (const premierUser of premierUsers) {
        await fetch(
          `${supabaseUrl}/rest/v1/users?id=eq.${encodeURIComponent(premierUser.id)}`,
          {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              apikey: supabaseKey,
              Authorization: `Bearer ${supabaseKey}`,
              Prefer: 'return=minimal',
            },
            body: JSON.stringify({ status: 'disable' }), // Only update status, preserve Premier role
          }
        )
      }
    }

    // Owner must always remain 'enable'
    const ownerDbRow = allUsers.find((u: any) => String(u.title || '').trim().toLowerCase() === 'owner')
    if (ownerDbRow) {
      await fetch(
        `${supabaseUrl}/rest/v1/users?id=eq.${encodeURIComponent(ownerDbRow.id)}`,
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
    }

    console.log('[stripe-webhook] subscription expired', { userId, email })
    return { userId }
  } catch (e: any) {
    console.error('[stripe-webhook] handleSubscriptionExpiry failed:', e?.message)
    return null
  }
}

export async function POST(req: Request) {
  try {
    const secretKey = String(process.env.STRIPE_SECRET_KEY || '').trim()
    const webhookSecretRaw = String(process.env.STRIPE_WEBHOOK_SECRET || '').trim()
    if (!secretKey) return NextResponse.json({ error: 'Missing STRIPE_SECRET_KEY' }, { status: 500 })
    if (!webhookSecretRaw) return NextResponse.json({ error: 'Missing STRIPE_WEBHOOK_SECRET' }, { status: 500 })

    const smallPrice = String(process.env.STRIPE_PRICE_ID_SMALL_DEALERSHIP || '').trim()
    const mediumPrice = String(process.env.STRIPE_PRICE_ID_MEDIUM_DEALERSHIP || '').trim()
    const largePrice = String(process.env.STRIPE_PRICE_ID_LARGE_DEALERSHIP || '').trim()

    console.log('[stripe-webhook] Price IDs loaded:', {
      small: smallPrice ? `${smallPrice.substring(0, 15)}...` : 'MISSING',
      medium: mediumPrice ? `${mediumPrice.substring(0, 15)}...` : 'MISSING',
      large: largePrice ? `${largePrice.substring(0, 15)}...` : 'MISSING',
    })

    const stripe = new Stripe(secretKey)

    const sig = req.headers.get('stripe-signature')
    if (!sig) return NextResponse.json({ error: 'Missing Stripe signature' }, { status: 400 })

    const rawBody = Buffer.from(await req.arrayBuffer())

    const webhookSecrets = Array.from(
      new Set(
        webhookSecretRaw
          .split(/[\s,]+/g)
          .map((s) => s.trim())
          .filter(Boolean)
      )
    )

    let event: Stripe.Event | null = null
    try {
      let lastErr: any = null
      for (const secret of webhookSecrets) {
        try {
          event = stripe.webhooks.constructEvent(rawBody, sig, secret)
          lastErr = null
          break
        } catch (e: any) {
          lastErr = e
        }
      }
      if (!event) throw lastErr || new Error('Unable to verify webhook signature')
    } catch (err: any) {
      return NextResponse.json(
        {
          error: `Webhook signature verification failed: ${String(err?.message || err)}`,
          hint: 'Check STRIPE_WEBHOOK_SECRET matches the signing secret for this endpoint (test vs live). You can provide multiple secrets separated by commas.'
        },
        { status: 400 }
      )
    }

    console.log('[stripe-webhook]', event.type)

    const applyRoleUpdate = async (email: string, plan: Plan) => {
      const normalized = normalizeEmail(email)
      if (!normalized) throw new Error('Missing customer email')
      const role = planToRole[plan]

      // Update ALL users under this owner (not just the owner)
      await updateAllUsersRoleByOwnerEmail(normalized, role)

      // Enable subscription for all users under this owner + set subscription_end
      try {
        await enableSubscriptionUsers(normalized)
      } catch (e: any) {
        console.error('[stripe-webhook] enableSubscriptionUsers error:', e?.message)
      }

      return { email: normalized, role, plan }
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session
      let sessionPlan = String((session.metadata as any)?.plan || '').trim().toLowerCase() as Plan
      const product = String((session.metadata as any)?.product || '').trim().toLowerCase()
      // Use a mutable alias for product detection logic below
      let esignProduct = product

      console.log('[stripe-webhook] session.metadata.plan:', sessionPlan)

      const mode = String((session as any)?.mode || '').trim().toLowerCase()
      if (mode === 'subscription') {
        // For subscriptions (including free trials), update once the subscription exists and is active/trialing.
        let email = normalizeEmail((session as any)?.customer_details?.email || session.customer_email)
        if (!email && session.customer) {
          const customer = (await stripe.customers.retrieve(String(session.customer))) as Stripe.Customer
          email = normalizeEmail((customer as any)?.email)
        }

        // Handle E‑Signature Unlimited sold as a subscription
        try {
          const metaProduct = String((session.metadata as any)?.product || '').trim().toLowerCase()
          const metaTier = String((session.metadata as any)?.tier || '').trim().toLowerCase()
          const rawSubId = (session as any)?.subscription
          const subscriptionId = typeof rawSubId === 'string' ? rawSubId : rawSubId?.id
          let isEsignUnlimited = metaProduct === 'esignature' && metaTier === 'unlimited'

          // Fallback: detect via line_items price ID
          if (!isEsignUnlimited) {
            try {
              const priceUnlimited = String(
                process.env.STRIPE_PRICE_ID_ESIGN_UNLIMITED || (process.env as any)['STRIPE_PRICE_ID_E-SIGN_UNLIMITED'] || ''
              ).trim()
              const full = await stripe.checkout.sessions.retrieve(session.id, { expand: ['line_items.data.price'] })
              const firstLine: any = full.line_items?.data?.[0]
              const linePriceId = String(firstLine?.price?.id || '').trim()
              if (priceUnlimited && linePriceId && linePriceId === priceUnlimited) {
                isEsignUnlimited = true
              }
              console.log('[stripe-webhook] subscription esign detect via line_items', { linePriceId, isEsignUnlimited })
            } catch (e: any) {
              console.log('[stripe-webhook] subscription esign detect via line_items failed', String(e?.message || e))
            }
          }

          if (isEsignUnlimited && subscriptionId) {
            // Ensure we have an email (derive from customer if missing)
            if (!email && session.customer) {
              const customer = (await stripe.customers.retrieve(String(session.customer))) as Stripe.Customer
              email = normalizeEmail((customer as any)?.email)
            }
            if (!email) {
              return NextResponse.json({ received: true, skipped: true, reason: 'esign subscription missing email' })
            }

            const idempotencyKey = `esign-sub:${subscriptionId}`
            const idem = await markWebhookEventProcessed(idempotencyKey, event.type)
            if (idem.alreadyProcessed) {
              console.log('[stripe-webhook] esign-subscription skip duplicate', { key: idempotencyKey })
              return NextResponse.json({ received: true, skipped: true, reason: 'duplicate esign subscription event' })
            }
            if (!idem.ok || (idem as any).durable === false) {
              return NextResponse.json({ error: 'Idempotency store unavailable (esign subscription)' }, { status: 500 })
            }

            const wallet = await getEsignWalletByEmail(email)
            const now = Date.now()
            let baseMs = now
            try {
              const current = wallet.esignUnlimitedUntil ? new Date(String(wallet.esignUnlimitedUntil)) : null
              if (current && !Number.isNaN(current.getTime()) && current.getTime() > now) baseMs = current.getTime()
            } catch {}
            const until = new Date(baseMs + 30 * 24 * 60 * 60 * 1000).toISOString()
            await updateEsignWalletByEmail(email, { esign_unlimited_until: until })
            console.log('[stripe-webhook] esign-unlimited (subscription) extended', { email, until, subscriptionId })
            return NextResponse.json({ received: true, esign_unlimited_until: until, subscriptionId })
          }
        } catch (e: any) {
          console.error('[stripe-webhook] esign subscription handling failed:', e?.message)
        }

        // Try to get plan from session line_items first (most reliable)
        if (!(sessionPlan === 'starter' || sessionPlan === 'small' || sessionPlan === 'medium' || sessionPlan === 'large')) {
          try {
            const sessionWithLineItems = await stripe.checkout.sessions.retrieve(session.id, {
              expand: ['line_items.data.price.product'],
            })
            const firstLineItem: any = sessionWithLineItems.line_items?.data?.[0]
            if (firstLineItem) {
              const priceId = String(firstLineItem?.price?.id || '').trim()
              console.log('[stripe-webhook] line_items priceId:', priceId)
              const derived = getPlanFromPriceId(priceId, smallPrice, mediumPrice, largePrice)
              if (derived) {
                sessionPlan = derived
                console.log('[stripe-webhook] detected from line_items priceId:', sessionPlan)
              } else {
                // Try product description from line items
                const productName = String(firstLineItem?.price?.product?.name || firstLineItem?.description || '').toLowerCase()
                console.log('[stripe-webhook] line_items product name:', productName)
                if (productName.includes('small')) sessionPlan = 'small'
                else if (productName.includes('medium') || productName.includes('meduim')) sessionPlan = 'medium'
                else if (productName.includes('large')) sessionPlan = 'large'
                console.log('[stripe-webhook] detected from line_items product name:', sessionPlan)
              }
            }
          } catch (e: any) {
            console.error('[stripe-webhook] failed to retrieve line_items:', e.message)
          }
        }

        // If still not found, derive plan from subscription
        if (!(sessionPlan === 'starter' || sessionPlan === 'small' || sessionPlan === 'medium' || sessionPlan === 'large')) {
          console.log('[stripe-webhook] session plan not valid, checking subscription metadata')
          const rawSubId = (session as any)?.subscription
          const subscriptionId = typeof rawSubId === 'string' ? rawSubId : rawSubId?.id
          if (subscriptionId) {
            const sub = await stripe.subscriptions.retrieve(String(subscriptionId), {
              expand: ['items.data.price', 'items.data.price.product'],
            })
            const metaPlan = String((sub.metadata as any)?.plan || '').trim().toLowerCase()
            console.log('[stripe-webhook] subscription.metadata.plan:', metaPlan)
            if (metaPlan === 'starter' || metaPlan === 'small' || metaPlan === 'medium' || metaPlan === 'large') {
              sessionPlan = metaPlan as Plan
            } else {
              const firstItem: any = (sub.items?.data || [])[0]
              const priceId = String(firstItem?.price?.id || '').trim()
              console.log('[stripe-webhook] checking priceId:', priceId, 'against', { smallPrice, mediumPrice, largePrice })
              const derived = getPlanFromPriceId(priceId, smallPrice, mediumPrice, largePrice)
              console.log('[stripe-webhook] derived plan from priceId:', derived)
              if (derived) {
                sessionPlan = derived
              } else {
                // Fallback: detect from product description
                const productDescription = String(firstItem?.price?.product?.description || firstItem?.price?.product?.name || '').toLowerCase()
                console.log('[stripe-webhook] trying to detect from product description:', productDescription)
                if (productDescription.includes('small')) sessionPlan = 'small'
                else if (productDescription.includes('medium') || productDescription.includes('meduim')) sessionPlan = 'medium'
                else if (productDescription.includes('large')) sessionPlan = 'large'
                console.log('[stripe-webhook] detected from description:', sessionPlan)
              }
            }
          }
        }

        console.log('[stripe-webhook] final sessionPlan:', sessionPlan, 'role will be:', planToRole[sessionPlan])

        if (email && (sessionPlan === 'starter' || sessionPlan === 'small' || sessionPlan === 'medium' || sessionPlan === 'large')) {
          const result = await applyRoleUpdate(email, sessionPlan)
          console.log('[stripe-webhook] role-updated', result)

          if (sessionPlan === 'small' || sessionPlan === 'medium' || sessionPlan === 'large') {
            let badgeSent = false
            let badgeError: string | null = null
            let subscriptSent = false
            let subscriptError: string | null = null
            try {
              const userId = await getUserIdByEmail(email)
              await sendDealershipBadgeWebhook(userId)
              badgeSent = true
              try {
                await sendDealershipSubscriptWebhook(userId)
                subscriptSent = true
              } catch (e: any) {
                subscriptError = String(e?.message || e)
                console.error('[stripe-webhook] subscript webhook failed', subscriptError)
              }
            } catch (e: any) {
              badgeError = String(e?.message || e)
              console.error('[stripe-webhook] badge webhook failed', badgeError)
            }

            return NextResponse.json({
              received: true,
              updated: result,
              badge: { sent: badgeSent, error: badgeError },
              subscript: { sent: subscriptSent, error: subscriptError },
            })
          }

          return NextResponse.json({ received: true, updated: result })
        }

        return NextResponse.json({ received: true, skipped: true, reason: 'subscription checkout completed but missing email/plan' })
      }

      // If you want to strictly update only after payment is successful, require paid.
      const paymentStatus = String((session as any)?.payment_status || '').toLowerCase()
      const isSettled = paymentStatus === 'paid' || paymentStatus === 'no_payment_required'
      if (!isSettled) {
        return NextResponse.json({ received: true, skipped: true, reason: 'checkout.session.completed but not paid' })
      }

      let email = normalizeEmail((session as any)?.customer_details?.email || session.customer_email)
      if (!email && session.customer) {
        const customer = (await stripe.customers.retrieve(String(session.customer))) as Stripe.Customer
        email = normalizeEmail((customer as any)?.email)
      }

      // Handle E‑Signature add‑ons purchased via Stripe Checkout
      // Some webhooks may omit metadata, so detect from line items as a fallback
      let esignTier = String((session.metadata as any)?.tier || '').trim().toLowerCase()
      if (esignProduct !== 'esignature') {
        try {
          const priceUpto5 = String(
            (process.env as any).STRIPE_PRICE_ID_ESIGN_BUNDLE ||
              process.env.STRIPE_PRICE_ID_ESIGN_UPTO_5 ||
              (process.env as any)['STRIPE_PRICE_ID_E-SIGN_BUNDLE'] ||
              ''
          ).trim()
          const priceUnlimited = String(
            process.env.STRIPE_PRICE_ID_ESIGN_UNLIMITED || (process.env as any)['STRIPE_PRICE_ID_E-SIGN_UNLIMITED'] || ''
          ).trim()

          const sessionWithLineItems = await stripe.checkout.sessions.retrieve(String(session.id), {
            expand: ['line_items.data.price']
          })
          const firstLine: any = sessionWithLineItems.line_items?.data?.[0]
          const linePriceId = String(firstLine?.price?.id || '').trim()
          if (linePriceId) {
            if (priceUpto5 && linePriceId === priceUpto5) { esignProduct = 'esignature'; esignTier = 'upto_5' }
            if (priceUnlimited && linePriceId === priceUnlimited) { esignProduct = 'esignature'; esignTier = 'unlimited' }
          }
          console.log('[stripe-webhook] esign detect via line_items', { linePriceId, product: esignProduct, esignTier })
        } catch (e: any) {
          console.log('[stripe-webhook] esign detect via line_items failed', String(e?.message || e))
        }
      }

      if (esignProduct === 'esignature') {
        if (!email) return NextResponse.json({ received: true, skipped: true, reason: 'missing email for esignature purchase' })

        const tier = esignTier || String((session.metadata as any)?.tier || '').trim().toLowerCase()
        const sessionId = String((session as any)?.id || '').trim()
        const idempotencyKey = sessionId ? `esign:${tier}:${sessionId}` : `event:${String((event as any)?.id || '').trim()}`

        // Ensure idempotency before updating wallet
        const idempotency = await markWebhookEventProcessed(idempotencyKey, event.type)
        if (idempotency.alreadyProcessed) {
          console.log('[stripe-webhook] esign-skip-duplicate', { key: idempotencyKey })
          return NextResponse.json({ received: true, skipped: true, reason: 'duplicate esign event' })
        }
        if (!idempotency.ok || (idempotency as any).durable === false) {
          return NextResponse.json(
            { error: 'Idempotency store unavailable for esign purchase', key: idempotencyKey, details: (idempotency as any).error || null },
            { status: 500 }
          )
        }

        try {
          const wallet = await getEsignWalletByEmail(email)

          if (tier === 'upto_5') {
            const next = Number(wallet.esignCredits) + 5
            await updateEsignWalletByEmail(email, { esign_credits: next })
            console.log('[stripe-webhook] esign-bundle-credited', { email, added: 5, total: next, sessionId })
            return NextResponse.json({ received: true, esign_credits: next })
          }

          if (tier === 'unlimited') {
            const now = Date.now()
            let baseMs = now
            try {
              const current = wallet.esignUnlimitedUntil ? new Date(String(wallet.esignUnlimitedUntil)) : null
              if (current && !Number.isNaN(current.getTime()) && current.getTime() > now) {
                baseMs = current.getTime()
              }
            } catch { baseMs = now }
            const until = new Date(baseMs + 30 * 24 * 60 * 60 * 1000).toISOString()
            await updateEsignWalletByEmail(email, { esign_unlimited_until: until })
            console.log('[stripe-webhook] esign-unlimited-extended', { email, until, sessionId })
            return NextResponse.json({ received: true, esign_unlimited_until: until })
          }

          return NextResponse.json({ received: true, skipped: true, reason: `unknown esignature tier: ${tier || 'missing'}` })
        } catch (e: any) {
          console.error('[stripe-webhook] esign processing failed:', e?.message)
          return NextResponse.json({ error: e?.message || 'esign processing failed' }, { status: 500 })
        }
      }

      // Top up balance (pay-per-use)
      if (product === 'topup') {
        if (!email) throw new Error('Missing customer email')

        const sessionId = String((session as any)?.id || '').trim()
        const idempotencyKey = sessionId ? `topup:${sessionId}` : `event:${String((event as any)?.id || '').trim()}`

        // Stripe may deliver a "thin" Checkout Session in webhook payloads where amount_total is missing.
        // In that case, retrieve the full session and/or payment_intent to get the actual paid amount.
        const payloadAmountTotal = (session as any)?.amount_total
        let amountTotalCents = Number(payloadAmountTotal ?? 0)
        const sessionIdForAmount = String((session as any)?.id || '').trim()
        const payloadMode = String((session as any)?.mode || '').trim().toLowerCase()
        const payloadPaymentStatus = String((session as any)?.payment_status || '').trim().toLowerCase()
        let retrieveAttempted = false
        let retrieveError: string | null = null
        let lineItemsSumCents: number | null = null
        let listLineItemsAttempted = false
        let listLineItemsError: string | null = null
        let paymentIntentRetrieveAttempted = false
        let paymentIntentRetrieveError: string | null = null
        const payloadPaymentIntent = (session as any)?.payment_intent ?? null
        let retrievedAmountTotalCents: number | null = null
        let retrievedAmountSubtotalCents: number | null = null
        let lineItemsCount: number | null = null
        if (!(Number.isFinite(amountTotalCents) && amountTotalCents > 0) && sessionIdForAmount) {
          retrieveAttempted = true
          try {
            const full = (await stripe.checkout.sessions.retrieve(sessionIdForAmount, {
              expand: ['payment_intent'],
            })) as any
            retrievedAmountTotalCents = Number(full?.amount_total ?? 0)
            retrievedAmountSubtotalCents = Number(full?.amount_subtotal ?? 0)

            // Prefer amount_total, then amount_subtotal
            amountTotalCents = Number(retrievedAmountTotalCents ?? 0)
            if (!(Number.isFinite(amountTotalCents) && amountTotalCents > 0)) {
              const sub = Number(retrievedAmountSubtotalCents ?? 0)
              if (Number.isFinite(sub) && sub > 0) amountTotalCents = sub
            }

            if (!(Number.isFinite(amountTotalCents) && amountTotalCents > 0)) {
              // Prefer explicit line items list (more reliable than expand).
              listLineItemsAttempted = true
              try {
                const items = await stripe.checkout.sessions.listLineItems(sessionIdForAmount, { limit: 100 })
                const li = items?.data
                if (Array.isArray(li)) {
                  lineItemsCount = li.length
                  if (li.length > 0) {
                    const sum = li.reduce((acc: number, item: any) => {
                      const v = Number(item?.amount_total ?? item?.amount_subtotal ?? 0)
                      return acc + (Number.isFinite(v) ? v : 0)
                    }, 0)
                    if (Number.isFinite(sum)) lineItemsSumCents = sum
                  }
                }
              } catch (e: any) {
                listLineItemsError = String(e?.message || e)
              }

              if (Number.isFinite(Number(lineItemsSumCents)) && Number(lineItemsSumCents) > 0) {
                amountTotalCents = Number(lineItemsSumCents)
              }

              // Fallback to payment intent amount
              let pi: any = full?.payment_intent
              const piId =
                (typeof pi === 'string' ? pi : null) ||
                (typeof pi?.id === 'string' ? pi.id : null) ||
                (typeof payloadPaymentIntent === 'string' ? payloadPaymentIntent : null) ||
                (typeof payloadPaymentIntent?.id === 'string' ? payloadPaymentIntent.id : null)

              if (piId) {
                paymentIntentRetrieveAttempted = true
                try {
                  pi = await stripe.paymentIntents.retrieve(piId)
                } catch (e: any) {
                  paymentIntentRetrieveError = String(e?.message || e)
                }
              }

              const fallback = Number(pi?.amount_received ?? pi?.amount ?? 0)
              if (Number.isFinite(fallback) && fallback > 0) amountTotalCents = fallback
            }
          } catch (e: any) {
            retrieveError = String(e?.message || e)
          }
        }

        // Credit exactly what was paid (after discounts / promotion codes).
        const amount = Number.isFinite(amountTotalCents) ? amountTotalCents / 100 : 0
        if (amount === 0) {
          // Fully discounted (voucher) payments can legitimately be $0. Mark idempotency so retries don't loop,
          // but do not modify balance.
          const idempotency = await markWebhookEventProcessed(idempotencyKey, event.type)
          if (!idempotency.ok || (idempotency as any).durable === false) {
            return NextResponse.json(
              {
                error: 'Top up idempotency store unavailable. Create table stripe_webhook_events to prevent double credits.',
                key: idempotencyKey,
                details: (idempotency as any).error || null,
              },
              { status: 500 }
            )
          }

          const { balance } = await getUserBalanceByEmail(email)
          return NextResponse.json({ balance })
        }

        if (!(amount > 0)) {
          return NextResponse.json(
            {
              error: 'topup settled but missing amount',
              sessionId: sessionIdForAmount || null,
              payloadAmountTotal: payloadAmountTotal ?? null,
              payloadMode,
              payloadPaymentStatus,
              payloadPaymentIntent,
              retrieveAttempted,
              retrieveError,
              retrievedAmountTotalCents,
              retrievedAmountSubtotalCents,
              lineItemsCount,
              lineItemsSumCents,
              listLineItemsAttempted,
              listLineItemsError,
              paymentIntentRetrieveAttempted,
              paymentIntentRetrieveError,
            },
            { status: 500 }
          )
        }

        // Only mark idempotency AFTER we have a valid amount (and we are about to persist).
        const idempotency = await markWebhookEventProcessed(idempotencyKey, event.type)
        if (idempotency.alreadyProcessed) {
          console.log('[stripe-webhook] topup-skip-duplicate', { key: idempotencyKey, durable: (idempotency as any).durable })
          const { balance } = await getUserBalanceByEmail(email)
          return NextResponse.json({ balance })
        }

        // Money-moving operation: require durable idempotency store.
        if (!idempotency.ok || (idempotency as any).durable === false) {
          return NextResponse.json(
            {
              error: 'Top up idempotency store unavailable. Create table stripe_webhook_events to prevent double credits.',
              key: idempotencyKey,
              details: (idempotency as any).error || null,
            },
            { status: 500 }
          )
        }

        const { balance: currentBalance } = await getUserBalanceByEmail(email)
        const nextBalance = Number(currentBalance) + Number(amount)
        await setUserBalanceByEmail(email, nextBalance)

        console.log('[stripe-webhook] balance-topped-up', { email, amount, nextBalance, sessionId: session.id })
        return NextResponse.json({ balance: nextBalance })
      }

      // If metadata is missing, derive plan from subscription
      if (!(sessionPlan === 'starter' || sessionPlan === 'small' || sessionPlan === 'medium' || sessionPlan === 'large')) {
        const rawSubId = (session as any)?.subscription
        const subscriptionId = typeof rawSubId === 'string' ? rawSubId : rawSubId?.id
        if (subscriptionId) {
          const sub = await stripe.subscriptions.retrieve(String(subscriptionId), {
            expand: ['items.data.price'],
          })
          const metaPlan = String((sub.metadata as any)?.plan || '').trim().toLowerCase()
          if (metaPlan === 'starter' || metaPlan === 'small' || metaPlan === 'medium' || metaPlan === 'large') {
            sessionPlan = metaPlan as Plan
          } else {
            const firstItem: any = (sub.items?.data || [])[0]
            const priceId = String(firstItem?.price?.id || '').trim()
            const derived = getPlanFromPriceId(priceId, smallPrice, mediumPrice, largePrice)
            if (derived) sessionPlan = derived
          }
        }
      }

      if (email && (sessionPlan === 'starter' || sessionPlan === 'small' || sessionPlan === 'medium' || sessionPlan === 'large')) {
        const result = await applyRoleUpdate(email, sessionPlan)
        console.log('[stripe-webhook] role-updated', result)
        return NextResponse.json({ received: true, updated: result })
      }

      console.log('[stripe-webhook] skipped checkout.session.completed', {
        hasEmail: Boolean(email),
        sessionPlan: sessionPlan || null,
      })
      return NextResponse.json({ received: true, skipped: true })
    }

    if (event.type === 'invoice.paid' || event.type === 'invoice.payment_succeeded') {
      const invoice = event.data.object as Stripe.Invoice

      let email = normalizeEmail((invoice as any)?.customer_email)
      if (!email && invoice.customer) {
        const customer = (await stripe.customers.retrieve(String(invoice.customer))) as Stripe.Customer
        email = normalizeEmail((customer as any)?.email)
      }

      let plan: Plan | null = null

      // Prefer subscription metadata.plan
      const rawSub = (invoice as any)?.subscription
      const subscriptionId = typeof rawSub === 'string' ? rawSub : rawSub?.id
      if (subscriptionId) {
        const sub = await stripe.subscriptions.retrieve(String(subscriptionId), {
          expand: ['items.data.price', 'items.data.price.product'],
        })
        const metaPlan = String((sub.metadata as any)?.plan || '').trim().toLowerCase()
        if (metaPlan === 'starter' || metaPlan === 'small' || metaPlan === 'medium' || metaPlan === 'large') plan = metaPlan as Plan

        if (!plan) {
          const firstItem: any = (sub.items?.data || [])[0]
          const priceId = String(firstItem?.price?.id || '').trim()
          plan = getPlanFromPriceId(priceId, smallPrice, mediumPrice, largePrice)
          
          // Fallback: detect from product description
          if (!plan) {
            const productDescription = String(firstItem?.price?.product?.description || firstItem?.price?.product?.name || '').toLowerCase()
            if (productDescription.includes('small')) plan = 'small'
            else if (productDescription.includes('medium') || productDescription.includes('meduim')) plan = 'medium'
            else if (productDescription.includes('large')) plan = 'large'
          }
        }
      }

      // Fallback to invoice line price id
      if (!plan) {
        const firstLine: any = (invoice.lines?.data || [])[0]
        const priceId = String(firstLine?.price?.id || '').trim()
        plan = getPlanFromPriceId(priceId, smallPrice, mediumPrice, largePrice)
      }

      if (email && plan) {
        const result = await applyRoleUpdate(email, plan)
        console.log('[stripe-webhook] role-updated', result)

        // Send badge webhook after successful Dealership payment
        if (plan === 'small' || plan === 'medium' || plan === 'large') {
          let badgeSent = false
          let badgeError: string | null = null
          let subscriptSent = false
          let subscriptError: string | null = null
          try {
            const userId = await getUserIdByEmail(email)
            await sendDealershipBadgeWebhook(userId)
            badgeSent = true
            try {
              await sendDealershipSubscriptWebhook(userId)
              subscriptSent = true
            } catch (e: any) {
              subscriptError = String(e?.message || e)
              console.error('[stripe-webhook] subscript webhook failed', subscriptError)
            }
          } catch (e: any) {
            badgeError = String(e?.message || e)
            console.error('[stripe-webhook] badge webhook failed', badgeError)
          }

          return NextResponse.json({
            received: true,
            updated: result,
            badge: { sent: badgeSent, error: badgeError },
            subscript: { sent: subscriptSent, error: subscriptError },
          })
        }

        return NextResponse.json({ received: true, updated: result })
      }

      console.log('[stripe-webhook] skipped invoice event', {
        hasEmail: Boolean(email),
        plan: plan || null,
      })
      return NextResponse.json({ received: true, skipped: true })
    }

    // Handle customer deletion
    if (event.type === 'customer.deleted') {
      const customer = event.data.object as Stripe.Customer
      const email = normalizeEmail((customer as any)?.email)
      
      if (email) {
        await handleSubscriptionExpiry(email)
        console.log('[stripe-webhook] customer deleted, subscription expired', { email })
        return NextResponse.json({ received: true, expired: true, email, reason: 'customer_deleted' })
      }
    }

    // Handle subscription cancellation / deletion
    if (event.type === 'customer.subscription.deleted' || event.type === 'customer.subscription.updated') {
      const subscription = event.data.object as Stripe.Subscription
      const subStatus = String((subscription as any)?.status || '').trim().toLowerCase()

      // Only expire on deletion or terminal states
      const isExpired = event.type === 'customer.subscription.deleted' ||
        subStatus === 'canceled' || subStatus === 'unpaid' || subStatus === 'past_due'

      if (isExpired) {
        let email = ''
        if (subscription.customer) {
          try {
            const customer = (await stripe.customers.retrieve(String(subscription.customer))) as Stripe.Customer
            email = normalizeEmail((customer as any)?.email)
          } catch { /* ignore */ }
        }

        if (email) {
          await handleSubscriptionExpiry(email)
          console.log('[stripe-webhook] subscription expired via', event.type, { email, subStatus })
          return NextResponse.json({ received: true, expired: true, email })
        }
      }
    }

    return NextResponse.json({ received: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Webhook handler failed' }, { status: 500 })
  }
}
