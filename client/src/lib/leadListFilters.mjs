import { leadSourceFromMessage } from './leadSource.mjs'

export const LEAD_LIST_FILTERS = [
  { key: 'open', label: 'Open Leads' },
  { key: 'finance', label: 'Credit Application' },
  { key: 'website', label: 'Website' },
  { key: 'facebook', label: 'FB Lead Form' },
  { key: 'insurance', label: 'Insurance Application' },
  { key: 'synced', label: 'Handled' },
]

export const matchesLeadListFilter = (lead, filter) => {
  const source = leadSourceFromMessage(lead)

  if (filter === 'synced') return !!lead?.ghlSynced
  if (lead?.ghlSynced) return false
  if (filter === 'open') return true
  return source === filter
}

export const defaultLeadFilterForSource = (source) => {
  if (source === 'finance' || source === 'website' || source === 'facebook' || source === 'insurance') return source
  return 'open'
}
