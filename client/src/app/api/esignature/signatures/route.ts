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

const requestIp = (request: Request) =>
  String(
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-real-ip') ||
    request.headers.get('x-vercel-forwarded-for') ||
    request.headers.get('x-forwarded-for')?.split(',')[0] ||
    ''
  ).trim()

const insertAuditEvent = async (payload: Record<string, unknown>) => {
  if (!baseUrl || !apiKey) return
  const res = await fetch(`${baseUrl}/rest/v1/edc_signature_events`, {
    method: 'POST',
    headers: {
      apikey: apiKey,
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({
      metadata: {},
      created_at: new Date().toISOString(),
      ...payload,
    }),
    cache: 'no-store',
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    if (res.status === 404 || text.includes('does not exist')) return
    console.warn('[API /esignature/signatures POST] Audit event skipped:', res.status, text)
  }
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

    const fieldKey = (f: any) =>
      `${String(f?.field_id ?? f?.id ?? '')}::r${f?.recipient_index ?? f?.recipientIndex ?? 0}::f${f?.file_index ?? f?.fileIndex ?? 0}`

    const computeProgress = async (group: any[]): Promise<{ progressTotal: number; progressCompleted: number }> => {
      try {
        const rowsByRecipient = await Promise.all(group.map(async (r) => {
          const fieldsRes = await fetch(
            `${baseUrl}/rest/v1/edc_esignature_fields?deal_id=eq.${encodeURIComponent(String(r.id))}&select=*`,
            {
              method: 'GET',
              headers: {
                apikey: apiKey!,
                Authorization: `Bearer ${apiKey}`,
              },
              cache: 'no-store',
            }
          )
          return fieldsRes.ok ? await fieldsRes.json().catch(() => []) : []
        }))

        const fieldById = new Map<string, any>()
        for (const rows of rowsByRecipient) {
          for (const row of rows || []) {
            if (row?.field_id) {
              const key = fieldKey(row)
              const existing = fieldById.get(key)
              if (!existing || hasAny(row.value) || row.signed_at) fieldById.set(key, row)
              continue
            }
            if (row?.fields_data) {
              try {
                const legacyFields = JSON.parse(row.fields_data)
                if (Array.isArray(legacyFields)) {
                  for (const f of legacyFields) {
                    if (!f?.id) continue
                    const key = fieldKey(f)
                    const existing = fieldById.get(key)
                    if (!existing || hasAny(f.value)) fieldById.set(key, f)
                  }
                }
              } catch {}
            }
          }
        }

        const fields = Array.from(fieldById.values())
        if (fields.length === 0) {
          const totalSigners = group.length
          const completedSigners = group.filter((r) => String(r.status || '').toLowerCase() === 'completed').length
          return { progressTotal: totalSigners, progressCompleted: completedSigners }
        }

        const countedFields = fields.filter((f) => String(f?.field_type ?? f?.type ?? '').trim() !== 'stamp')
        const progressTotal = countedFields.length
        const progressCompleted = countedFields.filter((f) => {
          const type = String(f?.field_type ?? f?.type ?? '').trim()
          if (type === 'checkbox') return truthy(f?.value)
          if (type === 'dateSigned') return hasAny(f?.value, f?.signed_at)
          return hasAny(f?.value)
        }).length

        return { progressTotal, progressCompleted }
      } catch {
        return { progressTotal: 0, progressCompleted: 0 }
      }
    }

    // Group records by stable envelope id. Fall back to document_file only for legacy rows.
    const groups = new Map<string, any[]>()
    for (const r of records) {
      const key = String(r.deal_id || r.document_file || r.id)
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

      const allRecipients = group.map((r) => String(r.email || '').trim()).filter(Boolean)
      const recipient = allRecipients[0] || ''
      const docTitle = parseDocumentTitle(primary.document_file)
      const totalSigners = group.length
      const completedSigners = group.filter((r) => String(r.status || '').toLowerCase() === 'completed').length

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
        ...(await computeProgress(group)),
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
    const rows = recipients.map((r, index) => ({
      document_file: documentFile,
      email: r.email,
      full_name: r.name || null,
      company: r.company || null,
      title: r.title || null,
      status: 'draft',
      user_id: userId || null,
      recipient_index: index,
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
    const envelopeId = inserted?.[0]?.id
    if (envelopeId) {
      await Promise.all(inserted.map((row: any, index: number) =>
        fetch(`${baseUrl}/rest/v1/signature?id=eq.${encodeURIComponent(String(row.id))}`, {
          method: 'PATCH',
          headers: {
            'apikey': apiKey!,
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal',
          },
          body: JSON.stringify({ deal_id: envelopeId, recipient_index: index }),
          cache: 'no-store',
        }).catch(() => null)
      ))
      await insertAuditEvent({
        signature_id: envelopeId,
        deal_id: envelopeId,
        user_name: userId || 'Owner',
        user_email: '',
        action: 'Envelope Created',
        activity: `Envelope created with ${inserted.length} recipient(s) and ${uploadedFiles.length} document(s).`,
        status: 'Created',
        ip_address: requestIp(request),
        user_agent: request.headers.get('user-agent') || '',
        metadata: {
          recipient_count: inserted.length,
          document_count: uploadedFiles.length,
          file_names: uploadedFiles.map((file) => file.file_name),
        },
      })
    }
    console.log('[API /esignature/signatures POST] Inserted rows:', inserted.length)

    return NextResponse.json({ success: true, count: inserted.length, documents: inserted })
  } catch (err: any) {
    console.error('[API /esignature/signatures POST] Error:', err)
    return NextResponse.json({ error: err?.message || 'Failed to save documents' }, { status: 500 })
  }
}
