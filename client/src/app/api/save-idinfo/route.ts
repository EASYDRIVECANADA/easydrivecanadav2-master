import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const email = String((body as any)?.email || '').trim().toLowerCase()
    const gmail = String((body as any)?.gmail || email).trim().toLowerCase()
    const full_name = String((body as any)?.full_name || '').trim()
    const address = String((body as any)?.address || '').trim()
    const license_number = String((body as any)?.license_number || '').trim()
    const b64 = String((body as any)?.b64 || '').trim()

    if (!email) return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    if (!gmail) return NextResponse.json({ error: 'Gmail is required' }, { status: 400 })
    if (!full_name) return NextResponse.json({ error: 'Full name is required' }, { status: 400 })
    if (!address) return NextResponse.json({ error: 'Address is required' }, { status: 400 })
    if (!license_number) return NextResponse.json({ error: 'License number is required' }, { status: 400 })
    if (!b64) return NextResponse.json({ error: 'b64 is required' }, { status: 400 })

    const res = await fetch('https://primary-production-6722.up.railway.app/webhook/saveIDinfo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, gmail, full_name, address, license_number, b64 }),
    })

    const text = await res.text().catch(() => '')
    let parsed: any = null
    try {
      parsed = text ? JSON.parse(text) : null
    } catch {
      parsed = null
    }

    if (!res.ok) {
      return NextResponse.json(
        {
          error: text || `Webhook error (${res.status})`,
          upstreamStatus: res.status,
          upstreamBody: text,
          upstreamJson: parsed,
        },
        { status: 502 }
      )
    }

    return NextResponse.json(
      {
        ok: true,
        upstreamStatus: res.status,
        upstreamBody: text,
        upstreamJson: parsed,
      },
      { status: 200 }
    )
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Request failed' }, { status: 500 })
  }
}
