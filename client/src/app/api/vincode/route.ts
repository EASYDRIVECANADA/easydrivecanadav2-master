import { NextResponse } from 'next/server'
import crypto from 'crypto'
export const runtime = 'nodejs'

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
    if (!apiKey || !secretKey) {
      return NextResponse.json({ error: 'Server missing VIN API keys' }, { status: 500 })
    }
    const hasher = crypto.createHash('sha1')
    hasher.update(`${upperVin}|${opId}|${apiKey}|${secretKey}`)
    const controlSum = hasher.digest('hex').substring(0, 10)

    const payload = { vin: upperVin, CONTROL_SUM: controlSum }
    console.log('[vincode] sending payload -> webhook:', payload)

    const primaryUrl = 'https://primary-production-6722.up.railway.app/webhook/Vincode'
    const fallbackUrl = 'https://primary-production-6722.up.railway.app/webhook/vincode'
    let res = await fetch(primaryUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!res.ok && res.status === 404) {
      // Retry with lowercase path if not found
      console.warn('[vincode] primary path 404, retrying fallback path:', fallbackUrl)
      res = await fetch(fallbackUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(payload),
      })
    }

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      return NextResponse.json({ error: text || `Upstream responded ${res.status}`, status: res.status, tried: [primaryUrl, fallbackUrl] }, { status: 502 })
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
