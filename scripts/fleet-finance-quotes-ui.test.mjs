import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const adminPagePath = new URL('../client/src/app/admin/fleet-finance/page.tsx', import.meta.url)
const adminClientPath = new URL('../client/src/app/admin/fleet-finance/FleetFinanceAdminClient.tsx', import.meta.url)
const publicPagePath = new URL('../client/src/app/fleet-quote/[token]/page.tsx', import.meta.url)
const publicClientPath = new URL('../client/src/app/fleet-quote/[token]/FleetQuoteClient.tsx', import.meta.url)
const adminLayoutPath = new URL('../client/src/app/admin/AdminLayoutClient.tsx', import.meta.url)

test('admin fleet finance page exposes quote builder actions', async () => {
  const page = await readFile(adminPagePath, 'utf8')
  const client = await readFile(adminClientPath, 'utf8')
  const layout = await readFile(adminLayoutPath, 'utf8')

  assert.match(page, /FleetFinanceAdminClient/)
  assert.match(layout, /\/admin\/fleet-finance/)
  assert.match(layout, /Fleet Finance/)
  assert.match(client, /Create quote/)
  assert.match(client, /Copy quote link/)
  assert.match(client, /\/api\/admin\/fleet-quotes/)
  assert.match(client, /suggestedVehicleIds/)
})

test('public fleet quote page requires phone last four and submits top picks', async () => {
  const page = await readFile(publicPagePath, 'utf8')
  const client = await readFile(publicClientPath, 'utf8')

  assert.match(page, /FleetQuoteClient/)
  assert.match(client, /Last 4 digits/)
  assert.match(client, /Submit picks/)
  assert.match(client, /selectedVehicleIds/)
  assert.match(client, /\/api\/fleet-quotes\/\$\{encodeURIComponent\(token\)\}/)
  assert.doesNotMatch(client, /partner_price|dealer_cost|internal_cost/i)
})
