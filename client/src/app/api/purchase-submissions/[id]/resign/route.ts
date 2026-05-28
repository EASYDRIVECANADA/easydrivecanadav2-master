import { NextResponse } from 'next/server'
import { clearOnlinePurchaseSignatures } from '@/lib/purchaseResign'

export const dynamic = 'force-dynamic'

const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '')
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const headers = {
  'Content-Type': 'application/json',
  apikey: supabaseKey,
  Authorization: `Bearer ${supabaseKey}`,
  Prefer: 'return=representation',
}

const parseOrderData = (value: unknown) => {
  if (value && typeof value === 'object') return value as Record<string, unknown>
  if (typeof value !== 'string') return {}
  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : {}
  } catch {
    return {}
  }
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const submissionId = String(params.id || '').trim()
    if (!submissionId) return NextResponse.json({ error: 'Missing submission id' }, { status: 400 })
    if (!supabaseUrl || !supabaseKey) return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })

    const body = await request.json().catch(() => ({}))
    const adminEmail = String(body?.adminEmail || '').trim()

    const fetchRes = await fetch(
      `${supabaseUrl}/rest/v1/edc_purchase_submissions?id=eq.${encodeURIComponent(submissionId)}&select=id,order_data,status&limit=1`,
      { headers, cache: 'no-store' }
    )
    const rows = await fetchRes.json().catch(() => [])
    if (!fetchRes.ok) return NextResponse.json({ error: rows }, { status: fetchRes.status })
    const submission = Array.isArray(rows) ? rows[0] : null
    if (!submission) return NextResponse.json({ error: 'Submission not found' }, { status: 404 })

    const orderData = clearOnlinePurchaseSignatures(parseOrderData(submission.order_data), adminEmail)
    const patch = {
      order_data: orderData,
      document_package_token: null,
      document_package_created_at: null,
      bos_pdf_url: null,
      carfax_files: [],
      document_package_status: 'resign_required',
    }

    const patchRes = await fetch(
      `${supabaseUrl}/rest/v1/edc_purchase_submissions?id=eq.${encodeURIComponent(submissionId)}`,
      {
        method: 'PATCH',
        headers,
        body: JSON.stringify(patch),
        cache: 'no-store',
      }
    )
    const patched = await patchRes.json().catch(() => [])
    if (!patchRes.ok) return NextResponse.json({ error: patched }, { status: patchRes.status })

    return NextResponse.json({ success: true, submission: Array.isArray(patched) ? patched[0] : null })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to reset signatures' }, { status: 500 })
  }
}
