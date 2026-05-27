type PdfTextFitDoc = {
  getFontSize?: () => number
  setFontSize: (size: number) => unknown
  getTextWidth: (text: string) => number
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
