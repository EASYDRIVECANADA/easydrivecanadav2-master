import test from 'node:test'
import assert from 'node:assert/strict'

import { isSuperAdminEmail, resolveEditableDealerUserId } from './superAdminAccess.mjs'

test('isSuperAdminEmail accepts info account regardless of casing and whitespace', () => {
  assert.equal(isSuperAdminEmail(' info@easydrivecanada.com '), true)
  assert.equal(isSuperAdminEmail('INFO@EASYDRIVECANADA.COM'), true)
})

test('isSuperAdminEmail rejects other accounts', () => {
  assert.equal(isSuperAdminEmail('owner@drivetownottawa.com'), false)
  assert.equal(isSuperAdminEmail(''), false)
  assert.equal(isSuperAdminEmail(null), false)
})

test('resolveEditableDealerUserId lets superadmin choose another dealership user id', () => {
  assert.equal(
    resolveEditableDealerUserId({
      adminEmail: 'info@easydrivecanada.com',
      ownUserId: 'edc-admin-user',
      selectedDealerUserId: 'drivetown-user',
    }),
    'drivetown-user'
  )
})

test('resolveEditableDealerUserId falls back to own user id for non-superadmin', () => {
  assert.equal(
    resolveEditableDealerUserId({
      adminEmail: 'owner@drivetownottawa.com',
      ownUserId: 'drivetown-user',
      selectedDealerUserId: 'other-dealer-user',
    }),
    'drivetown-user'
  )
})

test('resolveEditableDealerUserId falls back to own user id when superadmin has not selected a dealer', () => {
  assert.equal(
    resolveEditableDealerUserId({
      adminEmail: 'info@easydrivecanada.com',
      ownUserId: 'edc-admin-user',
      selectedDealerUserId: '',
    }),
    'edc-admin-user'
  )
})
