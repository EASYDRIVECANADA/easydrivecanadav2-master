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
    const { status } = body
    if (!status) return NextResponse.json({ error: 'status is required' }, { status: 400 })

    const res = await fetch(`${baseUrl}/rest/v1/signature?id=eq.${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: {
        'apikey': apiKey,
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
      },
      body: JSON.stringify({ status, updated_at: new Date().toISOString() }),
      cache: 'no-store',
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      return NextResponse.json({ error: `Failed to update status: ${res.status} ${text}` }, { status: res.status })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to update status' }, { status: 500 })
  }
}
