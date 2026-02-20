'use client'

import { useEffect, useMemo, useState } from 'react'

type Row = {
  [key: string]: string | number
}

export default function SalesReportPage() {
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
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

  const parseArray = (raw: any): any[] => {
    if (!raw) return []
    if (Array.isArray(raw)) return raw
    if (typeof raw === 'string') {
      try {
        const parsed = JSON.parse(raw)
        return Array.isArray(parsed) ? parsed : []
      } catch {
        return []
      }
    }
    return []
  }

  const sumField = (raw: any, keys: string[]) => {
    const arr = parseArray(raw)
    return arr.reduce((s: number, i: any) => {
      for (const k of keys) {
        const v = Number(i?.[k] ?? 0)
        if (Number.isFinite(v) && v !== 0) return s + v
      }
      return s
    }, 0)
  }

  const getOmvicFromFees = (rawFees: any): number => {
    const fees = parseArray(rawFees)
    for (const f of fees) {
      const name = String(f?.fee_name ?? f?.name ?? f?.label ?? '').toLowerCase()
      if (!name) continue
      if (name.includes('omvic')) {
        const amt = Number(f?.fee_amount ?? f?.amount ?? f?.value ?? 0)
        return Number.isFinite(amt) ? amt : 0
      }
    }
    return 0
  }

  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true)
        setError(null)

        const res = await fetch('/api/deals', { cache: 'no-store' })
        if (!res.ok) throw new Error(`Failed to fetch deals (${res.status})`)
        const json = await res.json()
        if (json?.error) throw new Error(json.error)

        const dealsAll: any[] = Array.isArray(json?.deals) ? json.deals : []

        const mapped: Row[] = dealsAll
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
          .map((d: any) => {
            const customer = d?.customer ?? {}
            const worksheet = d?.worksheet ?? {}
            const delivery = d?.delivery ?? {}
            const vehicles = Array.isArray(d?.vehicles) ? d.vehicles : []
            const v0 = vehicles[0] ?? {}

            const dealDateRaw = customer?.dealdate ?? worksheet?.deal_date ?? d?.dealDate ?? ''
            const closeDateRaw = worksheet?.close_date ?? d?.closeDate ?? ''

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

            const taxRate = Number(worksheet?.tax_rate ?? worksheet?.taxRate ?? 0.13) || 0

            const feesRetail = sumField(worksheet?.fees, ['amount', 'price', 'fee_amount'])
            const feesCost = sumField(worksheet?.fees, ['cost'])
            const feesProfit = feesRetail - feesCost
            const feesTax = feesRetail * taxRate

            const accRetail = sumField(worksheet?.accessories, ['price', 'amount'])
            const accCost = sumField(worksheet?.accessories, ['cost'])
            const accProfit = accRetail - accCost
            const accTax = accRetail * taxRate

            const warrRetail = sumField(worksheet?.warranties, ['amount', 'price'])
            const warrCost = sumField(worksheet?.warranties, ['cost'])
            const warrProfit = warrRetail - warrCost
            const warrTax = warrRetail * taxRate

            const insRetail = sumField(worksheet?.insurances, ['amount', 'price'])
            const insCost = sumField(worksheet?.insurances, ['cost'])
            const insProfit = insRetail - insCost
            const insTax = insRetail * taxRate

            const purchasePrice = Number(v0?.purchase_price ?? v0?.purchasePrice ?? (v0 as any)?.raw?.purchase_price ?? 0) || 0
            const vehicleSellingPrice = Number(worksheet?.purchase_price ?? worksheet?.selling_price ?? worksheet?.vehicle_price ?? v0?.selected_price ?? v0?.price ?? 0) || 0
            const discount = Number(worksheet?.discount ?? 0) || 0
            const vehicleProfit = (vehicleSellingPrice - discount) - purchasePrice
            const totalProfit = vehicleProfit + feesProfit + accProfit + warrProfit + insProfit + bankCommission

            const omvic = Number(worksheet?.omvic_fee ?? getOmvicFromFees(worksheet?.fees) ?? 0)
            const subtotal1 = vehicleSellingPrice + omvic
            const tradeValue = Number(worksheet?.trade_value ?? worksheet?.tradeValue ?? 0)
            const lienPayout = Number(worksheet?.lien_payout ?? worksheet?.lienPayout ?? 0)
            const netDiff = subtotal1 - discount - tradeValue + lienPayout
            const hst = netDiff * taxRate
            const licenseFee = Number(worksheet?.license_fee ?? worksheet?.licensing_fee ?? worksheet?.licensingFee ?? worksheet?.licenseFee ?? 91)
            const paymentsTotal = sumField(worksheet?.payments, ['amount'])
            const subtotal2 = netDiff + hst + licenseFee + feesRetail + accRetail + warrRetail + insRetail + paymentsTotal

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
              costs: (feesCost + accCost + warrCost + insCost).toFixed(2),
              tax_on_costs: (feesTax + accTax + warrTax + insTax).toFixed(2),
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
              total_tax_after_market: (feesTax + accTax + warrTax + insTax).toFixed(2),
              licensing_fee: String(worksheet?.licensing_fee ?? worksheet?.licensingFee ?? ''),
              hst_13: hst.toFixed(2),
              total_tax: hst.toFixed(2),
              __deal_date_iso: toISODate(dealDateRaw),
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
      if (!iso) return true
      if (fromIso && iso < fromIso) return false
      if (toIso && iso > toIso) return false
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
            <button type="button" className="edc-btn-primary text-sm">
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

            <button type="button" className="edc-btn-ghost text-sm">
              Advanced
            </button>
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
