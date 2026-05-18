import { NextResponse } from 'next/server'
import { describeGoodBuyError, parseFleetWorkbook, scoreShortlistVehicle } from '@/lib/goodBuyAnalyzer.mjs'
import {
  clean,
  createGoodBuySupabase,
  getGoodBuySettings,
  resolveAdminUserId,
  refreshUploadSummary,
} from '@/lib/goodBuyServer'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(request: Request) {
  try {
    const supabase = createGoodBuySupabase()
    const url = new URL(request.url)
    const email = clean(url.searchParams.get('email')).toLowerCase()
    const userId = clean(url.searchParams.get('user_id')) || await resolveAdminUserId(supabase, email)
    let query = supabase
      .from('edc_good_buy_uploads')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20)
    if (userId) query = query.eq('user_id', userId)
    const { data, error } = await query
    if (error) throw error
    return NextResponse.json({ uploads: data || [] })
  } catch (err: unknown) {
    return NextResponse.json({ error: describeGoodBuyError(err, 'Failed to load uploads') }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = createGoodBuySupabase()
    const form = await request.formData()
    const file = form.get('file')
    const email = clean(request.headers.get('x-admin-email') || form.get('email')).toLowerCase()
    const region = clean(form.get('region')) || 'ON'

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Missing file' }, { status: 400 })
    }

    const lowerName = file.name.toLowerCase()
    if (!lowerName.endsWith('.xlsx') && !lowerName.endsWith('.csv')) {
      return NextResponse.json({ error: 'Only .xlsx and .csv files are supported' }, { status: 400 })
    }

    const userId = await resolveAdminUserId(supabase, email)
    if (!userId) return NextResponse.json({ error: 'Could not identify admin user' }, { status: 401 })

    const buffer = Buffer.from(await file.arrayBuffer())
    const parsed = parseFleetWorkbook(buffer, file.name)
    const settings = await getGoodBuySettings(supabase, userId)
    const settingsSnapshot = { ...settings, region }
    const now = new Date().toISOString()

    const { data: upload, error: uploadError } = await supabase
      .from('edc_good_buy_uploads')
      .insert({
        user_id: userId,
        email,
        filename: file.name,
        region,
        status: 'shortlisted',
        settings_snapshot: settingsSnapshot,
        created_at: now,
        updated_at: now,
      })
      .select('*')
      .single()
    if (uploadError) throw uploadError

    const uploadId = clean(upload?.id)
    if (parsed.vehicles.length > 0) {
      const rows = parsed.vehicles.map((vehicle) => {
        const shortlist = scoreShortlistVehicle(vehicle, settingsSnapshot)
        return {
          upload_id: uploadId,
          source_row: vehicle.sourceRow,
          stock_number: vehicle.stockNumber || null,
          vin: vehicle.vin,
          year: vehicle.year,
          make: vehicle.make,
          model: vehicle.model,
          trim: vehicle.trim || null,
          mileage: vehicle.mileage,
          listed_price: vehicle.listedPrice,
          validation_flags: vehicle.validationFlags,
          risk_flags: shortlist.riskFlags,
          recommendation: shortlist.recommendation,
          score: shortlist.score,
          reasons: shortlist.reasons,
          factor_scores: shortlist.factorScores || {},
          raw: vehicle.raw,
          created_at: now,
          updated_at: now,
        }
      })
      const { error: rowsError } = await supabase.from('edc_good_buy_rows').insert(rows)
      if (rowsError) throw rowsError
    }

    const summary = await refreshUploadSummary(supabase, uploadId)
    const { data: rows } = await supabase
      .from('edc_good_buy_rows')
      .select('*')
      .eq('upload_id', uploadId)
      .order('source_row', { ascending: true })

    return NextResponse.json({
      upload: { ...upload, summary },
      rows: rows || [],
      skipped: parsed.skipped,
    }, { status: 201 })
  } catch (err: unknown) {
    return NextResponse.json({ error: describeGoodBuyError(err, 'Failed to parse upload') }, { status: 500 })
  }
}
