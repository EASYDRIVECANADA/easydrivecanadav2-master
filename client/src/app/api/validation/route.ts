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
    const ab = await (file as File).arrayBuffer().catch(() => null)
    if (!ab) {
      return NextResponse.json({ error: 'Failed to read image file' }, { status: 400 })
    }
    const mime = String((anyFile as any)?.type || (file as any)?.type || '').trim() || 'application/octet-stream'
    const b64 = Buffer.from(ab).toString('base64')
    upstreamForm.append('b64', b64)
    upstreamForm.append('mime', mime)
    upstreamForm.append('filename', String((anyFile as any)?.name || 'license.jpg'))

    upstreamForm.append('file', anyFile, anyFile?.name || 'license.jpg')

    const res = await fetch('https://primary-production-6722.up.railway.app/webhook/validationID', {
      method: 'POST',
      body: upstreamForm,
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
