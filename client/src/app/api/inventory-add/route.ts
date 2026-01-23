import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))

    const res = await fetch('https://primary-production-6722.up.railway.app/webhook/Add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body ?? {}),
    })

    const text = await res.text().catch(() => '')
    const contentType = res.headers.get('content-type') || ''
    const parsed = contentType.includes('application/json') ? JSON.parse(text || '{}') : { raw: text }

    return NextResponse.json(parsed, { status: res.status })
  } catch (err) {
    console.error('inventory-add proxy error', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
