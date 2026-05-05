// Sell Your Car — email inquiry route
// Required environment variables in .env.local:
//   SMTP_HOST=smtp.gmail.com          (or your SMTP provider)
//   SMTP_PORT=587                      (465 for SSL, 587 for TLS)
//   SMTP_USER=you@example.com          (SMTP auth username)
//   SMTP_PASS=yourapppassword          (SMTP auth password / app-specific password)
//   SMTP_FROM=noreply@easydrivecanada.com  (optional — defaults to SMTP_USER)

import { NextRequest, NextResponse } from 'next/server'
import nodemailer from 'nodemailer'

interface SellInquiry {
  name: string
  email: string
  phone: string
  vin: string
  askingPrice: string
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function isValidVIN(vin: string): boolean {
  // VINs are 17 alphanumeric characters (no I, O, Q)
  return /^[A-HJ-NPR-Z0-9]{17}$/i.test(vin)
}

export async function POST(request: NextRequest) {
  let body: SellInquiry

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { name, email, phone, vin, askingPrice } = body

  // Input validation
  if (!name?.trim() || !email?.trim() || !phone?.trim() || !vin?.trim() || !askingPrice?.trim()) {
    return NextResponse.json({ error: 'All fields are required.' }, { status: 400 })
  }

  if (!isValidEmail(email)) {
    return NextResponse.json({ error: 'Please provide a valid email address.' }, { status: 400 })
  }

  if (!isValidVIN(vin)) {
    return NextResponse.json({ error: 'Please provide a valid 17-character VIN.' }, { status: 400 })
  }

  const smtpHost = process.env.SMTP_HOST
  const smtpPort = parseInt(process.env.SMTP_PORT ?? '587', 10)
  const smtpUser = process.env.SMTP_USER
  const smtpPass = process.env.SMTP_PASS
  const smtpFrom = process.env.SMTP_FROM ?? smtpUser

  if (!smtpHost || !smtpUser || !smtpPass) {
    console.error('SMTP configuration missing — set SMTP_HOST, SMTP_USER, SMTP_PASS in .env.local')
    return NextResponse.json({ error: 'Email service not configured. Please contact us directly.' }, { status: 500 })
  }

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  })

  const submittedAt = new Date().toLocaleString('en-CA', {
    timeZone: 'America/Toronto',
    dateStyle: 'full',
    timeStyle: 'short',
  })

  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f9fafb; padding: 24px; border-radius: 8px;">
      <div style="background: #0d182b; padding: 24px; border-radius: 8px 8px 0 0; text-align: center;">
        <h1 style="color: #1aa6ff; margin: 0; font-size: 22px; font-weight: 700;">New Sell Inquiry</h1>
        <p style="color: #94a3b8; margin: 6px 0 0; font-size: 14px;">EasyDrive Canada — Sell Your Car</p>
      </div>
      <div style="background: #ffffff; padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 10px 12px; background: #f1f5f9; font-weight: 600; color: #374151; width: 140px; border-radius: 4px;">Name</td>
            <td style="padding: 10px 12px; color: #111827;">${name}</td>
          </tr>
          <tr>
            <td style="padding: 10px 12px; font-weight: 600; color: #374151;">Email</td>
            <td style="padding: 10px 12px; color: #111827;"><a href="mailto:${email}" style="color: #1aa6ff;">${email}</a></td>
          </tr>
          <tr>
            <td style="padding: 10px 12px; background: #f1f5f9; font-weight: 600; color: #374151; border-radius: 4px;">Phone</td>
            <td style="padding: 10px 12px; color: #111827;">${phone}</td>
          </tr>
          <tr>
            <td style="padding: 10px 12px; font-weight: 600; color: #374151;">VIN</td>
            <td style="padding: 10px 12px; color: #111827; font-family: monospace; font-size: 15px; letter-spacing: 1px;">${vin.toUpperCase()}</td>
          </tr>
          <tr>
            <td style="padding: 10px 12px; background: #f1f5f9; font-weight: 600; color: #374151; border-radius: 4px;">Asking Price</td>
            <td style="padding: 10px 12px; color: #111827; font-weight: 600; font-size: 16px; color: #059669;">$${Number(askingPrice).toLocaleString('en-CA')} CAD</td>
          </tr>
        </table>
        <p style="margin: 20px 0 0; font-size: 12px; color: #9ca3af; border-top: 1px solid #e5e7eb; padding-top: 12px;">
          Submitted: ${submittedAt} — Reply-To: <a href="mailto:${email}" style="color: #1aa6ff;">${email}</a>
        </p>
      </div>
    </div>
  `

  try {
    await transporter.sendMail({
      from: `"EasyDrive Canada" <${smtpFrom}>`,
      to: 'info@easydrivecanada.com',
      replyTo: email,
      subject: `Sell Inquiry: ${vin.toUpperCase()} — ${name}`,
      html: htmlBody,
      text: `
Sell Inquiry — EasyDrive Canada

Name: ${name}
Email: ${email}
Phone: ${phone}
VIN: ${vin.toUpperCase()}
Asking Price: $${Number(askingPrice).toLocaleString('en-CA')} CAD

Submitted: ${submittedAt}
      `.trim(),
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Failed to send sell inquiry email:', err)
    return NextResponse.json({ error: 'Failed to send your inquiry. Please try again or contact us directly.' }, { status: 500 })
  }
}
