import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const routeFiles = [
  '../client/src/app/api/admin/marketplace/facebook/posts/route.ts',
  '../client/src/app/api/admin/marketplace/facebook/posts/[id]/route.ts',
  '../client/src/app/api/admin/marketplace/facebook/posts/[id]/assist/route.ts',
]

test('facebook marketplace admin routes require admin session checks', async () => {
  for (const relativePath of routeFiles) {
    const source = await readFile(new URL(relativePath, import.meta.url), 'utf8')
    assert.match(source, /requireAdminSession/, `${relativePath} imports or calls requireAdminSession`)
    assert.match(source, /const authError = await requireAdminSession\(request\)/, `${relativePath} checks request admin session`)
  }
})

test('facebook assist route refreshes assist payload from the current vehicle record', async () => {
  const source = await readFile(new URL('../client/src/app/api/admin/marketplace/facebook/posts/[id]/assist/route.ts', import.meta.url), 'utf8')

  assert.match(source, /buildFacebookMarketplacePayload/, 'assist route imports fresh vehicle payload builder')
  assert.match(source, /\.from\('edc_vehicles'\)/, 'assist route queries the current vehicle record')
  assert.match(source, /freshVehiclePayload/, 'assist route layers fresh vehicle details into the assist payload')
})
