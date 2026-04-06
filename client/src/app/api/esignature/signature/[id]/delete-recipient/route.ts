import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const baseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '')
const apiKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export async function DELETE(
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
    if (recipientId === id) {
      return NextResponse.json({ error: 'Primary recipient cannot be deleted' }, { status: 400 })
    }

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

    const deleteRes = await fetch(`${baseUrl}/rest/v1/signature?id=eq.${encodeURIComponent(recipientId)}`, {
      method: 'DELETE',
      headers: {
        apikey: apiKey,
        Authorization: `Bearer ${apiKey}`,
      },
      cache: 'no-store',
    })

    if (!deleteRes.ok) {
      const text = await deleteRes.text().catch(() => '')
      return NextResponse.json({ error: `Failed to delete recipient: ${deleteRes.status} ${text}` }, { status: deleteRes.status })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to delete recipient' }, { status: 500 })
  }
}
