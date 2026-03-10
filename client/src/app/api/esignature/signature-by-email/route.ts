import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

const baseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '')
const apiKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export async function GET(request: Request) {
  try {
    if (!baseUrl || !apiKey) {
      console.error('[signature-by-email] Missing env vars:', { baseUrl: !!baseUrl, apiKey: !!apiKey })
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    const url = new URL(request.url)
    const email = url.searchParams.get('email')

    if (!email) {
      return NextResponse.json({ error: 'Missing email parameter' }, { status: 400 })
    }

    const normalizedEmail = email.trim().toLowerCase()
    console.log('[signature-by-email] Looking for email:', normalizedEmail)

    // Query signature table by email (case-insensitive), get the most recent one
    // Using ilike for case-insensitive matching
    const queryUrl = `${baseUrl}/rest/v1/signature?email=ilike.${encodeURIComponent(normalizedEmail)}&order=created_at.desc&limit=1`

    const res = await fetch(queryUrl, {
      method: 'GET',
      headers: {
        'apikey': apiKey,
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    })

    if (!res.ok) {
      const text = await res.text()
      console.error('[signature-by-email] Supabase error:', text)
      return NextResponse.json({ error: 'Failed to fetch signature record' }, { status: res.status })
    }

    const records = await res.json()
    console.log('[signature-by-email] Found records:', records?.length || 0)

    if (!records || records.length === 0) {
      return NextResponse.json({ error: 'No signature request found for this email' }, { status: 404 })
    }

    // Return the first (most recent) record
    return NextResponse.json(records[0], {
      headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0' },
    })
  } catch (err: any) {
    console.error('[signature-by-email] Error:', err)
    return NextResponse.json({ error: err?.message || 'Internal server error' }, { status: 500 })
  }
}
