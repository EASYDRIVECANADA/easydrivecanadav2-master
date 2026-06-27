import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAdminSession } from '@/lib/apiAuth'
import { buildAdminAppointmentUpdatePayload, isValidAppointmentStatus, normalizeAppointmentStatus } from '@/lib/adminAppointments.mjs'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

const noStore = { 'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0' }
const clean = (value: unknown) => String(value ?? '').trim()

const createSupabase = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseKey) return null
  return createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
}

const isDuplicateBookedSlotError = (error: unknown) => {
  const record = error as { code?: string; message?: string }
  return record?.code === '23505' || /edc_appointments_booked_starts_at_unique_idx|duplicate key/i.test(clean(record?.message))
}

export async function PATCH(request: Request, context: { params: { id: string } }) {
  try {
    const authError = await requireAdminSession(request)
    if (authError) return authError

    const supabase = createSupabase()
    if (!supabase) return NextResponse.json({ error: 'Server not configured' }, { status: 500, headers: noStore })

    const appointmentId = clean(context.params.id)
    if (!appointmentId) return NextResponse.json({ error: 'Appointment ID is required.' }, { status: 400, headers: noStore })

    const body = await request.json().catch(() => ({}))
    const status = body?.status == null ? '' : normalizeAppointmentStatus(body?.status)
    if (status && !isValidAppointmentStatus(status)) {
      return NextResponse.json({ error: 'Status must be booked, completed, cancelled, or no_show.' }, { status: 400, headers: noStore })
    }
    const startsAt = clean(body?.startsAt)
    if (startsAt && Number.isNaN(Date.parse(startsAt))) {
      return NextResponse.json({ error: 'Select a valid appointment time.' }, { status: 400, headers: noStore })
    }

    const currentResult = await supabase
      .from('edc_appointments')
      .select('id,starts_at,status')
      .eq('id', appointmentId)
      .single()

    if (currentResult.error) {
      return NextResponse.json({
        error: currentResult.error.message,
        setupRequired: currentResult.error.message.toLowerCase().includes('edc_appointments'),
      }, { status: 500, headers: noStore })
    }

    const nextStatus = status || clean(currentResult.data?.status)
    const nextStartsAt = startsAt ? new Date(startsAt).toISOString() : clean(currentResult.data?.starts_at)
    if (nextStatus === 'booked' && nextStartsAt) {
      const conflictResult = await supabase
        .from('edc_appointments')
        .select('id')
        .eq('starts_at', nextStartsAt)
        .eq('status', 'booked')
        .neq('id', appointmentId)
        .limit(1)

      if (conflictResult.error) return NextResponse.json({ error: conflictResult.error.message }, { status: 500, headers: noStore })
      if ((conflictResult.data || []).length > 0) {
        return NextResponse.json({ error: 'That time is already booked. Choose another slot.' }, { status: 409, headers: noStore })
      }
    }

    const updateInput = { ...body }
    if (status) updateInput.status = status
    else delete updateInput.status

    const result = await supabase
      .from('edc_appointments')
      .update(buildAdminAppointmentUpdatePayload(updateInput))
      .eq('id', appointmentId)
      .select('*')
      .single()

    if (result.error) {
      return NextResponse.json({
        error: isDuplicateBookedSlotError(result.error) ? 'That time is already booked. Choose another slot.' : result.error.message,
        setupRequired: result.error.message.toLowerCase().includes('edc_appointments'),
      }, { status: isDuplicateBookedSlotError(result.error) ? 409 : 500, headers: noStore })
    }

    return NextResponse.json({ appointment: result.data }, { headers: noStore })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to update appointment' }, { status: 500, headers: noStore })
  }
}
