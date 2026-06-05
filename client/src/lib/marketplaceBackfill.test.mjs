import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildDriveTownSourceRow,
  buildMarketplaceBackfillUpdate,
  parseLegacySourceNotes,
} from './marketplaceBackfill.mjs'

const legacyVehicle = {
  id: 'vehicle-1',
  user_id: 'dealer-user-1',
  vin: '1C6RR7NT1HS840918',
  stock_number: 'A6450',
  updated_at: '2026-06-05T08:16:28.218Z',
  notes: 'Imported from DriveTown Ottawa feed; source_url=https://drivetownottawa.com/inventory/2017-ram-1500/14205830; source_vehicle_id=14205830',
}

test('parseLegacySourceNotes extracts source URL and id', () => {
  assert.deepEqual(parseLegacySourceNotes(legacyVehicle.notes), {
    sourceUrl: 'https://drivetownottawa.com/inventory/2017-ram-1500/14205830',
    sourceVehicleId: '14205830',
  })
})

test('buildMarketplaceBackfillUpdate creates marketplace fields from legacy row', () => {
  const update = buildMarketplaceBackfillUpdate(legacyVehicle)

  assert.equal(update.marketplace_source, 'DriveTown Ottawa')
  assert.equal(update.marketplace_source_url, 'https://drivetownottawa.com/inventory/2017-ram-1500/14205830')
  assert.equal(update.marketplace_source_vehicle_id, '14205830')
  assert.equal(update.marketplace_last_seen_at, legacyVehicle.updated_at)
  assert.equal(update.marketplace_last_synced_at, legacyVehicle.updated_at)
  assert.equal(update.marketplace_sync_status, 'active')
  assert.equal(update.marketplace_original_vin, '1C6RR7NT1HS840918')
  assert.equal(update.marketplace_original_stock_number, 'A6450')
})

test('buildDriveTownSourceRow creates the source configuration row', () => {
  const row = buildDriveTownSourceRow('dealer-user-1')

  assert.equal(row.user_id, 'dealer-user-1')
  assert.equal(row.source_name, 'DriveTown Ottawa')
  assert.equal(row.website_url, 'https://drivetownottawa.com/')
  assert.equal(row.inventory_url, 'https://drivetownottawa.com/vehicles/')
  assert.equal(row.source_type, 'dealer_site')
  assert.equal(row.enabled, true)
})
