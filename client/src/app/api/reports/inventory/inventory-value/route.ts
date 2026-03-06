import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

type VehicleRow = {
  id: string | null
  stock_number: string | null
  year: number | null
  make: string | null
  model: string | null
  trim: string | null
  vin: string | null
  status: string | null
  in_stock_date: string | null
  created_at: string | null
  price: string | number | null
  saleprice: string | number | null
  dii: string | null
}

type PurchaseRow = {
  id: string | null
  stock_number: string | null
  purchase_price: string | number | null
  actual_cash_value: string | number | null
  discount: string | number | null
  tax_type: string | null
  tax_override: boolean | null
  vehicle_tax: string | number | null
  total_vehicle_tax: string | number | null
}

type CostRow = {
  stock_number: string | null
  total: string | number | null
  amount: string | number | null
  quantity: string | number | null
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

const formatMMDDYYYY = (raw: unknown) => {
  const s = String(raw ?? '').trim()
  if (!s) return ''
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return s
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const yyyy = String(d.getFullYear())
  return `${mm}/${dd}/${yyyy}`
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
    const valueOn = normalizeDateIso(url.searchParams.get('valueOn'))

    const supabaseUrl = String(process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '')
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ ok: false, error: 'Server not configured' }, { status: 500 })
    }

    const vehicleSelect = [
      'id',
      'stock_number',
      'year',
      'make',
      'model',
      'trim',
      'vin',
      'status',
      'in_stock_date',
      'created_at',
      'price',
      'saleprice',
      'dii',
    ].join(',')

    const vQs: string[] = [`select=${encodeURIComponent(vehicleSelect)}`, 'order=created_at.desc', 'limit=5000']
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
    if (!vRes.ok) {
      return NextResponse.json({ ok: false, error: vText || `Failed to fetch vehicles (${vRes.status})` }, { status: 500 })
    }

    let vehicles: VehicleRow[] = []
    try {
      vehicles = JSON.parse(vText)
    } catch {
      vehicles = []
    }

    const filteredVehicles = (vehicles || [])
      .filter((v) => {
        if (!statuses.length) return true
        const s = String(v?.status ?? '').trim()
        if (!s) return true
        return statuses.some((x) => x.toLowerCase() === s.toLowerCase())
      })
      .filter((v) => {
        if (!valueOn) return true
        const d = normalizeDateIso(v?.in_stock_date || v?.created_at)
        if (!d) return true
        return d <= valueOn
      })

    const stockNumbers = Array.from(
      new Set(
        filteredVehicles
          .map((v) => String(v?.stock_number ?? '').trim())
          .filter(Boolean)
      )
    )

    const purchasesByStock = new Map<string, PurchaseRow>()
    if (stockNumbers.length) {
      const purchaseSelect = [
        'id',
        'stock_number',
        'purchase_price',
        'actual_cash_value',
        'discount',
        'tax_type',
        'tax_override',
        'vehicle_tax',
        'total_vehicle_tax',
      ].join(',')

      const inList = `(${stockNumbers.map((s) => `"${String(s).replaceAll('"', '')}"`).join(',')})`
      const pQs = [
        `select=${encodeURIComponent(purchaseSelect)}`,
        `stock_number=in.${encodeURIComponent(inList)}`,
        'order=created_at.desc',
        `limit=${encodeURIComponent(String(Math.min(5000, stockNumbers.length * 3)))}`,
      ]

      const pUrl = `${supabaseUrl}/rest/v1/edc_purchase?${pQs.join('&')}`
      const pRes = await fetch(pUrl, {
        method: 'GET',
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
        },
        cache: 'no-store',
      })

      const pText = await pRes.text().catch(() => '')
      if (pRes.ok) {
        let purchases: PurchaseRow[] = []
        try {
          purchases = JSON.parse(pText)
        } catch {
          purchases = []
        }

        for (const p of purchases) {
          const sn = String(p?.stock_number ?? '').trim()
          if (!sn) continue
          if (!purchasesByStock.has(sn)) purchasesByStock.set(sn, p)
        }
      }
    }

    const costsByStock = new Map<string, number>()
    if (stockNumbers.length) {
      const costSelect = ['stock_number', 'total', 'amount', 'quantity'].join(',')
      const inList = `(${stockNumbers.map((s) => `"${String(s).replaceAll('"', '')}"`).join(',')})`
      const cQs = [
        `select=${encodeURIComponent(costSelect)}`,
        `stock_number=in.${encodeURIComponent(inList)}`,
        'limit=10000',
      ]

      const cUrl = `${supabaseUrl}/rest/v1/edc_costs?${cQs.join('&')}`
      const cRes = await fetch(cUrl, {
        method: 'GET',
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
        },
        cache: 'no-store',
      })

      const cText = await cRes.text().catch(() => '')
      if (cRes.ok) {
        let costs: CostRow[] = []
        try {
          costs = JSON.parse(cText)
        } catch {
          costs = []
        }

        for (const c of costs) {
          const sn = String(c?.stock_number ?? '').trim()
          if (!sn) continue
          const total = toNum(c?.total)
          const amount = toNum(c?.amount)
          const qty = Math.max(1, toNum(c?.quantity) || 1)
          const line = total || (amount * qty)
          costsByStock.set(sn, (costsByStock.get(sn) || 0) + line)
        }
      }
    }

    const rows = filteredVehicles.map((v) => {
      const stock = String(v?.stock_number ?? '').trim()
      const p = stock ? purchasesByStock.get(stock) : undefined

      const vehiclePurchasePrice = toNum(p?.purchase_price)
      const actualCashValue = toNum(p?.actual_cash_value)
      const discount = toNum(p?.discount)
      const costs = stock ? (costsByStock.get(stock) || 0) : 0

      const taxType = String(p?.tax_type ?? '').trim()
      const override = Boolean(p?.tax_override)
      const totalVehicleTax = toNum(p?.total_vehicle_tax) || toNum(p?.vehicle_tax)

      const qst9975 = !override && taxType.toUpperCase() === 'QST' ? totalVehicleTax : 0
      const gst5 = !override && taxType.toUpperCase() === 'GST' ? totalVehicleTax : 0
      const hst13 = !override && taxType.toUpperCase() === 'HST' ? totalVehicleTax : 0
      const tax = override ? totalVehicleTax : (qst9975 + gst5 + hst13)
      const totalTax = tax

      const totalInvested = Math.max(0, vehiclePurchasePrice - discount) + costs + totalTax

      const listPrice = toNum(v?.saleprice) || toNum(v?.price)

      const inStockDate = formatMMDDYYYY(v?.in_stock_date || v?.created_at) || 'N/A'

      return {
        id: String(v?.id ?? stock ?? Math.random()),
        stock: stock || 'N/A',
        year: v?.year ? String(v.year) : '',
        make: String(v?.make ?? '').trim() || 'N/A',
        model: String(v?.model ?? '').trim() || 'N/A',
        trim: String(v?.trim ?? '').trim() || '',
        vin: String(v?.vin ?? '').trim() || 'N/A',
        dealId: '',
        inStockDate,
        closeDate: 'N/A',
        currentStatus: String(v?.status ?? '').trim() || 'N/A',
        vehiclePurchasePrice,
        actualCashValue,
        costs,
        defaultTaxRate: '0%',
        qst9975,
        gst5,
        hst13,
        tax,
        totalTax,
        totalInvested,
        dii: String(v?.dii ?? '').trim(),
        listPrice,
      }
    })

    return NextResponse.json({ ok: true, rows }, { status: 200 })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || 'Server error' }, { status: 500 })
  }
}
