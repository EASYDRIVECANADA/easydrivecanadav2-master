// Sell Your Car - creates a private seller draft listing and sends an email notification.

import { NextRequest, NextResponse } from 'next/server'
import nodemailer from 'nodemailer'
import { createClient } from '@supabase/supabase-js'
import {
  buildPrivateSellerOwnerRow,
  buildPrivateSellerVehicleRow,
  buildVerificationUrl,
  hasActivePrivateSellerListing,
  normalizeSellInquiry,
} from '@/lib/privateSellerSellFlow.mjs'

interface SellInquiry {
  name: string
  email: string
  phone: string
  vin: string
  askingPrice: string
}

type UserRow = {
  id?: string | null
  user_id?: string | null
  role?: string | null
}

type VehicleInsertResult = {
  id?: string | null
  vehicleId?: string | null
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function isValidVIN(vin: string): boolean {
  return /^[A-HJ-NPR-Z0-9]{17}$/i.test(vin)
}

function makeId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function isPrivateLikeRole(role: unknown) {
  const raw = String(role || '').trim().toLowerCase()
  return !raw || raw === 'private' || raw === 'private seller' || raw === 'starter'
}

async function sendSellInquiryEmail(inquiry: ReturnType<typeof normalizeSellInquiry>, vehicleId: string, ownerUserId: string) {
  const smtpHost = process.env.SMTP_HOST
  const smtpPort = parseInt(process.env.SMTP_PORT ?? '587', 10)
  const smtpUser = process.env.SMTP_USER
  const smtpPass = process.env.SMTP_PASS
  const smtpFrom = process.env.SMTP_FROM ?? smtpUser

  if (!smtpHost || !smtpUser || !smtpPass) {
    return 'Draft listing was created, but email notification is not configured.'
  }

  const submittedAt = new Date().toLocaleString('en-CA', {
    timeZone: 'America/Toronto',
    dateStyle: 'full',
    timeStyle: 'short',
  })

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  })

  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f9fafb; padding: 24px; border-radius: 8px;">
      <div style="background: #0d182b; padding: 24px; border-radius: 8px 8px 0 0; text-align: center;">
        <h1 style="color: #1aa6ff; margin: 0; font-size: 22px; font-weight: 700;">New Private Seller Draft</h1>
        <p style="color: #94a3b8; margin: 6px 0 0; font-size: 14px;">EasyDrive Canada - Sell Your Car</p>
      </div>
      <div style="background: #ffffff; padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr><td style="padding: 10px 12px; background: #f1f5f9; font-weight: 600; color: #374151; width: 140px;">Name</td><td style="padding: 10px 12px; color: #111827;">${inquiry.name}</td></tr>
          <tr><td style="padding: 10px 12px; font-weight: 600; color: #374151;">Email</td><td style="padding: 10px 12px; color: #111827;"><a href="mailto:${inquiry.email}" style="color: #1aa6ff;">${inquiry.email}</a></td></tr>
          <tr><td style="padding: 10px 12px; background: #f1f5f9; font-weight: 600; color: #374151;">Phone</td><td style="padding: 10px 12px; color: #111827;">${inquiry.phone}</td></tr>
          <tr><td style="padding: 10px 12px; font-weight: 600; color: #374151;">VIN</td><td style="padding: 10px 12px; color: #111827; font-family: monospace; font-size: 15px; letter-spacing: 1px;">${inquiry.vin}</td></tr>
          <tr><td style="padding: 10px 12px; background: #f1f5f9; font-weight: 600; color: #374151;">Asking Price</td><td style="padding: 10px 12px; color: #059669; font-weight: 600; font-size: 16px;">$${Number(inquiry.askingPrice).toLocaleString('en-CA')} CAD</td></tr>
          <tr><td style="padding: 10px 12px; font-weight: 600; color: #374151;">Draft Vehicle</td><td style="padding: 10px 12px; color: #111827;">${vehicleId}</td></tr>
          <tr><td style="padding: 10px 12px; background: #f1f5f9; font-weight: 600; color: #374151;">Owner User ID</td><td style="padding: 10px 12px; color: #111827;">${ownerUserId}</td></tr>
        </table>
        <p style="margin: 20px 0 0; font-size: 12px; color: #9ca3af; border-top: 1px solid #e5e7eb; padding-top: 12px;">
          Submitted: ${submittedAt} - Reply-To: <a href="mailto:${inquiry.email}" style="color: #1aa6ff;">${inquiry.email}</a>
        </p>
      </div>
    </div>
  `

  await transporter.sendMail({
    from: `"EasyDrive Canada" <${smtpFrom}>`,
    to: 'info@easydrivecanada.com',
    replyTo: inquiry.email,
    subject: `Private Seller Draft: ${inquiry.vin} - ${inquiry.name}`,
    html: htmlBody,
    text: `
Private Seller Draft - EasyDrive Canada

Name: ${inquiry.name}
Email: ${inquiry.email}
Phone: ${inquiry.phone}
VIN: ${inquiry.vin}
Asking Price: $${Number(inquiry.askingPrice).toLocaleString('en-CA')} CAD
Draft Vehicle ID: ${vehicleId}
Owner User ID: ${ownerUserId}

Submitted: ${submittedAt}
    `.trim(),
  })

  return null
}

export async function POST(request: NextRequest) {
  let body: SellInquiry

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const inquiry = normalizeSellInquiry(body)

  if (!inquiry.name || !inquiry.email || !inquiry.phone || !inquiry.vin || !inquiry.askingPrice) {
    return NextResponse.json({ error: 'All fields are required.' }, { status: 400 })
  }

  if (!isValidEmail(inquiry.email)) {
    return NextResponse.json({ error: 'Please provide a valid email address.' }, { status: 400 })
  }

  if (!isValidVIN(inquiry.vin)) {
    return NextResponse.json({ error: 'Please provide a valid 17-character VIN.' }, { status: 400 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: 'Server not configured. Please contact us directly.' }, { status: 500 })
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  let ownerUserId = makeId()
  let ownerId: string | null = null

  const { data: existingOwner, error: existingOwnerError } = await supabase
    .from('users')
    .select('id, user_id, role')
    .ilike('email', inquiry.email)
    .limit(1)
    .maybeSingle()

  if (existingOwnerError) {
    return NextResponse.json({ error: existingOwnerError.message || 'Failed to check seller account.' }, { status: 500 })
  }

  const existingOwnerRow = existingOwner as UserRow | null

  if (existingOwnerRow?.id) {
    ownerId = String(existingOwnerRow.id)
    ownerUserId = String(existingOwnerRow.user_id || ownerUserId).trim()
    const ownerRow = buildPrivateSellerOwnerRow(inquiry, ownerUserId)
    const rolePatch = isPrivateLikeRole(existingOwnerRow.role) ? { role: ownerRow.role } : {}

    const { error: updateOwnerError } = await supabase
      .from('users')
      .update({
        email: ownerRow.email,
        first_name: ownerRow.first_name,
        last_name: ownerRow.last_name,
        title: ownerRow.title,
        status: ownerRow.status,
        user_id: ownerRow.user_id,
        ...rolePatch,
      })
      .eq('id', ownerId)

    if (updateOwnerError) {
      return NextResponse.json({ error: updateOwnerError.message || 'Failed to update seller account.' }, { status: 500 })
    }
  } else {
    const ownerRow = buildPrivateSellerOwnerRow(inquiry, ownerUserId)
    const { data: insertedOwner, error: insertOwnerError } = await supabase
      .from('users')
      .insert({ ...ownerRow, created_at: new Date().toISOString() })
      .select('id, user_id')
      .single()

    if (insertOwnerError) {
      return NextResponse.json({ error: insertOwnerError.message || 'Failed to create seller account.' }, { status: 500 })
    }

    const insertedOwnerRow = insertedOwner as UserRow | null
    ownerId = String(insertedOwnerRow?.id || '')
    ownerUserId = String(insertedOwnerRow?.user_id || ownerUserId).trim()
  }

  const { data: existingVehicles, error: vehiclesError } = await supabase
    .from('edc_vehicles')
    .select('id, status')
    .eq('user_id', ownerUserId)
    .limit(100)

  if (vehiclesError) {
    return NextResponse.json({ error: vehiclesError.message || 'Failed to check seller listings.' }, { status: 500 })
  }

  if (hasActivePrivateSellerListing(Array.isArray(existingVehicles) ? existingVehicles : [])) {
    return NextResponse.json(
      { error: 'Private sellers can have one active listing at a time. Please contact us to update your existing listing.' },
      { status: 409 }
    )
  }

  const draftVehicleId = makeId()
  const vehicleRow = buildPrivateSellerVehicleRow(inquiry, ownerUserId, draftVehicleId)
  const { data: insertedVehicle, error: insertVehicleError } = await supabase
    .from('edc_vehicles')
    .insert(vehicleRow)
    .select('id, vehicleId')
    .single()

  if (insertVehicleError) {
    return NextResponse.json({ error: insertVehicleError.message || 'Failed to create draft listing.' }, { status: 500 })
  }

  const insertedVehicleRow = insertedVehicle as VehicleInsertResult | null
  const vehicleId = String(insertedVehicleRow?.id || draftVehicleId)
  let emailWarning: string | null = null

  try {
    emailWarning = await sendSellInquiryEmail(inquiry, vehicleId, ownerUserId)
  } catch (err) {
    console.error('Failed to send sell inquiry email:', err)
    emailWarning = 'Draft listing was created, but the email notification could not be sent.'
  }

  return NextResponse.json({
    success: true,
    userId: ownerUserId,
    ownerId,
    vehicleId,
    verificationUrl: buildVerificationUrl(vehicleId),
    emailWarning,
  })
}
