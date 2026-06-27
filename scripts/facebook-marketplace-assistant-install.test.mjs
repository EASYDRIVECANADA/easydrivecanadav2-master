import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('facebook assistant installer creates a Windows logon scheduled task', async () => {
  const source = await readFile(new URL('./install-facebook-assistant-startup.ps1', import.meta.url), 'utf8')

  assert.match(source, /Register-ScheduledTask/)
  assert.match(source, /New-ScheduledTaskTrigger\s+-AtLogOn/)
  assert.match(source, /EasyDrive Facebook Assistant/)
  assert.match(source, /facebook-marketplace-assist-runner\.mjs/)
  assert.match(source, /--profile-dir/)
  assert.match(source, /\.facebook-assist-profile/)
  assert.match(source, /\[int\]\$Port\s+=\s+4777/)
  assert.match(source, /--port\s+\$Port/)
  assert.doesNotMatch(source, /CodeGeneration/)
})

test('site-hosted facebook assistant package can install without the repo checkout', async () => {
  const installer = await readFile(new URL('../client/public/downloads/facebook-assistant/install.ps1', import.meta.url), 'utf8')
  const pkg = JSON.parse(await readFile(new URL('../client/public/downloads/facebook-assistant/package.json', import.meta.url), 'utf8'))
  const publicRunner = await readFile(new URL('../client/public/downloads/facebook-assistant/facebook-marketplace-assist-runner.mjs', import.meta.url), 'utf8')
  const repoRunner = await readFile(new URL('./facebook-marketplace-assist-runner.mjs', import.meta.url), 'utf8')

  assert.match(installer, /https:\/\/easydrivecanada\.com/)
  assert.match(installer, /Invoke-WebRequest/)
  assert.match(installer, /npm\s+install\s+--omit=dev/)
  assert.match(installer, /Register-ScheduledTask/)
  assert.match(installer, /start-facebook-assistant\.ps1/)
  assert.doesNotMatch(installer, /RepoRoot/)
  assert.equal(pkg.scripts.start, 'node facebook-marketplace-assist-runner.mjs --port 4777 --profile-dir ".facebook-assist-profile"')
  assert.equal(pkg.dependencies.playwright, '^1.49.1')
  assert.equal(publicRunner, repoRunner)
})
