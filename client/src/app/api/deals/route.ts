import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

const baseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '')
const apiKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

async function queryAll(table: string) {
  const res = await fetch(`${baseUrl}/rest/v1/${table}?order=created_at.desc`, {
    method: 'GET',
    headers: { 'apikey': apiKey, 'Authorization': `Bearer ${apiKey}` },
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`Failed to fetch ${table}: ${res.status}`)
  return res.json()
}

/** Try multiple possible column names for the shared deal identifier */
function getDealId(row: any): string {
  return String(row.dealid ?? row.dealId ?? row.deal_id ?? row.id ?? '')
}

export async function GET() {
  try {
    // Fetch all columns from all 5 tables in parallel
    const [customers, vehicles, worksheets, disclosures, deliveries] = await Promise.all([
      queryAll('edc_deals_customers'),
      queryAll('edc_deals_vehicles'),
      queryAll('edc_deals_worksheet'),
      queryAll('edc_deals_disclosures'),
      queryAll('edc_deals_delivery'),
    ])

    // Index secondary tables by dealid for fast lookup
    const vehiclesByDeal: Record<string, any[]> = {}
    for (const v of vehicles) {
      const did = getDealId(v)
      if (!did) continue
      if (!vehiclesByDeal[did]) vehiclesByDeal[did] = []
      vehiclesByDeal[did].push(v)
    }

    const worksheetByDeal: Record<string, any> = {}
    for (const w of worksheets) {
      const did = getDealId(w)
      if (did) worksheetByDeal[did] = w
    }

    const disclosureByDeal: Record<string, any> = {}
    for (const d of disclosures) {
      const did = getDealId(d)
      if (did) disclosureByDeal[did] = d
    }

    const deliveryByDeal: Record<string, any> = {}
    for (const d of deliveries) {
      const did = getDealId(d)
      if (did) deliveryByDeal[did] = d
    }

    // Build the combined deals list from customers as the primary source
    const deals = customers.map((c: any) => {
      const did = getDealId(c)
      const vList = vehiclesByDeal[did] || []

      // Build vehicle label from the first vehicle's selected_* fields or trade fields
      let vehicleLabel = ''
      if (vList.length > 0) {
        const v = vList[0]
        const stockNum = v.selected_stock_number ?? ''
        const yr = v.selected_year ?? v.year ?? ''
        const mk = v.selected_make ?? v.make ?? ''
        const md = v.selected_model ?? v.model ?? ''
        const tr = v.selected_trim ?? v.trim ?? ''
        const vin = v.selected_vin ?? v.vin ?? ''
        const parts = [stockNum ? String(stockNum) : '', yr ? String(yr) : '', mk, md, tr].filter(Boolean)
        vehicleLabel = parts.join(' - ').trim()
        if (!vehicleLabel && vin) vehicleLabel = vin
      }

      const delivery = deliveryByDeal[did] || null
      const worksheet = worksheetByDeal[did] || null

      const state = String(
        c.deal_state ?? c.dealState ?? c.dealstate ?? c.state ??
        worksheet?.deal_state ?? worksheet?.dealState ?? worksheet?.dealstate ??
        delivery?.deal_state ?? delivery?.dealState ?? delivery?.dealstate ??
        ''
      ).trim()

      return {
        dealId: did,
        customer: c,
        primaryCustomer: [c.firstname, c.lastname].filter(Boolean).join(' ') || c.displayname || c.legalname || '',
        vehicle: vehicleLabel,
        type: c.dealtype || '',
        state,
        dealDate: c.dealdate || '',
        primarySalesperson: delivery?.salesperson || '',
        vehicles: vList,
        worksheet,
        disclosures: disclosureByDeal[did] || null,
        delivery,
      }
    })

    return NextResponse.json({ deals }, {
      headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0' },
    })
  } catch (err: any) {
    console.error('[API /deals] Error:', err)
    return NextResponse.json({ error: err?.message || 'Failed to fetch deals' }, { status: 500 })
  }
}
