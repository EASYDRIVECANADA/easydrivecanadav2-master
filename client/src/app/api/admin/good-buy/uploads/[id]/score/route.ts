import { NextResponse } from 'next/server'
import { describeGoodBuyError } from '@/lib/goodBuyAnalyzer.mjs'
import {
  clean,
  createGoodBuySupabase,
  getGoodBuySettings,
  scoreRowsForUpload,
} from '@/lib/goodBuyServer'
import type { GoodBuySettings } from '@/lib/goodBuyAnalyzer.mjs'

export const dynamic = 'force-dynamic'

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  try {
    const uploadId = clean(params.id)
    if (!uploadId) return NextResponse.json({ error: 'Missing upload id' }, { status: 400 })
    const supabase = createGoodBuySupabase()
    const { data: upload, error } = await supabase
      .from('edc_good_buy_uploads')
      .select('user_id, settings_snapshot')
      .eq('id', uploadId)
      .maybeSingle()
    if (error) throw error
    if (!upload) return NextResponse.json({ error: 'Upload not found' }, { status: 404 })

    const uploadRow = upload as { user_id?: unknown; settings_snapshot?: Partial<GoodBuySettings> | null }
    const settings = {
      ...(await getGoodBuySettings(supabase, clean(uploadRow.user_id))),
      ...((uploadRow.settings_snapshot || {}) as Partial<GoodBuySettings>),
    }
    const result = await scoreRowsForUpload(supabase, uploadId, settings)
    await supabase
      .from('edc_good_buy_uploads')
      .update({ status: 'scored', updated_at: new Date().toISOString() })
      .eq('id', uploadId)

    return NextResponse.json({ ok: true, ...result })
  } catch (err: unknown) {
    return NextResponse.json({ error: describeGoodBuyError(err, 'Failed to score upload') }, { status: 500 })
  }
}
