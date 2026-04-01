import Stripe from 'stripe'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

type Plan = 'starter' | 'small' | 'medium' | 'large'

type PlanStatus = {
  active: boolean
  validUntilIso: string | null
}

export async function POST(req: Request) {
  try {
    const secretKey = String(process.env.STRIPE_SECRET_KEY || '').trim()
    if (!secretKey) {
      return NextResponse.json({ error: 'Missing STRIPE_SECRET_KEY' }, { status: 500 })
    }

    const smallPrice = String(process.env.STRIPE_PRICE_ID_SMALL_DEALERSHIP || '').trim()
    const mediumPrice = String(process.env.STRIPE_PRICE_ID_MEDIUM_DEALERSHIP || '').trim()
    const largePrice = String(process.env.STRIPE_PRICE_ID_LARGE_DEALERSHIP || '').trim()

    const { email, userId } = (await req.json().catch(() => ({}))) as { email?: string; userId?: string }
    const normalizedEmail = String(email || '').trim().toLowerCase()
    const normalizedUserId = String(userId || '').trim()

    if (!normalizedEmail && !normalizedUserId) {
      return NextResponse.json({ error: 'Missing email or userId' }, { status: 400 })
    }

    const stripe = new Stripe(secretKey)

    const supabaseUrl = String(process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '')
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    // Build a set of all emails to try — start with the provided email
    const emailsToTry = new Set<string>()
    if (normalizedEmail) emailsToTry.add(normalizedEmail)

    // If userId provided, look up ALL emails for that user_id from DB
    if (normalizedUserId && supabaseUrl && supabaseKey) {
      try {
        const res = await fetch(
          `${supabaseUrl}/rest/v1/users?select=email&user_id=eq.${encodeURIComponent(normalizedUserId)}`,
          { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
        )
        if (res.ok) {
          const rows: any[] = await res.json().catch(() => [])
          for (const row of rows) {
            const e = String(row?.email || '').trim().toLowerCase()
            if (e) emailsToTry.add(e)
          }
        }
      } catch { /* non-fatal */ }
    }

    // Find the first Stripe customer that has an active subscription
    let customer: Stripe.Customer | null = null
    for (const tryEmail of Array.from(emailsToTry)) {
      const customers = await stripe.customers.list({ email: tryEmail, limit: 1 })
      const found = customers.data?.[0]
      if (found?.id) {
        // Check if this customer has any active/trialing subscription
        const check = await stripe.subscriptions.list({ customer: found.id, status: 'active', limit: 1 })
        if (check.data.length > 0) {
          customer = found
          break
        }
        // Keep as fallback even without active sub
        if (!customer) customer = found
      }
    }

    if (!customer?.id) {
      const empty: Record<Plan, PlanStatus> = {
        starter: { active: false, validUntilIso: null },
        small: { active: false, validUntilIso: null },
        medium: { active: false, validUntilIso: null },
        large: { active: false, validUntilIso: null },
      }
      return NextResponse.json({ plans: empty, anyActive: false })
    }

    const subs = await stripe.subscriptions.list({
      customer: customer.id,
      status: 'all',
      limit: 100,
      expand: ['data.items.data.price'],
    })

    const plans: Record<Plan, PlanStatus> = {
      starter: { active: false, validUntilIso: null },
      small: { active: false, validUntilIso: null },
      medium: { active: false, validUntilIso: null },
      large: { active: false, validUntilIso: null },
    }

    for (const sub of subs.data || []) {
      const status = String(sub.status || '').toLowerCase()
      const isActive = status === 'active' || status === 'trialing'
      if (!isActive) continue

      const rawCurrentPeriodEnd = Number((sub as any)?.current_period_end ?? 0)
      const rawTrialEnd = Number((sub as any)?.trial_end ?? 0)
      const rawCancelAt = Number((sub as any)?.cancel_at ?? 0)
      const rawCurrentPeriodStart = Number((sub as any)?.current_period_start ?? 0)

      let periodEndSec = Math.max(rawCurrentPeriodEnd, rawTrialEnd, rawCancelAt)

      if (!periodEndSec && rawCurrentPeriodStart) {
        const firstItem = ((sub.items?.data || []) as any[])[0]
        const recurring = firstItem?.price?.recurring
        const interval = String(recurring?.interval || '').toLowerCase()
        const intervalCount = Number(recurring?.interval_count ?? 1) || 1

        const startMs = rawCurrentPeriodStart * 1000
        const d = new Date(startMs)
        if (!Number.isNaN(d.getTime())) {
          if (interval === 'day') d.setUTCDate(d.getUTCDate() + intervalCount)
          else if (interval === 'week') d.setUTCDate(d.getUTCDate() + intervalCount * 7)
          else if (interval === 'month') d.setUTCMonth(d.getUTCMonth() + intervalCount)
          else if (interval === 'year') d.setUTCFullYear(d.getUTCFullYear() + intervalCount)

          const computedSec = Math.floor(d.getTime() / 1000)
          if (computedSec > 0) periodEndSec = computedSec
        }
      }

      const validUntilIso = periodEndSec > 0 ? new Date(periodEndSec * 1000).toISOString() : null

      for (const item of (sub.items?.data || []) as any[]) {
        const priceId = String(item?.price?.id || '').trim()
        if (!priceId) continue

        const apply = (plan: Plan) => {
          plans[plan].active = true
          if (!validUntilIso) return
          const cur = plans[plan].validUntilIso
          if (!cur || validUntilIso > cur) plans[plan].validUntilIso = validUntilIso
        }

        if (smallPrice && priceId === smallPrice) apply('small')
        else if (mediumPrice && priceId === mediumPrice) apply('medium')
        else if (largePrice && priceId === largePrice) apply('large')
      }
    }

    const anyActive = plans.starter.active || plans.small.active || plans.medium.active || plans.large.active

    // Persist subscription_end on the owner's users row (by email) for visibility in DB
    try {
      if (supabaseUrl && supabaseKey && normalizedEmail) {
        // Pick the furthest validUntilIso across active plans
        const isoCandidates = [plans.small.validUntilIso, plans.medium.validUntilIso, plans.large.validUntilIso].filter(
          (v): v is string => typeof v === 'string' && v.length > 0
        )
        let maxIso: string | null = null
        for (const iso of isoCandidates) {
          if (!maxIso || iso > maxIso) maxIso = iso
        }

        if (maxIso) {
          await fetch(`${supabaseUrl}/rest/v1/users?email=eq.${encodeURIComponent(normalizedEmail)}`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              apikey: supabaseKey,
              Authorization: `Bearer ${supabaseKey}`,
              Prefer: 'return=minimal',
            },
            body: JSON.stringify({ subscription_end: maxIso }),
          }).catch(() => null)
        }
      }
    } catch {
      // non-fatal: do not block response if persisting fails
    }

    return NextResponse.json({ plans, anyActive })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to read subscription status' }, { status: 500 })
  }
}
