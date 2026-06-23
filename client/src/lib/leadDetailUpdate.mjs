import {
  appendLeadUpdateTranscriptNote,
  cleanLeadText,
} from './leadWorkflow.mjs'
import {
  leadCustomSourceFromMessage,
  leadSourceFromMessage,
  leadSourceLabel,
  leadSourceMessageValue,
} from './leadSource.mjs'

const nullableText = (value) => cleanLeadText(value) || null

const moneyNumberOrNull = (value) => {
  const raw = cleanLeadText(value).replace(/[$,\s]/g, '')
  if (!raw) return null
  const number = Number(raw)
  return Number.isFinite(number) ? number : null
}

const isoDateOrNull = (value) => {
  const raw = cleanLeadText(value)
  if (!raw) return null
  const date = new Date(`${raw}T00:00:00.000Z`)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

const dateInputValue = (value) => {
  const date = new Date(cleanLeadText(value))
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10)
}

const sameValue = (left, right) => cleanLeadText(left) === cleanLeadText(right)

const displayValue = (value) => cleanLeadText(value) || null

const sourceDisplay = (source, customSource = '') => {
  const custom = cleanLeadText(customSource)
  if (source === 'unknown' && custom) return `Other: ${custom}`
  return leadSourceLabel(source)
}

export const replaceLeadMessageSource = (message, sourceValue) => {
  const sourceLine = `Source: ${cleanLeadText(sourceValue)}`
  const lines = cleanLeadText(message)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  const sourceIndex = lines.findIndex((line) => /^source\s*:/i.test(line))
  if (sourceIndex >= 0) {
    return [
      ...lines.slice(0, sourceIndex),
      sourceLine,
      ...lines.slice(sourceIndex + 1),
    ].join('\n')
  }

  return [sourceLine, ...lines].join('\n')
}

export const buildLeadDetailDraft = (lead) => ({
  firstName: cleanLeadText(lead?.firstName),
  lastName: cleanLeadText(lead?.lastName),
  email: cleanLeadText(lead?.email).toLowerCase(),
  phone: cleanLeadText(lead?.phone),
  source: leadSourceFromMessage(lead),
  customSource: leadCustomSourceFromMessage(lead),
  createdAt: dateInputValue(lead?.createdAt),
  vehicleInterest: cleanLeadText(lead?.vehicleInterest),
  employmentStatus: cleanLeadText(lead?.employmentStatus),
  monthlyIncome: lead?.monthlyIncome === null || lead?.monthlyIncome === undefined ? '' : String(lead.monthlyIncome),
  downPayment: lead?.downPayment === null || lead?.downPayment === undefined ? '' : String(lead.downPayment),
  creditScore: cleanLeadText(lead?.creditScore),
})

export const buildLeadDetailUpdate = (lead, draft, options = {}) => {
  const notesEnabled = !!options.notesEnabled
  const actor = cleanLeadText(options.actor)
  const timestamp = options.timestamp
  const currentSource = leadSourceFromMessage(lead)
  const currentCustomSource = leadCustomSourceFromMessage(lead)
  const nextSource = cleanLeadText(draft?.source) || 'unknown'
  const nextCustomSource = nextSource === 'unknown' ? cleanLeadText(draft?.customSource) : ''
  const nextMessage = replaceLeadMessageSource(lead?.message, leadSourceMessageValue(nextSource, nextCustomSource))
  const nextCreatedAt = isoDateOrNull(draft?.createdAt)

  const nextValues = {
    firstName: cleanLeadText(draft?.firstName),
    lastName: cleanLeadText(draft?.lastName),
    email: cleanLeadText(draft?.email).toLowerCase(),
    phone: cleanLeadText(draft?.phone),
    vehicleInterest: nullableText(draft?.vehicleInterest),
    employmentStatus: nullableText(draft?.employmentStatus),
    monthlyIncome: moneyNumberOrNull(draft?.monthlyIncome),
    downPayment: moneyNumberOrNull(draft?.downPayment),
    creditScore: nullableText(draft?.creditScore),
    createdAt: nextCreatedAt,
    message: nextMessage || null,
  }

  const fieldMap = [
    ['First name', 'firstName', 'first_name', cleanLeadText(lead?.firstName), nextValues.firstName],
    ['Last name', 'lastName', 'last_name', cleanLeadText(lead?.lastName), nextValues.lastName],
    ['Email', 'email', 'email', cleanLeadText(lead?.email).toLowerCase(), nextValues.email],
    ['Phone', 'phone', 'phone', cleanLeadText(lead?.phone), nextValues.phone],
    ['Vehicle interest', 'vehicleInterest', 'vehicle_interest', displayValue(lead?.vehicleInterest), nextValues.vehicleInterest],
    ['Employment', 'employmentStatus', 'employment_status', displayValue(lead?.employmentStatus), nextValues.employmentStatus],
    ['Monthly income', 'monthlyIncome', 'monthly_income', lead?.monthlyIncome ?? null, nextValues.monthlyIncome],
    ['Down payment', 'downPayment', 'down_payment', lead?.downPayment ?? null, nextValues.downPayment],
    ['Credit', 'creditScore', 'credit_score', displayValue(lead?.creditScore), nextValues.creditScore],
    ['Received date', 'createdAt', 'created_at', dateInputValue(lead?.createdAt), dateInputValue(nextValues.createdAt)],
    ['Source', 'message', 'message', sourceDisplay(currentSource, currentCustomSource), sourceDisplay(nextSource, nextCustomSource)],
  ]

  const payload = {}
  const localUpdate = {}
  const changes = []

  fieldMap.forEach(([label, localKey, column, from, to]) => {
    if (sameValue(from, to)) return
    payload[column] = column === 'created_at' ? nextValues.createdAt : column === 'message' ? nextValues.message : nextValues[localKey]
    localUpdate[localKey] = localKey === 'createdAt' ? nextValues.createdAt : localKey === 'message' ? nextValues.message : nextValues[localKey]
    changes.push({ field: label, from, to })
  })

  if (notesEnabled && changes.length > 0) {
    payload.admin_notes = changes.reduce((notes, change) => appendLeadUpdateTranscriptNote(
      notes,
      { ...change, actor },
      timestamp
    ), lead?.adminNotes || '')
    localUpdate.adminNotes = payload.admin_notes
  }

  return {
    hasChanges: changes.length > 0,
    payload,
    localUpdate,
    changes,
  }
}
