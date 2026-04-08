import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const baseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '')
const apiKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// POST /api/esignature/signature/[id]/remove-file
// Body: { fileIndex: number }
// Removes a file entry from document_file for all rows sharing the same document_file.
// Refuses if it's the last remaining file.
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 })
    if (!baseUrl || !apiKey) return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })

    const body = await request.json().catch(() => null)
    const fileIndex = Number(body?.fileIndex ?? -1)
    if (!Number.isInteger(fileIndex) || fileIndex < 0) {
      return NextResponse.json({ error: 'fileIndex is required' }, { status: 400 })
    }

    // Fetch primary record
    const primaryRes = await fetch(
      `${baseUrl}/rest/v1/signature?id=eq.${encodeURIComponent(id)}&limit=1`,
      { headers: { apikey: apiKey, Authorization: `Bearer ${apiKey}` }, cache: 'no-store' }
    )
    if (!primaryRes.ok) return NextResponse.json({ error: 'Signature not found' }, { status: 404 })
    const primaryRows = await primaryRes.json().catch(() => [])
    if (!Array.isArray(primaryRows) || !primaryRows.length) {
      return NextResponse.json({ error: 'Signature not found' }, { status: 404 })
    }
    const primary = primaryRows[0]

    // Parse existing document_file
    const rawDocFile = String(primary.document_file || '').trim()
    let existingFiles: { file_name: string; file_type: string; url?: string; file_b64?: string }[] = []
    if (rawDocFile.startsWith('[')) {
      try { existingFiles = JSON.parse(rawDocFile) } catch {}
    } else if (rawDocFile.startsWith('{')) {
      try { existingFiles = [JSON.parse(rawDocFile)] } catch {}
    }

    if (existingFiles.length <= 1) {
      return NextResponse.json({ error: 'Cannot remove the last file' }, { status: 400 })
    }
    if (fileIndex >= existingFiles.length) {
      return NextResponse.json({ error: 'fileIndex out of range' }, { status: 400 })
    }

    const updatedFiles = existingFiles.filter((_, i) => i !== fileIndex)
    const updatedDocumentFile = JSON.stringify(updatedFiles)

    // Find all sibling rows sharing the same document_file
    const siblingsRes = await fetch(
      `${baseUrl}/rest/v1/signature?user_id=eq.${encodeURIComponent(String(primary.user_id || ''))}&select=id,document_file`,
      { headers: { apikey: apiKey, Authorization: `Bearer ${apiKey}` }, cache: 'no-store' }
    )
    const allRows: any[] = siblingsRes.ok ? await siblingsRes.json().catch(() => []) : []
    const rowsToUpdate = allRows
      .filter((r: any) => String(r.document_file ?? '') === rawDocFile)
      .map((r: any) => r.id as string)

    if (!rowsToUpdate.includes(id)) rowsToUpdate.push(id)

    await Promise.all(rowsToUpdate.map((rowId) =>
      fetch(`${baseUrl}/rest/v1/signature?id=eq.${encodeURIComponent(rowId)}`, {
        method: 'PATCH',
        headers: {
          apikey: apiKey!,
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({ document_file: updatedDocumentFile }),
        cache: 'no-store',
      })
    ))

    return NextResponse.json({ success: true, allFiles: updatedFiles })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to remove file' }, { status: 500 })
  }
}
