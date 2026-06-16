import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const baseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '')
const apiKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

const headers = (prefer?: string) => ({
  apikey: apiKey!,
  Authorization: `Bearer ${apiKey}`,
  'Content-Type': 'application/json',
  ...(prefer ? { Prefer: prefer } : {}),
})

const serviceHeaders = (prefer?: string) => ({
  apikey: serviceKey,
  Authorization: `Bearer ${serviceKey}`,
  'Content-Type': 'application/json',
  ...(prefer ? { Prefer: prefer } : {}),
})

const pickString = (value: unknown) => {
  const s = String(value ?? '').trim()
  return s || ''
}

const pickNumber = (value: unknown): number | null => {
  const n = Number(value)
  return Number.isInteger(n) ? n : null
}

const getRequestIp = (req: Request, fallback?: unknown) => {
  const candidates = [
    req.headers.get('cf-connecting-ip'),
    req.headers.get('x-real-ip'),
    req.headers.get('x-vercel-forwarded-for'),
    req.headers.get('x-forwarded-for')?.split(',')[0],
    fallback,
  ]
  return pickString(candidates.find(Boolean))
}

const normalizeMetadata = (value: unknown) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return value as Record<string, unknown>
}

const isMissingColumnError = (status: number, text: string) =>
  status === 400 && (
    text.includes('Could not find') ||
    text.includes('schema cache') ||
    text.includes('PGRST204')
  )

const insertSystemAuditEvent = async (payload: Record<string, unknown>) => {
  if (!baseUrl || !serviceKey) return
  try {
    await fetch(`${baseUrl}/rest/v1/edc_audit_events`, {
      method: 'POST',
      headers: serviceHeaders(),
      body: JSON.stringify({
        module: 'E-Signature',
        action: pickString(payload.action) || 'Updated',
        summary: pickString(payload.activity) || pickString(payload.action) || 'E-signature activity recorded.',
        actor_name: pickString(payload.user_name),
        actor_email: pickString(payload.user_email).toLowerCase(),
        record_type: 'signature',
        record_id: pickString(payload.signature_id),
        ip_address: pickString(payload.ip_address),
        user_agent: pickString(payload.user_agent),
        metadata: {
          deal_id: pickString(payload.deal_id),
          recipient_id: pickString(payload.recipient_id),
          recipient_index: payload.recipient_index,
          status: pickString(payload.status),
        },
      }),
      cache: 'no-store',
    })
  } catch {
    // Global audit logging should not block the e-signature audit flow.
  }
}

/**
 * GET /api/esignature/events?signature_id=xxx
 * Returns all events for a given signature (primary + siblings share the same signature_id).
 */
export async function GET(req: Request) {
  try {
    if (!baseUrl || !apiKey) return NextResponse.json({ error: 'Server config error' }, { status: 500 })

    const { searchParams } = new URL(req.url)
    const signatureId = searchParams.get('signature_id')
    const dealId = searchParams.get('deal_id')
    if (!signatureId && !dealId) return NextResponse.json({ error: 'signature_id or deal_id required' }, { status: 400 })

    const filter = signatureId
      ? `signature_id=eq.${encodeURIComponent(signatureId)}`
      : `deal_id=eq.${encodeURIComponent(dealId!)}`

    const res = await fetch(
      `${baseUrl}/rest/v1/edc_signature_events?${filter}&order=created_at.asc`,
      {
        headers: headers(),
        cache: 'no-store',
      }
    )

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      // Table might not exist yet — return empty gracefully
      if (res.status === 404 || text.includes('does not exist')) return NextResponse.json([])
      return NextResponse.json({ error: `DB error: ${res.status}` }, { status: res.status })
    }

    const rows = await res.json().catch(() => [])
    return NextResponse.json(Array.isArray(rows) ? rows : [])
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 })
  }
}

/**
 * POST /api/esignature/events
 * Body: { signature_id, deal_id, recipient_id, recipient_index, user_name,
 * user_email, action, activity, status, ip_address, user_agent, metadata }
 * Inserts a new event row.
 */
export async function POST(req: Request) {
  try {
    if (!baseUrl || !apiKey) return NextResponse.json({ error: 'Server config error' }, { status: 500 })

    const body = await req.json().catch(() => null)
    if (!body?.signature_id || !body?.action) {
      return NextResponse.json({ error: 'signature_id and action are required' }, { status: 400 })
    }

    const createdAt = pickString(body.created_at) || new Date().toISOString()
    const payload: Record<string, unknown> = {
      signature_id: pickString(body.signature_id),
      deal_id: pickString(body.deal_id),
      recipient_id: pickString(body.recipient_id),
      recipient_index: pickNumber(body.recipient_index),
      user_name: pickString(body.user_name),
      user_email: pickString(body.user_email),
      action: pickString(body.action),
      activity: pickString(body.activity),
      status: pickString(body.status),
      ip_address: getRequestIp(req, body.ip_address),
      user_agent: pickString(body.user_agent) || pickString(req.headers.get('user-agent')),
      metadata: normalizeMetadata(body.metadata),
      created_at: createdAt,
    }

    let res = await fetch(`${baseUrl}/rest/v1/edc_signature_events`, {
      method: 'POST',
      headers: headers('return=representation'),
      body: JSON.stringify(payload),
      cache: 'no-store',
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      if (isMissingColumnError(res.status, text)) {
        const legacyPayload = {
          signature_id: payload.signature_id,
          user_name: payload.user_name,
          user_email: payload.user_email,
          action: payload.action,
          activity: [
            payload.activity,
            payload.ip_address ? `IP: ${payload.ip_address}` : '',
            payload.user_agent ? `Device: ${payload.user_agent}` : '',
          ].filter(Boolean).join(' | '),
          status: payload.status,
          created_at: payload.created_at,
        }
        res = await fetch(`${baseUrl}/rest/v1/edc_signature_events`, {
          method: 'POST',
          headers: headers('return=representation'),
          body: JSON.stringify(legacyPayload),
          cache: 'no-store',
        })
        if (res.ok) {
          const rows = await res.json().catch(() => [])
          return NextResponse.json(Array.isArray(rows) ? rows[0] : rows)
        }
      }
      return NextResponse.json({ error: `DB error: ${res.status} ${text}` }, { status: res.status })
    }

    const rows = await res.json().catch(() => [])
    await insertSystemAuditEvent(payload)
    return NextResponse.json(Array.isArray(rows) ? rows[0] : rows)
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 })
  }
}
