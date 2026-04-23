'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useSearchParams } from 'next/navigation'

declare global {
  interface Window { pdfjsLib?: any }
}

type FieldType = 'signature' | 'initial' | 'stamp' | 'dateSigned' | 'name' | 'company' | 'title' | 'text' | 'checkbox'
type Field = { id: string; type: FieldType; x: number; y: number; width: number; height: number; page: number; value?: string; fileIndex?: number; recipientIndex?: number }

const PAGE_WIDTH = 816
const PAGE_HEIGHT = 1056
const PDF_RENDER_QUALITY = 2
const ZOOM_STEP = 0.25
const ZOOM_MIN = 0.25
const ZOOM_MAX = 3

function normalizeToDataUrl(value: string, fallbackMime: string): { url: string; mime: string } | null {
  const raw = String(value || '').trim()
  if (!raw) return null
  if (raw.startsWith('http://') || raw.startsWith('https://')) return { url: raw, mime: fallbackMime }
  if (raw.startsWith('data:')) {
    const m = raw.match(/^data:([^;]+);base64,/i)
    return { url: raw, mime: m?.[1] || fallbackMime }
  }
  const mime = raw.startsWith('JVBERi0') ? 'application/pdf' : raw.startsWith('iVBORw0') ? 'image/png' : raw.startsWith('/9j/') ? 'image/jpeg' : fallbackMime
  return { url: `data:${mime};base64,${raw}`, mime }
}

async function loadPdfJsLib(): Promise<any> {
  if (window.pdfjsLib) return window.pdfjsLib
  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'
    script.onload = () => {
      if (window.pdfjsLib) {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
        resolve(window.pdfjsLib)
      } else {
        reject(new Error('pdf.js failed to load'))
      }
    }
    script.onerror = () => reject(new Error('Failed to load pdf.js'))
    document.head.appendChild(script)
  })
}

async function renderPdfToImages(src: string): Promise<string[]> {
  const lib = await loadPdfJsLib()
  const loadingTask = lib.getDocument(src.startsWith('http') ? src : src)
  const pdf = await loadingTask.promise
  const pages: string[] = []
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const viewport = page.getViewport({ scale: PDF_RENDER_QUALITY })
    const canvas = document.createElement('canvas')
    canvas.width = viewport.width
    canvas.height = viewport.height
    await page.render({ canvasContext: canvas.getContext('2d')!, viewport }).promise
    pages.push(canvas.toDataURL('image/png'))
  }
  return pages
}

function SignaturePad({ onDone, dark }: { onDone: (dataUrl: string) => void; dark: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)

  const getPos = (e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect()
    if ('touches' in e) return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top }
    return { x: (e as React.MouseEvent).clientX - rect.left, y: (e as React.MouseEvent).clientY - rect.top }
  }

  const start = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    ctx.beginPath()
    const { x, y } = getPos(e, canvas)
    ctx.moveTo(x, y)
    drawing.current = true
    e.preventDefault()
  }

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!drawing.current) return
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    ctx.strokeStyle = '#1e3a5f'
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    const { x, y } = getPos(e, canvas)
    ctx.lineTo(x, y)
    ctx.stroke()
    e.preventDefault()
  }

  const stop = () => { drawing.current = false }
  const clear = () => { canvasRef.current!.getContext('2d')!.clearRect(0, 0, 400, 140) }
  const apply = () => { onDone(canvasRef.current!.toDataURL('image/png')) }

  return (
    <div>
      <canvas
        ref={canvasRef}
        width={400}
        height={140}
        className="border border-gray-300 rounded-lg bg-white w-full cursor-crosshair touch-none"
        onMouseDown={start} onMouseMove={draw} onMouseUp={stop} onMouseLeave={stop}
        onTouchStart={start} onTouchMove={draw} onTouchEnd={stop}
      />
      <div className="flex justify-between mt-2">
        <button type="button" onClick={clear} className={`text-xs underline ${dark ? 'text-gray-400' : 'text-gray-500'}`}>Clear</button>
        <button type="button" onClick={apply} className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">Apply Signature</button>
      </div>
    </div>
  )
}

// ── Icons ────────────────────────────────────────────────────────────────────

function IconPages() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="4" y="3" width="12" height="16" rx="1.5"/>
      <path d="M8 7h6M8 11h6M8 15h4"/>
      <rect x="8" y="5" width="12" height="16" rx="1.5" className="opacity-40"/>
    </svg>
  )
}

function IconDownload() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v13m0 0l-4-4m4 4l4-4M4 20h16"/>
    </svg>
  )
}

function IconSun() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="4"/>
      <path strokeLinecap="round" d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
    </svg>
  )
}

function IconMoon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
    </svg>
  )
}

function IconZoomIn() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="7"/>
      <path strokeLinecap="round" d="M21 21l-4.35-4.35M11 8v6M8 11h6"/>
    </svg>
  )
}

function IconZoomOut() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="7"/>
      <path strokeLinecap="round" d="M21 21l-4.35-4.35M8 11h6"/>
    </svg>
  )
}

function IconFit() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 8V5a1 1 0 0 1 1-1h3M4 16v3a1 1 0 0 0 1 1h3M16 4h3a1 1 0 0 1 1 1v3M16 20h3a1 1 0 0 0 1-1v-3"/>
    </svg>
  )
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function SignPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const id = String(params.id || '')
  const recipientIdx = Number(searchParams.get('idx') ?? '0')

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [sigRecord, setSigRecord] = useState<any>(null)
  const [fields, setFields] = useState<Field[]>([])
  const [pageUrls, setPageUrls] = useState<string[]>([])
  const [sigPadField, setSigPadField] = useState<string | null>(null)
  const [signatureData, setSignatureData] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [editingTextField, setEditingTextField] = useState<string | null>(null)

  // Sidebar state
  const [dark, setDark] = useState(false)
  const [showPages, setShowPages] = useState(false)
  const [zoom, setZoom] = useState(1)

  const pageRefs = useRef<(HTMLDivElement | null)[]>([])
  const contentRef = useRef<HTMLDivElement>(null)

  // Load signature record + fields
  useEffect(() => {
    if (!id) return
    setLoading(true)
    ;(async () => {
      try {
        const sigRes = await fetch(`/api/esignature/signature/${encodeURIComponent(id)}`, { cache: 'no-store' })
        if (!sigRes.ok) throw new Error('Signing link not found or expired.')
        const sigData = await sigRes.json()
        if (sigData.error) throw new Error(sigData.error)
        setSigRecord(sigData)

        const fieldsRes = await fetch(`/api/esignature/fields?dealId=${encodeURIComponent(id)}`, { cache: 'no-store' })
        const fieldsJson = await fieldsRes.json()
        let allFields: Field[] = Array.isArray(fieldsJson.fields) ? fieldsJson.fields : []
        const myFields = allFields.filter(f => (f.recipientIndex ?? 0) === recipientIdx)
        const today = new Date().toLocaleDateString('en-CA')
        const autoFilled = myFields.map(f => {
          if (f.value) return f
          if (f.type === 'name')       return { ...f, value: sigData?.full_name || '' }
          if (f.type === 'company')    return { ...f, value: sigData?.company || '' }
          if (f.type === 'title')      return { ...f, value: sigData?.title || '' }
          if (f.type === 'dateSigned') return { ...f, value: today }
          return f
        })
        setFields(autoFilled)

        const docFile = sigData.document_file
        if (docFile) {
          let fileUrl = ''
          try {
            const parsed = JSON.parse(docFile)
            const first = Array.isArray(parsed) ? parsed[0] : parsed
            fileUrl = first?.url || first?.file_b64 || ''
          } catch {
            fileUrl = docFile
          }
          const norm = normalizeToDataUrl(fileUrl, 'application/pdf')
          if (norm) {
            const mime = norm.mime
            if (mime === 'application/pdf' || fileUrl.endsWith('.pdf')) {
              const pages = await renderPdfToImages(norm.url)
              setPageUrls(pages)
            } else {
              setPageUrls([norm.url])
            }
          }
        }
      } catch (e: any) {
        setError(e.message || 'Failed to load document')
      } finally {
        setLoading(false)
      }
    })()
  }, [id, recipientIdx])

  const handleFieldClick = useCallback((field: Field) => {
    if (field.type === 'signature' || field.type === 'initial') {
      setSigPadField(field.id)
    } else if (field.type === 'checkbox') {
      setFields(prev => prev.map(f => f.id === field.id ? { ...f, value: f.value === 'true' ? '' : 'true' } : f))
    } else if (field.type === 'text' || field.type === 'name' || field.type === 'company' || field.type === 'title') {
      setEditingTextField(field.id)
    }
  }, [])

  const handleSignatureApply = useCallback((dataUrl: string) => {
    if (!sigPadField) return
    setSignatureData(dataUrl)
    setFields(prev => prev.map(f => (f.type === 'signature' || f.type === 'initial') ? { ...f, value: dataUrl } : f))
    setSigPadField(null)
  }, [sigPadField])

  const handleSubmit = async () => {
    setSubmitting(true)
    try {
      const sig = fields.find(f => f.type === 'signature' || f.type === 'initial')
      const sigValue = sig?.value || signatureData
      const now = new Date().toISOString()
      const res = await fetch(`/api/esignature/signature/${encodeURIComponent(id)}/complete`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signature_image: sigValue,
          signed_at: now,
          status: 'completed',
          fields_data: JSON.stringify(fields),
          recipient_index: recipientIdx,
          deal_id: id,
        }),
      })
      if (!res.ok) throw new Error('Failed to submit signature')
      const fieldUpdates = fields
        .filter(f => f.value !== undefined && f.value !== null && f.value !== '')
        .map(f =>
          fetch('/api/esignature/fields', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ dealId: id, fieldId: f.id, value: f.value, signedAt: now }),
          }).catch(() => null)
        )
      await Promise.all(fieldUpdates)
      setSubmitted(true)
    } catch (e: any) {
      alert(e.message || 'Failed to submit')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDownload = () => {
    if (!pageUrls.length) return
    const link = document.createElement('a')
    link.href = pageUrls[0]
    link.download = `document-${id}.png`
    link.click()
  }

  const scrollToPage = (idx: number) => {
    pageRefs.current[idx]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    setShowPages(false)
  }

  const handleZoomIn = () => setZoom(z => Math.min(ZOOM_MAX, parseFloat((z + ZOOM_STEP).toFixed(2))))
  const handleZoomOut = () => setZoom(z => Math.max(ZOOM_MIN, parseFloat((z - ZOOM_STEP).toFixed(2))))
  const handleFit = () => {
    if (!contentRef.current) return
    const containerW = contentRef.current.clientWidth - 48
    const fit = Math.min(1, containerW / PAGE_WIDTH)
    setZoom(parseFloat(fit.toFixed(2)))
  }

  // ── Theme tokens ─────────────────────────────────────────────────────────
  const bg = dark ? 'bg-[#111827]' : 'bg-gray-100'
  const headerBg = dark ? 'bg-[#1f2937] border-gray-700' : 'bg-white border-gray-200'
  const headerText = dark ? 'text-white' : 'text-gray-800'
  const headerSub = dark ? 'text-gray-400' : 'text-gray-500'
  const sidebarBg = dark ? 'bg-[#1f2937] border-gray-700' : 'bg-white border-gray-200'
  const sidebarText = dark ? 'text-gray-300' : 'text-gray-600'
  const sidebarHover = dark ? 'hover:bg-gray-700 hover:text-white' : 'hover:bg-gray-100 hover:text-gray-900'
  const zoomBarBg = dark ? 'bg-[#1f2937] border-gray-700 text-gray-300' : 'bg-white border-gray-200 text-gray-600'
  const popoverBg = dark ? 'bg-[#1f2937] border-gray-700' : 'bg-white border-gray-200'
  const popoverText = dark ? 'text-gray-200' : 'text-gray-700'
  const popoverHover = dark ? 'hover:bg-gray-700' : 'hover:bg-gray-50'

  // ── Early returns ────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Loading document…</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="max-w-sm text-center">
          <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
          </div>
          <h2 className="text-lg font-semibold text-gray-800 mb-1">Unable to load document</h2>
          <p className="text-sm text-gray-500">{error}</p>
        </div>
      </div>
    )
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="max-w-sm text-center">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>
          </div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Document Signed!</h2>
          <p className="text-sm text-gray-500">Your signature has been submitted successfully. You may close this window.</p>
        </div>
      </div>
    )
  }

  const requiredFields = fields.filter(f => f.type === 'signature' || f.type === 'initial')
  const allSigned = requiredFields.every(f => f.value && f.value.length > 0)
  const recipient = sigRecord

  return (
    <div className={`min-h-screen flex flex-col ${bg} transition-colors duration-200`}>
      {/* Header */}
      <div className={`${headerBg} border-b px-4 py-3 flex items-center justify-between shadow-sm z-20 shrink-0`}>
        <div>
          <h1 className={`text-base font-semibold ${headerText}`}>Sign Document</h1>
          <p className={`text-xs ${headerSub}`}>{recipient?.full_name || recipient?.email}</p>
        </div>
        <button
          onClick={handleSubmit}
          disabled={submitting || !allSigned}
          className="px-5 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {submitting ? 'Submitting…' : 'Finish & Submit'}
        </button>
      </div>

      {/* Instructions bar */}
      <div className={`${dark ? 'bg-blue-900/40 border-blue-800 text-blue-300' : 'bg-blue-50 border-blue-100 text-blue-700'} border-b px-4 py-2 text-xs shrink-0`}>
        Click on each highlighted field to fill it in. When all required fields are complete, click <strong>Finish &amp; Submit</strong>.
      </div>

      {/* Body: sidebar + content */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Left Sidebar ─────────────────────────────────────────────────── */}
        <aside className={`${sidebarBg} border-r w-16 flex flex-col items-center py-3 gap-1 shrink-0 z-10`}>

          {/* View Pages */}
          <div className="relative w-full flex justify-center">
            <button
              onClick={() => setShowPages(v => !v)}
              title="View Pages"
              className={`flex flex-col items-center gap-1 py-2 w-full ${sidebarText} ${sidebarHover} transition-colors rounded-lg mx-1`}
            >
              <IconPages />
              <span className="text-[9px] font-medium leading-none">Pages</span>
            </button>

            {/* Pages popover */}
            {showPages && (
              <div className={`absolute left-full top-0 ml-2 ${popoverBg} border rounded-xl shadow-xl w-52 p-3 z-50`}>
                <p className={`text-xs font-semibold mb-2 ${popoverText}`}>Jump to Page</p>
                <div className="flex flex-col gap-1.5 max-h-72 overflow-y-auto">
                  {pageUrls.map((url, idx) => (
                    <button
                      key={idx}
                      onClick={() => scrollToPage(idx)}
                      className={`flex items-center gap-2 rounded-lg p-1.5 ${popoverHover} transition-colors w-full text-left`}
                    >
                      <img src={url} alt={`Page ${idx + 1}`} className="w-10 h-14 object-cover rounded border border-gray-200 shrink-0" />
                      <span className={`text-xs font-medium ${popoverText}`}>Page {idx + 1}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Download */}
          <button
            onClick={handleDownload}
            title="Download"
            disabled={!pageUrls.length}
            className={`flex flex-col items-center gap-1 py-2 w-full ${sidebarText} ${sidebarHover} disabled:opacity-40 transition-colors rounded-lg mx-1`}
          >
            <IconDownload />
            <span className="text-[9px] font-medium leading-none">Download</span>
          </button>

          {/* Divider */}
          <div className={`w-8 border-t ${dark ? 'border-gray-700' : 'border-gray-200'} my-1`} />

          {/* Dark / Light toggle */}
          <button
            onClick={() => setDark(v => !v)}
            title={dark ? 'Switch to Light' : 'Switch to Dark'}
            className={`flex flex-col items-center gap-1 py-2 w-full ${sidebarText} ${sidebarHover} transition-colors rounded-lg mx-1`}
          >
            {dark ? <IconSun /> : <IconMoon />}
            <span className="text-[9px] font-medium leading-none">{dark ? 'Light' : 'Dark'}</span>
          </button>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Zoom controls */}
          <div className={`w-8 border-t ${dark ? 'border-gray-700' : 'border-gray-200'} mb-1`} />

          <button
            onClick={handleZoomIn}
            title="Zoom In"
            disabled={zoom >= ZOOM_MAX}
            className={`flex flex-col items-center gap-1 py-2 w-full ${sidebarText} ${sidebarHover} disabled:opacity-40 transition-colors rounded-lg mx-1`}
          >
            <IconZoomIn />
            <span className="text-[9px] font-medium leading-none">+</span>
          </button>

          <span className={`text-[10px] font-semibold ${sidebarText} tabular-nums`}>{Math.round(zoom * 100)}%</span>

          <button
            onClick={handleZoomOut}
            title="Zoom Out"
            disabled={zoom <= ZOOM_MIN}
            className={`flex flex-col items-center gap-1 py-2 w-full ${sidebarText} ${sidebarHover} disabled:opacity-40 transition-colors rounded-lg mx-1`}
          >
            <IconZoomOut />
            <span className="text-[9px] font-medium leading-none">−</span>
          </button>

          <button
            onClick={handleFit}
            title="Fit to screen"
            className={`flex flex-col items-center gap-1 py-2 w-full ${sidebarText} ${sidebarHover} transition-colors rounded-lg mx-1`}
          >
            <IconFit />
            <span className="text-[9px] font-medium leading-none">Fit</span>
          </button>
        </aside>

        {/* ── Document canvas ───────────────────────────────────────────────── */}
        <div ref={contentRef} className="flex-1 overflow-auto py-6 px-4 flex flex-col items-center gap-4">
          {pageUrls.length === 0 && (
            <div className={`text-sm mt-10 ${dark ? 'text-gray-500' : 'text-gray-400'}`}>No document pages to display.</div>
          )}
          {pageUrls.map((pageUrl, pageIdx) => {
            const pageFields = fields.filter(f => f.page === pageIdx)
            return (
              <div
                key={pageIdx}
                ref={el => { pageRefs.current[pageIdx] = el }}
                className="relative shadow-lg bg-white origin-top"
                style={{
                  width: PAGE_WIDTH,
                  maxWidth: '100%',
                  transform: `scale(${zoom})`,
                  transformOrigin: 'top center',
                  marginBottom: `${(zoom - 1) * PAGE_HEIGHT}px`,
                }}
              >
                <img
                  src={pageUrl}
                  alt={`Page ${pageIdx + 1}`}
                  className="w-full block"
                  draggable={false}
                  style={{ aspectRatio: `${PAGE_WIDTH} / ${PAGE_HEIGHT}` }}
                />
                {pageFields.map(field => {
                  const isEmpty = !field.value || field.value.length === 0
                  const isCheckbox = field.type === 'checkbox'
                  const checked = field.value === 'true'
                  return (
                    <div
                      key={field.id}
                      onClick={() => handleFieldClick(field)}
                      className={`absolute cursor-pointer transition-all ${
                        isEmpty && !isCheckbox
                          ? 'border-2 border-dashed border-blue-400 bg-blue-50/60 hover:bg-blue-100/80 animate-pulse'
                          : 'border border-blue-300 bg-blue-50/30 hover:bg-blue-50/60'
                      }`}
                      style={{ left: field.x, top: field.y, width: field.width, height: field.height }}
                      title={`Click to fill ${field.type}`}
                    >
                      {field.type === 'signature' || field.type === 'initial' ? (
                        field.value ? (
                          <img src={field.value} alt="Signature" className="w-full h-full object-contain" draggable={false} />
                        ) : (
                          <div className="flex items-center justify-center h-full text-xs text-blue-500 font-medium">
                            {field.type === 'signature' ? 'Click to Sign' : 'Click to Initial'}
                          </div>
                        )
                      ) : field.type === 'checkbox' ? (
                        <div className="flex items-center justify-center h-full">
                          {checked ? (
                            <svg className="w-4 h-4 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M20 6L9 17l-5-5"/></svg>
                          ) : (
                            <div className="w-4 h-4 border-2 border-blue-400 rounded" />
                          )}
                        </div>
                      ) : field.type === 'name' || field.type === 'company' || field.type === 'title' || field.type === 'text' ? (
                        editingTextField === field.id ? (
                          <input
                            autoFocus
                            className="w-full h-full px-1 text-xs text-gray-900 bg-white border-0 outline-none"
                            value={field.value || ''}
                            onChange={e => setFields(prev => prev.map(f => f.id === field.id ? { ...f, value: e.target.value } : f))}
                            onBlur={() => setEditingTextField(null)}
                            onClick={e => e.stopPropagation()}
                          />
                        ) : (
                          <div className="flex items-center px-2 h-full text-xs font-medium text-gray-900">
                            {field.value || <span className="text-blue-400">Click to edit</span>}
                          </div>
                        )
                      ) : field.type === 'dateSigned' ? (
                        <div className="flex items-center justify-center h-full text-xs font-medium text-gray-700">
                          {field.value || new Date().toLocaleDateString('en-CA')}
                        </div>
                      ) : field.type === 'stamp' ? (
                        <div className="flex items-center justify-center w-full h-full p-1">
                          <svg viewBox="0 0 120 120" className="w-full h-full">
                            <circle cx="60" cy="60" r="54" fill="none" stroke="#dc2626" strokeWidth="4"/>
                            <circle cx="60" cy="60" r="46" fill="none" stroke="#dc2626" strokeWidth="1.5"/>
                            <text x="60" y="56" textAnchor="middle" fill="#dc2626" fontSize="14" fontWeight="bold" fontFamily="serif">APPROVED</text>
                            <text x="60" y="74" textAnchor="middle" fill="#dc2626" fontSize="10" fontFamily="serif">{new Date().toLocaleDateString('en-CA')}</text>
                          </svg>
                        </div>
                      ) : (
                        <input
                          value={field.value || ''}
                          onChange={e => setFields(prev => prev.map(f => f.id === field.id ? { ...f, value: e.target.value } : f))}
                          onMouseDown={e => e.stopPropagation()}
                          placeholder={field.type}
                          className="w-full h-full px-2 text-xs bg-transparent outline-none text-gray-800"
                        />
                      )}
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>

      {/* Signature pad modal */}
      {sigPadField && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40">
          <div className={`${dark ? 'bg-[#1f2937]' : 'bg-white'} rounded-2xl p-5 w-full max-w-md shadow-2xl`}>
            <h3 className={`text-base font-semibold mb-3 ${dark ? 'text-white' : 'text-gray-800'}`}>Draw Your Signature</h3>
            <SignaturePad onDone={handleSignatureApply} dark={dark} />
            <button
              type="button"
              onClick={() => setSigPadField(null)}
              className={`mt-3 w-full py-2 text-sm ${dark ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Close pages popover on outside click */}
      {showPages && (
        <div className="fixed inset-0 z-40" onClick={() => setShowPages(false)} />
      )}
    </div>
  )
}
