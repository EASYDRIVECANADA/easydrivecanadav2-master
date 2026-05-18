import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { buildAdminOpsTasks } from '@/lib/dealerOpsReadiness.mjs'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const createSupabase = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseKey) return null
  return createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
}

export async function GET(request: Request) {
  try {
    const supabase = createSupabase()
    if (!supabase) return NextResponse.json({ error: 'Server not configured' }, { status: 500 })

    const url = new URL(request.url)
    const userId = String(url.searchParams.get('user_id') || '').trim()
    const readinessUrl = new URL('/api/admin/inventory/readiness', url.origin)
    if (userId) readinessUrl.searchParams.set('user_id', userId)

    let submissionsQuery = supabase
      .from('edc_purchase_submissions')
      .select('*')
      .order('submitted_at', { ascending: false })
      .limit(100)
    if (userId) submissionsQuery = submissionsQuery.eq('user_id', userId)

    const [submissionsRes, leadsRes, readinessRes] = await Promise.all([
      submissionsQuery,
      supabase.from('edc_leads').select('*').order('created_at', { ascending: false }).limit(100),
      fetch(readinessUrl, { cache: 'no-store' }).then((res) => res.ok ? res.json() : { vehicles: [] }),
    ])

    if (submissionsRes.error) return NextResponse.json({ error: submissionsRes.error.message }, { status: 500 })
    if (leadsRes.error) return NextResponse.json({ error: leadsRes.error.message }, { status: 500 })

    const tasks = buildAdminOpsTasks({
      submissions: Array.isArray(submissionsRes.data) ? submissionsRes.data : [],
      vehicles: Array.isArray(readinessRes?.vehicles) ? readinessRes.vehicles : [],
      leads: Array.isArray(leadsRes.data) ? leadsRes.data : [],
      nowIso: new Date().toISOString(),
    })

    return NextResponse.json(
      {
        tasks,
        summary: {
          total: tasks.length,
          high: tasks.filter((task) => task.severity === 'high').length,
          medium: tasks.filter((task) => task.severity === 'medium').length,
          low: tasks.filter((task) => task.severity === 'low').length,
        },
      },
      { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0' } }
    )
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to load admin tasks' }, { status: 500 })
  }
}
