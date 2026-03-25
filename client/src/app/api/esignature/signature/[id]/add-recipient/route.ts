import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const baseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '')
const apiKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 })
    if (!baseUrl || !apiKey) return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })

    // Load primary record to copy document_file and user_id
    const primaryRes = await fetch(`${baseUrl}/rest/v1/signature?id=eq.${encodeURIComponent(id)}&limit=1`, {
      headers: { 'apikey': apiKey, 'Authorization': `Bearer ${apiKey}` },
      cache: 'no-store',
    })
    if (!primaryRes.ok) return NextResponse.json({ error: 'Primary record not found' }, { status: 404 })
    const primaryRows = await primaryRes.json()
    if (!primaryRows?.length) return NextResponse.json({ error: 'Primary record not found' }, { status: 404 })
    const primary = primaryRows[0]

    const body = await request.json()
    const { email, full_name, company, title } = body

    if (!email) return NextResponse.json({ error: 'Email is required' }, { status: 400 })

    const newRow = {
      document_file: primary.document_file,
      user_id: primary.user_id,
      email: String(email).trim().toLowerCase(),
      full_name: full_name ? String(full_name).trim() : null,
      company: company ? String(company).trim() : null,
      title: title ? String(title).trim() : null,
      status: 'draft',
    }

    const insertRes = await fetch(`${baseUrl}/rest/v1/signature`, {
      method: 'POST',
      headers: {
        'apikey': apiKey,
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
      },
      body: JSON.stringify([newRow]),
      cache: 'no-store',
    })

    if (!insertRes.ok) {
      const text = await insertRes.text().catch(() => '')
      return NextResponse.json({ error: `Failed to add recipient: ${insertRes.status} ${text}` }, { status: insertRes.status })
    }

    const inserted = await insertRes.json()
    return NextResponse.json({ success: true, recipient: inserted[0] })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to add recipient' }, { status: 500 })
  }
}
