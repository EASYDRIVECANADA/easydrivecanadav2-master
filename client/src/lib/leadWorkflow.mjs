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

const auditValue = (value) => cleanLeadText(value) || 'cleared'

export const appendLeadUpdateTranscriptNote = (existingNotes, update, timestamp = formatLeadNoteTimestamp()) => {
  const field = cleanLeadText(update?.field)
  if (!field) return cleanLeadText(existingNotes) || null
  const actor = cleanLeadText(update?.actor)
  const actorText = actor ? ` by ${actor}` : ''

  return appendLeadTranscriptNote(
    existingNotes,
    `${field} updated${actorText}: ${auditValue(update?.from)} -> ${auditValue(update?.to)}`,
    timestamp
  )
}

export const parseLeadTranscriptEntries = (notes) => {
  const transcript = cleanLeadText(notes)
  if (!transcript) return []

  return transcript
    .split(/\n{2,}/)
    .map((entry) => cleanLeadText(entry))
    .filter(Boolean)
    .map((entry) => {
      const timestampMatch = entry.match(/^\[([^\]]+)\]\s*([\s\S]*)$/)
      if (!timestampMatch) {
        return { timestamp: 'Legacy note', body: entry, isLegacy: true }
      }

      return {
        timestamp: cleanLeadText(timestampMatch[1]),
        body: cleanLeadText(timestampMatch[2]),
        isLegacy: false,
      }
    })
}

export const shouldOpenLeadDetailsFromRowClick = (target) => {
  if (!target || typeof target.closest !== 'function') return true
  return !target.closest('[data-lead-row-action]')
}
