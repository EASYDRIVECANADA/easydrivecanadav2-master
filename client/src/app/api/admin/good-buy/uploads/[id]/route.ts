import { NextResponse } from 'next/server'
import { describeGoodBuyError } from '@/lib/goodBuyAnalyzer.mjs'
import { getGoodBuyRequestEmail, goodBuyForbiddenResponse, isGoodBuyEmailAllowed } from '@/lib/goodBuyAccess.mjs'
import { clean, createGoodBuySupabase, fetchUploadWithRows } from '@/lib/goodBuyServer'

export const dynamic = 'force-dynamic'

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const uploadId = clean(params.id)
    if (!uploadId) return NextResponse.json({ error: 'Missing upload id' }, { status: 400 })
    if (!isGoodBuyEmailAllowed(getGoodBuyRequestEmail(request))) {
      return NextResponse.json(goodBuyForbiddenResponse(), { status: 403 })
    }
    const supabase = createGoodBuySupabase()
    const data = await fetchUploadWithRows(supabase, uploadId)
    if (!data.upload) return NextResponse.json({ error: 'Upload not found' }, { status: 404 })
    if (!isGoodBuyEmailAllowed((data.upload as { email?: unknown }).email)) {
      return NextResponse.json(goodBuyForbiddenResponse(), { status: 403 })
    }
    return NextResponse.json(data)
  } catch (err: unknown) {
    return NextResponse.json({ error: describeGoodBuyError(err, 'Failed to load upload') }, { status: 500 })
  }
}
