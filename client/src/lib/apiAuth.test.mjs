import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  isMissingSessionTokenColumnError,
  shouldRejectAdminSessionToken,
} from './apiAuthCore.mjs'

test('isMissingSessionTokenColumnError recognizes optional Supabase column failures', () => {
  assert.equal(isMissingSessionTokenColumnError({ message: 'column users.session_token does not exist' }), true)
  assert.equal(isMissingSessionTokenColumnError({ message: 'relation users does not exist' }), false)
  assert.equal(isMissingSessionTokenColumnError(null), false)
})

test('shouldRejectAdminSessionToken only rejects when a stored token exists and differs', () => {
  assert.equal(shouldRejectAdminSessionToken('', 'no-token'), false)
  assert.equal(shouldRejectAdminSessionToken(null, 'no-token'), false)
  assert.equal(shouldRejectAdminSessionToken('abc123', 'abc123'), false)
  assert.equal(shouldRejectAdminSessionToken('abc123', 'no-token'), true)
})
