import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  appendLeadTranscriptNote,
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
