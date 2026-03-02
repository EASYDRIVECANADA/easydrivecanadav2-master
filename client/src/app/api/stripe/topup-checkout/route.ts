import Stripe from 'stripe'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  try {
    const secretKey = String(process.env.STRIPE_SECRET_KEY || '').trim()
    if (!secretKey) {
      return NextResponse.json({ error: 'Missing STRIPE_SECRET_KEY' }, { status: 500 })
    }

    const body = await req.json().catch(() => ({} as any))
    const email = typeof body?.email === 'string' ? body.email.trim() : ''
    const priceId = typeof body?.price_id === 'string' ? body.price_id.trim() : ''

    const allowed = new Set(
      [
        'price_1T6YsuEMrH8YRtBa9x0Rk8Zp',
        'price_1T6YtREMrH8YRtBa133BorNY',
        'price_1T6YtfEMrH8YRtBabBs788gn',
        'price_1T6YtsEMrH8YRtBaNwhyjg6p',
      ].filter(Boolean)
    )

    if (!priceId || !allowed.has(priceId)) {
      return NextResponse.json({ error: 'Invalid top up price' }, { status: 400 })
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
      success_url: `${siteUrl}/admin/settings/billing?topup_success=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/admin/settings/billing?topup_canceled=1`,
      customer_email: email || undefined,
      allow_promotion_codes: true,
      metadata: {
        product: 'topup',
        price_id: priceId,
      },
    })

    return NextResponse.json({ url: session.url })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to create Stripe Checkout Session' }, { status: 500 })
  }
}
