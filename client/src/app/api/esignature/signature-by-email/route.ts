import { NextResponse } from 'next/server'

const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const apiKey = process.env.SUPABASE_SERVICE_ROLE_KEY

export async function GET(request: Request) {
  try {
    if (!baseUrl) {
      return NextResponse.json({ error: 'Missing SUPABASE_URL' }, { status: 500 })
    }
    if (!apiKey) {
      return NextResponse.json({ error: 'Missing SUPABASE_SERVICE_ROLE_KEY' }, { status: 500 })
    }

    const url = new URL(request.url)
    const email = url.searchParams.get('email')

    if (!email) {
      return NextResponse.json({ error: 'Missing email parameter' }, { status: 400 })
    }

    // Query signature table by email, get the most recent one
    const queryUrl = `${baseUrl}/rest/v1/signature?email=eq.${encodeURIComponent(email)}&order=created_at.desc&limit=1`

    const res = await fetch(queryUrl, {
      headers: {
        apikey: apiKey,
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    })

    if (!res.ok) {
      const text = await res.text()
      console.error('[signature-by-email] Supabase error:', text)
      return NextResponse.json({ error: 'Failed to fetch signature record' }, { status: res.status })
    }

    const records = await res.json()

    if (!records || records.length === 0) {
      return NextResponse.json({ error: 'No signature request found for this email' }, { status: 404 })
    }

    // Return the first (most recent) record
    return NextResponse.json(records[0])
  } catch (err: any) {
    console.error('[signature-by-email] Error:', err)
    return NextResponse.json({ error: err?.message || 'Internal server error' }, { status: 500 })
  }
}
