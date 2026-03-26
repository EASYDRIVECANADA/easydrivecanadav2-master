import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

const baseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '')
const apiKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

async function queryAll(table: string, extraFilter?: string) {
  const filter = extraFilter ? `&${extraFilter}` : ''
  const res = await fetch(`${baseUrl}/rest/v1/${table}?order=created_at.desc${filter}`, {
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

function toTimestamp(value: any): number {
  if (!value) return Number.POSITIVE_INFINITY
  const time = Date.parse(String(value))
  return Number.isFinite(time) ? time : Number.POSITIVE_INFINITY
}

function compareIdsAsc(a: any, b: any): number {
  const aNum = Number(a)
  const bNum = Number(b)
  const aNumValid = Number.isFinite(aNum)
  const bNumValid = Number.isFinite(bNum)
  if (aNumValid && bNumValid) return aNum - bNum
  return String(a ?? '').localeCompare(String(b ?? ''), undefined, { numeric: true, sensitivity: 'base' })
}

function getCustomerDisplayName(customer: any): string {
  const first = customer?.firstname ?? customer?.first_name ?? ''
  const last = customer?.lastname ?? customer?.last_name ?? ''
  return [first, last].filter(Boolean).join(' ').trim() || customer?.displayname || customer?.display_name || customer?.legalname || customer?.legal_name || ''
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const userId = String(url.searchParams.get('userId') ?? '').trim()
    const userFilter = userId ? `user_id=eq.${encodeURIComponent(userId)}` : undefined

    // Fetch all columns from all 5 tables in parallel
    const [customers, vehicles, worksheets, disclosures, deliveries] = await Promise.all([
      queryAll('edc_deals_customers', userFilter),
      queryAll('edc_deals_vehicles'),
      queryAll('edc_deals_worksheet'),
      queryAll('edc_deals_disclosures'),
      queryAll('edc_deals_delivery'),
    ])

    // Collect unique vehicle IDs from deal vehicle rows to fetch accurate stock_number from edc_vehicles
    const vehicleIds = Array.from(new Set(
      vehicles.map((v: any) => v.selected_id).filter(Boolean)
    ))
    let inventoryStockMap: Record<string, string> = {}
    if (vehicleIds.length > 0) {
      try {
        const invRes = await fetch(
          `${baseUrl}/rest/v1/edc_vehicles?id=in.(${vehicleIds.map((id) => encodeURIComponent(String(id))).join(',')})&select=id,stock_number`,
          { headers: { 'apikey': apiKey, 'Authorization': `Bearer ${apiKey}` }, cache: 'no-store' }
        )
        if (invRes.ok) {
          const invRows: any[] = await invRes.json()
          for (const r of invRows) {
            if (r.id && r.stock_number) inventoryStockMap[String(r.id)] = String(r.stock_number)
          }
        }
      } catch {}
    }

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

    // Group customers by deal_id — one deal entry per unique deal_id
    const customersByDeal: Record<string, any[]> = {}
    for (const c of customers) {
      const did = getDealId(c)
      if (!did) continue
      if (!customersByDeal[did]) customersByDeal[did] = []
      customersByDeal[did].push(c)
    }

    // Sort each group so the oldest customer stays primary, and new customers stay secondary
    for (const group of Object.values(customersByDeal)) {
      group.sort((a: any, b: any) => {
        const createdDiff = toTimestamp(a?.created_at) - toTimestamp(b?.created_at)
        if (createdDiff !== 0) return createdDiff
        return compareIdsAsc(a?.id, b?.id)
      })
    }

    // Build the combined deals list — one entry per unique deal_id
    const deals = Object.entries(customersByDeal).map(([did, group]) => {
      const c = group[0] // primary customer
      const vList = vehiclesByDeal[did] || []

      // Build vehicle label from the first vehicle's selected_* fields or trade fields
      let vehicleLabel = ''
      if (vList.length > 0) {
        const v = vList[0]
        // Prefer live stock_number from edc_vehicles, fall back to saved selected_stock_number
        const stockNum = (v.selected_id && inventoryStockMap[String(v.selected_id)]) || v.selected_stock_number || ''
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
        primaryCustomer: getCustomerDisplayName(c),
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

    // Sort deals by most recently created (based on primary customer's created_at)
    deals.sort((a, b) => {
      const ta = a.customer?.created_at ?? ''
      const tb = b.customer?.created_at ?? ''
      return tb < ta ? -1 : tb > ta ? 1 : 0
    })

    return NextResponse.json({ deals }, {
      headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0' },
    })
  } catch (err: any) {
    console.error('[API /deals] Error:', err)
    return NextResponse.json({ error: err?.message || 'Failed to fetch deals' }, { status: 500 })
  }
}
