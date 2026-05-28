const clean = (value) => String(value ?? '').trim()

export const toShowroomNumber = (value) => {
  if (value === null || value === undefined) return 0
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  const cleaned = clean(value).replace(/[^0-9.-]/g, '')
  if (!cleaned) return 0
  const number = Number(cleaned)
  return Number.isFinite(number) ? number : 0
}

export const pickShowroomNumber = (...values) => {
  let firstDefined = 0
  let hasDefined = false

  for (const value of values) {
    if (value === null || value === undefined) continue
    if (typeof value === 'string' && !value.trim()) continue
    const number = toShowroomNumber(value)
    if (!hasDefined) {
      firstDefined = number
      hasDefined = true
    }
    if (number > 0) return number
  }

  return hasDefined ? firstDefined : 0
}

export const normalizeShowroomFeatures = (value) => {
  if (Array.isArray(value)) return value.map(clean).filter(Boolean)
  if (typeof value !== 'string' || !value.trim()) return []

  try {
    const parsed = JSON.parse(value)
    if (Array.isArray(parsed)) return parsed.map(clean).filter(Boolean)
  } catch {
    // Fall back to comma-separated feature text.
  }

  return value.split(',').map(clean).filter(Boolean)
}

export const mapShowroomVehicle = (vehicle) => {
  const year = vehicle?.year ? String(vehicle.year) : ''
  const make = vehicle?.make || ''
  const model = vehicle?.model || ''
  const trim = vehicle?.trim || ''
  const label = [year, make, model, trim].filter(Boolean).join(' ').trim() || vehicle?.vin || ''
  const rawStatus = clean(vehicle?.status).toLowerCase()

  return {
    id: String(vehicle?.id || ''),
    vehicle: label,
    drive: clean(vehicle?.drivetrain || vehicle?.drive) || '-',
    transmission: clean(vehicle?.transmission) || '-',
    cyl: clean(vehicle?.cylinders || vehicle?.cyl) || '-',
    colour: clean(vehicle?.exterior_color || vehicle?.colour) || '-',
    odometerKm: pickShowroomNumber(vehicle?.odometer, vehicle?.odometerKm, vehicle?.mileage, 0),
    odoUnit: clean(vehicle?.odometer_unit) || 'km',
    price: pickShowroomNumber(
      vehicle?.price,
      vehicle?.list_price,
      vehicle?.listPrice,
      vehicle?.listprice,
      vehicle?.sale_price,
      vehicle?.salePrice,
      vehicle?.saleprice,
      vehicle?.msrp,
      vehicle?.advertised_price,
      vehicle?.advertisedPrice,
      0
    ),
    status: rawStatus.includes('pending') ? 'Deal Pending' : rawStatus.includes('sold') ? 'Sold' : 'In Stock',
    images: [],
    vin: clean(vehicle?.vin) || undefined,
    stock: clean(vehicle?.stock_number ?? vehicle?.stockNumber) || undefined,
    features: normalizeShowroomFeatures(vehicle?.features),
    categories: clean(vehicle?.categories || vehicle?.category) || undefined,
  }
}
