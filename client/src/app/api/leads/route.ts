import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    })

    const source = String(body?.source || 'unknown').trim()

    // Map both contact_form and financing_application payloads into edc_leads columns
    const insert: Record<string, any> = {
      source,
      email: String(body?.email || '').trim().toLowerCase() || null,
      phone: String(body?.phone || '').trim() || null,
      message: String(body?.message || '').trim() || null,
      created_at: new Date().toISOString(),
    }

    if (source === 'contact_form') {
      insert.first_name = String(body?.name || '').trim().split(' ')[0] || null
      insert.last_name = String(body?.name || '').trim().split(' ').slice(1).join(' ') || null
      insert.subject = String(body?.subject || '').trim() || null
    }

    if (source === 'financing_application') {
      insert.first_name = String(body?.firstName || '').trim() || null
      insert.last_name = String(body?.lastName || '').trim() || null
      insert.date_of_birth = String(body?.dateOfBirth || '').trim() || null
      insert.monthly_income = body?.annualIncome ? Math.round(Number(body.annualIncome) / 12) : null
      insert.street_address = String(body?.streetAddress || '').trim() || null
      insert.city = String(body?.city || '').trim() || null
      insert.province = String(body?.province || '').trim() || null
      insert.postal_code = String(body?.postalCode || '').trim() || null
    }

    const { error } = await supabase.from('edc_leads').insert(insert)

    if (error) {
      console.error('leads insert error:', error)
      return NextResponse.json({ error: 'Failed to save lead' }, { status: 500 })
    }

    return NextResponse.json({ ok: true }, { status: 201 })
  } catch (err) {
    console.error('leads route error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
