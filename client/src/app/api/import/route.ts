import { NextResponse } from 'next/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import * as XLSX from 'xlsx-js-style'

export const runtime = 'nodejs'
export const maxDuration = 60

const IMPORT_MARKER = 'Imported from weekly inventory feed'
const IMPORT_CATEGORY = 'fleet'
const IMPORT_INVENTORY_TYPE = 'FLEET'
const FLEET_PRICE_MARKUP = 3000

type ParsedVehicle = {
  sourceRow: number
  stock_number: string
  vin: string
  year: number
  make: string
  model: string
  series: string | null
  trim: string | null
  price: number
  mileage: number
  odometer: number
  odometer_unit: string
  exterior_color: string | null
  equipment: string | null
  description: string | null
  lot_location: string | null
}

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

const toNumber = (value: unknown) => {
  const raw = clean(value).replace(/[$,\s]/g, '')
  const num = Number(raw)
  return Number.isFinite(num) ? num : 0
}

const hasNumericValue = (value: unknown) => {
  const raw = clean(value).replace(/[$,\s]/g, '')
  if (raw === '') return false
  return Number.isFinite(Number(raw))
}

const toInt = (value: unknown) => {
  const num = Math.round(toNumber(value))
  return Number.isFinite(num) ? num : 0
}

const normalizeHeader = (value: unknown) =>
  clean(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

const normalizeVin = (value: unknown) => clean(value).toUpperCase()

const normalizeStock = (value: unknown) => clean(value).toUpperCase()

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

  const headers = (rows[0] || []).map(normalizeHeader)
  const indexOf = (...names: string[]) => {
    const normalized = names.map(normalizeHeader)
    return headers.findIndex((h) => normalized.includes(h))
  }

  const column = {
    location: indexOf('Location', 'Lot Location'),
    stock: indexOf('Unit ID', 'Stock Number', 'Stock #', 'Stock'),
    year: indexOf('Year', 'Model Year'),
    make: indexOf('Make'),
    model: indexOf('Model'),
    series: indexOf('Series', 'Trim'),
    mileage: indexOf('Kilometers', 'Kilometres', 'Mileage', 'Odometer'),
    exteriorColor: indexOf('Ext Color', 'Exterior Color', 'Colour', 'Color'),
    vin: indexOf('VIN'),
    price: indexOf('Price', 'List Price'),
    equipment: indexOf('Equip', 'Equipment'),
  }

  const required: Array<[keyof typeof column, string]> = [
    ['stock', 'Unit ID / stock number'],
    ['vin', 'VIN'],
    ['year', 'Year'],
    ['make', 'Make'],
    ['mileage', 'Kilometers / mileage'],
    ['price', 'Price'],
  ]

  const missingColumns = required
    .filter(([key]) => column[key] < 0)
    .map(([, label]) => label)

  if (missingColumns.length > 0) {
    throw new Error(`Missing required column(s): ${missingColumns.join(', ')}`)
  }

  if (column.model < 0 && column.equipment < 0) {
    throw new Error('Missing required column(s): Equip or Model')
  }

  const vehicles: ParsedVehicle[] = []
  const skipped: Array<{ row: number; reason: string }> = []
  const seenStock = new Set<string>()
  const seenVin = new Set<string>()

  rows.slice(1).forEach((row, offset) => {
    const sourceRow = offset + 2
    const hasAnyValue = row.some((value) => clean(value))
    if (!hasAnyValue) return

    const get = (idx: number) => (idx >= 0 ? row[idx] : '')
    const stock = normalizeStock(get(column.stock))
    const vin = normalizeVin(get(column.vin))
    const year = toInt(get(column.year))
    const make = clean(get(column.make)).toUpperCase()
    const equipment = clean(get(column.equipment))
    const model = (equipment || clean(get(column.model))).toUpperCase()
    const mileageValue = get(column.mileage)
    const mileage = toInt(mileageValue)
    const price = toNumber(get(column.price))

    const missing = [
      !stock ? 'stock number' : '',
      !vin ? 'VIN' : '',
      !year ? 'year' : '',
      !make ? 'make' : '',
      !model ? 'model' : '',
      !hasNumericValue(mileageValue) ? 'mileage' : '',
      !price ? 'price' : '',
    ].filter(Boolean)

    if (missing.length > 0) {
      skipped.push({ row: sourceRow, reason: `Missing ${missing.join(', ')}` })
      return
    }

    if (seenStock.has(stock)) {
      skipped.push({ row: sourceRow, reason: `Duplicate stock number ${stock} in workbook` })
      return
    }

    if (seenVin.has(vin)) {
      skipped.push({ row: sourceRow, reason: `Duplicate VIN ${vin} in workbook` })
      return
    }

    seenStock.add(stock)
    seenVin.add(vin)

    const series = clean(get(column.series)) || null
    const equipmentValue = equipment || null

    vehicles.push({
      sourceRow,
      stock_number: stock,
      vin,
      year,
      make,
      model,
      series,
      trim: series,
      price,
      mileage,
      odometer: mileage,
      odometer_unit: 'kms',
      exterior_color: clean(get(column.exteriorColor)) || null,
      equipment: equipmentValue,
      description: equipmentValue,
      lot_location: clean(get(column.location)) || null,
    })
  })

  if (vehicles.length === 0) {
    throw new Error('No valid vehicle rows found')
  }

  return { vehicles, skipped }
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
    if (skipped.length > 0) {
      const details = skipped
        .slice(0, 5)
        .map((row) => `Row ${row.row}: ${row.reason}`)
        .join('; ')

      return NextResponse.json(
        {
          error: 'Some spreadsheet rows could not be imported. No inventory was changed.',
          details,
          skipped,
        },
        { status: 422 }
      )
    }

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
