import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

/** Try multiple possible column names for the shared deal identifier */
function getDealId(row: any): string {
  return String(row.dealid ?? row.dealId ?? row.deal_id ?? row.id ?? '')
}

export async function GET() {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Fetch all columns from all 5 tables in parallel
    const [customersRes, vehiclesRes, worksheetRes, disclosuresRes, deliveryRes] = await Promise.all([
      supabase.from('edc_deals_customers').select('*').order('created_at', { ascending: false }),
      supabase.from('edc_deals_vehicles').select('*').order('created_at', { ascending: false }),
      supabase.from('edc_deals_worksheet').select('*').order('created_at', { ascending: false }),
      supabase.from('edc_deals_disclosures').select('*').order('created_at', { ascending: false }),
      supabase.from('edc_deals_delivery').select('*').order('created_at', { ascending: false }),
    ])

    if (customersRes.error) throw customersRes.error
    if (vehiclesRes.error) throw vehiclesRes.error
    if (worksheetRes.error) throw worksheetRes.error
    if (disclosuresRes.error) throw disclosuresRes.error
    if (deliveryRes.error) throw deliveryRes.error

    const customers = customersRes.data || []
    const vehicles = vehiclesRes.data || []
    const worksheets = worksheetRes.data || []
    const disclosures = disclosuresRes.data || []
    const deliveries = deliveryRes.data || []

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

      return {
        dealId: did,
        customer: c,
        primaryCustomer: [c.firstname, c.lastname].filter(Boolean).join(' ') || c.displayname || c.legalname || '',
        vehicle: vehicleLabel,
        type: c.dealtype || '',
        state: '',
        dealDate: c.dealdate || '',
        primarySalesperson: delivery?.salesperson || '',
        vehicles: vList,
        worksheet: worksheetByDeal[did] || null,
        disclosures: disclosureByDeal[did] || null,
        delivery,
      }
    })

    return NextResponse.json({ deals })
  } catch (err: any) {
    console.error('[API /deals] Error:', err)
    return NextResponse.json({ error: err?.message || 'Failed to fetch deals' }, { status: 500 })
  }
}
