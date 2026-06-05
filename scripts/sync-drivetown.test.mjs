import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const {
  buildRunStatus,
  isDuplicateConstraintError,
  normalizeEnvValue,
  pickKnownColumns,
  requireMarketplaceColumns,
  stripSourceColumns,
} = require('./sync-drivetown.js')

test('normalizeEnvValue removes surrounding dotenv quotes', () => {
  assert.equal(normalizeEnvValue('"https://example.supabase.co"'), 'https://example.supabase.co')
  assert.equal(normalizeEnvValue("'service-role-key'"), 'service-role-key')
  assert.equal(normalizeEnvValue(' unquoted '), 'unquoted')
})

test('stripSourceColumns moves source identity into notes for older schemas', () => {
  const row = stripSourceColumns({
    notes: 'Imported from DriveTown Ottawa feed',
    source_name: 'DriveTown Ottawa',
    source_url: 'https://drivetownottawa.com/inventory/2017-ram-1500/14205830',
    source_vehicle_id: '14205830',
    source_last_seen_at: '2026-06-05T00:00:00.000Z',
    source_last_synced_at: '2026-06-05T00:00:00.000Z',
    source_sync_status: 'active',
    vin: '1C6RR7NT1HS840918',
  })

  assert.equal(row.source_name, undefined)
  assert.equal(row.source_url, undefined)
  assert.equal(row.vin, '1C6RR7NT1HS840918')
  assert.match(row.notes, /Imported from DriveTown Ottawa feed/)
  assert.match(row.notes, /source_url=https:\/\/drivetownottawa.com\/inventory\/2017-ram-1500\/14205830/)
  assert.match(row.notes, /source_vehicle_id=14205830/)
})

test('pickKnownColumns removes fields missing from deployed schema', () => {
  const row = pickKnownColumns({
    vin: '1C6RR7NT1HS840918',
    images: ['https://example.com/image.jpg'],
    source_name: 'DriveTown Ottawa',
    price: 19871,
  }, new Set(['vin', 'price']))

  assert.deepEqual(row, {
    vin: '1C6RR7NT1HS840918',
    price: 19871,
  })
})

test('isDuplicateConstraintError detects Supabase unique constraint failures', () => {
  assert.equal(isDuplicateConstraintError({ code: '23505', message: 'duplicate key value violates unique constraint' }), true)
  assert.equal(isDuplicateConstraintError({ code: 'PGRST204', message: 'missing column' }), false)
})

test('buildRunStatus reports success, partial, and failed from counts and fatal error', () => {
  assert.equal(buildRunStatus({ failed: 0, writeFailed: 0 }, null), 'success')
  assert.equal(buildRunStatus({ failed: 1, writeFailed: 0 }, null), 'partial')
  assert.equal(buildRunStatus({ failed: 0, writeFailed: 2 }, null), 'partial')
  assert.equal(buildRunStatus({ failed: 0, writeFailed: 0 }, new Error('boom')), 'failed')
})

test('requireMarketplaceColumns fails when migration columns are unavailable', () => {
  assert.throws(
    () => requireMarketplaceColumns(new Set(['id', 'vin'])),
    /Apply supabase\/marketplace_inventory_schema.sql/
  )

  assert.doesNotThrow(() => requireMarketplaceColumns(new Set([
    'id',
    'images',
    'marketplace_source',
    'marketplace_source_url',
    'marketplace_source_vehicle_id',
    'marketplace_last_seen_at',
    'marketplace_last_synced_at',
    'marketplace_sync_status',
    'marketplace_original_vin',
    'marketplace_original_stock_number',
  ])))
})
