const clean = (value) => String(value ?? '').trim()
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
    title,
    price,
    mileage,
    location,
    description: buildDescription({ vehicle, title, mileage, publicUrl }),
    images,
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
