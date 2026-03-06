import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  try {
    const url = 'https://primary-production-6722.up.railway.app/webhook/import'

    const incoming = await req.formData()
    const file = incoming.get('file')
    const email = String(incoming.get('email') || '').trim().toLowerCase()

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Missing file' }, { status: 400 })
    }

    const ab = await file.arrayBuffer()
    const b64 = Buffer.from(ab).toString('base64')

    let userId = ''
    let role = ''
    if (email) {
      try {
        const supabaseUrl = String(process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '')
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
        if (supabaseUrl && supabaseKey) {
          const q = `${supabaseUrl}/rest/v1/users?select=id,user_id,role&email=ilike.${encodeURIComponent(email)}&limit=1`
          const r = await fetch(q, {
            method: 'GET',
            headers: {
              apikey: supabaseKey,
              Authorization: `Bearer ${supabaseKey}`,
            },
          })
          const t = await r.text()
          if (r.ok) {
            let rows: any[] = []
            try {
              rows = JSON.parse(t)
            } catch {
              rows = []
            }
            const row = rows?.[0]
            userId = String(row?.user_id ?? row?.id ?? '').trim()
            role = String(row?.role ?? '').trim()
          }
        }
      } catch {
        userId = ''
        role = ''
      }
    }

    const payload = {
      email: email || undefined,
      user_id: userId || undefined,
      role: role || undefined,
      filename: file.name || undefined,
      mime_type: file.type || undefined,
      file_b64: b64,
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    const text = await res.text().catch(() => '')

    if (!res.ok) {
      return NextResponse.json(
        {
          error: 'Import webhook request failed',
          status: res.status,
          details: text,
        },
        { status: 502 }
      )
    }

    const isDone = /\bdone\b/i.test(text || '')
    if (!isDone) {
      return NextResponse.json(
        {
          error: 'Import webhook did not return Done',
          details: text,
        },
        { status: 502 }
      )
    }

    return NextResponse.json({ ok: true, details: text })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to upload import file' }, { status: 500 })
  }
}
