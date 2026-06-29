#!/usr/bin/env node
import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { URL } from 'node:url'

const clean = (value) => String(value ?? '').trim()
const defaultProfileDir = '.facebook-assist-profile'
export const facebookActionTimeoutMs = 1200

const parseTokenValue = (value) => {
  const raw = clean(value)
  if (!raw) return null
  return JSON.parse(raw)
}

export function parseRunnerArgs(argv = []) {
  const args = { port: 4777, dryRun: false, browser: 'msedge', profileDir: defaultProfileDir, token: null }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--token') args.token = parseTokenValue(argv[++i])
    if (arg === '--port') args.port = Number(argv[++i] || 4777)
    if (arg === '--dry-run') args.dryRun = true
    if (arg === '--browser') args.browser = clean(argv[++i] || 'msedge')
    if (arg === '--profile-dir') args.profileDir = clean(argv[++i] || defaultProfileDir)
  }
  if (!Number.isFinite(args.port) || args.port <= 0) args.port = 4777
  if (!args.profileDir) args.profileDir = defaultProfileDir
  return args
}

export function resolveProfileDir(profileDir = defaultProfileDir) {
  return path.resolve(clean(profileDir) || defaultProfileDir)
}

export function requireLaunchToken(args) {
  if (!args?.token?.postId || !args?.token?.baseUrl) throw new Error('A valid launch token is required.')
  return args.token
}

export function buildAssistPayloadUrl(token) {
  const encodedToken = encodeURIComponent(JSON.stringify(token))
  return `${clean(token.baseUrl).replace(/\/+$/, '')}/api/admin/marketplace/facebook/posts/${encodeURIComponent(token.postId)}/assist?token=${encodedToken}`
}

export function buildAssistStatusUrl(token) {
  return buildAssistPayloadUrl(token)
}

export function createStatusBody(assistStatus, assistError = '') {
  return { assistStatus, assistError: clean(assistError) }
}

const imageList = (value) => {
  if (Array.isArray(value)) return value.map(clean).filter(Boolean)
  const raw = clean(value)
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) return parsed.map(clean).filter(Boolean)
  } catch {
    // Fall through to comma parsing.
  }
  return raw.split(',').map(clean).filter(Boolean)
}

const isHttpUrl = (value) => /^https?:\/\//i.test(clean(value))
const isLocalFilePath = (value) => /^[a-z]:[\\/]/i.test(clean(value)) || clean(value).startsWith('/') || clean(value).startsWith('.')

export function buildFacebookPhotoUploadPlan(payload = {}) {
  return imageList(payload.images).filter((item) => isHttpUrl(item) || isLocalFilePath(item))
}

export function buildFacebookFieldPlan(payload = {}) {
  return [
    { field: 'location', value: clean(payload.location), labels: ['Location'], interaction: 'suggestion' },
    { field: 'year', value: clean(payload.year), labels: ['Year'], interaction: 'option' },
    { field: 'make', value: clean(payload.make), labels: ['Make'], interaction: 'option' },
    { field: 'model', value: clean(payload.model), labels: ['Model'], interaction: 'option' },
    { field: 'title', value: clean(payload.title), labels: ['Title'] },
    { field: 'price', value: clean(payload.price), labels: ['Price', 'Enter your price'] },
    { field: 'mileage', value: clean(payload.mileage), labels: ['Mileage', 'Odometer'] },
    { field: 'vin', value: clean(payload.vin), labels: ['VIN'] },
    { field: 'exteriorColor', value: clean(payload.exteriorColor), labels: ['Exterior color', 'Exterior Color', 'Colour', 'Color'], interaction: 'option' },
    { field: 'transmission', value: clean(payload.transmission), labels: ['Transmission'], interaction: 'option' },
    { field: 'fuelType', value: clean(payload.fuelType), labels: ['Fuel type', 'Fuel Type'], interaction: 'option' },
    { field: 'description', value: clean(payload.description), labels: ['Description', 'Tell buyers anything'] },
  ].filter((item) => item.value)
}

export function buildFacebookControlLocatorKinds() {
  return ['label', 'placeholder', 'textbox', 'combobox', 'spinbutton', 'button', 'aria-input', 'visible-text']
}

export function formatAssistPlanSummary(payload = {}) {
  const photos = buildFacebookPhotoUploadPlan(payload).length
  const fields = buildFacebookFieldPlan(payload).map((item) => item.field)
  return `photos=${photos}; fields=${fields.length ? fields.join(', ') : 'none'}`
}

export function formatAssistFieldResults(results = []) {
  const missing = results
    .filter((item) => !item?.filled)
    .map((item) => clean(item?.field))
    .filter(Boolean)
  return missing.length ? `Needs manual input: ${missing.join(', ')}` : ''
}

const regexFor = (value) => new RegExp(clean(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')

const normalizeComparableValue = (value) => clean(value).replace(/\s+/g, ' ').toLowerCase()
const digitsOnly = (value) => clean(value).replace(/\D/g, '')

export function filledValueMatches(expected, actual) {
  const expectedText = normalizeComparableValue(expected)
  if (!expectedText) return true
  const actualText = normalizeComparableValue(actual)
  if (!actualText) return false
  if (/^\d+(?:\.\d+)?$/.test(expectedText)) return digitsOnly(actualText) === digitsOnly(expectedText)
  return actualText.includes(expectedText)
}

const readableControlValue = (node) => {
  if (!node) return ''
  const readValue = (element) => {
    const tagName = String(element?.tagName || '').toLowerCase()
    if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') return element.value || ''
    if (element?.isContentEditable) return element.innerText || element.textContent || ''
    return ''
  }
  const directValue = readValue(node)
  if (directValue) return directValue
  const nested = node.querySelector?.('input, textarea, select, [contenteditable="true"]')
  return readValue(nested)
}

const controlLocators = (page, label) => {
  const name = regexFor(label)
  return buildFacebookControlLocatorKinds().map((kind) => {
    if (kind === 'label') return page.getByLabel(label, { exact: false }).first()
    if (kind === 'placeholder') return page.getByPlaceholder(label, { exact: false }).first()
    if (kind === 'textbox') return page.getByRole('textbox', { name }).first()
    if (kind === 'combobox') return page.getByRole('combobox', { name }).first()
    if (kind === 'spinbutton') return page.getByRole('spinbutton', { name }).first()
    if (kind === 'button') return page.getByRole('button', { name }).first()
    if (kind === 'aria-input') return page.locator(`input[aria-label*="${label}" i], textarea[aria-label*="${label}" i]`).first()
    return page.getByText(label, { exact: true }).first()
  })
}

async function readLocatorValue(locator) {
  if (!(await locator.count().catch(() => 0))) return ''
  return locator.evaluate(readableControlValue).catch(() => '')
}

async function readActiveElementValue(page) {
  return page.evaluate(() => {
    const readValue = (element) => {
      const tagName = String(element?.tagName || '').toLowerCase()
      if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') return element.value || ''
      if (element?.isContentEditable) return element.innerText || element.textContent || ''
      return ''
    }
    const active = document.activeElement
    if (!active || active === document.body || active === document.documentElement) return ''
    return readValue(active)
  }).catch(() => '')
}

async function verifyFilledValue(page, locator, value) {
  const locatorValue = await readLocatorValue(locator)
  if (filledValueMatches(value, locatorValue)) return true
  const activeValue = await readActiveElementValue(page)
  return filledValueMatches(value, activeValue)
}

async function forceSetLocatorValue(locator, value) {
  if (!(await locator.count().catch(() => 0))) return false
  return locator.evaluate((node, nextValue) => {
    const findControl = (element) => {
      if (!element) return null
      if (element.matches?.('input, textarea, select, [contenteditable="true"]')) return element
      return element.querySelector?.('input, textarea, select, [contenteditable="true"]') || null
    }
    const control = findControl(node)
    if (!control) return false

    if (control.isContentEditable) {
      control.textContent = nextValue
    } else {
      const tagName = String(control.tagName || '').toLowerCase()
      const prototype = tagName === 'textarea'
        ? window.HTMLTextAreaElement?.prototype
        : tagName === 'select'
          ? window.HTMLSelectElement?.prototype
          : window.HTMLInputElement?.prototype
      const descriptor = prototype ? Object.getOwnPropertyDescriptor(prototype, 'value') : null
      if (descriptor?.set) descriptor.set.call(control, nextValue)
      else control.value = nextValue
    }

    control.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: nextValue }))
    control.dispatchEvent(new Event('change', { bubbles: true }))
    return true
  }, value).catch(() => false)
}

export async function tryFillLocator(page, locator, value) {
  if (!(await locator.count().catch(() => 0))) return false
  try {
    await locator.fill(value, { timeout: facebookActionTimeoutMs })
    await page.waitForTimeout(100).catch(() => {})
    if (await verifyFilledValue(page, locator, value)) return true
  } catch {
    // Fall through to keyboard-based input for Facebook's custom controls.
  }
  if (await forceSetLocatorValue(locator, value)) {
    await page.waitForTimeout(100).catch(() => {})
    if (await verifyFilledValue(page, locator, value)) return true
  }
  try {
    await locator.click({ timeout: facebookActionTimeoutMs })
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A')
    await page.keyboard.type(value)
    await page.waitForTimeout(100).catch(() => {})
    return verifyFilledValue(page, locator, value)
  } catch {
    return false
  }
}

async function tryClearAndFillFocusedControl(page, value) {
  try {
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A')
    await page.keyboard.press('Backspace')
    await page.keyboard.type(value)
    await page.waitForTimeout(100).catch(() => {})
    const activeValue = await readActiveElementValue(page)
    return filledValueMatches(value, activeValue)
  } catch {
    return false
  }
}

async function findAndFillControl(page, item) {
  for (const label of item.labels) {
    for (const locator of controlLocators(page, label)) {
      if (await tryFillLocator(page, locator, item.value)) return locator
    }
    try {
      await page.getByText(regexFor(label)).first().click({ timeout: facebookActionTimeoutMs })
      if (await tryClearAndFillFocusedControl(page, item.value)) return page.locator(':focus').first()
    } catch {
      // Try the next label.
    }
  }
  return null
}

export async function clickMatchingOption(page, value) {
  const name = regexFor(value)
  const option = page.getByRole('option', { name }).first()
  if (await option.count().catch(() => 0)) {
    try {
      await option.click({ timeout: facebookActionTimeoutMs })
      return true
    } catch {
      return false
    }
  }
  const text = page.getByText(name).first()
  if (await text.count().catch(() => 0)) {
    try {
      await text.click({ timeout: facebookActionTimeoutMs })
      return true
    } catch {
      return false
    }
  }
  return false
}

async function selectFacebookControlValue(page, item) {
  let opened = false
  for (const label of item.labels) {
    for (const locator of controlLocators(page, label)) {
      if (!(await locator.count().catch(() => 0))) continue
      try {
        await locator.click()
        opened = true
        break
      } catch {
        // Try the next locator.
      }
    }
    if (opened) break
  }
  if (!opened) return false
  if (await clickMatchingOption(page, item.value)) return true
  try {
    await page.keyboard.type(item.value)
    if (await clickMatchingOption(page, item.value)) return true
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('Enter')
    return true
  } catch {
    return false
  }
}

async function fillFacebookSuggestion(page, item) {
  const locator = await findAndFillControl(page, item)
  if (!locator) return false
  await page.waitForTimeout(500).catch(() => {})
  if (await clickMatchingOption(page, item.value)) return true
  try {
    await locator.press('ArrowDown')
    await locator.press('Enter')
    return true
  } catch {
    return true
  }
}

async function downloadImageToTemp(source) {
  const url = new URL(source)
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Image request failed (${response.status})`)
  const contentType = clean(response.headers.get('content-type')).toLowerCase()
  const extension = contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpg'
  const digest = createHash('sha1').update(source).digest('hex').slice(0, 12)
  const dir = path.join(os.tmpdir(), 'edc-facebook-assist-images')
  await mkdir(dir, { recursive: true })
  const filePath = path.join(dir, `${digest}.${extension}`)
  await writeFile(filePath, Buffer.from(await response.arrayBuffer()))
  return filePath
}

async function resolveUploadablePhotoFiles(sources = []) {
  const files = []
  for (const source of sources) {
    if (isHttpUrl(source)) {
      files.push(await downloadImageToTemp(source))
    } else if (existsSync(source)) {
      files.push(source)
    }
  }
  return files
}

async function uploadFacebookPhotos(page, payload) {
  const sources = buildFacebookPhotoUploadPlan(payload)
  if (!sources.length) return { field: 'photos', labels: ['Add photos'], filled: false }
  const files = await resolveUploadablePhotoFiles(sources)
  if (!files.length) return { field: 'photos', labels: ['Add photos'], filled: false }
  const input = page.locator('input[type="file"]').first()
  if (!(await input.count().catch(() => 0))) return { field: 'photos', labels: ['Add photos'], filled: false }
  await input.setInputFiles(files)
  return { field: 'photos', labels: ['Add photos'], filled: true }
}

export async function fillFacebookMarketplaceForm(page, payload) {
  const plan = buildFacebookFieldPlan(payload)
  console.log(`[assist] Payload plan: ${formatAssistPlanSummary(payload)}`)
  const results = [await uploadFacebookPhotos(page, payload)]
  console.log(`[assist] ${results[0].filled ? 'Filled' : 'Needs manual input'}: photos`)
  for (const item of plan) {
    let filled = false
    if (item.interaction === 'option') filled = await selectFacebookControlValue(page, item)
    else if (item.interaction === 'suggestion') filled = await fillFacebookSuggestion(page, item)
    else filled = Boolean(await findAndFillControl(page, item))
    if (!filled) console.warn(`Could not fill ${item.field}; Facebook may have changed this field.`)
    console.log(`[assist] ${filled ? 'Filled' : 'Needs manual input'}: ${item.field}`)
    results.push({ field: item.field, labels: item.labels, filled })
  }
  return results
}

export async function openFacebookMarketplace(payload, { browser = 'msedge', profileDir = defaultProfileDir } = {}) {
  const { chromium } = await import('playwright')
  const context = await chromium.launchPersistentContext(resolveProfileDir(profileDir), {
    channel: browser,
    headless: false,
  })
  const page = await context.newPage()
  await page.goto('https://www.facebook.com/marketplace/create/vehicle', { waitUntil: 'domcontentloaded' })
  const fieldResults = await fillFacebookMarketplaceForm(page, payload)
  return { context, page, fieldResults }
}

async function fetchJson(url) {
  const res = await fetch(url, { cache: 'no-store' })
  const json = await res.json().catch(() => null)
  if (!res.ok) throw new Error(json?.error || `Request failed (${res.status})`)
  return json
}

async function patchJson(url, body) {
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const json = await res.json().catch(() => null)
  if (!res.ok) throw new Error(json?.error || `Request failed (${res.status})`)
  return json
}

export async function runAssistOnce(args) {
  const token = requireLaunchToken(args)
  const payloadResponse = await fetchJson(buildAssistPayloadUrl(token))
  if (args.dryRun) {
    console.log(JSON.stringify(payloadResponse.payload, null, 2))
    return payloadResponse.payload
  }
  const assistResult = await openFacebookMarketplace(payloadResponse.payload, args)
  await patchJson(buildAssistStatusUrl(token), createStatusBody('needs_review', formatAssistFieldResults(assistResult.fieldResults)))
  return payloadResponse.payload
}

export function startRunnerServer({ port = 4777, browser = 'msedge', profileDir = defaultProfileDir, dryRun = false } = {}) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'no-store',
  }
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || '/', `http://127.0.0.1:${port}`)
    if (req.method === 'OPTIONS') {
      res.writeHead(204, corsHeaders)
      res.end()
      return
    }
    if (url.pathname === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json', ...corsHeaders })
      res.end(JSON.stringify({
        ok: true,
        service: 'easy-drive-facebook-assistant',
        browser,
        profileDir,
      }))
      return
    }
    if (url.pathname === '/assist') {
      try {
        const token = parseTokenValue(url.searchParams.get('token'))
        const payload = await runAssistOnce({ token, port, browser, profileDir, dryRun })
        res.writeHead(200, { 'Content-Type': 'text/plain', ...corsHeaders })
        res.end(`Assist request received for ${payload?.title || payload?.vehicleId || 'vehicle'}.`)
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'text/plain', ...corsHeaders })
        res.end(err instanceof Error ? err.message : 'Assist request failed.')
      }
      return
    }
    res.writeHead(404, { 'Content-Type': 'text/plain', ...corsHeaders })
    res.end('Not found')
  })
  server.listen(port, '127.0.0.1')
  return server
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (isCli) {
  const args = parseRunnerArgs(process.argv.slice(2))
  if (args.token) {
    runAssistOnce(args).catch((err) => {
      console.error(err instanceof Error ? err.message : 'Assist run failed.')
      process.exit(1)
    })
  } else {
    startRunnerServer(args)
    console.log(`Facebook Marketplace assistant ready on http://127.0.0.1:${args.port}`)
  }
}
