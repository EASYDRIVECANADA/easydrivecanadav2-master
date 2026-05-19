import { NextResponse } from 'next/server'
import { describeGoodBuyError } from '@/lib/goodBuyAnalyzer.mjs'
import { getGoodBuyRequestEmail, goodBuyForbiddenResponse, isGoodBuyEmailAllowed } from '@/lib/goodBuyAccess.mjs'
import { clean, createGoodBuySupabase, fetchUploadWithRows } from '@/lib/goodBuyServer'

export const dynamic = 'force-dynamic'

type ManualCompInput = {
  rowId?: string
  source?: string
  url?: string
  title?: string
  price?: number | string
  mileage?: number | string
  region?: string
  confidence?: string
}

type RowRef = { id?: unknown }

const numberValue = (value: unknown) => {
  const parsed = Number(clean(value).replace(/[$,\s]/g, ''))
  return Number.isFinite(parsed) ? parsed : 0
}

const sourceAdapterNotes = [
  { source: 'autotrader', status: 'configured_placeholder', note: 'Public scraper adapter is disabled until source access is approved.' },
  { source: 'cargurus', status: 'configured_placeholder', note: 'Public scraper adapter is disabled until source access is approved.' },
  { source: 'cars', status: 'configured_placeholder', note: 'Public scraper adapter is disabled until source access is approved.' },
  { source: 'dealerSites', status: 'configured_placeholder', note: 'Generic dealer website adapter requires allowed source URLs.' },
  { source: 'facebookManual', status: 'manual_only', note: 'Facebook Marketplace comps are manual-link/manual-entry only in v1.' },
]

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const uploadId = clean(params.id)
    if (!uploadId) return NextResponse.json({ error: 'Missing upload id' }, { status: 400 })
    if (!isGoodBuyEmailAllowed(getGoodBuyRequestEmail(request))) {
      return NextResponse.json(goodBuyForbiddenResponse(), { status: 403 })
    }
    const body = await request.json().catch(() => ({}))
    const manualComps: ManualCompInput[] = Array.isArray(body?.manualComps) ? body.manualComps : []
    const supabase = createGoodBuySupabase()
    const { upload, rows } = await fetchUploadWithRows(supabase, uploadId)
    if (!upload) return NextResponse.json({ error: 'Upload not found' }, { status: 404 })
    if (!isGoodBuyEmailAllowed((upload as { email?: unknown }).email)) {
      return NextResponse.json(goodBuyForbiddenResponse(), { status: 403 })
    }
    const rowIds = new Set(((rows || []) as RowRef[]).map((row) => clean(row.id)))
    const inserts = manualComps
      .map((comp) => ({
        upload_id: uploadId,
        row_id: clean(comp.rowId),
        source: clean(comp.source) || 'manual',
        url: clean(comp.url) || null,
        title: clean(comp.title) || null,
        price: numberValue(comp.price),
        mileage: numberValue(comp.mileage) || null,
        region: clean(comp.region) || null,
        confidence: clean(comp.confidence) || 'manual',
      }))
      .filter((comp) => rowIds.has(comp.row_id) && comp.price > 0)

    if (inserts.length > 0) {
      const { error } = await supabase.from('edc_good_buy_market_comps').insert(inserts)
      if (error) throw error
    }

    await supabase
      .from('edc_good_buy_uploads')
      .update({ status: 'market_comps_added', updated_at: new Date().toISOString() })
      .eq('id', uploadId)

    return NextResponse.json({
      ok: true,
      inserted: inserts.length,
      adapters: sourceAdapterNotes,
    })
  } catch (err: unknown) {
    return NextResponse.json({ error: describeGoodBuyError(err, 'Failed to save market comps') }, { status: 500 })
  }
}
