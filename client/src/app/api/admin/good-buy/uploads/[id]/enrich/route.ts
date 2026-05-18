import { NextResponse } from 'next/server'
import { describeGoodBuyError } from '@/lib/goodBuyAnalyzer.mjs'
import { clean, createGoodBuySupabase, fetchUploadWithRows } from '@/lib/goodBuyServer'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

type NhtsaResult = Record<string, string>
type GoodBuyRow = Record<string, unknown> & {
  id?: string
  vin?: string
  year?: number
  make?: string
  model?: string
  validation_flags?: string[]
}

const normalize = (value: unknown) => clean(value).toLowerCase()

const decodeBatch = async (rows: Array<{ id: string; vin: string; year: number }>) => {
  if (rows.length === 0) return new Map<string, NhtsaResult>()
  const body = new URLSearchParams()
  body.set('format', 'json')
  body.set('data', rows.map((row) => `${row.vin},${row.year || ''}`).join(';'))

  const res = await fetch('https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVINValuesBatch/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`NHTSA VIN decode failed (${res.status})`)
  const json = await res.json()
  const results = Array.isArray(json?.Results) ? json.Results : []
  const byVin = new Map<string, NhtsaResult>()
  for (const result of results as NhtsaResult[]) {
    const vin = clean(result.VIN).toUpperCase()
    if (vin) byVin.set(vin, result)
  }
  return byVin
}

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  try {
    const uploadId = clean(params.id)
    if (!uploadId) return NextResponse.json({ error: 'Missing upload id' }, { status: 400 })
    const supabase = createGoodBuySupabase()
    const { rows } = await fetchUploadWithRows(supabase, uploadId)
    const decodeRows = ((rows || []) as GoodBuyRow[])
      .map((row) => ({ id: clean(row.id), vin: clean(row.vin).toUpperCase(), year: Number(row.year || 0), row }))
      .filter((row) => row.vin.length === 17)

    const decoded = await decodeBatch(decodeRows)
    let updated = 0
    const now = new Date().toISOString()

    for (const item of decodeRows) {
      const result = decoded.get(item.vin)
      if (!result) continue
      const flags = Array.isArray(item.row.validation_flags) ? [...item.row.validation_flags] : []
      const decodedMake = clean(result.Make)
      const decodedModel = clean(result.Model)
      const decodedYear = Number(result.ModelYear || 0)
      if (decodedMake && normalize(decodedMake) !== normalize(item.row.make)) flags.push('make_mismatch')
      if (decodedModel && !normalize(decodedModel).includes(normalize(item.row.model)) && !normalize(item.row.model).includes(normalize(decodedModel))) flags.push('model_mismatch')
      if (decodedYear && Number(item.row.year || 0) && decodedYear !== Number(item.row.year || 0)) flags.push('year_mismatch')

      const { error } = await supabase
        .from('edc_good_buy_rows')
        .update({
          decoded: result,
          validation_flags: Array.from(new Set(flags)),
          updated_at: now,
        })
        .eq('id', item.id)
      if (error) throw error
      updated += 1
    }

    await supabase
      .from('edc_good_buy_uploads')
      .update({ status: 'enriched', updated_at: now })
      .eq('id', uploadId)

    return NextResponse.json({ ok: true, updated })
  } catch (err: unknown) {
    return NextResponse.json({ error: describeGoodBuyError(err, 'Failed to enrich upload') }, { status: 500 })
  }
}
