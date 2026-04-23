import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const baseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '')
const apiKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

async function fetchWarranty(filter: string) {
  const url = `${baseUrl}/rest/v1/edc_warranty?${filter}&select=*&limit=1`
  const res = await fetch(url, {
    headers: { apikey: apiKey, Authorization: `Bearer ${apiKey}` },
    cache: 'no-store',
  })
  if (!res.ok) {
    console.error('[warranty/vehicle] fetch failed:', res.status, url)
    return null
  }
  const rows = await res.json()
  console.log('[warranty/vehicle] rows for filter', filter, '->', JSON.stringify(rows))
  return Array.isArray(rows) && rows[0] ? rows[0] : null
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const vehicleId = searchParams.get('vehicleId')
    const stockNumber = searchParams.get('stockNumber')

    console.log('[warranty/vehicle] vehicleId:', vehicleId, 'stockNumber:', stockNumber)

    if (!vehicleId && !stockNumber) {
      return NextResponse.json({ error: 'Missing vehicleId or stockNumber' }, { status: 400 })
    }

    let warranty: any = null
    let resolvedVehicleId = vehicleId || ''

    if (vehicleId) {
      warranty = await fetchWarranty(`id=eq.${encodeURIComponent(vehicleId)}`)
      if (!warranty) {
        warranty = await fetchWarranty(`vehicle_id=eq.${encodeURIComponent(vehicleId)}`)
      }
    }

    // Fallback: resolve vehicle id from stock_number, then query warranty
    if (!warranty && stockNumber) {
      const vRes = await fetch(
        `${baseUrl}/rest/v1/edc_vehicles?stock_number=eq.${encodeURIComponent(stockNumber)}&select=id&limit=1`,
        { headers: { apikey: apiKey, Authorization: `Bearer ${apiKey}` }, cache: 'no-store' }
      )
      if (vRes.ok) {
        const vRows = await vRes.json()
        const vid = Array.isArray(vRows) && vRows[0]?.id ? vRows[0].id : null
        console.log('[warranty/vehicle] resolved vehicle id from stock_number:', vid)
        if (vid) {
          resolvedVehicleId = vid
          warranty = await fetchWarranty(`id=eq.${encodeURIComponent(vid)}`)
          if (!warranty) warranty = await fetchWarranty(`vehicle_id=eq.${encodeURIComponent(vid)}`)
        }
      }
    }

    console.log('[warranty/vehicle] final warranty:', JSON.stringify(warranty))

    return NextResponse.json({ warranty, _debug: { vehicleId, stockNumber, resolvedVehicleId } }, {
      headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0' },
    })
  } catch (err: any) {
    console.error('[API /warranty/vehicle] Error:', err)
    return NextResponse.json({ error: err?.message || 'Failed' }, { status: 500 })
  }
}
