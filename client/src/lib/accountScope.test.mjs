import assert from 'node:assert/strict'
import { test } from 'node:test'

import { resolveAccountScopeUserId, resolveShowroomVehicleScope } from './accountScope.mjs'

test('prefers the shared users.user_id over a stale staff session user_id', () => {
  assert.equal(
    resolveAccountScopeUserId({
      sessionUserId: 'employee-row-id',
      rowUserId: 'dealer-account-id',
      rowId: 'users-table-row-id',
    }),
    'dealer-account-id'
  )
})

test('keeps the session user_id when the users row has no shared account id', () => {
  assert.equal(
    resolveAccountScopeUserId({
      sessionUserId: 'session-account-id',
      rowUserId: '',
      rowId: 'users-table-row-id',
    }),
    'session-account-id'
  )
})

test('does not filter showroom vehicles by a staff row id when all-deals staff has no shared account id', () => {
  assert.deepEqual(
    resolveShowroomVehicleScope({
      sessionUserId: 'employee-row-id',
      rowUserId: '',
      rowId: 'employee-row-id',
      canViewAllShowroomVehicles: true,
    }),
    { userId: '', shouldFilterByUserId: false }
  )
})

test('does not filter showroom vehicles when permitted staff session has no user_id', () => {
  assert.deepEqual(
    resolveShowroomVehicleScope({
      sessionUserId: '',
      rowUserId: '',
      rowId: 'employee-row-id',
      canViewAllShowroomVehicles: true,
    }),
    { userId: '', shouldFilterByUserId: false }
  )
})

test('does not filter showroom vehicles when permitted staff session has a stale unmatched user_id', () => {
  assert.deepEqual(
    resolveShowroomVehicleScope({
      sessionUserId: 'stale-session-id',
      rowUserId: '',
      rowId: 'employee-row-id',
      canViewAllShowroomVehicles: true,
    }),
    { userId: '', shouldFilterByUserId: false }
  )
})
