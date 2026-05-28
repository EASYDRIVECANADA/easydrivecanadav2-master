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

export const resolveLeadFinanceManager = (currentManager, actor) => {
  const existing = cleanLeadText(currentManager)
  if (existing) return existing

  const next = cleanLeadText(actor)
  return next || null
}

export const displayLeadTranscriptAuthor = (actor, financeManager = '') => {
  const author = cleanLeadText(actor)
  if (author) return author

  const manager = cleanLeadText(financeManager)
  return manager ? `Author not recorded · Finance Manager: ${manager}` : 'Author not recorded'
}

export const formatLeadNoteTimestamp = (date = new Date()) =>
  date.toLocaleString('en-CA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })

export const appendLeadTranscriptNote = (existingNotes, note, timestamp = formatLeadNoteTimestamp(), actor = '') => {
  const current = cleanLeadText(existingNotes)
  const text = cleanLeadText(note)
  if (!text) return current || null

  const author = cleanLeadText(actor)
  const entryText = author ? `Note by ${author}: ${text}` : text
  const entry = `[${cleanLeadText(timestamp)}] ${entryText}`
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
        return { timestamp: 'Legacy note', body: entry, isLegacy: true, kind: 'legacy', actor: '' }
      }
      const body = cleanLeadText(timestampMatch[2])
      const noteMatch = body.match(/^Note by ([^:]+):\s*([\s\S]*)$/i)
      if (noteMatch) {
        return {
          timestamp: cleanLeadText(timestampMatch[1]),
          body: cleanLeadText(noteMatch[2]),
          isLegacy: false,
          kind: 'note',
          actor: cleanLeadText(noteMatch[1]),
        }
      }

      const statusMatch = body.match(/^Status updated(?: by ([^:]+))?:\s*([\s\S]*)$/i)
      if (statusMatch) {
        return {
          timestamp: cleanLeadText(timestampMatch[1]),
          body: cleanLeadText(statusMatch[2]),
          isLegacy: false,
          kind: 'status',
          actor: cleanLeadText(statusMatch[1]),
        }
      }

      return {
        timestamp: cleanLeadText(timestampMatch[1]),
        body,
        isLegacy: false,
        kind: 'note',
        actor: '',
      }
    })
}

export const shouldOpenLeadDetailsFromRowClick = (target) => {
  if (!target || typeof target.closest !== 'function') return true
  return !target.closest('[data-lead-row-action]')
}
