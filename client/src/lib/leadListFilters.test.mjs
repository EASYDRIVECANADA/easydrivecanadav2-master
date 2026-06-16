import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  defaultLeadFilterForSource,
  matchesLeadListFilter,
} from './leadListFilters.mjs'

const lead = (overrides = {}) => ({
  message: '',
  vehicleInterest: '',
  employmentStatus: null,
  monthlyIncome: null,
  downPayment: null,
  creditScore: null,
  ghlSynced: false,
  ...overrides,
})

test('shows website and Facebook leads in the open leads filter', () => {
  assert.equal(matchesLeadListFilter(lead({ message: 'Source: EasyDrive Canada - Website' }), 'open'), true)
  assert.equal(matchesLeadListFilter(lead({ message: 'Source: Manual Entry - FB Lead Form' }), 'open'), true)
})

test('supports source-specific filters for website and Facebook leads', () => {
  assert.equal(matchesLeadListFilter(lead({ message: 'Source: EasyDrive Canada - Website' }), 'website'), true)
  assert.equal(matchesLeadListFilter(lead({ message: 'Source: Manual Entry - FB Lead Form' }), 'facebook'), true)
  assert.equal(matchesLeadListFilter(lead({ message: 'Source: Manual Entry - FB Lead Form' }), 'finance'), false)
})

test('keeps handled leads out of open source filters', () => {
  const handledWebsiteLead = lead({
    message: 'Source: EasyDrive Canada - Website',
    ghlSynced: true,
  })

  assert.equal(matchesLeadListFilter(handledWebsiteLead, 'open'), false)
  assert.equal(matchesLeadListFilter(handledWebsiteLead, 'website'), false)
  assert.equal(matchesLeadListFilter(handledWebsiteLead, 'synced'), true)
})

test('selects the new lead source filter after manual creation', () => {
  assert.equal(defaultLeadFilterForSource('website'), 'website')
  assert.equal(defaultLeadFilterForSource('facebook'), 'facebook')
  assert.equal(defaultLeadFilterForSource('unknown'), 'open')
})
