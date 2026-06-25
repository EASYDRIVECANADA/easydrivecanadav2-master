import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  buildAppointmentInsertPayload,
  buildAppointmentLeadPayload,
  DEFAULT_APPOINTMENT_DURATION_MINUTES,
  DEFAULT_SCHEDULER_TIME_ZONE,
} from '@/lib/schedulerBooking.mjs'

export const dynamic = 'force-dynamic'

const clean = (value: unknown) => String(value ?? '').trim()
const lower = (value: unknown) => clean(value).toLowerCase()

const createServerSupabase = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return null
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
}

export async function POST(request: Request) {
  try {
    const supabase = createServerSupabase()
    if (!supabase) return NextResponse.json({ error: 'Server not configured' }, { status: 500 })

    const body = await request.json().catch(() => ({}))
    const vehicleId = clean(body?.vehicleId)
    const startsAt = clean(body?.startsAt)
    const appointmentType = clean(body?.appointmentType) || 'test_drive'
    const source = clean(body?.source) || 'website'
    const timeZone = clean(body?.timeZone || process.env.EASYDRIVE_SCHEDULER_TIME_ZONE) || DEFAULT_SCHEDULER_TIME_ZONE
    const durationMinutes = Number(body?.durationMinutes || DEFAULT_APPOINTMENT_DURATION_MINUTES)
    const customer = {
      firstName: clean(body?.firstName),
      lastName: clean(body?.lastName),
      email: lower(body?.email),
      phone: clean(body?.phone),
    }
    const note = clean(body?.note)

    if (!startsAt || Number.isNaN(Date.parse(startsAt))) {
      return NextResponse.json({ error: 'Select a valid appointment time.' }, { status: 400 })
    }
    if (Date.parse(startsAt) <= Date.now()) {
      return NextResponse.json({ error: 'Select a future appointment time.' }, { status: 400 })
    }
    if (!customer.firstName || (!customer.email && !customer.phone)) {
      return NextResponse.json({ error: 'Enter your first name and either email or phone.' }, { status: 400 })
    }

    let vehicle: Record<string, unknown> = {}
    if (vehicleId) {
      const vehicleRes = await supabase
        .from('edc_vehicles')
        .select('id,year,make,model,series,stock_number')
        .eq('id', vehicleId)
        .maybeSingle()
      if (vehicleRes.error) return NextResponse.json({ error: vehicleRes.error.message }, { status: 500 })
      vehicle = vehicleRes.data || { id: vehicleId }
    }

    const conflictRes = await supabase
      .from('edc_appointments')
      .select('id')
      .eq('starts_at', startsAt)
      .eq('status', 'booked')
      .limit(1)
    if (conflictRes.error) return NextResponse.json({ error: conflictRes.error.message }, { status: 500 })
    if ((conflictRes.data || []).length > 0) {
      return NextResponse.json({ error: 'That time was just booked. Please choose another slot.' }, { status: 409 })
    }

    const leadPayload = buildAppointmentLeadPayload({
      ...customer,
      appointmentType,
      startsAt,
      vehicle,
      source,
      note,
    })
    const leadRes = await supabase
      .from('edc_leads')
      .insert(leadPayload)
      .select('id')
      .single()
    if (leadRes.error) return NextResponse.json({ error: leadRes.error.message }, { status: 500 })

    const appointmentPayload = buildAppointmentInsertPayload({
      leadId: leadRes.data?.id,
      vehicleId,
      appointmentType,
      source,
      ...customer,
      note,
      startsAt,
      durationMinutes,
      timeZone,
    })
    const appointmentRes = await supabase
      .from('edc_appointments')
      .insert(appointmentPayload)
      .select('id,public_token')
      .single()
    if (appointmentRes.error) return NextResponse.json({ error: appointmentRes.error.message }, { status: 500 })

    return NextResponse.json({
      ok: true,
      leadId: leadRes.data.id,
      appointmentId: appointmentRes.data.id,
      publicToken: appointmentRes.data.public_token,
      startsAt: appointmentPayload.starts_at,
      endsAt: appointmentPayload.ends_at,
      timeZone,
      googleSyncStatus: appointmentPayload.google_sync_status,
    }, { status: 201 })
  } catch (err) {
    console.error('scheduler booking error:', err)
    return NextResponse.json({ error: 'Unable to book appointment' }, { status: 500 })
  }
}
