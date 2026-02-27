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

const updateUserRoleByEmail = async (email: string, role: Role) => {
  const supabaseUrl = String(process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '')
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseKey) throw new Error('Supabase server not configured')

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
  return text
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

    const applyRoleUpdate = async (email: string, plan: Plan) => {
      const normalized = normalizeEmail(email)
      if (!normalized) throw new Error('Missing customer email')
      const role = planToRole[plan]
      await updateUserRoleByEmail(normalized, role)
      return { email: normalized, role, plan }
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session
      const sessionPlan = String((session.metadata as any)?.plan || '').trim().toLowerCase() as Plan

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

      if (email && (sessionPlan === 'starter' || sessionPlan === 'small' || sessionPlan === 'full')) {
        const result = await applyRoleUpdate(email, sessionPlan)
        return NextResponse.json({ received: true, updated: result })
      }

      return NextResponse.json({ received: true, skipped: true })
    }

    if (event.type === 'invoice.paid') {
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
        return NextResponse.json({ received: true, updated: result })
      }

      return NextResponse.json({ received: true, skipped: true })
    }

    return NextResponse.json({ received: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Webhook handler failed' }, { status: 500 })
  }
}
