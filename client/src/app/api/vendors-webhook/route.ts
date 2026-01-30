export const runtime = 'nodejs'

export async function POST(req: Request) {
  try {
    const incoming = await req.formData()

    const out = new FormData()
    let hasFile = false

    Array.from(incoming.entries()).forEach(([key, value]) => {
      if (value instanceof Blob) {
        hasFile = true
        const name = (value as any).name && typeof (value as any).name === 'string' ? (value as any).name : 'upload'
        out.append(key, value, name)
      } else {
        out.append(key, String(value))
      }
    })

    if (!hasFile) {
      return new Response(JSON.stringify({ error: 'Missing file in form-data' }), {
        status: 400,
        headers: { 'content-type': 'application/json' },
      })
    }

    const webhookUrl = 'https://primary-production-6722.up.railway.app/webhook/vendors'

    const res = await fetch(webhookUrl, {
      method: 'POST',
      body: out,
    })

    const body = await res.text()
    const contentType = res.headers.get('content-type') || ''

    return new Response(
      JSON.stringify({
        ok: res.ok,
        webhookStatus: res.status,
        webhookContentType: contentType,
        webhookBody: body.slice(0, 4000),
      }),
      {
        status: res.status,
        headers: { 'content-type': 'application/json' },
      }
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Upload proxy failed'
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    })
  }
}
