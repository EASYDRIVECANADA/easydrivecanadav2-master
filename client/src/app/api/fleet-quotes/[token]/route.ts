import { createHash } from 'node:crypto'
import { NextResponse } from 'next/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { buildFleetQuoteVehicle } from '@/lib/fleetFinanceQuotes.mjs'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

const noStore = { 'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0' }
const VEHICLE_SELECT = 'id,year,make,model,series,trim,stock_number,vin,mileage,odometer,price,finance_price,retail_price,exterior_color,image_url,main_photo,categories,inventory_type,status'
const QUOTE_SELECT = 'id,public_token,customer_name,customer_phone_last4,passcode_hash,province,apr,term_months,warranty_tier,max_selling_price,max_monthly_payment,max_biweekly_payment,hide_disqualified,suggested_vehicle_ids,selected_vehicle_ids,staff_note,unlocked_at,view_expires_at,submitted_at,expires_at,created_at,updated_at'

const clean = (value: unknown) => String(value ?? '').trim()
const digitsOnly = (value: unknown) => clean(value).replace(/\D/g, '')
const toVehicleIds = (value: unknown) =>
  Array.isArray(value)
    ? Array.from(new Set(value.map(clean).filter(Boolean))).slice(0, 3)
    : []

function createPasscodeHash(publicToken: string, phoneLast4: string) {
  return createHash('sha256').update(`${publicToken}:${phoneLast4}`).digest('hex')
}

const createSupabase = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseKey) return null
  return createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
}

const isFleetVehicle = (vehicle: Record<string, unknown>) => {
  const marker = `${vehicle.categories || ''} ${vehicle.inventory_type || ''}`.toLowerCase()
  return marker.includes('fleet')
}

async function loadQuote(supabase: SupabaseClient, token: string) {
  const result = await supabase
    .from('edc_fleet_quote_profiles')
    .select(QUOTE_SELECT)
    .eq('public_token', token)
    .maybeSingle()

  if (result.error) throw new Error(result.error.message)
  return result.data as Record<string, unknown> | null
}

function verifyPasscode(quote: Record<string, unknown>, passcode: unknown) {
  const token = clean(quote.public_token)
  const last4 = digitsOnly(passcode).slice(-4)
  return last4.length === 4 && createPasscodeHash(token, last4) === clean(quote.passcode_hash)
}

function assertQuoteAvailable(quote: Record<string, unknown> | null) {
  if (!quote) return 'Quote link was not found.'
  const expiresAt = Date.parse(clean(quote.expires_at))
  if (Number.isFinite(expiresAt) && expiresAt < Date.now()) return 'This quote link has expired.'
  return ''
}

async function loadFleetVehicles(supabase: SupabaseClient, quote: Record<string, unknown>) {
  const suggestedIds = Array.isArray(quote.suggested_vehicle_ids) ? quote.suggested_vehicle_ids.map(clean).filter(Boolean) : []
  let query = supabase
    .from('edc_vehicles')
    .select(VEHICLE_SELECT)
    .order('created_at', { ascending: false })
    .limit(500)

  if (suggestedIds.length > 0) query = query.in('id', suggestedIds)
  const result = await query
  if (result.error) throw new Error(result.error.message)

  const terms = {
    province: quote.province,
    apr: quote.apr,
    termMonths: quote.term_months,
    warrantyTier: quote.warranty_tier,
  }
  const rows = Array.isArray(result.data) ? result.data : []
  return rows.filter(isFleetVehicle).map((vehicle) => buildFleetQuoteVehicle(vehicle, terms))
}

const quoteResponse = (quote: Record<string, unknown>) => ({
  publicToken: quote.public_token,
  customerName: quote.customer_name,
  province: quote.province,
  apr: quote.apr,
  termMonths: quote.term_months,
  warrantyTier: quote.warranty_tier,
  maxSellingPrice: quote.max_selling_price,
  maxMonthlyPayment: quote.max_monthly_payment,
  maxBiweeklyPayment: quote.max_biweekly_payment,
  hideDisqualified: quote.hide_disqualified,
  suggestedVehicleIds: quote.suggested_vehicle_ids || [],
  selectedVehicleIds: quote.selected_vehicle_ids || [],
  submittedAt: quote.submitted_at,
  expiresAt: quote.expires_at,
})

export async function POST(request: Request, { params }: { params: { token: string } }) {
  try {
    const supabase = createSupabase()
    if (!supabase) return NextResponse.json({ error: 'Server not configured' }, { status: 500, headers: noStore })

    const token = clean(params.token)
    const body = await request.json().catch(() => ({}))
    const quote = await loadQuote(supabase, token)
    const unavailable = assertQuoteAvailable(quote)
    if (unavailable) return NextResponse.json({ error: unavailable }, { status: 404, headers: noStore })
    if (!verifyPasscode(quote!, body?.passcode)) {
      return NextResponse.json({ error: 'Enter the last 4 digits of the customer phone number.' }, { status: 401, headers: noStore })
    }

    const nowIso = new Date().toISOString()
    const viewExpiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString()
    await supabase
      .from('edc_fleet_quote_profiles')
      .update({ unlocked_at: nowIso, view_expires_at: viewExpiresAt, updated_at: nowIso })
      .eq('public_token', token)

    return NextResponse.json({
      quote: { ...quoteResponse(quote!), unlockedAt: nowIso, viewExpiresAt },
      vehicles: await loadFleetVehicles(supabase, quote!),
    }, { headers: noStore })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unable to open fleet quote' }, { status: 500, headers: noStore })
  }
}

export async function PATCH(request: Request, { params }: { params: { token: string } }) {
  try {
    const supabase = createSupabase()
    if (!supabase) return NextResponse.json({ error: 'Server not configured' }, { status: 500, headers: noStore })

    const token = clean(params.token)
    const body = await request.json().catch(() => ({}))
    const quote = await loadQuote(supabase, token)
    const unavailable = assertQuoteAvailable(quote)
    if (unavailable) return NextResponse.json({ error: unavailable }, { status: 404, headers: noStore })
    if (!verifyPasscode(quote!, body?.passcode)) {
      return NextResponse.json({ error: 'Enter the last 4 digits of the customer phone number.' }, { status: 401, headers: noStore })
    }

    const selectedVehicleIds = toVehicleIds(body?.selectedVehicleIds)
    if (selectedVehicleIds.length === 0) {
      return NextResponse.json({ error: 'Select at least one vehicle.' }, { status: 400, headers: noStore })
    }

    const nowIso = new Date().toISOString()
    const result = await supabase
      .from('edc_fleet_quote_profiles')
      .update({ selected_vehicle_ids: selectedVehicleIds, submitted_at: nowIso, updated_at: nowIso })
      .eq('public_token', token)
      .select(QUOTE_SELECT)
      .single()

    if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500, headers: noStore })
    return NextResponse.json({ quote: quoteResponse(result.data) }, { headers: noStore })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unable to submit fleet selections' }, { status: 500, headers: noStore })
  }
}
