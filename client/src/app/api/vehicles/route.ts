import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

const baseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '')
const apiKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export async function GET() {
  try {
    const select = [
      'id',
      'make',
      'model',
      'year',
      'trim',
      'vin',
      'stock_number',
      'drivetrain',
      'transmission',
      'cylinders',
      'exterior_color',
      'odometer',
      'mileage',
      'odometer_unit',
      'price',
      'status',
      'images',
      'features',
      'created_at',
    ].join(',')
    const res = await fetch(`${baseUrl}/rest/v1/edc_vehicles?select=${encodeURIComponent(select)}&order=created_at.desc`, {
      method: 'GET',
      headers: {
        'apikey': apiKey,
        'Authorization': `Bearer ${apiKey}`,
      },
      cache: 'no-store',
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(text || `Failed to fetch vehicles (${res.status})`)
    }

    const vehicles = await res.json()

    return NextResponse.json(
      { vehicles },
      { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0' } }
    )
  } catch (err: any) {
    console.error('[API /vehicles] Error:', err)
    return NextResponse.json(
      { error: err?.message || 'Failed to fetch vehicles' },
      { status: 500, headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0' } }
    )
  }
}
