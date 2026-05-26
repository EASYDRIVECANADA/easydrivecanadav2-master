const normalize = (value) => String(value ?? '').trim().toLowerCase()

const TYPES = {
  private: {
    bucket: 'private',
    label: 'Private Seller',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
    dotClass: 'bg-amber-400',
  },
  dealershipSmall: {
    bucket: 'dealership',
    label: 'Small Dealership',
    badgeClass: 'bg-purple-50 text-purple-700 border-purple-200',
    dotClass: 'bg-purple-500',
  },
  dealershipMedium: {
    bucket: 'dealership',
    label: 'Medium Dealership',
    badgeClass: 'bg-purple-50 text-purple-700 border-purple-200',
    dotClass: 'bg-purple-500',
  },
  dealershipLarge: {
    bucket: 'dealership',
    label: 'Large Dealership',
    badgeClass: 'bg-purple-50 text-purple-700 border-purple-200',
    dotClass: 'bg-purple-500',
  },
  premier: {
    bucket: 'premier',
    label: 'Premier',
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
    dotClass: 'bg-[#1EA7FF]',
  },
  staff: {
    bucket: 'staff',
    label: 'Staff/Admin',
    badgeClass: 'bg-slate-100 text-slate-600 border-slate-200',
    dotClass: 'bg-slate-400',
  },
}

export const DIRECTORY_ACCOUNT_FILTERS = [
  { key: 'all', label: 'All', dotClass: 'bg-slate-300' },
  { key: 'private', label: 'Private Sellers', dotClass: TYPES.private.dotClass },
  { key: 'dealership', label: 'Dealerships', dotClass: TYPES.dealershipSmall.dotClass },
  { key: 'staff', label: 'Staff/Admin', dotClass: TYPES.staff.dotClass },
]

export function getDirectoryAccountType(row = {}) {
  const role = normalize(row.role)
  const account = normalize(row.account)
  const profile = normalize(row.profile)
  const raw = [role, account, profile].filter(Boolean).join(' ')

  if (!role || role === 'private' || role === 'private seller' || role === 'starter') return TYPES.private
  if (role.includes('large dealership')) return TYPES.dealershipLarge
  if (role.includes('medium dealership')) return TYPES.dealershipMedium
  if (role.includes('small dealership')) return TYPES.dealershipSmall
  if (raw.includes('dealership') || raw.includes('dealer')) return TYPES.dealershipSmall
  if (role.includes('premier')) return TYPES.premier
  return TYPES.staff
}
