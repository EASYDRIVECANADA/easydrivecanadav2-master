import { NextResponse } from 'next/server'

import { buildAuditEventsQuery, normalizeAuditEventPayload } from '@/lib/auditEvents'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const baseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '')
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

const headers = (prefer?: string) => ({
  apikey: serviceKey,
  Authorization: `Bearer ${serviceKey}`,
  'Content-Type': 'application/json',
  ...(prefer ? { Prefer: prefer } : {}),
})

const clean = (value: unknown) => String(value ?? '').trim()

const cleanEmail = (value: unknown) => clean(value).toLowerCase()

const getRequestIp = (req: Request, fallback?: unknown) => {
  const candidates = [
    req.headers.get('cf-connecting-ip'),
    req.headers.get('x-real-ip'),
    req.headers.get('x-vercel-forwarded-for'),
    req.headers.get('x-forwarded-for')?.split(',')[0],
    fallback,
  ]
  return clean(candidates.find(Boolean))
}

const isMissingAuditTable = (status: number, text: string) =>
  status === 404 ||
  text.includes('edc_audit_events') && (
    text.includes('does not exist') ||
    text.includes('schema cache') ||
    text.includes('Could not find')
  )

async function canReadAuditTrail(email: string) {
  const actorEmail = cleanEmail(email)
  if (!actorEmail || !baseUrl || !serviceKey) return false
  if (actorEmail === 'info@easydrivecanada.com') return true

  const res = await fetch(
    `${baseUrl}/rest/v1/users?email=ilike.${encodeURIComponent(actorEmail)}&select=id,email,role,administrator,settings&limit=1`,
    {
      headers: headers(),
      cache: 'no-store',
    }
  )

  if (!res.ok) return false
  const rows = await res.json().catch(() => [])
  const user = Array.isArray(rows) ? rows[0] : null
  if (!user) return false

  const role = clean(user.role).toLowerCase()
  return Boolean(user.administrator || user.settings || role.includes('admin') || role.includes('owner'))
}

export async function GET(req: Request) {
  try {
    if (!baseUrl || !serviceKey) return NextResponse.json({ error: 'Server config error' }, { status: 500 })

    const requesterEmail = cleanEmail(req.headers.get('x-edc-admin-email'))
    if (!await canReadAuditTrail(requesterEmail)) {
      return NextResponse.json({ error: 'Not authorized to view audit trail' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const query = buildAuditEventsQuery({
      module: searchParams.get('module') || '',
      action: searchParams.get('action') || '',
      actor: searchParams.get('actor') || '',
      q: searchParams.get('q') || '',
      startDate: searchParams.get('startDate') || '',
      endDate: searchParams.get('endDate') || '',
      limit: Number(searchParams.get('limit') || 200),
    })

    const res = await fetch(`${baseUrl}/rest/v1/edc_audit_events?${query}`, {
      headers: headers(),
      cache: 'no-store',
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      if (isMissingAuditTable(res.status, text)) return NextResponse.json([])
      return NextResponse.json({ error: `DB error: ${res.status}` }, { status: res.status })
    }

    const rows = await res.json().catch(() => [])
    return NextResponse.json(Array.isArray(rows) ? rows : [])
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to load audit events' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    if (!baseUrl || !serviceKey) return NextResponse.json({ error: 'Server config error' }, { status: 500 })

    const body = await req.json().catch(() => null)
    const payload = normalizeAuditEventPayload({
      ...body,
      ip_address: body?.ip_address || getRequestIp(req),
      user_agent: body?.user_agent || req.headers.get('user-agent'),
    })

    if (!payload.module || !payload.action || !payload.summary) {
      return NextResponse.json({ error: 'module, action, and summary are required' }, { status: 400 })
    }

    const res = await fetch(`${baseUrl}/rest/v1/edc_audit_events`, {
      method: 'POST',
      headers: headers('return=representation'),
      body: JSON.stringify(payload),
      cache: 'no-store',
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      if (isMissingAuditTable(res.status, text)) {
        return NextResponse.json({ ok: false, skipped: true, reason: 'audit table missing' }, { status: 202 })
      }
      return NextResponse.json({ error: `DB error: ${res.status} ${text}` }, { status: res.status })
    }

    const rows = await res.json().catch(() => [])
    return NextResponse.json(Array.isArray(rows) ? rows[0] : rows)
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to record audit event' }, { status: 500 })
  }
}
