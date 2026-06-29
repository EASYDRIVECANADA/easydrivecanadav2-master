import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const adminRoutePath = new URL('../client/src/app/api/admin/fleet-quotes/route.ts', import.meta.url)
const publicRoutePath = new URL('../client/src/app/api/fleet-quotes/[token]/route.ts', import.meta.url)

test('fleet quote admin route requires auth and persists quote profiles', async () => {
  const source = await readFile(adminRoutePath, 'utf8')

  assert.match(source, /requireAdminSession/, 'admin route imports or calls requireAdminSession')
  assert.match(source, /const authError = await requireAdminSession\(request\)/, 'admin route checks request admin session')
  assert.match(source, /\.from\('edc_fleet_quote_profiles'\)/, 'admin route reads or writes quote profiles')
  assert.match(source, /\.from\('edc_vehicles'\)/, 'admin route reads EasyDrive inventory')
  assert.match(source, /createPasscodeHash/, 'admin route hashes the customer phone passcode')
  assert.doesNotMatch(source, /\.select\('\*'\)/, 'admin route avoids broad selects')
})

test('fleet quote public route is passcode protected and returns customer-safe vehicles', async () => {
  const source = await readFile(publicRoutePath, 'utf8')

  assert.doesNotMatch(source, /requireAdminSession/, 'public route does not require an admin session')
  assert.match(source, /createPasscodeHash/, 'public route verifies passcode hash')
  assert.match(source, /\.eq\('public_token'/, 'public route loads quote by public token')
  assert.match(source, /buildFleetQuoteVehicle/, 'public route computes safe payment rows')
  assert.match(source, /selected_vehicle_ids/, 'public route stores customer selections')
  assert.doesNotMatch(source, /partner_price|partnerPrice|dealer_cost|dealerCost|internal_cost|internalCost/i, 'public route does not expose internal price fields')
  assert.doesNotMatch(source, /\.select\('\*'\)/, 'public route avoids broad selects')
})
