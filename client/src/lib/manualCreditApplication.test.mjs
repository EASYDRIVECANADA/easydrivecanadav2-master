import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  buildCreditApplicationMessageRows,
  parseGetGoingCreditApplicationEmail,
} from './manualCreditApplication.mjs'

const getGoingEmail = `
New Auto Loan Lead in TINY, ON

Applicant Name: ERIC SANDY
Email Address: eas_mma@hotmail.com
Address : 26 DUQUETTE CRT
City: TINY, ON
Mobile Phone: 705-529-3604
Home Phone: 705-529-3604
Vehicle Type : Truck
Monthly Budget: $376 - $499
Employment Status: Self-employed
Occupation: Contractor
Employer: Sandy's Reno & Rooftop Service's
Monthly Income: 12000
Employment Duration (in months): 12
House on Rent or Own?: Rent
House Monthly Payment: 2300
House Living Time (in months): 12
Birthday: 08/03/1993 12:00:00 AM
Postal Code: L9M 0H3
Lead Source: firstnationfinancing.ca
`

test('parses GetGoing credit application emails into manual lead fields', () => {
  const parsed = parseGetGoingCreditApplicationEmail(getGoingEmail)

  assert.equal(parsed.firstName, 'ERIC')
  assert.equal(parsed.lastName, 'SANDY')
  assert.equal(parsed.email, 'eas_mma@hotmail.com')
  assert.equal(parsed.phone, '705-529-3604')
  assert.equal(parsed.vehicleInterest, 'Truck')
  assert.equal(parsed.employmentStatus, 'Self-employed')
  assert.equal(parsed.monthlyIncome, '12000')
  assert.equal(parsed.applicationDetails.streetAddress, '26 DUQUETTE CRT')
  assert.equal(parsed.applicationDetails.city, 'TINY')
  assert.equal(parsed.applicationDetails.province, 'ON')
  assert.equal(parsed.applicationDetails.postalCode, 'L9M 0H3')
  assert.equal(parsed.applicationDetails.employerName, "Sandy's Reno & Rooftop Service's")
  assert.equal(parsed.applicationDetails.leadSource, 'firstnationfinancing.ca')
})

test('builds message rows the lead detail view can display', () => {
  const parsed = parseGetGoingCreditApplicationEmail(getGoingEmail)
  const rows = buildCreditApplicationMessageRows(parsed.applicationDetails, {
    vehicleInterest: parsed.vehicleInterest,
    employmentStatus: parsed.employmentStatus,
    monthlyIncome: parsed.monthlyIncome,
  })

  assert.deepEqual(rows.slice(0, 5), [
    ['Date of birth', '08/03/1993 12:00:00 AM'],
    ['Street address', '26 DUQUETTE CRT'],
    ['City', 'TINY'],
    ['Province / territory', 'ON'],
    ['Postal code', 'L9M 0H3'],
  ])
  assert.deepEqual(rows.find(([label]) => label === 'Company name'), ['Company name', "Sandy's Reno & Rooftop Service's"])
  assert.deepEqual(rows.find(([label]) => label === 'Referrer'), ['Referrer', 'firstnationfinancing.ca'])
})
