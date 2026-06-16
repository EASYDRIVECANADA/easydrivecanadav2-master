import test from 'node:test'
import assert from 'node:assert/strict'

import { applyFleetPriceMarkup, parseFleetInventoryRows } from './fleetInventoryImport.mjs'

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

test('parseFleetInventoryRows uses EVN as the imported description', () => {
  const rows = [
    ['Location', 'Unit ID', 'Year', 'Make', 'Model', 'Series', 'Kilometers', 'Ext Color', 'VIN', 'Price', 'EVN'],
    [
      'C331-98-AP',
      '8FPXND',
      '2024',
      'MERB',
      'S2HC',
      'BDLW',
      '124225',
      'WHITE',
      'W1Y4KCHY3RP691867',
      '$36,500',
      '2024 Mercedes-Benz Sprinter 2500 High Roof 4-Cyl Diesel split swing-out Cargo Van diesel 170" WB 2.0L I4 Turbo RWD Blind Spot Assist',
    ],
  ]

  const result = parseFleetInventoryRows(rows)

  assert.equal(result.vehicles[0].description, '2024 Mercedes-Benz Sprinter 2500 High Roof 4-Cyl Diesel split swing-out Cargo Van diesel 170" WB 2.0L I4 Turbo RWD Blind Spot Assist')
  assert.equal(result.vehicles[0].equipment, '2024 Mercedes-Benz Sprinter 2500 High Roof 4-Cyl Diesel split swing-out Cargo Van diesel 170" WB 2.0L I4 Turbo RWD Blind Spot Assist')
})

test('parseFleetInventoryRows accepts common alternate price headers', () => {
  const rows = [
    ['Location', 'Unit ID', 'Year', 'Make', 'Model', 'Kilometers', 'VIN', 'Selling Price', 'Equip'],
    ['Ottawa', 'FLEET-004', '2022', 'Ford', 'Transit', '36000', '1FTBW2CM1NKA12345', '$31,995', 'Cargo Van'],
  ]

  const result = parseFleetInventoryRows(rows)

  assert.equal(result.vehicles.length, 1)
  assert.equal(result.vehicles[0].price, 31995)
})

test('applyFleetPriceMarkup adds 4000 per imported unit', () => {
  assert.equal(applyFleetPriceMarkup(36500), 40500)
})
