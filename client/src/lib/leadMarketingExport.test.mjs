import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  buildLeadMarketingExportRows,
  buildLeadMarketingSummaryRows,
  LEAD_MARKETING_EXPORT_COLUMNS,
  leadMarketingRowsToAoa,
} from './leadMarketingExport.mjs'

const sampleLeads = [
  {
    id: 'lead-1',
    firstName: 'Jane',
    lastName: 'Smith',
    email: 'jane@example.com',
    phone: '6135550101',
    vehicleInterest: '2018 Honda Civic',
    message: 'Source: Finance Application\nCity: Ottawa\nProvince: ON\nCampaign Source: Facebook Ads',
    employmentStatus: 'Full-time',
    monthlyIncome: 5200,
    downPayment: 2500,
    creditScore: '650',
    adminNotes: '[2026-06-01 10:00] Called customer',
    marketingNotes: 'SUV buyer, low down payment concern',
    managerStatus: 'Contacted',
    financeManager: 'manager@easydrivecanada.com',
    createdAt: '2026-06-01T12:00:00.000Z',
  },
  {
    id: 'lead-2',
    firstName: '',
    lastName: '',
    email: '',
    phone: '6135550202',
    vehicleInterest: '',
    message: 'Source: Contact\nAddress: 4856 Bank St',
    employmentStatus: null,
    monthlyIncome: null,
    downPayment: null,
    creditScore: null,
    adminNotes: null,
    marketingNotes: null,
    managerStatus: null,
    financeManager: null,
    createdAt: '2026-06-02T12:00:00.000Z',
  },
]

test('exports lead rows with personal contact info and marketing notes', () => {
  const [row] = buildLeadMarketingExportRows(sampleLeads)

  assert.equal(row['Lead ID'], 'lead-1')
  assert.equal(row['First name'], 'Jane')
  assert.equal(row['Last name'], 'Smith')
  assert.equal(row['Full name'], 'Jane Smith')
  assert.equal(row.Email, 'jane@example.com')
  assert.equal(row.Phone, '6135550101')
  assert.equal(row.City, 'Ottawa')
  assert.equal(row.Province, 'ON')
  assert.equal(row['Campaign source'], 'Facebook Ads')
  assert.equal(row['Marketing notes'], 'SUV buyer, low down payment concern')
  assert.equal(row['Internal notes transcript'], '[2026-06-01 10:00] Called customer')
})

test('normalizes missing optional export fields to empty strings', () => {
  const [, row] = buildLeadMarketingExportRows(sampleLeads)

  assert.equal(row['Full name'], '')
  assert.equal(row.Email, '')
  assert.equal(row['Monthly income'], '')
  assert.equal(row['Marketing notes'], '')
  assert.equal(row['Finance manager'], '')
  assert.equal(row.Address, '4856 Bank St')
})

test('builds summary rows by source status and finance manager', () => {
  const rows = buildLeadMarketingSummaryRows(sampleLeads)

  assert.deepEqual(rows[0], ['Metric', 'Value', 'Count'])
  assert.ok(rows.some((row) => row[0] === 'Source' && row[1] === 'Finance' && row[2] === 1))
  assert.ok(rows.some((row) => row[0] === 'Status' && row[1] === 'Contacted' && row[2] === 1))
  assert.ok(rows.some((row) => row[0] === 'Finance manager' && row[1] === 'manager@easydrivecanada.com' && row[2] === 1))
  assert.ok(rows.some((row) => row[0] === 'Submitted date' && row[1] === '2026-06-01' && row[2] === 1))
})

test('converts export rows into a stable AOA sheet shape', () => {
  const rows = buildLeadMarketingExportRows(sampleLeads)
  const aoa = leadMarketingRowsToAoa(rows)

  assert.deepEqual(aoa[0], LEAD_MARKETING_EXPORT_COLUMNS)
  assert.equal(aoa.length, 3)
  assert.equal(aoa[1][LEAD_MARKETING_EXPORT_COLUMNS.indexOf('Email')], 'jane@example.com')
})
