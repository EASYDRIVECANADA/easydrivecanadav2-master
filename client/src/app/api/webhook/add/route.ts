import { NextResponse } from 'next/server'

const WEBHOOK_URL = process.env.WEBHOOK_ADD_URL || 'https://primary-production-6722.up.railway.app/webhook/Add'

export async function POST(request: Request) {
  try {
    const payload = await request.json().catch(() => ({}))

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15000)

    const res = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    }).catch((e) => {
      throw new Error(`Webhook request failed: ${e?.message || 'network error'}`)
    })
    clearTimeout(timeout)

    const text = await res.text().catch(() => '')

    // Pass through status and body so the client can decide on success/failure
    return new NextResponse(text || (res.ok ? 'Done' : 'Error'), {
      status: res.status,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  } catch (err: any) {
    const msg = String(err?.message || 'Webhook proxy error')
    return new NextResponse(msg, { status: 500 })
  }
}
