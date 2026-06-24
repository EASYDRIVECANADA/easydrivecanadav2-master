import {
  leadCustomSourceFromMessage,
  leadSourceFromMessage,
  leadSourceLabel,
} from './leadSource.mjs'

const clean = (value) => String(value ?? '').trim()

export const LEAD_MARKETING_EXPORT_COLUMNS = [
  'Lead ID',
  'Submitted at',
  'Submitted date',
  'Source',
  'First name',
  'Last name',
  'Full name',
  'Email',
  'Phone',
  'Vehicle interest',
  'City',
  'Province',
  'Address',
  'Campaign source',
  'Employment status',
  'Monthly income',
  'Down payment',
  'Credit profile',
  'Lead status',
  'Finance manager',
  'Internal notes transcript',
  'Marketing notes',
  'Raw submitted message',
]

const parseMessageRows = (message) => {
  const rows = []

  clean(message)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .forEach((line) => {
      const match = line.match(/^([^:]+):\s*(.*)$/)
      if (!match) return

      const label = clean(match[1]).toLowerCase()
      const value = clean(match[2])
      if (label && value && value !== '-') rows.push({ label, value })
    })

  return rows
}

const findMessageValue = (rows, labels) => {
  const wanted = labels.map((label) => clean(label).toLowerCase())
  return rows.find((row) => wanted.includes(row.label))?.value || ''
}

const inferSource = (lead) => {
  const sourceLead = {
    message: lead?.message,
    vehicleInterest: lead?.vehicleInterest,
    employmentStatus: lead?.employmentStatus,
    monthlyIncome: lead?.monthlyIncome,
    downPayment: lead?.downPayment,
    creditScore: lead?.creditScore,
  }
  const source = leadSourceFromMessage(sourceLead)
  const custom = source === 'unknown' ? leadCustomSourceFromMessage(sourceLead) : ''
  return custom || leadSourceLabel(source)
}

const formatDateTime = (value) => {
  const date = new Date(clean(value))
  if (Number.isNaN(date.getTime())) return ''
  return date.toISOString()
}

const formatDate = (value) => formatDateTime(value).slice(0, 10)

const fullName = (lead) => [lead?.firstName, lead?.lastName].map(clean).filter(Boolean).join(' ')

export const buildLeadMarketingExportRows = (leads = []) =>
  leads.map((lead) => {
    const rows = parseMessageRows(lead?.message)

    return {
      'Lead ID': clean(lead?.id),
      'Submitted at': formatDateTime(lead?.createdAt),
      'Submitted date': formatDate(lead?.createdAt),
      Source: inferSource(lead),
      'First name': clean(lead?.firstName),
      'Last name': clean(lead?.lastName),
      'Full name': fullName(lead),
      Email: clean(lead?.email).toLowerCase(),
      Phone: clean(lead?.phone),
      'Vehicle interest': clean(lead?.vehicleInterest),
      City: findMessageValue(rows, ['city', 'town']),
      Province: findMessageValue(rows, ['province', 'state']),
      Address: findMessageValue(rows, ['address', 'street address']),
      'Campaign source': findMessageValue(rows, ['campaign source', 'utm source', 'utm_source', 'ad source']),
      'Employment status': clean(lead?.employmentStatus),
      'Monthly income': lead?.monthlyIncome === null || lead?.monthlyIncome === undefined ? '' : Number(lead.monthlyIncome),
      'Down payment': lead?.downPayment === null || lead?.downPayment === undefined ? '' : Number(lead.downPayment),
      'Credit profile': clean(lead?.creditScore),
      'Lead status': clean(lead?.managerStatus),
      'Finance manager': clean(lead?.financeManager).toLowerCase(),
      'Internal notes transcript': clean(lead?.adminNotes),
      'Marketing notes': clean(lead?.marketingNotes),
      'Raw submitted message': clean(lead?.message),
    }
  })

const countBy = (rows, label, getter) => {
  const counts = new Map()

  rows.forEach((row) => {
    const value = clean(getter(row)) || 'Unassigned'
    counts.set(value, (counts.get(value) || 0) + 1)
  })

  return Array.from(counts.entries())
    .sort((a, b) => a[0].localeCompare(b[0], undefined, { sensitivity: 'base' }))
    .map(([value, count]) => [label, value, count])
}

export const buildLeadMarketingSummaryRows = (leads = []) => {
  const exportRows = buildLeadMarketingExportRows(leads)

  return [
    ['Metric', 'Value', 'Count'],
    ['Total leads', 'All', exportRows.length],
    ...countBy(exportRows, 'Source', (row) => row.Source),
    ...countBy(exportRows, 'Status', (row) => row['Lead status']),
    ...countBy(exportRows, 'Finance manager', (row) => row['Finance manager']),
    ...countBy(exportRows, 'Submitted date', (row) => row['Submitted date']),
  ]
}

export const leadMarketingRowsToAoa = (rows = []) => [
  LEAD_MARKETING_EXPORT_COLUMNS,
  ...rows.map((row) => LEAD_MARKETING_EXPORT_COLUMNS.map((column) => row[column] ?? '')),
]
