export type ESignatureField = {
  id: string
  type: string
  x: number
  y: number
  width: number
  height: number
  page?: number
  value?: string
  fileIndex?: number
  recipientIndex?: number
}

export type EnvelopeDocument = {
  fileIndex: number
  name: string
  source: string
  mime?: string
}

export type RenderedDocumentPages = {
  fileIndex: number
  name: string
  pages: string[]
}

export type RenderedPage = {
  globalPageIndex: number
  globalPageNumber: number
  fileIndex: number
  pageNumber: number
  documentName: string
  url: string
}

const requiredFieldTypes = new Set(['signature', 'initial'])

export function parseEnvelopeDocuments(documentFile: unknown): EnvelopeDocument[] {
  const raw = String(documentFile || '').trim()
  if (!raw) return []

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    parsed = raw
  }

  const entries = Array.isArray(parsed) ? parsed : [parsed]
  return entries
    .map((entry, index): EnvelopeDocument | null => {
      if (typeof entry === 'string') {
        return { fileIndex: index, name: `Document ${index + 1}`, source: entry }
      }

      const row = entry && typeof entry === 'object' ? entry as Record<string, unknown> : {}
      const source = String(row.url || row.file_b64 || row.file || '').trim()
      if (!source) return null

      return {
        fileIndex: index,
        name: String(row.file_name || row.name || `Document ${index + 1}`),
        source,
        mime: row.file_type ? String(row.file_type) : undefined,
      }
    })
    .filter((doc): doc is EnvelopeDocument => Boolean(doc))
}

export function buildRenderedPageSequence(documents: RenderedDocumentPages[]): RenderedPage[] {
  const pages: RenderedPage[] = []
  for (const document of documents) {
    document.pages.forEach((url, pageIndex) => {
      pages.push({
        globalPageIndex: pages.length,
        globalPageNumber: pages.length + 1,
        fileIndex: document.fileIndex,
        pageNumber: pageIndex + 1,
        documentName: document.name,
        url,
      })
    })
  }
  return pages
}

export function getFieldsForRenderedPage(fields: ESignatureField[], page: RenderedPage): ESignatureField[] {
  return fields.filter((field) =>
    (field.fileIndex ?? 0) === page.fileIndex &&
    (field.page ?? 1) === page.pageNumber
  )
}

export function getRequiredFieldsInSigningOrder(fields: ESignatureField[]): ESignatureField[] {
  return fields
    .filter((field) => requiredFieldTypes.has(field.type))
    .sort((a, b) =>
      (a.fileIndex ?? 0) - (b.fileIndex ?? 0) ||
      (a.page ?? 1) - (b.page ?? 1) ||
      a.y - b.y ||
      a.x - b.x ||
      a.id.localeCompare(b.id)
    )
}

export function getNextRequiredField(fields: ESignatureField[], afterFieldId?: string): ESignatureField | null {
  const required = getRequiredFieldsInSigningOrder(fields)
  const unsigned = (field: ESignatureField) => !String(field.value || '').trim()

  if (!afterFieldId) return required.find(unsigned) || null

  const currentIndex = required.findIndex((field) => field.id === afterFieldId)
  const afterCurrent = required.slice(Math.max(0, currentIndex + 1)).find(unsigned)
  return afterCurrent || required.find(unsigned) || null
}
