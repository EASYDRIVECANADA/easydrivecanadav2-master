import { NextResponse } from 'next/server'
import nodemailer from 'nodemailer'

const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '')
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

async function supabaseInsert(table: string, data: Record<string, any>) {
  const res = await fetch(`${supabaseUrl}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      Prefer: 'return=representation',
    },
    body: JSON.stringify(data),
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`Insert into ${table} failed: ${text}`)
  return JSON.parse(text)
}

async function supabasePatch(table: string, filter: string, data: Record<string, any>) {
  const res = await fetch(`${supabaseUrl}/rest/v1/${table}?${filter}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      Prefer: 'return=representation',
    },
    body: JSON.stringify(data),
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`Patch ${table} failed: ${text}`)
  return JSON.parse(text)
}

export async function POST(req: Request) {
  try {
    const { submissionId } = await req.json()
    if (!submissionId) return NextResponse.json({ error: 'Missing submissionId' }, { status: 400 })

    // 1. Fetch the submission
    const fetchRes = await fetch(
      `${supabaseUrl}/rest/v1/edc_purchase_submissions?id=eq.${encodeURIComponent(submissionId)}&limit=1`,
      {
        headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` },
        cache: 'no-store',
      }
    )
    const rows: any[] = await fetchRes.json()
    const sub = rows?.[0]
    if (!sub) return NextResponse.json({ error: 'Submission not found' }, { status: 404 })
    if (sub.status === 'approved') return NextResponse.json({ error: 'Already approved' }, { status: 409 })

    // 2. Generate a deal ID
    const dealId = `WEB-${Date.now()}`
    const now = new Date().toISOString()
    const vehicleLabel = [sub.vehicle_year, sub.vehicle_make, sub.vehicle_model, sub.vehicle_trim].filter(Boolean).join(' ')

    // 3. Create deal records in all 5 tables
    await supabaseInsert('edc_deals_customers', {
      deal_id: dealId,
      firstname: sub.customer_first_name,
      lastname: sub.customer_last_name,
      email: sub.customer_email,
      phone: sub.customer_phone,
      streetaddress: sub.customer_address,
      city: sub.customer_city,
      province: sub.customer_province,
      postalcode: sub.customer_postal_code,
      deal_state: 'Open',
      dealdate: now,
      notes: `Auto-created from online purchase submission ${submissionId}`,
      created_at: now,
    })

    await supabaseInsert('edc_deals_vehicles', {
      deal_id: dealId,
      selected_id: sub.vehicle_id,
      selected_year: sub.vehicle_year,
      selected_make: sub.vehicle_make,
      selected_model: sub.vehicle_model,
      selected_trim: sub.vehicle_trim,
      selected_vin: sub.vehicle_vin,
      selected_stock_number: sub.vehicle_stock_number,
      selected_status: 'In Stock',
      created_at: now,
    })

    await supabaseInsert('edc_deals_worksheet', {
      deal_id: dealId,
      purchase_price: sub.vehicle_price,
      payments: JSON.stringify([
        {
          amount: sub.deposit_amount,
          type: 'E-Transfer',
          desc: '$1,000 deposit received via Interac E-Transfer',
          category: 'Deposit',
          date: now,
        },
      ]),
      created_at: now,
    })

    await supabaseInsert('edc_deals_disclosures', { deal_id: dealId, created_at: now })
    await supabaseInsert('edc_deals_delivery', { deal_id: dealId, created_at: now })

    // 4. Mark submission as approved
    await supabasePatch(
      'edc_purchase_submissions',
      `id=eq.${encodeURIComponent(submissionId)}`,
      { status: 'approved', deal_id: dealId, approved_at: now }
    )

    // 5. Mark vehicle as Sold in edc_vehicles
    if (sub.vehicle_id) {
      await supabasePatch('edc_vehicles', `id=eq.${encodeURIComponent(sub.vehicle_id)}`, { status: 'Sold' })
    }

    // 6. Send email to customer
    const smtpHost = process.env.SMTP_HOST
    const smtpPort = parseInt(process.env.SMTP_PORT ?? '587', 10)
    const smtpUser = process.env.SMTP_USER
    const smtpPass = process.env.SMTP_PASS
    const smtpFrom = process.env.SMTP_FROM ?? smtpUser

    if (smtpHost && smtpUser && smtpPass && sub.customer_email) {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: { user: smtpUser, pass: smtpPass },
      })

      await transporter.sendMail({
        from: `EasyDrive Canada <${smtpFrom}>`,
        to: sub.customer_email,
        subject: `Your purchase of the ${vehicleLabel} has been approved!`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f9fafb; padding: 24px; border-radius: 8px;">
            <div style="background: #0d182b; padding: 24px; border-radius: 8px 8px 0 0; text-align: center;">
              <h1 style="color: #1aa6ff; margin: 0; font-size: 22px; font-weight: 700;">Purchase Approved!</h1>
              <p style="color: #94a3b8; margin: 6px 0 0; font-size: 14px;">EasyDrive Canada</p>
            </div>
            <div style="background: #ffffff; padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
              <p style="color: #111827; font-size: 15px;">Hi ${sub.customer_first_name},</p>
              <p style="color: #111827; font-size: 15px;">
                Great news — we have confirmed your <strong>$${Number(sub.deposit_amount).toLocaleString('en-CA')}</strong> Interac e-Transfer deposit and your purchase of the
                <strong>${vehicleLabel}</strong> has been <span style="color: #16a34a; font-weight: 700;">approved</span>.
              </p>
              <div style="background: #f1f5f9; border-radius: 8px; padding: 16px; margin: 16px 0;">
                <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                  <tr>
                    <td style="padding: 6px 0; color: #374151; font-weight: 600;">Vehicle</td>
                    <td style="padding: 6px 0; color: #111827; text-align: right;">${vehicleLabel}</td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 0; color: #374151; font-weight: 600;">VIN</td>
                    <td style="padding: 6px 0; color: #111827; text-align: right;">${sub.vehicle_vin ?? '—'}</td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 0; color: #374151; font-weight: 600;">Deposit Received</td>
                    <td style="padding: 6px 0; color: #111827; text-align: right;">$${Number(sub.deposit_amount).toLocaleString('en-CA')}</td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 0; color: #374151; font-weight: 600;">Deal Reference</td>
                    <td style="padding: 6px 0; color: #111827; text-align: right;">${dealId}</td>
                  </tr>
                </table>
              </div>
              <p style="color: #111827; font-size: 14px;">
                A member of our team will be in touch shortly to arrange next steps. If you have any questions, reply to this email or call us directly.
              </p>
              <p style="color: #6b7280; font-size: 13px; margin-top: 24px;">Thank you for choosing EasyDrive Canada.</p>
            </div>
          </div>
        `,
      })
    }

    return NextResponse.json({ success: true, dealId })
  } catch (err: any) {
    console.error('[approve-submission] Error:', err)
    return NextResponse.json({ error: err?.message || 'Failed to approve' }, { status: 500 })
  }
}
