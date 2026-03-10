import Stripe from 'stripe'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

type Plan = 'starter' | 'small' | 'medium' | 'large'

export async function POST(req: Request) {
  try {
    const secretKey = String(process.env.STRIPE_SECRET_KEY || '').trim()
    if (!secretKey) {
      return NextResponse.json({ error: 'Missing STRIPE_SECRET_KEY' }, { status: 500 })
    }

    const smallPrice = String(process.env.STRIPE_PRICE_ID_SMALL_DEALERSHIP || '').trim()
    const mediumPrice = String(process.env.STRIPE_PRICE_ID_MEDIUM_DEALERSHIP || '').trim()
    const largePrice = String(process.env.STRIPE_PRICE_ID_LARGE_DEALERSHIP || '').trim()

    const body = await req.json().catch(() => ({} as any))
    const plan = String(body?.plan || '').toLowerCase() as Plan
    const email = typeof body?.email === 'string' ? body.email.trim() : ''

    let priceId = ''
    if (plan === 'small') priceId = smallPrice
    else if (plan === 'medium') priceId = mediumPrice
    else if (plan === 'large') priceId = largePrice
    
    if (!priceId) {
      return NextResponse.json({ error: 'Selected plan is not purchasable or missing Stripe Price ID' }, { status: 400 })
    }

    const siteUrlFromEnv = String(process.env.NEXT_PUBLIC_SITE_URL || '').trim().replace(/\/$/, '')
    const origin = String(req.headers.get('origin') || '').trim().replace(/\/$/, '')
    const siteUrl = siteUrlFromEnv || origin
    if (!siteUrl) {
      return NextResponse.json({ error: 'Missing NEXT_PUBLIC_SITE_URL (or Origin header)' }, { status: 500 })
    }

    const stripe = new Stripe(secretKey)

    // Subscription checkout requires a recurring price
    try {
      const price = await stripe.prices.retrieve(priceId)
      const isRecurring = !!(price as any)?.recurring
      if (!isRecurring) {
        return NextResponse.json(
          {
            error:
              'Selected price is not recurring. Create a monthly recurring Price in Stripe and set STRIPE_PRICE_ID_DEALERSHIP to that price id.',
          },
          { status: 400 }
        )
      }
    } catch (e: any) {
      return NextResponse.json({ error: e?.message || 'Unable to verify Stripe price' }, { status: 400 })
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${siteUrl}/admin/billing?success=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/admin/billing?canceled=1`,
      customer_email: email || undefined,
      allow_promotion_codes: true,
      metadata: {
        plan,
        email,
      },
      subscription_data: {
        metadata: {
          plan,
        },
      },
    })

    return NextResponse.json({ url: session.url })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to create Stripe Checkout Session' }, { status: 500 })
  }
}
