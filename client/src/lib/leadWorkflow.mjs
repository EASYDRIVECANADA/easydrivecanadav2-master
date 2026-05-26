export const LEAD_MANAGER_STATUSES = [
  'New Credit App',
  'No Contact',
  'Need More Information',
  'In Talks',
  'App Submitted',
  'Not Qualified',
  'Conditional Approval',
  'Booked',
]

const LEGACY_STATUS_MAP = new Map([
  ['AWAITING', 'Need More Information'],
  ['AWAITING DECISION', 'Need More Information'],
  ['PENDING', 'In Talks'],
  ['PROCESSING', 'App Submitted'],
  ['PENDING (BHPH)', 'App Submitted'],
  ['DECLINED', 'Not Qualified'],
  ['BOOKED', 'Booked'],
])

export const cleanLeadText = (value) => String(value ?? '').trim()

export const normalizeLeadManagerStatus = (value) => {
  const raw = cleanLeadText(value)
  if (!raw) return null

  const exact = LEAD_MANAGER_STATUSES.find((status) => status.toLowerCase() === raw.toLowerCase())
  if (exact) return exact

  return LEGACY_STATUS_MAP.get(raw.toUpperCase()) ?? null
}

export const formatLeadNoteTimestamp = (date = new Date()) =>
  date.toLocaleString('en-CA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })

export const appendLeadTranscriptNote = (existingNotes, note, timestamp = formatLeadNoteTimestamp()) => {
  const current = cleanLeadText(existingNotes)
  const text = cleanLeadText(note)
  if (!text) return current || null

  const entry = `[${cleanLeadText(timestamp)}] ${text}`
  return current ? `${current}\n\n${entry}` : entry
}
