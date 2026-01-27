import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))

    const res = await fetch('https://primary-production-6722.up.railway.app/webhook/costs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body ?? {}),
    })

    const text = await res.text().catch(() => '')
    const contentType = res.headers.get('content-type') || ''

    if (contentType.includes('application/json')) {
      try {
        return NextResponse.json(JSON.parse(text || '{}'), { status: res.status })
      } catch {
        return NextResponse.json({ raw: text }, { status: res.status })
      }
    }

    return new NextResponse(text, { status: res.status })
  } catch (err) {
    console.error('costs proxy error', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
