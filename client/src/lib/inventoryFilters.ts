export type InventoryListingBucket = 'private' | 'premier' | 'fleet' | 'dealer' | ''
export type InventoryListingTab = '' | 'premier' | 'fleet'

export type InventoryFilterVehicle = {
  id?: string
  make?: string
  model?: string
  year?: number | string
  stockNumber?: string
  vin?: string
  keyNumber?: string
  status?: string
  inventoryType?: string
  category?: string
  raw?: Record<string, unknown>
}

export type InventoryFilterOptions = {
  categoryTab?: InventoryListingTab
  inventoryTypeFilter?: '' | 'FLEET' | 'PREMIERE'
  statusFilter?: Set<string>
  statusOptions?: readonly string[]
  searchQuery?: string
  opsVehicleById?: Record<string, Record<string, unknown>>
  normalizeStatus?: (value: unknown) => string
  vehicleMatchesSearch?: (vehicle: Record<string, unknown>, query: string) => boolean
}

const CLOSED_INVENTORY_STATUSES = new Set(['sold', 'closed'])

export const isClosedInventoryStatus = (status: unknown) =>
  CLOSED_INVENTORY_STATUSES.has(String(status ?? '').trim().toLowerCase())

export const matchesStockOrVin = (vehicle: { stockNumber?: unknown; vin?: unknown }, search: string) => {
  const query = search.trim().toLowerCase()
  if (!query) return false
  const stock = String(vehicle.stockNumber ?? '').trim().toLowerCase()
  const vin = String(vehicle.vin ?? '').trim().toLowerCase()
  return Boolean((stock && stock.includes(query)) || (vin && query.length >= 3 && vin.includes(query)))
}

export const getVehicleListingBucket = (
  vehicle: Pick<InventoryFilterVehicle, 'category' | 'inventoryType'>
): InventoryListingBucket => {
  const raw = String(vehicle.category || vehicle.inventoryType || '').trim().toLowerCase()

  if (raw.includes('private')) return 'private'
  if (raw.includes('premier') || raw.includes('premiere')) return 'premier'
  if (raw.includes('fleet')) return 'fleet'
  if (raw.includes('dealer')) return 'dealer'

  return ''
}

const defaultNormalizeStatus = (value: unknown) => String(value ?? '').trim()

const defaultVehicleMatchesSearch = (vehicle: Record<string, unknown>, query: string) =>
  Object.values(vehicle).some((value) => String(value ?? '').toLowerCase().includes(query))

export function filterInventoryVehicles<T extends InventoryFilterVehicle>(
  vehicles: T[],
  options: InventoryFilterOptions = {}
): T[] {
  const {
    categoryTab = '',
    inventoryTypeFilter = '',
    statusFilter = new Set<string>(),
    statusOptions = [],
    searchQuery = '',
    opsVehicleById = {},
    normalizeStatus = defaultNormalizeStatus,
    vehicleMatchesSearch = defaultVehicleMatchesSearch,
  } = options

  let filtered = vehicles
  const stockOrVinLookup = searchQuery.trim()
    ? (vehicle: T) => matchesStockOrVin(vehicle, searchQuery)
    : () => false

  if (inventoryTypeFilter) {
    filtered = filtered.filter((vehicle) => vehicle.inventoryType === inventoryTypeFilter)
  }

  if (categoryTab) {
    filtered = filtered.filter((vehicle) => getVehicleListingBucket(vehicle) === categoryTab)
  }

  if (statusFilter.size > 0 && statusFilter.size < statusOptions.length) {
    const known = new Set<string>(statusOptions.filter((s) => s !== 'Other'))
    filtered = filtered.filter((vehicle) => {
      const normalized = normalizeStatus(vehicle.status)
      if (statusFilter.has(normalized)) return true
      if (statusFilter.has('Other') && (!normalized || !known.has(normalized))) return true
      return false
    })
  }

  const explicitlyShowingClosedStatus =
    statusFilter.size > 0 &&
    statusFilter.size < statusOptions.length &&
    (statusFilter.has('Sold') || statusFilter.has('Void'))

  if (!explicitlyShowingClosedStatus) {
    filtered = filtered.filter((vehicle) => !isClosedInventoryStatus(vehicle.status) || stockOrVinLookup(vehicle))
  }

  if (searchQuery.trim()) {
    const query = searchQuery.toLowerCase()
    filtered = filtered.filter((vehicle) => {
      const opsVehicle = vehicle.id ? opsVehicleById[vehicle.id] || {} : {}
      const raw = vehicle.raw || {}
      return (
        vehicleMatchesSearch({ ...raw, ...vehicle, ...opsVehicle }, query) ||
        String(vehicle.make || '').toLowerCase().includes(query) ||
        String(vehicle.model || '').toLowerCase().includes(query) ||
        String(vehicle.year || '').includes(query) ||
        String(vehicle.stockNumber || '').toLowerCase().includes(query) ||
        String(vehicle.vin || '').toLowerCase().includes(query) ||
        String(vehicle.keyNumber || '').toLowerCase().includes(query) ||
        `${vehicle.year || ''} ${vehicle.make || ''} ${vehicle.model || ''}`.toLowerCase().includes(query)
      )
    })
  }

  return filtered
}
