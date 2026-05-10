import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

const baseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '')
const apiKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

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

    const [vehicles, worksheet, disclosures, delivery, submissionRows] = await Promise.all([
      query('edc_deals_vehicles', `${dealFilter}&order=created_at.asc`).catch(() => []),
      query('edc_deals_worksheet', `${dealFilter}&limit=1`).catch(() => []),
      query('edc_deals_disclosures', `${dealFilter}&limit=1`).catch(() => []),
      query('edc_deals_delivery', `${dealFilter}&limit=1`).catch(() => []),
      query('edc_purchase_submissions', `deal_id=eq.${encodeURIComponent(dealId)}&limit=1`).catch(() => []),
    ])

    // Parse JSON string fields in worksheet so the BOS page gets real arrays
    const ws = worksheet?.[0] || null
    if (ws) {
      const jsonFields = ['fees', 'accessories', 'warranties', 'insurances', 'payments']
      for (const f of jsonFields) {
        if (typeof ws[f] === 'string') {
          try { ws[f] = JSON.parse(ws[f]) } catch { ws[f] = [] }
        }
      }
    }

    // Parse order_data from submission if it's a string
    const submission = submissionRows?.[0] || null
    if (submission?.order_data && typeof submission.order_data === 'string') {
      try { submission.order_data = JSON.parse(submission.order_data) } catch { submission.order_data = {} }
    }

    return NextResponse.json({
      customers: customers || [],
      customer: customers?.[0] || null,
      vehicles: vehicles || [],
      worksheet: ws,
      disclosures: disclosures?.[0] || null,
      delivery: delivery?.[0] || null,
      submission,
    }, {
      headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0' },
    })
  } catch (err: any) {
    console.error('[API /deals/[id]] Error:', err)
    return NextResponse.json({ error: err?.message || 'Failed to fetch deal' }, { status: 500 })
  }
}
