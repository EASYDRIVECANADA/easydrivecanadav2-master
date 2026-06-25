import test from 'node:test'
import assert from 'node:assert/strict'
import {
  parseRunnerArgs,
  requireLaunchToken,
  buildAssistPayloadUrl,
  buildAssistStatusUrl,
  createStatusBody,
} from './facebook-marketplace-assist-runner.mjs'

const token = {
  postId: 'post-1',
  baseUrl: 'https://easydrivecanada.com',
  issuedAt: '2026-06-26T00:00:00.000Z',
  expiresAt: '2026-06-26T00:10:00.000Z',
}

test('parseRunnerArgs reads token, port, dry-run, and browser options', () => {
  const args = parseRunnerArgs(['--token', JSON.stringify(token), '--port', '4777', '--dry-run', '--browser', 'msedge'])
  assert.equal(args.port, 4777)
  assert.equal(args.dryRun, true)
  assert.equal(args.browser, 'msedge')
  assert.equal(args.token.postId, 'post-1')
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
