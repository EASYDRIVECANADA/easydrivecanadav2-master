import { createHmac } from 'node:crypto'

const clean = (value) => {
  if (value == null) return ''
  if (typeof value === 'object') {
    for (const key of ['label', 'value', 'name', 'title', 'text']) {
      const nested = clean(value[key])
      if (nested) return nested
    }
    return ''
  }
  return String(value).trim()
}
const lower = (value) => clean(value).toLowerCase()

const numberValue = (value) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  const parsed = Number(clean(value).replace(/[$,\s]/g, ''))
  return Number.isFinite(parsed) ? parsed : 0
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

const firstText = (...values) => values.map(clean).find(Boolean) || ''
const firstNumber = (...values) => values.map(numberValue).find((value) => value > 0) || 0

const absoluteSiteUrl = (siteUrl) => clean(siteUrl || process.env.NEXT_PUBLIC_SITE_URL || 'https://easydrivecanada.com').replace(/\/+$/, '')

const signaturePayload = (token = {}) => [
  clean(token.postId),
  clean(token.baseUrl),
  clean(token.issuedAt),
  clean(token.expiresAt),
].join('|')

function signAssistToken(token = {}, secret = '') {
  const key = clean(secret)
  if (!key) return ''
  return createHmac('sha256', key).update(signaturePayload(token)).digest('hex')
}

const vehicleTitle = (vehicle) =>
  [vehicle.year, vehicle.make, vehicle.model, vehicle.series || vehicle.trim]
    .map(clean)
    .filter(Boolean)
    .join(' ')

const vehicleLocation = (vehicle, fallback) => {
  const city = firstText(vehicle.city, vehicle.location_city)
  const province = firstText(vehicle.province, vehicle.location_province)
  if (city && province) return `${city}, ${province}`
  if (city) return city
  return clean(fallback)
}

const buildDescription = ({ vehicle, title, mileage, publicUrl }) => {
  const intro = firstText(vehicle.ad_description, vehicle.description, `${title} available at EasyDrive Canada.`)
  const specs = [
    mileage > 0 ? `Mileage: ${mileage.toLocaleString('en-CA')} km` : '',
    firstText(vehicle.transmission) ? `Transmission: ${firstText(vehicle.transmission)}` : '',
    firstText(vehicle.fuel_type, vehicle.fuelType) ? `Fuel: ${firstText(vehicle.fuel_type, vehicle.fuelType)}` : '',
    firstText(vehicle.drivetrain) ? `Drivetrain: ${firstText(vehicle.drivetrain)}` : '',
    firstText(vehicle.exterior_color, vehicle.exteriorColor, vehicle.color) ? `Exterior: ${firstText(vehicle.exterior_color, vehicle.exteriorColor, vehicle.color)}` : '',
    firstText(vehicle.stock_number, vehicle.stockNumber) ? `Stock: ${firstText(vehicle.stock_number, vehicle.stockNumber)}` : '',
    firstText(vehicle.vin) ? `VIN: ${firstText(vehicle.vin)}` : '',
  ].filter(Boolean)

  return [
    intro,
    specs.join('\n'),
    `Schedule a test drive or request more details: ${publicUrl}`,
  ].filter(Boolean).join('\n\n')
}

export function buildFacebookMarketplacePayload(vehicle = {}, options = {}) {
  const id = clean(vehicle.id || vehicle.vehicle_id || vehicle.vehicleId)
  const title = vehicleTitle(vehicle)
  const siteUrl = absoluteSiteUrl(options.siteUrl)
  const publicUrl = id ? `${siteUrl}/inventory/${encodeURIComponent(id)}` : siteUrl
  const price = firstNumber(vehicle.retail_price, vehicle.retailPrice, vehicle.price, vehicle.finance_price, vehicle.financePrice)
  const mileage = firstNumber(vehicle.mileage, vehicle.odometer)
  const location = vehicleLocation(vehicle, options.defaultLocation)
  const images = [
    ...imageList(vehicle.images),
    ...imageList(vehicle.image_urls),
    ...imageList(vehicle.photos),
    ...imageList(vehicle.image),
  ].filter((value, index, arr) => arr.indexOf(value) === index).slice(0, 20)

  return {
    vehicleId: id,
    userId: clean(vehicle.user_id || vehicle.userId),
    year: clean(vehicle.year),
    make: clean(vehicle.make),
    model: clean(vehicle.model),
    trim: clean(vehicle.series || vehicle.trim),
    title,
    price,
    mileage,
    location,
    description: buildDescription({ vehicle, title, mileage, publicUrl }),
    images,
    exteriorColor: firstText(vehicle.exterior_color, vehicle.exteriorColor, vehicle.color),
    transmission: firstText(vehicle.transmission),
    fuelType: firstText(vehicle.fuel_type, vehicle.fuelType),
    drivetrain: firstText(vehicle.drivetrain),
    publicUrl,
    vin: clean(vehicle.vin),
    stockNumber: clean(vehicle.stock_number || vehicle.stockNumber),
    vehicleStatus: clean(vehicle.status),
    vehicleUpdatedAt: clean(vehicle.updated_at || vehicle.updatedAt),
  }
}

export function scoreFacebookMarketplaceReadiness(payload = {}) {
  const checks = [
    { key: 'title', label: 'Title', passed: clean(payload.title).split(/\s+/).length >= 3 },
    { key: 'price', label: 'Price', passed: numberValue(payload.price) > 0 },
    { key: 'mileage', label: 'Mileage', passed: numberValue(payload.mileage) > 0 },
    { key: 'location', label: 'Location', passed: Boolean(clean(payload.location)) },
    { key: 'description', label: 'Description', passed: clean(payload.description).length >= 40 },
    { key: 'images', label: 'Photos', passed: imageList(payload.images).length > 0 },
  ]
  const missing = checks.filter((check) => !check.passed).map((check) => check.key)
  return {
    ready: missing.length === 0,
    status: missing.length === 0 ? 'ready' : 'needs_info',
    missing,
    checks,
    score: Math.round((checks.filter((check) => check.passed).length / checks.length) * 100),
  }
}

export function resolveFacebookMarketplaceStatus({ vehicle = {}, post = null, readiness = {} } = {}) {
  const current = lower(post?.status)
  const vehicleStatus = lower(vehicle.status || vehicle.vehicleStatus)
  const hasPostedUrl = Boolean(clean(post?.facebook_listing_url || post?.facebookListingUrl))
  if (['sold', 'void', 'pending', 'deal pending'].includes(vehicleStatus) && (current === 'posted' || hasPostedUrl)) return 'sold_remove'
  if (current) return current
  return readiness.ready ? 'ready' : 'draft'
}

export function mergeFacebookPostRow(payload = {}, post = null) {
  const merged = {
    ...payload,
    postId: clean(post?.id),
    title: firstText(post?.posting_title, payload.title),
    description: firstText(post?.posting_description, payload.description),
    price: firstNumber(post?.posting_price, payload.price),
    location: firstText(post?.posting_location, payload.location),
    facebookListingUrl: clean(post?.facebook_listing_url),
    notes: clean(post?.notes),
    postedAt: clean(post?.posted_at),
    assistStatus: clean(post?.assist_status),
    assistStartedAt: clean(post?.assist_started_at),
    assistCompletedAt: clean(post?.assist_completed_at),
    assistError: clean(post?.assist_error),
    lastPreparedAt: clean(post?.last_prepared_at),
    createdAt: clean(post?.created_at),
    updatedAt: clean(post?.updated_at),
  }
  const readiness = scoreFacebookMarketplaceReadiness(merged)
  return {
    ...merged,
    readiness,
    status: resolveFacebookMarketplaceStatus({ vehicle: payload, post, readiness }),
  }
}

export function buildFacebookPostInsert(payload = {}, readiness = scoreFacebookMarketplaceReadiness(payload), nowIso = new Date().toISOString()) {
  return {
    vehicle_id: clean(payload.vehicleId),
    user_id: clean(payload.userId) || null,
    status: readiness.ready ? 'ready' : 'draft',
    posting_title: clean(payload.title) || null,
    posting_description: clean(payload.description) || null,
    posting_price: numberValue(payload.price) || null,
    posting_location: clean(payload.location) || null,
    posting_payload: payload,
    readiness,
    last_prepared_at: nowIso,
    updated_at: nowIso,
  }
}

export const ASSIST_STATUS_OPTIONS = [
  { value: 'not_started', label: 'Not started' },
  { value: 'started', label: 'Started' },
  { value: 'needs_review', label: 'Needs review' },
  { value: 'failed', label: 'Failed' },
  { value: 'cancelled', label: 'Cancelled' },
]

const ASSIST_STATUS_VALUES = new Set(ASSIST_STATUS_OPTIONS.map((item) => item.value))

export function normalizeFacebookAssistStatus(value) {
  const normalized = lower(value).replace(/[\s-]+/g, '_')
  return normalized || 'not_started'
}

export function isValidFacebookAssistStatus(value) {
  return ASSIST_STATUS_VALUES.has(normalizeFacebookAssistStatus(value))
}

export function buildFacebookAssistPayloadFromPost({ post = {}, rawPayload = {}, freshVehiclePayload = {} } = {}) {
  return buildFacebookAssistPayload({
    ...rawPayload,
    ...freshVehiclePayload,
    postId: post.id,
    title: firstText(post.posting_title, freshVehiclePayload.title, rawPayload.title),
    description: firstText(post.posting_description, freshVehiclePayload.description, rawPayload.description),
    price: firstNumber(post.posting_price, freshVehiclePayload.price, rawPayload.price),
    location: firstText(post.posting_location, freshVehiclePayload.location, rawPayload.location),
  })
}

export function buildFacebookAssistPayload(row = {}) {
  return {
    postId: clean(row.postId || row.id),
    vehicleId: clean(row.vehicleId || row.vehicle_id),
    year: clean(row.year),
    make: clean(row.make),
    model: clean(row.model),
    trim: clean(row.trim),
    title: firstText(row.title, row.posting_title),
    description: firstText(row.description, row.posting_description),
    price: firstNumber(row.price, row.posting_price),
    mileage: numberValue(row.mileage),
    location: clean(row.location || row.posting_location),
    vin: clean(row.vin),
    stockNumber: clean(row.stockNumber || row.stock_number),
    exteriorColor: clean(row.exteriorColor || row.exterior_color || row.color),
    transmission: clean(row.transmission),
    fuelType: clean(row.fuelType || row.fuel_type),
    drivetrain: clean(row.drivetrain),
    images: imageList(row.images),
    publicUrl: clean(row.publicUrl),
    finalSubmitRequired: true,
  }
}

export function buildFacebookAssistLaunchToken({ postId, baseUrl, issuedAt = new Date().toISOString(), ttlSeconds = 600, secret = '' } = {}) {
  const issued = new Date(issuedAt)
  const expires = new Date(issued.getTime() + Number(ttlSeconds || 600) * 1000)
  const token = {
    postId: clean(postId),
    baseUrl: absoluteSiteUrl(baseUrl),
    issuedAt: issued.toISOString(),
    expiresAt: expires.toISOString(),
  }
  const signature = signAssistToken(token, secret)
  return signature ? { ...token, signature } : token
}

export function verifyFacebookAssistLaunchToken(token = {}, nowIso = new Date().toISOString(), secret = '') {
  const postId = clean(token.postId)
  const baseUrl = clean(token.baseUrl)
  const expiresAt = Date.parse(token.expiresAt)
  const now = Date.parse(nowIso)
  if (!postId) return { valid: false, reason: 'missing_post_id' }
  if (!baseUrl) return { valid: false, reason: 'missing_base_url' }
  if (!Number.isFinite(expiresAt)) return { valid: false, reason: 'missing_expiry' }
  if (Number.isFinite(now) && now > expiresAt) return { valid: false, reason: 'expired' }
  if (clean(secret)) {
    const expected = signAssistToken(token, secret)
    if (!expected || clean(token.signature) !== expected) return { valid: false, reason: 'bad_signature' }
  }
  return { valid: true, reason: '' }
}

export function normalizeFacebookListingUrl(value) {
  const raw = clean(value)
  if (!raw) return ''
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw.replace(/^\/+/, '')}`
  try {
    const url = new URL(withScheme)
    const host = url.hostname.toLowerCase()
    const allowedHost = ['facebook.com', 'www.facebook.com', 'm.facebook.com'].includes(host)
    if (!allowedHost || !/^\/marketplace\/item\/[^/]+\/?/i.test(url.pathname)) return ''
    if (host === 'facebook.com') url.hostname = 'www.facebook.com'
    return url.toString()
  } catch {
    return ''
  }
}

export function isValidFacebookListingUrl(value) {
  return Boolean(normalizeFacebookListingUrl(value))
}

export function vehicleMatchesFacebookSearch(row = {}, query = '') {
  const q = lower(query)
  if (!q) return true
  const haystack = [
    row.title,
    row.description,
    row.vehicleId,
    row.vin,
    row.stockNumber,
    row.status,
    row.vehicleStatus,
    row.location,
  ].map(lower).join(' ')
  return q.split(/\s+/).filter(Boolean).every((term) => haystack.includes(term))
}
