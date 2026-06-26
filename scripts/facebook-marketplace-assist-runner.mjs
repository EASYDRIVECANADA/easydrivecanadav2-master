#!/usr/bin/env node
import http from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { URL } from 'node:url'

const clean = (value) => String(value ?? '').trim()
const defaultProfileDir = '.facebook-assist-profile'

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
  return `${clean(token.baseUrl).replace(/\/+$/, '')}/api/admin/marketplace/facebook/posts/${encodeURIComponent(token.postId)}/assist`
}

export function buildAssistStatusUrl(token) {
  return buildAssistPayloadUrl(token)
}

export function createStatusBody(assistStatus, assistError = '') {
  return { assistStatus, assistError: clean(assistError) }
}

export function buildFacebookFieldPlan(payload = {}) {
  return [
    { field: 'title', value: clean(payload.title), labels: ['Title'] },
    { field: 'price', value: clean(payload.price), labels: ['Price'] },
    { field: 'description', value: clean(payload.description), labels: ['Description'] },
    { field: 'mileage', value: clean(payload.mileage), labels: ['Mileage', 'Odometer'] },
    { field: 'location', value: clean(payload.location), labels: ['Location'] },
    { field: 'vin', value: clean(payload.vin), labels: ['VIN'] },
  ].filter((item) => item.value)
}

export async function fillFacebookMarketplaceForm(page, payload) {
  const plan = buildFacebookFieldPlan(payload)
  for (const item of plan) {
    let filled = false
    for (const label of item.labels) {
      const locator = page.getByLabel(label, { exact: false }).first()
      if (await locator.count().catch(() => 0)) {
        await locator.fill(item.value)
        filled = true
        break
      }
    }
    if (!filled) console.warn(`Could not fill ${item.field}; Facebook may have changed this field.`)
  }
}

export async function openFacebookMarketplace(payload, { browser = 'msedge', profileDir = defaultProfileDir } = {}) {
  const { chromium } = await import('playwright')
  const context = await chromium.launchPersistentContext(resolveProfileDir(profileDir), {
    channel: browser,
    headless: false,
  })
  const page = await context.newPage()
  await page.goto('https://www.facebook.com/marketplace/create/vehicle', { waitUntil: 'domcontentloaded' })
  await fillFacebookMarketplaceForm(page, payload)
  return { context, page }
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
  await openFacebookMarketplace(payloadResponse.payload, args)
  await patchJson(buildAssistStatusUrl(token), createStatusBody('needs_review'))
  return payloadResponse.payload
}

export function startRunnerServer({ port = 4777, browser = 'msedge', profileDir = defaultProfileDir, dryRun = false } = {}) {
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || '/', `http://127.0.0.1:${port}`)
    if (url.pathname === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ ok: true }))
      return
    }
    if (url.pathname === '/assist') {
      try {
        const token = parseTokenValue(url.searchParams.get('token'))
        const payload = await runAssistOnce({ token, port, browser, profileDir, dryRun })
        res.writeHead(200, { 'Content-Type': 'text/plain' })
        res.end(`Assist request received for ${payload?.title || payload?.vehicleId || 'vehicle'}.`)
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'text/plain' })
        res.end(err instanceof Error ? err.message : 'Assist request failed.')
      }
      return
    }
    res.writeHead(404, { 'Content-Type': 'text/plain' })
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
