import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

const baseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '')
const apiKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

async function query(table: string, filter: string) {
  const res = await fetch(`${baseUrl}/rest/v1/${table}?${filter}`, {
    method: 'GET',
    headers: {
      'apikey': apiKey,
      'Authorization': `Bearer ${apiKey}`,
    },
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`Failed to fetch ${table}: ${res.status}`)
  return res.json()
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const dealId = params.id
    if (!dealId) return NextResponse.json({ error: 'Missing deal id' }, { status: 400 })

    const dealFilter = `deal_id=eq.${encodeURIComponent(dealId)}`

    // Load all tables by deal_id
    let customers: any[] = []
    try {
      const byDealId = await query('edc_deals_customers', `${dealFilter}&order=id.asc`)
      if (Array.isArray(byDealId) && byDealId.length > 0) customers = byDealId
    } catch { /* ignore */ }

    const [vehicles, worksheet, disclosures, delivery] = await Promise.all([
      query('edc_deals_vehicles', `${dealFilter}&order=created_at.asc`).catch(() => []),
      query('edc_deals_worksheet', `${dealFilter}&limit=1`).catch(() => []),
      query('edc_deals_disclosures', `${dealFilter}&limit=1`).catch(() => []),
      query('edc_deals_delivery', `${dealFilter}&limit=1`).catch(() => []),
    ])

    return NextResponse.json({
      customers: customers || [],
      customer: customers?.[0] || null,
      vehicles: vehicles || [],
      worksheet: worksheet?.[0] || null,
      disclosures: disclosures?.[0] || null,
      delivery: delivery?.[0] || null,
    }, {
      headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0' },
    })
  } catch (err: any) {
    console.error('[API /deals/[id]] Error:', err)
    return NextResponse.json({ error: err?.message || 'Failed to fetch deal' }, { status: 500 })
  }
}
