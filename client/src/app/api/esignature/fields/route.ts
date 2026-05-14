import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

const baseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '')
const apiKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const headers = () => ({
  apikey: apiKey!,
  Authorization: `Bearer ${apiKey}`,
  'Content-Type': 'application/json',
  Prefer: 'return=representation',
})

const numberOrZero = (value: unknown) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

const fieldStorageKey = (fieldId: unknown, recipientIndex: unknown = 0, fileIndex: unknown = 0) =>
  `${String(fieldId ?? '')}::r${numberOrZero(recipientIndex)}::f${numberOrZero(fileIndex)}`

// GET /api/esignature/fields?dealId=xxx
// Returns all fields for a deal, each as its own row, merged into a single fields array
export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const dealId = url.searchParams.get('dealId')
    if (!dealId) return NextResponse.json({ error: 'dealId is required' }, { status: 400 })

    const res = await fetch(
      `${baseUrl}/rest/v1/edc_esignature_fields?deal_id=eq.${encodeURIComponent(dealId)}&select=*&order=id.asc`,
      { method: 'GET', headers: headers(), cache: 'no-store' }
    )

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(text || `Failed to fetch fields (${res.status})`)
    }

    const rows: any[] = await res.json()

    if (!rows || rows.length === 0) {
      return NextResponse.json({ fields: [] }, {
        headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0' },
      })
    }

    // Each row is one field. Build the fields array from individual rows.
    // If the row has a field_id, it's the new per-row format.
    // Fall back to fields_data JSON blob if field_id is null (legacy).
    const hasPerRowFields = rows.some(r => r.field_id)

    let fields: any[] = []

    if (hasPerRowFields) {
      fields = rows
        .filter(r => r.field_id)
        .map(r => ({
          id: r.field_id,
          type: r.field_type,
          x: Number(r.x),
          y: Number(r.y),
          width: Number(r.width),
          height: Number(r.height),
          page: r.page,
          fileIndex: r.file_index ?? 0,
          recipientIndex: r.recipient_index ?? 0,
          value: r.value ?? undefined,
        }))
    } else {
      // Legacy: single row with fields_data blob
      const row = rows[0]
      fields = row.fields_data ? JSON.parse(row.fields_data) : []
    }

    return NextResponse.json({ fields }, {
      headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0' },
    })
  } catch (err: any) {
    console.error('[API /esignature/fields GET] Error:', err)
    return NextResponse.json({ error: err?.message || 'Failed to fetch fields' }, { status: 500 })
  }
}

// POST /api/esignature/fields
// Body: { dealId, fields: Field[] }
// Saves each field as its own row in edc_esignature_fields
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { dealId, fields } = body

    if (!dealId) return NextResponse.json({ error: 'dealId is required' }, { status: 400 })
    if (!Array.isArray(fields)) return NextResponse.json({ error: 'fields must be an array' }, { status: 400 })

    const existingRes = await fetch(
      `${baseUrl}/rest/v1/edc_esignature_fields?deal_id=eq.${encodeURIComponent(dealId)}&select=field_id,value,signed_at,recipient_index,file_index`,
      { method: 'GET', headers: headers(), cache: 'no-store' }
    )
    const existingRows: any[] = existingRes.ok ? await existingRes.json().catch(() => []) : []
    const existingByFieldId = new Map<string, { value: unknown; signed_at: unknown }>()
    for (const row of existingRows) {
      const fieldId = String(row?.field_id ?? '').trim()
      if (!fieldId) continue
      existingByFieldId.set(fieldStorageKey(fieldId, row?.recipient_index, row?.file_index), { value: row?.value, signed_at: row?.signed_at })
    }

    // Delete all existing field rows for this deal, then re-insert
    const delRes = await fetch(
      `${baseUrl}/rest/v1/edc_esignature_fields?deal_id=eq.${encodeURIComponent(dealId)}`,
      { method: 'DELETE', headers: headers() }
    )
    if (!delRes.ok) {
      const text = await delRes.text().catch(() => '')
      throw new Error(text || `Failed to clear existing fields (${delRes.status})`)
    }

    if (fields.length === 0) {
      return NextResponse.json({ success: true })
    }

    // Insert one row per field with all positional + metadata columns
    const now = new Date().toISOString()
    const rows = fields.map((f: any) => {
      const fileIndex = numberOrZero(f.fileIndex)
      const recipientIndex = numberOrZero(f.recipientIndex)
      const existing = existingByFieldId.get(fieldStorageKey(f.id, recipientIndex, fileIndex))
      const incomingValue = f.value
      const hasIncomingValue = incomingValue !== null && incomingValue !== undefined && String(incomingValue).trim() !== ''
      const preservedValue = hasIncomingValue ? incomingValue : existing?.value ?? null
      return {
        deal_id: dealId,
        field_id: f.id,
        field_type: f.type,
        page: f.page ?? 1,
        x: f.x,
        y: f.y,
        width: f.width,
        height: f.height,
        file_index: fileIndex,
        recipient_index: recipientIndex,
        value: preservedValue,
        signed_at: hasIncomingValue ? f.signedAt ?? f.signed_at ?? existing?.signed_at ?? null : existing?.signed_at ?? null,
        // Also store full fields_data blob for backward compat (only on first row)
        fields_data: null,
        created_at: now,
        updated_at: now,
      }
    })

    const insertRes = await fetch(`${baseUrl}/rest/v1/edc_esignature_fields`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(rows),
    })

    if (!insertRes.ok) {
      const text = await insertRes.text().catch(() => '')
      throw new Error(text || `Failed to insert fields (${insertRes.status})`)
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('[API /esignature/fields POST] Error:', err)
    return NextResponse.json({ error: err?.message || 'Failed to save fields' }, { status: 500 })
  }
}

// PATCH /api/esignature/fields
// Body: { dealId, fieldId, value, signedAt?, recipientIndex?, fileIndex? }
// Updates the value of a single field row
export async function PATCH(request: Request) {
  try {
    const body = await request.json()
    const { dealId, fieldId, value, signedAt } = body

    if (!dealId || !fieldId) {
      return NextResponse.json({ error: 'dealId and fieldId are required' }, { status: 400 })
    }

    const payload: Record<string, any> = {
      value,
      updated_at: new Date().toISOString(),
    }
    if (signedAt) payload.signed_at = signedAt

    const filters = [
      `deal_id=eq.${encodeURIComponent(dealId)}`,
      `field_id=eq.${encodeURIComponent(fieldId)}`,
    ]
    if (body.recipientIndex !== undefined && body.recipientIndex !== null) {
      filters.push(`recipient_index=eq.${encodeURIComponent(String(numberOrZero(body.recipientIndex)))}`)
    }
    if (body.fileIndex !== undefined && body.fileIndex !== null) {
      filters.push(`file_index=eq.${encodeURIComponent(String(numberOrZero(body.fileIndex)))}`)
    }

    const res = await fetch(
      `${baseUrl}/rest/v1/edc_esignature_fields?${filters.join('&')}`,
      { method: 'PATCH', headers: headers(), body: JSON.stringify(payload) }
    )

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(text || `Failed to update field value (${res.status})`)
    }

    const updatedRows = await res.json().catch(() => [])
    if (Array.isArray(updatedRows) && updatedRows.length === 0) {
      const now = new Date().toISOString()
      const insertPayload = {
        deal_id: dealId,
        field_id: fieldId,
        field_type: body.fieldType ?? body.type ?? 'signature',
        page: body.page ?? 1,
        x: body.x ?? 0,
        y: body.y ?? 0,
        width: body.width ?? 0,
        height: body.height ?? 0,
        file_index: numberOrZero(body.fileIndex),
        recipient_index: numberOrZero(body.recipientIndex),
        value,
        signed_at: signedAt ?? null,
        fields_data: null,
        created_at: now,
        updated_at: now,
      }

      const insertRes = await fetch(`${baseUrl}/rest/v1/edc_esignature_fields`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify(insertPayload),
      })

      if (!insertRes.ok) {
        const text = await insertRes.text().catch(() => '')
        throw new Error(text || `Failed to insert field value (${insertRes.status})`)
      }
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('[API /esignature/fields PATCH] Error:', err)
    return NextResponse.json({ error: err?.message || 'Failed to update field' }, { status: 500 })
  }
}
