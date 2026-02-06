import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

const baseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '')
const apiKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const id = params.id
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    // Vehicle by id
    const vehRes = await fetch(`${baseUrl}/rest/v1/edc_vehicles?id=eq.${encodeURIComponent(id)}&select=*`, {
      method: 'GET',
      headers: { apikey: apiKey, Authorization: `Bearer ${apiKey}` },
      cache: 'no-store',
    })
    if (!vehRes.ok) throw new Error(`Vehicle fetch failed (${vehRes.status})`)
    const vehRows = await vehRes.json()
    const vehicle = Array.isArray(vehRows) && vehRows[0] ? vehRows[0] : null
    if (!vehicle) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const stock = vehicle.stock_number || ''

    // Related tables by stock_number
    const purchaseRes = await fetch(`${baseUrl}/rest/v1/edc_purchase?stock_number=eq.${encodeURIComponent(stock)}&select=*`, {
      headers: { apikey: apiKey, Authorization: `Bearer ${apiKey}` },
      cache: 'no-store',
    })
    const purchaseRows = purchaseRes.ok ? await purchaseRes.json() : []
    const purchase = Array.isArray(purchaseRows) && purchaseRows[0] ? purchaseRows[0] : null

    const disclosuresRes = await fetch(`${baseUrl}/rest/v1/edc_disclosures?stock_number=eq.${encodeURIComponent(stock)}&select=*`, {
      headers: { apikey: apiKey, Authorization: `Bearer ${apiKey}` },
      cache: 'no-store',
    })
    const disclosuresRows = disclosuresRes.ok ? await disclosuresRes.json() : []
    const disclosures = Array.isArray(disclosuresRows) ? disclosuresRows : []

    const costsRes = await fetch(`${baseUrl}/rest/v1/edc_costs?stock_number=eq.${encodeURIComponent(stock)}&select=*`, {
      headers: { apikey: apiKey, Authorization: `Bearer ${apiKey}` },
      cache: 'no-store',
    })
    const costsRows = costsRes.ok ? await costsRes.json() : []
    const costs = Array.isArray(costsRows) ? costsRows : []

    return NextResponse.json({ vehicle, purchase, disclosures, costs }, {
      headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0' },
    })
  } catch (err: any) {
    console.error('[API /vehicles/:id] Error:', err)
    return NextResponse.json({ error: err?.message || 'Failed' }, { status: 500, headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0' } })
  }
}
