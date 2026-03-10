import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

const baseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '')
const apiKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

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

    console.log('[API /esignature/signatures] user_id:', userIdParam)

    if (!userIdParam) {
      return NextResponse.json({ error: 'user_id is required' }, { status: 400 })
    }

    // Query signature table filtered by user_id
    const queryUrl = `${baseUrl}/rest/v1/signature?user_id=eq.${encodeURIComponent(userIdParam)}&order=created_at.desc`
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

      return {
        id: r.id,
        dealId: r.id,
        title: r.document_file ? `Document - ${r.document_file.substring(0, 30)}...` : 'Untitled Document',
        recipient: r.email || '',
        recipientName: r.full_name || r.email || '',
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
