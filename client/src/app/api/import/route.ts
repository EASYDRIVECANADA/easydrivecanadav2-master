import { NextResponse } from 'next/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import * as XLSX from 'xlsx-js-style'
import { parseFleetInventoryRows } from '@/lib/fleetInventoryImport.mjs'

export const runtime = 'nodejs'
export const maxDuration = 60

const IMPORT_MARKER = 'Imported from weekly inventory feed'
const IMPORT_CATEGORY = 'fleet'
const IMPORT_INVENTORY_TYPE = 'FLEET'
const FLEET_PRICE_MARKUP = 3000

type UserRow = {
  id?: string | null
  user_id?: string | null
  role?: string | null
  status?: string | null
}

type ExistingVehicleRow = {
  id: string
  stock_number?: string | null
  vin?: string | null
}

const clean = (value: unknown) => String(value ?? '').trim()

const getErrorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message
  if (error && typeof error === 'object') {
    const maybe = error as { message?: unknown; details?: unknown; hint?: unknown; code?: unknown }
    return [maybe.message, maybe.details, maybe.hint, maybe.code]
      .map((part) => clean(part))
      .filter(Boolean)
      .join(' | ') || 'Failed to import inventory file'
  }
  return 'Failed to import inventory file'
}

const chunkList = <T,>(items: T[], size = 100) => {
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size))
  }
  return chunks
}

const parseWorkbook = async (file: File) => {
  const ab = await file.arrayBuffer()
  const wb = XLSX.read(Buffer.from(ab), { type: 'buffer', cellDates: false })
  const sheetName = wb.SheetNames[0]
  if (!sheetName) throw new Error('Workbook has no sheets')

  const ws = wb.Sheets[sheetName]
  const rows = XLSX.utils.sheet_to_json(ws, {
    header: 1,
    defval: '',
    blankrows: false,
    raw: false,
  }) as unknown[][]

  if (rows.length < 2) throw new Error('Workbook has no vehicle rows')

  return parseFleetInventoryRows(rows)
}

const resolveImportUser = async (supabase: SupabaseClient, email: string) => {
  if (!email) return { userId: '', role: '', status: '' }

  const { data } = await supabase
    .from('users')
    .select('id,user_id,role,status')
    .ilike('email', email)
    .limit(1)
    .maybeSingle()

  const row = data as UserRow | null

  return {
    userId: clean(row?.user_id ?? row?.id),
    role: clean(row?.role),
    status: clean(row?.status),
  }
}

export async function POST(req: Request) {
  try {
    const supabaseUrl = clean(process.env.NEXT_PUBLIC_SUPABASE_URL).replace(/\/+$/, '')
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: 'Supabase is not configured' }, { status: 500 })
    }

    const incoming = await req.formData()
    const file = incoming.get('file')
    const email = clean(req.headers.get('x-admin-email') || incoming.get('email')).toLowerCase()

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Missing file' }, { status: 400 })
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    })

    const { vehicles, skipped } = await parseWorkbook(file)

    const { userId, status } = await resolveImportUser(supabase, email)
    if (!userId) {
      return NextResponse.json(
        { error: 'Could not identify the importing user. No inventory was changed.' },
        { status: 401 }
      )
    }
    if (status.toLowerCase() === 'disable') {
      return NextResponse.json(
        { error: 'This account is disabled. No inventory was changed.' },
        { status: 403 }
      )
    }

    const now = new Date().toISOString()

    let previousQuery = supabase
      .from('edc_vehicles')
      .select('id, stock_number, vin, notes')
      .eq('notes', IMPORT_MARKER)

    if (userId) previousQuery = previousQuery.eq('user_id', userId)

    const { data: previousRows, error: previousError } = await previousQuery
    if (previousError) throw previousError

    const previousVehicles = (previousRows || []) as ExistingVehicleRow[]
    const previousIds = previousVehicles.map((row) => String(row?.id || '')).filter(Boolean)
    let removed = 0

    if (previousIds.length > 0) {
      for (const chunk of chunkList(previousIds)) {
        const { error: deleteError } = await supabase
          .from('edc_vehicles')
          .delete()
          .in('id', chunk)

        if (deleteError) throw deleteError
      }
      removed = previousIds.length
    }

    const insertRows = vehicles.map((vehicle) => ({
        user_id: userId || null,
        make: vehicle.make,
        model: vehicle.model,
        year: vehicle.year,
        trim: vehicle.trim,
        stock_number: vehicle.stock_number,
        series: vehicle.series,
        equipment: vehicle.equipment,
        vin: vehicle.vin,
        price: vehicle.price + FLEET_PRICE_MARKUP,
        mileage: vehicle.mileage,
        odometer: vehicle.odometer,
        odometer_unit: vehicle.odometer_unit,
        status: 'In Stock',
        inventory_type: IMPORT_INVENTORY_TYPE,
        categories: IMPORT_CATEGORY,
        condition: 'Used',
        exterior_color: vehicle.exterior_color,
        description: vehicle.description,
        ad_description: vehicle.description,
        lot_location: vehicle.lot_location,
        notes: IMPORT_MARKER,
        updated_at: now,
        vehicleId: crypto.randomUUID(),
        fuel_type: null,
        transmission: null,
        body_style: null,
        drivetrain: null,
        interior_color: null,
        features: [],
        city: null,
        province: 'ON',
        created_at: now,
    }))

    for (const chunk of chunkList(insertRows)) {
      const { error } = await supabase
        .from('edc_vehicles')
        .insert(chunk)

      if (error) {
        return NextResponse.json(
          {
            error: 'Import failed while adding new vehicles.',
            details: error.message,
            inserted: 0,
            updated: 0,
            removed,
            skipped,
          },
          { status: 422 }
        )
      }
    }

    return NextResponse.json({
      ok: true,
      details: 'Done',
      imported: vehicles.length,
      inserted: insertRows.length,
      updated: 0,
      removed,
      skipped,
    })
  } catch (e: unknown) {
    const message = getErrorMessage(e)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
