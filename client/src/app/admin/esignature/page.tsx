'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import jsPDF from 'jspdf'

import { renderBillOfSalePdf, type BillOfSaleData } from '../sales/deals/new/billOfSalePdf'

type Document = {
  id: string
  dealId: string
  title: string
  recipient: string
  recipientName: string
  status: 'draft' | 'sent' | 'completed' | 'declined' | 'expired'
  createdDate: string
  lastModified: string
  signers: number
  completedSigners: number
  dealType: string
  state: string
  vehicle: string
}

type EsignFieldType = 'signature' | 'initial' | 'stamp' | 'dateSigned' | 'name' | 'company' | 'title' | 'text' | 'checkbox'
type EsignField = { id: string; type: EsignFieldType; x: number; y: number; width: number; height: number; page: number; value?: string }

export default function ESignaturePage() {
  const router = useRouter()
  const [view, setView] = useState<'all' | 'sent' | 'completed' | 'drafts'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [sendingRequest, setSendingRequest] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleUploadClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/esignature/upload', {
        method: 'POST',
        body: formData,
      })
      if (!res.ok) throw new Error('Upload failed')
      alert('File uploaded successfully')
    } catch (err: any) {
      alert(`Upload failed: ${err?.message || 'Unknown error'}`)
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const arrayBufferToBase64 = (buffer: ArrayBuffer) => {
    let binary = ''
    const bytes = new Uint8Array(buffer)
    const chunkSize = 0x8000
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, i + chunkSize)
      binary += String.fromCharCode.apply(null, chunk as unknown as number[])
    }
    return btoa(binary)
  }

  const parseFeeItems = (raw: any): any[] => {
    if (!raw) return []
    if (Array.isArray(raw)) return raw
    if (typeof raw === 'string') {
      try {
        const parsed = JSON.parse(raw)
        return Array.isArray(parsed) ? parsed : []
      } catch {
        return []
      }
    }
    return []
  }

  const getOmvicFromFees = (rawFees: any): number => {
    const fees = parseFeeItems(rawFees)
    for (const f of fees) {
      const name = String(f?.fee_name ?? f?.name ?? f?.label ?? '').toLowerCase()
      if (!name) continue
      if (name.includes('omvic')) {
        const amt = Number(f?.fee_amount ?? f?.amount ?? f?.value ?? 0)
        return Number.isFinite(amt) ? amt : 0
      }
    }
    return 0
  }

  const sumItems = (raw: any, amtKey: string) => {
    const items = parseFeeItems(raw)
    return items.reduce((s: number, i: any) => s + (Number(i?.[amtKey] ?? 0) || 0), 0)
  }

  useEffect(() => {
    const fetchDocuments = async () => {
      try {
        setLoading(true)
        setError(null)

        let userId = ''
        try {
          const raw = typeof window !== 'undefined' ? window.localStorage.getItem('edc_admin_session') : null
          const parsed = raw ? JSON.parse(raw) : null
          userId = String(parsed?.user_id ?? '').trim()
        } catch {
          userId = ''
        }

        if (!userId) {
          setError('Please log in to view signature documents')
          setLoading(false)
          return
        }

        const res = await fetch(`/api/esignature?user_id=${encodeURIComponent(userId)}`, { cache: 'no-store' })
        if (!res.ok) throw new Error(`Failed to fetch documents (${res.status})`)
        const json = await res.json()
        if (json.error) throw new Error(json.error)
        setDocuments(json.documents || [])
      } catch (e: any) {
        setError(e?.message || 'Failed to load signature documents')
      } finally {
        setLoading(false)
      }
    }

    fetchDocuments()
  }, [])

  const handleSendSignatureRequest = async (doc: Document) => {
    if (!doc.recipient) {
      alert('No recipient email found for this deal')
      return
    }

    if (!confirm(`Send signature request to ${doc.recipientName || doc.recipient}?`)) {
      return
    }

    setSendingRequest(doc.id)
    try {
      let senderEmail = ''
      try {
        const raw = typeof window !== 'undefined' ? window.localStorage.getItem('edc_admin_session') : null
        const parsed = raw ? JSON.parse(raw) : null
        senderEmail = String(parsed?.email ?? '').trim().toLowerCase()
      } catch {
        senderEmail = ''
      }

      const dealRes = await fetch(`/api/deals/${encodeURIComponent(doc.dealId)}`, { cache: 'no-store' })
      if (!dealRes.ok) {
        const t = await dealRes.text().catch(() => '')
        throw new Error(t || `Failed to load deal (${dealRes.status})`)
      }
      const deal = await dealRes.json().catch(() => null)
      if (!deal || deal?.error) throw new Error(String(deal?.error || 'Failed to load deal'))

      const c = deal?.customer || {}
      const vRaw = deal?.vehicles?.[0] || {}
      const sv = vRaw.selectedVehicle || vRaw
      const v = {
        stock_number: sv.selected_stock_number ?? sv.stockNumber ?? sv.stock_number ?? '',
        year: sv.selected_year ?? sv.year ?? '',
        make: sv.selected_make ?? sv.make ?? '',
        model: sv.selected_model ?? sv.model ?? '',
        trim: sv.selected_trim ?? sv.trim ?? '',
        vin: sv.selected_vin ?? sv.vin ?? '',
        exterior_color: sv.selected_exterior_color ?? sv.exteriorColor ?? sv.exterior_color ?? '',
        interior_color: sv.selected_interior_color ?? sv.interiorColor ?? sv.interior_color ?? '',
        odometer: sv.selected_odometer ?? sv.odometer ?? '',
        odometer_unit: sv.selected_odometer_unit ?? sv.odometerUnit ?? sv.odometer_unit ?? 'kms',
        status: sv.selected_status ?? sv.status ?? 'Used',
        price: sv.price ?? 0,
      }

      const w = deal?.worksheet || {}
      const d = deal?.delivery || {}
      const disc = deal?.disclosures || {}

      const price = Number(w.purchase_price ?? v.price ?? 0)
      const omvic = Number(w.omvic_fee ?? getOmvicFromFees(w.fees) ?? 0)
      const discount = Number(w.discount ?? 0)

      const allFeesTotal = sumItems(w.fees, 'amount')
      const feesTotal = allFeesTotal - omvic
      const accessoriesTotal = sumItems(w.accessories, 'price')
      const warrantiesTotal = sumItems(w.warranties, 'amount')
      const insurancesTotal = sumItems(w.insurances, 'amount')
      const paymentsTotal = sumItems(w.payments, 'amount')

      const subtotal1 = price - discount + omvic + feesTotal + accessoriesTotal + warrantiesTotal + insurancesTotal
      const tradeValue = Number(w.trade_value ?? 0)
      const lienPayout = Number(w.lien_payout ?? 0)
      const netDiff = subtotal1 - tradeValue + lienPayout
      const taxRate = Number(w.tax_rate ?? 0.13)
      const hst = netDiff * taxRate
      const totalTax = hst
      const licenseFee = w.license_fee && String(w.license_fee).trim() ? Number(w.license_fee) : 0

      const subtotal2 = netDiff + totalTax + licenseFee
      const deposit = Number(w.deposit ?? 0)
      const downPayment = Number(w.down_payment ?? 0)
      const taxInsurance = Number(w.tax_on_insurance ?? 0)
      const totalDue = subtotal2 - deposit - downPayment - paymentsTotal + taxInsurance

      const fullName =
        [c.firstname, c.lastname].filter(Boolean).join(' ') || [c.first_name, c.last_name].filter(Boolean).join(' ') || ''

      const toEmail = String(doc.recipient || '').trim().toLowerCase()

      const billData: BillOfSaleData = {
        dealDate: doc.createdDate ? new Date(String(doc.createdDate)).toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' }) : '',
        invoiceNumber: String(doc.dealId || ''),
        fullName,
        phone: c.phone ?? '',
        mobile: c.mobile ?? '',
        email: toEmail,
        address: c.street_address ?? c.streetaddress ?? '',
        city: c.city ?? '',
        province: c.province ?? 'ON',
        postalCode: c.postal_code ?? c.postalcode ?? '',
        driversLicense: c.drivers_license ?? c.driverslicense ?? '',
        insuranceCompany: c.insurance_company ?? c.insurancecompany ?? '',
        policyNumber: c.policy_number ?? c.policynumber ?? '',
        policyExpiry: c.policy_expiry ?? c.policyexpiry ?? '',
        stockNumber: String(v.stock_number ?? ''),
        year: String(v.year ?? ''),
        make: String(v.make ?? ''),
        model: String(v.model ?? ''),
        trim: String(v.trim ?? ''),
        colour: String(v.exterior_color ?? ''),
        keyNumber: '',
        vin: String(v.vin ?? ''),
        odometerStatus: String(v.status ?? ''),
        odometer: v.odometer ? `${Number(v.odometer).toLocaleString()} ${String(v.odometer_unit || 'kms')}` : '',
        serviceDate: '',
        deliveryDate: d.delivery_date ?? '',
        vehiclePrice: String(price),
        omvicFee: String(omvic),
        subtotal1: String(subtotal1),
        netDifference: String(netDiff),
        hstOnNetDifference: String(hst),
        totalTax: String(totalTax),
        licenseFee: String(licenseFee),
        feesTotal: String(feesTotal),
        accessoriesTotal: String(accessoriesTotal),
        warrantiesTotal: String(warrantiesTotal),
        insurancesTotal: String(insurancesTotal),
        paymentsTotal: String(paymentsTotal),
        subtotal2: String(subtotal2),
        deposit: String(deposit),
        downPayment: String(downPayment),
        taxOnInsurance: String(taxInsurance),
        totalBalanceDue: String(totalDue),
        extendedWarranty: 'DECLINED',
        commentsHtml: disc.disclosures_html ?? '',
        purchaserName: fullName,
        purchaserSignatureB64: c.signature ?? undefined,
        salesperson: d.salesperson ?? '',
        salespersonRegNo: '4782496',
        acceptorName: d.approved_by ?? 'Syed Islam',
        acceptorRegNo: '4782496',
      }

      const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' })
      renderBillOfSalePdf(pdf, billData, { pageStart: 1, totalPages: 3 })

      // Always use latest saved prepare fields for download
      const fieldsRes = await fetch(`/api/esignature/fields?dealId=${encodeURIComponent(doc.dealId)}`, { cache: 'no-store' })
      const fieldsJson = fieldsRes.ok ? await fieldsRes.json().catch(() => null) : null
      const latestFields: EsignField[] = Array.isArray(fieldsJson?.fields) ? fieldsJson.fields : []

      if (latestFields.length > 0) {
        const fullNameForFields = [c.firstname, c.lastname].filter(Boolean).join(' ') || 'Name'
        const initials = [c.firstname?.[0], c.lastname?.[0]].filter(Boolean).join('').toUpperCase() || 'DS'
        const signature = String(c.signature ?? '').trim()

        latestFields.forEach((field) => {
          const pageNum = Math.min(Math.max(field.page || 1, 1), pdf.getNumberOfPages())
          pdf.setPage(pageNum)

          const pdfW = pdf.internal.pageSize.getWidth()
          const pdfH = pdf.internal.pageSize.getHeight()
          const xScale = pdfW / 816
          const yScale = pdfH / 1056
          const x = field.x * xScale
          const y = field.y * yScale
          const w = field.width * xScale
          const h = field.height * yScale

          try {
            switch (field.type) {
              case 'signature':
                if (signature) {
                  let src = signature
                  if (!signature.startsWith('data:') && !signature.startsWith('http')) src = `data:image/png;base64,${signature}`
                  pdf.addImage(src, 'PNG', x, y, w, h)
                }
                break
              case 'initial':
                pdf.setTextColor(29, 78, 216)
                pdf.setFontSize(14)
                pdf.setFont('helvetica', 'bold')
                pdf.text(initials, x + w / 2, y + h / 2, { align: 'center', baseline: 'middle' })
                pdf.setFont('helvetica', 'normal')
                break
              case 'stamp':
                pdf.setDrawColor(220, 38, 38)
                pdf.setTextColor(220, 38, 38)
                pdf.circle(x + w / 2, y + h / 2, Math.max(Math.min(w, h) / 2 - 2, 2), 'S')
                pdf.circle(x + w / 2, y + h / 2, Math.max(Math.min(w, h) / 2 - 8, 1), 'S')
                pdf.setFontSize(12)
                pdf.setFont('helvetica', 'bold')
                pdf.text('APPROVED', x + w / 2, y + h / 2 - 5, { align: 'center' })
                pdf.setFontSize(9)
                pdf.setFont('helvetica', 'normal')
                pdf.text(new Date().toLocaleDateString('en-CA'), x + w / 2, y + h / 2 + 8, { align: 'center' })
                break
              case 'dateSigned':
                pdf.setTextColor(55, 65, 81)
                pdf.setFontSize(10)
                pdf.text(new Date().toLocaleDateString('en-CA'), x + w / 2, y + h / 2, { align: 'center', baseline: 'middle' })
                break
              case 'name':
                pdf.setTextColor(17, 24, 39)
                pdf.setFontSize(10)
                pdf.text(fullNameForFields, x + 5, y + h / 2, { baseline: 'middle' })
                break
              case 'company':
                pdf.setTextColor(55, 65, 81)
                pdf.setFontSize(10)
                pdf.text(field.value || 'Company', x + 5, y + h / 2, { baseline: 'middle' })
                break
              case 'title':
                pdf.setTextColor(55, 65, 81)
                pdf.setFontSize(10)
                pdf.text(field.value || 'Title', x + 5, y + h / 2, { baseline: 'middle' })
                break
              case 'text':
                pdf.setTextColor(55, 65, 81)
                pdf.setFontSize(10)
                pdf.text(field.value || 'Enter text', x + 5, y + h / 2, { baseline: 'middle' })
                break
              case 'checkbox':
                pdf.setFillColor(59, 130, 246)
                pdf.setDrawColor(37, 99, 235)
                pdf.roundedRect(x + w / 2 - 7.5, y + h / 2 - 7.5, 15, 15, 2, 2, 'FD')
                pdf.setTextColor(255, 255, 255)
                pdf.setFontSize(10)
                pdf.text('✓', x + w / 2, y + h / 2, { align: 'center', baseline: 'middle' })
                break
            }
          } catch {
            // Continue rendering remaining fields
          }
        })
      }

      const ab = pdf.output('arraybuffer')
      const blob = new Blob([ab], { type: 'application/pdf' })
      const fileName = `Bill_of_Sale_${doc.dealId}_with_fields.pdf`
      const fileB64 = arrayBufferToBase64(ab)

      const signatureLink = (() => {
        try {
          if (typeof window === 'undefined') return null
          const appOrigin = (process.env.NEXT_PUBLIC_APP_ORIGIN || window.location.origin).replace(/\/+$/, '')
          return `${appOrigin}/admin/sales/deals/signature?dealId=${encodeURIComponent(String(doc.dealId || ''))}`
        } catch {
          return null
        }
      })()

      const formData = new FormData()
      formData.append('email', toEmail)
      if (senderEmail) formData.append('sender_email', senderEmail)
      formData.append('dealId', String(doc.dealId || ''))
      if (signatureLink) formData.append('link', signatureLink)
      formData.append('file', blob, fileName)
      formData.append('file_b64', fileB64)
      formData.append('file_name', fileName)

      const sendRes = await fetch('/api/email', {
        method: 'POST',
        body: formData,
      })

      if (!sendRes.ok) {
        const t = await sendRes.text().catch(() => '')
        throw new Error(t || `Email webhook failed (${sendRes.status})`)
      }

      alert('Signature request sent')
    } catch (e: any) {
      alert(`Failed to send signature request: ${e?.message || 'Unknown error'}`)
    } finally {
      setSendingRequest(null)
    }
  }

  const handleEditDeal = (dealId: string) => {
    router.push(`/admin/esignature/prepare/${encodeURIComponent(dealId)}`)
  }

  const handleDownloadDocument = async (doc: Document) => {
    setSendingRequest(doc.id)
    try {
      const dealRes = await fetch(`/api/deals/${encodeURIComponent(doc.dealId)}`, { cache: 'no-store' })
      if (!dealRes.ok) {
        const t = await dealRes.text().catch(() => '')
        throw new Error(t || `Failed to load deal (${dealRes.status})`)
      }
      const deal = await dealRes.json().catch(() => null)
      if (!deal || deal?.error) throw new Error(String(deal?.error || 'Failed to load deal'))

      const c = deal?.customer || {}
      const vRaw = deal?.vehicles?.[0] || {}
      const sv = vRaw.selectedVehicle || vRaw
      const v = {
        stock_number: sv.selected_stock_number ?? sv.stockNumber ?? sv.stock_number ?? '',
        year: sv.selected_year ?? sv.year ?? '',
        make: sv.selected_make ?? sv.make ?? '',
        model: sv.selected_model ?? sv.model ?? '',
        trim: sv.selected_trim ?? sv.trim ?? '',
        vin: sv.selected_vin ?? sv.vin ?? '',
        exterior_color: sv.selected_exterior_color ?? sv.exteriorColor ?? sv.exterior_color ?? '',
        odometer: sv.selected_odometer ?? sv.odometer ?? '',
        odometer_unit: sv.selected_odometer_unit ?? sv.odometerUnit ?? sv.odometer_unit ?? 'kms',
        status: sv.selected_status ?? sv.status ?? 'Used',
        price: sv.price ?? 0,
      }

      const w = deal?.worksheet || {}
      const d = deal?.delivery || {}
      const disc = deal?.disclosures || {}

      const price = Number(w.purchase_price ?? v.price ?? 0)
      const omvic = Number(w.omvic_fee ?? getOmvicFromFees(w.fees) ?? 0)
      const discount = Number(w.discount ?? 0)

      const allFeesTotal = sumItems(w.fees, 'amount')
      const feesTotal = allFeesTotal - omvic
      const accessoriesTotal = sumItems(w.accessories, 'price')
      const warrantiesTotal = sumItems(w.warranties, 'amount')
      const insurancesTotal = sumItems(w.insurances, 'amount')
      const paymentsTotal = sumItems(w.payments, 'amount')

      const subtotal1 = price - discount + omvic + feesTotal + accessoriesTotal + warrantiesTotal + insurancesTotal
      const tradeValue = Number(w.trade_value ?? 0)
      const lienPayout = Number(w.lien_payout ?? 0)
      const netDiff = subtotal1 - tradeValue + lienPayout
      const taxRate = Number(w.tax_rate ?? 0.13)
      const hst = netDiff * taxRate
      const totalTax = hst
      const licenseFee = w.license_fee && String(w.license_fee).trim() ? Number(w.license_fee) : 0

      const subtotal2 = netDiff + totalTax + licenseFee
      const deposit = Number(w.deposit ?? 0)
      const downPayment = Number(w.down_payment ?? 0)
      const taxInsurance = Number(w.tax_on_insurance ?? 0)
      const totalDue = subtotal2 - deposit - downPayment - paymentsTotal + taxInsurance

      const fullName =
        [c.firstname, c.lastname].filter(Boolean).join(' ') || [c.first_name, c.last_name].filter(Boolean).join(' ') || ''

      const toEmail = String(doc.recipient || '').trim().toLowerCase()

      const billData: BillOfSaleData = {
        dealDate: doc.createdDate
          ? new Date(String(doc.createdDate)).toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' })
          : '',
        invoiceNumber: String(doc.dealId || ''),
        fullName,
        phone: c.phone ?? '',
        mobile: c.mobile ?? '',
        email: toEmail,
        address: c.street_address ?? c.streetaddress ?? '',
        city: c.city ?? '',
        province: c.province ?? 'ON',
        postalCode: c.postal_code ?? c.postalcode ?? '',
        driversLicense: c.drivers_license ?? c.driverslicense ?? '',
        insuranceCompany: c.insurance_company ?? c.insurancecompany ?? '',
        policyNumber: c.policy_number ?? c.policynumber ?? '',
        policyExpiry: c.policy_expiry ?? c.policyexpiry ?? '',
        stockNumber: String(v.stock_number ?? ''),
        year: String(v.year ?? ''),
        make: String(v.make ?? ''),
        model: String(v.model ?? ''),
        trim: String(v.trim ?? ''),
        colour: String(v.exterior_color ?? ''),
        keyNumber: '',
        vin: String(v.vin ?? ''),
        odometerStatus: String(v.status ?? ''),
        odometer: v.odometer ? `${Number(v.odometer).toLocaleString()} ${String(v.odometer_unit || 'kms')}` : '',
        serviceDate: '',
        deliveryDate: d.delivery_date ?? '',
        vehiclePrice: String(price),
        omvicFee: String(omvic),
        subtotal1: String(subtotal1),
        netDifference: String(netDiff),
        hstOnNetDifference: String(hst),
        totalTax: String(totalTax),
        licenseFee: String(licenseFee),
        feesTotal: String(feesTotal),
        accessoriesTotal: String(accessoriesTotal),
        warrantiesTotal: String(warrantiesTotal),
        insurancesTotal: String(insurancesTotal),
        paymentsTotal: String(paymentsTotal),
        subtotal2: String(subtotal2),
        deposit: String(deposit),
        downPayment: String(downPayment),
        taxOnInsurance: String(taxInsurance),
        totalBalanceDue: String(totalDue),
        extendedWarranty: 'DECLINED',
        commentsHtml: disc.disclosures_html ?? '',
        purchaserName: fullName,
        purchaserSignatureB64: c.signature ?? undefined,
        salesperson: d.salesperson ?? '',
        salespersonRegNo: '4782496',
        acceptorName: d.approved_by ?? 'Syed Islam',
        acceptorRegNo: '4782496',
      }

      const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' })
      renderBillOfSalePdf(pdf, billData, { pageStart: 1, totalPages: 3 })

      const fieldsRes = await fetch(`/api/esignature/fields?dealId=${encodeURIComponent(doc.dealId)}`, { cache: 'no-store' })
      const fieldsJson = fieldsRes.ok ? await fieldsRes.json().catch(() => null) : null
      const latestFields: EsignField[] = Array.isArray(fieldsJson?.fields) ? fieldsJson.fields : []

      if (latestFields.length > 0) {
        const fullNameForFields = [c.firstname, c.lastname].filter(Boolean).join(' ') || 'Name'
        const initials = [c.firstname?.[0], c.lastname?.[0]].filter(Boolean).join('').toUpperCase() || 'DS'
        const signature = String(c.signature ?? '').trim()

        latestFields.forEach((field) => {
          const pageNum = Math.min(Math.max(field.page || 1, 1), pdf.getNumberOfPages())
          pdf.setPage(pageNum)

          const pdfW = pdf.internal.pageSize.getWidth()
          const pdfH = pdf.internal.pageSize.getHeight()
          const xScale = pdfW / 816
          const yScale = pdfH / 1056
          const x = field.x * xScale
          const y = field.y * yScale
          const w = field.width * xScale
          const h = field.height * yScale

          try {
            switch (field.type) {
              case 'signature':
                if (signature) {
                  let src = signature
                  if (!signature.startsWith('data:') && !signature.startsWith('http')) src = `data:image/png;base64,${signature}`
                  pdf.addImage(src, 'PNG', x, y, w, h)
                }
                break
              case 'initial':
                pdf.setTextColor(29, 78, 216)
                pdf.setFontSize(14)
                pdf.setFont('helvetica', 'bold')
                pdf.text(initials, x + w / 2, y + h / 2, { align: 'center', baseline: 'middle' })
                pdf.setFont('helvetica', 'normal')
                break
              case 'stamp':
                pdf.setDrawColor(220, 38, 38)
                pdf.setTextColor(220, 38, 38)
                pdf.circle(x + w / 2, y + h / 2, Math.max(Math.min(w, h) / 2 - 2, 2), 'S')
                pdf.circle(x + w / 2, y + h / 2, Math.max(Math.min(w, h) / 2 - 8, 1), 'S')
                pdf.setFontSize(12)
                pdf.setFont('helvetica', 'bold')
                pdf.text('APPROVED', x + w / 2, y + h / 2 - 5, { align: 'center' })
                pdf.setFontSize(9)
                pdf.setFont('helvetica', 'normal')
                pdf.text(new Date().toLocaleDateString('en-CA'), x + w / 2, y + h / 2 + 8, { align: 'center' })
                break
              case 'dateSigned':
                pdf.setTextColor(55, 65, 81)
                pdf.setFontSize(10)
                pdf.text(new Date().toLocaleDateString('en-CA'), x + w / 2, y + h / 2, { align: 'center', baseline: 'middle' })
                break
              case 'name':
                pdf.setTextColor(17, 24, 39)
                pdf.setFontSize(10)
                pdf.text(fullNameForFields, x + 5, y + h / 2, { baseline: 'middle' })
                break
              case 'company':
                pdf.setTextColor(55, 65, 81)
                pdf.setFontSize(10)
                pdf.text(field.value || 'Company', x + 5, y + h / 2, { baseline: 'middle' })
                break
              case 'title':
                pdf.setTextColor(55, 65, 81)
                pdf.setFontSize(10)
                pdf.text(field.value || 'Title', x + 5, y + h / 2, { baseline: 'middle' })
                break
              case 'text':
                pdf.setTextColor(55, 65, 81)
                pdf.setFontSize(10)
                pdf.text(field.value || 'Enter text', x + 5, y + h / 2, { baseline: 'middle' })
                break
              case 'checkbox':
                pdf.setFillColor(59, 130, 246)
                pdf.setDrawColor(37, 99, 235)
                pdf.roundedRect(x + w / 2 - 7.5, y + h / 2 - 7.5, 15, 15, 2, 2, 'FD')
                pdf.setTextColor(255, 255, 255)
                pdf.setFontSize(10)
                pdf.text('✓', x + w / 2, y + h / 2, { align: 'center', baseline: 'middle' })
                break
            }
          } catch {
            // Continue rendering remaining fields
          }
        })
      }

      const ab = pdf.output('arraybuffer')
      const blob = new Blob([ab], { type: 'application/pdf' })
      const fileName = `Bill_of_Sale_${doc.dealId}_with_fields.pdf`

      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = fileName
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (e: any) {
      alert(`Failed to download document: ${e?.message || 'Unknown error'}`)
    } finally {
      setSendingRequest(null)
    }
  }

  const filteredDocuments = useMemo(() => {
    let filtered = documents

    if (view === 'sent') {
      filtered = filtered.filter((d) => d.status === 'sent')
    } else if (view === 'completed') {
      filtered = filtered.filter((d) => d.status === 'completed')
    } else if (view === 'drafts') {
      filtered = filtered.filter((d) => d.status === 'draft')
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (d) =>
          d.title.toLowerCase().includes(q) ||
          d.recipient.toLowerCase().includes(q)
      )
    }

    return filtered
  }, [documents, view, searchQuery])

  const stats = useMemo(() => {
    return {
      all: documents.length,
      sent: documents.filter((d) => d.status === 'sent').length,
      completed: documents.filter((d) => d.status === 'completed').length,
      drafts: documents.filter((d) => d.status === 'draft').length,
    }
  }, [documents])

  const getStatusBadge = (status: Document['status']) => {
    switch (status) {
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-green-50 text-green-700 text-xs font-medium rounded-full">
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            Completed
          </span>
        )
      case 'sent':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 text-blue-700 text-xs font-medium rounded-full">
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
            </svg>
            Awaiting Signature
          </span>
        )
      case 'draft':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-gray-50 text-gray-700 text-xs font-medium rounded-full">
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
            </svg>
            Draft
          </span>
        )
      case 'declined':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-red-50 text-red-700 text-xs font-medium rounded-full">
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            Declined
          </span>
        )
      case 'expired':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-orange-50 text-orange-700 text-xs font-medium rounded-full">
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
            </svg>
            Expired
          </span>
        )
    }
  }

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr)
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200/60 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">E-Signature</h1>
              <p className="text-sm text-slate-500 mt-1">Manage and track your signature requests</p>
            </div>
            <button
              type="button"
              onClick={handleUploadClick}
              disabled={uploading}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-blue-500 text-white text-sm font-semibold rounded-lg shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50 transform hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1M12 4v10m0 0l-4-4m4 4l4-4" />
              </svg>
              {uploading ? 'Uploading...' : 'Upload'}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[
            { label: 'All Documents', count: stats.all, icon: 'file', color: 'slate', active: view === 'all', onClick: () => setView('all') },
            { label: 'Awaiting Signature', count: stats.sent, icon: 'clock', color: 'blue', active: view === 'sent', onClick: () => setView('sent') },
            { label: 'Completed', count: stats.completed, icon: 'check', color: 'green', active: view === 'completed', onClick: () => setView('completed') },
            { label: 'Drafts', count: stats.drafts, icon: 'draft', color: 'gray', active: view === 'drafts', onClick: () => setView('drafts') },
          ].map((stat) => (
            <button
              key={stat.label}
              type="button"
              onClick={stat.onClick}
              className={`text-left p-5 rounded-xl border-2 transition-all duration-200 ${
                stat.active
                  ? `border-${stat.color}-500 bg-${stat.color}-50 shadow-lg shadow-${stat.color}-500/20`
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-md'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600">{stat.label}</p>
                  <p className="text-3xl font-bold text-slate-900 mt-1">{stat.count}</p>
                </div>
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${stat.active ? `bg-${stat.color}-100` : 'bg-slate-100'}`}>
                  {stat.icon === 'file' && (
                    <svg className={`w-6 h-6 ${stat.active ? `text-${stat.color}-600` : 'text-slate-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  )}
                  {stat.icon === 'clock' && (
                    <svg className={`w-6 h-6 ${stat.active ? `text-${stat.color}-600` : 'text-slate-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  )}
                  {stat.icon === 'check' && (
                    <svg className={`w-6 h-6 ${stat.active ? `text-${stat.color}-600` : 'text-slate-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  )}
                  {stat.icon === 'draft' && (
                    <svg className={`w-6 h-6 ${stat.active ? `text-${stat.color}-600` : 'text-slate-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Search and Filters */}
      <div className="max-w-7xl mx-auto px-6 pb-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200/60 p-4">
          <div className="flex items-center gap-4">
            <div className="flex-1 relative">
              <svg className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search documents by title or recipient..."
                className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <button
              type="button"
              className="inline-flex items-center gap-2 px-4 py-2.5 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              Filters
            </button>
          </div>
        </div>
      </div>

      {/* Documents List */}
      <div className="max-w-7xl mx-auto px-6 pb-8">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200/60 overflow-hidden">
          {loading ? (
            <div className="text-center py-16">
              <div className="inline-flex items-center gap-3">
                <svg className="animate-spin h-8 w-8 text-blue-600" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span className="text-sm text-slate-600">Loading documents...</span>
              </div>
            </div>
          ) : error ? (
            <div className="text-center py-16">
              <svg className="w-16 h-16 mx-auto text-red-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">Error loading documents</h3>
              <p className="text-sm text-slate-500">{error}</p>
            </div>
          ) : filteredDocuments.length === 0 ? (
            <div className="text-center py-16">
              <svg className="w-16 h-16 mx-auto text-slate-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">No documents found</h3>
              <p className="text-sm text-slate-500">Try adjusting your search or filters</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Document</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Recipient</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Progress</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Created</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Last Modified</th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredDocuments.map((doc) => (
                    <tr key={doc.id} className="hover:bg-slate-50 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-slate-900">{doc.title}</p>
                            <p className="text-xs text-slate-500 mt-0.5">ID: {doc.id}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white text-xs font-semibold">
                            {doc.recipient.charAt(0).toUpperCase()}
                          </div>
                          <span className="text-sm text-slate-700">{doc.recipient}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">{getStatusBadge(doc.status)}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-slate-200 rounded-full h-2 max-w-[100px]">
                            <div
                              className={`h-2 rounded-full ${doc.status === 'completed' ? 'bg-green-500' : doc.status === 'sent' ? 'bg-blue-500' : 'bg-slate-400'}`}
                              style={{ width: `${(doc.completedSigners / doc.signers) * 100}%` }}
                            />
                          </div>
                          <span className="text-xs text-slate-600 whitespace-nowrap">
                            {doc.completedSigners}/{doc.signers}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600 whitespace-nowrap">{formatDate(doc.createdDate)}</td>
                      <td className="px-6 py-4 text-sm text-slate-600 whitespace-nowrap">{formatDate(doc.lastModified)}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handleEditDeal(doc.dealId)}
                            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="View Latest Design"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDownloadDocument(doc)}
                            disabled={sendingRequest === doc.id}
                            className="p-2 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Download"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
                            </svg>
                          </button>
                          {doc.status === 'draft' && doc.recipient && (
                            <button
                              type="button"
                              onClick={() => handleSendSignatureRequest(doc)}
                              disabled={sendingRequest === doc.id}
                              className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Send Signature Request"
                            >
                              {sendingRequest === doc.id ? 'Sending...' : 'Send Request'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
