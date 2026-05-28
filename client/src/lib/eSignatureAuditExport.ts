export type AuditTraceRow = {
  time: string
  user: string
  user_email: string
  action: string
  activity: string
  ip: string
  device: string
  status: string
}

const headers = ['Time', 'User', 'Email', 'Action', 'Activity', 'IP Address', 'Device', 'Status']

const csvCell = (value: unknown) => {
  const text = String(value ?? '')
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export function buildAuditTraceCsv(rows: AuditTraceRow[]): string {
  const body = rows.map((row) => [
    row.time,
    row.user,
    row.user_email,
    row.action,
    row.activity,
    row.ip,
    row.device,
    row.status,
  ].map(csvCell).join(','))

  return [headers.join(','), ...body].join('\n')
}

