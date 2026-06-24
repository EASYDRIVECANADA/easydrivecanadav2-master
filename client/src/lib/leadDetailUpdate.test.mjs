import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  buildLeadDetailDraft,
  buildLeadDetailUpdate,
  replaceLeadMessageSource,
} from './leadDetailUpdate.mjs'

const currentLead = {
  firstName: 'Jane',
  lastName: 'Smith',
  email: 'jane@example.com',
  phone: '6135550101',
  vehicleInterest: '',
  message: 'Source: EasyDrive Canada - Website\nMessage: Sent from old form',
  employmentStatus: null,
  monthlyIncome: null,
  downPayment: null,
  creditScore: '',
  adminNotes: '[Jun 16, 2026, 10:00 PM] Existing note',
  createdAt: '2026-06-16T00:00:00.000Z',
}

test('replaces the lead source line while preserving other submitted message rows', () => {
  assert.equal(
    replaceLeadMessageSource(currentLead.message, 'FB Lead Form'),
    'Source: FB Lead Form\nMessage: Sent from old form'
  )
})

test('builds an editable draft from an existing lead', () => {
  assert.deepEqual(buildLeadDetailDraft(currentLead), {
    firstName: 'Jane',
    lastName: 'Smith',
    email: 'jane@example.com',
    phone: '6135550101',
    source: 'website',
    customSource: '',
    createdAt: '2026-06-16',
    vehicleInterest: '',
    employmentStatus: '',
    monthlyIncome: '',
    downPayment: '',
    creditScore: '',
  })
})

test('builds update payload and timestamped transcript entries for changed lead fields', () => {
  const result = buildLeadDetailUpdate(currentLead, {
    firstName: 'Jane',
    lastName: 'Smith',
    email: 'jane@example.com',
    phone: '6135550199',
    source: 'unknown',
    customSource: 'FB Lead Form',
    createdAt: '2026-06-15',
    vehicleInterest: '2020 Toyota Corolla',
    employmentStatus: 'Full-time',
    monthlyIncome: '5200',
    downPayment: '1000',
    creditScore: 'Good',
  }, {
    notesEnabled: true,
    actor: 'manager@easydrivecanada.com',
    timestamp: 'Jun 16, 2026, 11:45 PM',
  })

  assert.equal(result.hasChanges, true)
  assert.equal(result.localUpdate.phone, '6135550199')
  assert.equal(result.localUpdate.vehicleInterest, '2020 Toyota Corolla')
  assert.equal(result.localUpdate.employmentStatus, 'Full-time')
  assert.equal(result.localUpdate.monthlyIncome, 5200)
  assert.equal(result.localUpdate.downPayment, 1000)
  assert.equal(result.localUpdate.creditScore, 'Good')
  assert.equal(result.localUpdate.createdAt, '2026-06-15T00:00:00.000Z')
  assert.equal(result.localUpdate.message, 'Source: FB Lead Form\nMessage: Sent from old form')

  assert.equal(result.payload.phone, '6135550199')
  assert.equal(result.payload.vehicle_interest, '2020 Toyota Corolla')
  assert.equal(result.payload.employment_status, 'Full-time')
  assert.equal(result.payload.monthly_income, 5200)
  assert.equal(result.payload.down_payment, 1000)
  assert.equal(result.payload.credit_score, 'Good')
  assert.equal(result.payload.created_at, '2026-06-15T00:00:00.000Z')
  assert.equal(result.payload.message, 'Source: FB Lead Form\nMessage: Sent from old form')
  assert.match(result.payload.admin_notes, /Source updated by manager@easydrivecanada\.com: EASYDRIVE CANADA - WEBSITE -> Other: FB Lead Form/)
  assert.match(result.payload.admin_notes, /Received date updated by manager@easydrivecanada\.com: 2026-06-16 -> 2026-06-15/)
  assert.match(result.payload.admin_notes, /Employment updated by manager@easydrivecanada\.com: cleared -> Full-time/)
})

test('does not require admin notes when the notes column is unavailable', () => {
  const result = buildLeadDetailUpdate(currentLead, {
    ...buildLeadDetailDraft(currentLead),
    source: 'unknown',
    customSource: 'FB Lead Form',
  }, {
    notesEnabled: false,
    actor: 'manager@easydrivecanada.com',
    timestamp: 'Jun 16, 2026, 11:45 PM',
  })

  assert.equal(result.hasChanges, true)
  assert.equal(result.payload.admin_notes, undefined)
})

test('preserves custom other source text when updating lead details', () => {
  const lead = {
    ...currentLead,
    message: 'Source: Referral partner\nMessage: Sent from a referral',
  }
  const draft = {
    ...buildLeadDetailDraft(lead),
    customSource: 'Community event',
  }

  const result = buildLeadDetailUpdate(lead, draft, {
    notesEnabled: true,
    actor: 'manager@easydrivecanada.com',
    timestamp: 'Jun 16, 2026, 11:45 PM',
  })

  assert.equal(result.hasChanges, true)
  assert.equal(result.payload.message, 'Source: Community event\nMessage: Sent from a referral')
  assert.match(result.payload.admin_notes, /Source updated by manager@easydrivecanada\.com: Other: Referral partner -> Other: Community event/)
})
