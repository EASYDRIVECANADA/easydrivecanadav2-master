import test from 'node:test'
import assert from 'node:assert/strict'

import { getListingTypeMeta } from './listingType.mjs'

test('uses categories before inventory type when classifying listing type', () => {
  const meta = getListingTypeMeta({ categories: 'Private Seller', inventory_type: 'Premier' })

  assert.equal(meta.bucket, 'private')
  assert.equal(meta.label, 'Private Seller')
})

test('classifies known admin listing selections', () => {
  assert.equal(getListingTypeMeta({ categories: 'Dealer Select' }).bucket, 'dealer')
  assert.equal(getListingTypeMeta({ categories: 'Fleet Select' }).bucket, 'fleet')
  assert.equal(getListingTypeMeta({ categories: 'EDC Premier' }).bucket, 'premier')
})

test('falls back to uncategorized when no listing selection exists', () => {
  const meta = getListingTypeMeta({})

  assert.equal(meta.bucket, 'unknown')
  assert.equal(meta.label, 'Uncategorized')
})
