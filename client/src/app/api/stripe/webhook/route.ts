import Stripe from 'stripe'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

type Plan = 'starter' | 'small' | 'full'

type Role = 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE'

const planToRole: Record<Plan, Role> = {
  starter: 'STARTER',
  small: 'PROFESSIONAL',
  full: 'ENTERPRISE',
}

const normalizeEmail = (email: unknown) => String(email || '').trim().toLowerCase()

const getPlanFromPriceId = (priceId: string, starterPrice: string, smallPrice: string, fullPrice: string): Plan | null => {
  const pid = String(priceId || '').trim()
  if (!pid) return null
  if (starterPrice && pid === starterPrice) return 'starter'
  if (smallPrice && pid === smallPrice) return 'small'
  if (fullPrice && pid === fullPrice) return 'full'
  return null
}

const getSupabaseServerConfig = () => {
  const supabaseUrl = String(process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '')
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseKey) throw new Error('Supabase server not configured')
  return { supabaseUrl, supabaseKey }
}

const updateUserRoleByEmail = async (email: string, role: Role) => {
  const { supabaseUrl, supabaseKey } = getSupabaseServerConfig()

  const patchUrl = `${supabaseUrl}/rest/v1/users?email=ilike.${encodeURIComponent(email)}`
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

const getUserBalanceByEmail = async (email: string) => {
  const { supabaseUrl, supabaseKey } = getSupabaseServerConfig()

  const q = `${supabaseUrl}/rest/v1/users?select=id,email,balance&email=ilike.${encodeURIComponent(email)}&limit=1`
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
  return { id: String(row?.id || ''), email: String(row?.email || email), balance: Number.isFinite(current) ? current : 0 }
}

const getUserIdByEmail = async (email: string) => {
  const { supabaseUrl, supabaseKey } = getSupabaseServerConfig()

  const q = `${supabaseUrl}/rest/v1/users?select=user_id&email=ilike.${encodeURIComponent(email)}&limit=1`
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

const setUserBalanceByEmail = async (email: string, balance: number) => {
  const { supabaseUrl, supabaseKey } = getSupabaseServerConfig()
  const patchUrl = `${supabaseUrl}/rest/v1/users?email=ilike.${encodeURIComponent(email)}`

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

export async function POST(req: Request) {
  try {
    const secretKey = String(process.env.STRIPE_SECRET_KEY || '').trim()
    const webhookSecretRaw = String(process.env.STRIPE_WEBHOOK_SECRET || '').trim()
    if (!secretKey) return NextResponse.json({ error: 'Missing STRIPE_SECRET_KEY' }, { status: 500 })
    if (!webhookSecretRaw) return NextResponse.json({ error: 'Missing STRIPE_WEBHOOK_SECRET' }, { status: 500 })

    const starterPrice = String(process.env.STRIPE_PRICE_ID_STARTER || '').trim()
    const dealershipPrice = String(process.env.STRIPE_PRICE_ID_DEALERSHIP || '').trim()
    const smallPrice = dealershipPrice || String(process.env.STRIPE_PRICE_ID_SMALL || '').trim()
    const fullPrice = String(process.env.STRIPE_PRICE_ID_FULL || '').trim()

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

      await updateUserRoleByEmail(normalized, role)
      return { email: normalized, role, plan }
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session
      let sessionPlan = String((session.metadata as any)?.plan || '').trim().toLowerCase() as Plan
      const product = String((session.metadata as any)?.product || '').trim().toLowerCase()

      // For subscriptions, wait until invoice is paid before updating role.
      const mode = String((session as any)?.mode || '').trim().toLowerCase()
      if (mode === 'subscription') {
        return NextResponse.json({ received: true, skipped: true, reason: 'subscription checkout completed; waiting for invoice.paid' })
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

      // Top up balance (pay-per-use)
      if (product === 'topup') {
        if (!email) throw new Error('Missing customer email')

        const subtotalCents = Number((session as any)?.amount_subtotal ?? 0)
        const totalCents = Number((session as any)?.amount_total ?? 0)
        const creditCents = Number.isFinite(subtotalCents) && subtotalCents > 0 ? subtotalCents : totalCents
        const amount = Number.isFinite(creditCents) ? creditCents / 100 : 0
        if (!(amount > 0)) {
          return NextResponse.json({ received: true, skipped: true, reason: 'topup settled but missing amount' })
        }

        const { balance: current } = await getUserBalanceByEmail(email)
        const nextBalance = Number((current || 0) + amount)
        await setUserBalanceByEmail(email, nextBalance)

        console.log('[stripe-webhook] balance-topped-up', { email, amount, nextBalance, sessionId: session.id })
        return NextResponse.json({ received: true, updated: { email, amount, balance: nextBalance } })
      }

      // If metadata is missing, derive plan from subscription
      if (!(sessionPlan === 'starter' || sessionPlan === 'small' || sessionPlan === 'full')) {
        const rawSubId = (session as any)?.subscription
        const subscriptionId = typeof rawSubId === 'string' ? rawSubId : rawSubId?.id
        if (subscriptionId) {
          const sub = await stripe.subscriptions.retrieve(String(subscriptionId), {
            expand: ['items.data.price'],
          })
          const metaPlan = String((sub.metadata as any)?.plan || '').trim().toLowerCase()
          if (metaPlan === 'starter' || metaPlan === 'small' || metaPlan === 'full') {
            sessionPlan = metaPlan as Plan
          } else {
            const firstItem: any = (sub.items?.data || [])[0]
            const priceId = String(firstItem?.price?.id || '').trim()
            const derived = getPlanFromPriceId(priceId, starterPrice, smallPrice, fullPrice)
            if (derived) sessionPlan = derived
          }
        }
      }

      if (email && (sessionPlan === 'starter' || sessionPlan === 'small' || sessionPlan === 'full')) {
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
          expand: ['items.data.price'],
        })
        const metaPlan = String((sub.metadata as any)?.plan || '').trim().toLowerCase()
        if (metaPlan === 'starter' || metaPlan === 'small' || metaPlan === 'full') plan = metaPlan as Plan

        if (!plan) {
          const firstItem: any = (sub.items?.data || [])[0]
          const priceId = String(firstItem?.price?.id || '').trim()
          plan = getPlanFromPriceId(priceId, starterPrice, smallPrice, fullPrice)
        }
      }

      // Fallback to invoice line price id
      if (!plan) {
        const firstLine: any = (invoice.lines?.data || [])[0]
        const priceId = String(firstLine?.price?.id || '').trim()
        plan = getPlanFromPriceId(priceId, starterPrice, smallPrice, fullPrice)
      }

      if (email && plan) {
        const result = await applyRoleUpdate(email, plan)
        console.log('[stripe-webhook] role-updated', result)

        // Send badge webhook after successful Dealership payment
        if (plan === 'small') {
          let badgeSent = false
          let badgeError: string | null = null
          try {
            const userId = await getUserIdByEmail(email)
            await sendDealershipBadgeWebhook(userId)
            badgeSent = true
          } catch (e: any) {
            badgeError = String(e?.message || e)
            console.error('[stripe-webhook] badge webhook failed', badgeError)
          }

          return NextResponse.json({ received: true, updated: result, badge: { sent: badgeSent, error: badgeError } })
        }

        return NextResponse.json({ received: true, updated: result })
      }

      console.log('[stripe-webhook] skipped invoice event', {
        hasEmail: Boolean(email),
        plan: plan || null,
      })
      return NextResponse.json({ received: true, skipped: true })
    }

    return NextResponse.json({ received: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Webhook handler failed' }, { status: 500 })
  }
}
