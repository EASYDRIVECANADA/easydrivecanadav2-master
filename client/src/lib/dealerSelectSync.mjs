export const DRIVE_TOWN_SYNC_MARKER = 'Imported from DriveTown Ottawa feed'
export const DRIVE_TOWN_SOURCE_NAME = 'DriveTown Ottawa'
export const DRIVE_TOWN_WEBSITE = 'https://drivetownottawa.com/'
export const DRIVE_TOWN_EMAIL = 'inventory@drivetownottawa.com'

const clean = (value) => String(value ?? '').trim()
const upper = (value) => clean(value).toUpperCase()

const uuid = () => {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export function buildDriveTownOwnerRow(userId) {
  return {
    user_id: userId,
    email: DRIVE_TOWN_EMAIL,
    first_name: 'DriveTown',
    last_name: 'Ottawa',
    title: 'Owner',
    role: 'Medium dealership',
    status: 'enable',
  }
}

export function buildDriveTownDealershipRow(userId) {
  return {
    user_id: userId,
    company_name: DRIVE_TOWN_SOURCE_NAME,
    phone: null,
    email: DRIVE_TOWN_EMAIL,
    province: 'ON',
    website: DRIVE_TOWN_WEBSITE,
    auto_close_deals_in: 'Dealer Select source account; inventory synced from DriveTown Ottawa website',
  }
}

export function buildVehicleUpsertRow(vehicle, { userId, now, supportsDealerSelectType = true } = {}) {
  const mileage = Number(vehicle.mileage || 0)
  const description = clean(vehicle.description || vehicle.title)

  return {
    user_id: userId,
    make: clean(vehicle.make),
    model: clean(vehicle.model),
    year: Number(vehicle.year || 0),
    trim: clean(vehicle.trim) || null,
    stock_number: clean(vehicle.stockNumber) || null,
    series: clean(vehicle.trim) || null,
    equipment: clean(vehicle.title) || null,
    vin: upper(vehicle.vin),
    price: Number(vehicle.price || 0),
    mileage,
    odometer: mileage,
    odometer_unit: 'kms',
    status: 'In Stock',
    inventory_type: supportsDealerSelectType ? 'DEALER_SELECT' : 'FLEET',
    categories: 'dealer_select',
    condition: 'Used',
    exterior_color: clean(vehicle.exteriorColor) || null,
    interior_color: clean(vehicle.interiorColor) || null,
    transmission: clean(vehicle.transmission) || null,
    drivetrain: clean(vehicle.drivetrain) || null,
    fuel_type: clean(vehicle.fuelType) || null,
    body_style: clean(vehicle.bodyStyle) || null,
    description,
    ad_description: description,
    features: Array.isArray(vehicle.features) ? vehicle.features : [],
    images: Array.isArray(vehicle.imageUrls) ? vehicle.imageUrls : [],
    city: 'Ottawa',
    province: 'ON',
    notes: DRIVE_TOWN_SYNC_MARKER,
    source_name: DRIVE_TOWN_SOURCE_NAME,
    source_url: clean(vehicle.sourceUrl),
    source_vehicle_id: clean(vehicle.sourceVehicleId),
    source_last_seen_at: now,
    source_last_synced_at: now,
    source_sync_status: 'active',
    updated_at: now,
    created_at: now,
    vehicleId: uuid(),
  }
}

export function chooseExistingVehicle(vehicle, existingRows, userId) {
  const scoped = (existingRows || []).filter((row) => clean(row.user_id) === clean(userId))
  const sourceUrl = clean(vehicle.sourceUrl)
  const vin = upper(vehicle.vin)
  const stock = upper(vehicle.stockNumber)

  return (
    scoped.find((row) => clean(row.source_url) && clean(row.source_url) === sourceUrl) ||
    scoped.find((row) => upper(row.vin) && upper(row.vin) === vin) ||
    scoped.find((row) => upper(row.stock_number) && upper(row.stock_number) === stock) ||
    null
  )
}

export function shouldPreserveEditableFields(existingRow) {
  const updatedAt = Date.parse(clean(existingRow?.updated_at))
  const syncedAt = Date.parse(clean(existingRow?.source_last_synced_at))
  if (!Number.isFinite(updatedAt) || !Number.isFinite(syncedAt)) return false
  return updatedAt > syncedAt
}

export function mergePreservingEditableFields(nextRow, existingRow) {
  if (!shouldPreserveEditableFields(existingRow)) return nextRow

  return {
    ...nextRow,
    price: existingRow.price,
    description: existingRow.description,
    ad_description: existingRow.ad_description,
    features: existingRow.features,
    images: existingRow.images,
    body_style: existingRow.body_style,
    fuel_type: existingRow.fuel_type,
    transmission: existingRow.transmission,
    drivetrain: existingRow.drivetrain,
    status: existingRow.status,
    notes: existingRow.notes || DRIVE_TOWN_SYNC_MARKER,
  }
}

export function computeMissingSyncedVehicles(previousRows, scrapedVehicles, { completeListing } = {}) {
  if (!completeListing) return []
  const currentSourceUrls = new Set((scrapedVehicles || []).map((vehicle) => clean(vehicle.sourceUrl)).filter(Boolean))

  return (previousRows || []).filter((row) => {
    const hasMarker = clean(row.notes) === DRIVE_TOWN_SYNC_MARKER || clean(row.source_name) === DRIVE_TOWN_SOURCE_NAME
    const sourceUrl = clean(row.source_url)
    return hasMarker && sourceUrl && !currentSourceUrls.has(sourceUrl)
  })
}
