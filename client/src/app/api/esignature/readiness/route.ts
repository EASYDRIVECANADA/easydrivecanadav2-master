import { NextResponse } from 'next/server'
import { buildESignatureReadinessReport } from '@/lib/eSignatureCompletion'

export const dynamic = 'force-dynamic'

const baseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '')
const apiKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

async function canReadAuditTable(): Promise<boolean> {
  if (!baseUrl || !apiKey) return false

  const res = await fetch(`${baseUrl}/rest/v1/edc_signature_events?select=id&limit=1`, {
    headers: {
      apikey: apiKey,
      Authorization: `Bearer ${apiKey}`,
    },
    cache: 'no-store',
  }).catch(() => null)

  return Boolean(res?.ok)
}

export async function GET() {
  const report = buildESignatureReadinessReport({
    env: {
      SMTP_HOST: process.env.SMTP_HOST,
      SMTP_USER: process.env.SMTP_USER,
      SMTP_PASS: process.env.SMTP_PASS,
      SMTP_FROM: process.env.SMTP_FROM,
      NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    },
    auditTableReachable: await canReadAuditTable(),
  })

  return NextResponse.json(report)
}
