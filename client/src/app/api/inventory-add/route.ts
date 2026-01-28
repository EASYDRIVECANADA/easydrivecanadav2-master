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
    return new NextResponse(text, {
      status: res.status,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
      },
    })
  } catch (err) {
    console.error('inventory-add proxy error', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
