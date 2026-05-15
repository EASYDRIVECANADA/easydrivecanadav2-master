'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { buildBillOfSaleSettlement, parseBillOfSaleItems } from '../../../sales/deals/new/billOfSaleSettlement'
import { exportRowsToCsv, getFirstDayOfMonth, getToday } from '../../reportUtils'

type Row = {
  [key: string]: string | number
}

export default function SalesReportPage() {
  const [from, setFrom] = useState(getFirstDayOfMonth)
  const [to, setTo] = useState(getToday)
  const [query, setQuery] = useState('')
  const [perPage, setPerPage] = useState('500')
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const formatMMDDYYYY = (raw: any) => {
    const s = String(raw ?? '').trim()
    if (!s) return ''
    const d = new Date(s)
    if (Number.isNaN(d.getTime())) return s
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    const yyyy = String(d.getFullYear())
    return `${mm}/${dd}/${yyyy}`
  }

  const toISODate = (raw: any) => {
    const s = String(raw ?? '').trim()
    if (!s) return ''
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
    const d = new Date(s)
    if (Number.isNaN(d.getTime())) return ''
    return d.toISOString().slice(0, 10)
  }

  const roundMoney = (n: number) => Math.round((Number(n) || 0) * 100) / 100

  const toNumber = (value: unknown) => {
    const n = Number(String(value ?? '0').replace(/[^0-9.-]/g, ''))
    return Number.isFinite(n) ? n : 0
  }

  const hasValue = (value: unknown) => value !== null && value !== undefined && String(value).trim() !== ''

  const itemAmount = (item: Record<string, unknown>, primaryKey: string) => {
    const candidates = [
      item?.[primaryKey],
      item?.amount,
      item?.price,
      item?.fee_amount,
      item?.value,
    ]
    for (const candidate of candidates) {
      if (hasValue(candidate)) return toNumber(candidate)
    }
    return 0
  }

  const taxRateFromLabel = (label: string) => {
    const match = label.match(/(\d+(?:\.\d+)?)\s*%/)
    if (!match) return 0
    const rate = Number(match[1])
    return Number.isFinite(rate) && rate > 0 ? rate / 100 : 0
  }

  const itemTax = (item: Record<string, unknown>, primaryKey: string) => {
    if (hasValue(item?.taxAmount)) return toNumber(item.taxAmount)
    if (hasValue(item?.tax_amount)) return toNumber(item.tax_amount)

    const taxSelected = item?.taxSelected && typeof item.taxSelected === 'object'
      ? item.taxSelected as Record<string, unknown>
      : {}
    const selectedLabels = Object.keys(taxSelected).filter((key) => Boolean(taxSelected[key]))
    if (!selectedLabels.length) return 0

    if (item?.taxOverride === true || item?.taxOverride === 'true') {
      const taxValues = item?.taxValues && typeof item.taxValues === 'object'
        ? item.taxValues as Record<string, unknown>
        : {}
      return roundMoney(selectedLabels.reduce((sum, key) => sum + toNumber(taxValues[key]), 0))
    }

    const amount = itemAmount(item, primaryKey)
    return roundMoney(selectedLabels.reduce((sum, key) => sum + amount * taxRateFromLabel(key), 0))
  }

  const findOmvicItem = (fees: Record<string, unknown>[]) => {
    return fees.find((fee) => {
      const name = String(fee?.fee_name ?? fee?.name ?? fee?.label ?? '').toLowerCase()
      return name.includes('omvic')
    }) ?? null
  }

  const calcCategory = (raw: unknown, primaryKey: string, exclude?: Record<string, unknown> | null): { retail: number; cost: number; tax: number } => {
    const items = parseBillOfSaleItems(raw) as Record<string, unknown>[]
    return items.reduce<{ retail: number; cost: number; tax: number }>((acc, item) => {
      const retail = item === exclude ? 0 : itemAmount(item, primaryKey)
      const cost = item === exclude ? 0 : toNumber(item?.cost)
      return {
        retail: roundMoney(acc.retail + retail),
        cost: roundMoney(acc.cost + cost),
        tax: roundMoney(acc.tax + itemTax(item, primaryKey)),
      }
    }, { retail: 0, cost: 0, tax: 0 })
  }

  const costLineTotal = (row: any) => {
    const amount = toNumber(row?.amount)
    const qty = Math.max(1, toNumber(row?.quantity) || 1)
    const discount = toNumber(row?.discount)
    const tax = toNumber(row?.tax)
    const hasLineComponents = hasValue(row?.amount) || hasValue(row?.quantity) || hasValue(row?.discount) || hasValue(row?.tax)
    return hasLineComponents ? Math.max(0, amount * qty - discount) + tax : toNumber(row?.total)
  }

  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true)
        setError(null)

        let userId = ''
        try {
          const raw = typeof window !== 'undefined' ? window.localStorage.getItem('edc_admin_session') : null
          if (raw) {
            const parsed = JSON.parse(raw) as { user_id?: string }
            userId = String(parsed?.user_id ?? '').trim()
          }
        } catch { userId = '' }

        const qs = userId ? `?userId=${encodeURIComponent(userId)}` : ''
        const res = await fetch(`/api/deals${qs}`, { cache: 'no-store' })
        if (!res.ok) throw new Error(`Failed to fetch deals (${res.status})`)
        const json = await res.json()
        if (json?.error) throw new Error(json.error)

        const dealsAll: any[] = Array.isArray(json?.deals) ? json.deals : []

        const closedDeals = dealsAll
          .filter((d: any) => {
            const customer = d?.customer ?? {}
            const worksheet = d?.worksheet ?? {}
            const delivery = d?.delivery ?? {}

            const stateRaw = String(
              customer?.deal_state ??
                customer?.dealState ??
                customer?.dealstate ??
                customer?.state ??
                worksheet?.deal_state ??
                worksheet?.dealState ??
                worksheet?.dealstate ??
                delivery?.deal_state ??
                delivery?.dealState ??
                delivery?.dealstate ??
                d?.state ??
                ''
            ).trim()
            return stateRaw.toLowerCase() === 'closed'
          })

        const vehiclesForBasis = closedDeals
          .map((d: any) => (Array.isArray(d?.vehicles) ? d.vehicles[0] : null))
          .filter(Boolean)

        const stocks = Array.from(new Set(vehiclesForBasis
          .map((v: any) => String(v?.selected_stock_number ?? v?.stock_number ?? '').trim())
          .filter(Boolean)))
        const vehicleIds = Array.from(new Set(vehiclesForBasis
          .map((v: any) => String(v?.selected_id ?? v?.id ?? '').trim())
          .filter(Boolean)))

        const purchaseByStock = new Map<string, number>()
        const purchaseByVehicleId = new Map<string, number>()
        const costsByVehicleId = new Map<string, any[]>()
        const costsByStock = new Map<string, any[]>()

        if (stocks.length) {
          const { data } = await supabase
            .from('edc_purchase')
            .select('VehicleId, stock_number, purchase_price, updated_at')
            .in('stock_number', stocks)
            .order('updated_at', { ascending: false })

          for (const row of Array.isArray(data) ? data : []) {
            const stock = String((row as any)?.stock_number ?? '').trim()
            if (stock && !purchaseByStock.has(stock)) purchaseByStock.set(stock, toNumber((row as any)?.purchase_price))
            const vehicleId = String((row as any)?.VehicleId ?? '').trim()
            if (vehicleId && !purchaseByVehicleId.has(vehicleId)) purchaseByVehicleId.set(vehicleId, toNumber((row as any)?.purchase_price))
          }

          const { data: stockCostRows } = await supabase
            .from('edc_costs')
            .select('vehicleId, stock_number, amount, quantity, discount, tax, total')
            .in('stock_number', stocks)

          for (const row of Array.isArray(stockCostRows) ? stockCostRows : []) {
            const stock = String((row as any)?.stock_number ?? '').trim()
            if (!stock) continue
            costsByStock.set(stock, [...(costsByStock.get(stock) || []), row])
          }
        }

        if (vehicleIds.length) {
          const { data: purchaseRowsByVehicle } = await supabase
            .from('edc_purchase')
            .select('VehicleId, stock_number, purchase_price, updated_at')
            .in('VehicleId', vehicleIds)
            .order('updated_at', { ascending: false })

          for (const row of Array.isArray(purchaseRowsByVehicle) ? purchaseRowsByVehicle : []) {
            const vehicleId = String((row as any)?.VehicleId ?? '').trim()
            if (vehicleId && !purchaseByVehicleId.has(vehicleId)) purchaseByVehicleId.set(vehicleId, toNumber((row as any)?.purchase_price))
            const stock = String((row as any)?.stock_number ?? '').trim()
            if (stock && !purchaseByStock.has(stock)) purchaseByStock.set(stock, toNumber((row as any)?.purchase_price))
          }

          const { data: vehicleCostRows } = await supabase
            .from('edc_costs')
            .select('vehicleId, stock_number, amount, quantity, discount, tax, total')
            .in('vehicleId', vehicleIds)

          for (const row of Array.isArray(vehicleCostRows) ? vehicleCostRows : []) {
            const vehicleId = String((row as any)?.vehicleId ?? '').trim()
            if (!vehicleId) continue
            costsByVehicleId.set(vehicleId, [...(costsByVehicleId.get(vehicleId) || []), row])
          }
        }

        const getInventoryCostBasis = (vehicle: any) => {
          const stock = String(vehicle?.selected_stock_number ?? vehicle?.stock_number ?? '').trim()
          const vehicleId = String(vehicle?.selected_id ?? vehicle?.id ?? '').trim()
          const purchasePrice = (vehicleId ? purchaseByVehicleId.get(vehicleId) : 0) || (stock ? purchaseByStock.get(stock) : 0) || toNumber(vehicle?.purchase_price ?? vehicle?.purchasePrice ?? vehicle?.raw?.purchase_price)
          const costRows = (vehicleId && costsByVehicleId.get(vehicleId)?.length) ? costsByVehicleId.get(vehicleId)! : (stock ? costsByStock.get(stock) || [] : [])
          const inventoryCosts = costRows.reduce((sum, row) => sum + costLineTotal(row), 0)
          return { purchasePrice, inventoryCosts }
        }

        const mapped: Row[] = closedDeals
          .map((d: any) => {
            const customer = d?.customer ?? {}
            const worksheet = d?.worksheet ?? {}
            const delivery = d?.delivery ?? {}
            const vehicles = Array.isArray(d?.vehicles) ? d.vehicles : []
            const v0 = vehicles[0] ?? {}

            const dealDateRaw = customer?.dealdate ?? worksheet?.deal_date ?? d?.dealDate ?? ''
            const closeDateRaw = worksheet?.close_date ?? d?.closeDate ?? ''
            const reportDateRaw = closeDateRaw || dealDateRaw

            const firstName = String(customer?.firstname ?? customer?.first_name ?? '').trim()
            const lastName = String(customer?.lastname ?? customer?.last_name ?? '').trim()

            const year = v0?.selected_year ?? v0?.year ?? ''
            const make = v0?.selected_make ?? v0?.make ?? ''
            const model = v0?.selected_model ?? v0?.model ?? ''

            const addressParts = [customer?.address ?? customer?.street ?? '', customer?.city ?? '', customer?.province ?? customer?.state ?? '']
              .map((x: any) => String(x ?? '').trim())
              .filter(Boolean)
            const address = addressParts.join(', ')

            const bankCommission =
              Number(worksheet?.bank_commission ?? worksheet?.bankCommission ?? customer?.bank_commission ?? customer?.bankCommission ?? 0) || 0

            const lender = String(worksheet?.lender_or_bank ?? worksheet?.lender ?? worksheet?.bank ?? '').trim()

            const fees = parseBillOfSaleItems(worksheet?.fees) as Record<string, unknown>[]
            const omvicItem = findOmvicItem(fees)
            const feesCategory = calcCategory(fees, 'amount', omvicItem)
            const accCategory = calcCategory(worksheet?.accessories, 'price')
            const warrCategory = calcCategory(worksheet?.warranties, 'amount')
            const insCategory = calcCategory(worksheet?.insurances, 'amount')

            const feesRetail = feesCategory.retail
            const feesCost = feesCategory.cost
            const feesProfit = feesRetail - feesCost
            const feesTax = feesCategory.tax

            const accRetail = accCategory.retail
            const accCost = accCategory.cost
            const accProfit = accRetail - accCost
            const accTax = accCategory.tax

            const warrRetail = warrCategory.retail
            const warrCost = warrCategory.cost
            const warrProfit = warrRetail - warrCost
            const warrTax = warrCategory.tax

            const insRetail = insCategory.retail
            const insCost = insCategory.cost
            const insProfit = insRetail - insCost
            const insTax = insCategory.tax

            const costBasis = getInventoryCostBasis(v0)
            const purchasePrice = costBasis.purchasePrice
            const inventoryCosts = costBasis.inventoryCosts
            const settlement = buildBillOfSaleSettlement(worksheet, v0?.selected_price ?? v0?.price ?? 0)
            const vehicleSellingPrice = toNumber(settlement.vehiclePrice)
            const discount = toNumber(settlement.discount)
            const vehicleProfit = (vehicleSellingPrice - discount) - purchasePrice - inventoryCosts
            const totalProfit = vehicleProfit + feesProfit + accProfit + warrProfit + insProfit + bankCommission

            const subtotal2 = toNumber(settlement.subtotal2)
            const hstOnNetDifference = toNumber(settlement.hstOnNetDifference)
            const totalTax = toNumber(settlement.totalTax)
            const licenseFee = toNumber(settlement.licenseFee)
            const totalAfterMarketTax = feesTax + accTax + warrTax + insTax

            return {
              deal_date: formatMMDDYYYY(dealDateRaw) || 'N/A',
              close_date: formatMMDDYYYY(closeDateRaw) || 'N/A',
              legal_dealername: String(customer?.legal_dealername ?? customer?.legalDealerName ?? 'EASYDRIVE CANADA'),
              first_name: firstName,
              last_name: lastName,
              address,
              lender_or_bank: lender || 'N/A',
              year: String(year ?? ''),
              make: String(make ?? ''),
              model: String(model ?? ''),
              new_used: String(v0?.new_used ?? v0?.newUsed ?? ''),
              disclosures: String(d?.disclosures?.disclosures_body ?? d?.disclosures?.disclosuresBody ?? ''),
              cert_as_is: String(v0?.cert_as_is ?? v0?.certified ?? ''),
              dii: String(v0?.dii ?? ''),
              customer_source: String(customer?.customer_source ?? customer?.source ?? ''),
              purchase_price: purchasePrice ? purchasePrice.toFixed(2) : '',
              vehicle_purchase_price: vehicleSellingPrice ? vehicleSellingPrice.toFixed(2) : '',
              costs: (inventoryCosts + feesCost + accCost + warrCost + insCost).toFixed(2),
              tax_on_costs: totalAfterMarketTax.toFixed(2),
              all_in: subtotal2.toFixed(2),
              discount: discount ? discount.toFixed(2) : '',
              trade_equity: String(worksheet?.trade_equity ?? worksheet?.tradeEquity ?? ''),
              vehicle_profit: vehicleProfit.toFixed(2),
              sales_person: String(delivery?.salesperson ?? d?.primarySalesperson ?? ''),
              approved_by: String(worksheet?.approved_by ?? worksheet?.approvedBy ?? ''),
              deal_type: String(d?.type ?? customer?.dealtype ?? worksheet?.deal_type ?? ''),
              deal_state: 'Closed',
              bank_commission: bankCommission ? bankCommission.toFixed(2) : '0',
              warr_retail: warrRetail ? warrRetail.toFixed(2) : '',
              warr_cost: warrCost ? warrCost.toFixed(2) : '',
              warr_profit: warrProfit ? warrProfit.toFixed(2) : '',
              warr_tot_tax: warrTax ? warrTax.toFixed(2) : '',
              ins_retail: insRetail ? insRetail.toFixed(2) : '',
              ins_cost: insCost ? insCost.toFixed(2) : '',
              ins_profit: insProfit ? insProfit.toFixed(2) : '',
              ins_tot_tax: insTax ? insTax.toFixed(2) : '',
              acc_retail: accRetail ? accRetail.toFixed(2) : '',
              acc_cost: accCost ? accCost.toFixed(2) : '',
              acc_profit: accProfit ? accProfit.toFixed(2) : '',
              acc_tot_tax: accTax ? accTax.toFixed(2) : '',
              fees_retail: feesRetail ? feesRetail.toFixed(2) : '',
              fees_cost: feesCost ? feesCost.toFixed(2) : '',
              fees_profit: feesProfit ? feesProfit.toFixed(2) : '',
              fees_tot_tax: feesTax ? feesTax.toFixed(2) : '',
              subtotal: subtotal2.toFixed(2),
              total_profit: totalProfit.toFixed(2),
              total_tax_after_market: totalAfterMarketTax.toFixed(2),
              licensing_fee: licenseFee ? licenseFee.toFixed(2) : '',
              hst_13: hstOnNetDifference.toFixed(2),
              total_tax: totalTax.toFixed(2),
              __deal_date_iso: toISODate(dealDateRaw),
              __report_date_iso: toISODate(reportDateRaw),
            }
          })

        setRows(mapped)
      } catch (e: any) {
        setError(e?.message || 'Failed to load sales report')
        setRows([])
      } finally {
        setLoading(false)
      }
    }

    void run()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const columns = useMemo(
    () => [
      { key: 'deal_date', label: 'Deal Date' },
      { key: 'close_date', label: 'Close Date' },
      { key: 'legal_dealername', label: 'Legal Dealername' },
      { key: 'first_name', label: 'First Name' },
      { key: 'last_name', label: 'Last Name' },
      { key: 'address', label: 'Address' },
      { key: 'lender_or_bank', label: 'Lender or Bank' },
      { key: 'year', label: 'Year' },
      { key: 'make', label: 'Make' },
      { key: 'model', label: 'Model' },
      { key: 'new_used', label: 'New/Used' },
      { key: 'disclosures', label: 'Disclosures' },
      { key: 'cert_as_is', label: 'Cert/As-Is' },
      { key: 'dii', label: 'DII' },
      { key: 'customer_source', label: 'Customer Source' },
      { key: 'purchase_price', label: 'Purchase Price' },
      { key: 'vehicle_purchase_price', label: 'Vehicle Purchase Price' },
      { key: 'costs', label: 'Costs' },
      { key: 'tax_on_costs', label: 'Tax on Costs' },
      { key: 'all_in', label: 'All In' },
      { key: 'discount', label: 'Discount' },
      { key: 'trade_equity', label: 'Trade Equity' },
      { key: 'vehicle_profit', label: 'Vehicle Profit' },
      { key: 'sales_person', label: 'Sales Person' },
      { key: 'approved_by', label: 'Approved By' },
      { key: 'deal_type', label: 'Deal Type' },
      { key: 'deal_state', label: 'Deal State' },
      { key: 'bank_commission', label: 'Bank Commission' },
      { key: 'warr_retail', label: 'Warr. Retail' },
      { key: 'warr_cost', label: 'Warr. Cost' },
      { key: 'warr_profit', label: 'Warr. Profit' },
      { key: 'warr_tot_tax', label: 'Warr. Tot Tax' },
      { key: 'ins_retail', label: 'Ins. Retail' },
      { key: 'ins_cost', label: 'Ins. Cost' },
      { key: 'ins_profit', label: 'Ins. Profit' },
      { key: 'ins_tot_tax', label: 'Ins. Tot Tax' },
      { key: 'acc_retail', label: 'Acc. Retail' },
      { key: 'acc_cost', label: 'Acc. Cost' },
      { key: 'acc_profit', label: 'Acc. Profit' },
      { key: 'acc_tot_tax', label: 'Acc. Tot Tax' },
      { key: 'fees_retail', label: 'Fees Retail' },
      { key: 'fees_cost', label: 'Fees Cost' },
      { key: 'fees_profit', label: 'Fees Profit' },
      { key: 'fees_tot_tax', label: 'Fees. Tot Tax' },
      { key: 'subtotal', label: 'Subtotal' },
      { key: 'total_profit', label: 'Total Profit' },
      { key: 'total_tax_after_market', label: 'Total Tax (After Market)' },
      { key: 'licensing_fee', label: 'Licensing Fee' },
      { key: 'hst_13', label: 'HST - 13%' },
      { key: 'total_tax', label: 'Total Tax' },
    ],
    []
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const fromIso = toISODate(from)
    const toIso = toISODate(to)

    const byDate = rows.filter((r) => {
      const iso = String((r as any)?.__deal_date_iso ?? '').trim()
      const reportIso = String((r as any)?.__report_date_iso ?? iso).trim()
      if (!reportIso) return true
      if (fromIso && reportIso < fromIso) return false
      if (toIso && reportIso > toIso) return false
      return true
    })

    const byQuery = byDate.filter((r) => {
      if (!q) return true
      const haystack = Object.values(r)
        .map((v) => String(v).toLowerCase())
        .join(' ')
      return haystack.includes(q)
    })

    const limit = Math.max(1, Number(perPage) || 500)
    return byQuery.slice(0, limit)
  }, [from, perPage, query, rows, to])

  return (
    <div className="min-h-screen">
      <div className="edc-page-header">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              Default Report ({from ? from.replaceAll('-', '/') : 'All'} - {to ? to.replaceAll('-', '/') : 'All'})
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">Closed deals only</p>
          </div>

          <div className="flex items-center gap-3">
            <select
              value={perPage}
              onChange={(e) => setPerPage(e.target.value)}
              className="edc-input w-auto text-sm"
            >
              <option value="50">50</option>
              <option value="100">100</option>
              <option value="250">250</option>
              <option value="500">500</option>
            </select>
            <button
              type="button"
              className="edc-btn-primary text-sm"
              onClick={() => exportRowsToCsv('sales-report', filtered as unknown as Record<string, unknown>[], columns as { key: string; label: string }[])}
            >
              Export
            </button>
          </div>
        </div>
      </div>

      <div className="px-6 py-6">
        <div className="edc-card p-4">
          <div className="flex flex-col lg:flex-row lg:items-center gap-3">
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="edc-input w-auto text-sm"
              />
              <div className="text-sm text-slate-400">to</div>
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="edc-input w-auto text-sm"
              />
            </div>
            <div className="flex-1">
              <div className="relative">
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="search"
                  className="edc-input pl-10"
                />
                <svg
                  className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35m1.35-5.65a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>

          </div>

          <div className="mt-2 text-xs text-slate-500">Total Sales: <span className="font-semibold text-slate-700">{filtered.length}</span></div>
        </div>

        {error ? (
          <div className="mt-4 edc-card p-4">
            <div className="text-sm text-danger-600">{error}</div>
          </div>
        ) : null}

        {loading ? (
          <div className="mt-4 edc-card p-4">
            <div className="text-sm text-slate-500">Loading...</div>
          </div>
        ) : null}

        <div className="edc-card mt-4 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="edc-table min-w-max">
              <thead>
                <tr>
                  {columns.map((c) => (
                    <th
                      key={c.key}
                      className="whitespace-nowrap"
                    >
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, idx) => (
                  <tr key={idx}>
                    {columns.map((c) => (
                      <td key={c.key} className="px-4 py-3 text-sm text-slate-600 whitespace-nowrap">
                        {c.key.startsWith('__') ? '' : (r[c.key] ?? '')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
