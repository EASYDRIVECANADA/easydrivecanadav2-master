import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  buildSchedulerSlots,
  DEFAULT_SCHEDULER_TIME_ZONE,
} from '@/lib/schedulerBooking.mjs'

export const dynamic = 'force-dynamic'

const clean = (value: unknown) => String(value ?? '').trim()

const createServerSupabase = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return null
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
}

const todayInTimeZone = (timeZone: string) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const year = clean(parts.find((part) => part.type === 'year')?.value)
  const month = clean(parts.find((part) => part.type === 'month')?.value)
  const day = clean(parts.find((part) => part.type === 'day')?.value)
  return year && month && day ? `${year}-${month}-${day}` : new Date().toISOString().slice(0, 10)
}

export async function GET(request: Request) {
  try {
    const supabase = createServerSupabase()
    if (!supabase) return NextResponse.json({ error: 'Server not configured' }, { status: 500 })

    const { searchParams } = new URL(request.url)
    const vehicleId = clean(searchParams.get('vehicleId'))
    const timeZone = clean(process.env.EASYDRIVE_SCHEDULER_TIME_ZONE) || DEFAULT_SCHEDULER_TIME_ZONE
    const fromDate = clean(searchParams.get('fromDate')) || todayInTimeZone(timeZone)

    const appointmentQuery = supabase
      .from('edc_appointments')
      .select('starts_at,status')
      .gte('starts_at', new Date().toISOString())
      .order('starts_at', { ascending: true })
      .limit(300)

    if (vehicleId) appointmentQuery.eq('vehicle_id', vehicleId)
    const appointmentsRes = await appointmentQuery
    const appointmentError = appointmentsRes.error?.message || ''
    const schedulerReady = !appointmentError
    const existingAppointments = schedulerReady ? appointmentsRes.data || [] : []

    let vehicle = null
    if (vehicleId) {
      const vehicleRes = await supabase
        .from('edc_vehicles')
        .select('id,year,make,model,series,stock_number,price,odometer,mileage,status')
        .eq('id', vehicleId)
        .maybeSingle()
      if (!vehicleRes.error) vehicle = vehicleRes.data
    }

    return NextResponse.json({
      timeZone,
      schedulerReady,
      setupError: schedulerReady ? '' : appointmentError,
      vehicle,
      slots: buildSchedulerSlots({
        fromDate,
        days: 14,
        timeZone,
        existingAppointments,
      }),
    })
  } catch (err) {
    console.error('scheduler availability error:', err)
    return NextResponse.json({ error: 'Unable to load booking availability' }, { status: 500 })
  }
}
