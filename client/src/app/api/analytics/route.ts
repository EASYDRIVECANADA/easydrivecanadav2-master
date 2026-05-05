import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

const getSupabase = () => {
  const url = String(process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '')
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  if (!url || !key) throw new Error('Supabase not configured')
  return { url, key }
}

// POST /api/analytics — record a page view
export async function POST(req: Request) {
  try {
    const { session_id, path } = await req.json()
    if (!session_id || !path) return NextResponse.json({ ok: false }, { status: 400 })

    const { url, key } = getSupabase()
    await fetch(`${url}/rest/v1/edc_page_views`, {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({ session_id, path, visited_at: new Date().toISOString() }),
    })

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}

// GET /api/analytics — return visitor stats
export async function GET() {
  try {
    const { url, key } = getSupabase()
    const headers = {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    }

    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
    const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6).toISOString()

    // Today's unique sessions
    const todayRes = await fetch(
      `${url}/rest/v1/edc_page_views?visited_at=gte.${todayStart}&select=session_id`,
      { headers }
    )
    const todayRows: { session_id: string }[] = todayRes.ok ? await todayRes.json() : []
    const todayVisitors = new Set(todayRows.map((r) => r.session_id)).size

    // Last 7 days unique sessions
    const weekRes = await fetch(
      `${url}/rest/v1/edc_page_views?visited_at=gte.${weekStart}&select=session_id`,
      { headers }
    )
    const weekRows: { session_id: string }[] = weekRes.ok ? await weekRes.json() : []
    const weekVisitors = new Set(weekRows.map((r) => r.session_id)).size

    // All-time unique sessions
    const totalRes = await fetch(
      `${url}/rest/v1/edc_page_views?select=session_id`,
      { headers }
    )
    const totalRows: { session_id: string }[] = totalRes.ok ? await totalRes.json() : []
    const totalVisitors = new Set(totalRows.map((r) => r.session_id)).size

    return NextResponse.json({ todayVisitors, weekVisitors, totalVisitors })
  } catch {
    return NextResponse.json({ todayVisitors: 0, weekVisitors: 0, totalVisitors: 0 }, { status: 500 })
  }
}
