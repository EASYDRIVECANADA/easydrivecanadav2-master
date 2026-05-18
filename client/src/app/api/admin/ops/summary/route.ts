import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { scoreDealReadiness } from '@/lib/dealerOpsReadiness.mjs'

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

type Row = Record<string, unknown>
type OpsTask = { type?: string }

const statusIs = (row: Row, value: string) =>
  String(row?.status || '').trim().toLowerCase() === value

const withinDays = (value: unknown, days: number) => {
  const ts = Date.parse(String(value || ''))
  if (!Number.isFinite(ts)) return false
  return Date.now() - ts <= days * 24 * 60 * 60 * 1000
}

export async function GET(request: Request) {
  try {
    const supabase = createSupabase()
    if (!supabase) return NextResponse.json({ error: 'Server not configured' }, { status: 500 })

    const url = new URL(request.url)
    const userId = String(url.searchParams.get('user_id') || '').trim()
    const readinessUrl = new URL('/api/admin/inventory/readiness', url.origin)
    const tasksUrl = new URL('/api/admin/ops/tasks', url.origin)
    if (userId) {
      readinessUrl.searchParams.set('user_id', userId)
      tasksUrl.searchParams.set('user_id', userId)
    }

    let submissionsQuery = supabase
      .from('edc_purchase_submissions')
      .select('*')
      .order('submitted_at', { ascending: false })
      .limit(100)
    if (userId) submissionsQuery = submissionsQuery.eq('user_id', userId)

    const [submissionsRes, readinessRes, tasksRes] = await Promise.all([
      submissionsQuery,
      fetch(readinessUrl, { cache: 'no-store' }).then((res) => res.ok ? res.json() : { vehicles: [], readiness: [], summary: {} }),
      fetch(tasksUrl, { cache: 'no-store' }).then((res) => res.ok ? res.json() : { tasks: [], summary: {} }),
    ])

    if (submissionsRes.error) return NextResponse.json({ error: submissionsRes.error.message }, { status: 500 })

    const submissions = Array.isArray(submissionsRes.data) ? submissionsRes.data : []
    const dealReadiness = submissions.map((submission) => scoreDealReadiness(submission))
    const approved = submissions.filter((row) => statusIs(row, 'approved'))
    const documentIssues = approved.filter((row) => {
      const packageStatus = String(row?.document_package_status || '').trim().toLowerCase()
      return packageStatus === 'failed' || !row?.document_package_token || !row?.bos_pdf_url
    })
    const recentlySold = Array.isArray(readinessRes?.vehicles)
      ? (readinessRes.vehicles as Row[]).filter((vehicle) => String(vehicle?.status || '').trim().toLowerCase() === 'sold' && withinDays(vehicle?.updated_at || vehicle?.created_at, 7)).length
      : 0

    return NextResponse.json(
      {
        cards: [
          { key: 'newSubmissions', label: 'New checkouts', value: submissions.filter((row) => ['submitted', 'pending', 'new'].includes(String(row?.status || '').trim().toLowerCase())).length },
          { key: 'stagedSubmissions', label: 'Staged', value: submissions.filter((row) => statusIs(row, 'staged')).length },
          { key: 'approvedSubmissions', label: 'Approved', value: approved.length },
          { key: 'declinedSubmissions', label: 'Declined', value: submissions.filter((row) => statusIs(row, 'declined')).length },
          { key: 'documentIssues', label: 'Document issues', value: documentIssues.length },
          { key: 'missingCarfax', label: 'Missing CARFAX', value: readinessRes?.summary?.missingCarfax || 0 },
          { key: 'missingPhotos', label: 'Missing photos', value: readinessRes?.summary?.missingPhotos || 0 },
          { key: 'staleLeads', label: 'Stale leads', value: Array.isArray(tasksRes?.tasks) ? (tasksRes.tasks as OpsTask[]).filter((task) => task.type === 'stale_lead').length : 0 },
          { key: 'recentlySold', label: 'Sold this week', value: recentlySold },
        ],
        inventory: readinessRes?.summary || {},
        tasks: tasksRes?.summary || {},
        dealReadiness: {
          total: dealReadiness.length,
          ready: dealReadiness.filter((item) => item.score === 100).length,
          needsReview: dealReadiness.filter((item) => item.score < 100).length,
          averageScore: dealReadiness.length
            ? Math.round(dealReadiness.reduce((sum, item) => sum + item.score, 0) / dealReadiness.length)
            : 0,
        },
      },
      { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0' } }
    )
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to load ops summary' }, { status: 500 })
  }
}
