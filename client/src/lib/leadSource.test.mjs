import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  leadCustomSourceFieldState,
  leadCustomSourceFromMessage,
  leadSourceFromMessage,
  leadSourceLabel,
  leadSourceMessageValue,
  normalizeLeadSourceInput,
} from './leadSource.mjs'

test('labels EasyDrive Canada website leads from contact form source lines', () => {
  const source = leadSourceFromMessage({
    message: 'Source: EasyDrive Contact\nMessage: I want to book a test drive',
  })

  assert.equal(source, 'website')
  assert.equal(leadSourceLabel(source), 'EASYDRIVE CANADA - WEBSITE')
})

test('labels EasyDrive Finance landing page leads from landing page source lines', () => {
  const source = leadSourceFromMessage({
    message: 'Source: easydrivefinance.ca\nReferrer: Facebook Ads',
  })

  assert.equal(source, 'finance')
  assert.equal(leadSourceLabel(source), 'EASYDRIVE FINANCE - LANDING PAGE')
})

test('treats manual Facebook lead form entries as other source text', () => {
  const source = leadSourceFromMessage({
    message: 'Source: Manual Entry - FB Lead Form',
  })

  assert.equal(source, 'unknown')
  assert.equal(leadCustomSourceFromMessage({ message: 'Source: Manual Entry - FB Lead Form' }), 'Manual Entry - FB Lead Form')
  assert.equal(leadSourceLabel(source), 'Other')
})

test('keeps common Facebook source values under other', () => {
  assert.equal(normalizeLeadSourceInput('FB Lead Form'), 'unknown')
  assert.equal(normalizeLeadSourceInput('Facebook ad campaign'), 'unknown')
  assert.equal(leadSourceMessageValue('unknown', 'FB Lead Form'), 'FB Lead Form')
})

test('keeps custom other source text available for lead editing', () => {
  const lead = {
    message: 'Source: Referral partner\nMessage: Called the dealership',
  }

  assert.equal(leadSourceFromMessage(lead), 'unknown')
  assert.equal(leadCustomSourceFromMessage(lead), 'Referral partner')
  assert.equal(leadSourceMessageValue('unknown', 'Referral partner'), 'Referral partner')
})

test('keeps the detail other source input visible but locked until Other is selected', () => {
  assert.deepEqual(leadCustomSourceFieldState('finance'), {
    disabled: true,
    placeholder: 'Select Other to type a source',
  })

  assert.deepEqual(leadCustomSourceFieldState('unknown'), {
    disabled: false,
    placeholder: 'Referral, walk-in, phone up...',
  })
})
