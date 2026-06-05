import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

import {
  cleanNumber,
  discoverDriveTownDetailUrls,
  parseDriveTownDetail,
  parseDriveTownListing,
} from './drivetownScraper.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const fixture = (name) => readFile(path.join(__dirname, 'fixtures', name), 'utf8')

test('cleanNumber extracts dollars and kilometers', () => {
  assert.equal(cleanNumber('$32,995'), 32995)
  assert.equal(cleanNumber('91,200 km'), 91200)
  assert.equal(cleanNumber('Call for price'), null)
})

test('parseDriveTownListing returns absolute detail URLs and source total', async () => {
  const html = await fixture('drivetown-listing.html')
  const result = parseDriveTownListing(html, 'https://drivetownottawa.com/vehicles/')

  assert.equal(result.totalCount, 148)
  assert.deepEqual(result.detailUrls, [
    'https://drivetownottawa.com/vehicles/2019-ford-f-150-xlt-a1234/',
    'https://drivetownottawa.com/vehicles/2021-honda-civic-ex-b5678/',
  ])
})

test('discoverDriveTownDetailUrls follows inventory pages until source total is reached', async () => {
  const page1 = await fixture('drivetown-listing.html')
  const page2 = await fixture('drivetown-listing-page-2.html')
  const calls = []
  const fetchImpl = async (url) => {
    calls.push(url)
    return {
      ok: true,
      text: async () => calls.length === 1 ? page1.replace('148 vehicles', '3 vehicles') : page2,
    }
  }

  const result = await discoverDriveTownDetailUrls({ fetchImpl })

  assert.equal(result.completeListing, true)
  assert.equal(result.totalCount, 3)
  assert.equal(result.detailUrls.length, 3)
  assert.deepEqual(calls, [
    'https://drivetownottawa.com/vehicles/',
    'https://drivetownottawa.com/vehicles/page/2/',
  ])
})

test('parseDriveTownDetail normalizes vehicle detail fields', async () => {
  const html = await fixture('drivetown-detail.html')
  const vehicle = parseDriveTownDetail(html, 'https://drivetownottawa.com/vehicles/2019-ford-f-150-xlt-a1234/')

  assert.equal(vehicle.sourceUrl, 'https://drivetownottawa.com/vehicles/2019-ford-f-150-xlt-a1234/')
  assert.equal(vehicle.year, 2019)
  assert.equal(vehicle.make, 'Ford')
  assert.equal(vehicle.model, 'F-150')
  assert.equal(vehicle.trim, 'XLT 4WD')
  assert.equal(vehicle.vin, '1FTEW1E50KFA12345')
  assert.equal(vehicle.stockNumber, 'A1234')
  assert.equal(vehicle.price, 32995)
  assert.equal(vehicle.mileage, 91200)
  assert.equal(vehicle.transmission, 'Automatic')
  assert.equal(vehicle.drivetrain, '4WD')
  assert.equal(vehicle.fuelType, 'Gasoline')
  assert.equal(vehicle.bodyStyle, 'Truck')
  assert.equal(vehicle.exteriorColor, 'Black')
  assert.equal(vehicle.interiorColor, 'Grey')
  assert.match(vehicle.description, /Clean local truck/)
  assert.deepEqual(vehicle.features, ['Heated Seats', 'Backup Camera'])
  assert.deepEqual(vehicle.imageUrls, [
    'https://images.example.com/f150-main.jpg',
    'https://drivetownottawa.com/wp-content/uploads/f150-side.jpg',
  ])
})
