import { NextResponse } from 'next/server'

const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '')
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { table, id, data } = body as { table: string; id: string | number; data: Record<string, any> }

    if (!table || !id || !data) {
      return NextResponse.json({ error: 'Missing table, id, or data' }, { status: 400 })
    }

    const allowedTables = [
      'edc_deals_customers',
      'edc_deals_vehicles',
      'edc_deals_worksheet',
      'edc_deals_disclosures',
      'edc_deals_delivery',
    ]
    if (!allowedTables.includes(table)) {
      return NextResponse.json({ error: `Table "${table}" is not allowed` }, { status: 400 })
    }

    const patchUrl = `${supabaseUrl}/rest/v1/${table}?id=eq.${id}`
    const res = await fetch(patchUrl, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Prefer': 'return=representation',
      },
      body: JSON.stringify(data),
    })

    const text = await res.text()
    if (!res.ok) {
      return NextResponse.json({ error: text || `Update failed (${res.status})` }, { status: res.status })
    }

    let rows: any[] = []
    try { rows = JSON.parse(text) } catch {}

    if (rows.length === 0) {
      return NextResponse.json({ error: `No row found with id=${id} in ${table}` }, { status: 404 })
    }

    return NextResponse.json({ success: true, updated: rows.length })
  } catch (err: any) {
    console.error('[API /deals/update] Error:', err)
    return NextResponse.json({ error: err?.message || 'Failed to update deal' }, { status: 500 })
  }
}
