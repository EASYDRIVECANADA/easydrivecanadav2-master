import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  buildBookingLink,
  buildBookingMessage,
} from './bookingShare.mjs'

test('buildBookingLink creates a public Messenger booking URL for a vehicle', () => {
  assert.equal(
    buildBookingLink({
      baseUrl: 'https://easydrivecanada.com/',
      vehicleId: ' vehicle-1 ',
      source: 'messenger',
    }),
    'https://easydrivecanada.com/book/test-drive?vehicleId=vehicle-1&source=messenger'
  )
})

test('buildBookingLink supports a general booking URL without a vehicle id', () => {
  assert.equal(
    buildBookingLink({
      baseUrl: 'https://easydrivecanada.com',
      source: 'facebook_marketplace',
    }),
    'https://easydrivecanada.com/book/test-drive?source=facebook_marketplace'
  )
})

test('buildBookingMessage creates paste-ready Marketplace chat copy', () => {
  assert.equal(
    buildBookingMessage({
      baseUrl: 'https://easydrivecanada.com',
      vehicleId: 'vehicle-1',
      vehicleTitle: '2020 Honda Civic',
    }),
    'Thanks for your interest in the 2020 Honda Civic. You can book a test drive here:\nhttps://easydrivecanada.com/book/test-drive?vehicleId=vehicle-1&source=messenger'
  )
})
