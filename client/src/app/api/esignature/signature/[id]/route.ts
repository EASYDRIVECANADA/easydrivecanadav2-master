import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

const baseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '')
const apiKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const signatureId = params.id

    if (!signatureId) {
      return NextResponse.json({ error: 'Signature ID is required' }, { status: 400 })
    }

    if (!baseUrl || !apiKey) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    // Query signature table by ID
    const queryUrl = `${baseUrl}/rest/v1/signature?id=eq.${encodeURIComponent(signatureId)}&limit=1`

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
      const errorText = await res.text()
      console.error('[API /esignature/signature/[id]] Error:', errorText)
      return NextResponse.json({ error: `Failed to fetch signature: ${res.status}` }, { status: res.status })
    }

    const records = await res.json()

    if (!records || records.length === 0) {
      return NextResponse.json({ error: 'Signature not found' }, { status: 404 })
    }

    const signature = records[0]

    // Load sibling records (same user, same document_file) to get all recipients
    let siblings: any[] = []
    if (signature.user_id && signature.document_file) {
      const siblingsRes = await fetch(
        `${baseUrl}/rest/v1/signature?user_id=eq.${encodeURIComponent(signature.user_id)}&select=id,email,full_name,company,title,status,document_file,signature_image`,
        {
          method: 'GET',
          headers: { 'apikey': apiKey, 'Authorization': `Bearer ${apiKey}` },
          cache: 'no-store',
        }
      )
      if (siblingsRes.ok) {
        const allRecords: any[] = await siblingsRes.json().catch(() => [])
        // Filter to only those sharing the same document_file
        siblings = allRecords.filter(
          (r: any) => r.id !== signature.id && String(r.document_file ?? '') === String(signature.document_file ?? '')
        )
      }
    }

    return NextResponse.json({ ...signature, siblings }, {
      headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0' },
    })
  } catch (err: any) {
    console.error('[API /esignature/signature/[id]] Error:', err)
    return NextResponse.json({ error: err?.message || 'Failed to fetch signature' }, { status: 500 })
  }
}
