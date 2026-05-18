import assert from 'node:assert/strict'
import { test } from 'node:test'
import XLSX from 'xlsx-js-style'

import {
  calculateMarketStats,
  defaultGoodBuySettings,
  describeGoodBuyError,
  normalizeVin,
  parseFleetWorkbook,
  scoreGoodBuyVehicle,
  scoreShortlistVehicle,
  summarizeUpload,
  validateGoodBuyImportSelection,
} from './goodBuyAnalyzer.mjs'

const workbookBuffer = (rows) => {
  const ws = XLSX.utils.aoa_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Fleet')
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
}

test('parses xlsx fleet rows with flexible headers', () => {
  const file = workbookBuffer([
    ['Unit ID', 'VIN', 'Year', 'Make', 'Model', 'Series', 'Kilometers', 'List Price'],
    ['A-100', ' 4s4btancxm3000001 ', '2021', 'Subaru', 'Outback', 'Limited', '42,000', '$28,500'],
  ])

  const parsed = parseFleetWorkbook(file, 'fleet.xlsx')

  assert.equal(parsed.vehicles.length, 1)
  assert.equal(parsed.skipped.length, 0)
  assert.deepEqual(parsed.vehicles[0], {
    sourceRow: 2,
    stockNumber: 'A-100',
    vin: '4S4BTANCXM3000001',
    year: 2021,
    make: 'Subaru',
    model: 'Outback',
    trim: 'Limited',
    mileage: 42000,
    listedPrice: 28500,
    raw: {
      'unit id': 'A-100',
      vin: ' 4s4btancxm3000001 ',
      year: '2021',
      make: 'Subaru',
      model: 'Outback',
      series: 'Limited',
      kilometers: '42,000',
      'list price': '$28,500',
    },
    validationFlags: [],
  })
})

test('parses csv fleet rows and reports missing required data', () => {
  const csv = Buffer.from([
    'Stock #,VIN,Year,Make,Model,KM,Price',
    'A-101,1HGCM82633A004352,2020,Honda,Accord,80000,',
    'A-102,,2021,Toyota,RAV4,60000,26000',
  ].join('\n'))

  const parsed = parseFleetWorkbook(csv, 'fleet.csv')

  assert.equal(parsed.vehicles.length, 0)
  assert.deepEqual(parsed.skipped.map((row) => row.reason), [
    'Missing listed price',
    'Missing VIN',
  ])
})

test('flags duplicate VIN and stock rows without stopping valid rows', () => {
  const file = workbookBuffer([
    ['Stock', 'VIN', 'Year', 'Make', 'Model', 'Mileage', 'Price'],
    ['A-100', '4S4BTANCXM3000001', 2021, 'Subaru', 'Outback', 42000, 28500],
    ['A-100', '4S4BTANCXM3000001', 2021, 'Subaru', 'Outback', 42000, 28400],
  ])

  const parsed = parseFleetWorkbook(file, 'fleet.xlsx')

  assert.equal(parsed.vehicles.length, 1)
  assert.equal(parsed.skipped.length, 1)
  assert.match(parsed.skipped[0].reason, /Duplicate stock number A-100/)
})

test('normalizes VIN and flags invalid characters or length', () => {
  assert.deepEqual(normalizeVin(' 4s4btancxm3000001 '), {
    vin: '4S4BTANCXM3000001',
    valid: true,
    flags: [],
  })

  assert.deepEqual(normalizeVin('ABCIOQ123'), {
    vin: 'ABCIOQ123',
    valid: false,
    flags: ['VIN must be 17 characters', 'VIN cannot contain I, O, or Q'],
  })
})

test('calculates manual market comp averages and market position', () => {
  const stats = calculateMarketStats([
    { source: 'manual', price: 30000, mileage: 45000 },
    { source: 'manual', price: 32000, mileage: 39000 },
    { source: 'manual', price: 28000, mileage: 62000 },
  ], { listedPrice: 28500 })

  assert.deepEqual(stats, {
    count: 3,
    averagePrice: 30000,
    lowestPrice: 28000,
    highestPrice: 32000,
    averageMileage: 48667,
    priceDifference: 1500,
    marketPositionPercent: 13,
    confidence: 'medium',
  })
})

test('scores strong buy, good buy, avoid, and manual review outcomes', () => {
  const settings = {
    ...defaultGoodBuySettings,
    minimumProfitMargin: 2500,
    preferredMakes: ['Subaru'],
    excludedMakes: ['Maserati'],
  }

  const strong = scoreGoodBuyVehicle({
    vin: '4S4BTANCXM3000001',
    year: 2021,
    make: 'Subaru',
    model: 'Outback',
    mileage: 42000,
    listedPrice: 26000,
    marketStats: {
      count: 5,
      averagePrice: 32000,
      lowestPrice: 30000,
      highestPrice: 35000,
      averageMileage: 50000,
      priceDifference: 6000,
      marketPositionPercent: 0,
      confidence: 'high',
    },
  }, settings)

  assert.equal(strong.recommendation, 'Strong Buy')
  assert.ok(strong.score >= 85)
  assert.ok(strong.reasons.some((reason) => reason.includes('below market')))

  const good = scoreGoodBuyVehicle({
    vin: '1HGCM82633A004352',
    year: 2020,
    make: 'Honda',
    model: 'Accord',
    mileage: 76000,
    listedPrice: 25500,
    marketStats: {
      count: 4,
      averagePrice: 28500,
      lowestPrice: 27000,
      highestPrice: 30500,
      averageMileage: 78000,
      priceDifference: 3000,
      marketPositionPercent: 0,
      confidence: 'medium',
    },
  }, settings)

  assert.equal(good.recommendation, 'Good Buy')

  const avoid = scoreGoodBuyVehicle({
    vin: 'ZAM57RTA1F1150001',
    year: 2015,
    make: 'Maserati',
    model: 'Ghibli',
    mileage: 145000,
    listedPrice: 31000,
    marketStats: {
      count: 3,
      averagePrice: 29000,
      lowestPrice: 27000,
      highestPrice: 32000,
      averageMileage: 100000,
      priceDifference: -2000,
      marketPositionPercent: 80,
      confidence: 'medium',
    },
  }, settings)

  assert.equal(avoid.recommendation, 'Avoid')
  assert.ok(avoid.riskFlags.includes('excluded_make'))

  const review = scoreGoodBuyVehicle({
    vin: 'BADVIN',
    year: 2021,
    make: 'Toyota',
    model: 'RAV4',
    mileage: 60000,
    listedPrice: 26000,
    marketStats: { count: 0 },
  }, settings)

  assert.equal(review.recommendation, 'Needs Manual Review')
})

test('scores uploaded vehicles into shortlist recommendations before market comps exist', () => {
  const priority = scoreShortlistVehicle({
    vin: 'KM8K12AA0SU123456',
    year: 2025,
    make: 'Hyundai',
    model: 'Kona',
    trim: 'AWD',
    mileage: 16018,
    listedPrice: 31700,
    raw: { equip: 'KONA AWD SUV' },
  })

  assert.equal(priority.recommendation, 'Priority Research')
  assert.ok(priority.score >= 80)
  assert.ok(priority.reasons.some((reason) => reason.includes('AWD')))

  const low = scoreShortlistVehicle({
    vin: '1HGCM82633A004352',
    year: 2020,
    make: 'Honda',
    model: 'Accord',
    mileage: 222556,
    listedPrice: 26800,
    raw: { equip: 'ACCORD SEDAN' },
  })

  assert.ok(['Low Priority', 'Avoid / Risk'].includes(low.recommendation))
  assert.ok(low.riskFlags.includes('high_mileage'))
})

test('shortlist scoring flags incomplete rows as missing data', () => {
  const result = scoreShortlistVehicle({
    vin: 'BADVIN',
    year: 2024,
    make: 'Toyota',
    model: 'RAV4',
    mileage: 0,
    listedPrice: 0,
  })

  assert.equal(result.recommendation, 'Missing Data')
  assert.equal(result.score, 0)
  assert.ok(result.riskFlags.includes('invalid_vin'))
  assert.ok(result.riskFlags.includes('missing_price'))
  assert.ok(result.riskFlags.includes('missing_mileage'))
})

test('validates import selection before inventory insert', () => {
  const result = validateGoodBuyImportSelection([
    { id: 'row-1', vin: '1HGCM82633A004352', stock_number: 'A-100' },
    { id: 'row-2', vin: '4S4BTANCXM3000001', stock_number: 'A-101', imported_vehicle_id: 'vehicle-1' },
    { id: 'row-3', vin: '1HGCM82633A004352', stock_number: 'A-102' },
    { id: 'row-4', vin: '5NMS3CAD8LH123456', stock_number: 'A-103' },
  ], [
    { id: 'existing-1', vin: '5NMS3CAD8LH123456', stock_number: 'INV-9' },
  ])

  assert.deepEqual(result.importableIds, [])
  assert.deepEqual(result.blocked.map((item) => item.reason), [
    'Duplicate VIN selected in this import',
    'Already imported from this analyzer',
    'Duplicate VIN selected in this import',
    'VIN already exists in inventory',
  ])
  assert.match(result.message, /No selected vehicles can be imported/)
  assert.match(result.message, /1HGCM82633A004352/)
  assert.match(result.message, /5NMS3CAD8LH123456/)
})

test('import validation allows non-conflicting selected rows', () => {
  const result = validateGoodBuyImportSelection([
    { id: 'row-1', vin: 'WA1AAAFY2R2062693', stock_number: 'A-100' },
    { id: 'row-2', vin: 'WAUD3AF25NN016211', stock_number: 'A-101' },
  ], [
    { id: 'existing-1', vin: '5NMS3CAD8LH123456', stock_number: 'INV-9' },
  ])

  assert.deepEqual(result.importableIds, ['row-1', 'row-2'])
  assert.equal(result.blocked.length, 0)
  assert.equal(result.message, '')
})

test('summarizes upload dashboard buckets', () => {
  const summary = summarizeUpload([
    { recommendation: 'Strong Buy', projectedProfit: 5000, score: 91, riskFlags: [] },
    { recommendation: 'Good Buy', projectedProfit: 3200, score: 75, riskFlags: [] },
    { recommendation: 'Avoid', projectedProfit: -1000, score: 30, riskFlags: ['priced_above_market'] },
    { recommendation: 'Needs Manual Review', projectedProfit: 0, score: 0, riskFlags: ['missing_market_comps'] },
  ])

  assert.deepEqual(summary, {
    total: 4,
    topRecommended: 2,
    highestProfitMargin: 5000,
    lowestRiskVehicles: 2,
    overpricedVehicles: 1,
    manualReview: 1,
  })
})

test('describes Supabase setup errors with actionable messages', () => {
  assert.equal(
    describeGoodBuyError({
      code: '42501',
      message: 'new row violates row-level security policy for table "edc_good_buy_uploads"',
    }, 'Failed to parse upload'),
    'Good Buy Analyzer database access is blocked by Supabase RLS. Apply supabase/edc_good_buy_analyzer.sql or set SUPABASE_SERVICE_ROLE_KEY on the server.'
  )

  assert.equal(
    describeGoodBuyError({
      code: '42P01',
      message: 'relation "public.edc_good_buy_uploads" does not exist',
    }, 'Failed to parse upload'),
    'Good Buy Analyzer database tables are missing. Apply supabase/edc_good_buy_analyzer.sql.'
  )

  assert.equal(
    describeGoodBuyError({
      code: '23505',
      message: 'duplicate key value violates unique constraint "edc_vehicles_vin_key"',
    }, 'Failed to import selected rows'),
    'One or more selected VINs already exist in inventory. Deselect duplicate vehicles and try importing again.'
  )
})
