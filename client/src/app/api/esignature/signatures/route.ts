import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'
export const runtime = 'nodejs'

const baseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '')
const apiKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

type SignatureUploadFile = {
  file_name: string
  file_type: string
  file_b64: string
}

type SignatureRecipientInput = {
  email: string
  name?: string
  company?: string
  title?: string
}
const ESIGN_UPLOAD_WEBHOOK_URL = 'https://primary-production-6722.up.railway.app/webhook/file'

const webhookLooksUnregistered = (text: string) => /not\s+registered|requested\s+webhook/i.test(text)

const getWebhookCandidates = (url: string): string[] => {
  const list = [url]
  if (url.includes('/webhook/')) {
    list.push(url.replace('/webhook/', '/webhook-test/'))
  }
  return Array.from(new Set(list))
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
      throw new Error(`Failed to fetch signature table: ${res.status} - ${errorText}`)
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

    // Map signature table records to document format
    const documents = await Promise.all(records.map(async (r: any) => {
      const status: 'draft' | 'sent' | 'completed' | 'declined' | 'expired' =
        r.status === 'completed' ? 'completed' :
        r.status === 'sent' ? 'sent' :
        r.status === 'declined' ? 'declined' :
        r.status === 'expired' ? 'expired' : 'draft'

      const { progressTotal, progressCompleted } = await computeProgress(r)
      const totalSigners = 2
      const completedSigners = status === 'completed' ? totalSigners : 0

      const allRecipients = parseEmailArray(r.email)
      const recipient = allRecipients[0] || ''
      const docTitle = parseDocumentTitle(r.document_file)

      return {
        id: r.id,
        dealId: r.id,
        title: docTitle,
        recipient,
        allRecipients,
        recipientName: r.full_name || recipient || '',
        status,
        createdDate: r.created_at || new Date().toISOString(),
        lastModified: r.updated_at || r.created_at || new Date().toISOString(),
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

export async function POST(request: Request) {
  console.log('[API /esignature/signatures POST] Received upload request')
  try {
    const body = await request.json().catch(() => null)
    console.log('[API /esignature/signatures POST] Body received:', body ? 'yes' : 'no')
    const files = Array.isArray(body?.files) ? (body.files as SignatureUploadFile[]) : []
    const rawRecipients = Array.isArray(body?.recipient_details)
      ? (body.recipient_details as SignatureRecipientInput[])
      : []
    const userId = String(body?.user_id ?? '').trim()

    if (files.length === 0) {
      return NextResponse.json({ error: 'At least one file is required' }, { status: 400 })
    }

    const normalizedFiles = files
      .map((file) => ({
        file_name: String(file?.file_name ?? '').trim(),
        file_type: String(file?.file_type ?? '').trim() || 'application/pdf',
        file_b64: String(file?.file_b64 ?? '').trim().replace(/^data:[^;]+;base64,/, ''),
      }))
      .filter((file) => file.file_b64)

    if (normalizedFiles.length === 0) {
      return NextResponse.json({ error: 'Uploaded files are invalid' }, { status: 400 })
    }

    const seenEmails = new Set<string>()
    const recipients = rawRecipients
      .map((recipient) => ({
        email: String(recipient?.email ?? '').trim().toLowerCase(),
        name: String(recipient?.name ?? '').trim(),
        company: String(recipient?.company ?? '').trim(),
        title: String(recipient?.title ?? '').trim(),
      }))
      .filter((recipient) => {
        if (!recipient.email) return false
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient.email)) return false
        if (seenEmails.has(recipient.email)) return false
        seenEmails.add(recipient.email)
        return true
      })

    if (recipients.length === 0) {
      return NextResponse.json({ error: 'At least one valid recipient is required' }, { status: 400 })
    }

    console.log('[API /esignature/signatures POST] Sending to webhook:', ESIGN_UPLOAD_WEBHOOK_URL)
    console.log('[API /esignature/signatures POST] Files count:', normalizedFiles.length)
    console.log('[API /esignature/signatures POST] Recipients:', recipients.map(r => r.email))

    const webhookPayload = {
      files: normalizedFiles,
      recipients: recipients.map((recipient) => recipient.email),
      recipient_details: recipients,
      user_id: userId || null,
    }

    const candidates = getWebhookCandidates(ESIGN_UPLOAD_WEBHOOK_URL)
    let lastStatus = 0
    let lastResponse = ''
    let usedWebhookUrl = candidates[0]

    for (let i = 0; i < candidates.length; i += 1) {
      const webhookUrl = candidates[i]
      usedWebhookUrl = webhookUrl

      const webhookRes = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(webhookPayload),
        cache: 'no-store',
      })

      const webhookText = await webhookRes.text().catch(() => '')
      const done = /\bdone\b/i.test(webhookText)
      lastStatus = webhookRes.status
      lastResponse = webhookText

      console.log('[API /esignature/signatures POST] Webhook response status:', webhookRes.status)
      console.log('[API /esignature/signatures POST] Webhook response text:', webhookText.substring(0, 200))

      if (webhookRes.ok) {
        return NextResponse.json({
          success: done,
          done,
          count: recipients.length,
          message: done ? 'Done' : 'Webhook response did not contain Done',
          webhookStatus: webhookRes.status,
          webhookResponse: webhookText,
          webhookUrl,
        })
      }

      const canRetryWithTestWebhook = i < candidates.length - 1 && webhookLooksUnregistered(webhookText)
      if (!canRetryWithTestWebhook) {
        break
      }
    }

    return NextResponse.json(
      {
        success: false,
        done: false,
        message: lastResponse || `Webhook error (${lastStatus || 502})`,
        webhookStatus: lastStatus || 502,
        webhookResponse: lastResponse,
        webhookUrl: usedWebhookUrl,
      },
      { status: 502 }
    )
  } catch (err: any) {
    console.error('[API /esignature/signatures POST] Error:', err)
    return NextResponse.json({ error: err?.message || 'Failed to send upload to webhook' }, { status: 500 })
  }
}
