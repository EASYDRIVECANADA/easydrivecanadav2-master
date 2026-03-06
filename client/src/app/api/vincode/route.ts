import { NextResponse } from 'next/server'
import crypto from 'crypto'
export const runtime = 'nodejs'

const normalizeEmail = (email: unknown) => String(email || '').trim().toLowerCase()

const getSupabaseServerConfig = () => {
  const supabaseUrl = String(process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '')
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseKey) throw new Error('Supabase server not configured')
  return { supabaseUrl, supabaseKey }
}

const readUserBalance = async (email: string) => {
  const { supabaseUrl, supabaseKey } = getSupabaseServerConfig()
  const q = `${supabaseUrl}/rest/v1/users?select=email,balance&email=eq.${encodeURIComponent(email)}&limit=1`
  const res = await fetch(q, {
    method: 'GET',
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
    },
  })
  const text = await res.text().catch(() => '')
  if (!res.ok) throw new Error(text || `Failed to fetch balance (${res.status})`)
  let rows: any[] = []
  try {
    rows = JSON.parse(text)
  } catch {
    rows = []
  }
  const row = rows?.[0]
  if (!row) throw new Error(`No users row matched email=${email}`)
  const balance = Number(row?.balance ?? 0)
  return { email: String(row?.email ?? email), balance: Number.isFinite(balance) ? balance : 0 }
}

const updateUserBalance = async (email: string, nextBalance: number) => {
  const { supabaseUrl, supabaseKey } = getSupabaseServerConfig()
  const patchUrl = `${supabaseUrl}/rest/v1/users?email=eq.${encodeURIComponent(email)}`
  const res = await fetch(patchUrl, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      Prefer: 'return=representation',
    },
    body: JSON.stringify({ balance: nextBalance }),
  })
  const text = await res.text().catch(() => '')
  if (!res.ok) throw new Error(text || `Failed to update user balance (${res.status})`)
  if (String(text || '').trim() === '[]') throw new Error(`No users row matched email=${email}`)
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const { vin, debug } = body || {}
    const email = normalizeEmail((body as any)?.email)

    if (!vin || typeof vin !== 'string' || vin.trim().length < 5) {
      return NextResponse.json({ error: 'Invalid VIN' }, { status: 400 })
    }

    if (!debug && !email) {
      return NextResponse.json({ error: 'Missing email' }, { status: 400 })
    }

    // Read secrets from environment to keep them off the client
    const apiKey = String(
      process.env.VINCARIO_API_KEY || process.env.VIN_API_KEY || process.env.NEXT_PUBLIC_VIN_API_KEY || ''
    ).trim()
    const secretKey = String(process.env.VINCARIO_SECRET_KEY || process.env.VIN_SECRET_KEY || '').trim()
    const opId = String(process.env.VINCARIO_OPERATION_ID || 'decode').trim() || 'decode'

    // CONTROL_SUM = first 10 chars of SHA1(UPPER(VIN) + '|' + opId + '|' + apiKey + '|' + secretKey)
    const upperVin = vin.trim().toUpperCase()
    if (!apiKey || !secretKey) {
      return NextResponse.json({ error: 'Server missing VIN API keys' }, { status: 500 })
    }
    const hasher = crypto.createHash('sha1')
    hasher.update(`${upperVin}|${opId}|${apiKey}|${secretKey}`)
    const controlSum = hasher.digest('hex').substring(0, 10)

    if (debug) {
      return NextResponse.json({
        ok: true,
        vin: upperVin,
        opId,
        CONTROL_SUM: controlSum,
        apiKeyLen: apiKey.length,
        secretKeyLen: secretKey.length,
        apiKeyLast4: apiKey.slice(-4),
        secretKeyLast4: secretKey.slice(-4),
      })
    }

    const cost = 0.5
    const wallet = await readUserBalance(email)
    if (wallet.balance < cost) {
      return NextResponse.json(
        {
          error: 'Insufficient Load Balance for VIN decode ($0.50 required).',
          balance: wallet.balance,
          required: cost,
        },
        { status: 402 }
      )
    }

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

    try {
      const nextBalance = Number(wallet.balance) - cost
      await updateUserBalance(email, nextBalance)
    } catch (e) {
      console.error('[vincode] failed to deduct balance', e)
    }

    return NextResponse.json(json)
  } catch (err) {
    console.error('vincode proxy error', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
