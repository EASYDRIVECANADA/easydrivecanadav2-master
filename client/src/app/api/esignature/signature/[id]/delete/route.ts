import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

const baseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '')
const apiKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

async function deleteOneRow(signatureId: string): Promise<void> {
  // Delete fields for this row
  await fetch(`${baseUrl}/rest/v1/signature_fields?signature_id=eq.${encodeURIComponent(signatureId)}`, {
    method: 'DELETE',
    headers: { 'apikey': apiKey!, 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
  })
  // Delete edc_esignature_fields rows linked to this id
  await fetch(`${baseUrl}/rest/v1/edc_esignature_fields?deal_id=eq.${encodeURIComponent(signatureId)}`, {
    method: 'DELETE',
    headers: { 'apikey': apiKey!, 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
  })
  // Delete the signature record itself
  await fetch(`${baseUrl}/rest/v1/signature?id=eq.${encodeURIComponent(signatureId)}`, {
    method: 'DELETE',
    headers: { 'apikey': apiKey!, 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
  })
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const signatureId = params.id

    if (!signatureId) {
      return NextResponse.json({ error: 'Signature ID is required' }, { status: 400 })
    }

    if (!baseUrl || !apiKey) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    // Fetch the primary record to find its document_file and user_id
    const primaryRes = await fetch(`${baseUrl}/rest/v1/signature?id=eq.${encodeURIComponent(signatureId)}&limit=1`, {
      method: 'GET',
      headers: { 'apikey': apiKey, 'Authorization': `Bearer ${apiKey}` },
      cache: 'no-store',
    })
    const primaryRows = primaryRes.ok ? await primaryRes.json().catch(() => []) : []
    const primary = primaryRows?.[0]

    // Collect all sibling IDs sharing the same user_id + document_file
    const siblingIds: string[] = []
    if (primary?.user_id && primary?.document_file) {
      const siblingsRes = await fetch(
        `${baseUrl}/rest/v1/signature?user_id=eq.${encodeURIComponent(primary.user_id)}&select=id,document_file`,
        {
          method: 'GET',
          headers: { 'apikey': apiKey, 'Authorization': `Bearer ${apiKey}` },
          cache: 'no-store',
        }
      )
      if (siblingsRes.ok) {
        const allRows: any[] = await siblingsRes.json().catch(() => [])
        for (const row of allRows) {
          if (row.id !== signatureId && String(row.document_file ?? '') === String(primary.document_file ?? '')) {
            siblingIds.push(row.id)
          }
        }
      }
    }

    // Delete primary row and all siblings
    await deleteOneRow(signatureId)
    for (const sibId of siblingIds) {
      await deleteOneRow(sibId)
    }

    return NextResponse.json({ success: true, message: `Deleted ${1 + siblingIds.length} record(s)` })
  } catch (err: any) {
    console.error('[API /esignature/signature/[id]/delete] Error:', err)
    return NextResponse.json({ error: err?.message || 'Failed to delete signature' }, { status: 500 })
  }
}
