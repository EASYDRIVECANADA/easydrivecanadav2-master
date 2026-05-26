const clean = (value) => String(value ?? '').trim()

export function normalizeDealerRegistration(input = {}) {
  return {
    companyName: clean(input.companyName),
    contactName: clean(input.contactName),
    email: clean(input.email).toLowerCase(),
    phone: clean(input.phone),
    province: clean(input.province).toUpperCase(),
    inventorySize: clean(input.inventorySize),
    website: clean(input.website),
  }
}

export function buildDealerOwnerRow(input, userId) {
  const normalized = normalizeDealerRegistration(input)
  const parts = normalized.contactName.split(/\s+/).filter(Boolean)

  return {
    user_id: userId,
    email: normalized.email,
    first_name: parts[0] || null,
    last_name: parts.slice(1).join(' ') || null,
    title: 'Owner',
    role: 'private',
    status: 'enable',
  }
}

export function buildDealershipProfileRow(input, userId) {
  const normalized = normalizeDealerRegistration(input)
  const onboardingNote = [
    'Pending dealer onboarding',
    normalized.inventorySize ? `estimated inventory: ${normalized.inventorySize}` : '',
  ].filter(Boolean).join('; ')

  return {
    user_id: userId,
    company_name: normalized.companyName || null,
    phone: normalized.phone || null,
    email: normalized.email || null,
    province: normalized.province || null,
    website: normalized.website || null,
    auto_close_deals_in: onboardingNote,
  }
}

export function buildDealerVerificationUrl() {
  return `/account/verification?returnUrl=${encodeURIComponent('/admin/billing')}`
}
