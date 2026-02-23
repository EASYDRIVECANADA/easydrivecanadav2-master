import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const email = String(body?.email ?? '').trim().toLowerCase()

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    const res = await fetch('https://primary-production-6722.up.railway.app/webhook/forgot', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email }),
    })

    const text = await res.text().catch(() => '')

    if (!res.ok) {
      return NextResponse.json(
        {
          error: text || `Webhook error (${res.status})`,
          upstreamStatus: res.status,
          upstreamBody: text,
        },
        { status: 502 }
      )
    }

    return NextResponse.json(
      {
        ok: true,
        upstreamStatus: res.status,
        upstreamBody: text,
      },
      { status: 200 }
    )
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Request failed' }, { status: 500 })
  }
}
