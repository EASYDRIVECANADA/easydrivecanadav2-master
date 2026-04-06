import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const baseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '')
const apiKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 })
    if (!baseUrl || !apiKey) return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })

    const primaryRes = await fetch(`${baseUrl}/rest/v1/signature?id=eq.${encodeURIComponent(id)}&limit=1`, {
      headers: { apikey: apiKey, Authorization: `Bearer ${apiKey}` },
      cache: 'no-store',
    })
    if (!primaryRes.ok) return NextResponse.json({ error: 'Primary record not found' }, { status: 404 })
    const primaryRows = await primaryRes.json().catch(() => [])
    if (!Array.isArray(primaryRows) || !primaryRows.length) {
      return NextResponse.json({ error: 'Primary record not found' }, { status: 404 })
    }
    const primary = primaryRows[0]

    const body = await request.json()
    const recipientId = String(body?.recipientId || '').trim()
    if (!recipientId) return NextResponse.json({ error: 'Recipient ID is required' }, { status: 400 })

    const email = String(body?.email || '').trim().toLowerCase()
    if (!email) return NextResponse.json({ error: 'Email is required' }, { status: 400 })

    const recipientRes = await fetch(`${baseUrl}/rest/v1/signature?id=eq.${encodeURIComponent(recipientId)}&limit=1`, {
      headers: { apikey: apiKey, Authorization: `Bearer ${apiKey}` },
      cache: 'no-store',
    })
    if (!recipientRes.ok) return NextResponse.json({ error: 'Recipient record not found' }, { status: 404 })
    const recipientRows = await recipientRes.json().catch(() => [])
    if (!Array.isArray(recipientRows) || !recipientRows.length) {
      return NextResponse.json({ error: 'Recipient record not found' }, { status: 404 })
    }
    const recipient = recipientRows[0]

    if (
      String(recipient.user_id || '') !== String(primary.user_id || '') ||
      String(recipient.document_file || '') !== String(primary.document_file || '')
    ) {
      return NextResponse.json({ error: 'Recipient does not belong to this signature group' }, { status: 403 })
    }

    const patchBody = {
      email,
      full_name: body?.full_name ? String(body.full_name).trim() : null,
      company: body?.company ? String(body.company).trim() : null,
      title: body?.title ? String(body.title).trim() : null,
      updated_at: new Date().toISOString(),
    }

    const updateRes = await fetch(`${baseUrl}/rest/v1/signature?id=eq.${encodeURIComponent(recipientId)}`, {
      method: 'PATCH',
      headers: {
        apikey: apiKey,
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify(patchBody),
      cache: 'no-store',
    })

    if (!updateRes.ok) {
      const text = await updateRes.text().catch(() => '')
      return NextResponse.json({ error: `Failed to update recipient: ${updateRes.status} ${text}` }, { status: updateRes.status })
    }

    const updated = await updateRes.json().catch(() => [])
    return NextResponse.json({ success: true, recipient: Array.isArray(updated) ? updated[0] : null })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to update recipient' }, { status: 500 })
  }
}
