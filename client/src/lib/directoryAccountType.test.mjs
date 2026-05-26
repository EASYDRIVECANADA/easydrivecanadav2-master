import test from 'node:test'
import assert from 'node:assert/strict'

import { getDirectoryAccountType } from './directoryAccountType.mjs'

test('classifies private sellers from empty and private roles', () => {
  assert.equal(getDirectoryAccountType({ role: '' }).bucket, 'private')
  assert.equal(getDirectoryAccountType({ role: 'private seller' }).label, 'Private Seller')
})

test('classifies dealership plans', () => {
  assert.equal(getDirectoryAccountType({ role: 'small dealership' }).bucket, 'dealership')
  assert.equal(getDirectoryAccountType({ role: 'medium dealership' }).label, 'Medium Dealership')
  assert.equal(getDirectoryAccountType({ role: 'large dealership' }).label, 'Large Dealership')
})

test('classifies staff, admin, and premier accounts', () => {
  assert.equal(getDirectoryAccountType({ role: 'staff' }).bucket, 'staff')
  assert.equal(getDirectoryAccountType({ role: 'admin' }).bucket, 'staff')
  assert.equal(getDirectoryAccountType({ role: 'premier' }).bucket, 'premier')
})
