import test from 'node:test'
import assert from 'node:assert/strict'

import { mapPublicInventoryVehicle } from './publicInventoryVehicle.mjs'

test('mapPublicInventoryVehicle preserves marketplace image URLs and dealer bucket', () => {
  const vehicle = mapPublicInventoryVehicle({
    id: 'vehicle-1',
    stock_number: 'A123',
    make: 'Ford',
    model: 'F-150',
    year: 2018,
    price: 16871,
    retail_price: 17871,
    finance_price: 16871,
    images: ['https://drivetownottawa.com/image.jpg'],
    categories: 'dealer_select',
    inventory_type: 'DEALER_SELECT',
    status: 'In Stock',
    created_at: '2026-06-05T00:00:00.000Z',
  })

  assert.deepEqual(vehicle.images, ['https://drivetownottawa.com/image.jpg'])
  assert.equal(vehicle.listingBucket, 'dealer')
  assert.equal(vehicle.categories, 'dealer_select')
  assert.equal(vehicle.inventoryType, 'DEALER_SELECT')
  assert.equal(vehicle.retailPrice, 17871)
  assert.equal(vehicle.financePrice, 16871)
  assert.equal(vehicle.createdAt, '2026-06-05T00:00:00.000Z')
})

test('mapPublicInventoryVehicle normalizes Premier inventory type without categories', () => {
  const vehicle = mapPublicInventoryVehicle({
    id: 'vehicle-2',
    make: 'Tesla',
    model: 'Model 3',
    year: 2022,
    price: 32871,
    inventory_type: 'PREMIERE',
    status: 'In Stock',
  })

  assert.equal(vehicle.listingBucket, 'premier')
})
