import {
  leadCustomSourceFromMessage,
  leadSourceFromMessage,
  leadSourceLabel,
} from './leadSource.mjs'

export const LEAD_LIST_FILTERS = [
  { key: 'all', label: 'View All Apps' },
  { key: 'finance', label: 'Landing Page' },
  { key: 'website', label: 'Website' },
  { key: 'unknown', label: 'Other' },
]

export const buildLeadFilterOptions = () => LEAD_LIST_FILTERS

export const matchesLeadListFilter = (lead, filter) => {
  const source = leadSourceFromMessage(lead)

  if (filter === 'all') return true
  if (filter === 'unknown') return source !== 'finance' && source !== 'website'
  return source === filter
}

export const defaultLeadFilterForSource = (source) => {
  if (source === 'finance' || source === 'website') return source
  return 'unknown'
}

const clean = (value) => String(value ?? '').trim()

const lower = (value) => clean(value).toLowerCase()

const dateTime = (value) => {
  const time = Date.parse(clean(value))
  return Number.isFinite(time) ? time : 0
}

const activeTaskTime = (lead) => {
  if (!clean(lead?.taskDueAt) || clean(lead?.taskCompletedAt)) return 0
  return dateTime(lead.taskDueAt)
}

const matchesStatusFilter = (lead, status) => {
  const wanted = lower(status)
  if (!wanted) return true
  return lower(lead?.managerStatus) === wanted
}

const matchesSourceTextFilter = (lead, sourceText) => {
  const wanted = lower(sourceText)
  if (!wanted) return true
  const source = leadSourceFromMessage(lead)
  const haystack = [
    leadCustomSourceFromMessage(lead),
    leadSourceLabel(source),
    lead?.message,
  ].map(lower).join(' ')

  return haystack.includes(wanted)
}

const matchesSearchFilter = (lead, search) => {
  const wanted = lower(search)
  if (!wanted) return true
  const source = leadSourceFromMessage(lead)
  const haystack = [
    lead?.firstName,
    lead?.lastName,
    [lead?.firstName, lead?.lastName].map(clean).filter(Boolean).join(' '),
    lead?.email,
    lead?.phone,
    lead?.vehicleInterest,
    lead?.message,
    lead?.adminNotes,
    lead?.marketingNotes,
    lead?.managerStatus,
    lead?.financeManager,
    leadSourceLabel(source),
    leadCustomSourceFromMessage(lead),
    lead?.employmentStatus,
    lead?.creditScore,
    lead?.taskNote,
  ].map(lower).join(' ')

  return haystack.includes(wanted)
}

export const filterAndSortLeads = (leads = [], options = {}) => {
  const tab = clean(options.tab) || 'all'
  const now = Date.parse(clean(options.now)) || Date.now()

  return leads
    .filter((lead) => matchesLeadListFilter(lead, tab))
    .filter((lead) => matchesStatusFilter(lead, options.status))
    .filter((lead) => matchesSourceTextFilter(lead, options.sourceText))
    .filter((lead) => matchesSearchFilter(lead, options.search))
    .slice()
    .sort((left, right) => {
      const leftTask = activeTaskTime(left)
      const rightTask = activeTaskTime(right)

      if (leftTask && rightTask) return leftTask - rightTask
      if (leftTask) return -1
      if (rightTask) return 1

      const leftCreated = dateTime(left?.createdAt) || now
      const rightCreated = dateTime(right?.createdAt) || now
      return rightCreated - leftCreated
    })
}
