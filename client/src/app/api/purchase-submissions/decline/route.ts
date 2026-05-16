import { NextResponse } from 'next/server'
import nodemailer from 'nodemailer'

const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '')
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export async function POST(req: Request) {
  try {
    const { submissionId, reason } = await req.json()
    if (!submissionId) return NextResponse.json({ error: 'Missing submissionId' }, { status: 400 })

    // 1. Fetch the submission
    const fetchRes = await fetch(
      `${supabaseUrl}/rest/v1/edc_purchase_submissions?id=eq.${encodeURIComponent(submissionId)}&limit=1`,
      { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }, cache: 'no-store' }
    )
    const rows: any[] = await fetchRes.json()
    const sub = rows?.[0]
    if (!sub) return NextResponse.json({ error: 'Submission not found' }, { status: 404 })
    if (sub.status !== 'pending') return NextResponse.json({ error: 'Submission is not pending' }, { status: 409 })

    // 2. Mark as declined
    const now = new Date().toISOString()
    const patchRes = await fetch(
      `${supabaseUrl}/rest/v1/edc_purchase_submissions?id=eq.${encodeURIComponent(submissionId)}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
          Prefer: 'return=representation',
        },
        body: JSON.stringify({ status: 'declined', approved_at: now }),
      }
    )
    if (!patchRes.ok) {
      const text = await patchRes.text()
      throw new Error(`Failed to update submission: ${text}`)
    }

    // 3. Restore vehicle status to In Stock
    if (sub.vehicle_id) {
      await fetch(`${supabaseUrl}/rest/v1/edc_vehicles?id=eq.${encodeURIComponent(sub.vehicle_id)}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({ status: 'In Stock' }),
      })
    }

    // 4. Send customer email (best-effort)
    const vehicleLabel = [sub.vehicle_year, sub.vehicle_make, sub.vehicle_model, sub.vehicle_trim]
      .filter(Boolean).join(' ')

    const smtpHost = process.env.SMTP_HOST
    const smtpUser = process.env.SMTP_USER
    const smtpPass = process.env.SMTP_PASS
    if (smtpHost && smtpUser && smtpPass && sub.customer_email) {
      try {
        const transporter = nodemailer.createTransport({
          host: smtpHost,
          port: Number(process.env.SMTP_PORT || 587),
          secure: false,
          auth: { user: smtpUser, pass: smtpPass },
        })
        const reasonText = reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ''
        await transporter.sendMail({
          from: process.env.SMTP_FROM || smtpUser,
          to: sub.customer_email,
          subject: `Update on your purchase request — ${vehicleLabel}`,
          html: `
            <p>Hi ${sub.customer_first_name},</p>
            <p>Thank you for your interest in the <strong>${vehicleLabel}</strong>.</p>
            <p>Unfortunately, we are unable to proceed with your purchase request at this time.</p>
            ${reasonText}
            <p>If you have any questions or would like to explore other options, please don't hesitate to reach out to us.</p>
            <p>Thank you,<br/>EasyDrive Canada</p>
          `,
        })
      } catch {
        // email failure is non-fatal
      }
    }

    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal error' }, { status: 500 })
  }
}
