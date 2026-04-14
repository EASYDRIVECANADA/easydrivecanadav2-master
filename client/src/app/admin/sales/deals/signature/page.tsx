'use client'

import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import NextImage from 'next/image'

declare global {
  interface Window {
    pdfjsLib?: any
  }
}

type FieldType = 'signature' | 'initial' | 'stamp' | 'dateSigned' | 'name' | 'company' | 'title' | 'text' | 'checkbox'
type Field = { id: string; type: FieldType; x: number; y: number; width: number; height: number; page: number; value?: string; fileIndex?: number; recipientIndex?: number }

const PAGE_WIDTH = 816
const PAGE_HEIGHT = 1056
const PDF_RENDER_QUALITY = 4

const loadPdfJsFromCdn = (): Promise<any> => {
  if (typeof window === 'undefined') return Promise.reject(new Error('No window'))
  if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib)

  return new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-pdfjs="true"]') as HTMLScriptElement | null
    if (existing) {
      if (window.pdfjsLib) {
        resolve(window.pdfjsLib)
        return
      }
      const onLoad = () => window.pdfjsLib ? resolve(window.pdfjsLib) : reject(new Error('PDF.js failed to load'))
      existing.addEventListener('load', onLoad, { once: true })
      existing.addEventListener('error', () => reject(new Error('PDF.js failed to load')), { once: true })
      return
    }

    const script = document.createElement('script')
    script.dataset.pdfjs = 'true'
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'
    script.async = true
    script.onload = () => {
      if (!window.pdfjsLib) {
        reject(new Error('PDF.js failed to load'))
        return
      }
      try {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
      } catch {}
      resolve(window.pdfjsLib)
    }
    script.onerror = () => reject(new Error('PDF.js failed to load'))
    document.head.appendChild(script)
  })
}

const pdfDataUrlToBytes = (dataUrl: string): Uint8Array | null => {
  const raw = String(dataUrl || '').trim()
  const m = raw.match(/^data:application\/pdf;base64,(.*)$/i)
  const b64 = m?.[1]
  if (!b64) return null
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

const normalizeToDataUrl = (raw: string, defaultMime: string): { url: string; mime: string } | null => {
  const trimmed = String(raw || '').trim()
  if (!trimmed) return null
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return { url: trimmed, mime: defaultMime }
  if (trimmed.startsWith('data:')) {
    const mimeMatch = trimmed.match(/^data:([^;,]+)/)
    return { url: trimmed, mime: mimeMatch?.[1] || defaultMime }
  }
  return { url: `data:${defaultMime};base64,${trimmed}`, mime: defaultMime }
}

const fieldTypeLabels: Record<FieldType, string> = {
  signature: 'Signature',
  initial: 'Initial',
  stamp: 'Stamp',
  dateSigned: 'Date Signed',
  name: 'Name',
  company: 'Company',
  title: 'Title',
  text: 'Text',
  checkbox: 'Checkbox',
}

function DealsSignaturePageInner() {
  const searchParams = useSearchParams()
  
  // Support two flows:
  // 1. dealId flow (from Deals table): ?dealId=227
  // 2. sigId flow (from E-Signature tab): ?09a9fc8c-3257-4c0f-ab34-ab742da96bd9
  const dealId = useMemo(() => {
    return searchParams.get('dealId') || ''
  }, [searchParams])

  const sigId = useMemo(() => {
    // If dealId is present, don't use sigId flow
    if (searchParams.get('dealId')) return ''
    const raw = searchParams.toString()
    // The ID is passed as the first key with no value: ?<uuid>
    const firstKey = raw.split('=')[0].split('&')[0] || ''
    return decodeURIComponent(firstKey).trim()
  }, [searchParams])

  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const signatureBoxRef = useRef<HTMLDivElement | null>(null)
  const drawingRef = useRef(false)
  const lastPointRef = useRef<{ x: number; y: number } | null>(null)

  const [penSize, setPenSize] = useState(2)
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null)
  const [signatureModalOpen, setSignatureModalOpen] = useState(false)
  const [signatureMode, setSignatureMode] = useState<'draw' | 'type'>('draw')
  const [typedName, setTypedName] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveModalOpen, setSaveModalOpen] = useState(false)
  const [saveOk, setSaveOk] = useState<boolean | null>(null)
  const [saveMessage, setSaveMessage] = useState<string>('')
  const [recipientEmail, setRecipientEmail] = useState('')
  const [currentSigningField, setCurrentSigningField] = useState<string | null>(null)
  const [isInitialModal, setIsInitialModal] = useState(false)
  // Edit field modal (company, title, text, dateSigned)
  const [editFieldModal, setEditFieldModal] = useState<{ id: string; type: FieldType; label: string; value: string } | null>(null)
  const [editFieldValue, setEditFieldValue] = useState('')
  const [isDealPurchaserSignature, setIsDealPurchaserSignature] = useState(false)
  const [purchaserSigned, setPurchaserSigned] = useState(false)
  const [purchaserSigOverlayY, setPurchaserSigOverlayY] = useState<number | null>(null)
  
  // Document state
  const [sigRecord, setSigRecord] = useState<any>(null)
  const [fields, setFields] = useState<Field[]>([])
  const [pageImages, setPageImages] = useState<string[]>([])
  const [totalPages, setTotalPages] = useState(1)
  const [docMime, setDocMime] = useState<string | null>(null)
  const [pdfDataUrl, setPdfDataUrl] = useState<string | null>(null)

  const [uploadedFiles, setUploadedFiles] = useState<Array<{ file_name: string; file_type: string; file_b64: string }>>([])
  const [selectedFileIndex, setSelectedFileIndex] = useState(0)

  const [dealData, setDealData] = useState<any>(null)

  const title = useMemo(() => {
    if (dealId) return `E-Signature Request`
    if (sigId) return `E-Signature Request`
    return 'Signature'
  }, [dealId, sigId])

  // Load document - supports both dealId flow and email flow
  useEffect(() => {
    const loadDocument = async () => {
      // Flow 1: dealId from Deals table
      if (dealId) {
        try {
          setLoading(true)
          setError(null)
          setPageImages([])

          // Fetch deal data
          const dealRes = await fetch(`/api/deals/${encodeURIComponent(dealId)}`, { cache: 'no-store' })
          if (!dealRes.ok) {
            throw new Error('Failed to load deal data')
          }
          const data = await dealRes.json()
          if (!data) {
            throw new Error('No deal data found')
          }

          setDealData(data)
          setSigRecord({ id: dealId, deal_id: dealId, ...data })

          // For dealId flow, we generate the Bill of Sale PDF dynamically
          // Set docMime to trigger PDF generation in the next effect
          setDocMime('application/pdf')
          // We'll generate the PDF in a separate effect

          setLoading(false)
        } catch (e: any) {
          setError(e?.message || 'Failed to load deal')
          setLoading(false)
        }
        return
      }

      // Flow 2: sigId from URL (?<uuid>)
      if (!sigId) {
        setError('No signature ID or deal ID provided')
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        setError(null)
        setPageImages([])

        // Fetch signature record by ID
        const sigRes = await fetch(`/api/esignature/signature/${encodeURIComponent(sigId)}`, { cache: 'no-store' })
        if (!sigRes.ok) {
          throw new Error('No signature request found for this ID')
        }
        const sigData = await sigRes.json()
        if (!sigData || !sigData.document_file) {
          throw new Error('No document found')
        }

        setSigRecord(sigData)

        // Derive recipient email from the record (may be a JSON array)
        const rawEmail = String(sigData.email || '').trim()
        let derivedEmail = rawEmail
        if (rawEmail.startsWith('[')) {
          try {
            const parsed = JSON.parse(rawEmail)
            derivedEmail = Array.isArray(parsed) ? (parsed[0] || '') : rawEmail
          } catch {}
        }
        setRecipientEmail(String(derivedEmail).trim().toLowerCase())

        // Parse document_file — may be a JSON array (new: {file_name,file_type,url} or old: {file_name,file_type,file_b64})
        const rawDocFile = String(sigData.document_file || '').trim()
        let fileList: Array<{ file_name: string; file_type: string; file_b64: string }> = []
        let docFileForViewer = rawDocFile

        if (rawDocFile.startsWith('[')) {
          try {
            const parsed = JSON.parse(rawDocFile)
            if (Array.isArray(parsed) && parsed.length > 0) {
              fileList = parsed
              // Support both new (url) and old (file_b64) formats
              docFileForViewer = parsed[0]?.url || parsed[0]?.file_b64 || rawDocFile
            }
          } catch {}
        } else if (rawDocFile.startsWith('{')) {
          try {
            const parsed = JSON.parse(rawDocFile)
            const src = parsed?.url || parsed?.file_b64
            if (src) {
              fileList = [parsed]
              docFileForViewer = src
            }
          } catch {}
        }

        if (fileList.length > 0) {
          setUploadedFiles(fileList)
          setSelectedFileIndex(0)
        }

        const normalized = normalizeToDataUrl(docFileForViewer, 'application/pdf')
        if (!normalized) throw new Error('Invalid document file')

        setDocMime(normalized.mime)
        setPdfDataUrl(normalized.url)

        // Determine this recipient's index using siblings
        // Primary = index 0; each sibling's index = its position + 1
        const siblings: any[] = sigData.siblings || []
        const siblingIdx = siblings.findIndex((s: any) => s.id === sigData.id)
        const myRecipientIndex = siblingIdx >= 0 ? siblingIdx + 1 : 0

        // Load fields for this signature record
        // Normalize signature_image to a usable data URL (may be raw base64 or already a data URL)
        const rawSig = String(sigData.signature_image || '').trim()
        const existingSig = rawSig
          ? rawSig.startsWith('data:') || rawSig.startsWith('http')
            ? rawSig
            : `data:image/png;base64,${rawSig}`
          : ''

        const fieldsRes = await fetch(`/api/esignature/fields?dealId=${encodeURIComponent(sigData.id)}`, { cache: 'no-store' })
        if (fieldsRes.ok) {
          const fieldsData = await fieldsRes.json()
          if (fieldsData.fields) {
            // Filter to only this recipient's fields
            const allFields: Field[] = fieldsData.fields
            const myFields = allFields.filter(f => (f.recipientIndex ?? 0) === myRecipientIndex)
            const baseFields = myFields.length > 0 ? myFields : allFields

            // Auto-fill field values from recipient data and today's date
            // NOTE: signature/initial fields are NOT auto-filled — recipient must explicitly sign each field.
            // existingSig is only used to restore the signature pad so re-signing is one click.
            const today = new Date().toLocaleDateString('en-CA')
            const filledFields = baseFields.map(f => {
              if (f.value) return f // keep already-saved value
              if (f.type === 'dateSigned') return { ...f, value: today }
              if (f.type === 'name')    return { ...f, value: sigData?.full_name || '' }
              if (f.type === 'company') return { ...f, value: sigData?.company || '' }
              if (f.type === 'title')   return { ...f, value: sigData?.title || '' }
              return f
            })

            setFields(filledFields)
            if (existingSig) setSignatureDataUrl(existingSig)
          }
        }

        setLoading(false)
      } catch (e: any) {
        setError(e?.message || 'Failed to load document')
        setLoading(false)
      }
    }

    loadDocument()
  }, [dealId, sigId])

  // Generate Bill of Sale PDF for dealId flow
  useEffect(() => {
    const generateBillOfSalePdf = async () => {
      if (!dealId || !dealData) return
      if (pdfDataUrl) return // Already have PDF

      try {
        const { jsPDF } = await import('jspdf')
        const { renderBillOfSalePdf } = await import('../new/billOfSalePdf')

        const c = dealData.customer || {}
        const vRaw = dealData.vehicles?.[0] || {}
        const sv = vRaw.selectedVehicle || vRaw
        const w = dealData.worksheet || {}
        const d = dealData.delivery || {}

        const billData = {
          dealDate: c.created_at ? new Date(c.created_at).toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' }) : '',
          invoiceNumber: String(dealId || ''),
          fullName: [c.firstname, c.lastname].filter(Boolean).join(' ') || 'Unknown',
          phone: c.phone ?? '',
          mobile: c.mobile ?? '',
          email: String(c.email ?? '').trim().toLowerCase(),
          address: c.street_address ?? c.streetaddress ?? '',
          city: c.city ?? '',
          province: c.province ?? 'ON',
          postalCode: c.postal_code ?? c.postalcode ?? '',
          driversLicense: c.drivers_license ?? c.driverslicense ?? '',
          insuranceCompany: c.insurance_company ?? c.insurancecompany ?? '',
          policyNumber: c.policy_number ?? c.policynumber ?? '',
          policyExpiry: c.policy_expiry ?? c.policyexpiry ?? '',
          stockNumber: String(sv.selected_stock_number ?? sv.stockNumber ?? sv.stock_number ?? ''),
          year: String(sv.selected_year ?? sv.year ?? ''),
          make: String(sv.selected_make ?? sv.make ?? ''),
          model: String(sv.selected_model ?? sv.model ?? ''),
          trim: String(sv.selected_trim ?? sv.trim ?? ''),
          colour: String(sv.selected_exterior_color ?? sv.exteriorColor ?? sv.exterior_color ?? ''),
          keyNumber: '',
          vin: String(sv.selected_vin ?? sv.vin ?? ''),
          odometerStatus: String(sv.selected_status ?? sv.status ?? 'Used'),
          odometer: sv.selected_odometer ?? sv.odometer ? `${Number(sv.selected_odometer ?? sv.odometer).toLocaleString()} ${String(sv.selected_odometer_unit ?? sv.odometerUnit ?? sv.odometer_unit ?? 'kms')}` : '',
          serviceDate: '',
          deliveryDate: d.delivery_date ?? '',
          vehiclePrice: String(w.vehicle_price ?? w.purchase_price ?? sv.price ?? 0),
          discount: String(w.discount ?? 0),
          omvicFee: String(w.omvic_fee ?? 10),
          subtotal1: String(w.subtotal ?? 0),
          netDifference: String(w.net_difference ?? 0),
          hstOnNetDifference: String(w.hst_on_net ?? 0),
          totalTax: String(w.total_tax ?? 0),
          licenseFee: String(w.license_fee ?? 0),
          feesTotal: String(w.fees_total ?? 0),
          accessoriesTotal: String(w.accessories_total ?? 0),
          warrantiesTotal: String(w.warranty_total ?? 0),
          insurancesTotal: String(w.insurance_total ?? 0),
          paymentsTotal: String(w.payments_total ?? 0),
          subtotal2: String(w.subtotal_2 ?? 0),
          deposit: String(w.deposit ?? 0),
          downPayment: String(w.down_payment ?? 0),
          taxOnInsurance: String(w.tax_on_insurance ?? 0),
          totalBalanceDue: String(w.balance_due ?? w.total_due ?? 0),
          extendedWarranty: 'DECLINED',
          commentsHtml: dealData.disclosures?.disclosures_html ?? '',
          purchaserName: [c.firstname, c.lastname].filter(Boolean).join(' ') || '',
          purchaserSignatureB64: undefined,
          salesperson: d.salesperson ?? '',
          salespersonRegNo: '4782496',
          acceptorName: d.approved_by ?? 'Syed Islam',
          acceptorRegNo: '4782496',
        }

        const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' })
        const { sigLineY } = renderBillOfSalePdf(pdf, billData, { pageStart: 1, totalPages: 3 })
        // Scale from PDF pt coords to rendered pixel overlay coords
        setPurchaserSigOverlayY(Math.round(sigLineY * (PAGE_HEIGHT / 792)))

        // Convert PDF to data URL
        const pdfBlob = pdf.output('blob')
        const reader = new FileReader()
        reader.onload = () => {
          const dataUrl = reader.result as string
          setPdfDataUrl(dataUrl)
        }
        reader.readAsDataURL(pdfBlob)
      } catch (e: any) {
        console.error('Failed to generate Bill of Sale PDF:', e)
        setError('Failed to generate document')
      }
    }

    generateBillOfSalePdf()
  }, [dealId, dealData, pdfDataUrl])

  // Render PDF pages to images
  useEffect(() => {
    const run = async () => {
      try {
        if (!pdfDataUrl) return
        if (docMime !== 'application/pdf') return

        const pdfjs = await loadPdfJsFromCdn()
        // Support both HTTP URL and base64 data URL
        const isUrl = pdfDataUrl.startsWith('http://') || pdfDataUrl.startsWith('https://')
        const loadArg = isUrl ? pdfDataUrl : (() => { const bytes = pdfDataUrlToBytes(pdfDataUrl); return bytes ? { data: bytes } : null })()
        if (!loadArg) return
        const doc = await pdfjs.getDocument(loadArg).promise
        const pages = Number(doc?.numPages || 1) || 1
        setTotalPages(pages)

        const rendered: string[] = []
        for (let pageNo = 1; pageNo <= pages; pageNo++) {
          const page = await doc.getPage(pageNo)
          const viewport0 = page.getViewport({ scale: 1 })
          const scaleToWidth = PAGE_WIDTH / viewport0.width
          const viewport = page.getViewport({ scale: scaleToWidth * PDF_RENDER_QUALITY })

          const canvas = document.createElement('canvas')
          const ctx = canvas.getContext('2d')
          if (!ctx) {
            rendered.push('')
            continue
          }

          canvas.width = Math.floor(viewport.width)
          canvas.height = Math.floor(viewport.height)

          await page.render({ canvasContext: ctx, viewport, background: 'white' }).promise
          rendered.push(canvas.toDataURL('image/png'))
        }

        setPageImages(rendered.filter(Boolean))
      } catch (e: any) {
        console.error('[PDF Render] Error:', e?.message || e)
        setPageImages([])
      }
    }

    run()
  }, [pdfDataUrl, docMime])

  const getCanvas = () => canvasRef.current

  const getCtx = () => {
    const c = getCanvas()
    if (!c) return null
    return c.getContext('2d')
  }

  const getPointFromEvent = (e: PointerEvent) => {
    const c = getCanvas()
    if (!c) return null
    const rect = c.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    return { x, y }
  }

  const ensureHiDpi = () => {
    const c = getCanvas()
    if (!c) return

    const rect = c.getBoundingClientRect()
    const cssW = Math.max(1, Math.floor(rect.width))
    const cssH = Math.max(1, Math.floor(rect.height))
    const dpr = window.devicePixelRatio || 1

    const nextW = Math.floor(cssW * dpr)
    const nextH = Math.floor(cssH * dpr)

    if (c.width === nextW && c.height === nextH) return

    const ctx = c.getContext('2d')
    if (!ctx) return

    const prev = document.createElement('canvas')
    prev.width = c.width
    prev.height = c.height
    const prevCtx = prev.getContext('2d')
    if (prevCtx) prevCtx.drawImage(c, 0, 0)

    c.width = nextW
    c.height = nextH

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = '#000000'
    ctx.lineWidth = penSize

    if (prev.width && prev.height) {
      ctx.drawImage(prev, 0, 0, prev.width, prev.height, 0, 0, cssW, cssH)
    }
  }

  const applyPen = () => {
    const ctx = getCtx()
    if (!ctx) return
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = '#000000'
    ctx.lineWidth = penSize
  }

  const startDraw = (e: PointerEvent) => {
    const c = getCanvas()
    const ctx = getCtx()
    if (!c || !ctx) return

    ensureHiDpi()
    applyPen()

    const p = getPointFromEvent(e)
    if (!p) return

    drawingRef.current = true
    lastPointRef.current = p

    ctx.beginPath()
    ctx.moveTo(p.x, p.y)
  }

  const moveDraw = (e: PointerEvent) => {
    if (!drawingRef.current) return
    const ctx = getCtx()
    if (!ctx) return

    const p = getPointFromEvent(e)
    if (!p) return

    const last = lastPointRef.current
    if (!last) {
      lastPointRef.current = p
      return
    }

    ctx.beginPath()
    ctx.moveTo(last.x, last.y)
    ctx.lineTo(p.x, p.y)
    ctx.stroke()

    lastPointRef.current = p
  }

  const endDraw = () => {
    drawingRef.current = false
    lastPointRef.current = null
  }

  const clear = () => {
    const c = getCanvas()
    const ctx = getCtx()
    if (!c || !ctx) return

    const rect = c.getBoundingClientRect()
    ctx.clearRect(0, 0, rect.width, rect.height)
    setSignatureDataUrl(null)
  }

  const save = async (overrideUrl?: string) => {
    if (saving) return
    let url = overrideUrl || ''
    if (!url) {
      const c = getCanvas()
      if (!c) return
      url = c.toDataURL('image/png')
    }
    setSignatureDataUrl(url)

    // Stamp signature image onto the field that triggered the modal
    // Also compute updatedFields synchronously so we can save them to DB below
    let updatedFields = fields
    if (currentSigningField) {
      updatedFields = fields.map(f => f.id === currentSigningField ? { ...f, value: url } : f)
      setFields(updatedFields)
      setCurrentSigningField(null)
    }

    setSaving(true)
    setSaveModalOpen(false)
    setSaveOk(null)
    setSaveMessage('')

    try {
      const b64 = url.split(',')[1] || url
      
      let ipAddress = 'unknown'
      try {
        const ipRes = await fetch('https://api.ipify.org?format=json')
        const ipData = await ipRes.json()
        ipAddress = ipData.ip || 'unknown'
      } catch {
        // ignore
      }

      if (isDealPurchaserSignature && dealId) {
        // Purchaser signature from Bill of Sale – send to /webhook/receive
        const c = dealData?.customer || {}
        const purchaserName = [c.firstname, c.lastname].filter(Boolean).join(' ') || ''
        const hookRes = await fetch('https://primary-production-6722.up.railway.app/webhook/receive', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            dealId,
            type: 'purchaser_signature',
            purchaser_name: purchaserName,
            signature_b64: b64,
            ip_address: ipAddress,
            signed_at: new Date().toISOString(),
          }),
        })
        if (!hookRes.ok) {
          const t = await hookRes.text().catch(() => '')
          throw new Error(t || `Webhook failed (${hookRes.status})`)
        }
        setPurchaserSigned(true)
      } else {
        // E-signature flow – send to /webhook/receive-signature
        const filesWithFields = uploadedFiles.length > 0
          ? uploadedFiles.map((f, idx) => ({
              file_name: f.file_name,
              file_type: f.file_type,
              file_b64: f.file_b64,
              fields: fields.filter(field => (field.fileIndex ?? 0) === idx),
            }))
          : null

        const hookRes = await fetch('https://primary-production-6722.up.railway.app/webhook/receive-signature', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: sigRecord?.id || null,
            email: [recipientEmail].filter(Boolean),
            signature_b64: b64,
            ip_address: ipAddress,
            files: filesWithFields,
          }),
        })

        if (!hookRes.ok) {
          const t = await hookRes.text().catch(() => '')
          throw new Error(t || `Webhook failed (${hookRes.status})`)
        }

        // Record "Signed" event in localStorage for process history
        try {
          const sigId = sigRecord?.id
          if (sigId) {
            const lsKey = `edc_sig_events_${sigId}`
            const existing = JSON.parse(localStorage.getItem(lsKey) || '[]')
            existing.push({
              user_name: sigRecord?.full_name || recipientEmail || 'Recipient',
              user_email: recipientEmail || '',
              action: 'Signed',
              activity: `${sigRecord?.full_name || recipientEmail || 'Recipient'} signed the document`,
              status: 'Signed',
              created_at: new Date().toISOString(),
            })
            localStorage.setItem(lsKey, JSON.stringify(existing))
          }
        } catch { /* non-fatal */ }

        // Save to database: update signature record + individual field rows
        if (sigRecord?.id) {
          const now = new Date().toISOString()
          try {
            // 1. Update signature record with per-field-type columns
            await fetch(`/api/esignature/signature/${encodeURIComponent(sigRecord.id)}/complete`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                signature_image: url,
                signed_at: now,
                status: 'completed',
                fields_data: JSON.stringify(updatedFields),
                recipient_index: 0,
                deal_id: sigRecord.id,
              }),
            })
          } catch { /* non-fatal — webhook already succeeded */ }

          // 2. Save each individual field value to edc_esignature_fields
          try {
            const fieldUpdates = updatedFields
              .filter(f => f.value !== undefined && f.value !== null && f.value !== '')
              .map(f =>
                fetch('/api/esignature/fields', {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    dealId: sigRecord.id,
                    fieldId: f.id,
                    value: f.value,
                    signedAt: now,
                  }),
                }).catch(() => null)
              )
            await Promise.all(fieldUpdates)
          } catch { /* non-fatal */ }
        }
      }

      setSaveOk(true)
      setSaveMessage('Signature saved successfully!')
      setSaveModalOpen(true)
    } catch (err) {
      setSaveOk(false)
      setSaveMessage(err instanceof Error ? err.message : 'Failed to save signature.')
      setSaveModalOpen(true)
    } finally {
      setIsDealPurchaserSignature(false)
    }

    setSaving(false)
  }

  const handleSwitchFile = (index: number) => {
    const file = uploadedFiles[index]
    if (!file) return
    setSelectedFileIndex(index)
    setPageImages([])
    const src = (file as any).url || file.file_b64
    const normalized = normalizeToDataUrl(src, file.file_type || 'application/pdf')
    if (!normalized) return
    setDocMime(normalized.mime)
    setPdfDataUrl(normalized.url)
  }

  useEffect(() => {
    ensureHiDpi()
    applyPen()
  }, [])

  useEffect(() => {
    if (!signatureModalOpen || signatureMode !== 'draw') return

    let raf = 0
    let cleanup: null | (() => void) = null

    const bind = () => {
      const c = getCanvas()
      if (!c) return

      ensureHiDpi()
      applyPen()


      const onPointerDown = (e: PointerEvent) => {
        e.preventDefault()
        c.setPointerCapture(e.pointerId)
        startDraw(e)
      }
      const onPointerMove = (e: PointerEvent) => {
        e.preventDefault()
        moveDraw(e)
      }
      const onPointerUp = (e: PointerEvent) => {
        e.preventDefault()
        endDraw()
      }
      const onPointerCancel = (e: PointerEvent) => {
        e.preventDefault()
        endDraw()
      }

      c.addEventListener('pointerdown', onPointerDown)
      c.addEventListener('pointermove', onPointerMove)
      c.addEventListener('pointerup', onPointerUp)
      c.addEventListener('pointercancel', onPointerCancel)

      cleanup = () => {
        c.removeEventListener('pointerdown', onPointerDown)
        c.removeEventListener('pointermove', onPointerMove)
        c.removeEventListener('pointerup', onPointerUp)
        c.removeEventListener('pointercancel', onPointerCancel)
      }
    }

    // Wait for the modal/canvas to mount.
    raf = window.requestAnimationFrame(bind)

    return () => {
      if (raf) window.cancelAnimationFrame(raf)
      cleanup?.()
    }
  }, [signatureModalOpen, signatureMode, penSize])

  useEffect(() => {
    const onResize = () => {
      ensureHiDpi()
      applyPen()
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [penSize])

  useEffect(() => {
    const host = signatureBoxRef.current
    if (!host) return

    const ro = new ResizeObserver(() => {
      ensureHiDpi()
      applyPen()
    })
    ro.observe(host)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    applyPen()
  }, [penSize])

  // Render field content
  const renderFieldContent = (field: Field) => {
    // Font fills ~55% of field height, clamped between 11px and 48px
    const fontSize = Math.min(48, Math.max(11, Math.round(field.height * 0.55)))
    const fontStyle: React.CSSProperties = { fontSize: `${fontSize}px`, lineHeight: 1.1 }

    switch (field.type) {
      case 'signature':
        if (field.value) {
          return (
            <img
              src={field.value}
              alt="Signature"
              className="w-full h-full object-contain p-1"
              style={{ background: 'transparent' }}
            />
          )
        }
        return (
          <div
            className="flex items-center justify-center h-full text-blue-600 text-xs font-medium cursor-pointer hover:bg-blue-100/90"
            onClick={() => { setIsInitialModal(false); setCurrentSigningField(field.id); setSignatureModalOpen(true) }}
          >
            <span style={fontStyle}>Signature</span>
          </div>
        )
      case 'initial':
        if (field.value) {
          return (
            <img
              src={field.value}
              alt="Initial"
              className="w-full h-full object-contain p-1"
              style={{ background: 'transparent' }}
            />
          )
        }
        return (
          <div
            className="flex items-center justify-center h-full text-blue-600 text-xs font-bold cursor-pointer hover:bg-blue-100/90"
            onClick={() => {
              // Pre-fill typed name with recipient's initials
              const name = sigRecord?.full_name || ''
              const initials = name ? name.split(' ').map((n: string) => n[0]).join('').toUpperCase() : ''
              setTypedName(initials)
              setSignatureMode('type')
              setIsInitialModal(true)
              setCurrentSigningField(field.id)
              setSignatureModalOpen(true)
            }}
          >
            <span style={fontStyle}>Initial</span>
          </div>
        )
      case 'dateSigned': {
        const openEdit = () => {
          setEditFieldModal({ id: field.id, type: field.type, label: 'Date Signed', value: field.value || new Date().toLocaleDateString('en-CA') })
          setEditFieldValue(field.value || new Date().toLocaleDateString('en-CA'))
        }
        return (
          <div className="flex items-center justify-center h-full font-medium cursor-pointer hover:bg-blue-50/80 text-gray-700 overflow-hidden" style={fontStyle} onClick={e => { e.stopPropagation(); openEdit() }}>
            {field.value || new Date().toLocaleDateString('en-CA')}
          </div>
        )
      }
      case 'name':
        return (
          <div className="flex items-center h-full px-1 font-medium text-gray-800 overflow-hidden" style={fontStyle}>
            {field.value || sigRecord?.full_name || 'Name'}
          </div>
        )
      case 'company': {
        const openEdit = () => {
          const cur = field.value ?? sigRecord?.company ?? ''
          setEditFieldModal({ id: field.id, type: field.type, label: 'Company', value: cur })
          setEditFieldValue(cur)
        }
        return (
          <div className="flex items-center h-full px-1 text-gray-700 cursor-pointer hover:bg-blue-50/80 overflow-hidden" style={fontStyle} onClick={e => { e.stopPropagation(); openEdit() }}>
            {field.value || sigRecord?.company || <span style={{ color: '#60a5fa' }}>Click to enter</span>}
          </div>
        )
      }
      case 'title': {
        const openEdit = () => {
          const cur = field.value ?? sigRecord?.title ?? ''
          setEditFieldModal({ id: field.id, type: field.type, label: 'Title', value: cur })
          setEditFieldValue(cur)
        }
        return (
          <div className="flex items-center h-full px-1 text-gray-700 cursor-pointer hover:bg-blue-50/80 overflow-hidden" style={fontStyle} onClick={e => { e.stopPropagation(); openEdit() }}>
            {field.value || sigRecord?.title || <span style={{ color: '#60a5fa' }}>Click to enter</span>}
          </div>
        )
      }
      case 'text': {
        const openEdit = () => {
          const cur = field.value ?? ''
          setEditFieldModal({ id: field.id, type: field.type, label: 'Text', value: cur })
          setEditFieldValue(cur)
        }
        return (
          <div className="flex items-center h-full px-1 text-gray-600 cursor-pointer hover:bg-blue-50/80 overflow-hidden" style={fontStyle} onClick={e => { e.stopPropagation(); openEdit() }}>
            {field.value || <span style={{ color: '#60a5fa' }}>Click to enter</span>}
          </div>
        )
      }
      case 'checkbox': {
        const checked = ['true', '1', 'yes'].includes(String(field.value ?? '').toLowerCase())
        const cbSize = Math.max(12, Math.round(field.height * 0.8))
        return (
          <div
            className="flex items-center justify-center h-full cursor-pointer"
            onClick={e => { e.stopPropagation(); setFields(prev => prev.map(f => f.id === field.id ? { ...f, value: checked ? 'false' : 'true' } : f)) }}
          >
            {checked
              ? <svg style={{ width: cbSize, height: cbSize }} viewBox="0 0 20 20" fill="none"><rect x="1" y="1" width="18" height="18" rx="3" fill="#3b82f6" stroke="#2563eb" strokeWidth="1.5"/><path d="M5 10l3 3 7-7" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              : <div style={{ width: cbSize, height: cbSize }} className="border-2 border-blue-500 rounded bg-white" />
            }
          </div>
        )
      }
      case 'stamp':
        return (
          <div className="flex items-center justify-center h-full text-red-600 text-xs font-bold">
            STAMP
          </div>
        )
      default:
        return null
    }
  }

  return (
    <div className="min-h-screen w-full" style={{ backgroundColor: '#1a1a2e', backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.05) 1px, transparent 1px)', backgroundSize: '24px 24px' }}>
      <div className="sticky top-0 z-10 border-b border-white/10 bg-[#1a1a2e]/95 backdrop-blur-xl">
        <div className="w-full px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col items-center text-center">
            <div className="relative h-12 w-12 sm:h-14 sm:w-14">
              <NextImage src="/images/logo.png" alt="EDC" fill className="object-contain" />
            </div>
            <div className="mt-2 text-lg sm:text-xl font-bold text-white">{title}</div>
            {recipientEmail && (
              <div className="mt-1 text-sm text-slate-300">For: {recipientEmail}</div>
            )}
            <div className="mt-1 text-xs text-slate-400">Review the document and sign where indicated</div>
          </div>
        </div>
      </div>

      <div className="w-full px-4 sm:px-6 lg:px-8 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-3">
              <div className="animate-spin rounded-full h-10 w-10 border-2 border-blue-500 border-t-transparent"></div>
              <span className="text-sm text-slate-400">Loading document...</span>
            </div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="text-red-400 text-lg font-semibold mb-2">Error</div>
              <div className="text-slate-300">{error}</div>
            </div>
          </div>
        ) : (
          <>
            {/* Document with fields */}
            <div className="mb-6">
              <div className="mb-4 flex items-center justify-between flex-wrap gap-2">
                <div>
                  <div className="text-sm font-semibold text-white">Document</div>
                  <div className="text-xs text-slate-400">Review the document below. Fields are highlighted where you need to take action.</div>
                </div>
                {/* File tabs — visible when there are multiple files */}
                {uploadedFiles.length > 1 && (
                  <div className="flex items-center gap-1 bg-white/10 rounded-lg p-1 overflow-x-auto max-w-full">
                    {uploadedFiles.map((file, idx) => (
                      <button
                        key={`sig-file-tab-${idx}`}
                        type="button"
                        onClick={() => handleSwitchFile(idx)}
                        title={file.file_name}
                        className={`shrink-0 px-3 py-1.5 rounded-md text-xs font-medium transition-colors truncate max-w-[160px] ${
                          selectedFileIndex === idx
                            ? 'bg-white text-blue-700 shadow-sm'
                            : 'text-slate-300 hover:text-white hover:bg-white/10'
                        }`}
                      >
                        {file.file_name || `File ${idx + 1}`}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-center overflow-auto">
                <div 
                  className="relative"
                  style={{ width: `${PAGE_WIDTH}px` }}
                >
                  {/* Render pages */}
                  {pageImages.length > 0 ? (
                    pageImages.map((img, idx) => {
                      const pageNo = idx + 1
                      const pageFields = fields.filter(f => f.page === pageNo && (f.fileIndex ?? 0) === selectedFileIndex)
                      const isLast = idx === pageImages.length - 1
                      return (
                        <div key={pageNo} className="relative">
                          <div className="relative bg-white border-2 border-slate-300 shadow-md" style={{ height: `${PAGE_HEIGHT}px` }}>
                            <img
                              src={img}
                              alt={`Page ${pageNo}`}
                              className="w-full h-full object-contain"
                            />
                            {/* Field overlays */}
                            {pageFields.map((field) => (
                              <div
                                key={field.id}
                                className="absolute border-2 border-blue-400 bg-blue-50/80 rounded cursor-pointer hover:bg-blue-100/90 transition-colors"
                                style={{
                                  left: `${field.x}px`,
                                  top: `${field.y}px`,
                                  width: `${field.width}px`,
                                  height: `${field.height}px`,
                                }}
                                title={fieldTypeLabels[field.type]}
                              >
                                {renderFieldContent(field)}
                              </div>
                            ))}
                            {/* Purchaser signature overlay — dealId flow, page 1 only */}
                            {dealId && pageNo === 1 && purchaserSigOverlayY !== null && (
                              <div
                                className="absolute border-2 border-blue-400 bg-blue-50/80 rounded hover:bg-blue-100/90 transition-colors"
                                style={{
                                  left: `${Math.round(96 * PAGE_WIDTH / 612)}px`,
                                  top: `${purchaserSigOverlayY - 34}px`,
                                  width: `${Math.round(199 * PAGE_WIDTH / 612)}px`,
                                  height: '34px',
                                }}
                                title="Purchaser Signature"
                              >
                                {purchaserSigned && signatureDataUrl ? (
                                  <img
                                    src={signatureDataUrl}
                                    alt="Purchaser Signature"
                                    className="w-full h-full object-contain p-1"
                                    style={{ background: 'transparent' }}
                                  />
                                ) : (
                                  <div
                                    className="flex items-center justify-center h-full text-blue-600 text-xs font-medium cursor-pointer"
                                    onClick={() => {
                                      setIsDealPurchaserSignature(true)
                                      setSignatureModalOpen(true)
                                    }}
                                  >
                                    Signature
                                  </div>
                                )}
                              </div>
                            )}
                          </div>

                          <div className="w-full flex items-center justify-center py-3">
                            <div className="text-xs font-semibold text-slate-400">Page {pageNo} of {pageImages.length}</div>
                          </div>
                        </div>
                      )
                    })
                  ) : docMime && docMime.startsWith('image/') && pdfDataUrl ? (
                    <div className="relative" style={{ height: `${PAGE_HEIGHT}px` }}>
                      <img
                        src={pdfDataUrl}
                        alt="Document"
                        className="w-full h-full object-contain"
                      />
                      {fields.filter(f => f.page === 1 && (f.fileIndex ?? 0) === selectedFileIndex).map((field) => (
                        <div
                          key={field.id}
                          className="absolute border-2 border-blue-400 bg-blue-50/80 rounded cursor-pointer hover:bg-blue-100/90 transition-colors"
                          style={{
                            left: `${field.x}px`,
                            top: `${field.y}px`,
                            width: `${field.width}px`,
                            height: `${field.height}px`,
                          }}
                          title={fieldTypeLabels[field.type]}
                        >
                          {renderFieldContent(field)}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-96 text-slate-400">
                      <div className="flex flex-col items-center gap-2">
                        <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent"></div>
                        <span>Rendering document...</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>


          </>
        )}
      </div>

      {signatureModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-900">{isInitialModal ? 'Your Initial' : 'Your Signature'}</h3>
                <button
                  onClick={() => { setSignatureModalOpen(false); setIsInitialModal(false) }}
                  className="p-1 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <p className="text-xs text-slate-500 mt-1">{isInitialModal ? 'Type or draw your initials' : 'Draw your signature or type your name'}</p>
            </div>

            <div className="px-6 py-4">
              {/* Mode selector — hidden for initial (type only) */}
              {!isInitialModal && (
                <div className="flex gap-2 mb-4">
                  <button
                    onClick={() => setSignatureMode('draw')}
                    className={`flex-1 py-2 px-4 rounded-lg text-sm font-semibold transition-colors ${
                      signatureMode === 'draw'
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    Draw Signature
                  </button>
                  <button
                    onClick={() => setSignatureMode('type')}
                    className={`flex-1 py-2 px-4 rounded-lg text-sm font-semibold transition-colors ${
                      signatureMode === 'type'
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    Type Signature
                  </button>
                </div>
              )}

              {signatureMode === 'draw' && !isInitialModal ? (
                <>
                  <div className="mb-3">
                    <div className="text-sm text-slate-600">Draw your signature below</div>
                  </div>
                  <div ref={signatureBoxRef} className="rounded-xl border-2 border-slate-300 bg-white overflow-hidden" style={{ height: '200px' }}>
                    <canvas ref={canvasRef} className="w-full h-full touch-none cursor-crosshair" />
                  </div>
                </>
              ) : (
                <>
                  <div className="text-sm text-slate-600 mb-3">{isInitialModal ? 'Type your initials' : 'Type your full name'}</div>
                  <input
                    type="text"
                    value={typedName}
                    onChange={(e) => setTypedName(e.target.value)}
                    placeholder={isInitialModal ? 'Enter your initials' : 'Enter your full name'}
                    className="w-full px-4 py-3 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    autoFocus
                  />
                  {typedName && (
                    <div className="mt-4 rounded-xl border-2 border-slate-300 bg-white flex items-center justify-center" style={{ height: '200px' }}>
                      <div className="w-full text-center px-4 overflow-hidden" style={{ fontFamily: 'Brush Script MT, cursive', fontStyle: 'italic', fontSize: 'clamp(2rem, 8vw, 4.5rem)', lineHeight: 1.2 }}>
                        {typedName}
                      </div>
                    </div>
                  )}
                </>
              )}

              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-center mt-4">
                <div className="text-sm font-semibold text-slate-900">Agreement</div>
                <div className="mt-1 text-sm text-slate-600">
                  By signing below, you confirm that you have reviewed and agree to the document and all included terms.
                </div>
              </div>
            </div>

            <div className="px-6 py-4 bg-slate-50 flex items-center justify-end gap-2">
              <button
                onClick={clear}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Clear
              </button>
              <button
                onClick={async () => {
                  setSignatureModalOpen(false)
                  setIsInitialModal(false)
                  if (signatureMode === 'type' && typedName) {
                    // Measure text then render tightly so object-contain fills the field
                    const fontStr = 'italic 120px "Brush Script MT", cursive'
                    const measure = document.createElement('canvas')
                    measure.width = 1200; measure.height = 300
                    const mCtx = measure.getContext('2d')!
                    mCtx.font = fontStr
                    const metrics = mCtx.measureText(typedName)
                    const textW = Math.ceil(metrics.width)
                    const ascent = Math.ceil(metrics.actualBoundingBoxAscent ?? 100)
                    const descent = Math.ceil(metrics.actualBoundingBoxDescent ?? 20)
                    const pad = 10
                    const offCanvas = document.createElement('canvas')
                    offCanvas.width = textW + pad * 2
                    offCanvas.height = ascent + descent + pad * 2
                    const ctx = offCanvas.getContext('2d')!
                    ctx.font = fontStr
                    ctx.fillStyle = '#000000'
                    ctx.textAlign = 'left'
                    ctx.textBaseline = 'alphabetic'
                    ctx.fillText(typedName, pad, pad + ascent)
                    const url = offCanvas.toDataURL('image/png')
                    await save(url)
                  } else {
                    await save()
                  }
                }}
                disabled={signatureMode === 'type' && !typedName}
                className="px-5 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit field modal (company, title, text, dateSigned) */}
      {editFieldModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900">{editFieldModal.label}</h3>
                <p className="text-xs text-slate-500 mt-0.5">Enter your {editFieldModal.label.toLowerCase()}</p>
              </div>
              <button onClick={() => setEditFieldModal(null)} className="p-1 hover:bg-slate-100 rounded-lg transition-colors">
                <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>
            <div className="px-6 py-5">
              {editFieldModal.type === 'dateSigned' ? (
                <input
                  type="date"
                  autoFocus
                  value={editFieldValue}
                  onChange={e => setEditFieldValue(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              ) : (
                <input
                  type="text"
                  autoFocus
                  value={editFieldValue}
                  onChange={e => setEditFieldValue(e.target.value)}
                  placeholder={`Enter ${editFieldModal.label.toLowerCase()}`}
                  className="w-full px-4 py-3 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      setFields(prev => prev.map(f => f.id === editFieldModal.id ? { ...f, value: editFieldValue } : f))
                      setEditFieldModal(null)
                    }
                  }}
                />
              )}
              {editFieldValue && editFieldModal.type !== 'dateSigned' && (
                <div className="mt-4 p-4 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-800">
                  {editFieldValue}
                </div>
              )}
            </div>
            <div className="px-6 py-4 bg-slate-50 flex items-center justify-end gap-2">
              <button onClick={() => setEditFieldModal(null)} className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors">
                Cancel
              </button>
              <button
                onClick={() => {
                  setFields(prev => prev.map(f => f.id === editFieldModal.id ? { ...f, value: editFieldValue } : f))
                  setEditFieldModal(null)
                }}
                className="px-5 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {saveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSaveModalOpen(false)} />
          <div className="relative w-full max-w-md rounded-xl border border-slate-200 bg-white shadow-2xl p-6">
            <div className={`text-lg font-bold ${saveOk ? 'text-green-600' : 'text-red-600'}`}>
              {saveOk ? '✓ Success' : '✗ Error'}
            </div>
            <div className="mt-2 text-sm text-slate-600">{saveMessage}</div>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setSaveModalOpen(false)}
                className="h-9 px-4 rounded-lg bg-slate-100 text-slate-700 text-sm font-medium hover:bg-slate-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function DealsSignaturePage() {
  return (
    <Suspense fallback={null}>
      <DealsSignaturePageInner />
    </Suspense>
  )
}
