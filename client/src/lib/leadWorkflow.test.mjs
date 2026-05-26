import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  appendLeadTranscriptNote,
  appendLeadUpdateTranscriptNote,
  parseLeadTranscriptEntries,
  shouldOpenLeadDetailsFromRowClick,
  LEAD_MANAGER_STATUSES,
  normalizeLeadManagerStatus,
} from './leadWorkflow.mjs'

test('exposes the requested lead workflow statuses in order', () => {
  assert.deepEqual(LEAD_MANAGER_STATUSES, [
    'New Credit App',
    'No Contact',
    'Need More Information',
    'In Talks',
    'App Submitted',
    'Not Qualified',
    'Conditional Approval',
    'Booked',
  ])
})

test('normalizes old manager status values to the new workflow labels', () => {
  assert.equal(normalizeLeadManagerStatus('AWAITING'), 'Need More Information')
  assert.equal(normalizeLeadManagerStatus('PENDING'), 'In Talks')
  assert.equal(normalizeLeadManagerStatus('PENDING (BHPH)'), 'App Submitted')
  assert.equal(normalizeLeadManagerStatus('DECLINED'), 'Not Qualified')
  assert.equal(normalizeLeadManagerStatus('BOOKED'), 'Booked')
})

test('appends timestamped notes without replacing existing transcript history', () => {
  assert.equal(
    appendLeadTranscriptNote('[May 26, 2026, 7:59 AM] Called customer.', 'Asked for pay stubs.', 'May 26, 2026, 8:00 AM'),
    '[May 26, 2026, 7:59 AM] Called customer.\n\n[May 26, 2026, 8:00 AM] Asked for pay stubs.'
  )
})

test('does not append an empty note', () => {
  assert.equal(appendLeadTranscriptNote('Existing note', '   ', 'May 26, 2026, 8:00 AM'), 'Existing note')
})

test('appends a status update audit note', () => {
  assert.equal(
    appendLeadUpdateTranscriptNote(
      'Existing note',
      { field: 'Status', from: 'In Talks', to: 'App Submitted' },
      'May 26, 2026, 8:15 AM'
    ),
    'Existing note\n\n[May 26, 2026, 8:15 AM] Status updated: In Talks -> App Submitted'
  )
})

test('appends the editor to status update audit notes when available', () => {
  assert.equal(
    appendLeadUpdateTranscriptNote(
      '',
      { field: 'Status', from: 'In Talks', to: 'App Submitted', actor: 'manager@easydrivecanada.com' },
      'May 26, 2026, 8:15 AM'
    ),
    '[May 26, 2026, 8:15 AM] Status updated by manager@easydrivecanada.com: In Talks -> App Submitted'
  )
})

test('labels cleared status updates clearly', () => {
  assert.equal(
    appendLeadUpdateTranscriptNote('', { field: 'Status', from: 'Booked', to: null }, 'May 26, 2026, 8:16 AM'),
    '[May 26, 2026, 8:16 AM] Status updated: Booked -> cleared'
  )
})

test('parses transcript entries into timestamp and body rows', () => {
  assert.deepEqual(
    parseLeadTranscriptEntries('[May 26, 2026, 7:59 AM] Called customer.\n\nLegacy imported note'),
    [
      { timestamp: 'May 26, 2026, 7:59 AM', body: 'Called customer.', isLegacy: false },
      { timestamp: 'Legacy note', body: 'Legacy imported note', isLegacy: true },
    ]
  )
})

test('opens lead details from row clicks except nested lead actions', () => {
  assert.equal(shouldOpenLeadDetailsFromRowClick({ closest: () => null }), true)
  assert.equal(shouldOpenLeadDetailsFromRowClick({ closest: () => ({ tagName: 'BUTTON' }) }), false)
})
