import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

type PurchaseRow = {
  id: string
  stock_number: string | null
  purchased_on: string | null
  purchase_price: number | null
  actual_cash_value: number | null
  discount: number | null
  tax_type: string | null
  tax_override: boolean | null
  vehicle_tax: number | null
  total_vehicle_tax: number | null
  vendor_name: string | null
  vendor_company: string | null
  purchased_through_auction: boolean | null
}

type VehicleRow = {
  stock_number: string | null
  year: number | null
  make: string | null
  model: string | null
  trim: string | null
  status: string | null
}

const toNum = (v: unknown) => {
  if (v === null || v === undefined || v === '') return 0
  const n = typeof v === 'number' ? v : Number(String(v).replace(/[^0-9.-]/g, ''))
  return Number.isFinite(n) ? n : 0
}

const normalizeDateIso = (raw: unknown) => {
  const s = String(raw ?? '').trim()
  if (!s) return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return ''
  return d.toISOString().slice(0, 10)
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
    const from = normalizeDateIso(url.searchParams.get('from'))
    const to = normalizeDateIso(url.searchParams.get('to'))
    const statusRaw = url.searchParams.get('status')
    const statuses = splitStatuses(statusRaw)

    const supabaseUrl = String(process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '')
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ ok: false, error: 'Server not configured' }, { status: 500 })
    }

    const purchaseSelect = [
      'id',
      'stock_number',
      'purchased_on',
      'purchase_price',
      'actual_cash_value',
      'discount',
      'tax_type',
      'tax_override',
      'vehicle_tax',
      'total_vehicle_tax',
      'vendor_name',
      'vendor_company',
      'purchased_through_auction',
    ].join(',')

    const purchaseFilters: string[] = [`select=${encodeURIComponent(purchaseSelect)}`]
    if (from) purchaseFilters.push(`purchased_on=gte.${encodeURIComponent(from)}`)
    if (to) purchaseFilters.push(`purchased_on=lte.${encodeURIComponent(to)}`)
    purchaseFilters.push('order=purchased_on.desc')
    purchaseFilters.push('limit=5000')

    const purchaseUrl = `${supabaseUrl}/rest/v1/edc_purchase?${purchaseFilters.join('&')}`
    const purchaseRes = await fetch(purchaseUrl, {
      method: 'GET',
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
      },
      cache: 'no-store',
    })

    const purchaseText = await purchaseRes.text().catch(() => '')
    if (!purchaseRes.ok) {
      return NextResponse.json(
        { ok: false, error: purchaseText || `Failed to fetch purchases (${purchaseRes.status})` },
        { status: 500 }
      )
    }

    let purchases: PurchaseRow[] = []
    try {
      purchases = JSON.parse(purchaseText)
    } catch {
      purchases = []
    }

    const stockNumbers = Array.from(
      new Set(
        (purchases || [])
          .map((p) => String(p?.stock_number ?? '').trim())
          .filter(Boolean)
      )
    )

    const vehiclesByStock = new Map<string, VehicleRow>()
    if (stockNumbers.length) {
      const vehicleSelect = ['stock_number', 'year', 'make', 'model', 'trim', 'status'].join(',')

      const inList = `(${stockNumbers.map((s) => `"${String(s).replaceAll('"', '')}"`).join(',')})`
      const vehicleQs = [`select=${encodeURIComponent(vehicleSelect)}`, `stock_number=in.${encodeURIComponent(inList)}`]
      const vehiclesUrl = `${supabaseUrl}/rest/v1/edc_vehicles?${vehicleQs.join('&')}`

      const vehiclesRes = await fetch(vehiclesUrl, {
        method: 'GET',
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
        },
        cache: 'no-store',
      })

      const vehiclesText = await vehiclesRes.text().catch(() => '')
      if (vehiclesRes.ok) {
        let vehicles: VehicleRow[] = []
        try {
          vehicles = JSON.parse(vehiclesText)
        } catch {
          vehicles = []
        }

        for (const v of vehicles) {
          const sn = String(v?.stock_number ?? '').trim()
          if (sn) vehiclesByStock.set(sn, v)
        }
      }
    }

    const rows = (purchases || [])
      .map((p) => {
        const sn = String(p?.stock_number ?? '').trim()
        const v = sn ? vehiclesByStock.get(sn) : undefined

        const year = v?.year ? String(v.year) : ''
        const make = String(v?.make ?? '').trim()
        const model = String(v?.model ?? '').trim()
        const trim = String(v?.trim ?? '').trim()
        const vehicleLabel = [
          sn ? `Stock#${sn}` : 'Stock#',
          [year, make, model, trim].filter(Boolean).join(' '),
        ]
          .filter(Boolean)
          .join(' - ')
          .replace(/\s+/g, ' ')
          .trim()

        const purchasedFrom = String(p?.vendor_name ?? p?.vendor_company ?? '').trim()
        const auction = ((): string => {
          const through = Boolean(p?.purchased_through_auction)
          const company = String(p?.vendor_company ?? '').trim()
          if (!through) return 'N/A'
          return company || 'Auction'
        })()

        const purchasedDate = formatPrettyDate(p?.purchased_on)

        const purchasePrice = toNum(p?.purchase_price)
        const actualCashValue = toNum(p?.actual_cash_value)
        const discount = toNum(p?.discount)

        const taxType = String(p?.tax_type ?? '').trim()
        const isOverride = Boolean(p?.tax_override)
        const vehicleTax = toNum(p?.vehicle_tax)
        const totalVehicleTax = toNum(p?.total_vehicle_tax)

        const hst13 = !isOverride && taxType.toUpperCase() === 'HST' ? totalVehicleTax || vehicleTax : 0
        const gst5 = !isOverride && taxType.toUpperCase() === 'GST' ? totalVehicleTax || vehicleTax : 0
        const qst9975 = !isOverride && taxType.toUpperCase() === 'QST' ? totalVehicleTax || vehicleTax : 0
        const taxExempt0 = !isOverride && taxType.toLowerCase() === 'exempt' ? 0 : 0
        const taxOverride = isOverride ? totalVehicleTax || vehicleTax : 0

        return {
          id: String(p?.id ?? sn ?? Math.random()),
          __vehicle_status: String(v?.status ?? ''),
          vehicle: vehicleLabel,
          purchasedFrom: purchasedFrom || 'N/A',
          auction,
          purchasedDate: purchasedDate || 'N/A',
          purchasedPrice: purchasePrice,
          actualCashValue,
          discount,
          hst13,
          taxOverride,
          gst5,
          qst9975,
          taxExempt0,
        }
      })
      .filter((r) => {
        if (!statuses.length) return true
        const s = String((r as any)?.__vehicle_status ?? '').trim()
        if (!s) return true
        return statuses.some((x) => x.toLowerCase() === s.toLowerCase())
      })

    return NextResponse.json({ ok: true, rows }, { status: 200 })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || 'Server error' }, { status: 500 })
  }
}
