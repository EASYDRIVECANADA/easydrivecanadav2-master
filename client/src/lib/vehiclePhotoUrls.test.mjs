import assert from 'node:assert/strict'
import { test } from 'node:test'

import { buildVehiclePhotoUrls, normalizeVehicleImageList } from './vehiclePhotoUrls.mjs'

test('builds public vehicle photo urls from storage rows', () => {
  assert.deepEqual(
    buildVehiclePhotoUrls('vehicle-1', [
      { name: 'front.jpg' },
      { name: 'folder/' },
      { name: '' },
      { name: 'rear.png' },
    ], (path) => `https://cdn.test/${path}`),
    ['https://cdn.test/vehicle-1/front.jpg', 'https://cdn.test/vehicle-1/rear.png']
  )
})

test('normalizes image arrays, json strings, and comma separated strings', () => {
  assert.deepEqual(normalizeVehicleImageList([' a ', '', 'b']), ['a', 'b'])
  assert.deepEqual(normalizeVehicleImageList('["a","b"]'), ['a', 'b'])
  assert.deepEqual(normalizeVehicleImageList('a, b'), ['a', 'b'])
})
