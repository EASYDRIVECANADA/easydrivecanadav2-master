import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAdminSession } from '@/lib/apiAuth'
import {
  buildFacebookAssistPayload,
  buildFacebookAssistLaunchToken,
  buildFacebookMarketplacePayload,
  isValidFacebookAssistStatus,
  normalizeFacebookAssistStatus,
  verifyFacebookAssistLaunchToken,
} from '@/lib/facebookMarketplacePosting.mjs'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

const noStore = { 'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0' }
const clean = (value: unknown) => String(value ?? '').trim()

type FacebookPostRecord = Record<string, unknown> & {
  id?: string
  vehicle_id?: string | null
  posting_payload?: Record<string, unknown> | null
  posting_title?: string | null
  posting_description?: string | null
  posting_price?: number | string | null
  posting_location?: string | null
}

const createSupabase = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseKey) return null
  return createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
}

const setupRequired = (message: string) => {
  const normalized = message.toLowerCase()
  return normalized.includes('assist_') || normalized.includes('edc_facebook_marketplace_posts')
}

const assistTokenSecret = () =>
  process.env.FACEBOOK_ASSIST_TOKEN_SECRET ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  'facebook-assist-development-secret'

const parseLaunchToken = (request: Request) => {
  const raw = clean(new URL(request.url).searchParams.get('token'))
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export async function GET(request: Request, context: { params: { id: string } }) {
  try {
    const providedLaunchToken = parseLaunchToken(request)
    if (providedLaunchToken) {
      const verification = verifyFacebookAssistLaunchToken(providedLaunchToken, new Date().toISOString(), assistTokenSecret())
      if (!verification.valid || clean(providedLaunchToken.postId) !== clean(context.params.id)) {
        return NextResponse.json({ error: 'Invalid or expired browser assistance token.' }, { status: 401, headers: noStore })
      }
    } else {
      const authError = await requireAdminSession(request)
      if (authError) return authError
    }

    const supabase = createSupabase()
    if (!supabase) return NextResponse.json({ error: 'Server not configured' }, { status: 500, headers: noStore })

    const postId = clean(context.params.id)
    if (!postId) return NextResponse.json({ error: 'Missing post id' }, { status: 400, headers: noStore })

    const result = await supabase
      .from('edc_facebook_marketplace_posts')
      .select('*')
      .eq('id', postId)
      .maybeSingle()

    if (result.error) {
      return NextResponse.json({
        error: result.error.message,
        setupRequired: setupRequired(result.error.message),
      }, { status: 500, headers: noStore })
    }
    if (!result.data) return NextResponse.json({ error: 'Post not found' }, { status: 404, headers: noStore })

    const post = result.data as FacebookPostRecord
    const rawPayload = post.posting_payload && typeof post.posting_payload === 'object' ? post.posting_payload : {}
    let freshVehiclePayload: Record<string, unknown> = {}
    const vehicleId = clean(post.vehicle_id)
    if (vehicleId) {
      const vehicleResult = await supabase
        .from('edc_vehicles')
        .select('*')
        .eq('id', vehicleId)
        .maybeSingle()

      if (!vehicleResult.error && vehicleResult.data) {
        freshVehiclePayload = buildFacebookMarketplacePayload(vehicleResult.data, {
          siteUrl: process.env.NEXT_PUBLIC_SITE_URL || 'https://easydrivecanada.com',
          defaultLocation: process.env.EASYDRIVE_MARKETPLACE_DEFAULT_LOCATION || 'Mississauga, ON',
        })
      }
    }
    const payload = buildFacebookAssistPayload({
      ...rawPayload,
      ...freshVehiclePayload,
      postId: post.id,
      title: post.posting_title,
      description: post.posting_description,
      price: post.posting_price,
      location: post.posting_location,
    })
    const launchToken = buildFacebookAssistLaunchToken({
      postId,
      baseUrl: process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin,
      secret: assistTokenSecret(),
    })
    const nowIso = new Date().toISOString()
    const updateResult = await supabase
      .from('edc_facebook_marketplace_posts')
      .update({
        assist_payload: payload,
        assist_status: 'started',
        assist_started_at: nowIso,
        assist_error: null,
        updated_at: nowIso,
      })
      .eq('id', postId)

    if (updateResult.error) {
      return NextResponse.json({
        error: updateResult.error.message,
        setupRequired: setupRequired(updateResult.error.message),
      }, { status: 500, headers: noStore })
    }

    return NextResponse.json({ payload, launchToken }, { headers: noStore })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to create assist payload' }, { status: 500, headers: noStore })
  }
}

export async function PATCH(request: Request, context: { params: { id: string } }) {
  try {
    const providedLaunchToken = parseLaunchToken(request)
    if (providedLaunchToken) {
      const verification = verifyFacebookAssistLaunchToken(providedLaunchToken, new Date().toISOString(), assistTokenSecret())
      if (!verification.valid || clean(providedLaunchToken.postId) !== clean(context.params.id)) {
        return NextResponse.json({ error: 'Invalid or expired browser assistance token.' }, { status: 401, headers: noStore })
      }
    } else {
      const authError = await requireAdminSession(request)
      if (authError) return authError
    }

    const supabase = createSupabase()
    if (!supabase) return NextResponse.json({ error: 'Server not configured' }, { status: 500, headers: noStore })

    const postId = clean(context.params.id)
    if (!postId) return NextResponse.json({ error: 'Missing post id' }, { status: 400, headers: noStore })

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const assistStatus = normalizeFacebookAssistStatus(body.assistStatus)
    if (!isValidFacebookAssistStatus(assistStatus)) {
      return NextResponse.json({ error: 'Invalid assist status.' }, { status: 400, headers: noStore })
    }

    const nowIso = new Date().toISOString()
    const update: Record<string, unknown> = {
      assist_status: assistStatus,
      assist_error: clean(body.assistError) || null,
      updated_at: nowIso,
    }
    if (assistStatus === 'started') update.assist_started_at = nowIso
    if (['needs_review', 'failed', 'cancelled'].includes(assistStatus)) update.assist_completed_at = nowIso

    const result = await supabase
      .from('edc_facebook_marketplace_posts')
      .update(update)
      .eq('id', postId)
      .select('*')
      .maybeSingle()

    if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500, headers: noStore })
    if (!result.data) return NextResponse.json({ error: 'Post not found' }, { status: 404, headers: noStore })

    return NextResponse.json({ post: result.data }, { headers: noStore })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to update assist status' }, { status: 500, headers: noStore })
  }
}
