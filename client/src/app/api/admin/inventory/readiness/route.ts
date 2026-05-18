import { NextResponse } from 'next/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import {
  buildVehicleSearchText,
  scoreInventoryReadiness,
  vehicleMatchesSearch,
} from '@/lib/dealerOpsReadiness.mjs'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const createSupabase = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseKey) return null
  return createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
}

type StorageFile = { name?: unknown }
type Row = Record<string, unknown>

const enrichVehicles = async (supabase: SupabaseClient, vehicles: Row[]) => {
  const ids = vehicles.map((vehicle) => String(vehicle?.id || '').trim()).filter(Boolean)
  const carfaxCounts = new Map<string, number>()
  const photoCounts = new Map<string, number>()
  const disclosureCounts = new Map<string, number>()

  await Promise.all(ids.map(async (id) => {
    const [carfax, photos] = await Promise.all([
      supabase.storage.from('Carfax').list(id, { limit: 100 }),
      supabase.storage.from('vehicle-photos').list(id, { limit: 100 }),
    ])
    carfaxCounts.set(id, Array.isArray(carfax.data) ? (carfax.data as StorageFile[]).filter((file) => file?.name && !String(file.name).endsWith('/')).length : 0)
    photoCounts.set(id, Array.isArray(photos.data) ? (photos.data as StorageFile[]).filter((file) => file?.name && !String(file.name).endsWith('/')).length : 0)
  }))

  if (ids.length > 0) {
    const { data } = await supabase
      .from('edc_disclosures')
      .select('id, vehicleId')
      .in('vehicleId', ids)

    if (Array.isArray(data)) {
      for (const row of data as Row[]) {
        const id = String(row?.vehicleId || '').trim()
        if (!id) continue
        disclosureCounts.set(id, (disclosureCounts.get(id) || 0) + 1)
      }
    }
  }

  return vehicles.map((vehicle) => {
    const id = String(vehicle?.id || '').trim()
    return {
      ...vehicle,
      photo_count: photoCounts.get(id) || 0,
      carfax_count: carfaxCounts.get(id) || 0,
      disclosure_count: disclosureCounts.get(id) || 0,
      search_text: buildVehicleSearchText({
        ...vehicle,
        photo_count: photoCounts.get(id) || 0,
        carfax_count: carfaxCounts.get(id) || 0,
        disclosure_count: disclosureCounts.get(id) || 0,
      }),
    }
  })
}

export async function GET(request: Request) {
  try {
    const supabase = createSupabase()
    if (!supabase) return NextResponse.json({ error: 'Server not configured' }, { status: 500 })

    const url = new URL(request.url)
    const userId = String(url.searchParams.get('user_id') || '').trim()
    const q = String(url.searchParams.get('q') || '').trim()

    let query = supabase
      .from('edc_vehicles')
      .select('*')
      .order('created_at', { ascending: false })

    if (userId) query = query.eq('user_id', userId)

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const enriched = await enrichVehicles(supabase, Array.isArray(data) ? data : [])
    const matched = q ? enriched.filter((vehicle) => vehicleMatchesSearch(vehicle, q)) : enriched
    const readiness = matched.map((vehicle) => scoreInventoryReadiness(vehicle))
    const needsWork = readiness.filter((item) => item.score < 100)

    return NextResponse.json(
      {
        vehicles: matched.map((vehicle, index) => ({
          ...vehicle,
          readiness: readiness[index],
        })),
        readiness,
        summary: {
          total: readiness.length,
          ready: readiness.filter((item) => item.score === 100).length,
          needsWork: needsWork.length,
          missingCarfax: readiness.filter((item) => item.missing.includes('carfax')).length,
          missingPhotos: readiness.filter((item) => item.missing.includes('photos')).length,
          averageScore: readiness.length
            ? Math.round(readiness.reduce((sum, item) => sum + item.score, 0) / readiness.length)
            : 0,
        },
      },
      { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0' } }
    )
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to load inventory readiness' }, { status: 500 })
  }
}
