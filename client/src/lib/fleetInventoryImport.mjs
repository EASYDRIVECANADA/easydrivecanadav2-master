const clean = (value) => String(value ?? '').trim()

const toNumber = (value) => {
  const raw = clean(value).replace(/[$,\s]/g, '')
  const num = Number(raw)
  return Number.isFinite(num) ? num : 0
}

const hasNumericValue = (value) => {
  const raw = clean(value).replace(/[$,\s]/g, '')
  if (raw === '') return false
  return Number.isFinite(Number(raw))
}

const toInt = (value) => {
  const num = Math.round(toNumber(value))
  return Number.isFinite(num) ? num : 0
}

const normalizeHeader = (value) =>
  clean(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

const normalizeVin = (value) => clean(value).toUpperCase()

const normalizeStock = (value) => clean(value).toUpperCase()

export function parseFleetInventoryRows(rows) {
  if (rows.length < 2) throw new Error('Workbook has no vehicle rows')

  const headers = (rows[0] || []).map(normalizeHeader)
  const indexOf = (...names) => {
    const normalized = names.map(normalizeHeader)
    return headers.findIndex((h) => normalized.includes(h))
  }

  const column = {
    location: indexOf('Location', 'Lot Location'),
    stock: indexOf('Unit ID', 'Stock Number', 'Stock #', 'Stock'),
    year: indexOf('Year', 'Model Year'),
    make: indexOf('Make'),
    model: indexOf('Model'),
    series: indexOf('Series', 'Trim'),
    mileage: indexOf('Kilometers', 'Kilometres', 'Mileage', 'Odometer'),
    exteriorColor: indexOf('Ext Color', 'Exterior Color', 'Colour', 'Color'),
    vin: indexOf('VIN'),
    price: indexOf('Price', 'List Price'),
    equipment: indexOf('Equip', 'Equipment'),
  }

  const required = [
    ['stock', 'Unit ID / stock number'],
    ['vin', 'VIN'],
    ['year', 'Year'],
    ['make', 'Make'],
    ['mileage', 'Kilometers / mileage'],
    ['price', 'Price'],
  ]

  const missingColumns = required
    .filter(([key]) => column[key] < 0)
    .map(([, label]) => label)

  if (missingColumns.length > 0) {
    throw new Error(`Missing required column(s): ${missingColumns.join(', ')}`)
  }

  if (column.model < 0 && column.equipment < 0) {
    throw new Error('Missing required column(s): Equip or Model')
  }

  const vehicles = []
  const skipped = []
  const seenStock = new Set()
  const seenVin = new Set()

  rows.slice(1).forEach((row, offset) => {
    const sourceRow = offset + 2
    const hasAnyValue = row.some((value) => clean(value))
    if (!hasAnyValue) return

    const get = (idx) => (idx >= 0 ? row[idx] : '')
    const stock = normalizeStock(get(column.stock))
    const vin = normalizeVin(get(column.vin))
    const year = toInt(get(column.year))
    const make = clean(get(column.make)).toUpperCase()
    const equipment = clean(get(column.equipment))
    const model = (equipment || clean(get(column.model))).toUpperCase()
    const mileageValue = get(column.mileage)
    const mileage = toInt(mileageValue)
    const price = toNumber(get(column.price))

    const missing = [
      !stock ? 'stock number' : '',
      !vin ? 'VIN' : '',
      !year ? 'year' : '',
      !make ? 'make' : '',
      !model ? 'model' : '',
      !hasNumericValue(mileageValue) ? 'mileage' : '',
      !price ? 'price' : '',
    ].filter(Boolean)

    if (missing.length > 0) {
      skipped.push({ row: sourceRow, reason: `Missing ${missing.join(', ')}` })
      return
    }

    if (seenStock.has(stock)) {
      skipped.push({ row: sourceRow, reason: `Duplicate stock number ${stock} in workbook` })
      return
    }

    if (seenVin.has(vin)) {
      skipped.push({ row: sourceRow, reason: `Duplicate VIN ${vin} in workbook` })
      return
    }

    seenStock.add(stock)
    seenVin.add(vin)

    const series = clean(get(column.series)) || null
    const equipmentValue = equipment || null

    vehicles.push({
      sourceRow,
      stock_number: stock,
      vin,
      year,
      make,
      model,
      series,
      trim: series,
      price,
      mileage,
      odometer: mileage,
      odometer_unit: 'kms',
      exterior_color: clean(get(column.exteriorColor)) || null,
      equipment: equipmentValue,
      description: equipmentValue,
      lot_location: clean(get(column.location)) || null,
    })
  })

  if (vehicles.length === 0) {
    throw new Error('No valid vehicle rows found')
  }

  return { vehicles, skipped }
}
