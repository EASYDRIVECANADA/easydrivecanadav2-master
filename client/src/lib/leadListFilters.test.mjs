import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  buildLeadFilterOptions,
  defaultLeadFilterForSource,
  filterAndSortLeads,
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

test('exposes only the requested lead tabs', () => {
  assert.deepEqual(buildLeadFilterOptions().map((option) => option.label), [
    'View All Apps',
    'Landing Page',
    'Website',
    'Other',
  ])
})

test('shows website and Facebook leads in the view all tab', () => {
  assert.equal(matchesLeadListFilter(lead({ message: 'Source: EasyDrive Canada - Website' }), 'all'), true)
  assert.equal(matchesLeadListFilter(lead({ message: 'Source: Manual Entry - FB Lead Form' }), 'all'), true)
})

test('keeps Facebook lead form entries under the other tab', () => {
  assert.equal(matchesLeadListFilter(lead({ message: 'Source: EasyDrive Canada - Website' }), 'website'), true)
  assert.equal(matchesLeadListFilter(lead({ message: 'Source: Manual Entry - FB Lead Form' }), 'unknown'), true)
  assert.equal(matchesLeadListFilter(lead({ message: 'Source: Manual Entry - FB Lead Form' }), 'finance'), false)
})

test('keeps handled leads visible in view all and source filters', () => {
  const handledWebsiteLead = lead({
    message: 'Source: EasyDrive Canada - Website',
    ghlSynced: true,
  })

  assert.equal(matchesLeadListFilter(handledWebsiteLead, 'all'), true)
  assert.equal(matchesLeadListFilter(handledWebsiteLead, 'website'), true)
})

test('selects the new lead source filter after manual creation', () => {
  assert.equal(defaultLeadFilterForSource('website'), 'website')
  assert.equal(defaultLeadFilterForSource('facebook'), 'unknown')
  assert.equal(defaultLeadFilterForSource('unknown'), 'unknown')
})

test('filters by manager status and custom other source text', () => {
  const rows = [
    lead({ id: '1', message: 'Source: GetGoing', managerStatus: 'In Talks', createdAt: '2026-06-20T12:00:00.000Z' }),
    lead({ id: '2', message: 'Source: FB Leads', managerStatus: 'Booked', createdAt: '2026-06-21T12:00:00.000Z' }),
    lead({ id: '3', message: 'Source: EasyDrive Canada - Website', managerStatus: 'In Talks', createdAt: '2026-06-22T12:00:00.000Z' }),
  ]

  assert.deepEqual(
    filterAndSortLeads(rows, {
      tab: 'unknown',
      status: 'In Talks',
      sourceText: 'getgoing',
      search: '',
      now: '2026-06-24T12:00:00.000Z',
    }).map((row) => row.id),
    ['1']
  )
})

test('sorts active task reminders ahead of normal newest-first leads', () => {
  const rows = [
    lead({ id: 'newest', createdAt: '2026-06-23T12:00:00.000Z' }),
    lead({ id: 'later-task', createdAt: '2026-06-20T12:00:00.000Z', taskDueAt: '2026-06-25T12:00:00.000Z', taskCompletedAt: null }),
    lead({ id: 'due-task', createdAt: '2026-06-19T12:00:00.000Z', taskDueAt: '2026-06-24T09:00:00.000Z', taskCompletedAt: null }),
    lead({ id: 'done-task', createdAt: '2026-06-24T12:00:00.000Z', taskDueAt: '2026-06-24T08:00:00.000Z', taskCompletedAt: '2026-06-24T10:00:00.000Z' }),
  ]

  assert.deepEqual(
    filterAndSortLeads(rows, {
      tab: 'all',
      status: '',
      sourceText: '',
      search: '',
      now: '2026-06-24T12:00:00.000Z',
    }).map((row) => row.id),
    ['due-task', 'later-task', 'done-task', 'newest']
  )
})
