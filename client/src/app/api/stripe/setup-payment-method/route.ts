import Stripe from 'stripe'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  try {
    const secretKey = String(process.env.STRIPE_SECRET_KEY || '').trim()
    if (!secretKey) {
      return NextResponse.json({ error: 'Missing STRIPE_SECRET_KEY' }, { status: 500 })
    }

    const body = (await req.json().catch(() => ({}))) as { email?: string }
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
    if (!email) {
      return NextResponse.json({ error: 'Missing email' }, { status: 400 })
    }

    const siteUrlFromEnv = String(process.env.NEXT_PUBLIC_SITE_URL || '').trim().replace(/\/+$/, '')
    const origin = String(req.headers.get('origin') || '').trim().replace(/\/+$/, '')
    const siteUrl = siteUrlFromEnv || origin
    if (!siteUrl) {
      return NextResponse.json({ error: 'Missing NEXT_PUBLIC_SITE_URL (or Origin header)' }, { status: 500 })
    }

    const stripe = new Stripe(secretKey)

    const session = await stripe.checkout.sessions.create({
      mode: 'setup',
      customer_email: email || undefined,
      customer_creation: 'always',
      payment_method_types: ['card'],
      success_url: `${siteUrl}/admin/billing?pm_setup_success=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/admin/billing?pm_setup_canceled=1`,
      metadata: {
        product: 'pm_setup',
      },
    })

    return NextResponse.json({ url: session.url })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to create setup session' }, { status: 500 })
  }
}
