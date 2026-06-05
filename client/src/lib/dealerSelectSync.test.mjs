import test from 'node:test'
import assert from 'node:assert/strict'

import {
  DRIVE_TOWN_SYNC_MARKER,
  buildDriveTownDealershipRow,
  buildDriveTownOwnerRow,
  buildVehicleUpsertRow,
  chooseExistingVehicle,
  computeMissingSyncedVehicles,
  shouldPreserveEditableFields,
} from './dealerSelectSync.mjs'

const scraped = {
  sourceName: 'DriveTown Ottawa',
  sourceUrl: 'https://drivetownottawa.com/vehicles/2019-ford-f-150-xlt-a1234/',
  sourceVehicleId: '2019-ford-f-150-xlt-a1234',
  title: '2019 Ford F-150 XLT 4WD',
  year: 2019,
  make: 'Ford',
  model: 'F-150',
  trim: 'XLT 4WD',
  vin: '1FTEW1E50KFA12345',
  stockNumber: 'A1234',
  price: 32995,
  mileage: 91200,
  transmission: 'Automatic',
  drivetrain: '4WD',
  fuelType: 'Gasoline',
  bodyStyle: 'Truck',
  exteriorColor: 'Black',
  interiorColor: 'Grey',
  description: 'Clean local truck.',
  features: ['Heated Seats'],
  imageUrls: ['https://images.example.com/f150-main.jpg'],
}

test('builds DriveTown dealership account rows', () => {
  assert.deepEqual(buildDriveTownOwnerRow('dealer-user-1'), {
    user_id: 'dealer-user-1',
    email: 'inventory@drivetownottawa.com',
    first_name: 'DriveTown',
    last_name: 'Ottawa',
    title: 'Owner',
    role: 'Medium dealership',
    status: 'enable',
  })

  assert.equal(buildDriveTownDealershipRow('dealer-user-1').company_name, 'DriveTown Ottawa')
  assert.equal(buildDriveTownDealershipRow('dealer-user-1').website, 'https://drivetownottawa.com/')
})

test('maps scraped vehicle to editable Dealer Select row', () => {
  const now = '2026-06-05T00:00:00.000Z'
  const row = buildVehicleUpsertRow(scraped, {
    userId: 'dealer-user-1',
    now,
    supportsDealerSelectType: true,
  })

  assert.equal(row.user_id, 'dealer-user-1')
  assert.equal(row.inventory_type, 'DEALER_SELECT')
  assert.equal(row.categories, 'dealer_select')
  assert.equal(row.status, 'In Stock')
  assert.equal(row.notes, DRIVE_TOWN_SYNC_MARKER)
  assert.equal(row.make, 'Ford')
  assert.equal(row.stock_number, 'A1234')
  assert.equal(row.vin, '1FTEW1E50KFA12345')
  assert.equal(row.price, 32995)
  assert.equal(row.mileage, 91200)
  assert.equal(row.odometer, 91200)
  assert.equal(row.source_name, 'DriveTown Ottawa')
  assert.equal(row.source_url, scraped.sourceUrl)
  assert.deepEqual(row.images, scraped.imageUrls)
})

test('falls back when DEALER_SELECT enum is not available', () => {
  const row = buildVehicleUpsertRow(scraped, {
    userId: 'dealer-user-1',
    now: '2026-06-05T00:00:00.000Z',
    supportsDealerSelectType: false,
  })

  assert.equal(row.inventory_type, 'FLEET')
  assert.equal(row.categories, 'dealer_select')
})

test('chooses existing vehicle by source URL then VIN then stock scoped to dealer', () => {
  const existing = [
    { id: 'stock-hit', user_id: 'dealer-user-1', stock_number: 'A1234', vin: 'OTHER', source_url: null },
    { id: 'vin-hit', user_id: 'dealer-user-1', stock_number: 'OTHER', vin: scraped.vin, source_url: null },
    { id: 'source-hit', user_id: 'dealer-user-1', stock_number: 'OTHER', vin: 'OTHER', source_url: scraped.sourceUrl },
    { id: 'other-dealer', user_id: 'dealer-user-2', stock_number: 'A1234', vin: scraped.vin, source_url: scraped.sourceUrl },
  ]

  assert.equal(chooseExistingVehicle(scraped, existing, 'dealer-user-1')?.id, 'source-hit')
})

test('preserves editable fields when row was manually edited after last sync', () => {
  const existing = {
    updated_at: '2026-06-05T02:00:00.000Z',
    source_last_synced_at: '2026-06-05T01:00:00.000Z',
  }

  assert.equal(shouldPreserveEditableFields(existing), true)
})

test('marks only previously synced missing vehicles as sold after complete scrape', () => {
  const previous = [
    { id: 'still-present', source_url: scraped.sourceUrl, notes: DRIVE_TOWN_SYNC_MARKER },
    { id: 'missing', source_url: 'https://drivetownottawa.com/vehicles/missing/', notes: DRIVE_TOWN_SYNC_MARKER },
    { id: 'manual', source_url: '', notes: '' },
  ]

  assert.deepEqual(
    computeMissingSyncedVehicles(previous, [scraped], { completeListing: true }).map((row) => row.id),
    ['missing']
  )
  assert.deepEqual(computeMissingSyncedVehicles(previous, [scraped], { completeListing: false }), [])
})
