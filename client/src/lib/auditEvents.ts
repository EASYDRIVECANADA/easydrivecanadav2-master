export type AuditEventInput = {
  module?: unknown
  action?: unknown
  summary?: unknown
  actor_name?: unknown
  actor_email?: unknown
  record_type?: unknown
  record_id?: unknown
  ip_address?: unknown
  user_agent?: unknown
  metadata?: unknown
}

export type AuditEventRow = {
  id?: string
  created_at?: string
  module?: string
  action?: string
  summary?: string
  actor_name?: string
  actor_email?: string
  record_type?: string
  record_id?: string
  ip_address?: string
  user_agent?: string
  metadata?: Record<string, unknown>
}

export type AuditEventFilters = {
  module?: string
  action?: string
  actor?: string
  q?: string
  startDate?: string
  endDate?: string
  limit?: number
}

const AUDIT_CSV_HEADERS = [
  'Time',
  'Module',
  'Action',
  'Summary',
  'Actor',
  'Actor Email',
  'Record Type',
  'Record ID',
  'IP Address',
  'Device',
]

const cleanText = (value: unknown) => String(value ?? '').trim()

const cleanEmail = (value: unknown) => cleanText(value).toLowerCase()

const normalizeMetadata = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return value as Record<string, unknown>
}

export function normalizeAuditEventPayload(input: AuditEventInput) {
  return {
    module: cleanText(input.module),
    action: cleanText(input.action),
    summary: cleanText(input.summary),
    actor_name: cleanText(input.actor_name),
    actor_email: cleanEmail(input.actor_email),
    record_type: cleanText(input.record_type),
    record_id: cleanText(input.record_id),
    ip_address: cleanText(input.ip_address),
    user_agent: cleanText(input.user_agent),
    metadata: normalizeMetadata(input.metadata),
  }
}

const encoded = (value: string) => encodeURIComponent(value)

const wildcard = (value: string) => `*${encoded(value)}*`

const dayStart = (date: string) => {
  const clean = cleanText(date)
  return clean ? new Date(`${clean}T00:00:00.000Z`).toISOString() : ''
}

const dayEnd = (date: string) => {
  const clean = cleanText(date)
  return clean ? new Date(`${clean}T23:59:59.999Z`).toISOString() : ''
}

export function buildAuditEventsQuery(filters: AuditEventFilters = {}) {
  const parts = ['select=*', 'order=created_at.desc']
  const limit = Math.min(Math.max(Number(filters.limit) || 100, 1), 500)
  parts.push(`limit=${limit}`)

  const auditModule = cleanText(filters.module)
  if (auditModule) parts.push(`module=eq.${encoded(auditModule)}`)

  const action = cleanText(filters.action)
  if (action) parts.push(`action=eq.${encoded(action)}`)

  const actor = cleanText(filters.actor)
  if (actor) parts.push(`actor_email=ilike.${wildcard(actor)}`)

  const startDate = dayStart(cleanText(filters.startDate))
  if (startDate) parts.push(`created_at=gte.${encoded(startDate)}`)

  const endDate = dayEnd(cleanText(filters.endDate))
  if (endDate) parts.push(`created_at=lte.${encoded(endDate)}`)

  const q = cleanText(filters.q)
  if (q) {
    const term = wildcard(q)
    parts.push(`or=(summary.ilike.${term},actor_email.ilike.${term},record_id.ilike.${term},action.ilike.${term})`)
  }

  return parts.join('&')
}

const csvCell = (value: unknown) => {
  const text = String(value ?? '')
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export function buildAuditTrailCsv(rows: AuditEventRow[]): string {
  const body = rows.map((row) => [
    row.created_at || '',
    row.module || '',
    row.action || '',
    row.summary || '',
    row.actor_name || '',
    row.actor_email || '',
    row.record_type || '',
    row.record_id || '',
    row.ip_address || '',
    row.user_agent || '',
  ].map(csvCell).join(','))

  return [AUDIT_CSV_HEADERS.join(','), ...body].join('\n')
}
