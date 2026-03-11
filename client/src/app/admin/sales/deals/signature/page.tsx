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
type Field = { id: string; type: FieldType; x: number; y: number; width: number; height: number; page: number; value?: string }

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
  // 2. email flow (from E-Signature tab): ?email@example.com
  const dealId = useMemo(() => {
    return searchParams.get('dealId') || ''
  }, [searchParams])

  const recipientEmail = useMemo(() => {
    // If dealId is present, don't use email flow
    if (searchParams.get('dealId')) return ''
    const raw = searchParams.toString()
    // The email is the first key (before any =)
    const firstKey = raw.split('=')[0] || raw.split('&')[0] || ''
    return decodeURIComponent(firstKey).trim().toLowerCase()
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
  
  // Document state
  const [sigRecord, setSigRecord] = useState<any>(null)
  const [fields, setFields] = useState<Field[]>([])
  const [pageImages, setPageImages] = useState<string[]>([])
  const [totalPages, setTotalPages] = useState(1)
  const [docMime, setDocMime] = useState<string | null>(null)
  const [pdfDataUrl, setPdfDataUrl] = useState<string | null>(null)

  const [dealData, setDealData] = useState<any>(null)

  const title = useMemo(() => {
    if (dealId) return `E-Signature Request`
    if (recipientEmail) return `E-Signature Request`
    return 'Signature'
  }, [dealId, recipientEmail])

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

      // Flow 2: email from E-Signature tab
      if (!recipientEmail) {
        setError('No recipient email or deal ID provided')
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        setError(null)
        setPageImages([])

        // Fetch signature record by email
        const sigRes = await fetch(`/api/esignature/signature-by-email?email=${encodeURIComponent(recipientEmail)}`, { cache: 'no-store' })
        if (!sigRes.ok) {
          throw new Error('No signature request found for this email')
        }
        const sigData = await sigRes.json()
        if (!sigData || !sigData.document_file) {
          throw new Error('No document found')
        }

        setSigRecord(sigData)

        // Normalize document_file to data URL
        const normalized = normalizeToDataUrl(String(sigData.document_file || ''), 'application/pdf')
        if (!normalized) throw new Error('Invalid document file')

        setDocMime(normalized.mime)
        setPdfDataUrl(normalized.url)

        // Load fields for this signature record
        const fieldsRes = await fetch(`/api/esignature/fields?dealId=${encodeURIComponent(sigData.id)}`, { cache: 'no-store' })
        if (fieldsRes.ok) {
          const fieldsData = await fieldsRes.json()
          if (fieldsData.fields) {
            setFields(fieldsData.fields)
          }
        }

        setLoading(false)
      } catch (e: any) {
        setError(e?.message || 'Failed to load document')
        setLoading(false)
      }
    }

    loadDocument()
  }, [dealId, recipientEmail])

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
        renderBillOfSalePdf(pdf, billData, { pageStart: 1, totalPages: 3 })

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

        const bytes = pdfDataUrlToBytes(pdfDataUrl)
        if (!bytes) return

        const pdfjs = await loadPdfJsFromCdn()
        const doc = await pdfjs.getDocument({ data: bytes }).promise
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

      const hookRes = await fetch('https://primary-production-6722.up.railway.app/webhook/receive-signature', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: sigRecord?.id || null,
          email: recipientEmail,
          signature_b64: b64,
          ip_address: ipAddress,
        }),
      })

      if (!hookRes.ok) {
        const t = await hookRes.text().catch(() => '')
        throw new Error(t || `Webhook failed (${hookRes.status})`)
      }

      setSaveOk(true)
      setSaveMessage('Signature saved successfully!')
      setSaveModalOpen(true)
    } catch (err) {
      setSaveOk(false)
      setSaveMessage(err instanceof Error ? err.message : 'Failed to save signature.')
      setSaveModalOpen(true)
    }

    setSaving(false)
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
    switch (field.type) {
      case 'signature':
        return (
          <div 
            className="flex items-center justify-center h-full text-blue-600 text-xs font-medium cursor-pointer hover:bg-blue-100/90"
            onClick={() => setSignatureModalOpen(true)}
          >
            Here need to Sign
          </div>
        )
      case 'initial':
        return (
          <div className="flex items-center justify-center h-full text-blue-600 text-xs font-bold">
            Initial
          </div>
        )
      case 'dateSigned':
        return (
          <div className="flex items-center justify-center h-full text-gray-600 text-xs">
            {new Date().toLocaleDateString('en-CA')}
          </div>
        )
      case 'name':
        return (
          <div className="flex items-center h-full px-2 text-gray-800 text-xs">
            {sigRecord?.full_name || 'Name'}
          </div>
        )
      case 'company':
        return (
          <div className="flex items-center h-full px-2 text-gray-600 text-xs">
            {sigRecord?.company || 'Company'}
          </div>
        )
      case 'title':
        return (
          <div className="flex items-center h-full px-2 text-gray-600 text-xs">
            {sigRecord?.title || 'Title'}
          </div>
        )
      case 'text':
        return (
          <div className="flex items-center h-full px-2 text-gray-600 text-xs">
            {field.value || 'Text'}
          </div>
        )
      case 'checkbox':
        return (
          <div className="flex items-center justify-center h-full">
            <div className="w-4 h-4 border-2 border-blue-500 rounded bg-white" />
          </div>
        )
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
              <div className="mb-4">
                <div className="text-sm font-semibold text-white">Document</div>
                <div className="text-xs text-slate-400">Review the document below. Fields are highlighted where you need to take action.</div>
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
                      const pageFields = fields.filter(f => f.page === pageNo)
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
                      {fields.filter(f => f.page === 1).map((field) => (
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
                <h3 className="text-lg font-bold text-slate-900">Your Signature</h3>
                <button
                  onClick={() => setSignatureModalOpen(false)}
                  className="p-1 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <p className="text-xs text-slate-500 mt-1">Draw your signature or type your name</p>
            </div>

            <div className="px-6 py-4">
              {/* Mode selector */}
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

              {signatureMode === 'draw' ? (
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
                  <div className="text-sm text-slate-600 mb-3">Type your full name</div>
                  <input
                    type="text"
                    value={typedName}
                    onChange={(e) => setTypedName(e.target.value)}
                    placeholder="Enter your full name"
                    className="w-full px-4 py-3 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {typedName && (
                    <div className="mt-4 p-6 rounded-xl border-2 border-slate-300 bg-white text-center">
                      <div className="text-4xl" style={{ fontFamily: 'Brush Script MT, cursive', fontStyle: 'italic' }}>
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
                  if (signatureMode === 'type' && typedName) {
                    // Convert typed name to off-screen canvas and get b64 directly (transparent background)
                    const offCanvas = document.createElement('canvas')
                    offCanvas.width = 800
                    offCanvas.height = 200
                    const ctx = offCanvas.getContext('2d')
                    if (ctx) {
                      ctx.clearRect(0, 0, offCanvas.width, offCanvas.height)
                      ctx.fillStyle = '#000000'
                      ctx.font = 'italic 60px "Brush Script MT", cursive'
                      ctx.textAlign = 'center'
                      ctx.textBaseline = 'middle'
                      ctx.fillText(typedName, offCanvas.width / 2, offCanvas.height / 2)
                      const url = offCanvas.toDataURL('image/png')
                      await save(url)
                    }
                  } else {
                    await save()
                  }
                }}
                disabled={signatureMode === 'type' && !typedName}
                className="px-5 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Submit Signature
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
