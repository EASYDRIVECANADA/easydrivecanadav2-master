import assert from 'node:assert/strict'
import { test } from 'node:test'

import { mapShowroomVehicle, normalizeShowroomFeatures, pickShowroomNumber } from './showroomVehicles.mjs'

test('maps showroom vehicles without requiring image storage requests', () => {
  assert.deepEqual(
    mapShowroomVehicle({
      id: 123,
      year: 2024,
      make: 'Audi',
      model: 'Q5',
      trim: 'Komfort',
      drivetrain: 'AWD',
      transmission: 'Auto',
      cylinders: '4',
      exterior_color: 'Blue',
      odometer: '45,000 km',
      sale_price: '$32,800',
      status: 'deal pending',
      vin: 'VIN123',
      stock_number: 'STK-1',
      features: '["Sunroof","Leather"]',
      categories: 'Premier',
    }),
    {
      id: '123',
      vehicle: '2024 Audi Q5 Komfort',
      drive: 'AWD',
      transmission: 'Auto',
      cyl: '4',
      colour: 'Blue',
      odometerKm: 45000,
      odoUnit: 'km',
      price: 32800,
      status: 'Deal Pending',
      images: [],
      vin: 'VIN123',
      stock: 'STK-1',
      features: ['Sunroof', 'Leather'],
      categories: 'Premier',
    }
  )
})

test('picks the first positive showroom number while preserving explicit zero fallback', () => {
  assert.equal(pickShowroomNumber('', null, '$0', '$24,500'), 24500)
  assert.equal(pickShowroomNumber('0', null), 0)
})

test('normalizes showroom feature arrays, json, and comma separated text', () => {
  assert.deepEqual(normalizeShowroomFeatures([' Heated seats ', '', 'Nav']), ['Heated seats', 'Nav'])
  assert.deepEqual(normalizeShowroomFeatures('["Bluetooth","Backup Camera"]'), ['Bluetooth', 'Backup Camera'])
  assert.deepEqual(normalizeShowroomFeatures('Bluetooth, Backup Camera'), ['Bluetooth', 'Backup Camera'])
})
