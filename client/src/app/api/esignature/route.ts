import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

const baseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '')
const apiKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

async function queryAll(table: string) {
  const res = await fetch(`${baseUrl}/rest/v1/${table}?order=created_at.desc`, {
    method: 'GET',
    headers: { 'apikey': apiKey!, 'Authorization': `Bearer ${apiKey}` },
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`Failed to fetch ${table}: ${res.status}`)
  return res.json()
}

function getDealId(row: any): string {
  return String(row.dealid ?? row.dealId ?? row.deal_id ?? row.id ?? '')
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const userIdParam = url.searchParams.get('user_id')
    
    if (!userIdParam) {
      return NextResponse.json({ error: 'user_id is required' }, { status: 400 })
    }

    const [customers, vehicles, worksheets, deliveries] = await Promise.all([
      queryAll('edc_deals_customers'),
      queryAll('edc_deals_vehicles'),
      queryAll('edc_deals_worksheet'),
      queryAll('edc_deals_delivery'),
    ])

    const vehiclesByDeal: Record<string, any[]> = {}
    for (const v of vehicles) {
      const did = getDealId(v)
      if (!did) continue
      if (!vehiclesByDeal[did]) vehiclesByDeal[did] = []
      vehiclesByDeal[did].push(v)
    }

    const worksheetByDeal: Record<string, any> = {}
    for (const w of worksheets) {
      const did = getDealId(w)
      if (did) worksheetByDeal[did] = w
    }

    const deliveryByDeal: Record<string, any> = {}
    for (const d of deliveries) {
      const did = getDealId(d)
      if (did) deliveryByDeal[did] = d
    }

    const filteredCustomers = customers.filter((c: any) => {
      const customerUserId = String(c.user_id ?? '').trim()
      return customerUserId && customerUserId === userIdParam
    })

    const documents = filteredCustomers.map((c: any) => {
      const did = getDealId(c)
      const vList = vehiclesByDeal[did] || []
      const delivery = deliveryByDeal[did] || null
      const worksheet = worksheetByDeal[did] || null

      let vehicleTitle = ''
      if (vList.length > 0) {
        const v = vList[0]
        const yr = v.selected_year ?? v.year ?? ''
        const mk = v.selected_make ?? v.make ?? ''
        const md = v.selected_model ?? v.model ?? ''
        const tr = v.selected_trim ?? v.trim ?? ''
        const parts = [yr, mk, md, tr].filter(Boolean)
        vehicleTitle = parts.join(' ')
      }

      const customerName = [c.firstname, c.lastname].filter(Boolean).join(' ') || c.displayname || c.legalname || ''
      const customerEmail = String(c.email ?? '').trim().toLowerCase()

      const dealType = String(c.dealtype ?? '').trim()
      const documentTitle = vehicleTitle 
        ? `${dealType === 'Finance' ? 'Finance Agreement' : 'Bill of Sale'} - ${vehicleTitle}`
        : `${dealType === 'Finance' ? 'Finance Agreement' : 'Bill of Sale'}`

      const state = String(
        c.deal_state ?? c.dealState ?? c.dealstate ?? c.state ??
        worksheet?.deal_state ?? worksheet?.dealState ?? worksheet?.dealstate ??
        delivery?.deal_state ?? delivery?.dealState ?? delivery?.dealstate ??
        ''
      ).trim()

      const createdDate = c.created_at || c.dealdate || new Date().toISOString()
      const lastModified = c.updated_at || c.created_at || new Date().toISOString()

      const hasCustomerSignature = Boolean(String(c.signature ?? '').trim())

      let status: 'draft' | 'sent' | 'completed' | 'declined' | 'expired' = 'draft'
      const signatureStatus = String(delivery?.signature_status ?? '').toLowerCase().trim()

      if (hasCustomerSignature) {
        status = 'completed'
      } else if (signatureStatus === 'completed' || signatureStatus === 'signed') {
        status = 'completed'
      } else if (signatureStatus === 'declined') {
        status = 'declined'
      } else if (signatureStatus === 'expired') {
        status = 'expired'
      } else if (signatureStatus === 'sent' || signatureStatus === 'pending') {
        status = 'sent'
      } else if (state.toLowerCase() === 'closed') {
        status = 'completed'
      } else if (state.toLowerCase() === 'pending') {
        status = 'sent'
      }

      const totalSigners = 2
      const completedSigners = status === 'completed' ? totalSigners : 0

      return {
        id: did,
        dealId: did,
        title: documentTitle,
        recipient: customerEmail || customerName,
        recipientName: customerName,
        status,
        createdDate,
        lastModified,
        signers: totalSigners,
        completedSigners,
        dealType,
        state,
        vehicle: vehicleTitle,
      }
    })

    return NextResponse.json({ documents }, {
      headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0' },
    })
  } catch (err: any) {
    console.error('[API /esignature] Error:', err)
    return NextResponse.json({ error: err?.message || 'Failed to fetch signature documents' }, { status: 500 })
  }
}
