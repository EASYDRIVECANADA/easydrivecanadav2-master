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

// ── Helpers ─────────────────────────────────────────────────────────────────

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

// ── Signature Pad ────────────────────────────────────────────────────────────

function SignaturePad({ onDone }: { onDone: (dataUrl: string) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)

  const getPos = (e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect()
    if ('touches' in e) {
      return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top }
    }
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

  const clear = () => {
    const canvas = canvasRef.current!
    canvas.getContext('2d')!.clearRect(0, 0, canvas.width, canvas.height)
  }

  const apply = () => {
    const canvas = canvasRef.current!
    onDone(canvas.toDataURL('image/png'))
  }

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
        <button type="button" onClick={clear} className="text-xs text-gray-500 underline">Clear</button>
        <button type="button" onClick={apply} className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">Apply Signature</button>
      </div>
    </div>
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
  const [sigPadField, setSigPadField] = useState<string | null>(null) // field id awaiting signature draw
  const [signatureData, setSignatureData] = useState('') // drawn signature dataUrl
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  // Load signature record + fields
  useEffect(() => {
    if (!id) return
    setLoading(true)
    ;(async () => {
      try {
        // 1. Load signature record
        const sigRes = await fetch(`/api/esignature/signature/${encodeURIComponent(id)}`, { cache: 'no-store' })
        if (!sigRes.ok) throw new Error('Signing link not found or expired.')
        const sigData = await sigRes.json()
        if (sigData.error) throw new Error(sigData.error)
        setSigRecord(sigData)

        // 2. Load fields for this recipient
        const fieldsRes = await fetch(`/api/esignature/fields?dealId=${encodeURIComponent(id)}`, { cache: 'no-store' })
        const fieldsJson = await fieldsRes.json()
        let allFields: Field[] = Array.isArray(fieldsJson.fields) ? fieldsJson.fields : []

        // Filter to only this recipient's fields (primary loads master + filters by idx)
        const myFields = allFields.filter(f => (f.recipientIndex ?? 0) === recipientIdx)
        setFields(myFields)

        // 3. Render document pages
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
    }
  }, [])

  const handleSignatureApply = useCallback((dataUrl: string) => {
    if (!sigPadField) return
    setSignatureData(dataUrl)
    setFields(prev => prev.map(f => f.id === sigPadField ? { ...f, value: dataUrl } : f))
    // Apply to all signature/initial fields for this recipient
    setFields(prev => prev.map(f => (f.type === 'signature' || f.type === 'initial') ? { ...f, value: dataUrl } : f))
    setSigPadField(null)
  }, [sigPadField])

  const handleSubmit = async () => {
    setSubmitting(true)
    try {
      const sig = fields.find(f => f.type === 'signature' || f.type === 'initial')
      const sigValue = sig?.value || signatureData

      // Update the signature record with signature data and status
      const res = await fetch(`/api/esignature/signature/${encodeURIComponent(id)}/complete`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signature_image: sigValue,
          signed_at: new Date().toISOString(),
          status: 'completed',
          fields_data: JSON.stringify(fields),
        }),
      })
      if (!res.ok) throw new Error('Failed to submit signature')
      setSubmitted(true)
    } catch (e: any) {
      alert(e.message || 'Failed to submit')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

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
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between shadow-sm">
        <div>
          <h1 className="text-base font-semibold text-gray-800">Sign Document</h1>
          <p className="text-xs text-gray-500">{recipient?.full_name || recipient?.email}</p>
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
      <div className="bg-blue-50 border-b border-blue-100 px-4 py-2 text-xs text-blue-700">
        Click on each highlighted field to fill it in. When all required fields are complete, click <strong>Finish &amp; Submit</strong>.
      </div>

      {/* Document canvas */}
      <div className="flex-1 overflow-y-auto py-6 px-4 flex flex-col items-center gap-4">
        {pageUrls.length === 0 && (
          <div className="text-gray-400 text-sm mt-10">No document pages to display.</div>
        )}
        {pageUrls.map((pageUrl, pageIdx) => {
          const pageFields = fields.filter(f => f.page === pageIdx)
          return (
            <div
              key={pageIdx}
              className="relative shadow-lg bg-white"
              style={{ width: PAGE_WIDTH, maxWidth: '100%' }}
            >
              <img
                src={pageUrl}
                alt={`Page ${pageIdx + 1}`}
                className="w-full block"
                draggable={false}
                style={{ aspectRatio: `${PAGE_WIDTH} / ${PAGE_HEIGHT}` }}
              />
              {/* Field overlays */}
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
                    ) : field.type === 'name' ? (
                      <div className="flex items-center px-2 h-full text-xs font-medium text-gray-900">
                        {recipient?.full_name || 'Name'}
                      </div>
                    ) : field.type === 'company' ? (
                      <div className="flex items-center px-2 h-full text-xs font-medium text-gray-900">
                        {recipient?.company || 'Company'}
                      </div>
                    ) : field.type === 'title' ? (
                      <div className="flex items-center px-2 h-full text-xs font-medium text-gray-900">
                        {recipient?.title || 'Title'}
                      </div>
                    ) : field.type === 'dateSigned' ? (
                      <div className="flex items-center justify-center h-full text-xs font-medium text-gray-700">
                        {new Date().toLocaleDateString('en-CA')}
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

      {/* Signature pad modal */}
      {sigPadField && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl p-5 w-full max-w-md shadow-2xl">
            <h3 className="text-base font-semibold text-gray-800 mb-3">Draw Your Signature</h3>
            <SignaturePad onDone={handleSignatureApply} />
            <button
              type="button"
              onClick={() => setSigPadField(null)}
              className="mt-3 w-full py-2 text-sm text-gray-500 hover:text-gray-700"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
