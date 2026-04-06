import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const baseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '')
const apiKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

/**
 * GET /api/esignature/events?signature_id=xxx
 * Returns all events for a given signature (primary + siblings share the same signature_id).
 */
export async function GET(req: Request) {
  try {
    if (!baseUrl || !apiKey) return NextResponse.json({ error: 'Server config error' }, { status: 500 })

    const { searchParams } = new URL(req.url)
    const signatureId = searchParams.get('signature_id')
    if (!signatureId) return NextResponse.json({ error: 'signature_id required' }, { status: 400 })

    const res = await fetch(
      `${baseUrl}/rest/v1/edc_signature_events?signature_id=eq.${encodeURIComponent(signatureId)}&order=created_at.asc`,
      {
        headers: { apikey: apiKey, Authorization: `Bearer ${apiKey}` },
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
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed' }, { status: 500 })
  }
}

/**
 * POST /api/esignature/events
 * Body: { signature_id, user_name, user_email, action, activity, status }
 * Inserts a new event row.
 */
export async function POST(req: Request) {
  try {
    if (!baseUrl || !apiKey) return NextResponse.json({ error: 'Server config error' }, { status: 500 })

    const body = await req.json().catch(() => null)
    if (!body?.signature_id || !body?.action) {
      return NextResponse.json({ error: 'signature_id and action are required' }, { status: 400 })
    }

    const payload = {
      signature_id: String(body.signature_id),
      user_name: String(body.user_name || ''),
      user_email: String(body.user_email || ''),
      action: String(body.action),
      activity: String(body.activity || ''),
      status: String(body.status || ''),
      created_at: new Date().toISOString(),
    }

    const res = await fetch(`${baseUrl}/rest/v1/edc_signature_events`, {
      method: 'POST',
      headers: {
        apikey: apiKey,
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify(payload),
      cache: 'no-store',
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      return NextResponse.json({ error: `DB error: ${res.status} ${text}` }, { status: res.status })
    }

    const rows = await res.json().catch(() => [])
    return NextResponse.json(Array.isArray(rows) ? rows[0] : rows)
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed' }, { status: 500 })
  }
}
