import { expect, test, type Page } from '@playwright/test'

const adminEmail = process.env.EDC_ADMIN_EMAIL || ''
const adminPassword = process.env.EDC_ADMIN_PASSWORD || ''
const writeEnabled = process.env.EDC_APPOINTMENTS_E2E_WRITE === '1'

function futureDateTimeLocal(daysAhead = 3) {
  const date = new Date()
  date.setDate(date.getDate() + daysAhead)
  date.setHours(17, 30, 0, 0)
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

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

test.describe('admin appointments', () => {
  test.skip(!adminEmail || !adminPassword, 'Set EDC_ADMIN_EMAIL and EDC_ADMIN_PASSWORD to run admin appointment E2E tests.')

  test.beforeEach(async ({ page }) => {
    await seedAdminSession(page)
  })

  test('opens the appointment calendar and new appointment drawer', async ({ page }) => {
    await page.goto('/admin/appointments')

    await expect(page.getByRole('heading', { name: 'Appointments' })).toBeVisible()
    await expect(page.getByRole('button', { name: /New appointment/i })).toBeVisible()

    await page.getByRole('button', { name: /New appointment/i }).click()

    await expect(page.getByRole('heading', { name: /New appointment/i })).toBeVisible()
    await expect(page.getByLabel('First name')).toBeVisible()
    await expect(page.getByLabel('Appointment time')).toBeVisible()
    await expect(page.getByRole('button', { name: /Save appointment/i })).toBeVisible()
  })

  test('creates an appointment and cancels it through the admin UI', async ({ page }) => {
    test.skip(!writeEnabled, 'Set EDC_APPOINTMENTS_E2E_WRITE=1 to allow this test to create and cancel a real appointment.')

    const stamp = Date.now()
    const firstName = `Playwright${stamp}`
    const phone = `555-${String(stamp).slice(-7)}`

    await page.goto('/admin/appointments')
    await page.getByRole('button', { name: /New appointment/i }).click()
    await page.getByLabel('First name').fill(firstName)
    await page.getByLabel('Last name').fill('Appointment Test')
    await page.getByLabel('Phone').fill(phone)
    await page.getByLabel('Appointment time').fill(futureDateTimeLocal())
    await page.getByLabel('Note').fill('Created by Playwright appointment smoke test.')
    await page.getByRole('button', { name: /Save appointment/i }).click()

    await expect(page.getByRole('heading', { name: /New appointment/i })).toBeHidden()
    await page.getByPlaceholder(/Search customer/i).fill(firstName)
    await expect(page.getByText(firstName)).toBeVisible()

    await page.getByText(firstName).click()
    await expect(page.getByRole('heading', { name: new RegExp(firstName) })).toBeVisible()
    await page.getByRole('button', { name: 'Cancelled' }).click()
    await expect(page.getByText(/Cancelled/).first()).toBeVisible()
  })
})
