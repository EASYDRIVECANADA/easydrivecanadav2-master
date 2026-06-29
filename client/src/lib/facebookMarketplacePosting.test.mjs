import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  ASSIST_STATUS_OPTIONS,
  buildFacebookAssistPayload,
  buildFacebookAssistPayloadFromPost,
  buildFacebookAssistLaunchToken,
  buildFacebookMarketplacePayload,
  isValidFacebookListingUrl,
  isValidFacebookAssistStatus,
  mergeFacebookPostRow,
  normalizeFacebookListingUrl,
  normalizeFacebookAssistStatus,
  scoreFacebookMarketplaceReadiness,
  resolveFacebookMarketplaceStatus,
  verifyFacebookAssistLaunchToken,
  vehicleMatchesFacebookSearch,
} from './facebookMarketplacePosting.mjs'

const completeVehicle = {
  id: 'vehicle-1',
  user_id: 'dealer-1',
  year: 2021,
  make: 'Honda',
  model: 'Civic',
  series: 'EX',
  retail_price: 21995,
  price: 22495,
  mileage: 68120,
  city: 'Toronto',
  province: 'ON',
  transmission: 'Automatic',
  fuel_type: 'Gasoline',
  drivetrain: 'FWD',
  exterior_color: 'Blue',
  stock_number: 'A123',
  vin: '2HGFC2F59MH000001',
  ad_description: 'Clean Civic with strong service history.',
  images: ['https://example.com/1.jpg', 'https://example.com/2.jpg'],
  status: 'ACTIVE',
  updated_at: '2026-06-25T10:00:00.000Z',
}

test('buildFacebookMarketplacePayload builds copy-ready listing data from a complete vehicle', () => {
  const payload = buildFacebookMarketplacePayload(completeVehicle, {
    siteUrl: 'https://easydrivecanada.com',
    defaultLocation: 'Mississauga, ON',
  })

  assert.equal(payload.vehicleId, 'vehicle-1')
  assert.equal(payload.userId, 'dealer-1')
  assert.equal(payload.title, '2021 Honda Civic EX')
  assert.equal(payload.price, 21995)
  assert.equal(payload.mileage, 68120)
  assert.equal(payload.location, 'Toronto, ON')
  assert.deepEqual(payload.images, ['https://example.com/1.jpg', 'https://example.com/2.jpg'])
  assert.equal(payload.publicUrl, 'https://easydrivecanada.com/inventory/vehicle-1')
  assert.equal(payload.year, '2021')
  assert.equal(payload.make, 'Honda')
  assert.equal(payload.model, 'Civic')
  assert.equal(payload.exteriorColor, 'Blue')
  assert.equal(payload.transmission, 'Automatic')
  assert.equal(payload.fuelType, 'Gasoline')
  assert.match(payload.description, /Clean Civic with strong service history/)
  assert.match(payload.description, /Stock: A123/)
  assert.match(payload.description, /VIN: 2HGFC2F59MH000001/)
  assert.match(payload.description, /Schedule a test drive/)
})

test('buildFacebookMarketplacePayload falls back across common vehicle field variants', () => {
  const payload = buildFacebookMarketplacePayload({
    id: 'vehicle-2',
    year: '2018',
    make: 'Toyota',
    model: 'RAV4',
    trim: 'LE',
    finance_price: '17500',
    odometer: '91000',
    image_urls: '["https://example.com/rav4.jpg"]',
    description: 'AWD SUV.',
  }, {
    siteUrl: 'https://edc.test/',
    defaultLocation: 'Ottawa, ON',
  })

  assert.equal(payload.title, '2018 Toyota RAV4 LE')
  assert.equal(payload.price, 17500)
  assert.equal(payload.mileage, 91000)
  assert.equal(payload.location, 'Ottawa, ON')
  assert.deepEqual(payload.images, ['https://example.com/rav4.jpg'])
  assert.equal(payload.publicUrl, 'https://edc.test/inventory/vehicle-2')
})

test('buildFacebookMarketplacePayload normalizes object-like vehicle option values', () => {
  const payload = buildFacebookMarketplacePayload({
    id: 'vehicle-objects',
    year: 2009,
    make: 'BMW',
    model: 'Z4',
    exterior_color: { label: 'Black Sapphire Metallic' },
    fuel_type: { value: 'Gasoline' },
    drivetrain: { name: 'RWD' },
  })

  assert.equal(payload.exteriorColor, 'Black Sapphire Metallic')
  assert.equal(payload.fuelType, 'Gasoline')
  assert.match(payload.description, /Exterior: Black Sapphire Metallic/)
  assert.doesNotMatch(payload.description, /\[object Object\]/)
})

test('scoreFacebookMarketplaceReadiness reports required missing fields', () => {
  const payload = buildFacebookMarketplacePayload({ id: 'vehicle-3', make: 'Ford' })
  const readiness = scoreFacebookMarketplaceReadiness(payload)

  assert.equal(readiness.status, 'needs_info')
  assert.deepEqual(readiness.missing.sort(), ['images', 'location', 'mileage', 'price', 'title'].sort())
  assert.equal(readiness.ready, false)
})

test('resolveFacebookMarketplaceStatus promotes posted sold vehicles to sold_remove', () => {
  assert.equal(
    resolveFacebookMarketplaceStatus({
      vehicle: { status: 'SOLD' },
      post: { status: 'posted', facebook_listing_url: 'https://facebook.com/marketplace/item/1' },
      readiness: { ready: true },
    }),
    'sold_remove'
  )

  assert.equal(
    resolveFacebookMarketplaceStatus({
      vehicle: { status: 'ACTIVE' },
      post: null,
      readiness: { ready: true },
    }),
    'ready'
  )
})

test('mergeFacebookPostRow preserves staff overrides over generated payload', () => {
  const payload = buildFacebookMarketplacePayload(completeVehicle)
  const merged = mergeFacebookPostRow(payload, {
    status: 'posted',
    posting_title: 'Custom Marketplace title',
    posting_description: 'Custom staff description',
    posting_price: 20995,
    posting_location: 'Brampton, ON',
    facebook_listing_url: 'https://facebook.com/marketplace/item/posted',
    notes: 'Posted by Sam.',
  })

  assert.equal(merged.title, 'Custom Marketplace title')
  assert.equal(merged.description, 'Custom staff description')
  assert.equal(merged.price, 20995)
  assert.equal(merged.location, 'Brampton, ON')
  assert.equal(merged.status, 'posted')
  assert.equal(merged.facebookListingUrl, 'https://facebook.com/marketplace/item/posted')
  assert.equal(merged.notes, 'Posted by Sam.')
})

test('mergeFacebookPostRow exposes assist lifecycle fields', () => {
  const payload = buildFacebookMarketplacePayload(completeVehicle)
  const merged = mergeFacebookPostRow(payload, {
    assist_status: 'needs_review',
    assist_started_at: '2026-06-26T10:00:00.000Z',
    assist_completed_at: '2026-06-26T10:02:00.000Z',
    assist_error: 'Facebook changed a field label.',
  })

  assert.equal(merged.assistStatus, 'needs_review')
  assert.equal(merged.assistStartedAt, '2026-06-26T10:00:00.000Z')
  assert.equal(merged.assistCompletedAt, '2026-06-26T10:02:00.000Z')
  assert.equal(merged.assistError, 'Facebook changed a field label.')
})

test('vehicleMatchesFacebookSearch searches title, VIN, stock, and status text', () => {
  const row = mergeFacebookPostRow(buildFacebookMarketplacePayload(completeVehicle), { status: 'ready' })

  assert.equal(vehicleMatchesFacebookSearch(row, 'civic'), true)
  assert.equal(vehicleMatchesFacebookSearch(row, '2HGFC2F59'), true)
  assert.equal(vehicleMatchesFacebookSearch(row, 'A123'), true)
  assert.equal(vehicleMatchesFacebookSearch(row, 'ready'), true)
  assert.equal(vehicleMatchesFacebookSearch(row, 'camry'), false)
})

test('facebook assist statuses are explicit and normalized', () => {
  assert.deepEqual(ASSIST_STATUS_OPTIONS.map((item) => item.value), ['not_started', 'started', 'needs_review', 'failed', 'cancelled'])
  assert.equal(isValidFacebookAssistStatus('started'), true)
  assert.equal(isValidFacebookAssistStatus('Needs Review'), true)
  assert.equal(isValidFacebookAssistStatus('posted'), false)
  assert.equal(normalizeFacebookAssistStatus('Needs Review'), 'needs_review')
})

test('buildFacebookAssistPayload creates runner-safe payload from merged row', () => {
  const row = mergeFacebookPostRow(buildFacebookMarketplacePayload(completeVehicle, {
    siteUrl: 'https://easydrivecanada.com',
    defaultLocation: 'Mississauga, ON',
  }), {
    id: 'post-1',
    posting_title: 'Custom Civic title',
    posting_description: 'Custom Civic description for Facebook Marketplace.',
    posting_price: 21500,
    posting_location: 'Ottawa, ON',
  })

  const payload = buildFacebookAssistPayload(row)
  assert.equal(payload.postId, 'post-1')
  assert.equal(payload.vehicleId, completeVehicle.id)
  assert.equal(payload.title, 'Custom Civic title')
  assert.equal(payload.year, '2021')
  assert.equal(payload.make, 'Honda')
  assert.equal(payload.model, 'Civic')
  assert.equal(payload.price, 21500)
  assert.equal(payload.location, 'Ottawa, ON')
  assert.equal(payload.vin, completeVehicle.vin)
  assert.equal(payload.stockNumber, completeVehicle.stock_number)
  assert.equal(payload.exteriorColor, 'Blue')
  assert.equal(payload.transmission, 'Automatic')
  assert.equal(payload.fuelType, 'Gasoline')
  assert.equal(Array.isArray(payload.images), true)
  assert.equal(payload.images.length > 0, true)
  assert.equal(payload.finalSubmitRequired, true)
})

test('buildFacebookAssistPayloadFromPost falls back to fresh vehicle price and description when saved row is empty', () => {
  const freshPayload = buildFacebookMarketplacePayload(completeVehicle, {
    siteUrl: 'https://easydrivecanada.com',
    defaultLocation: 'Mississauga, ON',
  })

  const payload = buildFacebookAssistPayloadFromPost({
    post: {
      id: 'post-1',
      posting_title: '',
      posting_description: '',
      posting_price: 0,
      posting_location: '',
    },
    rawPayload: {
      price: 0,
      description: '',
    },
    freshVehiclePayload: freshPayload,
  })

  assert.equal(payload.postId, 'post-1')
  assert.equal(payload.title, freshPayload.title)
  assert.equal(payload.description, freshPayload.description)
  assert.equal(payload.price, freshPayload.price)
  assert.equal(payload.location, freshPayload.location)
})

test('facebook assist launch tokens expire and verify without secrets in the runner', () => {
  const token = buildFacebookAssistLaunchToken({
    postId: 'post-1',
    baseUrl: 'https://easydrivecanada.com',
    issuedAt: '2026-06-26T00:00:00.000Z',
    ttlSeconds: 60,
    secret: 'test-secret',
  })

  assert.equal(token.postId, 'post-1')
  assert.equal(token.baseUrl, 'https://easydrivecanada.com')
  assert.equal(typeof token.signature, 'string')
  assert.equal(verifyFacebookAssistLaunchToken(token, '2026-06-26T00:00:30.000Z', 'test-secret').valid, true)
  assert.equal(verifyFacebookAssistLaunchToken(token, '2026-06-26T00:00:30.000Z', 'wrong-secret').reason, 'bad_signature')
  assert.equal(verifyFacebookAssistLaunchToken(token, '2026-06-26T00:02:00.000Z', 'test-secret').valid, false)
})

test('buildFacebookAssistPayload never treats assist completion as posted', () => {
  const payload = buildFacebookAssistPayload({
    postId: 'post-2',
    vehicleId: 'vehicle-2',
    title: '2019 Toyota Corolla',
    description: 'Clean sedan ready for Facebook Marketplace.',
    price: 16995,
    mileage: 89000,
    location: 'Mississauga, ON',
  })

  assert.equal(payload.finalSubmitRequired, true)
  assert.equal(Object.prototype.hasOwnProperty.call(payload, 'status'), false)
  assert.equal(Object.prototype.hasOwnProperty.call(payload, 'postedAt'), false)
})

test('facebook listing URL normalization only accepts Marketplace item URLs', () => {
  assert.equal(
    normalizeFacebookListingUrl(' facebook.com/marketplace/item/12345/?ref=search '),
    'https://www.facebook.com/marketplace/item/12345/?ref=search'
  )
  assert.equal(isValidFacebookListingUrl('https://www.facebook.com/marketplace/item/12345/'), true)
  assert.equal(isValidFacebookListingUrl('https://m.facebook.com/marketplace/item/12345/'), true)
  assert.equal(isValidFacebookListingUrl('https://example.com/marketplace/item/12345/'), false)
  assert.equal(isValidFacebookListingUrl('https://www.facebook.com/profile.php?id=12345'), false)
})
