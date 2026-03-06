import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

type VehicleRow = {
  id: string | null
  year: number | null
  make: string | null
  model: string | null
  exterior_color: string | null
  body_style: string | null
  key_number: string | number | null
  cylinders: string | number | null
  odometer: string | number | null
  odometer_unit: string | null
  price: string | number | null
  stock_number: string | null
  vehicle_type: string | null
  inventory_type: string | null
  certified: string | null
  status: string | null
  in_stock_date: string | null
  created_at: string | null
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

const normalizeFilterValue = (raw: string | null) => {
  const s = String(raw ?? '').trim()
  if (!s) return ''
  if (s.toLowerCase().includes('selected')) return ''
  return s
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const from = normalizeDateIso(url.searchParams.get('from'))
    const to = normalizeDateIso(url.searchParams.get('to'))
    const typeFilter = normalizeFilterValue(url.searchParams.get('type'))
    const statusFilter = normalizeFilterValue(url.searchParams.get('status'))
    const certFilter = normalizeFilterValue(url.searchParams.get('cert'))

    const supabaseUrl = String(process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '')
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ ok: false, error: 'Server not configured' }, { status: 500 })
    }

    const select = [
      'id',
      'year',
      'make',
      'model',
      'exterior_color',
      'body_style',
      'key_number',
      'cylinders',
      'odometer',
      'odometer_unit',
      'price',
      'stock_number',
      'vehicle_type',
      'inventory_type',
      'certified',
      'status',
      'in_stock_date',
      'created_at',
    ].join(',')

    const qs: string[] = [`select=${encodeURIComponent(select)}`, 'order=created_at.desc', 'limit=5000']
    if (statusFilter) qs.push(`status=eq.${encodeURIComponent(statusFilter)}`)

    const vehiclesUrl = `${supabaseUrl}/rest/v1/edc_vehicles?${qs.join('&')}`
    const res = await fetch(vehiclesUrl, {
      method: 'GET',
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
      },
      cache: 'no-store',
    })

    const text = await res.text().catch(() => '')
    if (!res.ok) {
      return NextResponse.json({ ok: false, error: text || `Failed to fetch vehicles (${res.status})` }, { status: 500 })
    }

    let vehicles: VehicleRow[] = []
    try {
      vehicles = JSON.parse(text)
    } catch {
      vehicles = []
    }

    const rows = (vehicles || [])
      .filter((v) => {
        const baseDate = normalizeDateIso(v?.in_stock_date || v?.created_at)
        if (from && baseDate && baseDate < from) return false
        if (to && baseDate && baseDate > to) return false
        return true
      })
      .filter((v) => {
        if (!typeFilter) return true
        const t = String(v?.vehicle_type ?? v?.inventory_type ?? '').trim()
        return t.toLowerCase() === typeFilter.toLowerCase()
      })
      .filter((v) => {
        if (!certFilter) return true
        const raw = String(v?.certified ?? '').trim()
        const label = raw && raw.toLowerCase().includes('cert') ? 'Certified' : 'As-Is'
        return label.toLowerCase() === certFilter.toLowerCase()
      })
      .map((v) => {
        const year = v?.year ? String(v.year) : ''
        const model = String(v?.model ?? '').trim() || String(v?.make ?? '').trim() || 'N/A'
        const colour = String(v?.exterior_color ?? '').trim() || 'N/A'
        const bodyStyle = String(v?.body_style ?? '').trim() || 'N/A'
        const keyNumber = Math.trunc(toNum(v?.key_number))
        const cyl = Math.trunc(toNum(v?.cylinders))

        const odo = toNum(v?.odometer)
        const unit = String(v?.odometer_unit ?? 'kms').trim() || 'kms'
        const odometer = odo ? `${odo.toLocaleString()} ${unit}` : 'N/A'

        const price = toNum(v?.price)
        const stockNumber = String(v?.stock_number ?? '').trim() || 'N/A'
        const type = String(v?.vehicle_type ?? v?.inventory_type ?? '').trim() || 'N/A'
        const certRaw = String(v?.certified ?? '').trim()
        const cert = certRaw && certRaw.toLowerCase().includes('cert') ? 'Certified' : 'As-Is'
        const status = String(v?.status ?? '').trim() || 'N/A'
        const dateRaw = v?.in_stock_date || v?.created_at
        const date = formatPrettyDate(dateRaw) || 'N/A'

        return {
          id: String(v?.id ?? stockNumber),
          year,
          model,
          colour,
          bodyStyle,
          keyNumber,
          cyl,
          odometer,
          price,
          stockNumber,
          type,
          cert,
          status,
          date,
        }
      })

    return NextResponse.json({ ok: true, rows }, { status: 200 })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || 'Server error' }, { status: 500 })
  }
}
