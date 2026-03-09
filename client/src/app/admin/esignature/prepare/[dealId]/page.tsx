'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import jsPDF from 'jspdf'
import { renderBillOfSalePdf, type BillOfSaleData } from '../../../sales/deals/new/billOfSalePdf'

type FieldType = 'signature' | 'initial' | 'stamp' | 'dateSigned' | 'name' | 'company' | 'title' | 'text' | 'checkbox'
type Field = { id: string; type: FieldType; x: number; y: number; width: number; height: number; page: number; value?: string }

const FIELD_TYPES: { type: FieldType; label: string; defaultW: number; defaultH: number }[] = [
  { type: 'signature', label: 'Signature', defaultW: 200, defaultH: 60 },
  { type: 'initial', label: 'Initial', defaultW: 80, defaultH: 40 },
  { type: 'stamp', label: 'Stamp', defaultW: 100, defaultH: 100 },
  { type: 'dateSigned', label: 'Date Signed', defaultW: 120, defaultH: 30 },
  { type: 'name', label: 'Name', defaultW: 150, defaultH: 30 },
  { type: 'company', label: 'Company', defaultW: 150, defaultH: 30 },
  { type: 'title', label: 'Title', defaultW: 150, defaultH: 30 },
  { type: 'text', label: 'Text', defaultW: 200, defaultH: 30 },
  { type: 'checkbox', label: 'Checkbox', defaultW: 24, defaultH: 24 },
]

const FieldIcon = ({ type }: { type: FieldType }) => {
  const cls = 'w-5 h-5 text-gray-500'
  switch (type) {
    case 'signature': return <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 17c1.5-2 3-3 5-1s3 1.5 5 0 3-2 5-1 2 2 3 1"/><path d="M3 21h18"/></svg>
    case 'initial': return <span className="text-sm font-bold text-gray-500 w-5 text-center">AB</span>
    case 'stamp': return <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="14" width="18" height="6" rx="1"/><path d="M7 14V8a5 5 0 0 1 10 0v6"/><path d="M5 20h14"/></svg>
    case 'dateSigned': return <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/><path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"/></svg>
    case 'name': return <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="4"/><path d="M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/></svg>
    case 'company': return <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="4" y="2" width="16" height="20" rx="2"/><path d="M9 22v-4h6v4M8 6h.01M16 6h.01M12 6h.01M8 10h.01M16 10h.01M12 10h.01M8 14h.01M16 14h.01M12 14h.01"/></svg>
    case 'title': return <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 7h-9M14 17H5"/><circle cx="17" cy="17" r="3"/><circle cx="7" cy="7" r="3"/></svg>
    case 'text': return <span className="text-sm font-bold text-gray-500 w-5 text-center">T</span>
    case 'checkbox': return <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 12l2 2 4-4"/></svg>
    default: return null
  }
}

const SNAP_THRESHOLD = 6
const PAGE_WIDTH = 816
const PAGE_HEIGHT = 1056
const TOTAL_PAGES = 3

export default function PrepareDocumentPage() {
  const params = useParams()
  const router = useRouter()
  const dealId = params?.dealId as string
  const containerRef = useRef<HTMLDivElement>(null)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pdfDataUrl, setPdfDataUrl] = useState<string | null>(null)
  const [pdfPageUrls, setPdfPageUrls] = useState<string[]>([])
  const [fields, setFields] = useState<Field[]>([])
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [dealData, setDealData] = useState<any>(null)
  const [zoom, setZoom] = useState(100)
  const [showGrid, setShowGrid] = useState(false)
  const [draggedSidebarType, setDraggedSidebarType] = useState<FieldType | null>(null)
  const [, forceRender] = useState(0)

  // History for undo/redo
  const historyRef = useRef<Field[][]>([[]])
  const historyIdxRef = useRef(0)

  const pushHistory = useCallback((newFields: Field[]) => {
    const h = historyRef.current
    const idx = historyIdxRef.current
    historyRef.current = [...h.slice(0, idx + 1), JSON.parse(JSON.stringify(newFields))]
    historyIdxRef.current = historyRef.current.length - 1
  }, [])

  const undo = useCallback(() => {
    if (historyIdxRef.current > 0) {
      historyIdxRef.current--
      setFields(JSON.parse(JSON.stringify(historyRef.current[historyIdxRef.current])))
    }
  }, [])

  const redo = useCallback(() => {
    if (historyIdxRef.current < historyRef.current.length - 1) {
      historyIdxRef.current++
      setFields(JSON.parse(JSON.stringify(historyRef.current[historyIdxRef.current])))
    }
  }, [])

  // GPU drag/resize refs - no React re-renders during interaction
  const interactionRef = useRef<{
    type: 'none' | 'drag' | 'resize'
    fieldId: string
    el: HTMLElement | null
    offsetX: number
    offsetY: number
    dir: string
    startMouseX: number
    startMouseY: number
    origX: number
    origY: number
    origW: number
    origH: number
  }>({ type: 'none', fieldId: '', el: null, offsetX: 0, offsetY: 0, dir: '', startMouseX: 0, startMouseY: 0, origX: 0, origY: 0, origW: 0, origH: 0 })

  const fieldsRef = useRef<Field[]>([])
  fieldsRef.current = fields
  const selectedRef = useRef<string | null>(null)
  selectedRef.current = selectedFieldId
  const guidesRef = useRef<{ hLine: HTMLDivElement | null; vLine: HTMLDivElement | null }>({ hLine: null, vLine: null })
  const getDocY = (f: Field) => ((f.page || 1) - 1) * PAGE_HEIGHT + f.y

  // Native window mousemove/mouseup for zero-lag GPU interaction
  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      const ir = interactionRef.current
      if (ir.type === 'none' || !containerRef.current || !ir.el) return

      const rect = containerRef.current.getBoundingClientRect()
      const scale = zoom / 100

      if (ir.type === 'drag') {
        let newX = (e.clientX - rect.left) / scale - ir.offsetX
        let newY = (e.clientY - rect.top) / scale - ir.offsetY
        newX = Math.max(0, newX)
        newY = Math.max(0, newY)

        // Snap to other fields
        const others = fieldsRef.current.filter(f => f.id !== ir.fieldId)
        const field = fieldsRef.current.find(f => f.id === ir.fieldId)
        let snapX: number | undefined
        let snapY: number | undefined
        if (field) {
          const maxY = PAGE_HEIGHT * TOTAL_PAGES - field.height
          newY = Math.min(newY, Math.max(maxY, 0))
          for (const o of others) {
            const oDocY = getDocY(o)
            if (Math.abs(newX - o.x) < SNAP_THRESHOLD) { newX = o.x; snapX = o.x }
            if (Math.abs(newY - oDocY) < SNAP_THRESHOLD) { newY = oDocY; snapY = oDocY }
            if (Math.abs((newX + field.width) - (o.x + o.width)) < SNAP_THRESHOLD) { newX = o.x + o.width - field.width; snapX = o.x + o.width }
            if (Math.abs((newY + field.height) - (oDocY + o.height)) < SNAP_THRESHOLD) { newY = oDocY + o.height - field.height; snapY = oDocY + o.height }
            const cxNew = newX + field.width / 2, cxO = o.x + o.width / 2
            const cyNew = newY + field.height / 2, cyO = oDocY + o.height / 2
            if (Math.abs(cxNew - cxO) < SNAP_THRESHOLD) { newX = cxO - field.width / 2; snapX = cxO }
            if (Math.abs(cyNew - cyO) < SNAP_THRESHOLD) { newY = cyO - field.height / 2; snapY = cyO }
          }
        }

        // Show/hide guide lines (positions must be scaled)
        if (guidesRef.current.vLine) guidesRef.current.vLine.style.display = snapX !== undefined ? 'block' : 'none'
        if (guidesRef.current.vLine && snapX !== undefined) guidesRef.current.vLine.style.left = `${snapX * scale}px`
        if (guidesRef.current.hLine) guidesRef.current.hLine.style.display = snapY !== undefined ? 'block' : 'none'
        if (guidesRef.current.hLine && snapY !== undefined) guidesRef.current.hLine.style.top = `${snapY * scale}px`

        // GPU-accelerated: directly set transform (no React state update)
        ir.el.style.transform = `translate3d(${newX * scale}px, ${newY * scale}px, 0)`
        ir.origX = newX
        ir.origY = newY
      }

      if (ir.type === 'resize') {
        const dx = (e.clientX - ir.startMouseX) / scale
        const dy = (e.clientY - ir.startMouseY) / scale
        let w = ir.origW, h = ir.origH, x = ir.origX, y = ir.origY

        if (ir.dir.includes('e')) w = Math.max(40, ir.origW + dx)
        if (ir.dir.includes('w')) { w = Math.max(40, ir.origW - dx); if (w > 40) x = ir.origX + dx }
        if (ir.dir.includes('s')) h = Math.max(20, ir.origH + dy)
        if (ir.dir.includes('n')) { h = Math.max(20, ir.origH - dy); if (h > 20) y = ir.origY + dy }

        ir.el.style.transform = `translate3d(${x * scale}px, ${y * scale}px, 0)`
        ir.el.style.width = `${w * scale}px`
        ir.el.style.height = `${h * scale}px`
        // Store final values for commit
        ;(ir as any)._finalX = x
        ;(ir as any)._finalY = y
        ;(ir as any)._finalW = w
        ;(ir as any)._finalH = h
      }
    }

    const onMouseUp = () => {
      const ir = interactionRef.current
      if (ir.type === 'none') return

      // Hide guides
      if (guidesRef.current.vLine) guidesRef.current.vLine.style.display = 'none'
      if (guidesRef.current.hLine) guidesRef.current.hLine.style.display = 'none'

      // Commit final position/size to React state (single update)
      if (ir.type === 'drag') {
        setFields(prev => {
          const next = prev.map(f => {
            if (f.id !== ir.fieldId) return f
            const rawPage = Math.floor(ir.origY / PAGE_HEIGHT) + 1
            const page = Math.min(Math.max(rawPage, 1), TOTAL_PAGES)
            const y = ir.origY - (page - 1) * PAGE_HEIGHT
            return { ...f, x: ir.origX, y: Math.max(0, y), page }
          })
          pushHistory(next)
          return next
        })
      }
      if (ir.type === 'resize') {
        const fx = (ir as any)._finalX ?? ir.origX
        const fy = (ir as any)._finalY ?? ir.origY
        const fw = (ir as any)._finalW ?? ir.origW
        const fh = (ir as any)._finalH ?? ir.origH
        setFields(prev => {
          const next = prev.map(f => {
            if (f.id !== ir.fieldId) return f
            const rawPage = Math.floor(fy / PAGE_HEIGHT) + 1
            const page = Math.min(Math.max(rawPage, 1), TOTAL_PAGES)
            const y = fy - (page - 1) * PAGE_HEIGHT
            return { ...f, x: fx, y: Math.max(0, y), page, width: fw, height: fh }
          })
          pushHistory(next)
          return next
        })
      }

      document.body.style.cursor = ''
      interactionRef.current = { type: 'none', fieldId: '', el: null, offsetX: 0, offsetY: 0, dir: '', startMouseX: 0, startMouseY: 0, origX: 0, origY: 0, origW: 0, origH: 0 }
      forceRender(n => n + 1)
    }

    window.addEventListener('mousemove', onMouseMove, { passive: true })
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [zoom, pushHistory])

  // Keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedRef.current) {
        e.preventDefault()
        setFields(prev => {
          const next = prev.filter(f => f.id !== selectedRef.current)
          pushHistory(next)
          return next
        })
        setSelectedFieldId(null)
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); undo() }
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') { e.preventDefault(); redo() }
      // Arrow keys for nudge
      if (selectedRef.current && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault()
        const step = e.shiftKey ? 10 : 1
        setFields(prev => {
          const next = prev.map(f => {
            if (f.id !== selectedRef.current) return f
            let { x, y } = f
            if (e.key === 'ArrowUp') y = Math.max(0, y - step)
            if (e.key === 'ArrowDown') y += step
            if (e.key === 'ArrowLeft') x = Math.max(0, x - step)
            if (e.key === 'ArrowRight') x += step
            return { ...f, x, y }
          })
          return next
        })
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [undo, redo, pushHistory])

  // Data loading
  useEffect(() => {
    const loadDocument = async () => {
      try {
        setLoading(true)
        setError(null)

        const dealRes = await fetch(`/api/deals/${encodeURIComponent(dealId)}`, { cache: 'no-store' })
        if (!dealRes.ok) throw new Error(`Failed to load deal (${dealRes.status})`)
        const deal = await dealRes.json()
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

        const parseFeeItems = (raw: any): any[] => {
          if (!raw) return []
          if (Array.isArray(raw)) return raw
          if (typeof raw === 'string') {
            try { return Array.isArray(JSON.parse(raw)) ? JSON.parse(raw) : [] } catch { return [] }
          }
          return []
        }

        const getOmvicFromFees = (rawFees: any): number => {
          const fees = parseFeeItems(rawFees)
          for (const f of fees) {
            const name = String(f?.fee_name ?? f?.name ?? f?.label ?? '').toLowerCase()
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

        const fullName = [c.firstname, c.lastname].filter(Boolean).join(' ') || ''
        const toEmail = String(c.email ?? '').trim().toLowerCase()

        const billData: BillOfSaleData = {
          dealDate: c.created_at ? new Date(c.created_at).toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' }) : '',
          invoiceNumber: String(dealId || ''),
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
          purchaserSignatureB64: undefined,
          salesperson: d.salesperson ?? '',
          salespersonRegNo: '4782496',
          acceptorName: d.approved_by ?? 'Syed Islam',
          acceptorRegNo: '4782496',
        }

        setDealData(deal)

        const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' })
        renderBillOfSalePdf(pdf, billData, { pageStart: 1, totalPages: 3 })
        const dataUrl = pdf.output('datauristring')
        setPdfDataUrl(dataUrl)

        // Build isolated single-page previews to avoid iframe #page rendering full document repeatedly
        const pageUrls: string[] = []
        for (let pageNo = 1; pageNo <= TOTAL_PAGES; pageNo++) {
          const pagePdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' })
          renderBillOfSalePdf(pagePdf, billData, { pageStart: 1, totalPages: 3 })
          for (let i = pagePdf.getNumberOfPages(); i >= 1; i--) {
            if (i !== pageNo) pagePdf.deletePage(i)
          }
          pageUrls.push(pagePdf.output('datauristring'))
        }
        setPdfPageUrls(pageUrls)

        const fieldsRes = await fetch(`/api/esignature/fields?dealId=${encodeURIComponent(dealId)}`)
        if (fieldsRes.ok) {
          const fieldsData = await fieldsRes.json()
          if (fieldsData.fields) {
            setFields(fieldsData.fields)
            historyRef.current = [fieldsData.fields]
            historyIdxRef.current = 0
          }
        }
      } catch (e: any) {
        setError(e?.message || 'Failed to load document')
      } finally {
        setLoading(false)
      }
    }

    if (dealId) loadDocument()
  }, [dealId])

  // Start drag on a placed field (GPU-accelerated)
  const startFieldDrag = (e: React.MouseEvent, field: Field, el: HTMLElement) => {
    e.stopPropagation()
    e.preventDefault()
    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const scale = zoom / 100
    const fieldDocY = (field.page - 1) * PAGE_HEIGHT + field.y
    const offsetX = (e.clientX - rect.left) / scale - field.x
    const offsetY = (e.clientY - rect.top) / scale - fieldDocY
    interactionRef.current = { type: 'drag', fieldId: field.id, el, offsetX, offsetY, dir: '', startMouseX: 0, startMouseY: 0, origX: field.x, origY: fieldDocY, origW: field.width, origH: field.height }
    setSelectedFieldId(field.id)
    document.body.style.cursor = 'grabbing'
  }

  // Start resize on a placed field (GPU-accelerated)
  const startFieldResize = (e: React.MouseEvent, field: Field, dir: string, el: HTMLElement) => {
    e.stopPropagation()
    e.preventDefault()
    const fieldDocY = (field.page - 1) * PAGE_HEIGHT + field.y
    interactionRef.current = { type: 'resize', fieldId: field.id, el, offsetX: 0, offsetY: 0, dir, startMouseX: e.clientX, startMouseY: e.clientY, origX: field.x, origY: fieldDocY, origW: field.width, origH: field.height }
    setSelectedFieldId(field.id)
  }

  // Sidebar drag-and-drop onto canvas
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    if (!draggedSidebarType || !containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const scale = zoom / 100
    const x = (e.clientX - rect.left) / scale
    const docY = (e.clientY - rect.top) / scale
    const page = Math.min(Math.max(Math.floor(docY / PAGE_HEIGHT) + 1, 1), TOTAL_PAGES)
    const y = docY - (page - 1) * PAGE_HEIGHT
    const cfg = FIELD_TYPES.find(f => f.type === draggedSidebarType)!
    const newField: Field = { id: `f-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, type: draggedSidebarType, x, y, width: cfg.defaultW, height: cfg.defaultH, page }
    setFields(prev => {
      const next = [...prev, newField]
      pushHistory(next)
      return next
    })
    setSelectedFieldId(newField.id)
    setDraggedSidebarType(null)
  }

  const handleDeleteField = useCallback((fieldId: string) => {
    setFields(prev => {
      const next = prev.filter(f => f.id !== fieldId)
      pushHistory(next)
      return next
    })
    setSelectedFieldId(null)
  }, [pushHistory])

  const handleFieldValueChange = useCallback((fieldId: string, value: string) => {
    setFields(prev => prev.map(f => f.id === fieldId ? { ...f, value } : f))
  }, [])

  const handleFieldValueCommit = useCallback((fieldId: string, value: string) => {
    setFields(prev => {
      const next = prev.map(f => f.id === fieldId ? { ...f, value } : f)
      pushHistory(next)
      return next
    })
  }, [pushHistory])

  const handleDownload = async () => {
    setDownloading(true)
    try {
      // Create PDF with same dimensions as the preview
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' })

      // First, render the Bill of Sale content
      if (dealData) {
        const c = dealData.customer || {}
        const vRaw = dealData.vehicles?.[0] || {}
        const sv = vRaw.selectedVehicle || vRaw
        const w = dealData.worksheet || {}
        const d = dealData.delivery || {}

        const billData: BillOfSaleData = {
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
        renderBillOfSalePdf(pdf, billData, { pageStart: 1, totalPages: 3 })
      }

      // Now overlay all fields on page 1
      const c = dealData?.customer || {}
      const fullName = [c.firstname, c.lastname].filter(Boolean).join(' ') || ''
      const initials = [c.firstname?.[0], c.lastname?.[0]].filter(Boolean).join('').toUpperCase() || 'DS'
      const signature = String(c.signature ?? '').trim()

      fields.forEach(field => {
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
              if (signature && signature.length > 0) {
                let src = signature
                if (!signature.startsWith('data:') && !signature.startsWith('http')) {
                  src = `data:image/png;base64,${signature}`
                }
                pdf.addImage(src, 'PNG', x, y, w, h)
              } else {
                pdf.setDrawColor(59, 130, 246)
                pdf.setTextColor(59, 130, 246)
                pdf.setFontSize(10)
                pdf.text('Signature', x + w / 2, y + h / 2, { align: 'center' })
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
              pdf.text(fullName || 'Name', x + 5, y + h / 2, { baseline: 'middle' })
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
        } catch (err) {
          console.error('Failed to render field in download PDF:', field.id, err)
        }
      })

      // Save the PDF
      pdf.save(`Bill_of_Sale_${dealId}_with_fields.pdf`)
    } catch (e: any) {
      alert(`Failed to download: ${e?.message || 'Unknown error'}`)
    } finally {
      setDownloading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/esignature/fields', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dealId, fields }),
      })
      if (!res.ok) throw new Error('Failed to save fields')
      alert('Fields saved successfully')
    } catch (e: any) {
      alert(`Failed to save: ${e?.message || 'Unknown error'}`)
    } finally {
      setSaving(false)
    }
  }

  // Field content renderer
  const renderFieldContent = (field: Field) => {
    const c = dealData?.customer || {}
    const fullName = [c.firstname, c.lastname].filter(Boolean).join(' ') || ''
    const initials = [c.firstname?.[0], c.lastname?.[0]].filter(Boolean).join('').toUpperCase() || 'DS'
    const signature = String(c.signature ?? '').trim()
    const fieldValue = String(field.value ?? '')

    switch (field.type) {
      case 'signature':
        if (signature && signature.length > 0) {
          let src = signature
          if (!signature.startsWith('data:') && !signature.startsWith('http')) src = `data:image/png;base64,${signature}`
          return <img src={src} alt="Signature" className="w-full h-full object-contain" draggable={false} onError={(e) => { e.currentTarget.style.display = 'none' }} />
        }
        return <div className="flex items-center justify-center h-full text-xs text-blue-500 font-medium">Signature</div>
      case 'initial':
        return <div className="flex items-center justify-center h-full text-base font-bold text-blue-700">{initials}</div>
      case 'stamp':
        return (
          <div className="flex items-center justify-center w-full h-full p-1">
            <svg viewBox="0 0 120 120" className="w-full h-full">
              <circle cx="60" cy="60" r="54" fill="none" stroke="#dc2626" strokeWidth="4"/>
              <circle cx="60" cy="60" r="46" fill="none" stroke="#dc2626" strokeWidth="1.5"/>
              <line x1="16" y1="60" x2="40" y2="60" stroke="#dc2626" strokeWidth="2"/>
              <line x1="80" y1="60" x2="104" y2="60" stroke="#dc2626" strokeWidth="2"/>
              <text x="60" y="56" textAnchor="middle" fill="#dc2626" fontSize="14" fontWeight="bold" fontFamily="serif">APPROVED</text>
              <text x="60" y="74" textAnchor="middle" fill="#dc2626" fontSize="10" fontFamily="serif">{new Date().toLocaleDateString('en-CA')}</text>
            </svg>
          </div>
        )
      case 'dateSigned':
        return <div className="flex items-center justify-center h-full text-xs font-medium text-gray-700">{new Date().toLocaleDateString('en-CA')}</div>
      case 'name':
        return <div className="flex items-center px-2 h-full text-xs font-medium text-gray-900">{fullName || 'Name'}</div>
      case 'company':
        return (
          <input
            value={fieldValue}
            onChange={(e) => handleFieldValueChange(field.id, e.target.value)}
            onBlur={(e) => handleFieldValueCommit(field.id, e.target.value)}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            placeholder="Company"
            className="w-full h-full px-2 text-xs text-gray-700 bg-transparent outline-none placeholder:text-gray-400"
          />
        )
      case 'title':
        return (
          <input
            value={fieldValue}
            onChange={(e) => handleFieldValueChange(field.id, e.target.value)}
            onBlur={(e) => handleFieldValueCommit(field.id, e.target.value)}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            placeholder="Title"
            className="w-full h-full px-2 text-xs text-gray-700 bg-transparent outline-none placeholder:text-gray-400"
          />
        )
      case 'text':
        return (
          <input
            value={fieldValue}
            onChange={(e) => handleFieldValueChange(field.id, e.target.value)}
            onBlur={(e) => handleFieldValueCommit(field.id, e.target.value)}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            placeholder="Enter text"
            className="w-full h-full px-2 text-xs text-gray-700 bg-transparent outline-none placeholder:text-gray-400"
          />
        )
      case 'checkbox':
        return (
          <div className="flex items-center justify-center h-full">
            <svg viewBox="0 0 20 20" className="w-4 h-4"><rect x="1" y="1" width="18" height="18" rx="3" fill="#3b82f6" stroke="#2563eb" strokeWidth="1.5"/><path d="M5 10l3 3 7-7" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
        )
      default:
        return null
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#f8f9fb]">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-10 w-10 border-[3px] border-blue-200 border-t-blue-600 mb-4" />
          <p className="text-sm text-gray-500">Loading document...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#f8f9fb]">
        <div className="text-center bg-white rounded-xl shadow-sm p-8 max-w-sm">
          <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/></svg>
          </div>
          <p className="text-sm text-gray-700 mb-4">{error}</p>
          <button onClick={() => router.back()} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors">Go Back</button>
        </div>
      </div>
    )
  }

  const scale = zoom / 100

  return (
    <div className="flex flex-col h-screen bg-[#f0f2f5] select-none" tabIndex={0}>
      {/* ── Top Toolbar ── */}
      <div className="h-12 bg-white border-b border-gray-200 flex items-center px-4 gap-2 shrink-0 shadow-sm z-30">
        <button onClick={() => router.back()} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors" title="Back">
          <svg className="w-5 h-5 text-gray-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
        </button>
        <div className="w-px h-6 bg-gray-200 mx-1" />

        <button onClick={undo} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors" title="Undo (Ctrl+Z)">
          <svg className="w-4.5 h-4.5 text-gray-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 10h10a5 5 0 0 1 0 10H9"/><path d="M3 10l4-4M3 10l4 4"/></svg>
        </button>
        <button onClick={redo} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors" title="Redo (Ctrl+Y)">
          <svg className="w-4.5 h-4.5 text-gray-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10H11a5 5 0 0 0 0 10h4"/><path d="M21 10l-4-4M21 10l-4 4"/></svg>
        </button>
        <div className="w-px h-6 bg-gray-200 mx-1" />

        {/* Zoom controls */}
        <button onClick={() => setZoom(z => Math.max(50, z - 10))} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors" title="Zoom Out">
          <svg className="w-4 h-4 text-gray-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35M8 11h6"/></svg>
        </button>
        <span className="text-xs font-medium text-gray-600 min-w-[40px] text-center">{zoom}%</span>
        <button onClick={() => setZoom(z => Math.min(200, z + 10))} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors" title="Zoom In">
          <svg className="w-4 h-4 text-gray-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35M8 11h6M11 8v6"/></svg>
        </button>
        <button onClick={() => setZoom(100)} className="px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 rounded transition-colors">Fit</button>
        <div className="w-px h-6 bg-gray-200 mx-1" />

        <button onClick={() => setShowGrid(g => !g)} className={`p-1.5 rounded-lg transition-colors ${showGrid ? 'bg-blue-50 text-blue-600' : 'hover:bg-gray-100 text-gray-600'}`} title="Toggle Grid">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/></svg>
        </button>

        <div className="flex-1" />

        <button
          onClick={handleDownload}
          disabled={downloading}
          className="px-4 py-1.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors shadow-sm flex items-center gap-2"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
          {downloading ? 'Generating...' : 'Download'}
        </button>

        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-sm"
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* ── Left Sidebar ── */}
        <div className="w-60 bg-white border-r border-gray-200 flex flex-col shrink-0">
          <div className="px-4 py-3 border-b border-gray-100">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Fields</h2>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-1">
            {FIELD_TYPES.map(({ type, label }) => (
              <div
                key={type}
                draggable
                onDragStart={() => setDraggedSidebarType(type)}
                onDragEnd={() => setDraggedSidebarType(null)}
                className="group flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-grab active:cursor-grabbing hover:bg-blue-50 border border-transparent hover:border-blue-200 transition-all duration-150"
              >
                <div className="w-8 h-8 rounded-md bg-gray-50 group-hover:bg-blue-100 flex items-center justify-center transition-colors">
                  <FieldIcon type={type} />
                </div>
                <span className="text-sm font-medium text-gray-700 group-hover:text-blue-700 transition-colors">{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Center Canvas ── */}
        <div
          className="flex-1 overflow-auto bg-[#e8eaed]"
          style={{ backgroundImage: showGrid ? 'radial-gradient(circle, #d1d5db 1px, transparent 1px)' : 'none', backgroundSize: showGrid ? '20px 20px' : 'auto' }}
        >
          <div className="flex items-start justify-center p-8 min-h-full">
            <div
              ref={containerRef}
              className="relative bg-white border border-gray-300 shadow-sm"
              style={{ width: `${PAGE_WIDTH * scale}px`, minHeight: `${PAGE_HEIGHT * TOTAL_PAGES * scale}px`, transformOrigin: 'top left' }}
            >
              {pdfPageUrls.length > 0 && (
                <>
                  {pdfPageUrls.map((pageUrl, idx) => {
                    const pageNo = idx + 1
                    return (
                    <iframe
                      key={pageNo}
                      src={`${pageUrl}#zoom=page-fit&toolbar=0&navpanes=0&scrollbar=0`}
                      className="w-full absolute left-0 pointer-events-none"
                      style={{ top: `${(pageNo - 1) * PAGE_HEIGHT * scale}px`, height: `${PAGE_HEIGHT * scale}px`, border: 'none', zIndex: 1 }}
                      title={`Bill of Sale PDF Page ${pageNo}`}
                    />
                    )
                  })}
                </>
              )}

              {/* Drop overlay */}
              <div
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                onClick={() => setSelectedFieldId(null)}
                className="absolute top-0 left-0 w-full h-full"
                style={{ zIndex: 2, minHeight: `${PAGE_HEIGHT * TOTAL_PAGES * scale}px`, pointerEvents: draggedSidebarType ? 'auto' : 'none' }}
              />

              {/* Alignment guide lines */}
              <div ref={el => { guidesRef.current.vLine = el }} className="absolute top-0 w-px bg-pink-500 pointer-events-none" style={{ display: 'none', height: '100%', zIndex: 100 }} />
              <div ref={el => { guidesRef.current.hLine = el }} className="absolute left-0 h-px bg-pink-500 pointer-events-none" style={{ display: 'none', width: '100%', zIndex: 100 }} />

              {/* Rendered fields */}
              {fields.map((field) => {
                const isSelected = selectedFieldId === field.id
                const isActive = interactionRef.current.fieldId === field.id

                return (
                  <div
                    key={field.id}
                    data-field-id={field.id}
                    className={`absolute select-none group ${isActive ? '' : 'transition-shadow duration-150'}`}
                    style={{
                      transform: `translate3d(${field.x * scale}px, ${(((field.page || 1) - 1) * PAGE_HEIGHT + field.y) * scale}px, 0)`,
                      width: `${field.width * scale}px`,
                      height: `${field.height * scale}px`,
                      zIndex: isActive ? 50 : isSelected ? 20 : 10,
                      willChange: isActive ? 'transform, width, height' : 'auto',
                    }}
                  >
                    {/* Field body */}
                    <div
                      onMouseDown={(e) => {
                        const el = e.currentTarget.parentElement!
                        startFieldDrag(e, field, el)
                      }}
                      onClick={(e) => { e.stopPropagation(); setSelectedFieldId(field.id) }}
                      className={`w-full h-full cursor-grab active:cursor-grabbing rounded-[3px] border-[1.5px] overflow-hidden ${
                        isSelected
                          ? 'border-blue-500 shadow-[0_0_0_1px_rgba(59,130,246,0.3)] bg-blue-50/20'
                          : 'border-gray-300 hover:border-blue-400 bg-white/60 hover:bg-blue-50/10'
                      }`}
                      style={{ zIndex: 10 }}
                    >
                      {renderFieldContent(field)}
                    </div>

                    {/* Delete button */}
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteField(field.id) }}
                      className={`absolute -top-2.5 -right-2.5 w-5 h-5 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center shadow-md transition-all duration-150 z-50 ${
                        isSelected ? 'opacity-100 scale-100' : 'opacity-0 group-hover:opacity-100 scale-75 group-hover:scale-100'
                      }`}
                      title="Delete (Del)"
                    >
                      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18 6L6 18M6 6l12 12"/></svg>
                    </button>

                    {/* Resize handles - visible on select */}
                    {isSelected && (
                      <>
                        {(['nw','n','ne','e','se','s','sw','w'] as const).map(dir => {
                          const pos: Record<string, string> = {
                            nw: 'top-0 left-0 -translate-x-1/2 -translate-y-1/2 cursor-nwse-resize',
                            n: 'top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 cursor-ns-resize',
                            ne: 'top-0 right-0 translate-x-1/2 -translate-y-1/2 cursor-nesw-resize',
                            e: 'top-1/2 right-0 translate-x-1/2 -translate-y-1/2 cursor-ew-resize',
                            se: 'bottom-0 right-0 translate-x-1/2 translate-y-1/2 cursor-nwse-resize',
                            s: 'bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 cursor-ns-resize',
                            sw: 'bottom-0 left-0 -translate-x-1/2 translate-y-1/2 cursor-nesw-resize',
                            w: 'top-1/2 left-0 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize',
                          }
                          return (
                            <div
                              key={dir}
                              onMouseDown={(e) => { startFieldResize(e, field, dir, e.currentTarget.parentElement!) }}
                              className={`absolute w-2.5 h-2.5 rounded-full bg-white border-2 border-blue-500 z-50 ${pos[dir]}`}
                            />
                          )
                        })}
                      </>
                    )}

                    {/* Hover label tooltip */}
                    <div className={`absolute -top-6 left-0 px-1.5 py-0.5 text-[10px] font-medium text-white bg-gray-800 rounded whitespace-nowrap pointer-events-none transition-opacity ${
                      isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                    }`}>
                      {FIELD_TYPES.find(f => f.type === field.type)?.label}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
