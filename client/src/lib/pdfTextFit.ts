type PdfTextFitDoc = {
  getFontSize?: () => number
  setFontSize: (size: number) => unknown
  getTextWidth: (text: string) => number
  splitTextToSize?: (text: string, maxWidth: number) => string[]
}

type FitPdfCellTextOptions = {
  minFontSize?: number
  step?: number
}

export function fitPdfCellText(
  doc: PdfTextFitDoc,
  value: string | number | null | undefined,
  maxWidth: number,
  options: FitPdfCellTextOptions = {}
): { text: string; fontSize: number } {
  const text = value === null || value === undefined ? '' : String(value)
  const currentFontSize = doc.getFontSize?.() ?? 7
  const minFontSize = options.minFontSize ?? 5
  const step = options.step ?? 0.25

  if (!text || maxWidth <= 0) return { text: '', fontSize: currentFontSize }

  for (let size = currentFontSize; size >= minFontSize; size = Number((size - step).toFixed(2))) {
    doc.setFontSize(size)
    if (doc.getTextWidth(text) <= maxWidth) return { text, fontSize: size }
  }

  doc.setFontSize(minFontSize)
  if (doc.getTextWidth(text) <= maxWidth) return { text, fontSize: minFontSize }

  const suffix = '...'
  let clipped = text
  while (clipped.length > 0 && doc.getTextWidth(clipped + suffix) > maxWidth) {
    clipped = clipped.slice(0, -1)
  }

  return { text: clipped ? clipped.trimEnd() + suffix : '', fontSize: minFontSize }
}

type WrapPdfCellTextOptions = {
  fontSize?: number
  maxLines?: number
}

export function wrapPdfCellText(
  doc: PdfTextFitDoc,
  value: string | number | null | undefined,
  maxWidth: number,
  options: WrapPdfCellTextOptions = {}
): { lines: string[]; fontSize: number } {
  const text = value === null || value === undefined ? '' : String(value).trim()
  const fontSize = options.fontSize ?? doc.getFontSize?.() ?? 7

  if (!text || maxWidth <= 0) return { lines: [], fontSize }

  doc.setFontSize(fontSize)
  const rawLines = doc.splitTextToSize
    ? doc.splitTextToSize(text, maxWidth)
    : splitByMeasuredWords(doc, text, maxWidth)

  const lines = rawLines.flatMap((line) => splitWideLine(doc, line, maxWidth))
  return { lines, fontSize }
}

function splitByMeasuredWords(doc: PdfTextFitDoc, text: string, maxWidth: number): string[] {
  return text.split(/\s+/).reduce<string[]>((lines, word) => {
    const current = lines[lines.length - 1] || ''
    const next = current ? `${current} ${word}` : word
    if (!current || doc.getTextWidth(next) <= maxWidth) {
      lines[lines.length - 1] = next
    } else {
      lines.push(word)
    }
    return lines
  }, ['']).filter(Boolean)
}

function splitWideLine(doc: PdfTextFitDoc, line: string, maxWidth: number): string[] {
  if (doc.getTextWidth(line) <= maxWidth) return [line]

  const parts = line
    .replace(/\s*-\s*/g, ' - ')
    .split(/\s+/)
    .filter(Boolean)

  return parts.length > 1 ? parts : [fitPdfCellText(doc, line, maxWidth).text]
}
