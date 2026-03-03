import { NextResponse } from 'next/server'

const normalizeEmail = (email: unknown) => String(email || '').trim().toLowerCase()

const getSupabaseServerConfig = () => {
  const supabaseUrl = String(process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '')
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseKey) throw new Error('Supabase server not configured')
  return { supabaseUrl, supabaseKey }
}

const getUserWalletByEmail = async (email: string) => {
  const { supabaseUrl, supabaseKey } = getSupabaseServerConfig()
  const q = `${supabaseUrl}/rest/v1/users?select=id,email,balance,esign_credits&email=eq.${encodeURIComponent(email)}&limit=1`
  const res = await fetch(q, {
    method: 'GET',
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
    },
  })
  const text = await res.text().catch(() => '')
  if (!res.ok) throw new Error(text || `Failed to read user wallet (${res.status})`)
  let rows: any[] = []
  try {
    rows = JSON.parse(text)
  } catch {
    rows = []
  }
  const row = rows?.[0]
  if (!row) throw new Error(`No users row matched email=${email}`)
  const balance = Number(row?.balance ?? 0)
  const credits = Number((row as any)?.esign_credits ?? 0)
  return {
    id: String(row?.id || ''),
    email: String(row?.email || email),
    balance: Number.isFinite(balance) ? balance : 0,
    esignCredits: Number.isFinite(credits) ? credits : 0,
  }
}

const updateUserWalletByEmail = async (email: string, patch: { balance?: number; esign_credits?: number }) => {
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
    body: JSON.stringify(patch),
  })
  const text = await res.text().catch(() => '')
  if (!res.ok) throw new Error(text || `Failed to update user wallet (${res.status})`)
  if (String(text || '').trim() === '[]') throw new Error(`No users row matched email=${email}`)
}

export async function POST(request: Request) {
  try {
    const incoming = await request.formData()
    const email = String(incoming.get('email') ?? '').trim()
    const senderEmail = normalizeEmail(incoming.get('sender_email'))
    const dealId = String(incoming.get('dealId') ?? '').trim()
    const link = String(incoming.get('link') ?? '').trim()
    const file = incoming.get('file')
    const fileB64 = String(incoming.get('file_b64') ?? '').trim()
    const fileName = String(incoming.get('file_name') ?? '').trim()

    if (!email) return NextResponse.json({ error: 'Missing email' }, { status: 400 })
    if (!file || !(file instanceof Blob)) return NextResponse.json({ error: 'Missing file' }, { status: 400 })

    // Charge E‑Signature pay-per-use at the moment the signing request is sent.
    // Prefer consuming bundle credits; otherwise deduct $3 from wallet balance.
    if (senderEmail) {
      try {
        const wallet = await getUserWalletByEmail(senderEmail)
        if (wallet.esignCredits > 0) {
          await updateUserWalletByEmail(senderEmail, { esign_credits: wallet.esignCredits - 1 })
        } else {
          const cost = 3
          if (wallet.balance < cost) {
            return NextResponse.json(
              {
                error: 'Insufficient Load Balance for E‑Signature request ($3 required).',
                balance: wallet.balance,
                required: cost,
              },
              { status: 402 }
            )
          }
          await updateUserWalletByEmail(senderEmail, { balance: wallet.balance - cost })
        }
      } catch (e: any) {
        return NextResponse.json({ error: String(e?.message || e) }, { status: 500 })
      }
    }

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
