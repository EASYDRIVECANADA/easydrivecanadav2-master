import Stripe from 'stripe'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  try {
    const secretKey = String(process.env.STRIPE_SECRET_KEY || '').trim()
    if (!secretKey) {
      return NextResponse.json({ error: 'Missing STRIPE_SECRET_KEY' }, { status: 500 })
    }

    const { email } = (await req.json().catch(() => ({}))) as { email?: string }
    const normalizedEmail = String(email || '').trim().toLowerCase()
    if (!normalizedEmail) {
      return NextResponse.json({ error: 'Missing email' }, { status: 400 })
    }

    const stripe = new Stripe(secretKey)

    // Find customer by email (there can be multiple)
    const customers = await stripe.customers.list({ email: normalizedEmail, limit: 10 })
    const candidates = customers.data || []
    if (candidates.length === 0) {
      return NextResponse.json({ paymentMethods: [] })
    }

    let customer: Stripe.Customer | null = null
    for (const c of candidates) {
      const defaultPmId = typeof c.invoice_settings?.default_payment_method === 'string'
        ? c.invoice_settings.default_payment_method
        : (c.invoice_settings?.default_payment_method as any)?.id || null
      if (defaultPmId) {
        customer = c
        break
      }

      const probe = await stripe.paymentMethods.list({ customer: c.id, type: 'card', limit: 1 })
      if (probe.data.length > 0) {
        customer = c
        break
      }
    }

    if (!customer) customer = candidates[0] as Stripe.Customer

    // Fetch payment methods for this customer
    const paymentMethods = await stripe.paymentMethods.list({
      customer: customer.id,
      type: 'card',
    })

    // Get default payment method
    const defaultPaymentMethodId = typeof customer.invoice_settings?.default_payment_method === 'string'
      ? customer.invoice_settings.default_payment_method
      : (customer.invoice_settings?.default_payment_method as any)?.id || null

    const formattedPaymentMethods = paymentMethods.data.map((pm) => ({
      id: pm.id,
      type: 'card' as const,
      brand: pm.card?.brand ? pm.card.brand.charAt(0).toUpperCase() + pm.card.brand.slice(1) : 'Card',
      last4: pm.card?.last4 || '****',
      exp_month: pm.card?.exp_month || 0,
      exp_year: pm.card?.exp_year || 0,
      is_default: pm.id === defaultPaymentMethodId,
    }))

    return NextResponse.json({ paymentMethods: formattedPaymentMethods })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to fetch payment methods' }, { status: 500 })
  }
}
