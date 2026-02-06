import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const baseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '')
const apiKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const TABLES = [
  'edc_deals_customers',
  'edc_deals_vehicles',
  'edc_deals_worksheet',
  'edc_deals_disclosures',
  'edc_deals_delivery',
]

async function deleteFromTable(table: string, dealId: string): Promise<{ table: string; ok: boolean; count: number }> {
  const res = await fetch(`${baseUrl}/rest/v1/${table}?id=eq.${dealId}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      'apikey': apiKey,
      'Authorization': `Bearer ${apiKey}`,
      'Prefer': 'return=representation',
    },
  })
  const text = await res.text().catch(() => '')
  let count = 0
  if (res.ok) {
    try { count = JSON.parse(text).length } catch { count = text ? 1 : 0 }
  }
  console.log(`[Delete] ${table}: status=${res.status}, deleted=${count}`)
  if (!res.ok) {
    console.error(`[Delete] Failed ${table}:`, text)
  }
  return { table, ok: res.ok, count }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const dealId = body?.dealId
    if (!dealId) {
      return NextResponse.json({ error: 'Missing dealId' }, { status: 400 })
    }

    const results = await Promise.all(
      TABLES.map((table) => deleteFromTable(table, dealId))
    )

    const summary = results.reduce((acc, r) => {
      acc[r.table] = { ok: r.ok, count: r.count }
      return acc
    }, {} as Record<string, { ok: boolean; count: number }>)

    const allFailed = results.every((r) => !r.ok)
    if (allFailed) {
      return NextResponse.json({ error: 'Failed to delete from all tables', details: summary }, { status: 500 })
    }

    return NextResponse.json({ success: true, deleted: dealId, details: summary })
  } catch (err: any) {
    console.error('[API /deals/delete] Error:', err)
    return NextResponse.json({ error: err?.message || 'Delete failed' }, { status: 500 })
  }
}
