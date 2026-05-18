const text = (value, fallback = '') => {
  const normalized = String(value ?? '').trim()
  return normalized || fallback
}

const lower = (value) => text(value).toLowerCase()

const numberValue = (value) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  const parsed = Number(String(value ?? '').replace(/[$,\s]/g, ''))
  return Number.isFinite(parsed) ? parsed : 0
}

const arrayFrom = (value) => {
  if (Array.isArray(value)) return value.map((item) => text(item)).filter(Boolean)
  const raw = text(value)
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) return parsed.map((item) => text(item)).filter(Boolean)
  } catch {
    // Fall through to delimiter parsing.
  }
  return raw.split('|').join(',').split(',').map((item) => item.trim()).filter(Boolean)
}

export function normalizeVehicleCategory(vehicle = {}) {
  const raw = lower(vehicle.categories || vehicle.category || vehicle.inventory_type || vehicle.inventoryType)
  if (raw.includes('private')) return 'private'
  if (raw.includes('dealer') || raw.includes('dealership')) return 'dealership'
  if (raw.includes('premier') || raw.includes('premiere')) return 'premier'
  if (raw.includes('fleet')) return 'fleet'
  return raw || 'uncategorized'
}

const hasCheckoutBosSignature = (submission = {}) => {
  const signature = submission?.order_data?.signatures?.billOfSaleCustomer || {}
  return Boolean(text(signature.drawnDataUrl) || text(signature.typedName))
}

const check = (condition, key, label) => ({
  key,
  label,
  passed: Boolean(condition),
})

export function scoreInventoryReadiness(vehicle = {}) {
  const category = normalizeVehicleCategory(vehicle)
  const mileage = numberValue(vehicle.odometer ?? vehicle.mileage)
  const checks = [
    check(numberValue(vehicle.photo_count ?? vehicle.photoCount) > 0 || arrayFrom(vehicle.images).length > 0 || arrayFrom(vehicle.photos).length > 0, 'photos', 'Photos'),
    check(numberValue(vehicle.price) > 0 || numberValue(vehicle.sale_price ?? vehicle.salePrice) > 0, 'price', 'Price'),
    check(text(vehicle.vin).length >= 6, 'vin', 'VIN'),
    check(mileage > 0, 'mileage', 'Mileage'),
    check(numberValue(vehicle.carfax_count ?? vehicle.carfaxCount) > 0 || arrayFrom(vehicle.carfax_files ?? vehicle.carfaxFiles).length > 0, 'carfax', 'CARFAX'),
    check(numberValue(vehicle.disclosure_count ?? vehicle.disclosureCount) > 0 || text(vehicle.disclosures_complete).toLowerCase() === 'true', 'disclosures', 'Disclosures'),
    check(Boolean(text(vehicle.categories || vehicle.category || vehicle.inventory_type || vehicle.inventoryType)), 'category', 'Listing category'),
    check(Boolean(text(vehicle.status)), 'status', 'Status'),
    check(!['sold', 'void'].includes(lower(vehicle.status)), 'availability', 'Available for publishing'),
    check(Boolean(text(vehicle.make) && text(vehicle.model) && numberValue(vehicle.year)), 'metadata', 'Search metadata'),
  ]
  const passed = checks.filter((item) => item.passed).length
  return {
    id: text(vehicle.id),
    category,
    score: Math.round((passed / checks.length) * 100),
    missing: checks.filter((item) => !item.passed).map((item) => item.key),
    checks,
    label: [vehicle.year, vehicle.make, vehicle.model, vehicle.trim].map((value) => text(value)).filter(Boolean).join(' '),
    href: `/admin/inventory/${encodeURIComponent(text(vehicle.id))}`,
  }
}

export function scoreDealReadiness(submission = {}) {
  const carfaxFiles = arrayFrom(submission.carfax_files ?? submission.carfaxFiles)
  const hasPackage = lower(submission.document_package_status) === 'ready' && Boolean(text(submission.bos_pdf_url))
  const checks = [
    check(Boolean(text(submission.customer_first_name || submission.first_name) && text(submission.customer_last_name || submission.last_name) && text(submission.customer_email || submission.email)), 'customer', 'Customer info'),
    check(Boolean(text(submission.vehicle_id) && text(submission.vehicle_make || submission.make) && text(submission.vehicle_model || submission.model) && numberValue(submission.vehicle_year || submission.year)), 'vehicle', 'Vehicle info'),
    check(hasCheckoutBosSignature(submission), 'signature', 'BOS signature'),
    check(numberValue(submission.total_price ?? submission.vehicle_price ?? submission.price) > 0, 'worksheet', 'Worksheet totals'),
    check(hasPackage, 'document_package', 'Document package'),
    check(carfaxFiles.length > 0 || lower(submission.carfax_status) === 'unavailable', 'carfax', 'CARFAX'),
  ]
  const passed = checks.filter((item) => item.passed).length
  const score = Math.round((passed / checks.length) * 100)
  return {
    id: text(submission.id),
    score,
    status: score === 100 ? 'ready' : lower(submission.document_package_status) === 'failed' ? 'blocked' : 'needs_review',
    missing: checks.filter((item) => !item.passed).map((item) => item.key),
    checks,
    label: [submission.vehicle_year, submission.vehicle_make, submission.vehicle_model, submission.vehicle_trim].map((value) => text(value)).filter(Boolean).join(' '),
    customer: [submission.customer_first_name, submission.customer_last_name].map((value) => text(value)).filter(Boolean).join(' '),
  }
}

export function buildVehicleSearchText(vehicle = {}) {
  return [
    vehicle.year,
    vehicle.make,
    vehicle.model,
    vehicle.trim,
    vehicle.series,
    vehicle.stock_number,
    vehicle.stockNumber,
    vehicle.vin,
    vehicle.body_style,
    vehicle.bodyStyle,
    vehicle.drivetrain,
    vehicle.transmission,
    vehicle.fuel_type,
    vehicle.fuelType,
    vehicle.exterior_color,
    vehicle.exteriorColor,
    vehicle.interior_color,
    vehicle.interiorColor,
    normalizeVehicleCategory(vehicle),
    vehicle.status,
    vehicle.description,
    vehicle.ad_description,
    arrayFrom(vehicle.features).join(' '),
    numberValue(vehicle.carfax_count ?? vehicle.carfaxCount) > 0 ? 'carfax clean history report' : '',
  ].map((value) => text(value).toLowerCase()).filter(Boolean).join(' ')
}

export function buildVehicleJsonLd(vehicle = {}, { siteUrl = 'https://easydrivecanada.com', imageUrl = '' } = {}) {
  const id = text(vehicle.id || vehicle.vehicleId || vehicle.vehicle_id)
  const baseUrl = text(siteUrl, 'https://easydrivecanada.com').replace(/\/+$/, '')
  const name = [vehicle.year, vehicle.make, vehicle.model, vehicle.trim || vehicle.series].map((value) => text(value)).filter(Boolean).join(' ')
  const mileage = numberValue(vehicle.odometer ?? vehicle.mileage)
  const price = numberValue(vehicle.price ?? vehicle.sale_price ?? vehicle.salePrice)
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Vehicle',
    name,
    url: id ? `${baseUrl}/inventory/${encodeURIComponent(id)}` : baseUrl,
    brand: text(vehicle.make),
    model: [vehicle.model, vehicle.trim || vehicle.series].map((value) => text(value)).filter(Boolean).join(' '),
    vehicleModelDate: text(vehicle.year),
    vehicleIdentificationNumber: text(vehicle.vin),
    color: text(vehicle.exterior_color || vehicle.exteriorColor),
    bodyType: text(vehicle.body_style || vehicle.bodyStyle),
    vehicleTransmission: text(vehicle.transmission),
    fuelType: text(vehicle.fuel_type || vehicle.fuelType),
    driveWheelConfiguration: text(vehicle.drivetrain),
    mileageFromOdometer: mileage > 0 ? {
      '@type': 'QuantitativeValue',
      value: mileage,
      unitCode: lower(vehicle.odometer_unit || vehicle.odometerUnit).includes('mile') ? 'SMI' : 'KMT',
    } : undefined,
    image: text(imageUrl) || undefined,
    offers: price > 0 ? {
      '@type': 'Offer',
      price,
      priceCurrency: 'CAD',
      availability: lower(vehicle.status).includes('sold') ? 'https://schema.org/SoldOut' : 'https://schema.org/InStock',
      url: id ? `${baseUrl}/inventory/${encodeURIComponent(id)}` : baseUrl,
    } : undefined,
    vehicleHistoryReport: numberValue(vehicle.carfax_count ?? vehicle.carfaxCount) > 0 || arrayFrom(vehicle.carfax_files ?? vehicle.carfaxFiles).length > 0
      ? `${baseUrl}/inventory/${encodeURIComponent(id)}#carfax`
      : undefined,
  }

  return Object.fromEntries(Object.entries(jsonLd).filter(([, value]) => value !== undefined && value !== ''))
}

const parseMaxPrice = (query) => {
  const raw = lower(query).replace(/,/g, '')
  const match = raw.match(/\b(?:under|below|less than|max|up to)\s*\$?\s*(\d+(?:\.\d+)?)\s*(k)?\b/)
  if (!match) return null
  const amount = Number(match[1])
  if (!Number.isFinite(amount)) return null
  return match[2] ? amount * 1000 : amount
}

const stripConstraintWords = (query) =>
  lower(query)
    .replace(/\b(?:under|below|less than|max|up to)\s*\$?\s*\d+(?:\.\d+)?\s*k?\b/g, ' ')
    .replace(/\b(with|and|or|a|an|the|vehicle|car|cars|clean)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

export function vehicleMatchesSearch(vehicle = {}, query = '') {
  const raw = lower(query)
  if (!raw) return true
  const maxPrice = parseMaxPrice(raw)
  if (maxPrice !== null && numberValue(vehicle.price ?? vehicle.sale_price ?? vehicle.salePrice) > maxPrice) return false
  if (raw.includes('carfax') && numberValue(vehicle.carfax_count ?? vehicle.carfaxCount) <= 0 && arrayFrom(vehicle.carfax_files ?? vehicle.carfaxFiles).length === 0) return false

  const searchText = buildVehicleSearchText(vehicle)
  const terms = stripConstraintWords(raw)
    .split(/\s+/)
    .map((term) => term.trim())
    .filter((term) => term && !/^\d+k?$/.test(term))

  return terms.every((term) => searchText.includes(term))
}

const ageHours = (nowMs, value) => {
  const ts = Date.parse(text(value))
  if (!Number.isFinite(ts)) return 0
  return Math.max(0, (nowMs - ts) / 36e5)
}

const task = (type, title, detail, href, severity = 'medium', createdAt = '') => ({
  id: `${type}:${href}:${title}`.replace(/\s+/g, '_').toLowerCase(),
  type,
  title,
  detail,
  href,
  severity,
  createdAt,
})

export function buildAdminOpsTasks({ submissions = [], vehicles = [], leads = [], nowIso = new Date().toISOString() } = {}) {
  const nowMs = Date.parse(nowIso)
  const tasks = []

  for (const submission of submissions) {
    const status = lower(submission.status)
    const vehicleLabel = [submission.vehicle_year, submission.vehicle_make, submission.vehicle_model].map((value) => text(value)).filter(Boolean).join(' ') || 'vehicle'
    const customer = [submission.customer_first_name, submission.customer_last_name].map((value) => text(value)).filter(Boolean).join(' ') || text(submission.customer_email, 'customer')
    if (['submitted', 'pending', 'new'].includes(status)) {
      tasks.push(task('purchase_submitted', 'Review checkout submission', `${customer} submitted a purchase for ${vehicleLabel}.`, '/admin/sales/deals', 'high', text(submission.submitted_at)))
    }
    if (status === 'approved' && lower(submission.document_package_status) === 'failed') {
      tasks.push(task('document_package_failed', 'Regenerate document package', `${vehicleLabel} has an approved purchase but the customer package failed.`, '/admin/sales/deals', 'high', text(submission.updated_at || submission.submitted_at)))
    } else if (status === 'approved' && !text(submission.document_package_token) && !text(submission.bos_pdf_url)) {
      tasks.push(task('document_package_missing', 'Create customer document package', `${vehicleLabel} is approved but has no BOS package link.`, '/admin/sales/deals', 'medium', text(submission.updated_at || submission.submitted_at)))
    }
  }

  for (const vehicle of vehicles) {
    const readiness = scoreInventoryReadiness(vehicle)
    const vehicleLabel = readiness.label || 'Vehicle'
    if (readiness.missing.includes('carfax')) {
      tasks.push(task('vehicle_missing_carfax', 'Add CARFAX', `${vehicleLabel} is missing a CARFAX file.`, readiness.href, 'medium', text(vehicle.updated_at || vehicle.created_at)))
    }
    if (readiness.missing.includes('photos')) {
      tasks.push(task('vehicle_missing_photos', 'Add vehicle photos', `${vehicleLabel} needs publishable photos.`, readiness.href, 'medium', text(vehicle.updated_at || vehicle.created_at)))
    }
    if (lower(vehicle.status) === 'sold' && !text(vehicle.sold_at || vehicle.updated_at)) {
      tasks.push(task('sold_vehicle_visible', 'Review sold vehicle visibility', `${vehicleLabel} is sold and should not appear in active browsing.`, readiness.href, 'low', text(vehicle.updated_at || vehicle.created_at)))
    }
  }

  for (const lead of leads) {
    const status = lower(lead.manager_status || lead.status)
    if (!['closed', 'lost', 'contacted', 'done'].includes(status) && ageHours(nowMs, lead.created_at) >= 24) {
      const leadName = [lead.first_name, lead.last_name].map((value) => text(value)).filter(Boolean).join(' ') || text(lead.email, 'Lead')
      tasks.push(task('stale_lead', 'Follow up with stale lead', `${leadName} has not been marked contacted after 24 hours.`, '/admin/leads', 'medium', text(lead.created_at)))
    }
  }

  const severityRank = { high: 0, medium: 1, low: 2 }
  const typeRank = {
    purchase_submitted: 0,
    document_package_failed: 1,
    document_package_missing: 2,
    vehicle_missing_carfax: 3,
    vehicle_missing_photos: 4,
    stale_lead: 5,
    sold_vehicle_visible: 6,
  }
  return tasks.sort((a, b) => {
    const severityDiff = (severityRank[a.severity] ?? 3) - (severityRank[b.severity] ?? 3)
    if (severityDiff !== 0) return severityDiff
    const typeDiff = (typeRank[a.type] ?? 99) - (typeRank[b.type] ?? 99)
    if (typeDiff !== 0) return typeDiff
    return text(b.createdAt).localeCompare(text(a.createdAt))
  })
}
