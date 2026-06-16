import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
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

test('labels manual Facebook lead form entries distinctly', () => {
  const source = leadSourceFromMessage({
    message: 'Source: Manual Entry - FB Lead Form',
  })

  assert.equal(source, 'facebook')
  assert.equal(leadSourceLabel(source), 'MANUAL ENTRY - FB LEAD FORM')
})

test('normalizes common import source values to the Facebook lead form source', () => {
  assert.equal(normalizeLeadSourceInput('FB Lead Form'), 'facebook')
  assert.equal(normalizeLeadSourceInput('Facebook ad campaign'), 'facebook')
  assert.equal(leadSourceMessageValue('facebook'), 'Manual Entry - FB Lead Form')
})
