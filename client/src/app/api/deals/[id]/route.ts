import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const dealId = params.id
    if (!dealId) return NextResponse.json({ error: 'Missing deal id' }, { status: 400 })

    const supabase = createClient(supabaseUrl, supabaseKey)

    const [customersRes, vehiclesRes, worksheetRes, disclosuresRes, deliveryRes] = await Promise.all([
      supabase.from('edc_deals_customers').select('*').eq('id', dealId).maybeSingle(),
      supabase.from('edc_deals_vehicles').select('*').eq('id', dealId),
      supabase.from('edc_deals_worksheet').select('*').eq('id', dealId).maybeSingle(),
      supabase.from('edc_deals_disclosures').select('*').eq('id', dealId).maybeSingle(),
      supabase.from('edc_deals_delivery').select('*').eq('id', dealId).maybeSingle(),
    ])

    if (customersRes.error) throw customersRes.error
    if (vehiclesRes.error) throw vehiclesRes.error
    if (worksheetRes.error) throw worksheetRes.error
    if (disclosuresRes.error) throw disclosuresRes.error
    if (deliveryRes.error) throw deliveryRes.error

    return NextResponse.json({
      customer: customersRes.data || null,
      vehicles: vehiclesRes.data || [],
      worksheet: worksheetRes.data || null,
      disclosures: disclosuresRes.data || null,
      delivery: deliveryRes.data || null,
    })
  } catch (err: any) {
    console.error('[API /deals/[id]] Error:', err)
    return NextResponse.json({ error: err?.message || 'Failed to fetch deal' }, { status: 500 })
  }
}
