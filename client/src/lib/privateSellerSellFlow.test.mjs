import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildPrivateSellerOwnerRow,
  buildPrivateSellerVehicleRow,
  buildVerificationUrl,
  hasActivePrivateSellerListing,
} from './privateSellerSellFlow.mjs'

const inquiry = {
  name: 'Jane Smith',
  email: 'Jane@Example.com',
  phone: '416-555-0199',
  vin: '1HGCM82633A004352',
  askingPrice: '12500',
}

test('builds a private owner row from a sell inquiry', () => {
  const row = buildPrivateSellerOwnerRow(inquiry, 'owner-123')

  assert.equal(row.email, 'jane@example.com')
  assert.equal(row.first_name, 'Jane')
  assert.equal(row.last_name, 'Smith')
  assert.equal(row.title, 'Owner')
  assert.equal(row.role, 'private')
  assert.equal(row.status, 'enable')
  assert.equal(row.user_id, 'owner-123')
})

test('builds a draft private seller vehicle row', () => {
  const row = buildPrivateSellerVehicleRow(inquiry, 'owner-123', 'vehicle-123', '2026-05-27T00:00:00.000Z')

  assert.equal(row.user_id, 'owner-123')
  assert.equal(row.vehicleId, 'vehicle-123')
  assert.equal(row.vin, '1HGCM82633A004352')
  assert.equal(row.price, 12500)
  assert.equal(row.status, 'DRAFT')
  assert.equal(row.inventory_type, 'PRIVATE')
  assert.equal(row.categories, 'Private Seller')
})

test('active private listing check ignores closed vehicles', () => {
  assert.equal(hasActivePrivateSellerListing([{ status: 'Sold' }, { status: 'Closed' }]), false)
  assert.equal(hasActivePrivateSellerListing([{ status: 'DRAFT' }]), true)
  assert.equal(hasActivePrivateSellerListing([{ status: null }]), true)
})

test('builds verification url with vehicle return path', () => {
  const url = buildVerificationUrl('vehicle-123')

  assert.equal(url, '/account/verification?returnUrl=%2Fadmin%2Finventory%2Fvehicle-123')
})
