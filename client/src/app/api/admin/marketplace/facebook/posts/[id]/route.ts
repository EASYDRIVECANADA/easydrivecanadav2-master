import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAdminSession } from '@/lib/apiAuth'
import { isValidFacebookListingUrl, normalizeFacebookListingUrl } from '@/lib/facebookMarketplacePosting.mjs'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

const noStore = { 'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0' }
const allowedStatuses = new Set(['draft', 'ready', 'posted', 'needs_update', 'sold_remove', 'skipped', 'failed'])
const clean = (value: unknown) => String(value ?? '').trim()

const createSupabase = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseKey) return null
  return createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
}

export async function PATCH(request: Request, context: { params: { id: string } }) {
  try {
    const authError = await requireAdminSession(request)
    if (authError) return authError

    const supabase = createSupabase()
    if (!supabase) return NextResponse.json({ error: 'Server not configured' }, { status: 500, headers: noStore })

    const id = clean(context.params.id)
    if (!id) return NextResponse.json({ error: 'Missing post id' }, { status: 400, headers: noStore })

    const body = await request.json().catch(() => ({}))
    const status = clean(body?.status)
    const update: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }

    const normalizedListingUrl = 'facebookListingUrl' in body ? normalizeFacebookListingUrl(body.facebookListingUrl) : ''

    if ('facebookListingUrl' in body && clean(body.facebookListingUrl) && !isValidFacebookListingUrl(body.facebookListingUrl)) {
      return NextResponse.json({ error: 'Enter a valid Facebook Marketplace listing URL.' }, { status: 400, headers: noStore })
    }

    if (status) {
      if (!allowedStatuses.has(status)) return NextResponse.json({ error: 'Invalid status' }, { status: 400, headers: noStore })
      if (status === 'posted' && !normalizedListingUrl) {
        return NextResponse.json({ error: 'Paste the Facebook Marketplace listing URL before marking posted.' }, { status: 400, headers: noStore })
      }
      update.status = status
      if (status === 'posted' && !clean(body?.postedAt)) update.posted_at = new Date().toISOString()
    }

    if ('facebookListingUrl' in body) update.facebook_listing_url = normalizedListingUrl || null
    if ('title' in body) update.posting_title = clean(body.title) || null
    if ('description' in body) update.posting_description = clean(body.description) || null
    if ('price' in body) update.posting_price = Number(body.price) || null
    if ('location' in body) update.posting_location = clean(body.location) || null
    if ('notes' in body) update.notes = clean(body.notes) || null

    const { data, error } = await supabase
      .from('edc_facebook_marketplace_posts')
      .update(update)
      .eq('id', id)
      .select('*')
      .maybeSingle()

    if (error) return NextResponse.json({ error: error.message }, { status: 500, headers: noStore })
    if (!data) return NextResponse.json({ error: 'Post not found' }, { status: 404, headers: noStore })
    return NextResponse.json({ post: data }, { headers: noStore })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to update Facebook post' }, { status: 500, headers: noStore })
  }
}
