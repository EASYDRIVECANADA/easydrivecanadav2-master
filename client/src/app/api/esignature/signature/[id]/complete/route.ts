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

    const body = await request.json()
    const { signature_image, signed_at, status, fields_data } = body

    const payload: Record<string, any> = {
      status: status || 'completed',
      updated_at: new Date().toISOString(),
    }
    if (signature_image) payload.signature_image = signature_image
    if (signed_at) payload.signed_at = signed_at
    if (fields_data) payload.fields_data = fields_data

    const res = await fetch(`${baseUrl}/rest/v1/signature?id=eq.${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: {
        'apikey': apiKey,
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
      },
      body: JSON.stringify(payload),
      cache: 'no-store',
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      return NextResponse.json({ error: `Failed to complete signature: ${res.status} ${text}` }, { status: res.status })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to complete signature' }, { status: 500 })
  }
}
