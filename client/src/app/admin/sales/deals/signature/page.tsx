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
  
  // Get email from query string - format: ?email@example.com
  const recipientEmail = useMemo(() => {
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
  const [penColor, setPenColor] = useState('#111827')
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null)
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

  const title = useMemo(() => {
    if (recipientEmail) return `E-Signature Request`
    return 'Signature'
  }, [recipientEmail])

  // Load signature record by email
  useEffect(() => {
    const loadDocument = async () => {
      if (!recipientEmail) {
        setError('No recipient email provided')
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
  }, [recipientEmail])

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
    ctx.strokeStyle = penColor
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
    ctx.strokeStyle = penColor
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

  const save = async () => {
    if (saving) return
    const c = getCanvas()
    if (!c) return
    const url = c.toDataURL('image/png')
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
    const c = getCanvas()
    if (!c) return

    const onPointerDown = (e: PointerEvent) => {
      c.setPointerCapture(e.pointerId)
      startDraw(e)
    }
    const onPointerMove = (e: PointerEvent) => moveDraw(e)
    const onPointerUp = () => endDraw()
    const onPointerCancel = () => endDraw()

    c.addEventListener('pointerdown', onPointerDown)
    c.addEventListener('pointermove', onPointerMove)
    c.addEventListener('pointerup', onPointerUp)
    c.addEventListener('pointercancel', onPointerCancel)

    return () => {
      c.removeEventListener('pointerdown', onPointerDown)
      c.removeEventListener('pointermove', onPointerMove)
      c.removeEventListener('pointerup', onPointerUp)
      c.removeEventListener('pointercancel', onPointerCancel)
    }
  }, [penColor, penSize])

  useEffect(() => {
    const onResize = () => {
      ensureHiDpi()
      applyPen()
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [penColor, penSize])

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
  }, [penColor, penSize])

  // Render field content
  const renderFieldContent = (field: Field) => {
    switch (field.type) {
      case 'signature':
        return (
          <div className="flex items-center justify-center h-full text-blue-600 text-xs font-medium">
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
    <div className="min-h-screen w-full bg-gradient-to-b from-slate-50 to-slate-100">
      <div className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="w-full px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col items-center text-center">
            <div className="relative h-12 w-12 sm:h-14 sm:w-14">
              <NextImage src="/images/logo.png" alt="EDC" fill className="object-contain" />
            </div>
            <div className="mt-2 text-lg sm:text-xl font-bold text-slate-900">{title}</div>
            {recipientEmail && (
              <div className="mt-1 text-sm text-slate-600">For: {recipientEmail}</div>
            )}
            <div className="mt-1 text-xs text-slate-500">Review the document and sign where indicated</div>
          </div>
        </div>
      </div>

      <div className="w-full px-4 sm:px-6 lg:px-8 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-3">
              <div className="animate-spin rounded-full h-10 w-10 border-2 border-blue-500 border-t-transparent"></div>
              <span className="text-sm text-slate-600">Loading document...</span>
            </div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="text-red-500 text-lg font-semibold mb-2">Error</div>
              <div className="text-slate-600">{error}</div>
            </div>
          </div>
        ) : (
          <>
            {/* Document with fields */}
            <div className="rounded-2xl border border-slate-200 bg-white shadow-lg p-4 sm:p-6 mb-6">
              <div className="mb-4">
                <div className="text-sm font-semibold text-slate-900">Document</div>
                <div className="text-xs text-slate-500">Review the document below. Fields are highlighted where you need to take action.</div>
              </div>

              <div className="flex justify-center overflow-auto">
                <div 
                  className="relative bg-white shadow-lg"
                  style={{ width: `${PAGE_WIDTH}px` }}
                >
                  {/* Render pages */}
                  {pageImages.length > 0 ? (
                    pageImages.map((img, idx) => {
                      const pageNo = idx + 1
                      const pageFields = fields.filter(f => f.page === pageNo)
                      return (
                        <div key={pageNo} className="relative" style={{ height: `${PAGE_HEIGHT}px` }}>
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
                    <div className="flex items-center justify-center h-96 text-slate-500">
                      <div className="flex flex-col items-center gap-2">
                        <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent"></div>
                        <span>Rendering document...</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Signature pad */}
            <div className="rounded-2xl border border-slate-200 bg-white shadow-lg p-4 sm:p-6">
              <div className="flex items-end justify-between gap-4 flex-wrap mb-4">
                <div>
                  <div className="text-sm font-semibold text-slate-900">Your Signature</div>
                  <div className="text-xs text-slate-500">Draw your signature below</div>
                </div>

                <div className="flex items-end gap-3">
                  <div>
                    <div className="text-[11px] font-semibold text-slate-600 mb-1">Pen Size</div>
                    <input
                      type="number"
                      value={penSize}
                      min={1}
                      max={12}
                      onChange={(e) => setPenSize(Math.min(12, Math.max(1, Number(e.target.value) || 2)))}
                      className="w-20 h-9 border border-slate-200 rounded px-3 text-sm bg-white text-slate-900 outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <div className="text-[11px] font-semibold text-slate-600 mb-1">Pen Color</div>
                    <input
                      type="color"
                      value={penColor}
                      onChange={(e) => setPenColor(e.target.value)}
                      className="w-20 h-9 border border-slate-200 rounded px-1 py-1 bg-white cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-center mb-4">
                <div className="text-sm font-semibold text-slate-900">Agreement</div>
                <div className="mt-1 text-sm text-slate-600">
                  By signing below, you confirm that you have reviewed and agree to the document and all included terms.
                </div>
              </div>

              <div className="flex justify-center">
                <div
                  ref={signatureBoxRef}
                  className="max-w-full rounded-xl border-2 border-slate-300 bg-white overflow-hidden"
                  style={{ width: '100%', maxWidth: '800px', height: '200px' }}
                >
                  <canvas ref={canvasRef} className="w-full h-full touch-none cursor-crosshair" />
                </div>
              </div>

              <div className="mt-4 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={clear}
                  disabled={saving}
                  className="h-10 px-4 rounded-lg bg-slate-100 text-slate-700 text-sm font-semibold hover:bg-slate-200 border border-slate-200"
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={save}
                  disabled={saving}
                  className="h-10 px-6 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {saving ? 'Saving...' : 'Submit Signature'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>

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
