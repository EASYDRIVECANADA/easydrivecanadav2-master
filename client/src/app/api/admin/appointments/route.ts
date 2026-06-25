import { NextResponse } from 'next/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { requireAdminSession } from '@/lib/apiAuth'
import {
  buildAppointmentDateRange,
  buildAppointmentSummary,
  normalizeAppointmentStatus,
  vehicleMatchesAppointmentSearch,
} from '@/lib/adminAppointments.mjs'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

const noStore = { 'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0' }
const clean = (value: unknown) => String(value ?? '').trim()

type AppointmentRecord = Record<string, unknown> & {
  vehicle_id?: string | null
}

type VehicleRecord = Record<string, unknown> & {
  id?: string | null
}

type AppointmentWithVehicle = AppointmentRecord & {
  vehicle: VehicleRecord | null
}

const createSupabase = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseKey) return null
  return createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
}

async function loadVehiclesById(supabase: SupabaseClient, vehicleIds: string[]) {
  const ids = Array.from(new Set(vehicleIds.map(clean).filter(Boolean)))
  if (ids.length === 0) return new Map<string, Record<string, unknown>>()

  const result = await supabase
    .from('edc_vehicles')
    .select('id,year,make,model,series,stock_number,vin')
    .in('id', ids)

  if (result.error) throw new Error(result.error.message)
  return new Map((result.data || []).map((vehicle: VehicleRecord) => [clean(vehicle.id), vehicle]))
}

export async function GET(request: Request) {
  try {
    const authError = await requireAdminSession(request)
    if (authError) return authError

    const supabase = createSupabase()
    if (!supabase) return NextResponse.json({ error: 'Server not configured' }, { status: 500, headers: noStore })

    const url = new URL(request.url)
    const q = clean(url.searchParams.get('q'))
    const status = clean(url.searchParams.get('status'))
    const range = clean(url.searchParams.get('range')) || 'next_7'
    const from = clean(url.searchParams.get('from'))
    const to = clean(url.searchParams.get('to'))
    const limit = Math.min(Math.max(Number(url.searchParams.get('limit') || 100), 1), 500)
    const computedRange = buildAppointmentDateRange(range)

    let query = supabase
      .from('edc_appointments')
      .select('*')
      .order('starts_at', { ascending: range !== 'past' })
      .limit(limit)

    const fromIso = from || computedRange.from
    const toIso = to || computedRange.to
    if (fromIso) query = query.gte('starts_at', fromIso)
    if (toIso) query = query.lt('starts_at', toIso)
    if (status) query = query.eq('status', normalizeAppointmentStatus(status))

    const appointmentsResult = await query
    if (appointmentsResult.error) {
      return NextResponse.json({
        error: appointmentsResult.error.message,
        setupRequired: appointmentsResult.error.message.toLowerCase().includes('edc_appointments'),
      }, { status: 500, headers: noStore })
    }

    const appointments: AppointmentRecord[] = Array.isArray(appointmentsResult.data) ? appointmentsResult.data : []
    const vehiclesById = await loadVehiclesById(supabase, appointments.map((row) => clean(row.vehicle_id)))
    const rows: AppointmentWithVehicle[] = appointments
      .map((appointment) => {
        const vehicle = vehiclesById.get(clean(appointment.vehicle_id)) || null
        return { ...appointment, vehicle }
      })
      .filter((row) => vehicleMatchesAppointmentSearch(row, row.vehicle, q))

    return NextResponse.json({
      appointments: rows,
      summary: buildAppointmentSummary(rows),
      filters: { q, status, range, from: fromIso, to: toIso, limit },
    }, { headers: noStore })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to load appointments' }, { status: 500, headers: noStore })
  }
}
