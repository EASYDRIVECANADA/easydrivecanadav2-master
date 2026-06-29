import test from 'node:test'
import assert from 'node:assert/strict'

import {
  calculateFleetFinanceDetails,
  calculateMonthlyPayment,
  calculateProtectionBiweeklyUpcharge,
  buildFleetQuoteVehicle,
} from './fleetFinanceQuotes.mjs'

test('calculateMonthlyPayment amortizes principal over the requested term', () => {
  const payment = calculateMonthlyPayment(30000, 0.0799, 96)

  assert.equal(payment.toFixed(2), '423.95')
})

test('calculateFleetFinanceDetails uses true biweekly payments instead of monthly divided by two', () => {
  const details = calculateFleetFinanceDetails({
    sellingPrice: 30000,
    apr: 0.0799,
    termMonths: 96,
    province: 'ON',
    warrantyTier: '3yr',
  })

  assert.equal(details.monthlyNoProtection.toFixed(2), '493.18')
  assert.equal(details.biweeklyNoProtection.toFixed(2), '227.62')
  assert.notEqual(details.biweeklyNoProtection.toFixed(2), (details.monthlyNoProtection / 2).toFixed(2))
})

test('calculateFleetFinanceDetails adds warranty, GAP, and their taxes for protection pricing', () => {
  const details = calculateFleetFinanceDetails({
    sellingPrice: 30000,
    apr: 0.0799,
    termMonths: 96,
    province: 'ON',
    warrantyTier: '3yr',
  })

  assert.equal(details.financedNoProtection, 34899)
  assert.equal(details.financedWithProtection, 41215)
  assert.equal(details.warrantyPrice, 3200)
  assert.equal(details.gapPriceWithTax, 2700)
  assert.equal(calculateProtectionBiweeklyUpcharge(details).toFixed(2), '41.19')
})

test('buildFleetQuoteVehicle treats imported EasyDrive fleet price as the public selling price', () => {
  const quoteVehicle = buildFleetQuoteVehicle({
    id: 'vehicle-1',
    year: 2024,
    make: 'Mercedes-Benz',
    model: 'Sprinter',
    series: '2500 High Roof',
    price: 40500,
    finance_price: null,
    stock_number: '8FPXND',
    vin: 'W1Y4KCHY3RP691867',
    mileage: 124225,
    categories: 'fleet',
  }, {
    apr: 0.0799,
    termMonths: 96,
    province: 'ON',
    warrantyTier: '3yr',
  })

  assert.equal(quoteVehicle.sellingPrice, 40500)
  assert.equal(quoteVehicle.financedNoProtection, 46764)
  assert.equal(quoteVehicle.vehicle.stockNumber, '8FPXND')
  assert.equal(Object.hasOwn(quoteVehicle.vehicle, 'partner_price'), false)
})
