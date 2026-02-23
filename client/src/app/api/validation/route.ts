import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function POST(req: Request) {
  try {
    const form = await req.formData().catch(() => null)
    if (!form) {
      return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
    }

    const email = String(form.get('email') || '')
      .trim()
      .toLowerCase()
    const file = form.get('file')

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'Image file is required' }, { status: 400 })
    }

    const upstreamForm = new FormData()
    upstreamForm.append('email', email)

    const anyFile = file as any
    upstreamForm.append('file', anyFile, anyFile?.name || 'license.jpg')

    const res = await fetch('https://primary-production-6722.up.railway.app/webhook-test/validation', {
      method: 'POST',
      body: upstreamForm,
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
