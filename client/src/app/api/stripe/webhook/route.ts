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

const notifyExternalSubscriptionWebhook = async (payload: { email: string; subscriptionType: Plan; role: Role }) => {
  const url = String(process.env.SUBSCRIPTION_NOTIFY_WEBHOOK_URL || 'https://primary-production-6722.up.railway.app/webhook/subscript').trim()
  if (!url) return

  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 3500)
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: payload.email, subscription_type: payload.subscriptionType, role: payload.role }),
        signal: ctrl.signal,
      })
      const text = await res.text().catch(() => '')
      if (!res.ok) {
        console.log('[stripe-webhook] notify webhook failed', res.status, text)
      } else {
        console.log('[stripe-webhook] notify webhook ok', res.status, text)
      }
    } finally {
      clearTimeout(t)
    }
  } catch (e: any) {
    console.log('[stripe-webhook] notify webhook error', String(e?.message || e))
  }
}

const updateUserRoleByEmail = async (email: string, role: Role) => {
  const supabaseUrl = String(process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '')
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseKey) throw new Error('Supabase server not configured')

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

export async function POST(req: Request) {
  try {
    const secretKey = String(process.env.STRIPE_SECRET_KEY || '').trim()
    const webhookSecret = String(process.env.STRIPE_WEBHOOK_SECRET || '').trim()
    if (!secretKey) return NextResponse.json({ error: 'Missing STRIPE_SECRET_KEY' }, { status: 500 })
    if (!webhookSecret) return NextResponse.json({ error: 'Missing STRIPE_WEBHOOK_SECRET' }, { status: 500 })

    const starterPrice = String(process.env.STRIPE_PRICE_ID_STARTER || '').trim()
    const smallPrice = String(process.env.STRIPE_PRICE_ID_SMALL || '').trim()
    const fullPrice = String(process.env.STRIPE_PRICE_ID_FULL || '').trim()

    const stripe = new Stripe(secretKey)

    const sig = req.headers.get('stripe-signature')
    if (!sig) return NextResponse.json({ error: 'Missing Stripe signature' }, { status: 400 })

    const rawBody = await req.text()

    let event: Stripe.Event
    try {
      event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret)
    } catch (err: any) {
      return NextResponse.json({ error: `Webhook signature verification failed: ${String(err?.message || err)}` }, { status: 400 })
    }

    console.log('[stripe-webhook]', event.type)

    const applyRoleUpdate = async (email: string, plan: Plan) => {
      const normalized = normalizeEmail(email)
      if (!normalized) throw new Error('Missing customer email')
      const role = planToRole[plan]

      // Always notify external webhook for successful payments (do not depend on DB update)
      await notifyExternalSubscriptionWebhook({ email: normalized, subscriptionType: plan, role })

      // Best-effort DB update (do not block external webhook if it fails)
      try {
        await updateUserRoleByEmail(normalized, role)
      } catch (e: any) {
        console.log('[stripe-webhook] role update failed', normalized, String(e?.message || e))
      }

      return { email: normalized, role, plan }
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session
      let sessionPlan = String((session.metadata as any)?.plan || '').trim().toLowerCase() as Plan

      // If you want to strictly update only after payment is successful, require paid.
      const isPaid = String((session as any)?.payment_status || '').toLowerCase() === 'paid'
      if (!isPaid) {
        return NextResponse.json({ received: true, skipped: true, reason: 'checkout.session.completed but not paid' })
      }

      let email = normalizeEmail((session as any)?.customer_details?.email || session.customer_email)
      if (!email && session.customer) {
        const customer = (await stripe.customers.retrieve(String(session.customer))) as Stripe.Customer
        email = normalizeEmail((customer as any)?.email)
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
