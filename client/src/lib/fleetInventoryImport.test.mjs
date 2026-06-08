import test from 'node:test'
import assert from 'node:assert/strict'

import { parseFleetInventoryRows } from './fleetInventoryImport.mjs'

test('parseFleetInventoryRows skips rows with missing price while keeping valid fleet vehicles', () => {
  const rows = [
    ['Location', 'Unit ID', 'Year', 'Make', 'Model', 'Kilometers', 'VIN', 'Price', 'Equip'],
    ['Ottawa', 'FLEET-001', '2021', 'Ford', 'Transit', '42000', '1FTBW2CM1MKA12345', '$24,995', 'Cargo Van'],
    ['Ottawa', 'FLEET-002', '2020', 'Ram', 'Promaster', '51000', '3C6TRVAG5LEA12345', '', 'Cargo Van'],
    ['Ottawa', 'FLEET-003', '2019', 'Chevrolet', 'Express', '61000', '1GCWGAFG9K1234567', '$21,500', 'Cargo Van'],
  ]

  const result = parseFleetInventoryRows(rows)

  assert.equal(result.vehicles.length, 2)
  assert.deepEqual(result.vehicles.map((vehicle) => vehicle.stock_number), ['FLEET-001', 'FLEET-003'])
  assert.deepEqual(result.skipped, [{ row: 3, reason: 'Missing price' }])
})
