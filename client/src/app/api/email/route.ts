import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const incoming = await request.formData()
    const email = String(incoming.get('email') ?? '').trim()
    const dealId = String(incoming.get('dealId') ?? '').trim()
    const link = String(incoming.get('link') ?? '').trim()
    const file = incoming.get('file')
    const fileB64 = String(incoming.get('file_b64') ?? '').trim()
    const fileName = String(incoming.get('file_name') ?? '').trim()

    if (!email) return NextResponse.json({ error: 'Missing email' }, { status: 400 })
    if (!file || !(file instanceof Blob)) return NextResponse.json({ error: 'Missing file' }, { status: 400 })

    const form = new FormData()
    form.append('email', email)
    if (dealId) form.append('dealId', dealId)
    if (link) form.append('link', link)
    form.append('file', file, fileName || (file as any)?.name || 'Bill_of_Sale.pdf')
    if (fileB64) form.append('file_b64', fileB64)
    if (fileName) form.append('file_name', fileName)

    const res = await fetch('https://primary-production-6722.up.railway.app/webhook/email', {
      method: 'POST',
      body: form,
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
    console.error('email proxy error', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
