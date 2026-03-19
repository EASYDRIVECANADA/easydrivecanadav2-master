import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

const normalizeDateIso = (raw: unknown) => {
  const s = String(raw ?? '').trim()
  if (!s) return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return ''
  return d.toISOString().slice(0, 10)
}

const formatDateYYYYMMDD = (raw: unknown) => {
  const iso = normalizeDateIso(raw)
  if (!iso) return ''
  return iso.replaceAll('-', '/')
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const userId = String(url.searchParams.get('userId') ?? '').trim()
    const from = normalizeDateIso(url.searchParams.get('from'))
    const to = normalizeDateIso(url.searchParams.get('to'))
    const transactionTypeFilter = String(url.searchParams.get('transactionType') ?? '').trim()
    const provinceFilter = String(url.searchParams.get('province') ?? '').trim()
    const countryFilter = String(url.searchParams.get('country') ?? '').trim()

    const supabaseUrl = String(process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '')
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ ok: false, error: 'Server not configured' }, { status: 500 })
    }

    const h: Record<string, string> = {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
    }

    // 1. Fetch customers filtered by userId
    const customerSelect = [
      'id', 'dealdate', 'firstname', 'lastname',
      'province', 'country', 'dealtype', 'dealmode', 'user_id',
    ].join(',')

    const custQs: string[] = [
      `select=${encodeURIComponent(customerSelect)}`,
      'limit=5000',
    ]
    if (userId) custQs.push(`user_id=eq.${encodeURIComponent(userId)}`)

    const custRes = await fetch(`${supabaseUrl}/rest/v1/edc_deals_customers?${custQs.join('&')}`, {
      method: 'GET',
      headers: h,
      cache: 'no-store',
    })
    const custText = await custRes.text().catch(() => '')
    if (!custRes.ok) {
      return NextResponse.json(
        { ok: false, error: custText || `Failed to fetch customers (${custRes.status})` },
        { status: 500 }
      )
    }

    let customers: any[] = []
    try { customers = JSON.parse(custText) } catch { customers = [] }

    // 2. Filter by date range in JS (handles various date formats)
    customers = customers.filter((c) => {
      const iso = normalizeDateIso(c.dealdate ?? c.deal_date)
      if (!iso) return true
      if (from && iso < from) return false
      if (to && iso > to) return false
      return true
    })

    const dealIds = Array.from(
      new Set(customers.map((c: any) => String(c.id ?? '')).filter(Boolean))
    )

    // 3. Fetch vehicles and worksheets in parallel
    const vehiclesByDeal: Record<string, any> = {}
    const worksheetsByDeal: Record<string, any> = {}

    if (dealIds.length) {
      const inList = `(${dealIds.map((id) => `"${String(id).replaceAll('"', '')}"`).join(',')})`

      const [vRes, wRes] = await Promise.all([
        fetch(
          `${supabaseUrl}/rest/v1/edc_deals_vehicles?select=id,selected_vin&id=in.${encodeURIComponent(inList)}`,
          { method: 'GET', headers: h, cache: 'no-store' }
        ),
        fetch(
          `${supabaseUrl}/rest/v1/edc_deals_worksheet?select=id,deal_type,deal_mode&id=in.${encodeURIComponent(inList)}`,
          { method: 'GET', headers: h, cache: 'no-store' }
        ),
      ])

      if (vRes.ok) {
        let vehicles: any[] = []
        try { vehicles = JSON.parse(await vRes.text()) } catch { vehicles = [] }
        for (const v of vehicles) {
          const did = String(v.id ?? '')
          if (did) vehiclesByDeal[did] = v
        }
      }

      if (wRes.ok) {
        let worksheets: any[] = []
        try { worksheets = JSON.parse(await wRes.text()) } catch { worksheets = [] }
        for (const w of worksheets) {
          const did = String(w.id ?? '')
          if (did) worksheetsByDeal[did] = w
        }
      }
    }

    // 4. Fetch dealership info and owner name
    let dealerInfo = {
      company_name: '',
      mvda_number: '',
      full_name: '',
      position: 'Owner',
    }

    if (userId) {
      const [dealerRes, ownerRes] = await Promise.all([
        fetch(
          `${supabaseUrl}/rest/v1/dealership?select=company_name,mvda_number&user_id=eq.${encodeURIComponent(userId)}&limit=1`,
          { method: 'GET', headers: h, cache: 'no-store' }
        ),
        fetch(
          `${supabaseUrl}/rest/v1/edc_account_verifications?select=full_name&id=eq.${encodeURIComponent(userId)}&limit=1`,
          { method: 'GET', headers: h, cache: 'no-store' }
        ),
      ])

      if (dealerRes.ok) {
        let d: any[] = []
        try { d = JSON.parse(await dealerRes.text()) } catch { d = [] }
        if (d[0]) {
          dealerInfo.company_name = String(d[0].company_name ?? '')
          dealerInfo.mvda_number = String(d[0].mvda_number ?? '')
        }
      }

      if (ownerRes.ok) {
        let o: any[] = []
        try { o = JSON.parse(await ownerRes.text()) } catch { o = [] }
        if (o[0]) dealerInfo.full_name = String(o[0].full_name ?? '')
      }
    }

    // 5. Build rows
    const rows = customers
      .map((c: any) => {
        const did = String(c.id ?? '')
        const vehicle = vehiclesByDeal[did]
        const worksheet = worksheetsByDeal[did]

        const firstName = String(c.firstname ?? '').trim()
        const lastName = String(c.lastname ?? '').trim()
        const customerName = [firstName, lastName].filter(Boolean).join(' ')

        const dealDateRaw = c.dealdate ?? c.deal_date ?? ''
        const dateFormatted = formatDateYYYYMMDD(dealDateRaw)

        const province = String(c.province ?? '').trim()
        const country = String(c.country ?? 'CA').trim()

        const dealMode = String(worksheet?.deal_mode ?? c?.dealmode ?? '').trim()
        const txType = dealMode.toUpperCase() === 'WHL' ? 'Wholesale' : 'Retail'

        const dealType = String(worksheet?.deal_type ?? c?.dealtype ?? '').trim()
        const saleType = dealType || 'Cash'

        const vin = String(vehicle?.selected_vin ?? '').trim()

        return {
          id: did,
          dealId: did.length > 8 ? did.slice(0, 8).toUpperCase() : did.toUpperCase(),
          date: dateFormatted,
          __date_iso: normalizeDateIso(dealDateRaw),
          transactionType: txType,
          saleType,
          customerName,
          province,
          country,
          vin,
          exported: 'No',
          exportedAs: '',
          count: 1,
        }
      })
      .filter((r) => {
        if (
          transactionTypeFilter &&
          r.transactionType.toLowerCase() !== transactionTypeFilter.toLowerCase()
        ) return false
        if (provinceFilter && r.province.toUpperCase() !== provinceFilter.toUpperCase()) return false
        if (countryFilter && r.country.toUpperCase() !== countryFilter.toUpperCase()) return false
        return true
      })

    return NextResponse.json({ ok: true, rows, dealerInfo }, { status: 200 })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || 'Server error' }, { status: 500 })
  }
}
