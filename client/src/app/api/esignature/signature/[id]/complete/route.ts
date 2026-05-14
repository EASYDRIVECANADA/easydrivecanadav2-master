import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const baseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '')
const apiKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const hdrs = () => ({
  apikey: apiKey!,
  Authorization: `Bearer ${apiKey}`,
  'Content-Type': 'application/json',
  Prefer: 'return=representation',
})

const numberOrZero = (value: unknown) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

const requestIp = (request: Request, fallback?: unknown) =>
  String(
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-real-ip') ||
    request.headers.get('x-vercel-forwarded-for') ||
    request.headers.get('x-forwarded-for')?.split(',')[0] ||
    fallback ||
    ''
  ).trim()

const insertAuditEvent = async (payload: Record<string, unknown>) => {
  if (!baseUrl || !apiKey) return
  const res = await fetch(`${baseUrl}/rest/v1/edc_signature_events`, {
    method: 'POST',
    headers: hdrs(),
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
    if (res.status === 400 && (text.includes('schema cache') || text.includes('PGRST204') || text.includes('Could not find'))) {
      const legacyPayload = {
        signature_id: payload.signature_id,
        user_name: payload.user_name,
        user_email: payload.user_email,
        action: payload.action,
        activity: [
          payload.activity,
          payload.ip_address ? `IP: ${payload.ip_address}` : '',
          payload.user_agent ? `Device: ${payload.user_agent}` : '',
        ].filter(Boolean).join(' | '),
        status: payload.status,
        created_at: payload.created_at || new Date().toISOString(),
      }
      await fetch(`${baseUrl}/rest/v1/edc_signature_events`, {
        method: 'POST',
        headers: hdrs(),
        body: JSON.stringify(legacyPayload),
        cache: 'no-store',
      }).catch(() => null)
    }
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 })
    if (!baseUrl || !apiKey) return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })

    const body = await request.json()
    const {
      signature_image,
      signed_at,
      status,
      fields_data,        // full JSON string of all Field[] for this recipient
      recipient_index,    // which recipient signed (0 = primary, 1 = second, etc.)
      deal_id,            // the deal this signature belongs to
      user_name,
      user_email,
      ip_address,
      user_agent,
    } = body

    const now = new Date().toISOString()
    const signedAt = signed_at || now

    // Parse fields array
    let fields: any[] = []
    try {
      fields = fields_data ? (typeof fields_data === 'string' ? JSON.parse(fields_data) : fields_data) : []
    } catch { fields = [] }

    // Extract per-field-type values from the fields array
    const sigField     = fields.find((f: any) => f.type === 'signature')
    const initialField = fields.find((f: any) => f.type === 'initial')
    const stampField   = fields.find((f: any) => f.type === 'stamp')
    const dateField    = fields.find((f: any) => f.type === 'dateSigned')
    const nameField    = fields.find((f: any) => f.type === 'name')
    const companyField = fields.find((f: any) => f.type === 'company')
    const titleField   = fields.find((f: any) => f.type === 'title')
    const textField    = fields.find((f: any) => f.type === 'text')
    const checkField   = fields.find((f: any) => f.type === 'checkbox')

    // Build signature table payload — each recipient gets their own unique values
    const payload: Record<string, any> = {
      status: status || 'completed',
      updated_at: now,
      signed_at: signedAt,
      fields_data: typeof fields_data === 'string' ? fields_data : JSON.stringify(fields),
    }

    // Per-field-type columns — this is what makes each signature row unique
    if (signature_image || sigField?.value)
      payload.signature_image = signature_image || sigField?.value

    if (initialField?.value)
      payload.initial_image = initialField.value

    if (stampField?.value)
      payload.stamp_image = stampField.value

    if (dateField?.value)
      payload.date_signed = dateField.value

    if (nameField?.value)
      payload.name_value = nameField.value

    if (companyField?.value)
      payload.company_value = companyField.value

    if (titleField?.value)
      payload.title_value = titleField.value

    if (textField?.value)
      payload.text_value = textField.value

    if (checkField?.value !== undefined)
      payload.checkbox_value = checkField.value === 'true' || checkField.value === true

    if (recipient_index !== undefined && recipient_index !== null)
      payload.recipient_index = recipient_index

    // Update the signature row
    const res = await fetch(`${baseUrl}/rest/v1/signature?id=eq.${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: hdrs(),
      body: JSON.stringify(payload),
      cache: 'no-store',
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      return NextResponse.json(
        { error: `Failed to complete signature: ${res.status} ${text}` },
        { status: res.status }
      )
    }

    // Also update each individual field row in edc_esignature_fields with its value + signed_at
    if (deal_id && fields.length > 0) {
      const fieldUpdates = fields
        .filter((f: any) => f.id && f.value !== undefined && f.value !== null && f.value !== '')
        .map((f: any) => {
          const filters = [
            `deal_id=eq.${encodeURIComponent(deal_id)}`,
            `field_id=eq.${encodeURIComponent(f.id)}`,
          ]
          if (f.recipientIndex !== undefined && f.recipientIndex !== null) {
            filters.push(`recipient_index=eq.${encodeURIComponent(String(numberOrZero(f.recipientIndex)))}`)
          }
          if (f.fileIndex !== undefined && f.fileIndex !== null) {
            filters.push(`file_index=eq.${encodeURIComponent(String(numberOrZero(f.fileIndex)))}`)
          }

          return fetch(
            `${baseUrl}/rest/v1/edc_esignature_fields?${filters.join('&')}`,
            {
              method: 'PATCH',
              headers: hdrs(),
              body: JSON.stringify({
                value: f.value,
                signed_at: signedAt,
                updated_at: now,
              }),
            }
          ).catch(() => null)
        })
      await Promise.all(fieldUpdates)
    }

    const envelopeId = String(deal_id || id)
    const signerName = String(user_name || '').trim()
    const signerEmail = String(user_email || '').trim()
    const signedRecipientIndex = recipient_index !== undefined && recipient_index !== null
      ? numberOrZero(recipient_index)
      : numberOrZero(fields[0]?.recipientIndex)

    await insertAuditEvent({
      signature_id: envelopeId,
      deal_id: envelopeId,
      recipient_id: id,
      recipient_index: signedRecipientIndex,
      user_name: signerName || signerEmail || 'Recipient',
      user_email: signerEmail,
      action: 'Recipient Signed',
      activity: `${signerName || signerEmail || 'Recipient'} signed the document.`,
      status: 'Signed',
      ip_address: requestIp(request, ip_address),
      user_agent: String(user_agent || request.headers.get('user-agent') || ''),
      metadata: {
        field_count: fields.length,
      },
    })

    const groupRes = await fetch(
      `${baseUrl}/rest/v1/signature?deal_id=eq.${encodeURIComponent(envelopeId)}&select=id,status,signed_at`,
      { method: 'GET', headers: hdrs(), cache: 'no-store' }
    ).catch(() => null)
    if (groupRes?.ok) {
      const group = await groupRes.json().catch(() => [])
      const rows = Array.isArray(group) ? group : []
      const allComplete = rows.length > 0 && rows.every((row: any) => {
        const rowStatus = String(row?.status || '').toLowerCase()
        return row?.signed_at || rowStatus === 'completed' || rowStatus === 'signed'
      })
      if (allComplete) {
        await insertAuditEvent({
          signature_id: envelopeId,
          deal_id: envelopeId,
          user_name: signerName || signerEmail || 'Recipient',
          user_email: signerEmail,
          action: 'Envelope Completed',
          activity: `All ${rows.length} recipient(s) completed the envelope.`,
          status: 'Completed',
          ip_address: requestIp(request, ip_address),
          user_agent: String(user_agent || request.headers.get('user-agent') || ''),
          metadata: {
            recipient_count: rows.length,
          },
        })
      }
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to complete signature' }, { status: 500 })
  }
}
