import { NextResponse } from 'next/server'
import { describeGoodBuyError, validateGoodBuyImportSelection } from '@/lib/goodBuyAnalyzer.mjs'
import { clean, createGoodBuySupabase } from '@/lib/goodBuyServer'

export const dynamic = 'force-dynamic'

type GoodBuyRow = {
  id: string
  upload_id: string
  stock_number?: string | null
  vin?: string | null
  year?: number | null
  make?: string | null
  model?: string | null
  trim?: string | null
  mileage?: number | null
  listed_price?: number | null
  estimated_resale_value?: number | null
  recommendation?: string | null
  imported_vehicle_id?: string | null
  raw?: Record<string, unknown> | null
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const uploadId = clean(params.id)
    if (!uploadId) return NextResponse.json({ error: 'Missing upload id' }, { status: 400 })
    const body = await request.json().catch(() => ({}))
    const rowIds = Array.isArray(body?.rowIds) ? body.rowIds.map(clean).filter(Boolean) : []
    if (rowIds.length === 0) return NextResponse.json({ error: 'No rows selected' }, { status: 400 })

    const supabase = createGoodBuySupabase()
    const { data: upload, error: uploadError } = await supabase
      .from('edc_good_buy_uploads')
      .select('user_id')
      .eq('id', uploadId)
      .maybeSingle()
    if (uploadError) throw uploadError
    if (!upload) return NextResponse.json({ error: 'Upload not found' }, { status: 404 })

    const { data: rows, error: rowsError } = await supabase
      .from('edc_good_buy_rows')
      .select('*')
      .eq('upload_id', uploadId)
      .in('id', rowIds)
    if (rowsError) throw rowsError

    const selectedRows = ((rows || []) as GoodBuyRow[])
    const selectedVins = Array.from(new Set(selectedRows.map((row) => clean(row.vin).toUpperCase()).filter(Boolean)))
    let existingVehicles: Array<Record<string, unknown>> = []
    if (selectedVins.length > 0) {
      const { data: existing, error: existingError } = await supabase
        .from('edc_vehicles')
        .select('id, vin, stock_number')
        .in('vin', selectedVins)
      if (existingError) throw existingError
      existingVehicles = Array.isArray(existing) ? existing as Array<Record<string, unknown>> : []
    }

    const validation = validateGoodBuyImportSelection(selectedRows, existingVehicles)
    if (validation.blocked.length > 0) {
      return NextResponse.json({
        error: validation.message,
        blocked: validation.blocked,
        importableIds: validation.importableIds,
      }, { status: 409 })
    }

    const now = new Date().toISOString()
    const importableIdSet = new Set(validation.importableIds)
    const insertRows = selectedRows
      .filter((row) => importableIdSet.has(row.id))
      .map((row) => ({
        user_id: clean((upload as { user_id?: unknown }).user_id) || null,
        stock_number: clean(row.stock_number) || null,
        vin: clean(row.vin) || null,
        year: Number(row.year || 0) || null,
        make: clean(row.make) || null,
        model: clean(row.model) || null,
        trim: clean(row.trim) || null,
        series: clean(row.trim) || null,
        price: Number(row.estimated_resale_value || row.listed_price || 0),
        mileage: Number(row.mileage || 0),
        odometer: Number(row.mileage || 0),
        odometer_unit: 'kms',
        status: 'In Stock',
        inventory_type: 'FLEET',
        categories: 'fleet',
        condition: 'Used',
        notes: `Imported from Good Buy Analyzer (${row.recommendation || 'Unscored'})`,
        vehicleId: crypto.randomUUID(),
        created_at: now,
        updated_at: now,
      }))

    if (insertRows.length === 0) {
      return NextResponse.json({ error: 'No selected vehicles can be imported.' }, { status: 409 })
    }

    const { data: inserted, error: insertError } = await supabase
      .from('edc_vehicles')
      .insert(insertRows)
      .select('id, vin, stock_number')
    if (insertError) throw insertError

    const insertedRows = Array.isArray(inserted) ? inserted : []
    for (const row of selectedRows) {
      const match = insertedRows.find((vehicle) =>
        clean((vehicle as Record<string, unknown>).vin) === clean(row.vin) ||
        clean((vehicle as Record<string, unknown>).stock_number) === clean(row.stock_number)
      )
      if (!match) continue
      await supabase
        .from('edc_good_buy_rows')
        .update({
          imported_vehicle_id: clean((match as Record<string, unknown>).id),
          imported_at: now,
          updated_at: now,
        })
        .eq('id', row.id)
    }

    await supabase
      .from('edc_good_buy_uploads')
      .update({ status: 'imported_selected', updated_at: now })
      .eq('id', uploadId)

    return NextResponse.json({ ok: true, imported: insertedRows.length, skipped: rowIds.length - insertedRows.length })
  } catch (err: unknown) {
    return NextResponse.json({ error: describeGoodBuyError(err, 'Failed to import selected rows') }, { status: 500 })
  }
}
