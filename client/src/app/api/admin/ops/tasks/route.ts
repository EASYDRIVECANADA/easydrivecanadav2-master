import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { buildAdminOpsTasks } from '@/lib/dealerOpsReadiness.mjs'
import { scopePurchaseSubmissionQueryForUser } from '@/lib/dealerOpsSubmissionScope.mjs'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type Row = Record<string, unknown>
type SupabaseRowsResponse = { data: Row[] | null; error: { message?: string } | null }
type OpsTask = { severity?: string }
type BuildAdminOpsTasks = (input: { submissions: Row[]; vehicles: Row[]; leads: Row[]; nowIso: string }) => OpsTask[]

const buildTasks = buildAdminOpsTasks as unknown as BuildAdminOpsTasks

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
    const scopedSubmissions = await scopePurchaseSubmissionQueryForUser(supabase, submissionsQuery, userId)

    const emptySubmissionsRes: SupabaseRowsResponse = { data: [], error: null }
    const [rawSubmissionsRes, leadsRes, readinessRes] = await Promise.all([
      scopedSubmissions.empty ? Promise.resolve(emptySubmissionsRes) : scopedSubmissions.query,
      supabase.from('edc_leads').select('*').order('created_at', { ascending: false }).limit(100),
      fetch(readinessUrl, { cache: 'no-store' }).then((res) => res.ok ? res.json() : { vehicles: [] }),
    ])

    const submissionsRes = rawSubmissionsRes as SupabaseRowsResponse
    if (submissionsRes.error) return NextResponse.json({ error: submissionsRes.error.message }, { status: 500 })
    if (leadsRes.error) return NextResponse.json({ error: leadsRes.error.message }, { status: 500 })

    const submissions: Row[] = Array.isArray(submissionsRes.data) ? submissionsRes.data : []
    const vehicles: Row[] = Array.isArray(readinessRes?.vehicles) ? readinessRes.vehicles : []
    const leads: Row[] = Array.isArray(leadsRes.data) ? leadsRes.data : []
    const tasks = buildTasks({
      submissions,
      vehicles,
      leads,
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
