import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

const WEBHOOK_URL = 'https://primary-production-6722.up.railway.app/webhook/image'

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get('content-type') || ''

    if (contentType.includes('multipart/form-data')) {
      const form = await request.formData()

      const res = await fetch(WEBHOOK_URL, {
        method: 'POST',
        body: form,
      })

      const text = await res.text().catch(() => '')
      return new NextResponse(text, { status: res.status })
    }

    const json = await request.json().catch(() => null)

    const res = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(json ?? {}),
    })

    const text = await res.text().catch(() => '')
    return new NextResponse(text, { status: res.status })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: msg || 'Proxy error' }, { status: 500 })
  }
}
