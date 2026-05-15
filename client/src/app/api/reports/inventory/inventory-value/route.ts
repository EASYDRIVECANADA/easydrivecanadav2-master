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
  VehicleId: string | null
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
  id: string | number | null
  vehicleId: string | null
  stock_number: string | null
  total: string | number | null
  amount: string | number | null
  quantity: string | number | null
  discount: string | number | null
  tax: string | number | null
}

const toNum = (v: unknown) => {
  if (v === null || v === undefined || v === '') return 0
  const n = typeof v === 'number' ? v : Number(String(v).replace(/[^0-9.-]/g, ''))
  return Number.isFinite(n) ? n : 0
}

const hasValue = (v: unknown) => v !== null && v !== undefined && String(v).trim() !== ''

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
    const userId = String(url.searchParams.get('userId') ?? '').trim()

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
    if (userId) vQs.push(`user_id=eq.${encodeURIComponent(userId)}`)
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
    const vehicleIds = Array.from(
      new Set(
        filteredVehicles
          .map((v) => String(v?.id ?? '').trim())
          .filter(Boolean)
      )
    )

    const purchasesByStock = new Map<string, PurchaseRow>()
    const purchasesByVehicleId = new Map<string, PurchaseRow>()
    const addPurchase = (p: PurchaseRow) => {
      const sn = String(p?.stock_number ?? '').trim()
      if (sn && !purchasesByStock.has(sn)) purchasesByStock.set(sn, p)
      const vehicleId = String((p as any)?.VehicleId ?? p?.id ?? '').trim()
      if (vehicleId && !purchasesByVehicleId.has(vehicleId)) purchasesByVehicleId.set(vehicleId, p)
    }

    if (stockNumbers.length || vehicleIds.length) {
      const purchaseSelect = [
        'id',
        'VehicleId',
        'stock_number',
        'purchase_price',
        'actual_cash_value',
        'discount',
        'tax_type',
        'tax_override',
        'vehicle_tax',
        'total_vehicle_tax',
      ].join(',')

      const fetchPurchases = async (column: 'stock_number' | 'VehicleId', values: string[]) => {
        if (!values.length) return
        const inList = `(${values.map((s) => `"${String(s).replaceAll('"', '')}"`).join(',')})`
        const pQs = [
          `select=${encodeURIComponent(purchaseSelect)}`,
          `${column}=in.${encodeURIComponent(inList)}`,
          'order=created_at.desc',
          `limit=${encodeURIComponent(String(Math.min(5000, values.length * 3)))}`,
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
          purchases.forEach(addPurchase)
        }
      }

      await Promise.all([
        fetchPurchases('stock_number', stockNumbers),
        fetchPurchases('VehicleId', vehicleIds),
      ])
    }

    const costsByStock = new Map<string, number>()
    const costsByVehicleId = new Map<string, number>()
    if (stockNumbers.length || vehicleIds.length) {
      const costSelect = ['id', 'vehicleId', 'stock_number', 'total', 'amount', 'quantity', 'discount', 'tax'].join(',')
      const seenCostRows = new Set<string>()
      const addCosts = (costs: CostRow[]) => {
        for (const c of costs) {
          const rowKey = String(c?.id ?? '').trim() || JSON.stringify(c)
          if (seenCostRows.has(rowKey)) continue
          seenCostRows.add(rowKey)
          const sn = String(c?.stock_number ?? '').trim()
          const vehicleId = String(c?.vehicleId ?? '').trim()
          const amount = toNum(c?.amount)
          const qty = Math.max(1, toNum(c?.quantity) || 1)
          const discount = toNum(c?.discount)
          const tax = toNum(c?.tax)
          const subtotal = Math.max(0, amount * qty - discount)
          const hasLineComponents = hasValue(c?.amount) || hasValue(c?.quantity) || hasValue(c?.discount) || hasValue(c?.tax)
          const line = hasLineComponents ? subtotal + tax : toNum(c?.total)
          if (vehicleId) costsByVehicleId.set(vehicleId, (costsByVehicleId.get(vehicleId) || 0) + line)
          if (sn) costsByStock.set(sn, (costsByStock.get(sn) || 0) + line)
        }
      }

      const fetchCosts = async (column: 'stock_number' | 'vehicleId', values: string[]) => {
        if (!values.length) return
        const inList = `(${values.map((s) => `"${String(s).replaceAll('"', '')}"`).join(',')})`
        const cQs = [
          `select=${encodeURIComponent(costSelect)}`,
          `${column}=in.${encodeURIComponent(inList)}`,
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
          addCosts(costs)
        }
      }

      await Promise.all([
        fetchCosts('stock_number', stockNumbers),
        fetchCosts('vehicleId', vehicleIds),
      ])
    }

    const rows = filteredVehicles.map((v) => {
      const stock = String(v?.stock_number ?? '').trim()
      const vehicleId = String(v?.id ?? '').trim()
      const p = (vehicleId ? purchasesByVehicleId.get(vehicleId) : undefined) || (stock ? purchasesByStock.get(stock) : undefined)

      const vehiclePurchasePrice = toNum(p?.purchase_price)
      const actualCashValue = toNum(p?.actual_cash_value)
      const discount = toNum(p?.discount)
      const costs = (vehicleId ? costsByVehicleId.get(vehicleId) : 0) || (stock ? (costsByStock.get(stock) || 0) : 0)

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
