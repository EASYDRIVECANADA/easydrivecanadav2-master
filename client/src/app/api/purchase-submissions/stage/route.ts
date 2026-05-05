import { NextResponse } from 'next/server'

const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '')
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Valid stages in order
export const DEAL_STAGES = ['insurance_pending', 'delivery_pending', 'closed'] as const
export type DealStage = typeof DEAL_STAGES[number]

export async function POST(req: Request) {
  try {
    const { submissionId, stage } = await req.json()
    if (!submissionId) return NextResponse.json({ error: 'Missing submissionId' }, { status: 400 })
    if (!DEAL_STAGES.includes(stage)) {
      return NextResponse.json({ error: `Invalid stage. Must be one of: ${DEAL_STAGES.join(', ')}` }, { status: 400 })
    }

    const patchRes = await fetch(
      `${supabaseUrl}/rest/v1/edc_purchase_submissions?id=eq.${encodeURIComponent(submissionId)}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
          Prefer: 'return=representation',
        },
        body: JSON.stringify({ deal_stage: stage }),
      }
    )
    if (!patchRes.ok) {
      const text = await patchRes.text()
      throw new Error(`Failed to update stage: ${text}`)
    }

    return NextResponse.json({ success: true, stage })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal error' }, { status: 500 })
  }
}
