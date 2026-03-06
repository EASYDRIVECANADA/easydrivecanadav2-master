import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

type CostRow = {
  id: string | number | null
  created_at: string | null
  stock_number: string | null
  name: string | null
  description: string | null
  vendor: string | null
  invoice_reference: string | null
  amount: string | number | null
  quantity: string | number | null
  discount: string | number | null
  tax: string | number | null
  tax_type: string | null
  total: string | number | null
}

type VehicleRow = {
  stock_number: string | null
  year: number | null
  make: string | null
  model: string | null
  trim: string | null
  vin: string | null
  status: string | null
}

const toNum = (v: unknown) => {
  if (v === null || v === undefined || v === '') return 0
  const n = typeof v === 'number' ? v : Number(String(v).replace(/[^0-9.-]/g, ''))
  return Number.isFinite(n) ? n : 0
}

const formatPrettyDate = (raw: unknown) => {
  const s = String(raw ?? '').trim()
  if (!s) return ''
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return s
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

const splitStatuses = (raw: string | null) => {
  const s = String(raw ?? '').trim()
  if (!s) return [] as string[]
  return s
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const statusRaw = url.searchParams.get('status')
    const statuses = splitStatuses(statusRaw)
    const perPage = Math.max(1, Number(url.searchParams.get('perPage') ?? '50') || 50)

    const supabaseUrl = String(process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '')
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ ok: false, error: 'Server not configured' }, { status: 500 })
    }

    const costSelect = [
      'id',
      'created_at',
      'stock_number',
      'name',
      'description',
      'vendor',
      'invoice_reference',
      'amount',
      'quantity',
      'discount',
      'tax',
      'tax_type',
      'total',
    ].join(',')

    const costsUrl = `${supabaseUrl}/rest/v1/edc_costs?select=${encodeURIComponent(costSelect)}&order=created_at.desc&limit=${encodeURIComponent(String(Math.min(5000, Math.max(50, perPage * 20))))}`
    const cRes = await fetch(costsUrl, {
      method: 'GET',
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
      },
      cache: 'no-store',
    })

    const cText = await cRes.text().catch(() => '')
    if (!cRes.ok) {
      return NextResponse.json({ ok: false, error: cText || `Failed to fetch costs (${cRes.status})` }, { status: 500 })
    }

    let costs: CostRow[] = []
    try {
      costs = JSON.parse(cText)
    } catch {
      costs = []
    }

    const stockNumbers = Array.from(
      new Set(
        (costs || [])
          .map((c) => String(c?.stock_number ?? '').trim())
          .filter(Boolean)
      )
    )

    const vehiclesByStock = new Map<string, VehicleRow>()
    if (stockNumbers.length) {
      const vehicleSelect = ['stock_number', 'year', 'make', 'model', 'trim', 'vin', 'status'].join(',')
      const inList = `(${stockNumbers.map((s) => `"${String(s).replaceAll('"', '')}"`).join(',')})`
      const vehiclesUrl = `${supabaseUrl}/rest/v1/edc_vehicles?select=${encodeURIComponent(vehicleSelect)}&stock_number=in.${encodeURIComponent(inList)}`

      const vRes = await fetch(vehiclesUrl, {
        method: 'GET',
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
        },
        cache: 'no-store',
      })

      const vText = await vRes.text().catch(() => '')
      if (vRes.ok) {
        let vehicles: VehicleRow[] = []
        try {
          vehicles = JSON.parse(vText)
        } catch {
          vehicles = []
        }

        for (const v of vehicles) {
          const sn = String(v?.stock_number ?? '').trim()
          if (sn) vehiclesByStock.set(sn, v)
        }
      }
    }

    const rows = (costs || [])
      .map((c) => {
        const sn = String(c?.stock_number ?? '').trim()
        const v = sn ? vehiclesByStock.get(sn) : undefined

        const date = formatPrettyDate(c?.created_at) || 'N/A'
        const name = String(c?.name ?? '').trim() || 'N/A'
        const description = String(c?.description ?? '').trim() || '-'
        const invoice = String(c?.invoice_reference ?? '').trim() || 'N/A'
        const vendor = String(c?.vendor ?? '').trim() || 'N/A'

        const year = v?.year ? String(v.year) : ''
        const make = String(v?.make ?? '').trim()
        const model = String(v?.model ?? '').trim()
        const trim = String(v?.trim ?? '').trim()
        const vin = String(v?.vin ?? '').trim()

        const vehicle = [
          sn ? `Stock # ${sn}` : 'Stock #',
          [year, make, model, trim].filter(Boolean).join(' '),
          vin ? `: ${vin}` : '',
        ]
          .filter(Boolean)
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim()

        const amount = toNum(c?.amount)
        const qty = Math.max(1, toNum(c?.quantity) || 1)
        const discount = toNum(c?.discount)
        const tax = toNum(c?.tax)

        const subtotal = Math.max(0, amount * qty - discount)
        const total = toNum(c?.total) || Math.max(0, subtotal + tax)

        const taxType = String(c?.tax_type ?? '').trim()
        const hst13 = taxType.toUpperCase() === 'HST' ? tax : 0
        const exempt0 = taxType.toLowerCase() === 'exempt' ? tax : 0

        return {
          id: String(c?.id ?? `${sn}-${c?.created_at ?? Math.random()}`),
          __vehicle_status: String(v?.status ?? ''),
          date,
          name,
          description,
          vehicle: vehicle || 'N/A',
          invoice,
          vendor,
          subtotal,
          hst13,
          exempt0,
          total,
        }
      })
      .filter((r) => {
        if (!statuses.length) return true
        const s = String((r as any)?.__vehicle_status ?? '').trim()
        if (!s) return true
        return statuses.some((x) => x.toLowerCase() === s.toLowerCase())
      })
      .slice(0, perPage)

    return NextResponse.json({ ok: true, rows }, { status: 200 })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || 'Server error' }, { status: 500 })
  }
}
