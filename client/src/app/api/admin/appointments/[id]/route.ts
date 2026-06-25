import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAdminSession } from '@/lib/apiAuth'
import { isValidAppointmentStatus, normalizeAppointmentStatus } from '@/lib/adminAppointments.mjs'

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

export async function PATCH(request: Request, context: { params: { id: string } }) {
  try {
    const authError = await requireAdminSession(request)
    if (authError) return authError

    const supabase = createSupabase()
    if (!supabase) return NextResponse.json({ error: 'Server not configured' }, { status: 500, headers: noStore })

    const appointmentId = clean(context.params.id)
    if (!appointmentId) return NextResponse.json({ error: 'Appointment ID is required.' }, { status: 400, headers: noStore })

    const body = await request.json().catch(() => ({}))
    const status = normalizeAppointmentStatus(body?.status)
    if (!isValidAppointmentStatus(status)) {
      return NextResponse.json({ error: 'Status must be booked, completed, cancelled, or no_show.' }, { status: 400, headers: noStore })
    }

    const result = await supabase
      .from('edc_appointments')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', appointmentId)
      .select('*')
      .single()

    if (result.error) {
      return NextResponse.json({
        error: result.error.message,
        setupRequired: result.error.message.toLowerCase().includes('edc_appointments'),
      }, { status: 500, headers: noStore })
    }

    return NextResponse.json({ appointment: result.data }, { headers: noStore })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to update appointment' }, { status: 500, headers: noStore })
  }
}
