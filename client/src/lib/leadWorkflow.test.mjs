import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  appendLeadTranscriptNote,
  appendLeadUpdateTranscriptNote,
  displayLeadTranscriptAuthor,
  parseLeadTranscriptEntries,
  resolveLeadFinanceManager,
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

test('appends the note author when available', () => {
  assert.equal(
    appendLeadTranscriptNote('', 'Customer wants a call back.', 'May 26, 2026, 8:00 AM', 'agent@easydrivecanada.com'),
    '[May 26, 2026, 8:00 AM] Note by agent@easydrivecanada.com: Customer wants a call back.'
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
      { timestamp: 'May 26, 2026, 7:59 AM', body: 'Called customer.', isLegacy: false, kind: 'note', actor: '' },
      { timestamp: 'Legacy note', body: 'Legacy imported note', isLegacy: true, kind: 'legacy', actor: '' },
    ]
  )
})

test('formats missing note authors without saying unknown author', () => {
  assert.equal(displayLeadTranscriptAuthor('', ''), 'Author not recorded')
  assert.equal(displayLeadTranscriptAuthor('', 'finance@example.com'), 'Author not recorded · Finance Manager: finance@example.com')
  assert.equal(displayLeadTranscriptAuthor('agent@example.com', 'finance@example.com'), 'agent@example.com')
})

test('parses note and status authors for easier transcript display', () => {
  assert.deepEqual(
    parseLeadTranscriptEntries(
      '[May 26, 2026, 8:00 AM] Note by agent@easydrivecanada.com: Customer requested text updates.\n\n[May 26, 2026, 8:15 AM] Status updated by manager@easydrivecanada.com: Need More Information -> In Talks'
    ),
    [
      {
        timestamp: 'May 26, 2026, 8:00 AM',
        body: 'Customer requested text updates.',
        isLegacy: false,
        kind: 'note',
        actor: 'agent@easydrivecanada.com',
      },
      {
        timestamp: 'May 26, 2026, 8:15 AM',
        body: 'Need More Information -> In Talks',
        isLegacy: false,
        kind: 'status',
        actor: 'manager@easydrivecanada.com',
      },
    ]
  )
})

test('claims an unassigned finance lead with the current editor', () => {
  assert.equal(resolveLeadFinanceManager('', 'manager@easydrivecanada.com'), 'manager@easydrivecanada.com')
  assert.equal(resolveLeadFinanceManager(null, ' manager@easydrivecanada.com '), 'manager@easydrivecanada.com')
})

test('keeps an existing finance manager instead of overwriting ownership', () => {
  assert.equal(
    resolveLeadFinanceManager('owner@easydrivecanada.com', 'manager@easydrivecanada.com'),
    'owner@easydrivecanada.com'
  )
})

test('does not assign a finance manager without an editor identity', () => {
  assert.equal(resolveLeadFinanceManager('', '   '), null)
})

test('opens lead details from row clicks except nested lead actions', () => {
  assert.equal(shouldOpenLeadDetailsFromRowClick({ closest: () => null }), true)
  assert.equal(shouldOpenLeadDetailsFromRowClick({ closest: () => ({ tagName: 'BUTTON' }) }), false)
})
