import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('facebook assist Playwright smoke test is wired through package scripts', async () => {
  const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))

  assert.equal(pkg.scripts?.['test:e2e:facebook-assist'], 'playwright test tests/e2e/facebook-assist.spec.ts')
})

test('facebook assist Playwright spec uses env-based admin credentials', async () => {
  const spec = await readFile(new URL('../tests/e2e/facebook-assist.spec.ts', import.meta.url), 'utf8')

  assert.match(spec, /EDC_ADMIN_EMAIL/)
  assert.match(spec, /EDC_ADMIN_PASSWORD/)
  assert.match(spec, /Facebook Posting Queue/)
})

test('facebook posting dashboard exposes local assistant status and setup guidance', async () => {
  const source = await readFile(new URL('../client/src/app/admin/marketplace/facebook/FacebookMarketplaceClient.tsx', import.meta.url), 'utf8')

  assert.match(source, /http:\/\/127\.0\.0\.1:4777\/health/)
  assert.match(source, /Facebook Assistant Online/)
  assert.match(source, /Facebook Assistant Offline/)
  assert.match(source, /\/downloads\/facebook-assistant\/install\.ps1/)
  assert.match(source, /Download Facebook Assistant/)
})
