import assert from 'node:assert/strict'
import { test } from 'node:test'

import { leadDetailSectionClasses } from './leadDetailLayout.mjs'

test('uses compact lead detail sections by default to avoid stretched empty panels', () => {
  const classes = leadDetailSectionClasses()

  assert.equal(classes.section, 'flex flex-col')
  assert.equal(classes.body.includes('flex-1'), false)
})

test('can opt into stretched detail sections when equal-height cards are needed', () => {
  const classes = leadDetailSectionClasses({ stretch: true })

  assert.equal(classes.section, 'flex h-full flex-col')
  assert.equal(classes.body.startsWith('flex-1 '), true)
})
