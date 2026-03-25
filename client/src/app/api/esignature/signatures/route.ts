import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'
export const runtime = 'nodejs'

const baseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '')
const apiKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

type SignatureRecipientInput = {
  email: string
  name?: string
  company?: string
  title?: string
}

export async function GET(request: Request) {
  try {
    // Validate environment variables
    if (!baseUrl) {
      console.error('[API /esignature/signatures] Missing NEXT_PUBLIC_SUPABASE_URL')
      return NextResponse.json({ error: 'Server configuration error: Missing Supabase URL' }, { status: 500 })
    }
    if (!apiKey) {
      console.error('[API /esignature/signatures] Missing Supabase API key')
      return NextResponse.json({ error: 'Server configuration error: Missing Supabase API key' }, { status: 500 })
    }

    const url = new URL(request.url)
    const userIdParam = url.searchParams.get('user_id')
    const emailParam = url.searchParams.get('email')

    console.log('[API /esignature/signatures] user_id:', userIdParam, 'email:', emailParam)

    if (!userIdParam && !emailParam) {
      return NextResponse.json({ error: 'user_id or email is required' }, { status: 400 })
    }

    const filter = userIdParam
      ? `user_id=eq.${encodeURIComponent(userIdParam)}`
      : `email=eq.${encodeURIComponent(emailParam!)}`

    // Query signature table filtered by user_id or email
    const queryUrl = `${baseUrl}/rest/v1/signature?${filter}&order=created_at.desc`
    console.log('[API /esignature/signatures] queryUrl:', queryUrl)

    const res = await fetch(queryUrl, {
      method: 'GET',
      headers: {
        'apikey': apiKey!,
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    })

    console.log('[API /esignature/signatures] response status:', res.status)

    if (!res.ok) {
      const errorText = await res.text()
      console.error('[API /esignature/signatures] error:', errorText)
      throw new Error(`Failed to fetch signature table (${res.status})`)
    }

    const records = await res.json()
    console.log('[API /esignature/signatures] records count:', records.length)
    console.log('[API /esignature/signatures] first record:', records[0])

    const parseEmailArray = (raw: any): string[] => {
      if (!raw) return []
      const s = String(raw).trim()
      if (s.startsWith('[')) {
        try {
          const parsed = JSON.parse(s)
          if (Array.isArray(parsed)) return parsed.map((e: any) => String(e).trim()).filter(Boolean)
        } catch {}
      }
      return s ? [s] : []
    }

    const parseDocumentTitle = (raw: any): string => {
      if (!raw) return 'Untitled Document'
      const s = String(raw).trim()
      if (s.startsWith('[')) {
        try {
          const parsed = JSON.parse(s)
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed[0]?.file_name || 'Document'
          }
        } catch {}
      }
      if (s.startsWith('{')) {
        try {
          const parsed = JSON.parse(s)
          if (parsed?.file_name) return parsed.file_name
        } catch {}
      }
      return 'Document'
    }

    const truthy = (v: any) => {
      const s = String(v ?? '').trim().toLowerCase()
      return s === 'true' || s === '1' || s === 'yes' || s === 'y' || s === 'on'
    }

    const hasAny = (...vals: any[]) => vals.some((v) => String(v ?? '').trim().length > 0)

    const computeProgress = async (r: any): Promise<{ progressTotal: number; progressCompleted: number }> => {
      try {
        const fieldsRes = await fetch(
          `${baseUrl}/rest/v1/edc_esignature_fields?deal_id=eq.${encodeURIComponent(String(r.id))}&select=fields_data&limit=1`,
          {
            method: 'GET',
            headers: {
              apikey: apiKey!,
              Authorization: `Bearer ${apiKey}`,
            },
            cache: 'no-store',
          }
        )

        const rows = fieldsRes.ok ? await fieldsRes.json().catch(() => []) : []
        const row = rows?.[0]
        const fields = row?.fields_data ? JSON.parse(row.fields_data) : []
        const total = Array.isArray(fields) ? fields.length : 0

        if (!Array.isArray(fields) || fields.length === 0) {
          return { progressTotal: 0, progressCompleted: 0 }
        }

        const signatureComplete = hasAny(r?.signature_image, r?.signature_b64, r?.signature)
        const nameComplete = hasAny(r?.full_name)
        const dateComplete = hasAny(r?.signed_at) || String(r?.status ?? '').toLowerCase() === 'completed'

        let completed = 0
        for (const f of fields) {
          const type = String(f?.type ?? '').trim()
          switch (type) {
            case 'signature':
              if (signatureComplete) completed++
              break
            case 'initial':
            case 'name':
              if (nameComplete) completed++
              break
            case 'dateSigned':
              if (dateComplete) completed++
              break
            case 'stamp':
              // stamp is not user-input; consider it complete when placed
              completed++
              break
            case 'checkbox':
              if (truthy(f?.value)) completed++
              break
            case 'company':
            case 'title':
            case 'text':
              if (hasAny(f?.value)) completed++
              break
            default:
              if (hasAny(f?.value)) completed++
              break
          }
        }

        return { progressTotal: total, progressCompleted: completed }
      } catch {
        return { progressTotal: 0, progressCompleted: 0 }
      }
    }

    // Group records by document_file so multiple recipients of the same upload = 1 row
    const groups = new Map<string, any[]>()
    for (const r of records) {
      const key = String(r.document_file || r.id)
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(r)
    }

    const documents = await Promise.all(Array.from(groups.values()).map(async (group) => {
      const primary = group[0] // earliest record in this group

      // Overall status: completed only if all are completed, otherwise lowest status
      const statusRank = (s: string) =>
        s === 'completed' ? 4 : s === 'sent' ? 3 : s === 'declined' ? 2 : s === 'expired' ? 1 : 0
      const lowestStatus = group.reduce((prev, r) =>
        statusRank(r.status) < statusRank(prev.status) ? r : prev, primary).status

      const status: 'draft' | 'sent' | 'completed' | 'declined' | 'expired' =
        lowestStatus === 'completed' ? 'completed' :
        lowestStatus === 'sent' ? 'sent' :
        lowestStatus === 'declined' ? 'declined' :
        lowestStatus === 'expired' ? 'expired' : 'draft'

      const { progressTotal, progressCompleted } = await computeProgress(primary)

      const allRecipients = group.map((r) => String(r.email || '').trim()).filter(Boolean)
      const recipient = allRecipients[0] || ''
      const docTitle = parseDocumentTitle(primary.document_file)
      const totalSigners = group.length
      const completedSigners = group.filter((r) => r.status === 'completed').length

      return {
        id: primary.id,
        dealId: primary.id,
        rowIds: group.map((r) => r.id), // all DB row IDs in this group
        title: docTitle,
        recipient,
        allRecipients,
        recipientName: group.map((r) => r.full_name || r.email || '').filter(Boolean).join(', '),
        status,
        createdDate: primary.created_at || new Date().toISOString(),
        lastModified: primary.updated_at || primary.created_at || new Date().toISOString(),
        signers: totalSigners,
        completedSigners,
        progressTotal,
        progressCompleted,
        dealType: 'Signature',
        state: status,
        vehicle: '',
      }
    }))

    console.log('[API /esignature/signatures] mapped documents:', documents.length)

    return NextResponse.json({ documents }, {
      headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0' },
    })
  } catch (err: any) {
    console.error('[API /esignature/signatures] Error:', err)
    return NextResponse.json({ error: err?.message || 'Failed to fetch signature documents' }, { status: 500 })
  }
}

const STORAGE_BUCKET = 'esignature-docs'

function getServiceClient() {
  return createClient(
    (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, ''),
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
    { auth: { persistSession: false } }
  )
}

export async function POST(request: Request) {
  console.log('[API /esignature/signatures POST] Received upload request')
  try {
    if (!baseUrl) {
      return NextResponse.json({ error: 'Server configuration error: Missing Supabase URL' }, { status: 500 })
    }
    if (!apiKey) {
      return NextResponse.json({ error: 'Server configuration error: Missing Supabase API key' }, { status: 500 })
    }

    const formData = await request.formData()
    const files = formData.getAll('files') as File[]
    const recipientDetailsRaw = String(formData.get('recipient_details') ?? '').trim()
    const userId = String(formData.get('user_id') ?? '').trim()

    if (files.length === 0) {
      return NextResponse.json({ error: 'At least one file is required' }, { status: 400 })
    }

    let rawRecipients: SignatureRecipientInput[] = []
    try {
      rawRecipients = JSON.parse(recipientDetailsRaw)
    } catch {
      return NextResponse.json({ error: 'Invalid recipient_details format' }, { status: 400 })
    }

    const seenEmails = new Set<string>()
    const recipients = rawRecipients
      .map((r) => ({
        email: String(r?.email ?? '').trim().toLowerCase(),
        name: String(r?.name ?? '').trim(),
        company: String(r?.company ?? '').trim(),
        title: String(r?.title ?? '').trim(),
      }))
      .filter((r) => {
        if (!r.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.email)) return false
        if (seenEmails.has(r.email)) return false
        seenEmails.add(r.email)
        return true
      })

    if (recipients.length === 0) {
      return NextResponse.json({ error: 'At least one valid recipient is required' }, { status: 400 })
    }

    const supabaseService = getServiceClient()

    const uploadedFiles: { file_name: string; file_type: string; url: string }[] = []

    for (const file of files) {
      const safeName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_')}`
      const arrayBuffer = await file.arrayBuffer()
      const fileBuffer = Buffer.from(arrayBuffer)

      console.log(`[API /esignature/signatures POST] Uploading: ${file.name} (${fileBuffer.byteLength} bytes) as ${safeName}`)

      const { data: uploadData, error: uploadError } = await supabaseService.storage
        .from(STORAGE_BUCKET)
        .upload(safeName, fileBuffer, {
          contentType: file.type || 'application/octet-stream',
          upsert: true,
        })

      if (uploadError) {
        console.error('[API /esignature/signatures POST] Storage upload error:', uploadError)
        return NextResponse.json({ error: `Failed to upload file "${file.name}": ${uploadError.message}` }, { status: 500 })
      }

      const { data: urlData } = supabaseService.storage
        .from(STORAGE_BUCKET)
        .getPublicUrl(uploadData.path)

      uploadedFiles.push({ file_name: file.name, file_type: file.type, url: urlData.publicUrl })
      console.log('[API /esignature/signatures POST] Uploaded successfully:', urlData.publicUrl)
    }

    // document_file stored as JSON (same for all recipients)
    const documentFile = JSON.stringify(uploadedFiles)

    // Insert one row per recipient
    const rows = recipients.map((r) => ({
      document_file: documentFile,
      email: r.email,
      full_name: r.name || null,
      company: r.company || null,
      title: r.title || null,
      status: 'draft',
      user_id: userId || null,
    }))

    console.log('[API /esignature/signatures POST] Inserting rows:', rows.length)

    const insertRes = await fetch(`${baseUrl}/rest/v1/signature`, {
      method: 'POST',
      headers: {
        'apikey': apiKey!,
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
      },
      body: JSON.stringify(rows),
      cache: 'no-store',
    })

    if (!insertRes.ok) {
      const errorText = await insertRes.text()
      console.error('[API /esignature/signatures POST] Supabase insert error:', errorText)
      return NextResponse.json({ error: `Failed to save documents: ${errorText}` }, { status: 500 })
    }

    const inserted = await insertRes.json()
    console.log('[API /esignature/signatures POST] Inserted rows:', inserted.length)

    return NextResponse.json({ success: true, count: inserted.length, documents: inserted })
  } catch (err: any) {
    console.error('[API /esignature/signatures POST] Error:', err)
    return NextResponse.json({ error: err?.message || 'Failed to save documents' }, { status: 500 })
  }
}
