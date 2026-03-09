import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

const baseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '')
const apiKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const dealId = url.searchParams.get('dealId')

    if (!dealId) {
      return NextResponse.json({ error: 'dealId is required' }, { status: 400 })
    }

    const res = await fetch(
      `${baseUrl}/rest/v1/edc_esignature_fields?deal_id=eq.${encodeURIComponent(dealId)}&select=*&limit=1`,
      {
        method: 'GET',
        headers: {
          apikey: apiKey!,
          Authorization: `Bearer ${apiKey}`,
        },
        cache: 'no-store',
      }
    )

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(text || `Failed to fetch fields (${res.status})`)
    }

    const rows = await res.json()
    const row = rows?.[0]

    if (!row) {
      return NextResponse.json({ fields: [] })
    }

    const fields = row.fields_data ? JSON.parse(row.fields_data) : []

    return NextResponse.json({ fields }, {
      headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0' },
    })
  } catch (err: any) {
    console.error('[API /esignature/fields GET] Error:', err)
    return NextResponse.json({ error: err?.message || 'Failed to fetch fields' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { dealId, fields } = body

    if (!dealId) {
      return NextResponse.json({ error: 'dealId is required' }, { status: 400 })
    }

    if (!Array.isArray(fields)) {
      return NextResponse.json({ error: 'fields must be an array' }, { status: 400 })
    }

    const checkRes = await fetch(
      `${baseUrl}/rest/v1/edc_esignature_fields?deal_id=eq.${encodeURIComponent(dealId)}&select=id&limit=1`,
      {
        method: 'GET',
        headers: {
          apikey: apiKey!,
          Authorization: `Bearer ${apiKey}`,
        },
      }
    )

    const existing = await checkRes.json()
    const fieldsJson = JSON.stringify(fields)

    if (existing && existing.length > 0) {
      const updateRes = await fetch(
        `${baseUrl}/rest/v1/edc_esignature_fields?deal_id=eq.${encodeURIComponent(dealId)}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            apikey: apiKey!,
            Authorization: `Bearer ${apiKey}`,
            Prefer: 'return=representation',
          },
          body: JSON.stringify({
            fields_data: fieldsJson,
            updated_at: new Date().toISOString(),
          }),
        }
      )

      if (!updateRes.ok) {
        const text = await updateRes.text().catch(() => '')
        throw new Error(text || `Failed to update fields (${updateRes.status})`)
      }
    } else {
      const insertRes = await fetch(`${baseUrl}/rest/v1/edc_esignature_fields`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: apiKey!,
          Authorization: `Bearer ${apiKey}`,
          Prefer: 'return=representation',
        },
        body: JSON.stringify({
          deal_id: dealId,
          fields_data: fieldsJson,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }),
      })

      if (!insertRes.ok) {
        const text = await insertRes.text().catch(() => '')
        throw new Error(text || `Failed to insert fields (${insertRes.status})`)
      }
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('[API /esignature/fields POST] Error:', err)
    return NextResponse.json({ error: err?.message || 'Failed to save fields' }, { status: 500 })
  }
}
