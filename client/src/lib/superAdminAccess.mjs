const SUPERADMIN_EMAIL = 'info@easydrivecanada.com'

const clean = (value) => String(value ?? '').trim()

export function isSuperAdminEmail(email) {
  return clean(email).toLowerCase() === SUPERADMIN_EMAIL
}

export function resolveEditableDealerUserId({ adminEmail, ownUserId, selectedDealerUserId } = {}) {
  const own = clean(ownUserId)
  const selected = clean(selectedDealerUserId)
  if (isSuperAdminEmail(adminEmail) && selected) return selected
  return own || null
}
