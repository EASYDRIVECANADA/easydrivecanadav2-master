import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { normalizeEnvValue, stripSourceColumns } = require('./sync-drivetown.js')

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
