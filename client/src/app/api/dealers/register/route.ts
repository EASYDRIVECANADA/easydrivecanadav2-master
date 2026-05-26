import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  buildDealerOwnerRow,
  buildDealerVerificationUrl,
  buildDealershipProfileRow,
  normalizeDealerRegistration,
} from '@/lib/dealerOnboarding.mjs'

type UserRow = {
  id?: string | null
  user_id?: string | null
}

type DealershipRow = {
  id?: string | null
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function makeId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  const registration = normalizeDealerRegistration(body || {})

  if (!registration.companyName || !registration.contactName || !registration.email || !registration.phone || !registration.province || !registration.inventorySize) {
    return NextResponse.json({ error: 'Company name, contact name, email, phone, province, and inventory size are required.' }, { status: 400 })
  }

  if (!isValidEmail(registration.email)) {
    return NextResponse.json({ error: 'Please provide a valid email address.' }, { status: 400 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: 'Server not configured. Please contact us directly.' }, { status: 500 })
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  let ownerUserId = makeId()
  let ownerId: string | null = null

  const { data: existingOwner, error: existingOwnerError } = await supabase
    .from('users')
    .select('id, user_id')
    .ilike('email', registration.email)
    .limit(1)
    .maybeSingle()

  if (existingOwnerError) {
    return NextResponse.json({ error: existingOwnerError.message || 'Failed to check dealer account.' }, { status: 500 })
  }

  const existingOwnerRow = existingOwner as UserRow | null
  if (existingOwnerRow?.id) {
    ownerId = String(existingOwnerRow.id)
    ownerUserId = String(existingOwnerRow.user_id || ownerUserId).trim()
    const ownerRow = buildDealerOwnerRow(registration, ownerUserId)
    const { error: updateOwnerError } = await supabase
      .from('users')
      .update(ownerRow)
      .eq('id', ownerId)

    if (updateOwnerError) {
      return NextResponse.json({ error: updateOwnerError.message || 'Failed to update dealer account.' }, { status: 500 })
    }
  } else {
    const ownerRow = buildDealerOwnerRow(registration, ownerUserId)
    const { data: insertedOwner, error: insertOwnerError } = await supabase
      .from('users')
      .insert({ ...ownerRow, created_at: new Date().toISOString() })
      .select('id, user_id')
      .single()

    if (insertOwnerError) {
      return NextResponse.json({ error: insertOwnerError.message || 'Failed to create dealer account.' }, { status: 500 })
    }

    const insertedOwnerRow = insertedOwner as UserRow | null
    ownerId = String(insertedOwnerRow?.id || '')
    ownerUserId = String(insertedOwnerRow?.user_id || ownerUserId).trim()
  }

  let dealershipId: string | null = null
  let dealershipWarning: string | null = null
  const profileRow = buildDealershipProfileRow(registration, ownerUserId)

  try {
    const { data: existingDealer, error: existingDealerError } = await supabase
      .from('dealership')
      .select('id')
      .eq('user_id', ownerUserId)
      .limit(1)
      .maybeSingle()

    if (existingDealerError) throw existingDealerError

    const existingDealerRow = existingDealer as DealershipRow | null
    if (existingDealerRow?.id) {
      dealershipId = String(existingDealerRow.id)
      const { error: updateDealerError } = await supabase
        .from('dealership')
        .update(profileRow)
        .eq('id', dealershipId)
      if (updateDealerError) throw updateDealerError
    } else {
      const { data: insertedDealer, error: insertDealerError } = await supabase
        .from('dealership')
        .insert(profileRow)
        .select('id')
        .single()
      if (insertDealerError) throw insertDealerError
      dealershipId = String((insertedDealer as DealershipRow | null)?.id || '')
    }
  } catch (error) {
    dealershipWarning = error instanceof Error
      ? `Dealer account was created, but profile details could not be saved: ${error.message}`
      : 'Dealer account was created, but profile details could not be saved.'
  }

  return NextResponse.json({
    success: true,
    userId: ownerUserId,
    ownerId,
    dealershipId,
    verificationUrl: buildDealerVerificationUrl(),
    dealershipWarning,
  })
}
