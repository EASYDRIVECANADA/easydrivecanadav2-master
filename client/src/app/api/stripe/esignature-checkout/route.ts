import Stripe from 'stripe'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

type Tier = 'pay_per_use' | 'upto_5' | 'unlimited'

export async function POST(req: Request) {
  try {
    const secretKey = String(process.env.STRIPE_SECRET_KEY || '').trim()
    if (!secretKey) {
      return NextResponse.json({ error: 'Missing STRIPE_SECRET_KEY' }, { status: 500 })
    }

    const pricePayPerUse = String(
      (process.env as any).STRIPE_PRICE_ID_ESIGN_PER_USE ||
        process.env.STRIPE_PRICE_ID_ESIGN_PAY_PER_USE ||
        (process.env as any)['STRIPE_PRICE_ID_E-SIGN_PER_USE'] ||
        ''
    ).trim()
    const priceUpto5 = String(
      (process.env as any).STRIPE_PRICE_ID_ESIGN_BUNDLE ||
        process.env.STRIPE_PRICE_ID_ESIGN_UPTO_5 ||
        (process.env as any)['STRIPE_PRICE_ID_E-SIGN_BUNDLE'] ||
        ''
    ).trim()
    const priceUnlimited = String(
      process.env.STRIPE_PRICE_ID_ESIGN_UNLIMITED || (process.env as any)['STRIPE_PRICE_ID_E-SIGN_UNLIMITED'] || ''
    ).trim()

    const body = await req.json().catch(() => ({} as any))
    const tier = String(body?.tier || '').toLowerCase() as Tier
    const email = typeof body?.email === 'string' ? body.email.trim() : ''

    const priceId = tier === 'unlimited' ? priceUnlimited : tier === 'upto_5' ? priceUpto5 : tier === 'pay_per_use' ? pricePayPerUse : ''
    if (!priceId) {
      return NextResponse.json({ error: 'Missing price id for selected tier' }, { status: 400 })
    }

    const siteUrlFromEnv = String(process.env.NEXT_PUBLIC_SITE_URL || '').trim().replace(/\/+$/, '')
    const origin = String(req.headers.get('origin') || '').trim().replace(/\/+$/, '')
    const siteUrl = siteUrlFromEnv || origin
    if (!siteUrl) {
      return NextResponse.json({ error: 'Missing NEXT_PUBLIC_SITE_URL (or Origin header)' }, { status: 500 })
    }

    const stripe = new Stripe(secretKey)

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${siteUrl}/admin/settings/billing?esign_success=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/admin/settings/billing?esign_canceled=1`,
      customer_email: email || undefined,
      allow_promotion_codes: true,
      metadata: {
        product: 'esignature',
        tier,
      },
    })

    return NextResponse.json({ url: session.url })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to create Stripe Checkout Session' }, { status: 500 })
  }
}
