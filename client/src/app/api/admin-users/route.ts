import { NextResponse } from 'next/server'

const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '')
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const headers = {
  'Content-Type': 'application/json',
  apikey: supabaseKey,
  Authorization: `Bearer ${supabaseKey}`,
}

// GET — list all admin users
export async function GET() {
  try {
    const res = await fetch(
      `${supabaseUrl}/rest/v1/edc_admin_users?select=id,email,access_code,role,is_active,created_at&order=created_at.desc`,
      { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }, cache: 'no-store' }
    )
    const data = await res.json()
    if (!res.ok) return NextResponse.json({ error: data }, { status: res.status })
    return NextResponse.json({ users: data })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to fetch' }, { status: 500 })
  }
}

// POST — create a new admin user
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { email, access_code, role, is_active } = body
    if (!email || !access_code) return NextResponse.json({ error: 'Email and access code required' }, { status: 400 })

    const res = await fetch(`${supabaseUrl}/rest/v1/edc_admin_users`, {
      method: 'POST',
      headers: { ...headers, Prefer: 'return=representation' },
      body: JSON.stringify({ email: email.trim().toLowerCase(), access_code, role: role || 'STAFF', is_active: is_active ?? true }),
    })
    const data = await res.json()
    if (!res.ok) return NextResponse.json({ error: data?.message || JSON.stringify(data) }, { status: res.status })
    return NextResponse.json({ success: true, user: data[0] })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to create user' }, { status: 500 })
  }
}

// PATCH — update an existing admin user
export async function PATCH(req: Request) {
  try {
    const body = await req.json()
    const { id, email, access_code, role, is_active } = body
    if (!id) return NextResponse.json({ error: 'Missing user id' }, { status: 400 })

    const res = await fetch(`${supabaseUrl}/rest/v1/edc_admin_users?id=eq.${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { ...headers, Prefer: 'return=representation' },
      body: JSON.stringify({ email: email.trim().toLowerCase(), access_code, role, is_active }),
    })
    const data = await res.json()
    if (!res.ok) return NextResponse.json({ error: data?.message || JSON.stringify(data) }, { status: res.status })
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to update user' }, { status: 500 })
  }
}

// DELETE — remove an admin user
export async function DELETE(req: Request) {
  try {
    const { id } = await req.json()
    if (!id) return NextResponse.json({ error: 'Missing user id' }, { status: 400 })

    const res = await fetch(`${supabaseUrl}/rest/v1/edc_admin_users?id=eq.${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` },
    })
    if (!res.ok) {
      const text = await res.text()
      return NextResponse.json({ error: text }, { status: res.status })
    }
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to delete user' }, { status: 500 })
  }
}
