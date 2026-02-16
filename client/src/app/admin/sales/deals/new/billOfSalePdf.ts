import jsPDF from 'jspdf'

export interface BillOfSaleData {
  // Header
  dealDate: string
  invoiceNumber: string

  // Purchaser
  fullName: string
  phone: string
  mobile: string
  email: string
  address: string
  city: string
  province: string
  postalCode: string
  driversLicense: string
  insuranceCompany: string
  policyNumber: string
  policyExpiry: string

  // Vehicle
  stockNumber: string
  year: string
  make: string
  model: string
  trim: string
  colour: string
  keyNumber: string
  vin: string
  odometerStatus: string
  odometer: string
  serviceDate: string
  deliveryDate: string

  // Settlement
  vehiclePrice: string
  omvicFee: string
  subtotal1: string
  netDifference: string
  hstOnNetDifference: string
  totalTax: string
  licenseFee: string
  feesTotal: string
  accessoriesTotal: string
  warrantiesTotal: string
  insurancesTotal: string
  paymentsTotal: string
  subtotal2: string
  deposit: string
  downPayment: string
  taxOnInsurance: string
  totalBalanceDue: string

  // Extended warranty
  extendedWarranty: string

  // Comments & Disclosures
  commentsHtml: string

  // Signatures
  purchaserName: string
  purchaserSignatureB64?: string
  salesperson: string
  salespersonRegNo: string
  acceptorName: string
  acceptorRegNo: string
}

function fmt(v: string | number | null | undefined): string {
  if (v === null || v === undefined || v === '') return ''
  return String(v)
}

function fmtMoney(v: string | number | null | undefined): string {
  const n = Number(v)
  if (isNaN(n)) return '$0.00'
  return '$' + n.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtMoneyNoSign(v: string | number | null | undefined): string {
  const n = Number(v)
  if (isNaN(n)) return '0.00'
  return n.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function renderBillOfSalePdf(
  doc: jsPDF,
  data: BillOfSaleData,
  opts?: { pageStart?: number; totalPages?: number }
): void {
  const W = doc.internal.pageSize.getWidth()   // 612
  const H = doc.internal.pageSize.getHeight()  // 792
  const ML = 36  // margin left
  const MR = 36  // margin right
  const CW = W - ML - MR  // content width

  const pageStart = opts?.pageStart ?? 1
  const totalPages = opts?.totalPages ?? 3

  const BLUE = '#1a6fb5'
  const DARK = '#1a1a1a'
  const GRAY_LINE = '#999999'
  const HEADER_BG = '#1a6fb5'
  const LIGHT_BG = '#f0f4f8'

  const paraBlockW = CW * 0.9
  const paraX = ML + (CW - paraBlockW) / 2
  const writePara = (text: string, x: number, yPos: number, fontSize: number, lineH: number, align: 'left' | 'center' = 'left') => {
    doc.setFontSize(fontSize)
    const lines = doc.splitTextToSize(text, align === 'center' ? paraBlockW : CW)
    doc.text(lines, align === 'center' ? x + paraBlockW / 2 : x, yPos, { align: align === 'center' ? 'center' : 'left', maxWidth: align === 'center' ? paraBlockW : CW })
    return yPos + lines.length * lineH
  }

  // ─── PAGE 1 ───────────────────────────────────────────────────────
  let y = 40

  // Logo placeholder (blue EDC text)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(41, 128, 205)
  doc.setFontSize(24)
  doc.text('EDC', ML, y + 22)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6)
  doc.text('EASYDRIVE CANADA', ML, y + 32)

  // Company info
  const headerTop = y
  const headerH = 56
  const leftX = ML + 88
  const rightX = W - MR

  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(DARK)
  doc.text('EASYDRIVE CANADA', leftX, headerTop + 10)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.text('4856 Bank St Unit A', leftX, headerTop + 22)
  doc.text('Ottawa ON K1X 1G6', leftX, headerTop + 32)
  doc.text('P: 6138798355', leftX, headerTop + 44)
  doc.text('Tax: 728858937RT0001', leftX, headerTop + 54)

  // Bill of Sale title (right side)
  doc.setFontSize(14)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(DARK)
  doc.text('Bill of Sale', rightX, headerTop + 16, { align: 'right' })

  // Date and INV#
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.text(fmt(data.dealDate), rightX, headerTop + 30, { align: 'right' })
  doc.setFont('helvetica', 'bold')
  doc.text(`INV# ${fmt(data.invoiceNumber)}`, rightX, headerTop + 44, { align: 'right' })

  y = headerTop + headerH + 6

  // ─── PURCHASER INFORMATION ────────────────────────────────────────
  // Header bar
  doc.setFillColor(26, 111, 181)
  doc.rect(ML, y, CW, 14, 'F')
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor('#ffffff')
  doc.text('PURCHASER INFORMATION', ML + CW / 2, y + 10, { align: 'center' })
  y += 14

  // Purchaser row 1: full name | phone | mobile | email
  const pRow1Y = y
  const pCols1 = [0, CW * 0.35, CW * 0.52, CW * 0.69]
  const pWidths1 = [CW * 0.35, CW * 0.17, CW * 0.17, CW * 0.31]

  // Labels
  doc.setFontSize(5.5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(GRAY_LINE)
  doc.text('full name', ML + pCols1[0] + 2, pRow1Y + 8)
  doc.text('phone', ML + pCols1[1] + 2, pRow1Y + 8)
  doc.text('mobile', ML + pCols1[2] + 2, pRow1Y + 8)
  doc.text('email', ML + pCols1[3] + 2, pRow1Y + 8)

  // Values
  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(DARK)
  doc.text(fmt(data.fullName), ML + pCols1[0] + 2, pRow1Y + 20)
  doc.setFont('helvetica', 'normal')
  doc.text(fmt(data.phone), ML + pCols1[1] + 2, pRow1Y + 20)
  doc.text(fmt(data.mobile), ML + pCols1[2] + 2, pRow1Y + 20)
  doc.text(fmt(data.email), ML + pCols1[3] + 2, pRow1Y + 20)

  // Cell borders
  doc.setDrawColor(GRAY_LINE)
  doc.setLineWidth(0.5)
  for (let i = 0; i < 4; i++) {
    doc.rect(ML + pCols1[i], pRow1Y, pWidths1[i], 26)
  }
  y = pRow1Y + 26

  // Purchaser row 2: address | city | province | postal code
  const pRow2Y = y
  const pCols2 = [0, CW * 0.35, CW * 0.55, CW * 0.72]
  const pWidths2 = [CW * 0.35, CW * 0.20, CW * 0.17, CW * 0.28]

  doc.setFontSize(5.5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(GRAY_LINE)
  doc.text('address', ML + pCols2[0] + 2, pRow2Y + 8)
  doc.text('city', ML + pCols2[1] + 2, pRow2Y + 8)
  doc.text('province', ML + pCols2[2] + 2, pRow2Y + 8)
  doc.text('postal code', ML + pCols2[3] + 2, pRow2Y + 8)

  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(DARK)
  doc.text(fmt(data.address), ML + pCols2[0] + 2, pRow2Y + 20)
  doc.text(fmt(data.city), ML + pCols2[1] + 2, pRow2Y + 20)
  doc.text(fmt(data.province) || 'ON', ML + pCols2[2] + 2, pRow2Y + 20)
  doc.text(fmt(data.postalCode), ML + pCols2[3] + 2, pRow2Y + 20)

  for (let i = 0; i < 4; i++) {
    doc.rect(ML + pCols2[i], pRow2Y, pWidths2[i], 26)
  }
  y = pRow2Y + 26

  // Purchaser row 3: driver's license | ins. company | policy # | policy exp.
  const pRow3Y = y
  const pCols3 = [0, CW * 0.30, CW * 0.55, CW * 0.75]
  const pWidths3 = [CW * 0.30, CW * 0.25, CW * 0.20, CW * 0.25]

  doc.setFontSize(5.5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(GRAY_LINE)
  doc.text("driver's license", ML + pCols3[0] + 2, pRow3Y + 8)
  doc.text('ins. company', ML + pCols3[1] + 2, pRow3Y + 8)
  doc.text('policy #', ML + pCols3[2] + 2, pRow3Y + 8)
  doc.text('policy exp.', ML + pCols3[3] + 2, pRow3Y + 8)

  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(DARK)
  doc.text(fmt(data.driversLicense), ML + pCols3[0] + 2, pRow3Y + 20)
  doc.text(fmt(data.insuranceCompany), ML + pCols3[1] + 2, pRow3Y + 20)
  doc.text(fmt(data.policyNumber), ML + pCols3[2] + 2, pRow3Y + 20)
  doc.text(fmt(data.policyExpiry), ML + pCols3[3] + 2, pRow3Y + 20)

  for (let i = 0; i < 4; i++) {
    doc.rect(ML + pCols3[i], pRow3Y, pWidths3[i], 26)
  }
  y = pRow3Y + 26

  // ─── VEHICLE INFORMATION ──────────────────────────────────────────
  y += 2
  doc.setFillColor(26, 111, 181)
  doc.rect(ML, y, CW, 14, 'F')
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor('#ffffff')
  doc.text('VEHICLE INFORMATION', ML + CW / 2, y + 10, { align: 'center' })
  y += 14

  // Vehicle row 1: stock # | year | make | model | trim | colour | key #
  const vRow1Y = y
  const vCols1 = [0, CW * 0.10, CW * 0.18, CW * 0.30, CW * 0.44, CW * 0.68, CW * 0.82]
  const vWidths1 = [CW * 0.10, CW * 0.08, CW * 0.12, CW * 0.14, CW * 0.24, CW * 0.14, CW * 0.18]

  doc.setFontSize(5.5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(GRAY_LINE)
  const vLabels1 = ['stock #', 'year', 'make', 'model', 'trim', 'colour', 'key #']
  for (let i = 0; i < 7; i++) {
    doc.text(vLabels1[i], ML + vCols1[i] + 2, vRow1Y + 8)
  }

  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(DARK)
  const vVals1 = [
    fmt(data.stockNumber), fmt(data.year), fmt(data.make), fmt(data.model),
    fmt(data.trim), fmt(data.colour), fmt(data.keyNumber)
  ]
  for (let i = 0; i < 7; i++) {
    doc.text(vVals1[i], ML + vCols1[i] + 2, vRow1Y + 20)
  }

  doc.setDrawColor(GRAY_LINE)
  for (let i = 0; i < 7; i++) {
    doc.rect(ML + vCols1[i], vRow1Y, vWidths1[i], 26)
  }
  y = vRow1Y + 26

  // Vehicle row 2: vin | odometer/status | service date | delivery date
  const vRow2Y = y
  const v2Cols = [0, CW * 0.30, CW * 0.55, CW * 0.75]
  const v2Widths = [CW * 0.30, CW * 0.25, CW * 0.20, CW * 0.25]

  doc.setFontSize(5.5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(GRAY_LINE)
  doc.text('vin', ML + v2Cols[0] + 2, vRow2Y + 8)
  doc.text('odometer/status', ML + v2Cols[1] + 2, vRow2Y + 8)
  doc.text('service date', ML + v2Cols[2] + 2, vRow2Y + 8)
  doc.text('delivery date', ML + v2Cols[3] + 2, vRow2Y + 8)

  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(DARK)
  doc.text(fmt(data.vin), ML + v2Cols[0] + 2, vRow2Y + 20)
  doc.setFont('helvetica', 'normal')
  doc.text(`${fmt(data.odometerStatus)}     ${fmt(data.odometer)}`, ML + v2Cols[1] + 2, vRow2Y + 20)
  doc.text(fmt(data.serviceDate), ML + v2Cols[2] + 2, vRow2Y + 20)
  doc.text(fmt(data.deliveryDate), ML + v2Cols[3] + 2, vRow2Y + 20)

  doc.setDrawColor(GRAY_LINE)
  for (let i = 0; i < 4; i++) {
    doc.rect(ML + v2Cols[i], vRow2Y, v2Widths[i], 26)
  }
  y = vRow2Y + 26

  // CAMVAP notice
  y += 3
  doc.setFontSize(5.5)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(DARK)
  const camvapText = 'MANUFACTURER DOES NOT PARTICIPATE IN THE CANADIAN MOTOR VEHICLE ARBITRATION PLAN (CAMVAP) CAMVAP STATEMENT ON ADDITIONAL PAGE. (NOT ALL VEHICLES QUALIFY)'
  doc.text(camvapText, ML, y + 6, { maxWidth: CW })
  y += 16

  // ─── EXTENDED WARRANTY + SETTLEMENT TERMS ─────────────────────────
  const ewStartY = y
  const leftColW = CW * 0.48
  const rightColW = CW * 0.52

  // Left: Extended Warranty header
  doc.setFillColor(26, 111, 181)
  doc.rect(ML, y, leftColW, 14, 'F')
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor('#ffffff')
  doc.text('EXTENDED WARRANTY', ML + leftColW / 2, y + 10, { align: 'center' })

  // Right: Settlement Terms header
  doc.setFillColor(26, 111, 181)
  doc.rect(ML + leftColW, y, rightColW, 14, 'F')
  doc.text('SETTLEMENT TERMS', ML + leftColW + rightColW / 2, y + 10, { align: 'center' })
  y += 14

  // Left: DECLINED text
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(DARK)
  doc.text(fmt(data.extendedWarranty) || 'DECLINED', ML + leftColW / 2, y + 12, { align: 'center' })

  // Left: Privacy statement
  const privacyY = y + 20
  doc.setFontSize(5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(DARK)
  const privacyText = 'Privacy Statement: I understand that you and your service providers, affiliates and business partners collect, use and retain my personal information that I disclose to you for the purpose of (i) providing motor vehicle products and related services that I have requested; (ii) providing me with related information and services that you believe may be of interest to me; and (iii) compiling aggregated or statistical data in which will not be personally identifiable. I may notify you in writing at any time if I no longer consent to any of these uses and to update or correct my personal information.'
  doc.text(privacyText, ML + 4, privacyY, { maxWidth: leftColW - 8 })

  // Right: Settlement terms rows
  const stX = ML + leftColW
  const stLabelEnd = stX + rightColW * 0.62   // labels right-align here
  const stValueEnd = stX + rightColW - 6       // values right-align here
  let stY = y + 4

  const omvicNumeric = Number(data.omvicFee)
  const includeOmvic = Number.isFinite(omvicNumeric) && Math.abs(omvicNumeric) > 0.0001

  const hasVal = (v: string | number | null | undefined) => {
    const n = Number(v)
    return Number.isFinite(n) && Math.abs(n) > 0.0001
  }

  const settlementRows: [string, string][] = [
    ['Vehicle Price', fmtMoneyNoSign(data.vehiclePrice)],
    ...(includeOmvic ? [['OMVIC FEE', fmtMoneyNoSign(data.omvicFee)] as [string, string]] : []),
    ['Subtotal', fmtMoneyNoSign(data.subtotal1)],
    ['Net Difference', fmtMoneyNoSign(data.netDifference)],
    ['HST on Net Difference', fmtMoneyNoSign(data.hstOnNetDifference)],
    ['Total Tax', fmtMoneyNoSign(data.totalTax)],
    ['License Fee', fmtMoneyNoSign(data.licenseFee)],
    ...(hasVal(data.feesTotal) ? [['Fees', fmtMoneyNoSign(data.feesTotal)] as [string, string]] : []),
    ...(hasVal(data.accessoriesTotal) ? [['Accessories', fmtMoneyNoSign(data.accessoriesTotal)] as [string, string]] : []),
    ...(hasVal(data.warrantiesTotal) ? [['Warranties', fmtMoneyNoSign(data.warrantiesTotal)] as [string, string]] : []),
    ...(hasVal(data.insurancesTotal) ? [['Insurances', fmtMoneyNoSign(data.insurancesTotal)] as [string, string]] : []),
    ...(hasVal(data.paymentsTotal) ? [['Payments', fmtMoneyNoSign(data.paymentsTotal)] as [string, string]] : []),
    ['Subtotal', fmtMoneyNoSign(data.subtotal2)],
    ['Deposit(s)', fmtMoneyNoSign(data.deposit)],
    ['Down Payment (Payable on Delivery)', fmtMoneyNoSign(data.downPayment)],
    ['Tax on Insurance', fmtMoneyNoSign(data.taxOnInsurance)],
  ]

  doc.setFontSize(7)
  for (const [label, value] of settlementRows) {
    // Label (right-aligned to label column)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(DARK)
    doc.text(label, stLabelEnd, stY + 11, { align: 'right' })

    // Dotted separator
    doc.setDrawColor(GRAY_LINE)
    doc.setLineWidth(0.3)
    doc.setLineDashPattern([1, 1], 0)
    doc.line(stLabelEnd + 2, stY + 13, stValueEnd - doc.getTextWidth('$' + value) - 4, stY + 13)
    doc.setLineDashPattern([], 0)

    // Value (right-aligned to value column)
    doc.setFont('helvetica', 'bold')
    doc.text('$' + value, stValueEnd, stY + 11, { align: 'right' })

    stY += 14
  }

  // Total Balance Due (bold, larger)
  stY += 2
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(DARK)
  doc.text('Total Balance Due', stLabelEnd, stY + 11, { align: 'right' })
  doc.text('$' + fmtMoneyNoSign(data.totalBalanceDue), stValueEnd, stY + 11, { align: 'right' })

  // Draw border around the extended warranty + settlement section
  const ewHeight = stY + 18 - ewStartY
  doc.setDrawColor(GRAY_LINE)
  doc.setLineWidth(0.5)
  doc.rect(ML, ewStartY + 14, leftColW, ewHeight - 14)
  doc.rect(ML + leftColW, ewStartY + 14, rightColW, ewHeight - 14)

  // Initial line at bottom of left box
  const initY = ewStartY + ewHeight - 2
  doc.setFontSize(6)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(DARK)
  doc.text('Initial:', ML + leftColW - 40, initY)
  doc.setDrawColor(DARK)
  doc.line(ML + leftColW - 20, initY + 1, ML + leftColW - 4, initY + 1)

  y = ewStartY + ewHeight + 6

  // ─── COMMENTS & DISCLOSURES ───────────────────────────────────────
  doc.setFillColor(26, 111, 181)
  doc.rect(ML, y, CW, 14, 'F')
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor('#ffffff')
  doc.text('COMMENTS & DISCLOSURES', ML + CW / 2, y + 10, { align: 'center' })
  y += 18

  // SALES FINAL notice
  doc.setFontSize(7)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(DARK)
  const salesFinalBold = 'SALES FINAL'
  const salesFinalRest = ' Please review the entire contract, including all attached statements, before signing. This contract is final and binding once you have signed it unless the motor vehicle dealer has failed to comply with certain legal obligations.'
  const salesFinalFull = `${salesFinalBold}${salesFinalRest}`
  const salesFinalLines = doc.splitTextToSize(salesFinalFull, CW)
  doc.text(salesFinalLines, ML, y + 10)
  y += salesFinalLines.length * 10 + 6

  doc.setFontSize(6)
  doc.setFont('helvetica', 'normal')
  const ack = 'You acknowledge having read all the terms of the contract, including those on the reverse and on attached and or additional pages. You understand these terms make up the entire contract.'
  const ackLines = doc.splitTextToSize(ack, CW)
  doc.text(ackLines, ML, y + 10)
  y += ackLines.length * 9 + 10

  // Signatures
  doc.setDrawColor(DARK)
  doc.setLineWidth(0.5)

  const sigLineY = y + 18
  const leftSigX1 = ML + 60
  const leftSigX2 = ML + CW * 0.48
  const rightSigX1 = ML + CW * 0.52
  const rightSigX2 = ML + CW - 60

  // Draw purchaser signature image if provided
  if (data.purchaserSignatureB64) {
    try {
      const raw = String(data.purchaserSignatureB64)
      const cleaned = raw.replace(/\s+/g, '')

      const isDataUrl = cleaned.startsWith('data:')
      const isJpeg = /data:image\/(jpeg|jpg)/i.test(cleaned)
      const fmt = isJpeg ? 'JPEG' : 'PNG'

      // Bigger so it's clearly visible in print
      const sigW = 120
      const sigH = 34
      const sigX = leftSigX1
      const sigY = sigLineY - sigH + 2

      if (isDataUrl) {
        doc.addImage(cleaned, fmt as any, sigX, sigY, sigW, sigH)
      } else {
        // Some jsPDF builds work best with raw base64 (no data: prefix)
        try {
          doc.addImage(cleaned, fmt as any, sigX, sigY, sigW, sigH)
        } catch {
          const dataUrl = `data:image/${isJpeg ? 'jpeg' : 'png'};base64,${cleaned}`
          doc.addImage(dataUrl, fmt as any, sigX, sigY, sigW, sigH)
        }
      }
    } catch (err) {
      console.error('Failed to add purchaser signature to PDF:', err)
    }
  }

  doc.line(leftSigX1, sigLineY, leftSigX2, sigLineY)
  doc.line(rightSigX1, sigLineY, rightSigX2, sigLineY)

  doc.setFontSize(6.5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(DARK)
  doc.text(`Purchaser: ${fmt(data.purchaserName)}`, leftSigX1, sigLineY + 10)
  doc.text(`Salesperson: ${fmt(data.salesperson)}, Reg No. ${fmt(data.salespersonRegNo)}`, rightSigX1, sigLineY + 10)

  const acceptLineY = sigLineY + 26
  const acceptX1 = ML + CW * 0.50
  const acceptX2 = ML + CW - 60
  doc.line(acceptX1, acceptLineY, acceptX2, acceptLineY)
  doc.text(`Acceptor: ${fmt(data.acceptorName)}, Reg No. ${fmt(data.acceptorRegNo)}`, acceptX1, acceptLineY + 10)
  doc.setFontSize(6)
  doc.setFont('helvetica', 'italic')
  doc.text('This offer is not binding unless accepted by vendor.', acceptX1, acceptLineY + 22)

  y = acceptLineY + 30

  // Page number
  doc.setFontSize(7)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(GRAY_LINE)
  doc.text(`${pageStart}/${totalPages}`, W - MR, H - 20, { align: 'right' })

  // ─── PAGE 2 ───────────────────────────────────────────────────────
  doc.addPage()
  y = 40

  const p2Indent = ML + 16
  const p2W = CW - 32
  const p2CenterW = CW * 0.92

  // Main heading — bold black, left-aligned
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(DARK)
  doc.text('IMPORTANT INFORMATION RESPECTING MOTOR VEHICLE SALES MOTOR VEHICLE INSPECTION', p2Indent, y, { maxWidth: p2W })
  y += 20

  // MVI paragraph — centered
  doc.setFontSize(7)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(DARK)
  const mviText = 'A Motor Vehicle Inspection or MVI (described as "safety standards certificate" above or on page 1) is only an indication that the motor vehicle met certain basic standards of vehicle safety inspection on the date of inspection.'
  const mviLines = doc.splitTextToSize(mviText, p2CenterW)
  doc.text(mviLines, ML + CW / 2, y, { align: 'center', maxWidth: p2CenterW })
  y += mviLines.length * 9 + 14

  // TERMS AND CONDITIONS heading — bold black
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(DARK)
  doc.text('TERMS AND CONDITIONS', p2Indent, y)
  y += 16

  // Terms 1-4
  doc.setFontSize(7)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(DARK)

  const p2Terms = [
    '1. Trade-in Vehicle: Any vehicle you trade-in shall be equipped and in the same condition, other than reasonable wear and tear at the time of delivery to the dealer, as it was at the date of this agreement. You agree to be responsible for any repairs or maintenance needed to maintain this condition until the delivery date. If the trade-in vehicle has been damaged between the date of this agreement and the delivery date, or is in need of repair, the dealer may cancel this agreement and deduct any damages from the deposit or, if you agree, may reduce the amount of the trade-in allowance to compensate for the repairs needed. You also agree that you will be liable to compensate the dealer for any loss suffered because of any misrepresentation about the declared distance travelled, the declared prior use, or the condition of the vehicle traded-in.',
    '2. Taxes and Financing: You agree to pay the dealer an amount equal to any increase in taxes payable relating to the purchase of the vehicle, between the date of this agreement and delivery of the vehicle to you. Should the amount of tax payable reduced, the dealer agrees to deduct this amount from the total amount owed by you. You agree that you will be responsible for any damages suffered by the dealer if a financing contract cannot be arranged because of any default or misrepresentation by you.',
    '3. Legal Ownership and Purchaser\'s Obligations: Legal ownership of the vehicle shall not pass to you until the entire purchase price has been paid in full. You agree that until that time, you shall: (a) Maintain insurance on the vehicle with the dealer as the named beneficiary in the event of a loss; (b) Not sell or transfer the vehicle to anyone else; (c) Not allow any lien or other interest to be taken in or against the vehicle; (d) Not allow the vehicle to be used in the commission of any illegal act; and (e) Reimburse the dealer for any costs the dealer may incur due to your failure to comply with any of (a), (b), (c) or (d) above.',
    '4. Acceptance by Purchaser: If you refuse to take delivery of the vehicle when it is made available to you, or on the delivery date specified in this agreement, the dealer shall notify you, by registered mail, sent to your last address known to the dealer, that the vehicle is available for delivery. If you fail to take delivery of the vehicle within seven (7) days of signed receipt of this notice, or if the notice is returned to the dealer unclaimed, the dealer may resell the vehicle with no further notice to you. When the dealer resells the vehicle, you agree to pay the dealer for all losses the dealer incurs. Any deposit or vehicle trade-in may be kept by the dealer to apply against any loss suffered by the dealer. If the loss is greater than the total of the amount paid as a deposit and the value of the trade-in, you agree to pay the difference to the dealer. The dealer agrees to provide you with a detailed accounting of the resale and a list of expenses incurred. The dealer shall maintain the right to use any legal means available to collect any sum owing by you under this agreement.',
  ]

  for (const term of p2Terms) {
    const lines = doc.splitTextToSize(term, p2W)
    const blockH = lines.length * 9
    if (y + blockH > H - 60) {
      doc.addPage()
      y = 40
    }
    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(DARK)
    doc.text(lines, p2Indent, y, { maxWidth: p2W })
    y += blockH + 6
  }

  // CANADIAN MOTOR VEHICLE ARBITRATION PLAN — bold black
  y += 4
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(DARK)
  doc.text('CANADIAN MOTOR VEHICLE ARBITRATION PLAN', p2Indent, y)
  y += 14

  doc.setFontSize(7)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(DARK)
  const camvapPlan = 'The Canadian Motor Vehicle Arbitration Plan may be available to resolve disputes concerning alleged manufacturer\'s defects or implementation of the manufacturer\'s new motor vehicle warranty. Only vehicles less than 5 years old that have been driven less than 160,000 KM qualify.'
  const camvapLines = doc.splitTextToSize(camvapPlan, p2CenterW)
  doc.text(camvapLines, ML + CW / 2, y, { align: 'center', maxWidth: p2CenterW })
  y += camvapLines.length * 9 + 10

  // OR CANADIAN MOTOR VEHICLE ARBITRATION PLAN NOT AVAILABLE — bold black
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(DARK)
  doc.text('OR CANADIAN MOTOR VEHICLE ARBITRATION PLAN NOT AVAILABLE', p2Indent, y)
  y += 14

  doc.setFontSize(7)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(DARK)
  const notAvailText = 'The manufacturer of this vehicle is not a participant in the Canadian Motor Vehicle Arbitration Plan. Therefore, the program under that plan is not available to resolve disputes concerning alleged manufacturer\'s defects or implementation of the manufacturer\'s new motor vehicle warranty. Currently, BMW, Mitsubishi, Suzuki and most exotic foreign sports car manufacturers, do not participate in CAMVAP. Further information can be found at www.camvap.ca.'
  const notAvailLines = doc.splitTextToSize(notAvailText, p2CenterW)
  doc.text(notAvailLines, ML + CW / 2, y, { align: 'center', maxWidth: p2CenterW })
  y += notAvailLines.length * 9 + 20

  // Customer Initials line
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(DARK)
  doc.text('Customer Initials:', p2Indent, y)
  doc.setDrawColor(DARK)
  doc.setLineWidth(0.5)
  doc.line(p2Indent + 74, y + 1, p2Indent + 150, y + 1)

  // Page number
  doc.setFontSize(7)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(GRAY_LINE)
  doc.text(`${pageStart + 1}/${totalPages}`, W - MR, H - 20, { align: 'right' })

  // ─── PAGE 3 ───────────────────────────────────────────────────────
  doc.addPage()
  y = 40

  const p3Indent = ML + 16
  const p3W = CW - 32

  // Heading — centered, black, underlined
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(DARK)
  const p3Title = 'IMPORTANT INFORMATION RESPECTING MOTOR VEHICLE SALES'
  doc.text(p3Title, ML + CW / 2, y, { align: 'center' })
  const p3TitleW = doc.getTextWidth(p3Title)
  doc.setDrawColor(DARK)
  doc.setLineWidth(0.6)
  doc.line(ML + (CW - p3TitleW) / 2, y + 3, ML + (CW + p3TitleW) / 2, y + 3)
  y += 18

  // OMVIC contact paragraph — left-aligned
  doc.setFontSize(6.5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(DARK)
  const importantInfo = 'In case of any concerns with this sale, you should first contact your motor vehicle dealer. If concerns persist, you may contact the Ontario Motor Vehicle Industry Council as the administrative authority designated for administering the Motor Vehicle Dealers Act, 2002. You may be eligible for the compensation from the Motor Vehicle Dealers Compensation Fund, if you suffer a financial loss from this trade and if your dealer is unable or unwilling to make good on the loss. You may have additional rights at law, 65 Overlea Boulevard, Suite 300, Toronto ON M4H 1P1. Contact (Ontario Motor Vehicle Industry Council) Call: 1-416-226-4500 or 1-800-943-6002 or go to www.omvic.on.ca'
  const importLines = doc.splitTextToSize(importantInfo, p3W)
  doc.text(importLines, p3Indent, y, { maxWidth: p3W })
  y += importLines.length * 8.5 + 16

  // SAFETY STANDARDS CERTIFICATE — centered, black, bold, large
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(DARK)
  doc.text('SAFETY STANDARDS CERTIFICATE', ML + CW / 2, y, { align: 'center' })
  y += 16

  // SSC description — left-aligned
  doc.setFontSize(6.5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(DARK)
  const sscText = 'A Safety Standards Certificate is only an indication that the motor vehicle met certain basic standards of vehicle safety on the date of inspection.'
  const sscLines3 = doc.splitTextToSize(sscText, p3W)
  doc.text(sscLines3, p3Indent, y, { maxWidth: p3W })
  y += sscLines3.length * 8.5 + 14

  // Terms and Conditions — centered, black, bold
  doc.setFontSize(15)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(DARK)
  doc.text('Terms and Conditions', ML + CW / 2, y, { align: 'center' })
  y += 18

  // Terms 1-4 — left-aligned, compact
  doc.setFontSize(6.5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(DARK)

  const termsCompact = [
    '1. Trade-in Vehicle: Any vehicle you trade-in shall be equipped and in the same condition, other than reasonable wear and tear at the time of delivery to the dealer, as it was at the date of this agreement. You agree to be responsible for any repairs or maintenance needed to maintain this condition until the delivery date. If the trade-in vehicle has been damaged between the date of this agreement and the delivery date, or is in need of repair, the dealer may cancel this agreement and deduct any damages from the deposit or, if you agree, may reduce the amount of the trade-in allowance to compensate for the repairs needed. You also agree that you will be liable to compensate the dealer for any loss suffered because of any misrepresentation about the declared distance travelled, the declared prior use, or the condition of the vehicle traded-in.',
    '2. Taxes and Financing: You agree to pay the dealer an amount equal to any increase in taxes payable relating to the purchase of the vehicle, between the date of this agreement and delivery of the vehicle to you. Should the amount of tax payable reduced, the dealer agrees to deduct this amount from the total amount owed by you. You agree that you will be responsible for any damages suffered by the dealer if a financing contract cannot be arranged because of any default or misrepresentation by you.',
    '3. Legal Ownership and Purchaser\'s Obligations: Legal ownership of the vehicle shall not pass to you until the entire purchase price has been paid in full. You agree that until that time, you shall: (a) Maintain insurance on the vehicle with the dealer as the named beneficiary in the event of a loss; (b) Not sell or transfer the vehicle to anyone else; (c) Not allow any lien or other interest to be taken in or against the vehicle; (d) Not allow the vehicle to be used in the commission of any illegal act; and (e) Reimburse the dealer for any costs the dealer may incur due to your failure to comply with any of (a), (b), (c) or (d) above.',
    '4. Acceptance by Purchaser: If you refuse to take delivery of the vehicle when it is made available to you, or on the delivery date specified in this agreement, the dealer shall notify you, by registered mail, sent to your last address known to the dealer, that the vehicle is available for delivery. If you fail to take delivery of the vehicle within seven (7) days of signed receipt of this notice, or if the notice is returned to the dealer unclaimed, the dealer may resell the vehicle with no further notice to you. When the dealer resells the vehicle, you agree to pay the dealer for all losses the dealer incurs. Any deposit or vehicle tradein may be kept by the dealer to apply against any loss suffered by the dealer. If the loss is greater than the total of the amount paid as a deposit and the value of the trade-in, you agree to pay the difference to the dealer. The dealer agrees to provide you with a detailed accounting of the resale and a list of expenses incurred. The dealer shall maintain the right to use any legal means available to collect any sum owing by you under this agreement.',
  ]

  for (const term of termsCompact) {
    const lines = doc.splitTextToSize(term, p3W)
    const blockH = lines.length * 8.5
    if (y + blockH > H - 120) {
      doc.addPage()
      y = 40
    }
    doc.setFontSize(6.5)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(DARK)
    doc.text(lines, p3Indent, y, { maxWidth: p3W })
    y += blockH + 4
  }

  // CANADIAN MOTOR VEHICLE ARBITRATION PLAN — centered, black, bold
  y += 10
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(DARK)
  doc.text('CANADIAN MOTOR VEHICLE ARBITRATION PLAN', ML + CW / 2, y, { align: 'center' })
  y += 16

  // CAMVAP description — left-aligned
  doc.setFontSize(6.5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(DARK)
  const camvapPlan2 = 'The Canadian Motor Vehicle Arbitration Plan may be available to resolve disputes concerning alleged manufacturer\'s defects or implementation of the manufacturer\'s new motor vehicle warranty. Only vehicles less than 5 years old that have been driven less than 160,000 KM qualify.'
  const camvap2Lines = doc.splitTextToSize(camvapPlan2, p3W)
  doc.text(camvap2Lines, p3Indent, y, { maxWidth: p3W })
  y += camvap2Lines.length * 8.5 + 14

  // OR — left-aligned, black
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(DARK)
  doc.text('OR', ML, y)
  y += 16

  // CANADIAN MOTOR VEHICLE ARBITRATION PLAN NOT AVAILABLE — centered, black, bold
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(DARK)
  doc.text('CANADIAN MOTOR VEHICLE ARBITRATION PLAN NOT AVAILABLE', ML + CW / 2, y, { align: 'center', maxWidth: CW })
  y += 16

  // Not available text — left-aligned
  doc.setFontSize(6.5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(DARK)
  const notAvailText2 = 'The manufacturer of this vehicle is not a participant in the Canadian Motor Vehicle Arbitration Plan. Therefore, the program under that plan is not available to resolve disputes concerning alleged manufacturer\'s defects or implementation of the manufacturer\'s new motor vehicle warranty. Currently, BMW, Mitsubishi, Suzuki and most exotic foreign sports car manufacturers, do not participate in CAMVAP. Further information can be found at www.camvap.ca.'
  const notAvail2Lines = doc.splitTextToSize(notAvailText2, p3W)
  doc.text(notAvail2Lines, p3Indent, y, { maxWidth: p3W })

  // Page number
  doc.setFontSize(7)
  doc.setTextColor(GRAY_LINE)
  doc.text(`${pageStart + 2}/${totalPages}`, W - MR, H - 20, { align: 'right' })

}

export function generateBillOfSalePdf(data: BillOfSaleData): string {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' })
  renderBillOfSalePdf(doc, data, { pageStart: 1, totalPages: 3 })
  // Return as data URL for preview
  return doc.output('datauristring')
}

export function downloadBillOfSalePdf(data: BillOfSaleData, filename?: string) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' })
  // We reuse the same generation but save directly
  const dataUri = generateBillOfSalePdf(data)
  // Convert data URI to blob and download
  const byteString = atob(dataUri.split(',')[1])
  const mimeString = dataUri.split(',')[0].split(':')[1].split(';')[0]
  const ab = new ArrayBuffer(byteString.length)
  const ia = new Uint8Array(ab)
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i)
  }
  const blob = new Blob([ab], { type: mimeString })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename || 'Bill_of_Sale.pdf'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
