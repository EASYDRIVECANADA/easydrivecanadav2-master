import { NextResponse } from 'next/server'
import nodemailer from 'nodemailer'

const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '')
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export async function GET() {
  try {
    const res = await fetch(
      `${supabaseUrl}/rest/v1/edc_purchase_submissions?order=submitted_at.desc`,
      {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
        },
        cache: 'no-store',
      }
    )
    const data = await res.json()
    if (!res.ok) return NextResponse.json({ error: data }, { status: res.status })
    return NextResponse.json({ submissions: data })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to fetch' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()

    // Check if this vehicle already has a pending or approved submission
    if (body.vehicle_id) {
      const checkRes = await fetch(
        `${supabaseUrl}/rest/v1/edc_purchase_submissions?vehicle_id=eq.${encodeURIComponent(body.vehicle_id)}&status=in.(pending,approved)&limit=1`,
        { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }, cache: 'no-store' }
      )
      const existing: any[] = await checkRes.json()
      if (existing?.length > 0) {
        return NextResponse.json({ error: 'This vehicle is already reserved by another customer.' }, { status: 409 })
      }
    }

    const res = await fetch(`${supabaseUrl}/rest/v1/edc_purchase_submissions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        Prefer: 'return=representation',
      },
      body: JSON.stringify(body),
    })
    const text = await res.text()
    if (!res.ok) {
      return NextResponse.json({ error: text }, { status: res.status })
    }

    // Mark vehicle as Reserved in edc_vehicles
    if (body.vehicle_id) {
      await fetch(`${supabaseUrl}/rest/v1/edc_vehicles?id=eq.${encodeURIComponent(body.vehicle_id)}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({ status: 'Reserved' }),
      })
    }

    // Send dealer notification email (best-effort)
    const smtpHost = process.env.SMTP_HOST
    const smtpUser = process.env.SMTP_USER
    const smtpPass = process.env.SMTP_PASS
    if (smtpHost && smtpUser && smtpPass) {
      try {
        const transporter = nodemailer.createTransport({
          host: smtpHost,
          port: Number(process.env.SMTP_PORT || 587),
          secure: false,
          auth: { user: smtpUser, pass: smtpPass },
        })
        const vehicleLabel = [body.vehicle_year, body.vehicle_make, body.vehicle_model, body.vehicle_trim].filter(Boolean).join(' ')
        const customerName = [body.customer_first_name, body.customer_last_name].filter(Boolean).join(' ')
        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://easydrivecanada.com'
        await transporter.sendMail({
          from: process.env.SMTP_FROM || smtpUser,
          to: smtpUser,
          subject: `🔔 New Purchase Submission — ${vehicleLabel}`,
          html: `
            <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
              <h2 style="color:#0f172a;margin-bottom:4px">New Online Purchase Submission</h2>
              <p style="color:#64748b;margin-top:0">A customer has completed the purchase flow and sent their $1,000 deposit.</p>
              <table style="width:100%;border-collapse:collapse;margin:20px 0">
                <tr><td style="padding:8px 12px;background:#f8fafc;font-weight:600;color:#475569;width:140px">Vehicle</td><td style="padding:8px 12px;border-bottom:1px solid #e2e8f0">${vehicleLabel}</td></tr>
                <tr><td style="padding:8px 12px;background:#f8fafc;font-weight:600;color:#475569">Customer</td><td style="padding:8px 12px;border-bottom:1px solid #e2e8f0">${customerName}</td></tr>
                <tr><td style="padding:8px 12px;background:#f8fafc;font-weight:600;color:#475569">Email</td><td style="padding:8px 12px;border-bottom:1px solid #e2e8f0">${body.customer_email || '—'}</td></tr>
                <tr><td style="padding:8px 12px;background:#f8fafc;font-weight:600;color:#475569">Phone</td><td style="padding:8px 12px;border-bottom:1px solid #e2e8f0">${body.customer_phone || '—'}</td></tr>
                <tr><td style="padding:8px 12px;background:#f8fafc;font-weight:600;color:#475569">Deposit</td><td style="padding:8px 12px;border-bottom:1px solid #e2e8f0">$${Number(body.deposit_amount || 1000).toLocaleString('en-CA')}</td></tr>
                <tr><td style="padding:8px 12px;background:#f8fafc;font-weight:600;color:#475569">Total (incl. HST)</td><td style="padding:8px 12px;border-bottom:1px solid #e2e8f0">$${Number(body.total_price || 0).toLocaleString('en-CA')}</td></tr>
                <tr><td style="padding:8px 12px;background:#f8fafc;font-weight:600;color:#475569">Stock #</td><td style="padding:8px 12px">${body.vehicle_stock_number || '—'}</td></tr>
              </table>
              <a href="${siteUrl}/admin/sales/deals" style="display:inline-block;background:#0f172a;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;font-size:14px">
                Review in Admin Dashboard →
              </a>
              <p style="color:#94a3b8;font-size:12px;margin-top:24px">Once you confirm the $1,000 e-transfer has arrived in your account, click Approve on the submission.</p>
            </div>
          `,
        })
      } catch { /* email failure is non-fatal */ }
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to save' }, { status: 500 })
  }
}