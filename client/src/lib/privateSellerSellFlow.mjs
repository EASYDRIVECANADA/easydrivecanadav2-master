const CLOSED_STATUSES = new Set(['sold', 'closed', 'void', 'deleted'])

const clean = (value) => String(value ?? '').trim()

export function normalizeSellInquiry(input = {}) {
  return {
    name: clean(input.name),
    email: clean(input.email).toLowerCase(),
    phone: clean(input.phone),
    vin: clean(input.vin).toUpperCase(),
    askingPrice: clean(input.askingPrice),
  }
}

export function buildPrivateSellerOwnerRow(inquiry, userId) {
  const normalized = normalizeSellInquiry(inquiry)
  const parts = normalized.name.split(/\s+/).filter(Boolean)

  return {
    email: normalized.email,
    first_name: parts[0] || null,
    last_name: parts.slice(1).join(' ') || null,
    title: 'Owner',
    role: 'private',
    status: 'enable',
    user_id: userId,
  }
}

export function buildPrivateSellerVehicleRow(inquiry, userId, vehicleId, nowIso = new Date().toISOString()) {
  const normalized = normalizeSellInquiry(inquiry)
  const price = Number(String(normalized.askingPrice).replace(/[^0-9.]/g, ''))

  return {
    user_id: userId,
    vehicleId,
    vin: normalized.vin,
    price: Number.isFinite(price) ? price : null,
    status: 'DRAFT',
    inventory_type: 'PRIVATE',
    categories: 'Private Seller',
    ad_description: `Private seller draft listing submitted from /sell by ${normalized.name}. Phone: ${normalized.phone}.`,
    notes: `Private seller inquiry submitted from /sell. Seller: ${normalized.name}; email: ${normalized.email}; phone: ${normalized.phone}; asking price: ${normalized.askingPrice}.`,
    created_at: nowIso,
    updated_at: nowIso,
  }
}

export function hasActivePrivateSellerListing(rows = []) {
  return rows.some((row) => {
    const status = clean(row?.status).toLowerCase()
    return !CLOSED_STATUSES.has(status)
  })
}

export function buildVerificationUrl(vehicleId) {
  const returnUrl = `/admin/inventory/${encodeURIComponent(clean(vehicleId))}`
  return `/account/verification?returnUrl=${encodeURIComponent(returnUrl)}`
}
