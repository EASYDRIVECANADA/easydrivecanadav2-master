import { NextResponse } from 'next/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { requireAdminSession } from '@/lib/apiAuth'
import {
  buildFacebookMarketplacePayload,
  buildFacebookPostInsert,
  mergeFacebookPostRow,
  scoreFacebookMarketplaceReadiness,
  vehicleMatchesFacebookSearch,
} from '@/lib/facebookMarketplacePosting.mjs'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

const noStore = { 'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0' }

const createSupabase = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseKey) return null
  return createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
}

const clean = (value: unknown) => String(value ?? '').trim()

type FacebookQueueRow = Record<string, unknown> & {
  vehicleId?: string
  postId?: string
  status?: string
}

type LoadedRows =
  | { response: NextResponse; supabase?: never; rows?: never; summary?: never }
  | { response?: never; supabase: SupabaseClient; rows: FacebookQueueRow[]; summary: Record<string, number> }

const loadRows = async (request: Request): Promise<LoadedRows> => {
  const supabase = createSupabase()
  if (!supabase) {
    return { response: NextResponse.json({ error: 'Server not configured' }, { status: 500, headers: noStore }) }
  }

  const url = new URL(request.url)
  const userId = clean(url.searchParams.get('user_id'))
  const q = clean(url.searchParams.get('q'))
  const status = clean(url.searchParams.get('status'))

  let vehicleQuery = supabase.from('edc_vehicles').select('*').order('created_at', { ascending: false })
  if (userId) vehicleQuery = vehicleQuery.eq('user_id', userId)

  const [vehicleResult, postResult] = await Promise.all([
    vehicleQuery,
    supabase.from('edc_facebook_marketplace_posts').select('*').order('updated_at', { ascending: false }),
  ])

  if (vehicleResult.error) {
    return { response: NextResponse.json({ error: vehicleResult.error.message }, { status: 500, headers: noStore }) }
  }

  if (postResult.error) {
    return {
      response: NextResponse.json({
        error: postResult.error.message,
        setupRequired: postResult.error.message.toLowerCase().includes('edc_facebook_marketplace_posts'),
      }, { status: 500, headers: noStore }),
    }
  }

  const postByVehicleId = new Map(
    (Array.isArray(postResult.data) ? postResult.data : []).map((post: Record<string, unknown>) => [clean(post.vehicle_id), post])
  )
  const rows: FacebookQueueRow[] = (Array.isArray(vehicleResult.data) ? vehicleResult.data : []).map((vehicle: Record<string, unknown>) => {
    const payload = buildFacebookMarketplacePayload(vehicle, {
      siteUrl: process.env.NEXT_PUBLIC_SITE_URL || 'https://easydrivecanada.com',
      defaultLocation: process.env.EASYDRIVE_MARKETPLACE_DEFAULT_LOCATION || 'Mississauga, ON',
    })
    return mergeFacebookPostRow(payload, postByVehicleId.get(clean(vehicle.id)) || null)
  })

  const filtered = rows
    .filter((row) => !status || row.status === status)
    .filter((row) => vehicleMatchesFacebookSearch(row, q))

  const summary = {
    total: filtered.length,
    ready: filtered.filter((row) => row.status === 'ready').length,
    draft: filtered.filter((row) => row.status === 'draft').length,
    posted: filtered.filter((row) => row.status === 'posted').length,
    needsUpdate: filtered.filter((row) => row.status === 'needs_update').length,
    soldRemove: filtered.filter((row) => row.status === 'sold_remove').length,
    skipped: filtered.filter((row) => row.status === 'skipped').length,
    failed: filtered.filter((row) => row.status === 'failed').length,
  }

  return { supabase, rows: filtered, summary }
}

export async function GET(request: Request) {
  try {
    const authError = await requireAdminSession(request)
    if (authError) return authError

    const loaded = await loadRows(request)
    if (loaded.response) return loaded.response
    return NextResponse.json({ posts: loaded.rows, summary: loaded.summary }, { headers: noStore })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to load Facebook posts' }, { status: 500, headers: noStore })
  }
}

export async function POST(request: Request) {
  try {
    const authError = await requireAdminSession(request)
    if (authError) return authError

    const loaded = await loadRows(request)
    if (loaded.response) return loaded.response

    const body = await request.json().catch(() => ({}))
    const vehicleIds = Array.isArray(body?.vehicleIds) ? body.vehicleIds.map(clean).filter(Boolean) : []
    const refreshOverrides = body?.refreshOverrides === true
    const nowIso = new Date().toISOString()
    const selected = vehicleIds.length ? loaded.rows.filter((row) => vehicleIds.includes(clean(row.vehicleId))) : loaded.rows

    const upserts = selected.map((row) => {
      const readiness = scoreFacebookMarketplaceReadiness(row)
      const insert = buildFacebookPostInsert(row, readiness, nowIso) as Record<string, unknown>
      if (!refreshOverrides && row.postId) {
        delete insert.posting_title
        delete insert.posting_description
        delete insert.posting_price
        delete insert.posting_location
      }
      return insert
    })

    if (upserts.length === 0) return NextResponse.json({ updated: 0 }, { headers: noStore })

    const { error } = await loaded.supabase
      .from('edc_facebook_marketplace_posts')
      .upsert(upserts, { onConflict: 'vehicle_id' })

    if (error) return NextResponse.json({ error: error.message }, { status: 500, headers: noStore })
    return NextResponse.json({ updated: upserts.length }, { headers: noStore })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to prepare Facebook posts' }, { status: 500, headers: noStore })
  }
}
