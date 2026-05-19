import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const source = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8')

test('account login page exposes create account mode', () => {
  assert.match(source, /Create account/)
  assert.match(source, /setCustomerCreateMode\(true\)/)
})

test('new signup sends users to verification flow', () => {
  assert.match(source, /router\.push\('\/account\/verification'\)/)
})
