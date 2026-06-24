const clean = (value) => String(value ?? '').trim()

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

export const normalizeLeadSourceInput = (value) => {
  const source = clean(value).toLowerCase()
  if (source.includes('insurance')) return 'insurance'
  if (source.includes('finance') || source.includes('financing')) return 'finance'
  if (source.includes('website') || source.includes('contact') || source.includes('easy drive canada')) return 'website'
  return 'unknown'
}

export const leadSourceFromMessage = (lead = {}) => {
  const rows = parseMessageRows(lead.message)
  const rawSource = findMessageValue(rows, ['source', 'lead source', 'form source'])
  const normalizedSource = normalizeLeadSourceInput(rawSource)
  const message = clean(lead.message).toLowerCase()
  const labels = rows.map((row) => row.label)

  if (normalizedSource !== 'unknown') return normalizedSource
  if (rawSource) return 'unknown'
  if (message.includes('license number')) return 'insurance'
  if (message.includes('credit') || lead.employmentStatus || lead.monthlyIncome || lead.downPayment || lead.creditScore) return 'finance'
  if (labels.includes('subject') || labels.includes('message')) return 'website'
  if (lead.message && !lead.vehicleInterest && !lead.employmentStatus && !lead.monthlyIncome && !lead.downPayment && !lead.creditScore) return 'website'
  return 'unknown'
}

export const leadCustomSourceFromMessage = (lead = {}) => {
  const rows = parseMessageRows(lead.message)
  const rawSource = findMessageValue(rows, ['source', 'lead source', 'form source'])
  if (!rawSource) return ''
  return normalizeLeadSourceInput(rawSource) === 'unknown' ? rawSource : ''
}

export const leadSourceLabel = (source) => {
  if (source === 'website') return 'EASYDRIVE CANADA - WEBSITE'
  if (source === 'finance') return 'EASYDRIVE FINANCE - LANDING PAGE'
  if (source === 'insurance') return 'Insurance'
  return 'Other'
}

export const leadSourcePillClass = (source) => {
  if (source === 'finance') return 'bg-blue-50 text-blue-700 ring-blue-200'
  if (source === 'insurance') return 'bg-emerald-50 text-emerald-700 ring-emerald-200'
  if (source === 'website') return 'bg-amber-50 text-amber-700 ring-amber-200'
  return 'bg-slate-100 text-slate-600 ring-slate-200'
}

export const leadSourceMessageValue = (source, customSource = '') => {
  const custom = clean(customSource)
  if (source === 'finance') return 'EasyDrive Finance - Landing Page'
  if (source === 'insurance') return 'Manual Insurance'
  if (source === 'website') return 'EasyDrive Canada - Website'
  return custom || 'Other'
}

export const leadCustomSourceFieldState = (source) => {
  const isOther = source === 'unknown'
  return {
    disabled: !isOther,
    placeholder: isOther ? 'Referral, walk-in, phone up...' : 'Select Other to type a source',
  }
}
