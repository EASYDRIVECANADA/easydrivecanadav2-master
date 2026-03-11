import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

const baseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '')
const apiKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export async function POST(request: Request) {
  try {
    if (!baseUrl || !apiKey) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    const body = await request.json()
    const { email } = body

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    const normalizedEmail = String(email).trim().toLowerCase()

    // Fetch current user data
    const userRes = await fetch(
      `${baseUrl}/rest/v1/users?email=eq.${encodeURIComponent(normalizedEmail)}&select=esign_credits,balance,esign_unlimited_until&limit=1`,
      {
        method: 'GET',
        headers: {
          apikey: apiKey!,
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      }
    )

    if (!userRes.ok) {
      const errorText = await userRes.text()
      throw new Error(`Failed to fetch user: ${errorText}`)
    }

    const users = await userRes.json()
    const user = users?.[0]

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const currentCredits = Number(user.esign_credits ?? 0)
    const currentBalance = Number(user.balance ?? 0)
    const unlimitedUntilRaw = user.esign_unlimited_until

    // Check if user has active unlimited subscription
    try {
      const unlimitedUntil = unlimitedUntilRaw ? new Date(String(unlimitedUntilRaw)) : null
      if (unlimitedUntil && !Number.isNaN(unlimitedUntil.getTime()) && unlimitedUntil.getTime() > Date.now()) {
        return NextResponse.json({
          success: true,
          message: 'Unlimited subscription active - no charge',
          unlimited_until: unlimitedUntil.toISOString(),
        })
      }
    } catch {
      // ignore date parsing errors
    }

    // If user has credits, deduct 1 credit
    if (currentCredits > 0) {
      const newCredits = currentCredits - 1

      const updateRes = await fetch(
        `${baseUrl}/rest/v1/users?email=eq.${encodeURIComponent(normalizedEmail)}`,
        {
          method: 'PATCH',
          headers: {
            apikey: apiKey!,
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            Prefer: 'return=representation',
          },
          body: JSON.stringify({
            esign_credits: newCredits,
          }),
        }
      )

      if (!updateRes.ok) {
        const errorText = await updateRes.text()
        throw new Error(`Failed to deduct credit: ${errorText}`)
      }

      return NextResponse.json({
        success: true,
        message: 'Credit deducted',
        credits_remaining: newCredits,
        charged: false,
      })
    }

    // If no credits, charge $3 from balance
    if (currentBalance >= 3) {
      const newBalance = currentBalance - 3

      const updateRes = await fetch(
        `${baseUrl}/rest/v1/users?email=eq.${encodeURIComponent(normalizedEmail)}`,
        {
          method: 'PATCH',
          headers: {
            apikey: apiKey!,
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            Prefer: 'return=representation',
          },
          body: JSON.stringify({
            balance: newBalance,
          }),
        }
      )

      if (!updateRes.ok) {
        const errorText = await updateRes.text()
        throw new Error(`Failed to charge balance: ${errorText}`)
      }

      return NextResponse.json({
        success: true,
        message: 'Charged $3.00 from balance',
        balance_remaining: newBalance,
      })
    }

    return NextResponse.json({
      error: 'Insufficient credits and balance',
    }, { status: 400 })

  } catch (err: any) {
    console.error('[API /esign/deduct-credit] Error:', err)
    return NextResponse.json({ error: err?.message || 'Failed to deduct credit' }, { status: 500 })
  }
}
