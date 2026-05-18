import XLSX from 'xlsx-js-style'

const clean = (value) => String(value ?? '').trim()
const lower = (value) => clean(value).toLowerCase()

const toNumber = (value) => {
  const raw = clean(value).replace(/[$,\s]/g, '')
  if (!raw) return 0
  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : 0
}

const normalizeHeader = (value) =>
  lower(value)
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

const HEADER_ALIASES = {
  stockNumber: ['stock number', 'stock #', 'stock', 'unit id', 'unit'],
  vin: ['vin', 'vehicle identification number'],
  year: ['year', 'model year'],
  make: ['make'],
  model: ['model'],
  trim: ['trim', 'series', 'package'],
  mileage: ['kilometers', 'kilometres', 'km', 'mileage', 'odometer'],
  listedPrice: ['price', 'list price', 'listed price', 'asking price', 'amount'],
}

export const defaultGoodBuySettings = {
  region: 'ON',
  minimumProfitMargin: 2500,
  maximumMileage: 180000,
  preferredMakes: [],
  excludedMakes: [],
  scoringWeights: {
    priceBelowMarket: 30,
    mileageCondition: 20,
    margin: 20,
    demand: 15,
    vehicleAge: 10,
    riskFlags: 5,
  },
  sourceToggles: {
    manual: true,
    autotrader: false,
    cargurus: false,
    cars: false,
    dealerSites: false,
    facebookManual: true,
  },
}

export function describeGoodBuyError(error, fallback = 'Good Buy Analyzer request failed') {
  const message = clean(error?.message || error?.error_description || error?.details || error)
  if (/duplicate key value.*edc_vehicles_vin_key|edc_vehicles_vin_key/i.test(message)) {
    return 'One or more selected VINs already exist in inventory. Deselect duplicate vehicles and try importing again.'
  }
  if (/row-level security|row level security/i.test(message)) {
    return 'Good Buy Analyzer database access is blocked by Supabase RLS. Apply supabase/edc_good_buy_analyzer.sql or set SUPABASE_SERVICE_ROLE_KEY on the server.'
  }
  if (/relation .*edc_good_buy_.* does not exist|schema cache.*edc_good_buy_/i.test(message)) {
    return 'Good Buy Analyzer database tables are missing. Apply supabase/edc_good_buy_analyzer.sql.'
  }
  return message || fallback
}

const findColumn = (headers, aliases) => {
  const normalized = aliases.map(normalizeHeader)
  return headers.findIndex((header) => normalized.includes(header))
}

const readWorkbookRows = (buffer) => {
  const wb = XLSX.read(buffer, {
    type: 'buffer',
    cellDates: false,
    raw: false,
  })
  const sheetName = wb.SheetNames[0]
  if (!sheetName) throw new Error('Workbook has no sheets')
  const ws = wb.Sheets[sheetName]
  return XLSX.utils.sheet_to_json(ws, {
    header: 1,
    defval: '',
    blankrows: false,
    raw: false,
  })
}

export function normalizeVin(value) {
  const vin = clean(value).toUpperCase().replace(/[^A-Z0-9]/g, '')
  const flags = []
  if (vin.length !== 17) flags.push('VIN must be 17 characters')
  if (/[IOQ]/.test(vin)) flags.push('VIN cannot contain I, O, or Q')
  return { vin, valid: flags.length === 0, flags }
}

export function parseFleetWorkbook(buffer, fileName = 'fleet.xlsx') {
  void fileName
  const rows = readWorkbookRows(buffer)
  if (rows.length < 2) throw new Error('Workbook has no vehicle rows')

  const headers = (rows[0] || []).map(normalizeHeader)
  const columns = Object.fromEntries(
    Object.entries(HEADER_ALIASES).map(([key, aliases]) => [key, findColumn(headers, aliases)])
  )

  const missingColumns = [
    columns.vin < 0 ? 'VIN' : '',
    columns.year < 0 ? 'Year' : '',
    columns.make < 0 ? 'Make' : '',
    columns.model < 0 ? 'Model' : '',
    columns.mileage < 0 ? 'Mileage / kilometers' : '',
    columns.listedPrice < 0 ? 'Price / list price' : '',
  ].filter(Boolean)

  if (missingColumns.length) {
    throw new Error(`Missing required column(s): ${missingColumns.join(', ')}`)
  }

  const vehicles = []
  const skipped = []
  const seenStocks = new Set()
  const seenVins = new Set()

  rows.slice(1).forEach((row, offset) => {
    const sourceRow = offset + 2
    if (!row.some((cell) => clean(cell))) return

    const get = (idx) => (idx >= 0 ? row[idx] : '')
    const raw = {}
    headers.forEach((header, idx) => {
      if (header) raw[header] = row[idx]
    })

    const vinInfo = normalizeVin(get(columns.vin))
    const stockNumber = clean(get(columns.stockNumber)).toUpperCase()
    const year = Math.round(toNumber(get(columns.year)))
    const make = clean(get(columns.make))
    const model = clean(get(columns.model))
    const trim = clean(get(columns.trim))
    const mileage = Math.round(toNumber(get(columns.mileage)))
    const listedPrice = toNumber(get(columns.listedPrice))

    const missing = [
      !vinInfo.vin ? 'VIN' : '',
      !year ? 'year' : '',
      !make ? 'make' : '',
      !model ? 'model' : '',
      !mileage ? 'mileage' : '',
      !listedPrice ? 'listed price' : '',
    ].filter(Boolean)

    if (missing.length) {
      skipped.push({ row: sourceRow, reason: `Missing ${missing.join(', ')}` })
      return
    }

    if (stockNumber && seenStocks.has(stockNumber)) {
      skipped.push({ row: sourceRow, reason: `Duplicate stock number ${stockNumber}` })
      return
    }

    if (vinInfo.vin && seenVins.has(vinInfo.vin)) {
      skipped.push({ row: sourceRow, reason: `Duplicate VIN ${vinInfo.vin}` })
      return
    }

    if (stockNumber) seenStocks.add(stockNumber)
    seenVins.add(vinInfo.vin)

    vehicles.push({
      sourceRow,
      stockNumber,
      vin: vinInfo.vin,
      year,
      make,
      model,
      trim,
      mileage,
      listedPrice,
      raw,
      validationFlags: vinInfo.flags,
    })
  })

  return { vehicles, skipped }
}

export function calculateMarketStats(comps = [], vehicle = {}) {
  const valid = comps
    .map((comp) => ({
      ...comp,
      price: toNumber(comp?.price),
      mileage: toNumber(comp?.mileage),
    }))
    .filter((comp) => comp.price > 0)

  if (!valid.length) return { count: 0 }

  const prices = valid.map((comp) => comp.price)
  const mileages = valid.map((comp) => comp.mileage).filter((value) => value > 0)
  const averagePrice = Math.round(prices.reduce((sum, value) => sum + value, 0) / prices.length)
  const lowestPrice = Math.min(...prices)
  const highestPrice = Math.max(...prices)
  const averageMileage = mileages.length
    ? Math.round(mileages.reduce((sum, value) => sum + value, 0) / mileages.length)
    : 0
  const listedPrice = toNumber(vehicle?.listedPrice)
  const range = Math.max(1, highestPrice - lowestPrice)
  const marketPositionPercent = listedPrice > 0
    ? Math.round(Math.max(0, Math.min(100, ((listedPrice - lowestPrice) / range) * 100)))
    : 0

  return {
    count: valid.length,
    averagePrice,
    lowestPrice,
    highestPrice,
    averageMileage,
    priceDifference: listedPrice > 0 ? averagePrice - listedPrice : 0,
    marketPositionPercent,
    confidence: valid.length >= 5 ? 'high' : valid.length >= 3 ? 'medium' : 'low',
  }
}

const clampScore = (value) => Math.max(0, Math.min(100, Math.round(value)))

const vehicleAge = (year) => {
  const currentYear = new Date().getFullYear()
  return Math.max(0, currentYear - Number(year || currentYear))
}

const vehicleText = (vehicle) => [
  vehicle?.make,
  vehicle?.model,
  vehicle?.trim,
  vehicle?.series,
  vehicle?.bodyStyle,
  vehicle?.raw?.equip,
  vehicle?.raw?.equipment,
  vehicle?.raw?.series,
].map(lower).filter(Boolean).join(' ')

const priceBandScore = (price) => {
  if (price <= 0) return 0
  if (price < 20000) return 92
  if (price < 30000) return 86
  if (price < 40000) return 76
  if (price < 55000) return 62
  if (price < 75000) return 46
  return 28
}

export function scoreShortlistVehicle(vehicle = {}, settings = defaultGoodBuySettings) {
  const vinInfo = normalizeVin(vehicle.vin)
  const listedPrice = toNumber(vehicle.listedPrice)
  const mileage = toNumber(vehicle.mileage)
  const year = Number(vehicle.year || 0)
  const age = vehicleAge(year)
  const ageBucket = Math.max(1, age + 1)
  const expectedMileage = Math.max(24000, ageBucket * 24000)
  const mileageRatio = mileage > 0 ? mileage / expectedMileage : 0
  const text = vehicleText(vehicle)
  const make = lower(vehicle.make)
  const preferredMakes = (settings?.preferredMakes || []).map(lower)
  const excludedMakes = (settings?.excludedMakes || []).map(lower)
  const desirablePattern = /\b(awd|4wd|xdrive|quattro|suv|truck|pickup|rav4|cr-v|crv|q5|x3|f-150|silverado|sierra|tacoma|tundra|wrangler|grand cherokee)\b/
  const luxuryRiskMakes = new Set(['audi', 'bmw', 'merb', 'mercedes', 'mercedes-benz', 'infi', 'infiniti', 'volv', 'volvo', 'mini'])
  const riskFlags = []

  if (!vinInfo.valid) riskFlags.push('invalid_vin')
  if (!year) riskFlags.push('missing_year')
  if (!listedPrice) riskFlags.push('missing_price')
  if (!mileage) riskFlags.push('missing_mileage')
  if (mileage > settings.maximumMileage) riskFlags.push('high_mileage')
  if (excludedMakes.includes(make)) riskFlags.push('excluded_make')
  if (luxuryRiskMakes.has(make) && mileage > 90000) riskFlags.push('luxury_high_mileage')

  if (riskFlags.some((flag) => ['invalid_vin', 'missing_year', 'missing_price', 'missing_mileage'].includes(flag))) {
    return {
      score: 0,
      recommendation: 'Missing Data',
      suggestedMaxPurchasePrice: 0,
      estimatedResaleValue: 0,
      projectedProfit: 0,
      projectedMarginPercent: 0,
      marketPositionPercent: 0,
      reasons: ['Missing or unreliable upload data. Fix this before researching value.'],
      riskFlags,
      factorScores: {
        price: 0,
        mileage: 0,
        age: 0,
        demand: 0,
        risk: 0,
      },
    }
  }

  const mileageScore = mileageRatio <= 0.7 ? 100
    : mileageRatio <= 1 ? 84
      : mileageRatio <= 1.25 ? 66
        : mileageRatio <= 1.6 ? 40
          : 15
  const ageScore = age <= 1 ? 96 : age <= 3 ? 84 : age <= 5 ? 66 : age <= 7 ? 44 : 22
  const demandScore = desirablePattern.test(text) ? 90
    : preferredMakes.includes(make) ? 88
      : luxuryRiskMakes.has(make) ? 58
        : 68
  const riskScore = clampScore(100 - riskFlags.length * 28)
  const priceScore = priceBandScore(listedPrice)
  const score = clampScore((
    mileageScore * 0.28 +
    ageScore * 0.24 +
    priceScore * 0.22 +
    demandScore * 0.16 +
    riskScore * 0.10
  ))

  const reasons = []
  if (desirablePattern.test(text)) reasons.push('Desirable equipment/body signal found, such as AWD, SUV, truck, or similar demand keyword.')
  if (mileageRatio <= 1) reasons.push('Mileage is at or below the expected range for its age.')
  else if (riskFlags.includes('high_mileage')) reasons.push('Mileage is above the configured maximum.')
  else reasons.push('Mileage is above the expected range for its age.')
  if (listedPrice < 30000) reasons.push('Listed price is in a lower research-friendly band.')
  if (age <= 3) reasons.push('Newer model year keeps this worth checking before manual valuation.')
  if (riskFlags.includes('luxury_high_mileage')) reasons.push('Luxury/high-maintenance make with higher mileage needs tighter margin review.')
  if (riskFlags.includes('excluded_make')) reasons.push('Make is in the excluded list.')

  let recommendation = 'Maybe'
  if (riskFlags.includes('excluded_make') || score < 40) recommendation = 'Avoid / Risk'
  else if (riskFlags.includes('high_mileage') || riskFlags.includes('luxury_high_mileage') || score < 58) recommendation = 'Low Priority'
  else if (score >= 88 && riskFlags.length === 0) recommendation = 'Priority Research'
  else if (score >= 76) recommendation = 'Worth Checking'

  return {
    score,
    recommendation,
    suggestedMaxPurchasePrice: 0,
    estimatedResaleValue: 0,
    projectedProfit: 0,
    projectedMarginPercent: 0,
    marketPositionPercent: 0,
    reasons,
    riskFlags,
    factorScores: {
      price: priceScore,
      mileage: mileageScore,
      age: ageScore,
      demand: demandScore,
      risk: riskScore,
    },
  }
}

export function scoreGoodBuyVehicle(vehicle = {}, settings = defaultGoodBuySettings) {
  const merged = {
    ...defaultGoodBuySettings,
    ...settings,
    scoringWeights: {
      ...defaultGoodBuySettings.scoringWeights,
      ...(settings?.scoringWeights || {}),
    },
  }
  const vinInfo = normalizeVin(vehicle.vin)
  const marketStats = vehicle.marketStats || { count: 0 }
  const listedPrice = toNumber(vehicle.listedPrice)
  const mileage = toNumber(vehicle.mileage)
  const averagePrice = toNumber(marketStats.averagePrice)
  const projectedProfit = averagePrice > 0 && listedPrice > 0 ? Math.round(averagePrice - listedPrice) : 0
  const projectedMarginPercent = averagePrice > 0 ? Math.round((projectedProfit / averagePrice) * 100) : 0
  const age = vehicleAge(vehicle.year)
  const expectedMileage = Math.max(1, age * 20000)
  const make = lower(vehicle.make)
  const preferredMakes = (merged.preferredMakes || []).map(lower)
  const excludedMakes = (merged.excludedMakes || []).map(lower)

  const riskFlags = []
  if (!vinInfo.valid) riskFlags.push('invalid_vin')
  if (!listedPrice) riskFlags.push('missing_price')
  if (!mileage) riskFlags.push('missing_mileage')
  if (!marketStats.count) riskFlags.push('missing_market_comps')
  if (mileage > merged.maximumMileage) riskFlags.push('high_mileage')
  if (excludedMakes.includes(make)) riskFlags.push('excluded_make')
  if (projectedProfit < 0) riskFlags.push('priced_above_market')

  if (riskFlags.includes('invalid_vin') || riskFlags.includes('missing_price') || riskFlags.includes('missing_mileage') || riskFlags.includes('missing_market_comps')) {
    return {
      score: 0,
      recommendation: 'Needs Manual Review',
      suggestedMaxPurchasePrice: 0,
      estimatedResaleValue: averagePrice,
      projectedProfit,
      projectedMarginPercent,
      marketPositionPercent: marketStats.marketPositionPercent ?? 0,
      reasons: ['Missing or unreliable required data.'],
      riskFlags,
    }
  }

  const priceBelowMarketScore = averagePrice > 0
    ? clampScore(((averagePrice - listedPrice) / averagePrice) * 500)
    : 0
  const mileageConditionScore = clampScore((1 - (mileage - expectedMileage) / Math.max(expectedMileage, mileage)) * 100)
  const marginScore = clampScore((projectedProfit / Math.max(1, merged.minimumProfitMargin)) * 100)
  const demandScore = preferredMakes.length === 0 ? 70 : preferredMakes.includes(make) ? 100 : 55
  const ageScore = clampScore(100 - age * 8)
  const riskScore = clampScore(100 - riskFlags.length * 35)
  const weights = merged.scoringWeights
  const totalWeight = Object.values(weights).reduce((sum, value) => sum + Number(value || 0), 0) || 100
  const score = clampScore((
    priceBelowMarketScore * weights.priceBelowMarket +
    mileageConditionScore * weights.mileageCondition +
    marginScore * weights.margin +
    demandScore * weights.demand +
    ageScore * weights.vehicleAge +
    riskScore * weights.riskFlags
  ) / totalWeight)

  const reasons = []
  if (projectedProfit > 0) reasons.push(`Projected $${projectedProfit.toLocaleString('en-CA')} below market average.`)
  if (marketStats.confidence) reasons.push(`${marketStats.confidence} confidence from ${marketStats.count} comparable listing(s).`)
  if (mileage <= expectedMileage) reasons.push('Mileage is at or below expected range for its age.')
  if (preferredMakes.includes(make)) reasons.push('Make is in the preferred list.')
  if (riskFlags.length) reasons.push(`Risk flags: ${riskFlags.join(', ')}.`)

  let recommendation = 'Maybe'
  if (riskFlags.includes('excluded_make') || projectedProfit < 0 || score < 55) recommendation = 'Avoid'
  else if (score >= 85 && projectedProfit >= merged.minimumProfitMargin && riskFlags.length === 0) recommendation = 'Strong Buy'
  else if (score >= 70 && projectedProfit >= merged.minimumProfitMargin) recommendation = 'Good Buy'

  return {
    score,
    recommendation,
    suggestedMaxPurchasePrice: Math.max(0, Math.round(averagePrice - merged.minimumProfitMargin)),
    estimatedResaleValue: averagePrice,
    projectedProfit,
    projectedMarginPercent,
    marketPositionPercent: marketStats.marketPositionPercent ?? 0,
    reasons,
    riskFlags,
    factorScores: {
      priceBelowMarket: priceBelowMarketScore,
      mileageCondition: mileageConditionScore,
      margin: marginScore,
      demand: demandScore,
      vehicleAge: ageScore,
      riskFlags: riskScore,
    },
  }
}

export function summarizeUpload(rows = []) {
  return {
    total: rows.length,
    topRecommended: rows.filter((row) => ['Strong Buy', 'Good Buy'].includes(row.recommendation)).length,
    highestProfitMargin: rows.length ? Math.max(...rows.map((row) => toNumber(row.projectedProfit))) : 0,
    lowestRiskVehicles: rows.filter((row) => Array.isArray(row.riskFlags) && row.riskFlags.length === 0).length,
    overpricedVehicles: rows.filter((row) => Array.isArray(row.riskFlags) && row.riskFlags.includes('priced_above_market')).length,
    manualReview: rows.filter((row) => row.recommendation === 'Needs Manual Review').length,
  }
}

export function validateGoodBuyImportSelection(rows = [], existingVehicles = []) {
  const existingVins = new Set(existingVehicles.map((vehicle) => clean(vehicle?.vin).toUpperCase()).filter(Boolean))
  const selectedVinCounts = new Map()
  for (const row of rows) {
    const vin = clean(row?.vin).toUpperCase()
    if (!vin) continue
    selectedVinCounts.set(vin, (selectedVinCounts.get(vin) || 0) + 1)
  }

  const blocked = []
  const importableIds = []
  for (const row of rows) {
    const id = clean(row?.id)
    const vin = clean(row?.vin).toUpperCase()
    let reason = ''
    if (!id) reason = 'Missing analyzer row id'
    else if (!vin) reason = 'Missing VIN'
    else if (row?.imported_vehicle_id) reason = 'Already imported from this analyzer'
    else if ((selectedVinCounts.get(vin) || 0) > 1) reason = 'Duplicate VIN selected in this import'
    else if (existingVins.has(vin)) reason = 'VIN already exists in inventory'

    if (reason) blocked.push({ id, vin, stockNumber: clean(row?.stock_number), reason })
    else importableIds.push(id)
  }

  const message = blocked.length
    ? `${importableIds.length ? 'Some selected vehicles cannot be imported' : 'No selected vehicles can be imported'}: ${blocked.map((item) => `${item.vin || item.stockNumber || item.id} (${item.reason})`).join('; ')}.`
    : ''

  return { importableIds, blocked, message }
}
