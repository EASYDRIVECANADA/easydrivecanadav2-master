import { load } from 'cheerio'

export const DRIVETOWN_BASE_URL = 'https://drivetownottawa.com'
export const DRIVETOWN_INVENTORY_URL = `${DRIVETOWN_BASE_URL}/vehicles/`

const clean = (value) => String(value ?? '').replace(/\s+/g, ' ').trim()

export function cleanNumber(value) {
  const raw = clean(value).replace(/[^0-9.]/g, '')
  if (!raw) return null
  const num = Number(raw)
  return Number.isFinite(num) ? num : null
}

const absoluteUrl = (href, baseUrl = DRIVETOWN_INVENTORY_URL) => {
  try {
    return new URL(href, baseUrl).toString()
  } catch {
    return ''
  }
}

const unique = (items) => [...new Set(items.filter(Boolean))]

const nestedName = (value) => clean(value?.name || value)

const stripHtml = (value) => {
  const $ = load(clean(value))
  return clean($.text())
}

const normalizeDriveType = (value) => {
  const raw = nestedName(value)
  if (/4[-\s]?wheel|4wd/i.test(raw)) return '4WD'
  if (/all[-\s]?wheel|awd/i.test(raw)) return 'AWD'
  if (/front[-\s]?wheel|fwd/i.test(raw)) return 'FWD'
  if (/rear[-\s]?wheel|rwd/i.test(raw)) return 'RWD'
  return raw
}

const bestPhotoUrl = (photo) => clean(photo?.web_paths?.xl || photo?.web_paths?.lg || photo?.web_paths?.md || photo?.url)

const sourcePriceTypeName = (price) => clean(price?.type?.name || price?.type)

const sourcePriceAmount = (price) => cleanNumber(price?.amount)

const sourcePriceByType = (item, typeName) => {
  const target = clean(typeName).toLowerCase()
  const found = (Array.isArray(item?.prices) ? item.prices : [])
    .find((price) => sourcePriceTypeName(price).toLowerCase() === target)
  return sourcePriceAmount(found)
}

const compactPricePayload = (item) => {
  const payload = {}
  for (const key of ['price', 'sale_price', 'lowest_price', 'lowest_price_with_incentives', 'adjusted_finance_price']) {
    const value = cleanNumber(item?.[key])
    if (value != null) payload[key] = value
  }

  const prices = (Array.isArray(item?.prices) ? item.prices : [])
    .map((price) => ({
      type: sourcePriceTypeName(price),
      amount: sourcePriceAmount(price),
    }))
    .filter((price) => price.type && price.amount != null && price.type.toLowerCase() !== 'cost')

  if (prices.length > 0) payload.prices = prices
  return payload
}

function normalizeInventoryItem(item, sourceUrl = '') {
  const title = clean(item?.title)
  const titleParts = inferTitleParts(title)
  const price = cleanNumber(item?.sale_price ?? item?.lowest_price ?? item?.price)
  const financePrice = sourcePriceByType(item, 'Financed Price') ?? cleanNumber(item?.adjusted_finance_price)
  const itemId = clean(item?.id)

  return {
    sourceName: 'DriveTown Ottawa',
    sourceUrl,
    sourceVehicleId: itemId,
    title,
    year: titleParts.year,
    make: nestedName(item?.make) || titleParts.make,
    model: nestedName(item?.model) || titleParts.model,
    trim: nestedName(item?.trim) || titleParts.trim,
    vin: clean(item?.vin).toUpperCase(),
    stockNumber: clean(item?.stock_num),
    price,
    retailPrice: sourcePriceByType(item, 'Retail') ?? cleanNumber(item?.price),
    financePrice,
    financePriceText: financePrice ? `$${financePrice}` : null,
    sourcePricePayload: compactPricePayload(item),
    mileage: cleanNumber(item?.odometer?.amount),
    transmission: nestedName(item?.transmission_type),
    drivetrain: normalizeDriveType(item?.drive_type),
    fuelType: nestedName(item?.fuel_type),
    bodyStyle: nestedName(item?.category),
    exteriorColor: nestedName(item?.ext_colour),
    interiorColor: nestedName(item?.int_colour),
    description: stripHtml(item?.description),
    features: [],
    imageUrls: unique((Array.isArray(item?.photos) ? item.photos : []).map(bestPhotoUrl)),
  }
}

function parseInventoryItems($, detailUrls) {
  const raw = $('#dsp-filters').attr('data-inventory')
  if (!raw) return []

  try {
    const inventory = JSON.parse(raw)
    const items = Array.isArray(inventory?.items) ? inventory.items : []
    return items.map((item) => {
      const id = clean(item?.id)
      const sourceUrl = detailUrls.find((url) => url.endsWith(`/${id}`) || url.endsWith(`/${id}/`)) || ''
      return normalizeInventoryItem(item, sourceUrl)
    })
  } catch {
    return []
  }
}

export function parseDriveTownListing(html, pageUrl = DRIVETOWN_INVENTORY_URL) {
  const $ = load(html)
  const bodyText = clean($('body').text())
  const totalMatch = bodyText.match(/of\s+([0-9,]+)\s+vehicles/i)
  const totalCount = totalMatch ? cleanNumber(totalMatch[1]) : null

  const detailUrls = unique(
    $('a[href]')
      .toArray()
      .map((el) => absoluteUrl($(el).attr('href'), pageUrl))
      .filter((url) => {
        return /^https:\/\/drivetownottawa\.com\/inventory\/[^/?#]+\/[0-9]+\/?$/i.test(url)
      })
  )

  const vehicles = parseInventoryItems($, detailUrls)

  return { detailUrls, totalCount, vehicles }
}

const dlValue = ($, label) => {
  const target = label.toLowerCase()
  let found = ''
  $('dt').each((_, el) => {
    if (found) return
    const key = clean($(el).text()).toLowerCase()
    if (key === target || key.replace(/[#:]/g, '').trim() === target.replace(/[#:]/g, '').trim()) {
      found = clean($(el).next('dd').text())
    }
  })
  return found
}

const inferTitleParts = (title) => {
  const parts = clean(title).split(/\s+/)
  const year = Number(parts[0])
  const make = parts[1] || ''
  const model = parts[2] || ''
  const trim = parts.slice(3).join(' ')
  return {
    year: Number.isInteger(year) ? year : null,
    make,
    model,
    trim: trim || null,
  }
}

export function parseDriveTownDetail(html, detailUrl) {
  const $ = load(html)
  const title = clean($('h1').first().text() || $('meta[property="og:title"]').attr('content'))
  const titleParts = inferTitleParts(title)

  const imageUrls = unique([
    $('meta[property="og:image"]').attr('content'),
    ...$('img[src]').toArray().map((el) => $(el).attr('src')),
  ].map((src) => absoluteUrl(src, detailUrl)))

  const features = unique($('.features li, [class*="feature"] li')
    .toArray()
    .map((el) => clean($(el).text())))

  const description = clean($('.description, [class*="description"]').first().text())

  return {
    sourceName: 'DriveTown Ottawa',
    sourceUrl: detailUrl,
    sourceVehicleId: detailUrl.split('/').filter(Boolean).pop() || detailUrl,
    title,
    year: titleParts.year,
    make: titleParts.make,
    model: titleParts.model,
    trim: titleParts.trim,
    vin: clean(dlValue($, 'VIN')).toUpperCase(),
    stockNumber: clean(dlValue($, 'Stock #') || dlValue($, 'Stock')),
    price: cleanNumber($('.price, [class*="price"]').first().text()),
    financePriceText: clean($('.finance, [class*="finance"]').first().text()) || null,
    mileage: cleanNumber(dlValue($, 'Mileage')),
    transmission: dlValue($, 'Transmission'),
    drivetrain: dlValue($, 'Drivetrain'),
    fuelType: dlValue($, 'Fuel Type'),
    bodyStyle: dlValue($, 'Body Style'),
    exteriorColor: dlValue($, 'Exterior Colour') || dlValue($, 'Exterior Color'),
    interiorColor: dlValue($, 'Interior Colour') || dlValue($, 'Interior Color'),
    description,
    features,
    imageUrls,
  }
}

export async function fetchText(url, fetchImpl = fetch) {
  const res = await fetchImpl(url, {
    headers: {
      'user-agent': 'EasyDriveCanadaBot/1.0 (+https://easydrivecanada.com)',
      accept: 'text/html,application/xhtml+xml',
    },
  })
  if (!res.ok) throw new Error(`GET ${url} failed with ${res.status}`)
  return res.text()
}

export function inventoryPageUrl(pageNumber, inventoryUrl = DRIVETOWN_INVENTORY_URL) {
  if (pageNumber <= 1) return inventoryUrl
  const url = new URL(inventoryUrl)
  url.searchParams.set('dsp_page', String(pageNumber))
  return url.toString()
}

export async function discoverDriveTownDetailUrls({
  fetchImpl = fetch,
  inventoryUrl = DRIVETOWN_INVENTORY_URL,
  maxPages = 20,
} = {}) {
  const allUrls = []
  const allVehicles = []
  let totalCount = null

  for (let pageNumber = 1; pageNumber <= maxPages; pageNumber += 1) {
    const pageUrl = inventoryPageUrl(pageNumber, inventoryUrl)
    const html = await fetchText(pageUrl, fetchImpl)
    const parsed = parseDriveTownListing(html, pageUrl)
    if (parsed.totalCount && !totalCount) totalCount = parsed.totalCount

    const before = allUrls.length
    for (const url of parsed.detailUrls) {
      if (!allUrls.includes(url)) allUrls.push(url)
    }
    for (const vehicle of parsed.vehicles || []) {
      if (vehicle.sourceUrl && !allVehicles.some((existing) => existing.sourceUrl === vehicle.sourceUrl)) {
        allVehicles.push(vehicle)
      }
    }

    if (totalCount && allUrls.length >= totalCount) break
    if (allUrls.length === before && pageNumber > 1) break
  }

  return {
    detailUrls: allUrls,
    vehicles: allVehicles,
    totalCount,
    completeListing: allUrls.length > 0 && (!totalCount || allUrls.length >= totalCount),
  }
}

export async function scrapeDriveTownInventory({ fetchImpl = fetch, inventoryUrl = DRIVETOWN_INVENTORY_URL } = {}) {
  const listing = await discoverDriveTownDetailUrls({ fetchImpl, inventoryUrl })
  if (listing.vehicles.length > 0) {
    return {
      completeListing: listing.completeListing,
      totalCount: listing.totalCount,
      detailUrls: listing.detailUrls,
      vehicles: listing.vehicles,
      failures: [],
    }
  }

  const vehicles = []
  const failures = []

  for (const detailUrl of listing.detailUrls) {
    try {
      const detailHtml = await fetchText(detailUrl, fetchImpl)
      vehicles.push(parseDriveTownDetail(detailHtml, detailUrl))
    } catch (error) {
      failures.push({ url: detailUrl, error: error instanceof Error ? error.message : String(error) })
    }
  }

  return {
    completeListing: listing.completeListing,
    totalCount: listing.totalCount,
    detailUrls: listing.detailUrls,
    vehicles,
    failures,
  }
}
