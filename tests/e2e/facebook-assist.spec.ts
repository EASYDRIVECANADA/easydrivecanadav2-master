import { expect, test, type Page } from '@playwright/test'

const adminEmail = process.env.EDC_ADMIN_EMAIL || ''
const adminPassword = process.env.EDC_ADMIN_PASSWORD || ''

async function seedAdminSession(page: Page) {
  const response = await page.request.post('/api/users-login', {
    data: {
      email: adminEmail,
      password: adminPassword,
    },
  })
  expect(response.ok()).toBeTruthy()
  const json = await response.json()
  expect(json.ok).toBe(true)

  await page.addInitScript((session) => {
    window.localStorage.setItem(
      'edc_admin_session',
      JSON.stringify({ ...session, session_token: session.session_token || 'no-token' })
    )
  }, json.session)
}

test.describe('facebook marketplace assist', () => {
  test.skip(!adminEmail || !adminPassword, 'Set EDC_ADMIN_EMAIL and EDC_ADMIN_PASSWORD to run Facebook assist E2E tests.')

  test.beforeEach(async ({ page }) => {
    await seedAdminSession(page)
  })

  test('opens the Facebook Posting Queue for an authenticated admin', async ({ page }) => {
    await page.goto('/admin/marketplace/facebook')

    await expect(page.getByRole('heading', { name: 'Facebook Posting Queue' })).toBeVisible()
    await expect(page.getByRole('button', { name: /Prepare Visible/i })).toBeVisible()
    await expect(page.getByPlaceholder(/Search make/i)).toBeVisible()

    const setupMessage = page.getByText(/Run supabase\/edc_facebook_marketplace_posts\.sql/i)
    if (await setupMessage.count()) {
      test.skip(true, 'Facebook marketplace schema has not been applied in this environment.')
    }

    await expect(page.getByText(/Total/i).first()).toBeVisible()
  })
})
