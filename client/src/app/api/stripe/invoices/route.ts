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

    // Find customer by email
    const customers = await stripe.customers.list({ email: normalizedEmail, limit: 1 })
    const customer = customers.data?.[0]
    
    if (!customer?.id) {
      return NextResponse.json({ invoices: [] })
    }

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
