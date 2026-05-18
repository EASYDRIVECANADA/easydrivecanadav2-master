import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  buildAdminOpsTasks,
  buildVehicleJsonLd,
  buildVehicleSearchText,
  scoreDealReadiness,
  scoreInventoryReadiness,
  vehicleMatchesSearch,
} from './dealerOpsReadiness.mjs'

test('scores inventory readiness for all listing account types', () => {
  for (const category of ['private', 'dealership', 'premier', 'fleet']) {
    const readiness = scoreInventoryReadiness({
      id: `${category}-1`,
      categories: category,
      status: 'In Stock',
      price: 28000,
      vin: '2HGFC2F59LH000001',
      odometer: 42000,
      make: 'Honda',
      model: 'Civic',
      year: 2020,
      description: 'Clean sedan',
      photo_count: 4,
      carfax_count: 1,
      disclosure_count: 1,
    })

    assert.equal(readiness.category, category)
    assert.equal(readiness.score, 100)
    assert.equal(readiness.missing.length, 0)
  }
})

test('surfaces missing publish requirements for inventory', () => {
  const readiness = scoreInventoryReadiness({
    id: 'vehicle-1',
    categories: 'dealership',
    status: 'In Stock',
    make: 'Toyota',
    model: 'RAV4',
    year: 2021,
  })

  assert.equal(readiness.score, 40)
  assert.deepEqual(readiness.missing, ['photos', 'price', 'vin', 'mileage', 'carfax', 'disclosures'])
})

test('scores approved checkout deal readiness including signature and document package', () => {
  const readiness = scoreDealReadiness({
    id: 'sub-1',
    status: 'approved',
    customer_first_name: 'Jane',
    customer_last_name: 'Buyer',
    customer_email: 'jane@example.com',
    vehicle_id: 'vehicle-1',
    vehicle_make: 'Toyota',
    vehicle_model: 'RAV4',
    vehicle_year: 2021,
    total_price: 32000,
    order_data: {
      signatures: {
        billOfSaleCustomer: { typedName: 'Jane Buyer' },
      },
    },
    document_package_status: 'ready',
    bos_pdf_url: 'purchase-documents/sub-1/BOS.pdf',
    carfax_files: [{ name: 'carfax.pdf', path: 'vehicle-1/carfax.pdf' }],
  })

  assert.equal(readiness.score, 100)
  assert.equal(readiness.status, 'ready')
  assert.deepEqual(readiness.missing, [])
})

test('generates actionable admin tasks from real platform states', () => {
  const tasks = buildAdminOpsTasks({
    nowIso: '2026-05-18T12:00:00.000Z',
    submissions: [
      {
        id: 'sub-1',
        status: 'submitted',
        submitted_at: '2026-05-18T10:00:00.000Z',
        customer_first_name: 'Pat',
        customer_last_name: 'Customer',
        vehicle_make: 'Honda',
        vehicle_model: 'Civic',
      },
      {
        id: 'sub-2',
        status: 'approved',
        submitted_at: '2026-05-18T09:00:00.000Z',
        customer_email: 'approved@example.com',
        vehicle_make: 'Ford',
        vehicle_model: 'Escape',
        document_package_status: 'failed',
      },
    ],
    vehicles: [
      {
        id: 'vehicle-1',
        status: 'In Stock',
        make: 'Toyota',
        model: 'RAV4',
        year: 2021,
        price: 25000,
        vin: '2T3A1RFV1MW000001',
        odometer: 35000,
        categories: 'private',
        photo_count: 0,
        carfax_count: 0,
        disclosure_count: 0,
      },
    ],
    leads: [
      {
        id: 'lead-1',
        first_name: 'Alex',
        last_name: 'Lead',
        created_at: '2026-05-16T08:00:00.000Z',
        manager_status: 'New',
      },
    ],
  })

  assert.deepEqual(
    tasks.map((task) => task.type),
    ['purchase_submitted', 'document_package_failed', 'vehicle_missing_carfax', 'vehicle_missing_photos', 'stale_lead']
  )
  assert.equal(tasks[0].href, '/admin/sales/deals')
  assert.equal(tasks[2].href, '/admin/inventory/vehicle-1')
})

test('normalizes inventory text and handles natural search constraints', () => {
  const vehicle = {
    year: 2021,
    make: 'Subaru',
    model: 'Outback',
    trim: 'Limited',
    price: 28500,
    body_style: 'SUV',
    drivetrain: 'AWD',
    features: ['Heated seats', 'Backup camera'],
    categories: 'dealership',
    carfax_count: 1,
  }

  assert.match(buildVehicleSearchText(vehicle), /subaru outback limited/i)
  assert.equal(vehicleMatchesSearch(vehicle, 'AWD SUV under 30k with clean CARFAX'), true)
  assert.equal(vehicleMatchesSearch(vehicle, 'AWD SUV under 20k'), false)
})

test('builds vehicle JSON-LD with pricing, mileage, VIN, and history link', () => {
  const jsonLd = buildVehicleJsonLd({
    id: 'vehicle-1',
    year: 2021,
    make: 'Subaru',
    model: 'Outback',
    trim: 'Limited',
    vin: '4S4BTANCXM3000001',
    price: 28500,
    odometer: 42000,
    exterior_color: 'White',
    body_style: 'SUV',
    carfax_files: [{ path: 'vehicle-1/carfax.pdf' }],
  }, {
    siteUrl: 'https://easydrivecanada.com',
    imageUrl: 'https://example.com/outback.jpg',
  })

  assert.equal(jsonLd['@type'], 'Vehicle')
  assert.equal(jsonLd.vehicleIdentificationNumber, '4S4BTANCXM3000001')
  assert.equal(jsonLd.offers.price, 28500)
  assert.equal(jsonLd.mileageFromOdometer.value, 42000)
  assert.equal(jsonLd.vehicleHistoryReport, 'https://easydrivecanada.com/inventory/vehicle-1#carfax')
})
