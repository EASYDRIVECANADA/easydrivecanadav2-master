import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildDealerOwnerRow,
  buildDealershipProfileRow,
  buildDealerVerificationUrl,
  normalizeDealerRegistration,
} from './dealerOnboarding.mjs'

const registration = {
  companyName: 'North York Auto Group',
  contactName: 'Sam Dealer',
  email: 'SAM@Dealer.ca',
  phone: '416-555-0123',
  province: 'ON',
  inventorySize: '42',
  website: 'https://dealer.ca',
}

test('normalizes dealership registration input', () => {
  const normalized = normalizeDealerRegistration(registration)

  assert.equal(normalized.email, 'sam@dealer.ca')
  assert.equal(normalized.companyName, 'North York Auto Group')
  assert.equal(normalized.inventorySize, '42')
})

test('builds a private pending dealership owner row', () => {
  const row = buildDealerOwnerRow(registration, 'dealer-user-123')

  assert.equal(row.user_id, 'dealer-user-123')
  assert.equal(row.email, 'sam@dealer.ca')
  assert.equal(row.first_name, 'Sam')
  assert.equal(row.last_name, 'Dealer')
  assert.equal(row.title, 'Owner')
  assert.equal(row.role, 'private')
  assert.equal(row.status, 'enable')
})

test('builds a dealership profile row from registration', () => {
  const row = buildDealershipProfileRow(registration, 'dealer-user-123')

  assert.equal(row.user_id, 'dealer-user-123')
  assert.equal(row.company_name, 'North York Auto Group')
  assert.equal(row.phone, '416-555-0123')
  assert.equal(row.email, 'sam@dealer.ca')
  assert.equal(row.province, 'ON')
  assert.equal(row.website, 'https://dealer.ca')
  assert.match(row.auto_close_deals_in, /Pending dealer onboarding/)
})

test('routes dealers through verification and back to billing', () => {
  assert.equal(buildDealerVerificationUrl(), '/account/verification?returnUrl=%2Fadmin%2Fbilling')
})
