/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server'
import nodemailer from 'nodemailer'

import {
  generatePurchaseDocumentPackage,
  getPurchaseDocumentPackageByDealId,
  getSupabaseServiceClient,
} from '@/lib/purchaseDocumentPackageServer'

export const dynamic = 'force-dynamic'

export async function GET(_request: Request, { params }: { params: { dealId: string } }) {
  try {
    const dealId = String(params.dealId || '').trim()
    if (!dealId) return NextResponse.json({ error: 'Missing deal id' }, { status: 400 })
    const pkg = await getPurchaseDocumentPackageByDealId(dealId)
    if (!pkg) return NextResponse.json({ error: 'Document package not found' }, { status: 404 })
    return NextResponse.json({ package: pkg })
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Failed to load document package' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request, { params }: { params: { dealId: string } }) {
  try {
    const body = await request.json().catch(() => ({}))
    const dealId = String(params.dealId || '').trim()
    if (!dealId) return NextResponse.json({ error: 'Missing deal id' }, { status: 400 })

    const supabase = getSupabaseServiceClient()
    const { data, error } = await supabase
      .from('edc_purchase_submissions')
      .select('id, customer_email, customer_first_name, vehicle_year, vehicle_make, vehicle_model, vehicle_trim')
      .eq('deal_id', dealId)
      .limit(1)
      .maybeSingle()
    if (error) throw new Error(error.message)
    const submissionId = String((data as any)?.id || '').trim()
    if (!submissionId) return NextResponse.json({ error: 'No web purchase submission found for this deal' }, { status: 404 })

    const result = await generatePurchaseDocumentPackage(submissionId)
    if (body?.emailCustomer === true && data?.customer_email) {
      const smtpHost = process.env.SMTP_HOST
      const smtpPort = parseInt(process.env.SMTP_PORT ?? '587', 10)
      const smtpUser = process.env.SMTP_USER
      const smtpPass = process.env.SMTP_PASS
      const smtpFrom = process.env.SMTP_FROM ?? smtpUser
      if (!smtpHost || !smtpUser || !smtpPass) {
        return NextResponse.json({ success: true, ...result, emailSkipped: true, reason: 'SMTP not configured' })
      }
      const vehicleLabel = [data.vehicle_year, data.vehicle_make, data.vehicle_model, data.vehicle_trim].filter(Boolean).join(' ')
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: { user: smtpUser, pass: smtpPass },
      })
      await transporter.sendMail({
        from: `EasyDrive Canada <${smtpFrom}>`,
        to: data.customer_email,
        subject: `Your signed purchase documents are ready - ${vehicleLabel}`,
        html: `
          <p>Hi ${data.customer_first_name || 'there'},</p>
          <p>Your signed EasyDrive Canada purchase document package is ready.</p>
          <p><a href="${result.packageLink}" style="display:inline-block;background:#0d182b;color:#fff;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:700;">Open signed documents</a></p>
          <p>You can download and print your Bill of Sale and CARFAX files from that secure page.</p>
          <p>Thank you,<br/>EasyDrive Canada</p>
        `,
      })
    }
    return NextResponse.json({ success: true, ...result })
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Failed to regenerate document package' },
      { status: 500 }
    )
  }
}
