import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const { vin } = body || {}

    if (!vin || typeof vin !== 'string' || vin.trim().length < 5) {
      return NextResponse.json({ error: 'Invalid VIN' }, { status: 400 })
    }

    const res = await fetch('https://primary-production-6722.up.railway.app/webhook/Vincode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vin: vin.trim() }),
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      return NextResponse.json({ error: text || `Upstream responded ${res.status}` }, { status: 502 })
    }
    const json = await res.json().catch(async () => {
      const text = await res.text().catch(() => '')
      return text ? { raw: text } : { ok: true }
    })
    return NextResponse.json(json)
  } catch (err) {
    console.error('vincode proxy error', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
