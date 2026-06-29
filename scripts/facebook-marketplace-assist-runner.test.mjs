import test from 'node:test'
import assert from 'node:assert/strict'
import { once } from 'node:events'
import {
  parseRunnerArgs,
  requireLaunchToken,
  buildAssistPayloadUrl,
  buildAssistStatusUrl,
  buildFacebookControlLocatorKinds,
  buildFacebookFieldPlan,
  buildFacebookPhotoUploadPlan,
  formatAssistPlanSummary,
  formatAssistFieldResults,
  filledValueMatches,
  facebookActionTimeoutMs,
  clickMatchingOption,
  tryFillLocator,
  resolveProfileDir,
  createStatusBody,
  startRunnerServer,
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
  assert.match(buildAssistPayloadUrl(token), /^https:\/\/easydrivecanada\.com\/api\/admin\/marketplace\/facebook\/posts\/post-1\/assist\?token=/)
  assert.match(buildAssistStatusUrl(token), /^https:\/\/easydrivecanada\.com\/api\/admin\/marketplace\/facebook\/posts\/post-1\/assist\?token=/)
})

test('createStatusBody uses assistStatus and never marks durable posted status', () => {
  const body = createStatusBody('needs_review')
  assert.deepEqual(body, { assistStatus: 'needs_review', assistError: '' })
})

test('buildFacebookFieldPlan maps only supported safe fields', () => {
  const plan = buildFacebookFieldPlan({
    year: '2020',
    make: 'Honda',
    model: 'Civic',
    title: '2020 Honda Civic',
    price: 21000,
    description: 'Clean local trade ready for test drive.',
    mileage: 70000,
    location: 'Mississauga, ON',
    vin: '2HGFC2F59LH000000',
  })
  assert.deepEqual(plan.map((item) => item.field), ['location', 'year', 'make', 'model', 'title', 'price', 'mileage', 'vin', 'description'])
  assert.equal(plan.find((item) => item.field === 'location')?.interaction, 'suggestion')
  assert.equal(plan.find((item) => item.field === 'year')?.interaction, 'option')
  assert.equal(plan.find((item) => item.field === 'price')?.value, '21000')
})

test('buildFacebookFieldPlan fills description last to recover from focus leaks', () => {
  const plan = buildFacebookFieldPlan({
    description: 'Full listing description.',
    vin: '2HGFC2F59LH000000',
    exteriorColor: 'Blue',
    transmission: 'Automatic',
    fuelType: 'Gas',
  })

  assert.equal(plan.at(-1)?.field, 'description')
  assert.equal(plan.some((item, index) => item.field === 'vin' && index < plan.length - 1), true)
})

test('buildFacebookControlLocatorKinds includes Facebook custom button fields', () => {
  assert.deepEqual(buildFacebookControlLocatorKinds(), [
    'label',
    'placeholder',
    'textbox',
    'combobox',
    'spinbutton',
    'button',
    'aria-input',
    'visible-text',
  ])
})

test('formatAssistPlanSummary exposes which vehicle fields reached the runner', () => {
  assert.equal(
    formatAssistPlanSummary({
      images: ['https://example.com/1.jpg', 'https://example.com/2.jpg'],
      location: 'Ottawa, Ontario',
      year: '2021',
      make: 'Toyota',
      model: 'Corolla',
      price: 24871,
    }),
    'photos=2; fields=location, year, make, model, price'
  )
})

test('buildFacebookPhotoUploadPlan keeps uploadable image sources', () => {
  const plan = buildFacebookPhotoUploadPlan({
    images: [
      'https://example.com/front.jpg',
      'not-a-url',
      'C:\\cars\\civic.jpg',
    ],
  })

  assert.deepEqual(plan, ['https://example.com/front.jpg', 'C:\\cars\\civic.jpg'])
})

test('formatAssistFieldResults reports fields that still need manual input', () => {
  const message = formatAssistFieldResults([
    { field: 'title', filled: true },
    { field: 'price', filled: false },
    { field: 'location', filled: false },
  ])

  assert.equal(message, 'Needs manual input: price, location')
  assert.equal(formatAssistFieldResults([{ field: 'title', filled: true }]), '')
})

test('filledValueMatches rejects unchanged Facebook price and empty description fields', () => {
  assert.equal(filledValueMatches('24871', '₱24,871'), true)
  assert.equal(filledValueMatches('24871', '₱0'), false)
  assert.equal(filledValueMatches('2009 BMW Z4 sDRIVE30I', ''), false)
  assert.equal(filledValueMatches('2009 BMW Z4 sDRIVE30I', '2009 BMW Z4 sDRIVE30I - clean roadster'), true)
})

test('tryFillLocator uses short action timeouts when a Facebook field rejects input', async () => {
  const actions = []
  const locator = {
    count: async () => 1,
    fill: async (_value, options) => {
      actions.push(['fill', options?.timeout])
      throw new Error('not editable')
    },
    click: async (options) => {
      actions.push(['click', options?.timeout])
    },
    evaluate: async () => '₱0',
  }
  const page = {
    waitForTimeout: async () => {},
    keyboard: {
      press: async () => {},
      type: async () => {},
    },
    evaluate: async () => '',
  }

  assert.equal(await tryFillLocator(page, locator, '24871'), false)
  assert.deepEqual(actions, [
    ['fill', facebookActionTimeoutMs],
    ['click', facebookActionTimeoutMs],
  ])
})

test('clickMatchingOption uses short timeouts and falls back when Facebook overlays intercept suggestions', async () => {
  const actions = []
  const suggestion = {
    count: async () => 1,
    click: async (options) => {
      actions.push(options?.timeout)
      throw new Error('subtree intercepts pointer events')
    },
  }
  const page = {
    getByRole: () => ({ first: () => ({ count: async () => 0 }) }),
    getByText: () => ({ first: () => suggestion }),
  }

  assert.equal(await clickMatchingOption(page, 'Ottawa, ON'), false)
  assert.deepEqual(actions, [facebookActionTimeoutMs])
})

test('runner health endpoint is readable from the admin dashboard', async () => {
  const server = startRunnerServer({ port: 0, browser: 'msedge', profileDir: '.facebook-assist-profile' })
  await once(server, 'listening')
  const address = server.address()
  assert.equal(typeof address, 'object')
  const baseUrl = `http://127.0.0.1:${address.port}`

  try {
    const preflight = await fetch(`${baseUrl}/health`, { method: 'OPTIONS' })
    assert.equal(preflight.status, 204)
    assert.equal(preflight.headers.get('access-control-allow-origin'), '*')

    const res = await fetch(`${baseUrl}/health`)
    assert.equal(res.status, 200)
    assert.equal(res.headers.get('access-control-allow-origin'), '*')
    assert.deepEqual(await res.json(), {
      ok: true,
      service: 'easy-drive-facebook-assistant',
      browser: 'msedge',
      profileDir: '.facebook-assist-profile',
    })
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
})
