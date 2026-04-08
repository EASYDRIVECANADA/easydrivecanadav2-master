import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const baseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '')
const apiKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const STORAGE_BUCKET = 'esignature-docs'

function getServiceClient() {
  return createClient(
    (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, ''),
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
    { auth: { persistSession: false } }
  )
}

// POST /api/esignature/signature/[id]/add-files
// Uploads new files and appends them to document_file for all rows sharing the same document_file
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 })
    if (!baseUrl || !apiKey) return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })

    // Fetch the primary signature record
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

    // Upload new files to Supabase storage
    const formData = await request.formData()
    const files = formData.getAll('files') as File[]
    if (files.length === 0) return NextResponse.json({ error: 'At least one file is required' }, { status: 400 })

    const supabaseService = getServiceClient()
    const newFiles: { file_name: string; file_type: string; url: string }[] = []

    for (const file of files) {
      const safeName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_')}`
      const arrayBuffer = await file.arrayBuffer()
      const fileBuffer = Buffer.from(arrayBuffer)

      const { data: uploadData, error: uploadError } = await supabaseService.storage
        .from(STORAGE_BUCKET)
        .upload(safeName, fileBuffer, {
          contentType: file.type || 'application/octet-stream',
          upsert: true,
        })

      if (uploadError) {
        return NextResponse.json({ error: `Failed to upload "${file.name}": ${uploadError.message}` }, { status: 500 })
      }

      const { data: urlData } = supabaseService.storage
        .from(STORAGE_BUCKET)
        .getPublicUrl(uploadData.path)

      newFiles.push({ file_name: file.name, file_type: file.type, url: urlData.publicUrl })
    }

    const updatedDocumentFile = JSON.stringify([...existingFiles, ...newFiles])

    // Find all sibling rows sharing the same document_file and update them all
    const siblingsRes = await fetch(
      `${baseUrl}/rest/v1/signature?user_id=eq.${encodeURIComponent(String(primary.user_id || ''))}&select=id,document_file`,
      { headers: { apikey: apiKey, Authorization: `Bearer ${apiKey}` }, cache: 'no-store' }
    )
    const allRows: any[] = siblingsRes.ok ? await siblingsRes.json().catch(() => []) : []
    const rowsToUpdate = allRows.filter(
      (r: any) => String(r.document_file ?? '') === rawDocFile
    ).map((r: any) => r.id as string)

    // Ensure the primary is included
    if (!rowsToUpdate.includes(id)) rowsToUpdate.push(id)

    // PATCH document_file for each related row
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

    return NextResponse.json({ success: true, files: newFiles, allFiles: JSON.parse(updatedDocumentFile) })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to add files' }, { status: 500 })
  }
}
