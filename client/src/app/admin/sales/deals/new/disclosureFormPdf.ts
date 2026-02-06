import jsPDF from 'jspdf'

export interface DisclosureFormData {
  dealDate: string
  stockNumber: string
  year: string
  make: string
  model: string
  trim: string
  colour: string
  vin: string
  odometer: string
  disclosuresText: string
}

function fmt(v: string | number | null | undefined): string {
  if (v === null || v === undefined || v === '') return ''
  return String(v)
}

function stripHtmlToText(html: string): string {
  if (!html) return ''
  return String(html)
    .replace(/<\s*br\s*\/?\s*>/gi, '\n')
    .replace(/<\s*\/p\s*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function renderDisclosureFormPdf(
  doc: jsPDF,
  data: DisclosureFormData,
  opts?: { pageNumber?: number; totalPages?: number }
): void {
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()
  const ML = 36
  const MR = 36
  const CW = W - ML - MR

  const DARK = '#1a1a1a'
  const GRAY = '#666666'
  const LINE = '#c8c8c8'

  const pageNo = opts?.pageNumber ?? 1
  const total = opts?.totalPages ?? 1

  let y = 52

  // Title row
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(DARK)
  doc.setFontSize(14)
  doc.text('Disclosure Form', ML + CW / 2, y, { align: 'center' })
  doc.setFontSize(9)
  doc.text(fmt(data.dealDate), W - MR, y, { align: 'right' })

  y += 24

  // Vehicle info table (2 rows x 4 columns)
  const colW = CW / 4
  const rowH = 34
  const tableX = ML

  const drawCell = (cx: number, cy: number, label: string, value: string) => {
    doc.setDrawColor(LINE)
    doc.setLineWidth(0.6)
    doc.rect(cx, cy, colW, rowH)
    doc.setFontSize(6)
    doc.setTextColor(GRAY)
    doc.text(label, cx + 6, cy + 12)
    doc.setFontSize(8.5)
    doc.setTextColor(DARK)
    doc.text(value || '', cx + 6, cy + 26)
  }

  const topY = y
  drawCell(tableX + colW * 0, topY, 'Stock #', fmt(data.stockNumber))
  drawCell(tableX + colW * 1, topY, 'Year', fmt(data.year))
  drawCell(tableX + colW * 2, topY, 'Make', fmt(data.make))
  drawCell(tableX + colW * 3, topY, 'Model', fmt(data.model))

  const row2Y = topY + rowH
  drawCell(tableX + colW * 0, row2Y, 'VIN', fmt(data.vin))
  drawCell(tableX + colW * 1, row2Y, 'Trim', fmt(data.trim))
  drawCell(tableX + colW * 2, row2Y, 'Colour', fmt(data.colour))
  drawCell(tableX + colW * 3, row2Y, 'Odometer', fmt(data.odometer))

  y = row2Y + rowH + 26

  // Disclosures
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(DARK)
  doc.text('Disclosures', ML, y)
  y += 16

  doc.setFontSize(8.5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(DARK)
  const discText = stripHtmlToText(data.disclosuresText)
  const discLines = doc.splitTextToSize(discText || '', CW)
  doc.text(discLines.length ? discLines : [''], ML, y)
  y += Math.max(1, discLines.length) * 12 + 18

  // Warranty & Insurance
  doc.setFontSize(10)
  doc.text('Warranty & Insurance', ML, y)
  y += 14

  const wiRowH = 28
  const wiColW = CW / 3
  const wiX = ML

  const drawWi = (cx: number, cy: number, left: string, right: string) => {
    doc.setDrawColor(LINE)
    doc.setLineWidth(0.6)
    doc.rect(cx, cy, wiColW, wiRowH)
    doc.setFontSize(7)
    doc.setTextColor(DARK)
    doc.text(left, cx + 8, cy + 18)
    doc.setFont('helvetica', 'italic')
    doc.text(right, cx + wiColW - 8, cy + 18, { align: 'right' })
    doc.setFont('helvetica', 'normal')
  }

  const wiY = y
  drawWi(wiX + wiColW * 0, wiY, 'Extended Warranty', 'Declined')
  drawWi(wiX + wiColW * 1, wiY, 'Life Insurance', 'Declined')
  drawWi(wiX + wiColW * 2, wiY, 'Walkaway Insurance', 'Declined')

  const wiY2 = wiY + wiRowH
  drawWi(wiX + wiColW * 0, wiY2, 'Gap Insurance', 'Declined')
  drawWi(wiX + wiColW * 1, wiY2, 'Disability Insurance', 'Declined')
  drawWi(wiX + wiColW * 2, wiY2, 'C/S & Injury Insurance', 'Declined')

  y = wiY2 + wiRowH + 22

  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.text('By signing below, I confirm that I have carefully reviewed this document.', ML, y)
  doc.setFont('helvetica', 'normal')
  y += 28

  // Signature lines
  const lineW = (CW - 60) / 3
  const gap = 30
  const lineY1 = y

  const sig = (label: string, x: number, yPos: number, rightText?: string) => {
    doc.setDrawColor(DARK)
    doc.setLineWidth(0.6)
    doc.line(x, yPos, x + lineW, yPos)
    doc.setFontSize(7)
    doc.setTextColor(DARK)
    doc.text(label, x, yPos + 14)
    if (rightText) doc.text(rightText, x, yPos + 14)
  }

  // Row 1: Customer / Signature / Date
  sig('Customer:', ML, lineY1)
  sig('Signature:', ML + lineW + gap, lineY1)
  sig(`Date: ${fmt(data.dealDate)}`, ML + (lineW + gap) * 2, lineY1)

  // Row 2: Witness / Signature / Date
  const lineY2 = lineY1 + 32
  sig('Witness:', ML, lineY2)
  sig('Signature:', ML + lineW + gap, lineY2)
  sig(`Date: ${fmt(data.dealDate)}`, ML + (lineW + gap) * 2, lineY2)

  // Page number
  doc.setFontSize(7)
  doc.setTextColor('#999999')
  doc.text(`${pageNo}/${total}`, W - MR, H - 20, { align: 'right' })
}
