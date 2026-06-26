import test from 'node:test'
import assert from 'node:assert/strict'
import {
  parseRunnerArgs,
  requireLaunchToken,
  buildAssistPayloadUrl,
  buildAssistStatusUrl,
  buildFacebookFieldPlan,
  resolveProfileDir,
  createStatusBody,
} from './facebook-marketplace-assist-runner.mjs'

const token = {
  postId: 'post-1',
  baseUrl: 'https://easydrivecanada.com',
  issuedAt: '2026-06-26T00:00:00.000Z',
  expiresAt: '2026-06-26T00:10:00.000Z',
}

test('parseRunnerArgs reads token, port, dry-run, and browser options', () => {
  const args = parseRunnerArgs([
    '--token',
    JSON.stringify(token),
    '--port',
    '4777',
    '--dry-run',
    '--browser',
    'msedge',
    '--profile-dir',
    '.facebook-assist-profile',
  ])
  assert.equal(args.port, 4777)
  assert.equal(args.dryRun, true)
  assert.equal(args.browser, 'msedge')
  assert.equal(args.profileDir, '.facebook-assist-profile')
  assert.equal(args.token.postId, 'post-1')
})

test('resolveProfileDir defaults to the dedicated Facebook assistant profile', () => {
  assert.match(resolveProfileDir(), /facebook-assist-profile$/)
  assert.match(resolveProfileDir('custom-facebook-profile'), /custom-facebook-profile$/)
})

test('requireLaunchToken rejects missing token', () => {
  assert.throws(() => requireLaunchToken({}), /launch token/i)
})

test('builds assist URLs from token', () => {
  assert.equal(buildAssistPayloadUrl(token), 'https://easydrivecanada.com/api/admin/marketplace/facebook/posts/post-1/assist')
  assert.equal(buildAssistStatusUrl(token), 'https://easydrivecanada.com/api/admin/marketplace/facebook/posts/post-1/assist')
})

test('createStatusBody uses assistStatus and never marks durable posted status', () => {
  const body = createStatusBody('needs_review')
  assert.deepEqual(body, { assistStatus: 'needs_review', assistError: '' })
})

test('buildFacebookFieldPlan maps only supported safe fields', () => {
  const plan = buildFacebookFieldPlan({
    title: '2020 Honda Civic',
    price: 21000,
    description: 'Clean local trade ready for test drive.',
    mileage: 70000,
    location: 'Mississauga, ON',
    vin: '2HGFC2F59LH000000',
  })
  assert.deepEqual(plan.map((item) => item.field), ['title', 'price', 'description', 'mileage', 'location', 'vin'])
  assert.equal(plan.find((item) => item.field === 'price')?.value, '21000')
})
