import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

const baseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '')
const apiKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

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

    // First, delete related fields from signature_fields table
    const fieldsDeleteUrl = `${baseUrl}/rest/v1/signature_fields?signature_id=eq.${encodeURIComponent(signatureId)}`
    await fetch(fieldsDeleteUrl, {
      method: 'DELETE',
      headers: {
        'apikey': apiKey,
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    })

    // Delete the signature record
    const deleteUrl = `${baseUrl}/rest/v1/signature?id=eq.${encodeURIComponent(signatureId)}`

    const res = await fetch(deleteUrl, {
      method: 'DELETE',
      headers: {
        'apikey': apiKey,
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
      },
    })

    if (!res.ok) {
      const errorText = await res.text()
      console.error('[API /esignature/signature/[id]/delete] Error:', errorText)
      return NextResponse.json({ error: `Failed to delete signature: ${res.status}` }, { status: res.status })
    }

    return NextResponse.json({ success: true, message: 'Signature deleted successfully' })
  } catch (err: any) {
    console.error('[API /esignature/signature/[id]/delete] Error:', err)
    return NextResponse.json({ error: err?.message || 'Failed to delete signature' }, { status: 500 })
  }
}
