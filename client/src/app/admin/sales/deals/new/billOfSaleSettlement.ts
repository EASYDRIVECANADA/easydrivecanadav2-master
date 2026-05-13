import type { BillOfSaleData } from './billOfSalePdf'

type LineItem = Record<string, unknown>

type SettlementFields = Pick<
  BillOfSaleData,
  | 'vehiclePrice'
  | 'discount'
  | 'omvicFee'
  | 'subtotal1'
  | 'netDifference'
  | 'hstOnNetDifference'
  | 'totalTax'
  | 'licenseFee'
  | 'lienPayout'
  | 'tradeEquity'
  | 'feesTotal'
  | 'feesLineItems'
  | 'accessoriesTotal'
  | 'accessoriesLineItems'
  | 'warrantiesTotal'
  | 'warrantiesLineItems'
  | 'insurancesTotal'
  | 'insurancesLineItems'
  | 'paymentsTotal'
  | 'subtotal2'
  | 'deposit'
  | 'downPayment'
  | 'taxOnInsurance'
  | 'totalBalanceDue'
>

function roundMoney(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100
}

export function parseBillOfSaleItems(raw: unknown): LineItem[] {
  if (!raw) return []
  if (Array.isArray(raw)) return raw
  if (typeof raw !== 'string') return []

  try {
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? (parsed as LineItem[]) : []
  } catch {
    return []
  }
}

function money(raw: unknown): number {
  if (raw === null || raw === undefined) return 0
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : 0
  const cleaned = String(raw).replace(/[^0-9.-]/g, '')
  if (!cleaned) return 0
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : 0
}

function hasAmount(raw: unknown): boolean {
  if (raw === null || raw === undefined) return false
  if (typeof raw === 'string' && raw.trim() === '') return false
  if (typeof raw === 'string') {
    const cleaned = raw.replace(/[^0-9.-]/g, '')
    if (!cleaned) return false
    return Number.isFinite(Number(cleaned))
  }
  return typeof raw === 'number' && Number.isFinite(raw)
}

function itemAmount(item: LineItem, primaryKey: string): number {
  const candidates = [
    item?.[primaryKey],
    item?.amount,
    item?.price,
    item?.fee_amount,
    item?.value,
  ]
  for (const candidate of candidates) {
    if (hasAmount(candidate)) return money(candidate)
  }
  return 0
}

function taxRateFromLabel(label: string): number {
  const match = label.match(/(\d+(?:\.\d+)?)\s*%/)
  if (!match) return 0
  const rate = Number(match[1])
  return Number.isFinite(rate) && rate > 0 ? rate / 100 : 0
}

function itemTax(item: LineItem, primaryKey: string): number {
  if (hasAmount(item?.taxAmount)) return money(item.taxAmount)
  if (hasAmount(item?.tax_amount)) return money(item.tax_amount)

  const taxSelected = item?.taxSelected && typeof item.taxSelected === 'object'
    ? item.taxSelected as Record<string, unknown>
    : {}
  const selectedLabels = Object.keys(taxSelected).filter((key) => Boolean(taxSelected[key]))
  if (selectedLabels.length === 0) return 0

  if (item?.taxOverride === true || item?.taxOverride === 'true') {
    const taxValues = item?.taxValues && typeof item.taxValues === 'object'
      ? item.taxValues as Record<string, unknown>
      : {}
    return roundMoney(selectedLabels.reduce((sum, key) => sum + money(taxValues[key]), 0))
  }

  const amount = itemAmount(item, primaryKey)
  return roundMoney(selectedLabels.reduce((sum, key) => sum + amount * taxRateFromLabel(key), 0))
}

function sumItems(items: LineItem[], primaryKey: string): number {
  return roundMoney(items.reduce((sum, item) => sum + itemAmount(item, primaryKey), 0))
}

function sumTaxes(items: LineItem[], primaryKey: string): number {
  return roundMoney(items.reduce((sum, item) => sum + itemTax(item, primaryKey), 0))
}

function sumSelfTaxedBase(items: LineItem[], primaryKey: string): number {
  return roundMoney(items.reduce((sum, item) => {
    return itemTax(item, primaryKey) > 0 ? sum + itemAmount(item, primaryKey) : sum
  }, 0))
}

function findOmvicFee(fees: LineItem[]): LineItem | null {
  return fees.find((fee) => {
    const name = String(fee?.fee_name ?? fee?.name ?? fee?.label ?? '').toLowerCase()
    return name.includes('omvic')
  }) ?? null
}

function itemName(item: LineItem): string {
  return String(item?.name ?? item?.fee_name ?? item?.label ?? '').trim()
}

function lineItems(items: LineItem[], primaryKey: string, exclude?: LineItem | null): Array<{ name: string; price: number }> {
  return items
    .filter((item) => item !== exclude)
    .map((item) => ({ name: itemName(item), price: itemAmount(item, primaryKey) }))
    .filter((item) => item.name && item.price > 0)
}

function worksheetTaxRate(w: Record<string, unknown> | null | undefined): number {
  if (!hasAmount(w?.tax_rate)) return 0.13
  const raw = money(w?.tax_rate)
  if (raw < 0) return 0
  return raw > 1 ? raw / 100 : raw
}

function isTaxOverridden(w: Record<string, unknown> | null | undefined): boolean {
  return w?.tax_override === true || w?.tax_override === 'true'
}

export function buildBillOfSaleSettlement(w: Record<string, unknown> | null | undefined, fallbackPrice?: unknown): SettlementFields {
  const fees = parseBillOfSaleItems(w?.fees)
  const accessories = parseBillOfSaleItems(w?.accessories)
  const warranties = parseBillOfSaleItems(w?.warranties)
  const insurances = parseBillOfSaleItems(w?.insurances)
  const payments = parseBillOfSaleItems(w?.payments)

  const price = money(w?.purchase_price ?? w?.vehicle_price ?? fallbackPrice)
  const discount = money(w?.discount)
  const vehicleSubtotal = roundMoney(Math.max(0, price - discount))

  const omvicItem = findOmvicFee(fees)
  const omvicFromItems = omvicItem ? itemAmount(omvicItem, 'amount') : 0
  const omvicFee = omvicFromItems || money(w?.omvic_fee)

  const allFeesTotal = sumItems(fees, 'amount')
  const feesTotal = roundMoney(Math.max(0, allFeesTotal - omvicFromItems))
  const accessoriesTotal = sumItems(accessories, 'price')
  const warrantiesTotal = sumItems(warranties, 'amount')
  const insurancesTotal = sumItems(insurances, 'amount')
  const paymentsTotal = sumItems(payments, 'amount')

  const subtotal1 = roundMoney(vehicleSubtotal + omvicFee + feesTotal + accessoriesTotal + warrantiesTotal + insurancesTotal)
  const tradeValue = money(w?.trade_value)
  const netDifference = roundMoney(Math.max(0, subtotal1 - tradeValue))

  const selfTaxedBase =
    sumSelfTaxedBase(fees, 'amount') +
    sumSelfTaxedBase(accessories, 'price') +
    sumSelfTaxedBase(warranties, 'amount') +
    sumSelfTaxedBase(insurances, 'amount')
  const hstOnNetDifference = roundMoney(Math.max(0, netDifference - selfTaxedBase) * worksheetTaxRate(w))
  const itemsTax =
    sumTaxes(fees, 'amount') +
    sumTaxes(accessories, 'price') +
    sumTaxes(warranties, 'amount') +
    sumTaxes(insurances, 'amount')
  const totalTax = isTaxOverridden(w) ? roundMoney(money(w?.tax_manual ?? w?.total_tax)) : roundMoney(hstOnNetDifference + itemsTax)

  const licenseFee = money(w?.license_fee)
  const lienPayout = money(w?.lien_payout)
  const actualCashValue = money(w?.actual_cash_value)
  const tradeEquity = roundMoney(hasAmount(w?.trade_equity) ? money(w?.trade_equity) : actualCashValue - tradeValue)
  const subtotal2 = roundMoney(netDifference + totalTax + licenseFee + lienPayout - tradeEquity)
  const deposit = money(w?.deposit)
  const downPayment = money(w?.down_payment)
  const taxOnInsurance = money(w?.tax_on_insurance)
  const totalBalanceDue = roundMoney(
    subtotal2 -
    paymentsTotal -
    deposit -
    downPayment +
    taxOnInsurance
  )

  return {
    vehiclePrice: String(price),
    discount: String(discount),
    omvicFee: String(omvicFee),
    subtotal1: String(subtotal1),
    netDifference: String(netDifference),
    hstOnNetDifference: String(hstOnNetDifference),
    totalTax: String(totalTax),
    licenseFee: String(licenseFee),
    lienPayout: String(lienPayout),
    tradeEquity: String(tradeEquity),
    feesTotal: String(feesTotal),
    feesLineItems: lineItems(fees, 'amount', omvicItem),
    accessoriesTotal: String(accessoriesTotal),
    accessoriesLineItems: lineItems(accessories, 'price'),
    warrantiesTotal: String(warrantiesTotal),
    warrantiesLineItems: lineItems(warranties, 'amount'),
    insurancesTotal: String(insurancesTotal),
    insurancesLineItems: lineItems(insurances, 'amount'),
    paymentsTotal: String(paymentsTotal),
    subtotal2: String(subtotal2),
    deposit: String(deposit),
    downPayment: String(downPayment),
    taxOnInsurance: String(taxOnInsurance),
    totalBalanceDue: String(totalBalanceDue),
  }
}
