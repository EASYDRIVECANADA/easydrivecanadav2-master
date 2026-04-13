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

    if (deal_id)
      payload.deal_id = deal_id

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
        .map((f: any) =>
          fetch(
            `${baseUrl}/rest/v1/edc_esignature_fields?deal_id=eq.${encodeURIComponent(deal_id)}&field_id=eq.${encodeURIComponent(f.id)}`,
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
        )
      await Promise.all(fieldUpdates)
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to complete signature' }, { status: 500 })
  }
}
