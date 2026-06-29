import { createHash, randomUUID } from 'node:crypto'
import { NextResponse } from 'next/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { requireAdminSession } from '@/lib/apiAuth'
import {
  DEFAULT_APR,
  DEFAULT_PROVINCE,
  DEFAULT_TERM_MONTHS,
  DEFAULT_WARRANTY_TIER,
  buildFleetQuoteVehicle,
} from '@/lib/fleetFinanceQuotes.mjs'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

const noStore = { 'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0' }
const VEHICLE_SELECT = 'id,year,make,model,series,trim,stock_number,vin,mileage,odometer,price,finance_price,retail_price,exterior_color,image_url,main_photo,categories,inventory_type,status'
const QUOTE_SELECT = 'id,public_token,customer_name,customer_phone_last4,province,apr,term_months,warranty_tier,max_selling_price,max_monthly_payment,max_biweekly_payment,hide_disqualified,suggested_vehicle_ids,selected_vehicle_ids,staff_note,unlocked_at,view_expires_at,submitted_at,expires_at,created_at,updated_at'

const clean = (value: unknown) => String(value ?? '').trim()
const digitsOnly = (value: unknown) => clean(value).replace(/\D/g, '')
const toNumber = (value: unknown, fallback = 0) => {
  const num = Number(clean(value).replace(/[$,\s]/g, ''))
  return Number.isFinite(num) ? num : fallback
}
const toBool = (value: unknown) => value === true || clean(value).toLowerCase() === 'true'
const toVehicleIds = (value: unknown) =>
  Array.isArray(value)
    ? Array.from(new Set(value.map(clean).filter(Boolean))).slice(0, 12)
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

async function loadFleetVehicles(supabase: SupabaseClient, terms: Record<string, unknown>) {
  const result = await supabase
    .from('edc_vehicles')
    .select(VEHICLE_SELECT)
    .order('created_at', { ascending: false })
    .limit(500)

  if (result.error) throw new Error(result.error.message)

  return (Array.isArray(result.data) ? result.data : [])
    .filter(isFleetVehicle)
    .map((vehicle) => buildFleetQuoteVehicle(vehicle, terms))
}

const quoteResponse = (row: Record<string, unknown>) => ({
  id: row.id,
  publicToken: row.public_token,
  customerName: row.customer_name,
  customerPhoneLast4: row.customer_phone_last4,
  province: row.province,
  apr: row.apr,
  termMonths: row.term_months,
  warrantyTier: row.warranty_tier,
  maxSellingPrice: row.max_selling_price,
  maxMonthlyPayment: row.max_monthly_payment,
  maxBiweeklyPayment: row.max_biweekly_payment,
  hideDisqualified: row.hide_disqualified,
  suggestedVehicleIds: row.suggested_vehicle_ids || [],
  selectedVehicleIds: row.selected_vehicle_ids || [],
  staffNote: row.staff_note,
  unlockedAt: row.unlocked_at,
  viewExpiresAt: row.view_expires_at,
  submittedAt: row.submitted_at,
  expiresAt: row.expires_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  quoteUrl: `${clean(process.env.NEXT_PUBLIC_SITE_URL || 'https://easydrivecanada.com').replace(/\/+$/, '')}/fleet-quote/${row.public_token}`,
})

export async function GET(request: Request) {
  try {
    const authError = await requireAdminSession(request)
    if (authError) return authError

    const supabase = createSupabase()
    if (!supabase) return NextResponse.json({ error: 'Server not configured' }, { status: 500, headers: noStore })

    const url = new URL(request.url)
    const province = clean(url.searchParams.get('province')) || DEFAULT_PROVINCE
    const apr = toNumber(url.searchParams.get('apr'), DEFAULT_APR)
    const termMonths = Math.round(toNumber(url.searchParams.get('termMonths'), DEFAULT_TERM_MONTHS))
    const warrantyTier = clean(url.searchParams.get('warrantyTier')) || DEFAULT_WARRANTY_TIER

    const [vehicles, quotesResult] = await Promise.all([
      loadFleetVehicles(supabase, { province, apr, termMonths, warrantyTier }),
      supabase
        .from('edc_fleet_quote_profiles')
        .select(QUOTE_SELECT)
        .order('created_at', { ascending: false })
        .limit(50),
    ])

    if (quotesResult.error) {
      return NextResponse.json({
        error: quotesResult.error.message,
        setupRequired: quotesResult.error.message.toLowerCase().includes('edc_fleet_quote_profiles'),
      }, { status: 500, headers: noStore })
    }

    return NextResponse.json({
      vehicles,
      quotes: (quotesResult.data || []).map(quoteResponse),
      terms: { province, apr, termMonths, warrantyTier },
    }, { headers: noStore })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to load fleet quote data' }, { status: 500, headers: noStore })
  }
}

export async function POST(request: Request) {
  try {
    const authError = await requireAdminSession(request)
    if (authError) return authError

    const supabase = createSupabase()
    if (!supabase) return NextResponse.json({ error: 'Server not configured' }, { status: 500, headers: noStore })

    const body = await request.json().catch(() => ({}))
    const customerName = clean(body?.customerName)
    const phoneDigits = digitsOnly(body?.customerPhone)
    const customerPhoneLast4 = phoneDigits.slice(-4)
    if (!customerName || customerPhoneLast4.length !== 4) {
      return NextResponse.json({ error: 'Enter a customer name and phone number with at least 4 digits.' }, { status: 400, headers: noStore })
    }

    const publicToken = randomUUID()
    const insert = {
      public_token: publicToken,
      customer_name: customerName,
      customer_phone_last4: customerPhoneLast4,
      passcode_hash: createPasscodeHash(publicToken, customerPhoneLast4),
      province: clean(body?.province) || DEFAULT_PROVINCE,
      apr: toNumber(body?.apr, DEFAULT_APR),
      term_months: Math.round(toNumber(body?.termMonths, DEFAULT_TERM_MONTHS)),
      warranty_tier: clean(body?.warrantyTier) || DEFAULT_WARRANTY_TIER,
      max_selling_price: toNumber(body?.maxSellingPrice) || null,
      max_monthly_payment: toNumber(body?.maxMonthlyPayment) || null,
      max_biweekly_payment: toNumber(body?.maxBiweeklyPayment) || null,
      hide_disqualified: toBool(body?.hideDisqualified),
      suggested_vehicle_ids: toVehicleIds(body?.suggestedVehicleIds),
      staff_note: clean(body?.staffNote) || null,
    }

    const result = await supabase
      .from('edc_fleet_quote_profiles')
      .insert(insert)
      .select(QUOTE_SELECT)
      .single()

    if (result.error) {
      return NextResponse.json({
        error: result.error.message,
        setupRequired: result.error.message.toLowerCase().includes('edc_fleet_quote_profiles'),
      }, { status: 500, headers: noStore })
    }

    return NextResponse.json({ quote: quoteResponse(result.data) }, { status: 201, headers: noStore })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to create fleet quote' }, { status: 500, headers: noStore })
  }
}
