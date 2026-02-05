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

    const eq = `id=eq.${dealId}`
    const [customers, vehicles, worksheet, disclosures, delivery] = await Promise.all([
      query('edc_deals_customers', `${eq}&limit=1`),
      query('edc_deals_vehicles', eq),
      query('edc_deals_worksheet', `${eq}&limit=1`),
      query('edc_deals_disclosures', `${eq}&limit=1`),
      query('edc_deals_delivery', `${eq}&limit=1`),
    ])

    return NextResponse.json({
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
