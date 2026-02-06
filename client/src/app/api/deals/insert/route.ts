import { NextResponse } from 'next/server'

const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '')
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { table, data } = body as { table: string; data: Record<string, any> }

    if (!table || !data) {
      return NextResponse.json({ error: 'Missing table or data' }, { status: 400 })
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

    const insertUrl = `${supabaseUrl}/rest/v1/${table}`
    const res = await fetch(insertUrl, {
      method: 'POST',
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
      console.error(`[API /deals/insert] Supabase error for ${table}:`, text)
      return NextResponse.json({ error: text || `Insert failed (${res.status})` }, { status: res.status })
    }

    let rows: any[] = []
    try { rows = JSON.parse(text) } catch {}

    return NextResponse.json({ success: true, inserted: rows.length, rows })
  } catch (err: any) {
    console.error('[API /deals/insert] Error:', err)
    return NextResponse.json({ error: err?.message || 'Failed to insert deal data' }, { status: 500 })
  }
}
