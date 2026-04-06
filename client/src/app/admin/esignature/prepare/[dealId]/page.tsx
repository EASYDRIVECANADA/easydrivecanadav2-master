'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import jsPDF from 'jspdf'
import { supabase } from '@/lib/supabaseClient'
import { renderBillOfSalePdf, type BillOfSaleData } from '../../../sales/deals/new/billOfSalePdf'

declare global {
  interface Window {
    pdfjsLib?: any
  }
}

type FieldType = 'signature' | 'initial' | 'stamp' | 'dateSigned' | 'name' | 'company' | 'title' | 'text' | 'checkbox'
type Field = { id: string; type: FieldType; x: number; y: number; width: number; height: number; page: number; value?: string; fileIndex?: number; recipientIndex?: number }
type UploadedFile = { file_name: string; file_type: string; file_b64?: string; url?: string }
type Recipient = { id: string; email: string; full_name?: string; company?: string; title?: string; signature_image?: string }

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
const PDF_RENDER_QUALITY = 4
const DEFAULT_TOTAL_PAGES = 3

 const detectMimeFromBase64 = (b64: string): string | null => {
   const s = String(b64 || '').trim()
   if (!s) return null
   if (s.startsWith('data:')) {
     const m = s.match(/^data:([^;]+);base64,/i)
     return m?.[1] || null
   }
   if (s.startsWith('JVBERi0')) return 'application/pdf'
   if (s.startsWith('iVBORw0')) return 'image/png'
   if (s.startsWith('/9j/')) return 'image/jpeg'
   if (s.startsWith('R0lGOD')) return 'image/gif'
   if (s.startsWith('UklGR')) return 'image/webp'
   return null
 }

 const normalizeToDataUrl = (value: string, fallbackMime: string): { url: string; mime: string } | null => {
   const raw = String(value || '').trim()
   if (!raw) return null
   if (raw.startsWith('http://') || raw.startsWith('https://')) return { url: raw, mime: fallbackMime }
   if (raw.startsWith('data:')) {
     const mime = detectMimeFromBase64(raw) || fallbackMime
     return { url: raw, mime }
   }
   const mime = detectMimeFromBase64(raw) || fallbackMime
   return { url: `data:${mime};base64,${raw}`, mime }
 }

 const getPdfPageCountFromDataUrl = (dataUrl: string): number => {
   try {
     const raw = String(dataUrl || '').trim()
     const m = raw.match(/^data:application\/pdf;base64,(.*)$/i)
     const b64 = m?.[1]
     if (!b64) return 1

     // Decode base64 -> binary string (fast enough for typical PDFs)
     const binary = atob(b64)

     // Heuristic page count: count occurrences of "/Type /Page" but exclude "/Type /Pages"
     const matches = binary.match(/\/Type\s*\/Page(?!s)\b/g)
     const count = matches?.length || 0

     // Fallback to 1 if we couldn't detect
     return count > 0 ? count : 1
   } catch {
     return 1
   }
 }

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
         console.error('[PDF.js] pdfjsLib not found after script load')
         reject(new Error('PDF.js failed to load'))
         return
       }
       try {
         window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
       } catch (e) {
         console.error('[PDF.js] Failed to set worker:', e)
       }
       console.log('[PDF.js] Loaded successfully')
       resolve(window.pdfjsLib)
     }
     script.onerror = (e) => {
       console.error('[PDF.js] Script load error:', e)
       reject(new Error('PDF.js failed to load'))
     }
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

export default function PrepareDocumentPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const dealId = params?.dealId as string
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasScrollRef = useRef<HTMLDivElement>(null)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pdfDataUrl, setPdfDataUrl] = useState<string | null>(null)
  const [pdfPageUrls, setPdfPageUrls] = useState<string[]>([])
  const [fields, setFields] = useState<Field[]>([])
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [downloadModal, setDownloadModal] = useState(false)
  const [downloadingFileIdx, setDownloadingFileIdx] = useState<number | null>(null)
  const [sending, setSending] = useState(false)
  const [sendModalOpen, setSendModalOpen] = useState(false)
  const [sendingTo, setSendingTo] = useState<string | null>(null)
  const [historyModalOpen, setHistoryModalOpen] = useState(false)
  const [viewPagesOpen, setViewPagesOpen] = useState(false)
  const [historyEvents, setHistoryEvents] = useState<any[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [loggedInUser, setLoggedInUser] = useState<{ name: string; email: string }>({ name: '', email: '' })

  // ── localStorage event helpers ──
  const lsKey = (sigId: string) => `edc_sig_events_${sigId}`

  const lsGetEvents = (sigId: string): any[] => {
    try {
      const raw = localStorage.getItem(lsKey(sigId))
      if (!raw) return []
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? parsed : []
    } catch { return [] }
  }

  const lsAddEvent = (sigId: string, event: { user_name: string; user_email: string; action: string; activity: string; status: string }) => {
    try {
      const existing = lsGetEvents(sigId)
      existing.push({ ...event, created_at: new Date().toISOString() })
      localStorage.setItem(lsKey(sigId), JSON.stringify(existing))
    } catch { /* non-fatal */ }
  }
  const [addRecipientModal, setAddRecipientModal] = useState(false)
  const [addRecipientForm, setAddRecipientForm] = useState({ email: '', full_name: '', company: '', title: '' })
  const [addingRecipient, setAddingRecipient] = useState(false)
  const [editingRecipientId, setEditingRecipientId] = useState<string | null>(null)
  const [deleteRecipientConfirm, setDeleteRecipientConfirm] = useState<{
    recipientId: string
    recipientIndex: number
    label: string
  } | null>(null)
  const [dealData, setDealData] = useState<any>(null)
  const [zoom, setZoom] = useState(100)
  const [showGrid, setShowGrid] = useState(false)
  const [draggedSidebarType, setDraggedSidebarType] = useState<FieldType | null>(null)
  const [, forceRender] = useState(0)
  const [totalPages, setTotalPages] = useState(DEFAULT_TOTAL_PAGES)
  const totalPagesRef = useRef(DEFAULT_TOTAL_PAGES)
  const [docMime, setDocMime] = useState<string | null>(null)
  const [pageImages, setPageImages] = useState<string[]>([])
  const [renderFailed, setRenderFailed] = useState(false)
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])
  const [selectedFileIndex, setSelectedFileIndex] = useState(0)
  const [recipients, setRecipients] = useState<Recipient[]>([])
  const [activeRecipientIdx, setActiveRecipientIdx] = useState(0)

  const [actionModalOpen, setActionModalOpen] = useState(false)
  const [actionModalOk, setActionModalOk] = useState<boolean>(true)
  const [actionModalTitle, setActionModalTitle] = useState('')
  const [actionModalMessage, setActionModalMessage] = useState('')

  const openActionModal = useCallback((ok: boolean, title: string, message: string) => {
    setActionModalOk(ok)
    setActionModalTitle(title)
    setActionModalMessage(message)
    setActionModalOpen(true)
  }, [])

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

  totalPagesRef.current = totalPages
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
          const maxY = PAGE_HEIGHT * totalPagesRef.current - field.height
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
            const page = Math.min(Math.max(rawPage, 1), totalPagesRef.current)
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
            const page = Math.min(Math.max(rawPage, 1), totalPagesRef.current)
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

  // Fetch logged-in user via edc_admin_session (same pattern as account page)
  useEffect(() => {
    const fetchUser = async () => {
      try {
        // Read user_id / email from the admin session stored in localStorage
        const raw = window.localStorage.getItem('edc_admin_session')
        const session = raw ? JSON.parse(raw) as { email?: string; user_id?: string } : null
        const sessionEmail = String(session?.email ?? '').trim().toLowerCase()
        const sessionUserId = String(session?.user_id ?? '').trim()

        if (!sessionEmail && !sessionUserId) return

        // Look up name from users table
        let query = supabase.from('users').select('first_name, last_name, email').limit(1)
        if (sessionUserId) query = query.eq('user_id', sessionUserId) as typeof query
        else query = query.eq('email', sessionEmail) as typeof query

        const { data: rows } = await query
        const row = rows?.[0]
        if (row) {
          const name = [row.first_name, row.last_name].filter(Boolean).join(' ') || row.email || sessionEmail
          setLoggedInUser({ name: String(name), email: row.email || sessionEmail })
        } else if (sessionEmail) {
          setLoggedInUser({ name: sessionEmail, email: sessionEmail })
        }
      } catch { /* non-fatal */ }
    }
    fetchUser()
  }, [])

  // Data loading
  useEffect(() => {
    const loadDocument = async () => {
      try {
        setLoading(true)
        setError(null)
        setPageImages([])

        // First, try to load from signature table (new upload flow)
        const sigRes = await fetch(`/api/esignature/signature/${encodeURIComponent(dealId)}`, { cache: 'no-store' })
        if (sigRes.ok) {
          const sigData = await sigRes.json()
          console.log('[Load] sigData:', { hasDocFile: !!sigData?.document_file, docFileLen: sigData?.document_file?.length })
          if (sigData && sigData.document_file) {
            // This is a signature table record with an uploaded document
            setDealData({ signature: sigData })

            // Parse document_file - JSON array with url (new) or file_b64 (old)
            const rawDocFile = String(sigData.document_file || '').trim()
            let fileList: UploadedFile[] = []
            let docFileForViewer = rawDocFile

            if (rawDocFile.startsWith('[')) {
              try {
                const parsed = JSON.parse(rawDocFile)
                if (Array.isArray(parsed) && parsed.length > 0) {
                  fileList = parsed
                  // Prefer url (new storage format), fall back to file_b64
                  docFileForViewer = parsed[0]?.url || parsed[0]?.file_b64 || rawDocFile
                }
              } catch {}
            } else if (rawDocFile.startsWith('{')) {
              try {
                const parsed = JSON.parse(rawDocFile)
                fileList = [parsed]
                docFileForViewer = parsed?.url || parsed?.file_b64 || rawDocFile
              } catch {}
            }

            if (fileList.length > 0) {
              setUploadedFiles(fileList)
              setSelectedFileIndex(0)
            }

            // Record "Registered" event once on first load
            const existingEvents = lsGetEvents(sigData.id)
            if (existingEvents.length === 0) {
              // Use loggedInUser if already loaded, otherwise resolve now
              const resolveUser = async () => {
                if (loggedInUser.email) return loggedInUser
                try {
                  const { data } = await supabase.auth.getUser()
                  const u = data?.user
                  if (!u) return { name: sigData.full_name || sigData.email || '', email: sigData.email || '' }
                  const email = u.email || ''
                  const meta = u.user_metadata || {}
                  const name = [meta.first_name, meta.last_name].filter(Boolean).join(' ') || meta.full_name || meta.name || email
                  return { name: String(name), email }
                } catch { return { name: sigData.full_name || sigData.email || '', email: sigData.email || '' } }
              }
              resolveUser().then(user => {
                lsAddEvent(sigData.id, {
                  user_name: user.name,
                  user_email: user.email,
                  action: 'Registered',
                  activity: 'The envelope was created',
                  status: 'Created',
                })
              })
            }

            // Build recipients list: primary + siblings
            const primaryRecipient: Recipient = { id: sigData.id, email: sigData.email || '', full_name: sigData.full_name, company: sigData.company, title: sigData.title, signature_image: sigData.signature_image }
            const siblingRecipients: Recipient[] = (sigData.siblings || []).map((s: any) => ({ id: s.id, email: s.email || '', full_name: s.full_name, company: s.company, title: s.title, signature_image: s.signature_image }))
            setRecipients([primaryRecipient, ...siblingRecipients])

            const normalized = normalizeToDataUrl(docFileForViewer, 'application/pdf')
            console.log('[Load] normalized:', { url: normalized?.url?.substring(0, 60), mime: normalized?.mime })
            if (!normalized) throw new Error('Missing document_file')

            setDocMime(normalized.mime)
            setPdfDataUrl(normalized.url)
            console.log('[Load] Set pdfDataUrl and docMime')

            // If it's a PDF, detect page count and render all pages.
            if (normalized.mime === 'application/pdf') {
              const pages = getPdfPageCountFromDataUrl(normalized.url)
              setTotalPages(pages)
              setPdfPageUrls(Array.from({ length: pages }, () => normalized.url))
            } else {
              // images
              setTotalPages(1)
              setPdfPageUrls([normalized.url])
            }
            
            // Load any saved fields for this signature record
            const fieldsRes = await fetch(`/api/esignature/fields?dealId=${encodeURIComponent(dealId)}`)
            if (fieldsRes.ok) {
              const fieldsData = await fieldsRes.json()
              if (fieldsData.fields) {
                setFields(fieldsData.fields)
                historyRef.current = [fieldsData.fields]
                historyIdxRef.current = 0
              }
            }
            
            setLoading(false)
            return
          }
        }

        // Fallback: Try to load from deals table (old flow)
        const dealRes = await fetch(`/api/deals/${encodeURIComponent(dealId)}`, { cache: 'no-store' })
        if (!dealRes.ok) throw new Error(`Failed to load document (${dealRes.status})`)
        const deal = await dealRes.json()
        if (!deal || deal?.error) throw new Error(String(deal?.error || 'Failed to load document'))

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
          discount: String(discount),
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
        setDocMime('application/pdf')
        setTotalPages(DEFAULT_TOTAL_PAGES)
        setPageImages([])

        const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' })
        renderBillOfSalePdf(pdf, billData, { pageStart: 1, totalPages: 3 })
        const dataUrl = pdf.output('datauristring')
        setPdfDataUrl(dataUrl)

        // Build isolated single-page previews to avoid iframe #page rendering full document repeatedly
        const pageUrls: string[] = []
        for (let pageNo = 1; pageNo <= totalPages; pageNo++) {
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

  // Render PDF pages to plain images (DocuSign-like) to avoid embedded PDF viewer UI.
  useEffect(() => {
    const run = async () => {
      try {
        setRenderFailed(false)
        console.log('[PDF Render] Starting...', { pdfDataUrl: pdfDataUrl?.substring(0, 50), docMime })
        if (!pdfDataUrl) {
          console.log('[PDF Render] No pdfDataUrl')
          return
        }
        if (docMime !== 'application/pdf') {
          console.log('[PDF Render] Not a PDF:', docMime)
          return
        }

        const pdfjs = await loadPdfJsFromCdn()
        console.log('[PDF Render] PDF.js loaded')

        let pdfSource: { data: Uint8Array } | { url: string }
        if (pdfDataUrl.startsWith('http://') || pdfDataUrl.startsWith('https://')) {
          pdfSource = { url: pdfDataUrl }
        } else {
          const bytes = pdfDataUrlToBytes(pdfDataUrl)
          if (!bytes) {
            console.log('[PDF Render] Failed to convert to bytes')
            setRenderFailed(true)
            return
          }
          console.log('[PDF Render] Bytes length:', bytes.length)
          pdfSource = { data: bytes }
        }

        const doc = await pdfjs.getDocument(pdfSource).promise
        const pages = Number(doc?.numPages || 1) || 1
        console.log('[PDF Render] Document loaded, pages:', pages)
        setTotalPages(pages)

        const rendered: string[] = []
        for (let pageNo = 1; pageNo <= pages; pageNo++) {
          console.log('[PDF Render] Rendering page', pageNo)
          const page = await doc.getPage(pageNo)
          const viewport0 = page.getViewport({ scale: 1 })
          const scaleToWidth = PAGE_WIDTH / viewport0.width
          const viewport = page.getViewport({ scale: scaleToWidth * PDF_RENDER_QUALITY })

          const canvas = document.createElement('canvas')
          const ctx = canvas.getContext('2d')
          if (!ctx) {
            console.log('[PDF Render] No canvas context for page', pageNo)
            rendered.push('')
            continue
          }

          canvas.width = Math.floor(viewport.width)
          canvas.height = Math.floor(viewport.height)

          await page.render({ canvasContext: ctx, viewport, background: 'white' }).promise
          rendered.push(canvas.toDataURL('image/png'))
          console.log('[PDF Render] Page', pageNo, 'rendered')
        }

        console.log('[PDF Render] All pages rendered:', rendered.length)
        setPageImages(rendered.filter(Boolean))
      } catch (e: any) {
        console.error('[PDF Render] Error:', e?.message || e)
        setRenderFailed(true)
        setPageImages([])
      }
    }

    run()
  }, [pdfDataUrl, docMime])

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
    const page = Math.min(Math.max(Math.floor(docY / PAGE_HEIGHT) + 1, 1), totalPagesRef.current)
    const y = docY - (page - 1) * PAGE_HEIGHT
    const cfg = FIELD_TYPES.find(f => f.type === draggedSidebarType)!
    const newField: Field = { id: `f-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, type: draggedSidebarType, x, y, width: cfg.defaultW, height: cfg.defaultH, page, fileIndex: selectedFileIndex, recipientIndex: activeRecipientIdx }
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

  const handleSwitchFile = useCallback((index: number) => {
    const file = uploadedFiles[index]
    if (!file) return
    setSelectedFileIndex(index)
    setPageImages([])
    setRenderFailed(false)
    const normalized = normalizeToDataUrl(file.url || file.file_b64 || '', file.file_type || 'application/pdf')
    if (!normalized) return
    setDocMime(normalized.mime)
    setPdfDataUrl(normalized.url)
    if (normalized.mime === 'application/pdf') {
      const pages = getPdfPageCountFromDataUrl(normalized.url)
      setTotalPages(pages)
      setPdfPageUrls(Array.from({ length: pages }, () => normalized.url))
    } else {
      setTotalPages(1)
      setPdfPageUrls([normalized.url])
    }
  }, [uploadedFiles])

  // Render a specific uploaded file to page images using pdf.js
  const renderFileToImages = async (fileIdx: number): Promise<string[]> => {
    const file = uploadedFiles[fileIdx]
    if (!file) throw new Error('File not found')
    const src = (file as any).url || file.file_b64 || ''
    if (!src) throw new Error('No file data')

    const mime = file.file_type || 'application/pdf'
    const isPdf = mime.includes('pdf') || src.startsWith('JVBERi0') || (src.startsWith('http') && src.toLowerCase().endsWith('.pdf'))

    if (!isPdf) {
      const dataUrl = src.startsWith('http') || src.startsWith('data:') ? src : `data:${mime};base64,${src}`
      return [dataUrl]
    }

    const pdfjs = await loadPdfJsFromCdn()
    const pdfSource = src.startsWith('http://') || src.startsWith('https://')
      ? { url: src }
      : (() => {
          const raw = src.startsWith('data:') ? src.split(',')[1] || src : src
          const binary = atob(raw)
          const bytes = new Uint8Array(binary.length)
          for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
          return { data: bytes }
        })()

    const doc = await pdfjs.getDocument(pdfSource).promise
    const rendered: string[] = []
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p)
      const viewport0 = page.getViewport({ scale: 1 })
      const viewport = page.getViewport({ scale: (PAGE_WIDTH / viewport0.width) * PDF_RENDER_QUALITY })
      const canvas = document.createElement('canvas')
      canvas.width = Math.floor(viewport.width)
      canvas.height = Math.floor(viewport.height)
      const ctx = canvas.getContext('2d')
      if (ctx) await page.render({ canvasContext: ctx, viewport, background: 'white' }).promise
      rendered.push(canvas.toDataURL('image/png'))
    }
    return rendered
  }

  // Render field overlays onto a jsPDF document for a given fileIndex
  const overlayFieldsOnPdf = (pdf: any, fileIdx: number) => {
    const sigData = (dealData as any)?.signature
    const c = dealData?.customer || {}
    const pdfW = pdf.internal.pageSize.getWidth()
    const pdfH = pdf.internal.pageSize.getHeight()
    const xScale = pdfW / PAGE_WIDTH
    const yScale = pdfH / PAGE_HEIGHT

    fields.filter(f => (f.fileIndex ?? 0) === fileIdx).forEach(field => {
      const pageNum = Math.min(Math.max(field.page || 1, 1), pdf.getNumberOfPages())
      pdf.setPage(pageNum)

      const x = field.x * xScale
      const y = field.y * yScale
      const w = field.width * xScale
      const h = field.height * yScale

      // Per-recipient data
      const rIdx = field.recipientIndex ?? 0
      const r = recipients[rIdx]
      const rName = r?.full_name || (rIdx === 0 ? (String(sigData?.full_name ?? '').trim() || [c.firstname, c.lastname].filter(Boolean).join(' ')) : '') || ''
      const rInitials = rName ? rName.split(' ').map((n: string) => n[0]).join('').toUpperCase() : 'DS'
      const rawSig = r?.signature_image || (rIdx === 0 ? String(sigData?.signature_image ?? c.signature ?? '').trim() : '')
      const rSig = rawSig ? (rawSig.startsWith('data:') || rawSig.startsWith('http') ? rawSig : `data:image/png;base64,${rawSig}`) : ''
      const rCompany = r?.company || ''
      const rTitle = r?.title || ''
      const signedAtRaw = rIdx === 0 ? String(sigData?.signed_at ?? sigData?.updated_at ?? sigData?.created_at ?? '').trim() : ''
      const signedDate = (() => { try { if (!signedAtRaw) return ''; const d = new Date(signedAtRaw); return isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-CA') } catch { return '' } })()

      try {
        switch (field.type) {
          case 'signature':
            if (rSig) pdf.addImage(rSig, 'PNG', x, y, w, h)
            break
          case 'initial':
            pdf.setTextColor(29, 78, 216); pdf.setFontSize(14); pdf.setFont('helvetica', 'bold')
            pdf.text(rInitials, x + w / 2, y + h / 2, { align: 'center', baseline: 'middle' })
            pdf.setFont('helvetica', 'normal')
            break
          case 'stamp':
            pdf.setDrawColor(220, 38, 38); pdf.setTextColor(220, 38, 38)
            pdf.circle(x + w / 2, y + h / 2, Math.max(Math.min(w, h) / 2 - 2, 2), 'S')
            pdf.circle(x + w / 2, y + h / 2, Math.max(Math.min(w, h) / 2 - 8, 1), 'S')
            pdf.setFontSize(12); pdf.setFont('helvetica', 'bold')
            pdf.text('APPROVED', x + w / 2, y + h / 2 - 5, { align: 'center' })
            pdf.setFontSize(9); pdf.setFont('helvetica', 'normal')
            pdf.text(new Date().toLocaleDateString('en-CA'), x + w / 2, y + h / 2 + 8, { align: 'center' })
            break
          case 'dateSigned':
            pdf.setTextColor(55, 65, 81); pdf.setFontSize(10)
            if (signedDate) pdf.text(signedDate, x + w / 2, y + h / 2, { align: 'center', baseline: 'middle' })
            break
          case 'name':
            pdf.setTextColor(17, 24, 39); pdf.setFontSize(10)
            if (rName) pdf.text(rName, x + 5, y + h / 2, { baseline: 'middle' })
            else if (field.value) pdf.text(String(field.value), x + 5, y + h / 2, { baseline: 'middle' })
            break
          case 'company':
            pdf.setTextColor(55, 65, 81); pdf.setFontSize(10)
            if (rCompany) pdf.text(rCompany, x + 5, y + h / 2, { baseline: 'middle' })
            else if (field.value) pdf.text(String(field.value), x + 5, y + h / 2, { baseline: 'middle' })
            break
          case 'title':
            pdf.setTextColor(55, 65, 81); pdf.setFontSize(10)
            if (rTitle) pdf.text(rTitle, x + 5, y + h / 2, { baseline: 'middle' })
            else if (field.value) pdf.text(String(field.value), x + 5, y + h / 2, { baseline: 'middle' })
            break
          case 'text':
            pdf.setTextColor(55, 65, 81); pdf.setFontSize(10)
            if (field.value) pdf.text(String(field.value), x + 5, y + h / 2, { baseline: 'middle' })
            break
          case 'checkbox':
            pdf.setDrawColor(37, 99, 235)
            pdf.roundedRect(x + w / 2 - 7.5, y + h / 2 - 7.5, 15, 15, 2, 2, 'S')
            if (['true', '1', 'yes'].includes(String(field.value ?? '').toLowerCase())) {
              pdf.setTextColor(37, 99, 235); pdf.setFontSize(12)
              pdf.text('✓', x + w / 2, y + h / 2 + 1, { align: 'center', baseline: 'middle' })
            }
            break
        }
      } catch (err) {
        console.error('Failed to render field in download PDF:', field.id, err)
      }
    })
  }

  const handleDownloadFile = async (fileIdx: number) => {
    setDownloadingFileIdx(fileIdx)
    try {
      const imgs = await renderFileToImages(fileIdx)
      if (!imgs.length) throw new Error('No pages rendered')

      const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' })
      const pdfW = pdf.internal.pageSize.getWidth()
      const pdfH = pdf.internal.pageSize.getHeight()
      imgs.forEach((img, i) => { if (i > 0) pdf.addPage(); if (img) pdf.addImage(img, 'PNG', 0, 0, pdfW, pdfH) })

      overlayFieldsOnPdf(pdf, fileIdx)

      const fileName = uploadedFiles[fileIdx]?.file_name?.replace(/\.[^.]+$/, '') || `Document_${fileIdx + 1}`
      pdf.save(`${fileName}_with_fields.pdf`)
    } catch (e: any) {
      openActionModal(false, 'Download failed', String(e?.message || 'Unknown error'))
    } finally {
      setDownloadingFileIdx(null)
    }
  }

  // recipientId = specific recipient id to send to, null = send to all
  const executeSend = async (recipientId: string | null) => {
    if (sending) return
    setSending(true)
    setSendingTo(recipientId ?? 'all')
    try {
      const sigRes = await fetch(`/api/esignature/signature/${encodeURIComponent(dealId)}`, { cache: 'no-store' })
      if (!sigRes.ok) throw new Error('Failed to load signature record')
      const sigData = await sigRes.json()
      if (!sigData?.document_file) throw new Error('No document file found')

      const getDocumentUrl = (raw: string): string => {
        try {
          const parsed = JSON.parse(raw)
          const first = Array.isArray(parsed) ? parsed[0] : parsed
          return first?.url || first?.file_url || first?.file_b64 || ''
        } catch { return raw }
      }
      const documentUrl = getDocumentUrl(sigData.document_file)

      const allRecipients = [
        { id: sigData.id, email: sigData.email, full_name: sigData.full_name },
        ...((sigData.siblings as any[]) || []).map((s: any) => ({ id: s.id, email: s.email, full_name: s.full_name })),
      ]

      const targets = recipientId
        ? allRecipients.filter(r => r.id === recipientId)
        : allRecipients

      if (targets.length === 0) throw new Error('Recipient not found')

      const errors: string[] = []
      for (const recip of targets) {
        const link = `https://easydrivecanada.com/admin/sales/deals/signature?${encodeURIComponent(recip.id)}`
        const res = await fetch('https://primary-production-6722.up.railway.app/webhook/request', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: recip.full_name || recip.email || '', email: recip.email || '', link, document_url: documentUrl }),
        })
        if (!res.ok) {
          errors.push(recip.email || recip.id)
        } else {
          // Record "Sent Invitations" event in localStorage
          lsAddEvent(sigData.id, {
            user_name: loggedInUser.name || sigData.full_name || sigData.email || 'Owner',
            user_email: loggedInUser.email || sigData.email || '',
            action: 'Sent Invitations',
            activity: `Sent a signature request to ${recip.full_name || recip.email || ''} [${recip.email || ''}]`,
            status: 'Sent',
          })
        }
      }

      if (errors.length > 0) throw new Error(`Failed for: ${errors.join(', ')}`)
      setSendModalOpen(false)
      openActionModal(true, 'Sent', `Signature request sent to ${targets.length} recipient(s).`)
    } catch (err: any) {
      openActionModal(false, 'Send Failed', err?.message || 'Unknown error')
    } finally {
      setSending(false)
      setSendingTo(null)
    }
  }

  const handleDownload = async () => {
    // If multiple files, show file picker modal
    if (uploadedFiles.length > 1) {
      setDownloadModal(true)
      return
    }
    // Single file — download directly
    setDownloading(true)
    try {
      const imgs = uploadedFiles.length > 0 ? await renderFileToImages(0) : pageImages
      if (!imgs.length) throw new Error('No document pages available to download')

      const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' })
      const pdfW = pdf.internal.pageSize.getWidth()
      const pdfH = pdf.internal.pageSize.getHeight()
      imgs.forEach((img, i) => { if (i > 0) pdf.addPage(); if (img) pdf.addImage(img, 'PNG', 0, 0, pdfW, pdfH) })

      overlayFieldsOnPdf(pdf, selectedFileIndex)
      pdf.save(`Document_${dealId}_with_fields.pdf`)
    } catch (e: any) {
      openActionModal(false, 'Download failed', String(e?.message || 'Unknown error'))
    } finally {
      setDownloading(false)
    }
  }

  const openAddRecipientModal = () => {
    setEditingRecipientId(null)
    setAddRecipientForm({ email: '', full_name: '', company: '', title: '' })
    setAddRecipientModal(true)
  }

  const openEditRecipientModal = (recipient: Recipient) => {
    setEditingRecipientId(recipient.id)
    setAddRecipientForm({
      email: recipient.email || '',
      full_name: recipient.full_name || '',
      company: recipient.company || '',
      title: recipient.title || '',
    })
    setAddRecipientModal(true)
  }

  const handleUpsertRecipient = async () => {
    if (!addRecipientForm.email.trim()) return
    setAddingRecipient(true)
    try {
      const isEdit = Boolean(editingRecipientId)
      const endpoint = isEdit
        ? `/api/esignature/signature/${encodeURIComponent(dealId)}/update-recipient`
        : `/api/esignature/signature/${encodeURIComponent(dealId)}/add-recipient`
      const payload = isEdit ? { ...addRecipientForm, recipientId: editingRecipientId } : addRecipientForm
      const res = await fetch(endpoint, {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || (isEdit ? 'Failed to update recipient' : 'Failed to add recipient'))

      if (isEdit) {
        setRecipients((prev) =>
          prev.map((r) =>
            r.id === editingRecipientId
              ? {
                  ...r,
                  email: data.recipient?.email ?? addRecipientForm.email,
                  full_name: data.recipient?.full_name ?? addRecipientForm.full_name,
                  company: data.recipient?.company ?? addRecipientForm.company,
                  title: data.recipient?.title ?? addRecipientForm.title,
                }
              : r
          )
        )
      } else {
        setRecipients(prev => [
          ...prev,
          {
            id: data.recipient.id,
            email: data.recipient.email,
            full_name: data.recipient.full_name || '',
            company: data.recipient.company || '',
            title: data.recipient.title || '',
          },
        ])
      }
      setAddRecipientModal(false)
      setEditingRecipientId(null)
      setAddRecipientForm({ email: '', full_name: '', company: '', title: '' })
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
    } catch (err: any) {
      openActionModal(false, 'Error', err?.message || 'Failed to save recipient')
    } finally {
      setAddingRecipient(false)
    }
  }

  const handleDeleteRecipient = (recipientId: string, recipientIndex: number) => {
    if (recipientIndex === 0) {
      openActionModal(false, 'Not Allowed', 'Primary recipient cannot be deleted.')
      return
    }
    const target = recipients[recipientIndex]
    const label = target?.full_name || target?.email || 'this recipient'
    setDeleteRecipientConfirm({ recipientId, recipientIndex, label })
  }

  const executeDeleteRecipient = async () => {
    if (!deleteRecipientConfirm) return
    const { recipientId, recipientIndex } = deleteRecipientConfirm
    setAddingRecipient(true)
    try {
      const res = await fetch(`/api/esignature/signature/${encodeURIComponent(dealId)}/delete-recipient`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipientId }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || 'Failed to delete recipient')

      setRecipients((prev) => prev.filter((r) => r.id !== recipientId))
      setFields((prev) =>
        prev
          .filter((f) => (f.recipientIndex ?? 0) !== recipientIndex)
          .map((f) => {
            const idx = f.recipientIndex ?? 0
            return idx > recipientIndex ? { ...f, recipientIndex: idx - 1 } : f
          })
      )
      setActiveRecipientIdx((prev) => Math.max(0, prev > recipientIndex ? prev - 1 : prev))
      setDeleteRecipientConfirm(null)
    } catch (err: any) {
      openActionModal(false, 'Error', err?.message || 'Failed to delete recipient')
    } finally {
      setAddingRecipient(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      // Save master copy (all fields) to primary dealId — used by prepare page on reload
      const res = await fetch('/api/esignature/fields', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dealId, fields }),
      })
      if (!res.ok) throw new Error('Failed to save fields')

      // Save each sibling recipient's filtered fields to their own row ID
      // so the signing page for that recipient only receives their assigned fields
      for (let i = 1; i < recipients.length; i++) {
        const sibling = recipients[i]
        const recipientFields = fields.filter(f => (f.recipientIndex ?? 0) === i)
        await fetch('/api/esignature/fields', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dealId: sibling.id, fields: recipientFields }),
        })
      }

      openActionModal(true, 'Saved', `All fields saved for all ${recipients.length} recipient(s) across all files.`)
    } catch (e: any) {
      openActionModal(false, 'Save failed', String(e?.message || 'Unknown error'))
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => {
    const shouldAutoDownload = String(searchParams.get('autodownload') || '').trim() === '1'
    if (!shouldAutoDownload) return
    if (loading) return
    if (error) return
    if (!dealId) return

    // Wait a tick so the UI is ready
    const t = window.setTimeout(() => {
      void handleDownload()
    }, 300)

    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, loading, error, dealId])

  // Field content renderer
  const renderFieldContent = (field: Field) => {
    const sigData = dealData?.signature
    const c = dealData?.customer || {}

    // Pick the recipient matching this field's recipientIndex
    const fieldRecipientIdx = field.recipientIndex ?? 0
    const fieldRecipient = recipients[fieldRecipientIdx]

    // Use the field's recipient name if available, otherwise fall back to sigData/customer
    const fullName =
      fieldRecipient?.full_name ||
      (fieldRecipientIdx === 0 ? sigData?.full_name : '') ||
      [c.firstname, c.lastname].filter(Boolean).join(' ') ||
      fieldRecipient?.email || ''
    const initials = fullName ? fullName.split(' ').map((n: string) => n[0]).join('').toUpperCase() : 'DS'
    // Get signature from the specific recipient's stored signature_image (any recipient index)
    const rawSig = fieldRecipient?.signature_image ||
      (fieldRecipientIdx === 0 ? (sigData?.signature_image || String(c.signature ?? '').trim()) : '')
    const signature = rawSig
      ? (rawSig.startsWith('data:') || rawSig.startsWith('http') ? rawSig : `data:image/png;base64,${rawSig}`)
      : ''
    const fieldValue = String(field.value ?? '')

    switch (field.type) {
      case 'signature':
        if (signature) {
          return <img src={signature} alt="Signature" className="w-full h-full object-contain" draggable={false} onError={(e) => { e.currentTarget.style.display = 'none' }} />
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
        return <div className="flex items-center px-2 h-full text-xs font-medium text-gray-900">{fieldRecipient?.company || fieldValue || 'Company'}</div>
      case 'title':
        return <div className="flex items-center px-2 h-full text-xs font-medium text-gray-900">{fieldRecipient?.title || fieldValue || 'Title'}</div>
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

        <div className="flex-1" />

        {uploadedFiles.length > 1 && (
          <div className="flex items-center gap-1 mr-2 bg-gray-100 rounded-lg p-1 max-w-[280px] overflow-x-auto">
            {uploadedFiles.map((file, idx) => (
              <button
                key={`file-tab-${idx}`}
                type="button"
                onClick={() => handleSwitchFile(idx)}
                title={file.file_name}
                className={`shrink-0 px-2.5 py-1 rounded-md text-xs font-medium transition-colors truncate max-w-[120px] ${
                  selectedFileIndex === idx
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200'
                }`}
              >
                {file.file_name || `File ${idx + 1}`}
              </button>
            ))}
          </div>
        )}

      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* ── Left Sidebar ── */}
        <div className="w-60 bg-white border-r border-gray-200 flex flex-col shrink-0">
          {/* Recipient Tabs */}
          {recipients.length > 0 && (
            <div className="border-b border-gray-100">
              <div className="px-3 pt-3 pb-1">
                <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Recipients</h2>
                <div className="flex flex-col gap-1">
                  {recipients.map((r, idx) => {
                    const colors = ['bg-blue-500', 'bg-purple-500', 'bg-green-500', 'bg-orange-500', 'bg-pink-500']
                    const color = colors[idx % colors.length]
                    const isActive = activeRecipientIdx === idx
                    const isSendingThis = sending && sendingTo === r.id
                    return (
                      <div key={r.id} className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setActiveRecipientIdx(idx)}
                          className={`flex-1 flex items-center gap-2 px-2 py-1.5 rounded-lg text-left transition-all text-xs ${
                            isActive ? 'bg-blue-50 border border-blue-200' : 'hover:bg-gray-50 border border-transparent'
                          }`}
                        >
                          <div className={`w-5 h-5 rounded-full ${color} flex items-center justify-center text-white text-xs font-bold shrink-0`}>
                            {(r.email || '?').charAt(0).toUpperCase()}
                          </div>
                          <span className={`truncate ${isActive ? 'text-blue-700 font-medium' : 'text-gray-600'}`}>
                            {r.full_name || r.email}
                          </span>
                        </button>
                        <button
                          type="button"
                          title={`Edit ${r.full_name || r.email}`}
                          disabled={sending || addingRecipient}
                          onClick={() => openEditRecipientModal(r)}
                          className="w-6 h-6 flex items-center justify-center rounded-md text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 disabled:opacity-40 transition-colors shrink-0"
                        >
                          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-5M18.5 3.5a2.121 2.121 0 1 1 3 3L12 16l-4 1 1-4 9.5-9.5z" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          title={idx === 0 ? 'Primary recipient cannot be deleted' : `Delete ${r.full_name || r.email}`}
                          disabled={sending || addingRecipient || idx === 0}
                          onClick={() => handleDeleteRecipient(r.id, idx)}
                          className="w-6 h-6 flex items-center justify-center rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-40 transition-colors shrink-0"
                        >
                          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 6h18M8 6V4h8v2m-9 0 1 14h8l1-14" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          title={`Send to ${r.full_name || r.email}`}
                          disabled={sending}
                          onClick={() => executeSend(r.id)}
                          className="w-6 h-6 flex items-center justify-center rounded-md text-slate-400 hover:text-blue-600 hover:bg-blue-50 disabled:opacity-40 transition-colors shrink-0"
                        >
                          {isSendingThis ? (
                            <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2a10 10 0 1 0 10 10"/></svg>
                          ) : (
                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>
                          )}
                        </button>
                      </div>
                    )
                  })}
                  <button
                    type="button"
                    onClick={openAddRecipientModal}
                    className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs text-blue-600 hover:bg-blue-50 border border-dashed border-blue-300 transition-colors mt-1"
                  >
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14"/></svg>
                    Add Recipient
                  </button>
                </div>
              </div>
            </div>
          )}
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
          ref={canvasScrollRef}
          className="flex-1 overflow-y-auto overflow-x-hidden bg-[#e8eaed]"
          style={{ backgroundImage: showGrid ? 'radial-gradient(circle, #d1d5db 1px, transparent 1px)' : 'none', backgroundSize: showGrid ? '20px 20px' : 'auto' }}
        >
          <div className="flex items-start justify-center p-8 min-h-full">
            <div
              ref={containerRef}
              className="relative bg-white border border-gray-300 shadow-sm"
              style={{ width: `${PAGE_WIDTH * scale}px`, minHeight: `${(PAGE_HEIGHT * totalPages + Math.max(0, totalPages - 1) * 12) * scale}px`, transformOrigin: 'top left' }}
            >
              {/* Document display - handles both PDF and images */}
              {pdfPageUrls.length > 0 && (
                <>
                  {Boolean(docMime?.startsWith('image/')) ? (
                    <img
                      src={pdfPageUrls[0]}
                      alt="Document"
                      className="w-full absolute left-0 pointer-events-none object-contain"
                      style={{ top: 0, height: `${PAGE_HEIGHT * totalPages * scale}px`, zIndex: 1 }}
                    />
                  ) : docMime === 'application/pdf' ? (
                    pageImages.length > 0 ? (
                    pageImages.map((img, idx) => {
                      const pageNo = idx + 1
                      const totalPgs = pageImages.length
                      return (
                        <div key={pageNo}>
                          <img
                            src={img}
                            alt={`Page ${pageNo}`}
                            className="w-full absolute left-0 pointer-events-none bg-white"
                            style={{ top: `${(pageNo - 1) * PAGE_HEIGHT * scale}px`, height: `${PAGE_HEIGHT * scale}px`, zIndex: 1, backgroundColor: '#fff' }}
                          />
                          {/* Page-end indicator — shown after every page */}
                          <div
                            className="absolute left-0 w-full pointer-events-none flex flex-col items-center"
                            style={{ top: `${pageNo * PAGE_HEIGHT * scale - 24 * scale}px`, zIndex: 5 }}
                          >
                            <div
                              className="flex items-center justify-center w-full"
                              style={{ height: `${24 * scale}px`, background: 'linear-gradient(to top, rgba(200,210,230,0.55) 0%, transparent 100%)' }}
                            >
                              <span
                                className="px-2 py-0.5 rounded text-slate-500 font-medium bg-white/80 border border-slate-200"
                                style={{ fontSize: `${10 * scale}px`, lineHeight: 1.4 }}
                              >
                                Page {pageNo} / {totalPgs}
                              </span>
                            </div>
                          </div>
                          {/* Gap between pages */}
                          {pageNo < totalPgs && (
                            <div
                              className="absolute left-0 w-full pointer-events-none"
                              style={{ top: `${pageNo * PAGE_HEIGHT * scale}px`, height: `${12 * scale}px`, background: '#d1d5db', zIndex: 3 }}
                            />
                          )}
                        </div>
                      )
                    })
                    ) : renderFailed ? (
                      pdfPageUrls.map((pageUrl, idx) => {
                        const pageNo = idx + 1
                        const totalPgs = pdfPageUrls.length
                        return (
                          <div key={pageNo}>
                            <iframe
                              src={`${pageUrl}#page=${pageNo}&zoom=page-width&toolbar=0&navpanes=0&scrollbar=0`}
                              scrolling="no"
                              className="w-full absolute left-0 pointer-events-none bg-white overflow-hidden"
                              style={{ top: `${(pageNo - 1) * PAGE_HEIGHT * scale}px`, height: `${PAGE_HEIGHT * scale}px`, border: 'none', zIndex: 1, backgroundColor: '#fff', overflow: 'hidden' }}
                              title={`Document Page ${pageNo}`}
                            />
                            <div
                              className="absolute left-0 w-full pointer-events-none flex flex-col items-center"
                              style={{ top: `${pageNo * PAGE_HEIGHT * scale - 24 * scale}px`, zIndex: 5 }}
                            >
                              <div
                                className="flex items-center justify-center w-full"
                                style={{ height: `${24 * scale}px`, background: 'linear-gradient(to top, rgba(200,210,230,0.55) 0%, transparent 100%)' }}
                              >
                                <span
                                  className="px-2 py-0.5 rounded text-slate-500 font-medium bg-white/80 border border-slate-200"
                                  style={{ fontSize: `${10 * scale}px`, lineHeight: 1.4 }}
                                >
                                  Page {pageNo} / {totalPgs}
                                </span>
                              </div>
                            </div>
                            {pageNo < totalPgs && (
                              <div
                                className="absolute left-0 w-full pointer-events-none"
                                style={{ top: `${pageNo * PAGE_HEIGHT * scale}px`, height: `${12 * scale}px`, background: '#d1d5db', zIndex: 3 }}
                              />
                            )}
                          </div>
                        )
                      })
                    ) : (
                      <div
                        className="absolute inset-0 flex items-center justify-center text-sm text-gray-500"
                        style={{ zIndex: 1, height: `${PAGE_HEIGHT * totalPages * scale}px` }}
                      >
                        <div className="flex flex-col items-center gap-2">
                          <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent"></div>
                          <span>Rendering document...</span>
                        </div>
                      </div>
                    )
                  ) : (
                    <div
                      className="absolute inset-0 flex items-center justify-center text-sm text-gray-500"
                      style={{ zIndex: 1, height: `${PAGE_HEIGHT * totalPages * scale}px` }}
                    >
                      Unsupported document type
                    </div>
                  )}
                </>
              )}

              {/* Drop overlay — raised above all fields while a sidebar drag is in progress */}
              <div
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                onDragEnter={(e) => e.preventDefault()}
                onClick={() => setSelectedFieldId(null)}
                className="absolute top-0 left-0 w-full h-full"
                style={{ zIndex: draggedSidebarType ? 200 : 2, minHeight: `${PAGE_HEIGHT * totalPages * scale}px`, pointerEvents: 'auto' }}
              />

              {/* Alignment guide lines */}
              <div ref={el => { guidesRef.current.vLine = el }} className="absolute top-0 w-px bg-pink-500 pointer-events-none" style={{ display: 'none', height: '100%', zIndex: 100 }} />
              <div ref={el => { guidesRef.current.hLine = el }} className="absolute left-0 h-px bg-pink-500 pointer-events-none" style={{ display: 'none', width: '100%', zIndex: 100 }} />

              {/* Rendered fields - only for the currently displayed file */}
              {fields.filter((f) => (f.fileIndex ?? 0) === selectedFileIndex).map((field) => {
                const isSelected = selectedFieldId === field.id
                const isActive = interactionRef.current.fieldId === field.id
                const fieldRecipient = field.recipientIndex ?? 0
                const isActiveRecipient = recipients.length === 0 || fieldRecipient === activeRecipientIdx
                const recipientBorderColors = ['border-blue-400', 'border-purple-400', 'border-green-400', 'border-orange-400', 'border-pink-400']
                const recipientBgColors = ['bg-blue-50/30', 'bg-purple-50/30', 'bg-green-50/30', 'bg-orange-50/30', 'bg-pink-50/30']
                const borderColor = recipientBorderColors[fieldRecipient % recipientBorderColors.length]
                const bgColor = recipientBgColors[fieldRecipient % recipientBgColors.length]

                return (
                  <div
                    key={field.id}
                    data-field-id={field.id}
                    className={`absolute select-none group ${isActive ? '' : 'transition-all duration-150'}`}
                    style={{
                      transform: `translate3d(${field.x * scale}px, ${(((field.page || 1) - 1) * PAGE_HEIGHT + field.y) * scale}px, 0)`,
                      width: `${field.width * scale}px`,
                      height: `${field.height * scale}px`,
                      zIndex: isActive ? 50 : isSelected ? 20 : isActiveRecipient ? 10 : 5,
                      willChange: isActive ? 'transform, width, height' : 'auto',
                      opacity: isActiveRecipient ? 1 : 0.35,
                      pointerEvents: isActiveRecipient ? 'auto' : 'none',
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
                          : `${borderColor} ${bgColor}`
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
                              className={`absolute w-2.5 h-2.5 rounded-full bg-white border border-blue-500 shadow-sm ${pos[dir]}`}
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

        {/* ── View Pages Thumbnail Panel ── */}
        {viewPagesOpen && (
          <div className="w-52 bg-white border-l border-gray-200 flex flex-col shrink-0 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <span className="text-sm font-semibold text-gray-800">Pages</span>
              <button
                type="button"
                onClick={() => setViewPagesOpen(false)}
                className="p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
              </button>
            </div>
            {/* Thumbnails list */}
            <div className="flex-1 overflow-y-auto py-3 px-3 space-y-3">
              {Array.from({ length: totalPages }, (_, i) => {
                const pageNo = i + 1
                const thumbImg = pageImages[i] || pdfPageUrls[i] || null
                return (
                  <button
                    key={pageNo}
                    type="button"
                    onClick={() => {
                      if (!canvasScrollRef.current) return
                      const GAP = 12
                      const targetY = 32 + (pageNo - 1) * (PAGE_HEIGHT * (zoom / 100) + GAP)
                      canvasScrollRef.current.scrollTo({ top: targetY, behavior: 'smooth' })
                    }}
                    className="w-full flex flex-col items-center gap-1.5 group"
                  >
                    <div className="w-full border-2 border-transparent group-hover:border-blue-500 rounded overflow-hidden transition-colors shadow-sm bg-white">
                      {thumbImg ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={thumbImg} alt={`Page ${pageNo}`} className="w-full h-auto object-contain" />
                      ) : (
                        <div className="w-full aspect-[816/1056] bg-gray-100 flex items-center justify-center">
                          <svg className="w-6 h-6 text-gray-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 12h6M9 16h6M9 8h4"/></svg>
                        </div>
                      )}
                    </div>
                    <span className="text-[11px] text-gray-500 font-medium">{pageNo}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* ── Right Sidebar ── */}
        <div className="w-16 bg-white border-l border-gray-200 flex flex-col items-center py-4 gap-1 shrink-0">
          {/* View Pages */}
          <button
            onClick={() => setViewPagesOpen(v => !v)}
            className={`w-12 flex flex-col items-center gap-1 py-2.5 px-1 rounded-xl transition-colors ${viewPagesOpen ? 'text-blue-600 bg-blue-50' : 'text-gray-500 hover:text-blue-600 hover:bg-blue-50'}`}
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="9" rx="1"/><rect x="3" y="15" width="7" height="6" rx="1"/><rect x="14" y="15" width="7" height="6" rx="1"/>
            </svg>
            <span className="text-[9px] font-medium leading-tight text-center">View Pages</span>
          </button>

          {/* Audit trail */}
          <button
            type="button"
            title="Audit trail"
            onClick={() => {
              const sigData = dealData?.signature
              if (!sigData) return
              setHistoryEvents(lsGetEvents(sigData.id))
              setHistoryModalOpen(true)
            }}
            className="w-12 flex flex-col items-center gap-1 py-2.5 px-1 rounded-xl text-gray-500 hover:text-purple-600 hover:bg-purple-50 transition-colors"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/><polyline strokeLinecap="round" strokeLinejoin="round" points="12 6 12 12 16 14"/>
            </svg>
            <span className="text-[8px] font-medium leading-tight text-center">Audit trail</span>
          </button>

          {/* Send */}
          <button
            onClick={() => setSendModalOpen(true)}
            disabled={sending}
            className="w-12 flex flex-col items-center gap-1 py-2.5 px-1 rounded-xl text-gray-500 hover:text-blue-600 hover:bg-blue-50 disabled:opacity-40 transition-colors"
          >
            {sending ? (
              <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2a10 10 0 1 0 10 10"/></svg>
            ) : (
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>
            )}
            <span className="text-[9px] font-medium leading-tight text-center">Send</span>
          </button>

          {/* Download */}
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="w-12 flex flex-col items-center gap-1 py-2.5 px-1 rounded-xl text-gray-500 hover:text-green-600 hover:bg-green-50 disabled:opacity-40 transition-colors"
          >
            {downloading ? (
              <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2a10 10 0 1 0 10 10"/></svg>
            ) : (
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
            )}
            <span className="text-[9px] font-medium leading-tight text-center">Download</span>
          </button>

          {/* Save */}
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-12 flex flex-col items-center gap-1 py-2.5 px-1 rounded-xl text-gray-500 hover:text-blue-600 hover:bg-blue-50 disabled:opacity-40 transition-colors"
          >
            {saving ? (
              <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2a10 10 0 1 0 10 10"/></svg>
            ) : (
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline strokeLinecap="round" strokeLinejoin="round" points="17 21 17 13 7 13 7 21"/><polyline strokeLinecap="round" strokeLinejoin="round" points="7 3 7 8 15 8"/></svg>
            )}
            <span className="text-[9px] font-medium leading-tight text-center">Save</span>
          </button>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Zoom + Grid controls at bottom */}
          <div className="flex flex-col items-center gap-1 pb-1">
            <button
              onClick={() => setZoom(z => Math.min(200, z + 10))}
              className="w-9 h-9 flex items-center justify-center rounded-lg text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-colors"
              title="Zoom In"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35M8 11h6M11 8v6"/></svg>
            </button>
            <span className="text-[10px] font-semibold text-gray-600">{zoom}%</span>
            <button
              onClick={() => setZoom(z => Math.max(50, z - 10))}
              className="w-9 h-9 flex items-center justify-center rounded-lg text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-colors"
              title="Zoom Out"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35M8 11h6"/></svg>
            </button>
            <button
              onClick={() => setZoom(100)}
              className="w-9 h-7 flex items-center justify-center rounded-lg text-[10px] font-medium text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-colors"
              title="Fit (100%)"
            >
              Fit
            </button>
            <div className="w-8 h-px bg-gray-200 my-0.5" />
            <button
              onClick={() => setShowGrid(g => !g)}
              className={`w-9 h-9 flex items-center justify-center rounded-lg transition-colors ${showGrid ? 'text-blue-600 bg-blue-50' : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100'}`}
              title="Toggle Grid"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/></svg>
            </button>
          </div>
        </div>
      </div>

      {/* ── Audit trail full page ── */}
      {historyModalOpen && (() => {
        const sigData = dealData?.signature
        if (!sigData) return null

        const allRecipients: any[] = [sigData, ...((sigData.siblings as any[]) || [])]
        const isCompleted = (r: any) => !!(r.signed_at || String(r.status || '').toLowerCase() === 'completed')
        const overallSigned = allRecipients.every(isCompleted)

        const fmt = (iso: string | null) => {
          if (!iso) return '—'
          try {
            const d = new Date(iso)
            return d.toLocaleString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true })
          } catch { return iso }
        }

        const docFiles: any[] = (() => {
          try { const p = JSON.parse(sigData.document_file || '[]'); return Array.isArray(p) ? p : [p] } catch { return [] }
        })()
        const docNames = docFiles.map((f: any) => f.file_name || '').filter(Boolean)

        // Use real events from API; fall back to signature record data if none yet
        type ActivityRow = { time: string; user: string; user_email: string; action: string; activity: string; status: string }
        let rows: ActivityRow[]

        // Admin-triggered actions always show the current logged-in user
        const adminActions = new Set(['Registered', 'Sent Invitations'])
        const displayUser = loggedInUser.name || loggedInUser.email || '—'
        const displayEmail = loggedInUser.email || ''

        if (historyEvents.length > 0) {
          rows = historyEvents.map((ev: any) => {
            const isAdminAction = adminActions.has(ev.action)
            return {
              time: fmt(ev.created_at),
              user: isAdminAction ? displayUser : (ev.user_name || '—'),
              user_email: isAdminAction ? displayEmail : (ev.user_email || ''),
              action: ev.action || '',
              activity: ev.activity || '',
              status: ev.status || '',
            }
          })
        } else {
          // Fallback: build from signature record (no events recorded yet)
          rows = []
          rows.push({
            time: fmt(sigData.created_at),
            user: loggedInUser.name || allRecipients[0]?.full_name || allRecipients[0]?.email || 'Owner',
            user_email: loggedInUser.email || allRecipients[0]?.email || '',
            action: 'Registered',
            activity: 'The envelope was created',
            status: 'Created',
          })
          for (const r of allRecipients) {
            if (isCompleted(r)) {
              rows.push({
                time: fmt(r.signed_at || r.updated_at),
                user: r.full_name || r.email || '',
                user_email: r.email || '',
                action: 'Signed',
                activity: `${r.full_name || r.email || ''} signed the document`,
                status: 'Completed',
              })
            }
          }
        }

        return (
          <div className="fixed inset-0 z-[200] bg-white overflow-y-auto">
            {/* Print styles — remove browser URL footer, zero page margins */}
            <style dangerouslySetInnerHTML={{ __html: `@media print { @page { margin: 0mm; size: auto; } body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } .print-logo { display: flex !important; } .print-content { padding: 14mm 16mm; } }` }} />

            {/* Print-only logo header */}
            <div className="print-logo hidden items-center gap-3 px-8 pt-6 pb-4 border-b border-gray-200 mb-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/images/logo.png" alt="EasyDrive Canada" className="h-10 w-auto object-contain" />
            </div>

            {/* Top bar */}
            <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-8 py-3 flex items-center justify-between print:hidden">
              <button
                type="button"
                onClick={() => setHistoryModalOpen(false)}
                className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/></svg>
                Back to Document
              </button>
              <div className="text-sm font-semibold text-gray-700">Audit trail</div>
              <button
                type="button"
                onClick={() => window.print()}
                className="h-8 px-4 rounded border border-gray-300 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Print
              </button>
            </div>

            {/* Page content */}
            <div className="max-w-5xl mx-auto px-8 py-10 print-content">

              {/* Meta grid */}
              <div className="grid grid-cols-2 gap-x-16 gap-y-5 mb-10 pb-8 border-b border-gray-200">
                <div>
                  <div className="text-sm font-semibold text-gray-900 mb-0.5">Subject</div>
                  <div className="text-sm text-gray-600">Complete with EasyDrive Canada: {docNames[0] || 'Document'}</div>
                </div>
                <div>
                  <div className="text-sm font-semibold text-gray-900 mb-0.5">Documents</div>
                  <div className="text-sm text-gray-600">{docNames.length > 0 ? docNames.join(', ') : '—'}</div>
                </div>
                <div>
                  <div className="text-sm font-semibold text-gray-900 mb-0.5">Envelope ID</div>
                  <div className="text-sm text-gray-600 font-mono break-all">{sigData.id}</div>
                </div>
                <div>
                  <div className="text-sm font-semibold text-gray-900 mb-0.5">Recipients</div>
                  <div className="text-sm text-gray-600">{allRecipients.map(r => r.full_name || r.email).join(', ')}</div>
                </div>
                <div>
                  <div className="text-sm font-semibold text-gray-900 mb-0.5">Sent</div>
                  <div className="text-sm text-gray-600">{fmt(sigData.created_at)}</div>
                </div>
                <div>
                  <div className="text-sm font-semibold text-gray-900 mb-0.5">Status</div>
                  <div className={`text-sm font-medium ${overallSigned ? 'text-green-600' : 'text-amber-600'}`}>
                    {overallSigned ? 'Completed' : 'Pending'}
                  </div>
                </div>
                <div>
                  <div className="text-sm font-semibold text-gray-900 mb-0.5">Created</div>
                  <div className="text-sm text-gray-600">{fmt(sigData.created_at)}</div>
                </div>
                <div>
                  <div className="text-sm font-semibold text-gray-900 mb-0.5">Status Date</div>
                  <div className="text-sm text-gray-600">{fmt(sigData.updated_at || sigData.created_at)}</div>
                </div>
                <div>
                  <div className="text-sm font-semibold text-gray-900 mb-0.5">Location</div>
                  <div className="text-sm text-gray-600">EasyDrive Canada</div>
                </div>
                <div>
                  <div className="text-sm font-semibold text-gray-900 mb-0.5">Holder</div>
                  <div className="text-sm text-gray-600">{allRecipients[0]?.full_name || allRecipients[0]?.email || '—'}</div>
                </div>
                <div>
                  <div className="text-sm font-semibold text-gray-900 mb-0.5">Time Zone</div>
                  <div className="text-sm text-gray-600">(UTC) Coordinated Universal Time</div>
                </div>
              </div>

              {/* Activities table */}
              <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-5">Activities</h2>
                {rows.length === 0 ? (
                  <div className="flex items-center justify-center py-16 text-gray-400 text-sm border border-dashed border-gray-200 rounded-lg">
                    No activity recorded yet. Send a signature request to start tracking.
                  </div>
                ) : (
                  <div className="w-full border border-gray-200 rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                          <th className="text-left px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wide w-44">Time</th>
                          <th className="text-left px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wide w-48">User</th>
                          <th className="text-left px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wide w-36">Action</th>
                          <th className="text-left px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wide">Activity</th>
                          <th className="text-left px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wide w-28">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((row, i) => (
                          <tr key={i} className="border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors">
                            <td className="px-4 py-3 text-gray-600 align-top whitespace-nowrap">{row.time}</td>
                            <td className="px-4 py-3 align-top">
                              <div className="text-gray-800 font-medium">{row.user}</div>
                              {row.user_email && <div className="text-xs text-gray-400 mt-0.5">{row.user_email}</div>}
                            </td>
                            <td className="px-4 py-3 text-gray-700 align-top">{row.action}</td>
                            <td className="px-4 py-3 text-gray-600 align-top">{row.activity}</td>
                            <td className="px-4 py-3 text-gray-700 align-top">{row.status}</td>
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
      })()}

      {sendModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => { if (!sending) setSendModalOpen(false) }} />
          <div className="relative w-full max-w-sm rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
            {/* Header */}
            <div className="px-6 pt-5 pb-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-0.5">E-Signature</div>
                <div className="text-base font-bold text-slate-800">Send for Signing</div>
              </div>
              <button
                type="button"
                onClick={() => setSendModalOpen(false)}
                disabled={sending}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-40"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
              </button>
            </div>

            {/* Recipient list */}
            <div className="px-6 py-4 space-y-2">
              <p className="text-xs text-slate-500 mb-3">Send signature requests individually or all at once.</p>
              {recipients.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-4">No recipients added yet.</p>
              ) : (
                recipients.map((r, idx) => {
                  const colors = ['bg-blue-500', 'bg-purple-500', 'bg-green-500', 'bg-orange-500', 'bg-pink-500']
                  const color = colors[idx % colors.length]
                  const isSendingThis = sending && sendingTo === r.id
                  return (
                    <div key={r.id} className="flex items-center gap-3 p-2.5 rounded-xl border border-slate-100 bg-slate-50">
                      <div className={`w-8 h-8 rounded-full ${color} flex items-center justify-center text-white text-sm font-bold shrink-0`}>
                        {(r.email || '?').charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-slate-800 truncate">{r.full_name || r.email}</div>
                        {r.full_name && <div className="text-xs text-slate-400 truncate">{r.email}</div>}
                      </div>
                      <button
                        type="button"
                        disabled={sending}
                        onClick={() => executeSend(r.id)}
                        className="h-8 px-3 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 shrink-0 transition-colors"
                      >
                        {isSendingThis ? (
                          <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2a10 10 0 1 0 10 10"/></svg>
                        ) : (
                          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>
                        )}
                        Send
                      </button>
                    </div>
                  )
                })
              )}
            </div>

            {/* Footer — Send All */}
            {recipients.length > 1 && (
              <div className="px-6 pb-5 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  disabled={sending}
                  onClick={() => executeSend(null)}
                  className="w-full h-10 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
                >
                  {sending && sendingTo === 'all' ? (
                    <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2a10 10 0 1 0 10 10"/></svg>
                  ) : (
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>
                  )}
                  Send to All ({recipients.length})
                </button>
              </div>
            )}
            {recipients.length === 1 && (
              <div className="px-6 pb-5 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  disabled={sending}
                  onClick={() => executeSend(null)}
                  className="w-full h-10 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
                >
                  {sending && sendingTo === 'all' ? (
                    <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2a10 10 0 1 0 10 10"/></svg>
                  ) : (
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>
                  )}
                  Send Request
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {deleteRecipientConfirm && (
        <div className="fixed inset-0 z-[101] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => {
              if (addingRecipient) return
              setDeleteRecipientConfirm(null)
            }}
          />
          <div className="relative w-full max-w-sm rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-6 pt-5 pb-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-0.5">E-Signature</div>
                <div className="text-base font-bold text-slate-800">Delete recipient</div>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (addingRecipient) return
                  setDeleteRecipientConfirm(null)
                }}
                disabled={addingRecipient}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-40"
                aria-label="Close"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="px-6 py-5">
              <p className="text-sm text-slate-600">
                Delete recipient{' '}
                <span className="font-semibold text-slate-900">&quot;{deleteRecipientConfirm.label}&quot;</span>?
              </p>
              <p className="text-xs text-slate-500 mt-2">This cannot be undone. Fields assigned only to this recipient will be removed.</p>
            </div>
            <div className="px-6 pb-5 flex gap-3 justify-end border-t border-slate-100 pt-4">
              <button
                type="button"
                disabled={addingRecipient}
                onClick={() => setDeleteRecipientConfirm(null)}
                className="h-10 px-4 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={addingRecipient}
                onClick={() => void executeDeleteRecipient()}
                className="h-10 px-4 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-50 transition-colors inline-flex items-center gap-2"
              >
                {addingRecipient ? (
                  <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 2a10 10 0 1 0 10 10" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 6h18M8 6V4h8v2m-9 0 1 14h8l1-14" />
                  </svg>
                )}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {actionModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setActionModalOpen(false)} />
          <div className="relative w-full max-w-md rounded-xl border border-slate-200 bg-white shadow-2xl p-6">
            <div className={`text-lg font-bold ${actionModalOk ? 'text-green-600' : 'text-red-600'}`}>
              {actionModalTitle}
            </div>
            <div className="mt-2 text-sm text-slate-600 break-words whitespace-pre-wrap">{actionModalMessage}</div>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setActionModalOpen(false)}
                className="h-9 px-6 rounded-full bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {addRecipientModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => {
              if (addingRecipient) return
              setAddRecipientModal(false)
              setEditingRecipientId(null)
              setAddRecipientForm({ email: '', full_name: '', company: '', title: '' })
            }}
          />
          <div className="relative w-full max-w-sm rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
            {/* Header */}
            <div className="px-6 pt-5 pb-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-0.5">
                  {editingRecipientId ? 'Edit Recipient' : `Recipient ${recipients.length + 1}`}
                </div>
                <div className="text-base font-bold text-slate-800">{editingRecipientId ? 'Update Recipient' : 'Add New Recipient'}</div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setAddRecipientModal(false)
                  setEditingRecipientId(null)
                  setAddRecipientForm({ email: '', full_name: '', company: '', title: '' })
                }}
                disabled={addingRecipient}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
              </button>
            </div>

            {/* Form */}
            <div className="px-6 py-5 space-y-4">
              {/* Email */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Email Address</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                  </span>
                  <input
                    type="email"
                    placeholder="recipient@example.com"
                    value={addRecipientForm.email}
                    onChange={e => setAddRecipientForm(f => ({ ...f, email: e.target.value }))}
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Full Name + Company */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Full Name</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="4"/><path d="M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/></svg>
                    </span>
                    <input
                      type="text"
                      placeholder="John Doe"
                      value={addRecipientForm.full_name}
                      onChange={e => setAddRecipientForm(f => ({ ...f, full_name: e.target.value }))}
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Company</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="4" y="2" width="16" height="20" rx="2"/><path d="M9 22v-4h6v4M8 6h.01M16 6h.01M12 6h.01M8 10h.01M16 10h.01M12 10h.01"/></svg>
                    </span>
                    <input
                      type="text"
                      placeholder="Company Name"
                      value={addRecipientForm.company}
                      onChange={e => setAddRecipientForm(f => ({ ...f, company: e.target.value }))}
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>

              {/* Title */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Title / Position</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>
                  </span>
                  <input
                    type="text"
                    placeholder="e.g. Sales Manager"
                    value={addRecipientForm.title}
                    onChange={e => setAddRecipientForm(f => ({ ...f, title: e.target.value }))}
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 pb-5 flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setAddRecipientModal(false)
                  setEditingRecipientId(null)
                  setAddRecipientForm({ email: '', full_name: '', company: '', title: '' })
                }}
                disabled={addingRecipient}
                className="flex-1 h-10 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleUpsertRecipient}
                disabled={addingRecipient || !addRecipientForm.email.trim()}
                className="flex-1 h-10 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                {addingRecipient ? (
                  <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2a10 10 0 1 0 10 10"/></svg>
                ) : (
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14"/></svg>
                )}
                {addingRecipient ? (editingRecipientId ? 'Updating...' : 'Adding...') : (editingRecipientId ? 'Update Recipient' : 'Add Recipient')}
              </button>
            </div>
          </div>
        </div>
      )}

      {downloadModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDownloadModal(false)} />
          <div className="relative w-full max-w-lg rounded-xl border border-slate-200 bg-white shadow-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="text-lg font-bold text-gray-800">Download Files</div>
              <button
                type="button"
                onClick={() => setDownloadModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6 6 18M6 6l12 12"/>
                </svg>
              </button>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-2 font-semibold text-slate-600">#</th>
                  <th className="text-left py-2 font-semibold text-slate-600">File Name</th>
                  <th className="text-right py-2 font-semibold text-slate-600">Action</th>
                </tr>
              </thead>
              <tbody>
                {uploadedFiles.map((file, idx) => (
                  <tr key={idx} className="border-b border-slate-100 last:border-0">
                    <td className="py-3 text-slate-500">{idx + 1}</td>
                    <td className="py-3 text-slate-800 truncate max-w-[260px]">{file.file_name || `Document ${idx + 1}`}</td>
                    <td className="py-3 text-right">
                      <button
                        type="button"
                        disabled={downloadingFileIdx === idx}
                        onClick={() => handleDownloadFile(idx)}
                        className="inline-flex items-center gap-1.5 h-8 px-4 rounded-full bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 disabled:opacity-50"
                      >
                        {downloadingFileIdx === idx ? (
                          <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0"/>
                          </svg>
                        ) : (
                          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>
                          </svg>
                        )}
                        Download
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  )
}
