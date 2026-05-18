import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import {
  calculateMarketStats,
  defaultGoodBuySettings,
  scoreGoodBuyVehicle,
  summarizeUpload,
  type GoodBuySettings,
  type MarketComp,
} from '@/lib/goodBuyAnalyzer.mjs'

export type JsonRow = Record<string, unknown>

export const clean = (value: unknown) => String(value ?? '').trim()

export const createGoodBuySupabase = () => {
  const supabaseUrl = clean(process.env.NEXT_PUBLIC_SUPABASE_URL).replace(/\/+$/, '')
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseKey) throw new Error('Supabase is not configured')
  return createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
}

export async function resolveAdminUserId(supabase: SupabaseClient, email: string) {
  const normalized = clean(email).toLowerCase()
  if (!normalized) return ''
  const { data } = await supabase
    .from('users')
    .select('id,user_id')
    .ilike('email', normalized)
    .limit(1)
    .maybeSingle()
  return clean((data as JsonRow | null)?.user_id || (data as JsonRow | null)?.id)
}

export async function getGoodBuySettings(supabase: SupabaseClient, userId: string): Promise<GoodBuySettings> {
  let query = supabase
    .from('edc_good_buy_settings')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(1)
  if (userId) query = query.eq('user_id', userId)

  const { data } = await query.maybeSingle()
  const row = data as JsonRow | null
  if (!row) return defaultGoodBuySettings
  return {
    ...defaultGoodBuySettings,
    region: clean(row.region) || defaultGoodBuySettings.region,
    minimumProfitMargin: Number(row.minimum_profit_margin || defaultGoodBuySettings.minimumProfitMargin),
    maximumMileage: Number(row.maximum_mileage || defaultGoodBuySettings.maximumMileage),
    preferredMakes: Array.isArray(row.preferred_makes) ? row.preferred_makes.map(clean).filter(Boolean) : [],
    excludedMakes: Array.isArray(row.excluded_makes) ? row.excluded_makes.map(clean).filter(Boolean) : [],
    scoringWeights: {
      ...defaultGoodBuySettings.scoringWeights,
      ...((row.scoring_weights as Record<string, number> | null) || {}),
    },
    sourceToggles: {
      ...defaultGoodBuySettings.sourceToggles,
      ...((row.source_toggles as Record<string, boolean> | null) || {}),
    },
  }
}

export async function refreshUploadSummary(supabase: SupabaseClient, uploadId: string) {
  const { data, error } = await supabase
    .from('edc_good_buy_rows')
    .select('recommendation, projected_profit, score, risk_flags')
    .eq('upload_id', uploadId)
  if (error) throw error
  const summary = summarizeUpload((data || []).map((row: JsonRow) => ({
    recommendation: row.recommendation,
    projectedProfit: Number(row.projected_profit || 0),
    score: Number(row.score || 0),
    riskFlags: Array.isArray(row.risk_flags) ? row.risk_flags : [],
  })))
  await supabase
    .from('edc_good_buy_uploads')
    .update({ summary, updated_at: new Date().toISOString() })
    .eq('id', uploadId)
  return summary
}

export async function scoreRowsForUpload(supabase: SupabaseClient, uploadId: string, settings: GoodBuySettings) {
  const [{ data: rows, error: rowsError }, { data: comps, error: compsError }] = await Promise.all([
    supabase.from('edc_good_buy_rows').select('*').eq('upload_id', uploadId),
    supabase.from('edc_good_buy_market_comps').select('*').eq('upload_id', uploadId),
  ])
  if (rowsError) throw rowsError
  if (compsError) throw compsError

  const compsByRow = new Map<string, MarketComp[]>()
  for (const comp of (comps || []) as JsonRow[]) {
    const rowId = clean(comp.row_id)
    if (!rowId) continue
    const list = compsByRow.get(rowId) || []
    list.push({
      source: clean(comp.source),
      url: clean(comp.url),
      price: Number(comp.price || 0),
      mileage: Number(comp.mileage || 0),
      region: clean(comp.region),
      confidence: clean(comp.confidence),
    })
    compsByRow.set(rowId, list)
  }

  const updates = []
  for (const row of (rows || []) as JsonRow[]) {
    const id = clean(row.id)
    const marketStats = calculateMarketStats(compsByRow.get(id) || [], {
      listedPrice: Number(row.listed_price || 0),
    })
    const score = scoreGoodBuyVehicle({
      vin: row.vin,
      year: Number(row.year || 0),
      make: row.make,
      model: row.model,
      mileage: Number(row.mileage || 0),
      listedPrice: Number(row.listed_price || 0),
      marketStats,
    }, settings)

    updates.push({
      id,
      patch: {
        market_stats: marketStats,
        score: score.score,
        recommendation: score.recommendation,
        suggested_max_purchase_price: score.suggestedMaxPurchasePrice,
        estimated_resale_value: score.estimatedResaleValue,
        projected_profit: score.projectedProfit,
        projected_margin_percent: score.projectedMarginPercent,
        risk_flags: score.riskFlags,
        reasons: score.reasons,
        factor_scores: score.factorScores || {},
        updated_at: new Date().toISOString(),
      },
    })
  }

  for (const item of updates) {
    const { error } = await supabase
      .from('edc_good_buy_rows')
      .update(item.patch)
      .eq('id', item.id)
    if (error) throw error
  }

  const summary = await refreshUploadSummary(supabase, uploadId)
  return { updated: updates.length, summary }
}

export async function fetchUploadWithRows(supabase: SupabaseClient, uploadId: string) {
  const [{ data: upload, error: uploadError }, { data: rows, error: rowsError }, { data: comps, error: compsError }] = await Promise.all([
    supabase.from('edc_good_buy_uploads').select('*').eq('id', uploadId).maybeSingle(),
    supabase.from('edc_good_buy_rows').select('*').eq('upload_id', uploadId).order('source_row', { ascending: true }),
    supabase.from('edc_good_buy_market_comps').select('*').eq('upload_id', uploadId).order('captured_at', { ascending: false }),
  ])
  if (uploadError) throw uploadError
  if (rowsError) throw rowsError
  if (compsError) throw compsError
  return { upload, rows: rows || [], comps: comps || [] }
}
