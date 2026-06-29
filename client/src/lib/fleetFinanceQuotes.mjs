export const FINANCE_FEE = 999
export const GAP_PRICE = 2500
export const GAP_TAX_RATE = 0.08
export const DEFAULT_APR = 0.0799
export const DEFAULT_TERM_MONTHS = 96
export const DEFAULT_PROVINCE = 'ON'
export const DEFAULT_WARRANTY_TIER = '3yr'

export const WARRANTY_OPTIONS = {
  none: { label: 'No warranty', price: 0 },
  '2yr': { label: '2 year warranty', price: 2800 },
  '3yr': { label: '3 year warranty', price: 3200 },
}

export const PROVINCE_TAX_RATES = {
  AB: 0.05,
  BC: 0.12,
  MB: 0.12,
  NB: 0.15,
  NL: 0.15,
  NS: 0.15,
  NT: 0.05,
  NU: 0.05,
  ON: 0.13,
  PE: 0.15,
  QC: 0.14975,
  SK: 0.11,
  YT: 0.05,
}

const clean = (value) => String(value ?? '').trim()

const asNumber = (value) => {
  if (value == null || value === '') return 0
  const num = Number(String(value).replace(/[$,\s]/g, ''))
  return Number.isFinite(num) ? num : 0
}

const positiveNumber = (...values) => {
  for (const value of values) {
    const num = asNumber(value)
    if (num > 0) return num
  }
  return 0
}

const roundMoney = (value) => Math.round((Number(value) || 0) * 100) / 100

export function calculateMonthlyPayment(principal, annualRate = DEFAULT_APR, months = DEFAULT_TERM_MONTHS) {
  const amount = asNumber(principal)
  const termMonths = Math.max(Math.round(asNumber(months)), 0)
  const apr = Math.max(asNumber(annualRate), 0)

  if (amount <= 0 || termMonths <= 0) return 0
  if (apr === 0) return roundMoney(amount / termMonths)

  const monthlyRate = apr / 12
  return roundMoney((amount * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -termMonths)))
}

export function calculateFleetFinanceDetails({
  sellingPrice,
  apr = DEFAULT_APR,
  termMonths = DEFAULT_TERM_MONTHS,
  province = DEFAULT_PROVINCE,
  warrantyTier = DEFAULT_WARRANTY_TIER,
} = {}) {
  const publicSellingPrice = roundMoney(positiveNumber(sellingPrice))
  const normalizedProvince = clean(province).toUpperCase() || DEFAULT_PROVINCE
  const taxRate = PROVINCE_TAX_RATES[normalizedProvince] ?? PROVINCE_TAX_RATES[DEFAULT_PROVINCE]
  const warranty = WARRANTY_OPTIONS[clean(warrantyTier)] || WARRANTY_OPTIONS[DEFAULT_WARRANTY_TIER]
  const warrantyPrice = roundMoney(warranty.price)
  const gapPriceWithTax = roundMoney(GAP_PRICE * (1 + GAP_TAX_RATE))
  const financedNoProtection = roundMoney(publicSellingPrice * (1 + taxRate) + FINANCE_FEE)
  const financedWithProtection = roundMoney((publicSellingPrice + warrantyPrice) * (1 + taxRate) + gapPriceWithTax + FINANCE_FEE)
  const monthlyNoProtection = calculateMonthlyPayment(financedNoProtection, apr, termMonths)
  const monthlyWithProtection = calculateMonthlyPayment(financedWithProtection, apr, termMonths)

  return {
    sellingPrice: publicSellingPrice,
    province: normalizedProvince,
    taxRate,
    apr: asNumber(apr),
    termMonths: Math.round(asNumber(termMonths)),
    warrantyTier: clean(warrantyTier) || DEFAULT_WARRANTY_TIER,
    warrantyLabel: warranty.label,
    warrantyPrice,
    gapPrice: GAP_PRICE,
    gapPriceWithTax,
    financeFee: FINANCE_FEE,
    financedNoProtection,
    financedWithProtection,
    monthlyNoProtection,
    monthlyWithProtection,
    biweeklyNoProtection: roundMoney(monthlyNoProtection * 12 / 26),
    biweeklyWithProtection: roundMoney(monthlyWithProtection * 12 / 26),
  }
}

export function calculateProtectionBiweeklyUpcharge(details) {
  return roundMoney((asNumber(details?.monthlyWithProtection) - asNumber(details?.monthlyNoProtection)) * 12 / 26)
}

export function buildFleetQuoteVehicle(vehicle = {}, terms = {}) {
  const sellingPrice = positiveNumber(vehicle.finance_price, vehicle.financePrice, vehicle.price, vehicle.retail_price, vehicle.retailPrice)
  const details = calculateFleetFinanceDetails({ ...terms, sellingPrice })
  const year = asNumber(vehicle.year) || null
  const make = clean(vehicle.make)
  const model = clean(vehicle.model)
  const series = clean(vehicle.series || vehicle.trim)

  return {
    vehicleId: clean(vehicle.id),
    title: [year, make, model, series].filter(Boolean).join(' '),
    sellingPrice: details.sellingPrice,
    financedNoProtection: details.financedNoProtection,
    financedWithProtection: details.financedWithProtection,
    monthlyNoProtection: details.monthlyNoProtection,
    monthlyWithProtection: details.monthlyWithProtection,
    biweeklyNoProtection: details.biweeklyNoProtection,
    biweeklyWithProtection: details.biweeklyWithProtection,
    protectionBiweeklyUpcharge: calculateProtectionBiweeklyUpcharge(details),
    vehicle: {
      id: clean(vehicle.id),
      year,
      make,
      model,
      series,
      stockNumber: clean(vehicle.stock_number || vehicle.stockNumber),
      vin: clean(vehicle.vin),
      mileage: asNumber(vehicle.mileage || vehicle.odometer) || null,
      exteriorColor: clean(vehicle.exterior_color || vehicle.exteriorColor),
      photoUrl: clean(vehicle.image_url || vehicle.imageUrl || vehicle.main_photo || vehicle.mainPhoto),
      inventoryType: clean(vehicle.inventory_type || vehicle.inventoryType || vehicle.categories),
    },
  }
}
