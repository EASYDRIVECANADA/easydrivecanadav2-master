import { normalizeVehicleImageList } from './vehiclePhotoUrls.mjs'

const clean = (value) => String(value ?? '').trim()
const numberOrZero = (value) => Number(value || 0) || 0
const optionalNumber = (value) => value === null || value === undefined ? null : numberOrZero(value)

export function getPublicListingBucket(vehicle = {}) {
  const raw = clean(vehicle.categories || vehicle.category || vehicle.inventoryType || vehicle.inventory_type).toLowerCase()
  if (raw.includes('private')) return 'private'
  if (raw.includes('premier') || raw.includes('premiere')) return 'premier'
  if (raw.includes('fleet')) return 'fleet'
  if (raw.includes('dealer')) return 'dealer'
  return ''
}

export function normalizeFeatures(raw) {
  if (!raw) return []
  if (Array.isArray(raw)) return raw.map(String).map((value) => value.trim()).filter(Boolean)
  if (typeof raw === 'string') {
    const value = raw.trim()
    if (!value) return []
    try {
      const parsed = JSON.parse(value)
      if (Array.isArray(parsed)) return parsed.map(String).map((item) => item.trim()).filter(Boolean)
    } catch {
      // Fall through to comma splitting.
    }
    return value.split(',').map((item) => item.trim()).filter(Boolean)
  }
  return []
}

export function mapPublicInventoryVehicle(row = {}) {
  const categories = clean(row.categories || row.category)
  const inventoryType = clean(row.inventory_type ?? row.inventoryType)

  return {
    id: clean(row.id),
    stockNumber: clean(row.stock_number ?? row.stockNumber) || undefined,
    make: clean(row.make),
    model: clean(row.model),
    series: clean(row.series),
    year: numberOrZero(row.year),
    price: numberOrZero(row.price),
    retailPrice: optionalNumber(row.retail_price ?? row.retailPrice),
    financePrice: optionalNumber(row.finance_price ?? row.financePrice),
    mileage: numberOrZero(row.odometer ?? row.mileage),
    odometer: row.odometer === null || row.odometer === undefined ? undefined : numberOrZero(row.odometer),
    odometerUnit: clean(row.odometer_unit ?? row.odometerUnit),
    fuelType: clean(row.fuel_type ?? row.fuelType),
    transmission: clean(row.transmission),
    bodyStyle: clean(row.body_style ?? row.bodyStyle),
    exteriorColor: clean(row.exterior_color ?? row.exteriorColor),
    city: clean(row.city),
    province: clean(row.province),
    lotLocation: clean(row.lot_location ?? row.lotLocation),
    sourceName: clean(row.marketplace_source ?? row.sourceName),
    sellerName: clean(row.seller_name ?? row.sellerName ?? row.marketplace_source),
    dealerName: clean(row.dealer_name ?? row.dealerName ?? row.marketplace_source),
    features: normalizeFeatures(row.features),
    images: normalizeVehicleImageList(row.images ?? row.image_urls ?? row.image),
    status: clean(row.status),
    inventoryType,
    categories,
    createdAt: clean(row.created_at ?? row.createdAt),
    listingBucket: getPublicListingBucket({ categories, inventoryType }),
  }
}
