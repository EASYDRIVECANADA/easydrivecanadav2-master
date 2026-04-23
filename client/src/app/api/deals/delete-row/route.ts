import { NextResponse } from 'next/server'

const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '')
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const ALLOWED_TABLES = ['edc_deals_customers', 'edc_deals_vehicles']

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { table, id } = body as { table: string; id: string | number }

    if (!table || !id) {
      return NextResponse.json({ error: 'Missing table or id' }, { status: 400 })
    }
    if (!ALLOWED_TABLES.includes(table)) {
      return NextResponse.json({ error: `Table "${table}" is not allowed` }, { status: 400 })
    }

    const url = `${supabaseUrl}/rest/v1/${table}?id=eq.${encodeURIComponent(String(id))}`
    const res = await fetch(url, {
      method: 'DELETE',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Prefer': 'return=minimal',
      },
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      return NextResponse.json({ error: text || `Delete failed (${res.status})` }, { status: res.status })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('[API /deals/delete-row] Error:', err)
    return NextResponse.json({ error: err?.message || 'Failed to delete row' }, { status: 500 })
  }
}
