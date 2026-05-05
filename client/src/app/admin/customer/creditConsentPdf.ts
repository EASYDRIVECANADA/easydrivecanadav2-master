import jsPDF from 'jspdf'

export interface CreditConsentPdfData {
  dateLabel: string

  // Company
  companyName: string
  companyStreet: string
  companyCityLine: string
  companyPhone: string

  // Applicant
  applicantName: string
  applicantStreet: string
  applicantCityLine: string
  applicantPhone: string
  applicantDob: string
  applicantGender: string

  // Home/Mortgage
  rentOwn: string
  marketValue: string
  mortgageAmount: string
  monthlyPayment: string

  // Employment
  employmentType: string
  position: string
  occupation: string
  yearsEmployed: string

  // Income
  incomeSource: string
  monthlyGross: string
  annualGross: string

  // Footer
  consentText: string
  authorizedBy: string
}

function fmt(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return ''
  const s = String(v)
  return s
}

export function renderCreditConsentPdf(doc: jsPDF, data: CreditConsentPdfData): void {
  const W = doc.internal.pageSize.getWidth() // 612
  const ML = 36
  const MR = 36
  const CW = W - ML - MR
  const rightX = W - MR

  const DARK = '#111111'
  const BLUE = '#2980cd'

  let y = 44

  // Logo (text-based like Bill of Sale)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(BLUE)
  doc.setFontSize(26)
  doc.text('EDC', ML, y)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6)
  doc.text('EASYDRIVE CANADA', ML, y + 10)

  // Company info (top-right)
  doc.setTextColor(DARK)
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.text(fmt(data.companyName), rightX, y - 10, { align: 'right' })
  doc.setFont('helvetica', 'normal')
  doc.text(fmt(data.companyStreet), rightX, y + 2, { align: 'right' })
  doc.text(fmt(data.companyCityLine), rightX, y + 14, { align: 'right' })
  doc.text(fmt(data.companyPhone), rightX, y + 26, { align: 'right' })

  // Title
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  doc.text('Credit Consent', ML + CW / 2, y - 6, { align: 'center' })
  doc.setFontSize(8)
  doc.text(fmt(data.dateLabel), ML + CW / 2, y + 8, { align: 'center' })

  y += 70

  // Applicant Details heading
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text('Applicant Details', ML + CW / 2, y, { align: 'center' })

  y += 22

  // Applicant left block
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.text(fmt(data.applicantName), ML, y)
  doc.setFont('helvetica', 'normal')
  doc.text(fmt(data.applicantStreet), ML, y + 14)
  doc.text(fmt(data.applicantCityLine), ML, y + 28)
  doc.text(fmt(data.applicantPhone), ML, y + 42)
  doc.text('Years at address: ______', ML, y + 56)

  // Applicant right block
  doc.setFont('helvetica', 'bold')
  doc.text('Gender:', ML + CW * 0.52, y + 10)
  doc.setFont('helvetica', 'normal')
  doc.text(fmt(data.applicantGender), ML + CW * 0.62, y + 10)
  doc.setFont('helvetica', 'bold')
  doc.text('DOB:', ML + CW * 0.52, y + 28)
  doc.setFont('helvetica', 'normal')
  doc.text(fmt(data.applicantDob), ML + CW * 0.62, y + 28)

  y += 92

  // Home/Mortgage Details
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text('Home/Mortgage Details', ML + CW / 2, y, { align: 'center' })
  y += 22

  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.text('Rent/Own:', ML + 90, y)
  doc.setFont('helvetica', 'normal')
  doc.text(fmt(data.rentOwn), ML + 160, y)

  doc.setFont('helvetica', 'bold')
  doc.text('Market Value:', ML + 90, y + 18)
  doc.setFont('helvetica', 'normal')
  doc.text(fmt(data.marketValue), ML + 170, y + 18)

  doc.setFont('helvetica', 'bold')
  doc.text('Mortgage Amount:', ML + 90, y + 36)
  doc.setFont('helvetica', 'normal')
  doc.text(fmt(data.mortgageAmount), ML + 190, y + 36)

  doc.setFont('helvetica', 'bold')
  doc.text('Monthly Payment:', ML + CW * 0.62, y + 18)
  doc.setFont('helvetica', 'normal')
  doc.text(fmt(data.monthlyPayment), ML + CW * 0.78, y + 18)

  y += 82

  // Employment Details
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text('Employment Details', ML + CW / 2, y, { align: 'center' })
  y += 36

  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.text('Type:', ML + 90, y)
  doc.setFont('helvetica', 'normal')
  doc.text(fmt(data.employmentType), ML + 140, y)

  doc.setFont('helvetica', 'bold')
  doc.text('Position:', ML + 90, y + 18)
  doc.setFont('helvetica', 'normal')
  doc.text(fmt(data.position), ML + 140, y + 18)

  doc.setFont('helvetica', 'bold')
  doc.text('Occupation:', ML + 90, y + 36)
  doc.setFont('helvetica', 'normal')
  doc.text(fmt(data.occupation), ML + 155, y + 36)

  doc.setFont('helvetica', 'bold')
  doc.text('Years Employed:', ML + 90, y + 54)
  doc.setFont('helvetica', 'normal')
  doc.text(fmt(data.yearsEmployed), ML + 185, y + 54)

  y += 104

  // Income Details
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text('Income Details', ML + CW / 2, y, { align: 'center' })
  y += 30

  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.text('Source:', ML + 120, y)
  doc.setFont('helvetica', 'normal')
  doc.text(fmt(data.incomeSource), ML + 170, y)

  doc.setFont('helvetica', 'bold')
  doc.text('Monthly Gross:', ML + 95, y + 18)
  doc.setFont('helvetica', 'normal')
  doc.text(fmt(data.monthlyGross), ML + 180, y + 18)

  doc.setFont('helvetica', 'bold')
  doc.text('Annual Gross:', ML + 105, y + 36)
  doc.setFont('helvetica', 'normal')
  doc.text(fmt(data.annualGross), ML + 180, y + 36)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.text('Notes', ML + CW * 0.62, y + 12)

  y += 86

  // Consent text
  doc.setFontSize(7)
  doc.setFont('helvetica', 'normal')
  doc.text(fmt(data.consentText), ML, y)

  // Signatures
  const sigY = y + 48
  doc.setDrawColor(0)
  doc.line(ML + 40, sigY, ML + 240, sigY)
  doc.line(rightX - 240, sigY, rightX - 40, sigY)

  doc.setFontSize(7)
  doc.text(`Signature of ${fmt(data.applicantName)}`, ML + 140, sigY + 14, { align: 'center' })
  doc.text(fmt(data.authorizedBy), rightX - 140, sigY + 14, { align: 'center' })
}
