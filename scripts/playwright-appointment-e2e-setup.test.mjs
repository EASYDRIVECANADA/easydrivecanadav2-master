import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('appointment Playwright smoke test is wired through package scripts', async () => {
  const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))

  assert.equal(pkg.scripts?.['test:e2e:appointments'], 'playwright test tests/e2e/appointments-admin.spec.ts')
  assert.match(JSON.stringify(pkg.devDependencies || {}), /@playwright\/test/)
})

test('appointment Playwright spec uses env-based admin credentials', async () => {
  const config = await readFile(new URL('../playwright.config.ts', import.meta.url), 'utf8')
  const spec = await readFile(new URL('../tests/e2e/appointments-admin.spec.ts', import.meta.url), 'utf8')

  assert.match(config, /webServer/)
  assert.match(spec, /EDC_ADMIN_EMAIL/)
  assert.match(spec, /EDC_ADMIN_PASSWORD/)
  assert.match(spec, /New appointment/)
})
