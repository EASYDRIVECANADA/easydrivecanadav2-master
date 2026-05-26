const LISTING_TYPES = {
  private: {
    bucket: 'private',
    label: 'Private Seller',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
    dotClass: 'bg-amber-400',
  },
  premier: {
    bucket: 'premier',
    label: 'EDC Premier',
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
    dotClass: 'bg-[#1EA7FF]',
  },
  dealer: {
    bucket: 'dealer',
    label: 'Dealer Select',
    badgeClass: 'bg-purple-50 text-purple-700 border-purple-200',
    dotClass: 'bg-purple-500',
  },
  fleet: {
    bucket: 'fleet',
    label: 'Fleet Select',
    badgeClass: 'bg-slate-100 text-slate-600 border-slate-200',
    dotClass: 'bg-slate-400',
  },
  unknown: {
    bucket: 'unknown',
    label: 'Uncategorized',
    badgeClass: 'bg-slate-100 text-slate-600 border-slate-200',
    dotClass: 'bg-slate-300',
  },
}

export const LISTING_FILTERS = [
  { key: 'all', label: 'All', dotClass: 'bg-slate-300' },
  { key: 'premier', label: LISTING_TYPES.premier.label, dotClass: LISTING_TYPES.premier.dotClass },
  { key: 'dealer', label: LISTING_TYPES.dealer.label, dotClass: LISTING_TYPES.dealer.dotClass },
  { key: 'fleet', label: LISTING_TYPES.fleet.label, dotClass: LISTING_TYPES.fleet.dotClass },
  { key: 'private', label: LISTING_TYPES.private.label, dotClass: LISTING_TYPES.private.dotClass },
]

const normalize = (value) => String(value ?? '').trim().toLowerCase()

export function resolveListingBucket(value) {
  const raw = normalize(value)
  if (!raw) return 'unknown'
  if (raw.includes('private')) return 'private'
  if (raw.includes('premier') || raw.includes('premiere')) return 'premier'
  if (raw.includes('dealer') || raw.includes('dealership')) return 'dealer'
  if (raw.includes('fleet')) return 'fleet'
  return 'unknown'
}

export function getListingTypeMeta(row = {}) {
  const primary = row.categories || row.category
  const fallback = row.inventory_type || row.inventoryType || row.collection
  const bucket = resolveListingBucket(primary || fallback)
  const meta = LISTING_TYPES[bucket] || LISTING_TYPES.unknown

  return {
    ...meta,
    raw: primary || fallback || '',
  }
}
