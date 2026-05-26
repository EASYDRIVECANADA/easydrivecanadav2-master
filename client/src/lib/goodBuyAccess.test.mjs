import assert from 'node:assert/strict'
import { test } from 'node:test'

import { isGoodBuyEmailAllowed } from './goodBuyAccess.mjs'

test('allows Good Buy only for the EasyDrive info account', () => {
  assert.equal(isGoodBuyEmailAllowed('info@easydrivecanada.com'), true)
  assert.equal(isGoodBuyEmailAllowed(' INFO@EASYDRIVECANADA.COM '), true)
  assert.equal(isGoodBuyEmailAllowed('admin@easydrivecanada.com'), false)
  assert.equal(isGoodBuyEmailAllowed(''), false)
})
