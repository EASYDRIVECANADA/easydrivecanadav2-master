import test from 'node:test'
import assert from 'node:assert/strict'

import { buildDealerPriceDisplay, formatCadPrice } from './dealerPriceDisplay.mjs'

test('formatCadPrice formats whole-dollar CAD values', () => {
  assert.equal(formatCadPrice(19871), '$19,871')
  assert.equal(formatCadPrice('20871'), '$20,871')
})

test('buildDealerPriceDisplay labels sale price as Dealer Price', () => {
  assert.deepEqual(buildDealerPriceDisplay({
    price: 19871,
    retailPrice: 20871,
    financePrice: 19871,
  }), {
    dealerPrice: 19871,
    dealerPriceLabel: 'Dealer Price',
    dealerPriceFormatted: '$19,871',
    retailPrice: 20871,
    retailPriceFormatted: '$20,871',
    financePrice: 19871,
    financePriceFormatted: '$19,871',
    hasRetailComparison: true,
    hasFinancePrice: true,
  })
})

test('buildDealerPriceDisplay hides retail comparison when retail is not higher', () => {
  const display = buildDealerPriceDisplay({
    price: 19871,
    retailPrice: 19871,
    financePrice: null,
  })

  assert.equal(display.hasRetailComparison, false)
  assert.equal(display.hasFinancePrice, false)
})
