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
      return NextResponse.json({ invoices: [] })
    }

    let customer: Stripe.Customer | null = null
    for (const c of candidates) {
      const probe = await stripe.invoices.list({ customer: c.id, limit: 1 })
      if (probe.data.length > 0) {
        customer = c
        break
      }
    }

    if (!customer) customer = candidates[0] as Stripe.Customer

    // Fetch invoices for this customer
    const invoices = await stripe.invoices.list({
      customer: customer.id,
      limit: 100,
    })

    const formattedInvoices = invoices.data.map((invoice) => ({
      id: invoice.id,
      date: invoice.created ? new Date(invoice.created * 1000).toISOString() : '',
      description: invoice.lines.data[0]?.description || 'Subscription Payment',
      amount: `$${((invoice.amount_paid || 0) / 100).toFixed(2)}`,
      status: invoice.status === 'paid' ? 'completed' : invoice.status === 'open' ? 'pending' : 'failed',
      invoice_url: invoice.invoice_pdf || invoice.hosted_invoice_url || null,
    }))

    return NextResponse.json({ invoices: formattedInvoices })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to fetch invoices' }, { status: 500 })
  }
}
