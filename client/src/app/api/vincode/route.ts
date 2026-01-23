import { NextResponse } from 'next/server'
import crypto from 'crypto'

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const { vin } = body || {}

    if (!vin || typeof vin !== 'string' || vin.trim().length < 5) {
      return NextResponse.json({ error: 'Invalid VIN' }, { status: 400 })
    }

    // Read secrets from environment to keep them off the client
    const apiKey =
      process.env.VIN_API_KEY ||
      process.env.VINCARIO_API_KEY ||
      process.env.NEXT_PUBLIC_VIN_API_KEY ||
      ''
    const secretKey =
      process.env.VIN_SECRET_KEY ||
      process.env.VINCARIO_SECRET_KEY ||
      ''
    const opId = 'decode'

    // CONTROL_SUM = first 10 chars of SHA1(UPPER(VIN) + '|' + opId + '|' + apiKey + '|' + secretKey)
    const upperVin = vin.trim().toUpperCase()
    let controlSum = ''
    if (apiKey && secretKey) {
      const hasher = crypto.createHash('sha1')
      hasher.update(`${upperVin}|${opId}|${apiKey}|${secretKey}`)
      controlSum = hasher.digest('hex').substring(0, 10)
    }

    const res = await fetch('https://primary-production-6722.up.railway.app/webhook/Vincode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // Send VIN and computed CONTROL_SUM when available. Keep shape compatible with existing webhook.
      body: JSON.stringify(
        controlSum
          ? { vin: upperVin, CONTROL_SUM: controlSum }
          : { vin: upperVin }
      ),
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      return NextResponse.json({ error: text || `Upstream responded ${res.status}` }, { status: 502 })
    }
    const json = await res.json().catch(async () => {
      const text = await res.text().catch(() => '')
      return text ? { raw: text } : { ok: true }
    })
    return NextResponse.json(json)
  } catch (err) {
    console.error('vincode proxy error', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
