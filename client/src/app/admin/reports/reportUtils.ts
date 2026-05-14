export const getToday = () => new Date().toISOString().slice(0, 10)

export const getFirstDayOfMonth = () => {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
}

const csvCell = (value: unknown) => {
  const raw = String(value ?? '')
  return `"${raw.replace(/"/g, '""')}"`
}

export function exportRowsToCsv<T extends Record<string, unknown>>(
  filename: string,
  rows: T[],
  columns: { key: keyof T; label: string }[]
) {
  if (typeof window === 'undefined') return
  const header = columns.map((c) => csvCell(c.label)).join(',')
  const body = rows.map((row) => columns.map((c) => csvCell(row[c.key])).join(',')).join('\n')
  const blob = new Blob([[header, body].filter(Boolean).join('\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${filename}.csv`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export function printReport() {
  if (typeof window !== 'undefined') window.print()
}
