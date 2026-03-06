import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

type PurchaseRow = {
  id: string | null
  stock_number: string | null
  purchased_on: string | null
  vendor_name: string | null
  vendor_company: string | null
  vendor_location: string | null
  vendor_apt_suite: string | null
  vendor_city: string | null
  vendor_province: string | null
  vendor_postal_code: string | null
  plate_number: string | null
  sale_status: string | null
  sale_state: string | null
  updated_at: string | null
}

type VehicleRow = {
  stock_number: string | null
  make: string | null
  model: string | null
  vin: string | null
  exterior_color: string | null
  in_stock_date: string | null
  created_at: string | null
  odometer: string | number | null
  odometer_unit: string | null
  status: string | null
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

const toNum = (v: unknown) => {
  if (v === null || v === undefined || v === '') return 0
  const n = typeof v === 'number' ? v : Number(String(v).replace(/[^0-9.-]/g, ''))
  return Number.isFinite(n) ? n : 0
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
    const filterType = String(url.searchParams.get('filterType') ?? 'Purchased Between').trim()
    const perPage = Math.max(1, Number(url.searchParams.get('perPage') ?? '150') || 150)

    const supabaseUrl = String(process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '')
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ ok: false, error: 'Server not configured' }, { status: 500 })
    }

    const purchaseSelect = [
      'id',
      'stock_number',
      'purchased_on',
      'vendor_name',
      'vendor_company',
      'vendor_location',
      'vendor_apt_suite',
      'vendor_city',
      'vendor_province',
      'vendor_postal_code',
      'plate_number',
      'sale_status',
      'sale_state',
      'updated_at',
    ].join(',')

    const purchaseQs: string[] = [`select=${encodeURIComponent(purchaseSelect)}`]
    purchaseQs.push('order=purchased_on.desc')
    purchaseQs.push(`limit=${encodeURIComponent(String(Math.min(5000, Math.max(50, perPage * 20))))}`)

    const purchaseUrl = `${supabaseUrl}/rest/v1/edc_purchase?${purchaseQs.join('&')}`
    const pRes = await fetch(purchaseUrl, {
      method: 'GET',
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
      },
      cache: 'no-store',
    })

    const pText = await pRes.text().catch(() => '')
    if (!pRes.ok) {
      return NextResponse.json({ ok: false, error: pText || `Failed to fetch purchases (${pRes.status})` }, { status: 500 })
    }

    let purchases: PurchaseRow[] = []
    try {
      purchases = JSON.parse(pText)
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
      const vehicleSelect = [
        'stock_number',
        'make',
        'model',
        'vin',
        'exterior_color',
        'in_stock_date',
        'created_at',
        'odometer',
        'odometer_unit',
        'status',
      ].join(',')

      const inList = `(${stockNumbers.map((s) => `"${String(s).replaceAll('"', '')}"`).join(',')})`
      const vQs = [`select=${encodeURIComponent(vehicleSelect)}`, `stock_number=in.${encodeURIComponent(inList)}`]
      const vUrl = `${supabaseUrl}/rest/v1/edc_vehicles?${vQs.join('&')}`

      const vRes = await fetch(vUrl, {
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

    const rowsAll = (purchases || [])
      .map((p) => {
        const stock = String(p?.stock_number ?? '').trim()
        const v = stock ? vehiclesByStock.get(stock) : undefined

        const purchasedFromName = String(p?.vendor_name ?? p?.vendor_company ?? '').trim() || 'N/A'

        const addrParts = [
          p?.vendor_location,
          p?.vendor_apt_suite,
          p?.vendor_city,
          p?.vendor_province,
          p?.vendor_postal_code,
        ]
          .map((x) => String(x ?? '').trim())
          .filter(Boolean)

        const purchasedFromAddress = addrParts.join(' ').replace(/\s+/g, ' ').trim() || 'N/A'

        const plateNo = String(p?.plate_number ?? '').trim() || 'N/A'

        const odo = toNum(v?.odometer)
        const unit = String(v?.odometer_unit ?? 'kms').trim() || 'kms'
        const odometerReading = odo ? `${odo.toLocaleString()} ${unit}` : 'N/A'

        const make = String(v?.make ?? '').trim() || 'N/A'
        const model = String(v?.model ?? '').trim() || 'N/A'
        const serialNo = String(v?.vin ?? '').trim() || 'N/A'
        const colour = String(v?.exterior_color ?? '').trim() || 'N/A'

        const dateInRaw = p?.purchased_on || v?.in_stock_date || v?.created_at
        const dateInStock = formatPrettyDate(dateInRaw) || 'N/A'

        const inConsignment = ''

        const vehicleStatus = String(v?.status ?? '').trim()
        const isSold = vehicleStatus.toLowerCase() === 'sold'

        const dateOutRaw = isSold ? (p?.updated_at || v?.created_at) : ''
        const dateOut = dateOutRaw ? (formatPrettyDate(dateOutRaw) || '') : ''

        const soldToName = ''
        const soldToAddress = ''

        return {
          id: String(p?.id ?? stock ?? Math.random()),
          __vehicle_status: vehicleStatus,
          __purchased_on_iso: normalizeDateIso(p?.purchased_on),
          __sold_date_iso: normalizeDateIso(dateOutRaw),
          purchasedFromName,
          purchasedFromAddress,
          plateNo,
          odometerReading,
          make,
          model,
          stockNumber: stock || 'N/A',
          serialNo,
          colour,
          dateInStock,
          inConsignment,
          dateOut,
          soldToName,
          soldToAddress,
        }
      })
      .filter((r) => {
        if (!statuses.length) return true
        const s = String((r as any)?.__vehicle_status ?? '').trim()
        if (!s) return true
        return statuses.some((x) => x.toLowerCase() === s.toLowerCase())
      })
      .filter((r) => {
        const iso = filterType.toLowerCase().includes('sold')
          ? String((r as any)?.__sold_date_iso ?? '').trim()
          : String((r as any)?.__purchased_on_iso ?? '').trim()
        return Boolean(iso) || true
      })

    const rows = rowsAll.slice(0, perPage)

    return NextResponse.json({ ok: true, rows }, { status: 200 })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || 'Server error' }, { status: 500 })
  }
}
