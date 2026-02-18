import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

const WEBHOOK_URL = 'https://primary-production-6722.up.railway.app/webhook/delete'

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))

    const res = await fetch(WEBHOOK_URL, {
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
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: msg || 'Proxy error' }, { status: 500 })
  }
}
