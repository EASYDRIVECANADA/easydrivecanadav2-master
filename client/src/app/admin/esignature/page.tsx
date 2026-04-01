'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import jsPDF from 'jspdf'

import { renderBillOfSalePdf, type BillOfSaleData } from '../sales/deals/new/billOfSalePdf'
import { supabase } from '@/lib/supabaseClient'

type Document = {
  id: string
  dealId: string
  title: string
  recipient: string
  recipientName: string
  allRecipients?: string[]
  status: 'draft' | 'sent' | 'completed' | 'declined' | 'expired'
  createdDate: string
  lastModified: string
  signers: number
  completedSigners: number
  progressTotal?: number
  progressCompleted?: number
  dealType: string
  state: string
  vehicle: string
}

type EsignFieldType = 'signature' | 'initial' | 'stamp' | 'dateSigned' | 'name' | 'company' | 'title' | 'text' | 'checkbox'
type EsignField = { id: string; type: EsignFieldType; x: number; y: number; width: number; height: number; page: number; value?: string }
type UploadRecipient = { email: string; name: string; company: string; title: string }
type SignatureDocumentFile = {
  file_name: string
  file_type: string
  file_b64?: string
  file_url?: string
}

const createEmptyUploadRecipient = (): UploadRecipient => ({
  email: '',
  name: '',
  company: '',
  title: '',
})

export default function ESignaturePage() {
  const router = useRouter()
  const [view, setView] = useState<'all' | 'sent' | 'completed' | 'drafts'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [sendingRequest, setSendingRequest] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Document | null>(null)
  const [sendModalOpen, setSendModalOpen] = useState(false)
  const [sendTarget, setSendTarget] = useState<Document | null>(null)
  const [sigDataForModal, setSigDataForModal] = useState<any>(null)
  const [loadingModalRecipients, setLoadingModalRecipients] = useState(false)
  const [sendingToRecipient, setSendingToRecipient] = useState<string | null>(null)
  const [sendResultModalOpen, setSendResultModalOpen] = useState(false)
  const [sendResultOk, setSendResultOk] = useState<boolean>(true)
  const [sendResultMessage, setSendResultMessage] = useState('')
  const [recipientModalDoc, setRecipientModalDoc] = useState<Document | null>(null)
  const [downloadFilesCtx, setDownloadFilesCtx] = useState<{
    files: SignatureDocumentFile[]
    sigData: any
    fields: EsignField[]
  } | null>(null)
  const [downloadingFileIdx, setDownloadingFileIdx] = useState<number | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false)
  const [uploadResultOk, setUploadResultOk] = useState(true)
  const [uploadResultMessage, setUploadResultMessage] = useState('')
  const [uploadFiles, setUploadFiles] = useState<File[]>([])
  const [uploadRecipients, setUploadRecipients] = useState<UploadRecipient[]>([createEmptyUploadRecipient()])
  const [activeUploadRecipientIdx, setActiveUploadRecipientIdx] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const esignModalResolverRef = useRef<((value: boolean) => void) | null>(null)
  const [esignModalOpen, setEsignModalOpen] = useState(false)
  const [esignModalTitle, setEsignModalTitle] = useState('')
  const [esignModalBody, setEsignModalBody] = useState('')
  const [esignModalBlocking, setEsignModalBlocking] = useState(true)

  const openEsignModal = (opts: { title: string; body: string; blocking: boolean }) => {
    setEsignModalTitle(opts.title)
    setEsignModalBody(opts.body)
    setEsignModalBlocking(opts.blocking)
    setEsignModalOpen(true)
  }

  const closeEsignModal = () => {
    setEsignModalOpen(false)
    if (esignModalResolverRef.current) {
      esignModalResolverRef.current(false)
      esignModalResolverRef.current = null
    }
  }

  const handleEsignModalContinue = () => {
    setEsignModalOpen(false)
    if (esignModalResolverRef.current) {
      esignModalResolverRef.current(true)
      esignModalResolverRef.current = null
    }
  }

  const confirmEsignChargeIfNeeded = async (senderEmail: string) => {
    try {
      if (!senderEmail) return true
      const res = await fetch('/api/esign/wallet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: senderEmail }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) throw new Error(String(json?.error || 'Unable to check E‑Signature credits'))

      // Premier users get unlimited access - no modals or charges
      if (json?.premier_unlimited === true) {
        return true
      }

      // Handle NULL values from database
      const rawCredits = json?.esign_credits
      const rawBalance = json?.balance
      const credits = rawCredits === null || rawCredits === undefined ? 0 : Number(rawCredits)
      const balance = rawBalance === null || rawBalance === undefined ? 0 : Number(rawBalance)
      const unlimitedUntilRaw = (json as any)?.esign_unlimited_until ?? null
      const safeCredits = Number.isFinite(credits) ? credits : 0
      const safeBalance = Number.isFinite(balance) ? balance : 0

      try {
        const until = unlimitedUntilRaw ? new Date(String(unlimitedUntilRaw)) : null
        if (until && !Number.isNaN(until.getTime()) && until.getTime() > Date.now()) {
          return true
        }
      } catch {
        // ignore
      }

      // If user has credits, allow upload (credit will be deducted after successful upload)
      if (safeCredits > 0) return true

      // If no credits and balance is too low, block
      if (safeBalance < 3) {
        openEsignModal({
          title: 'No E‑Signature Credits',
          body: `You have 0 E‑Signature credits and your Load Balance is too low to upload this document. Please top up your balance or buy the bundle.`,
          blocking: true,
        })
        return false
      }

      // If no credits but sufficient balance, ask for confirmation to charge $3
      return await new Promise<boolean>((resolve) => {
        esignModalResolverRef.current = resolve
        openEsignModal({
          title: 'No E‑Signature Credits',
          body: `You have 0 E‑Signature credits. Uploading this document will charge $3.00 from your Load Balance. Do you want to continue?`,
          blocking: false,
        })
      })
    } catch (e) {
      openEsignModal({
        title: 'E‑Signature Error',
        body: String((e as any)?.message || e || 'Unable to check E‑Signature credits.'),
        blocking: true,
      })
      return false
    }
  }

  const handleUploadClick = async () => {
    try {
      // Get sender email from localStorage
      let senderEmail = ''
      try {
        const raw = typeof window !== 'undefined' ? window.localStorage.getItem('edc_admin_session') : null
        const parsed = raw ? JSON.parse(raw) : null
        senderEmail = String(parsed?.email ?? '').trim().toLowerCase()
      } catch {
        senderEmail = ''
      }

      // Check credits before allowing upload
      const canProceed = await confirmEsignChargeIfNeeded(senderEmail)
      if (!canProceed) return

      setIsModalOpen(true)
    } catch (err: any) {
      console.error('Error checking credits:', err)
    }
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setUploadFiles([])
    setUploadRecipients([createEmptyUploadRecipient()])
    setActiveUploadRecipientIdx(0)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleCloseSuccessModal = () => {
    setIsSuccessModalOpen(false)
    setUploadResultMessage('')
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    setUploadFiles(files)
  }

  const parseUploadRecipients = (values: UploadRecipient[]) => {
    const seen = new Set<string>()
    return values
      .map((recipient) => ({
        email: recipient.email.trim().toLowerCase(),
        name: recipient.name.trim(),
        company: recipient.company.trim(),
        title: recipient.title.trim(),
      }))
      .filter((recipient) => {
        if (!recipient.email) return false
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient.email)) return false
        if (seen.has(recipient.email)) return false
        seen.add(recipient.email)
        return true
      })
  }

  const handleUploadRecipientChange = (index: number, field: keyof UploadRecipient, value: string) => {
    setUploadRecipients((prev) => prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)))
  }

  const handleAddUploadRecipient = () => {
    setUploadRecipients((prev) => {
      const next = [...prev, createEmptyUploadRecipient()]
      setActiveUploadRecipientIdx(next.length - 1)
      return next
    })
  }

  const activeUploadRecipient = uploadRecipients[activeUploadRecipientIdx] ?? uploadRecipients[0]

  const handleRemoveUploadRecipient = (index: number) => {
    setUploadRecipients((prev) => {
      if (prev.length === 1) {
        setActiveUploadRecipientIdx(0)
        return [createEmptyUploadRecipient()]
      }

      const next = prev.filter((_, i) => i !== index)
      setActiveUploadRecipientIdx((curr) => {
        if (curr > index) return curr - 1
        if (curr === index) return Math.max(0, curr - 1)
        return curr
      })
      return next
    })
  }

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result).split(',')[1])
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }

  const handleModalSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    console.log('[ESignature Upload] Submit clicked')
    console.log('[ESignature Upload] Files:', uploadFiles.length)
    console.log('[ESignature Upload] Recipients:', uploadRecipients)
    if (uploadFiles.length === 0) {
      alert('Please select at least one file to upload')
      return
    }
    const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
    const oversizedFiles = uploadFiles.filter(f => f.size > MAX_FILE_SIZE)
    if (oversizedFiles.length > 0) {
      alert(`File too large: "${oversizedFiles[0].name}" is ${(oversizedFiles[0].size / 1024 / 1024).toFixed(1)}MB. Maximum allowed size is 10MB per file.`)
      return
    }
    const parsedRecipients = parseUploadRecipients(uploadRecipients)
    const recipients = parsedRecipients.map((recipient) => recipient.email)
    if (recipients.length === 0) {
      alert('Please enter at least one valid recipient email')
      return
    }
    setUploading(true)
    try {
      const { userId } = await resolveUser()
      if (!userId) {
        alert('Please log in again to upload (missing user ID).')
        return
      }
      const userIdForPayload = userId

      const formData = new FormData()
      uploadFiles.forEach((file) => formData.append('files', file))
      formData.append('recipient_details', JSON.stringify(parsedRecipients))
      formData.append('user_id', userIdForPayload)

      console.log('[ESignature Upload] Sending to API, files:', uploadFiles.length, 'recipients:', parsedRecipients.length)

      const res = await fetch('/api/esignature/signatures', {
        method: 'POST',
        body: formData,
      })

      console.log('[ESignature Upload] API response status:', res.status)
      const uploadJson = await res.json().catch(() => null)
      console.log('[ESignature Upload] API response:', uploadJson)

      if (!res.ok) {
        throw new Error(String(uploadJson?.error || uploadJson?.message || 'Upload failed'))
      }

      const done = Boolean(uploadJson?.success) || Boolean(uploadJson?.done)
      const successCount = Number(uploadJson?.count ?? recipients.length)

      handleCloseModal()

      if (done) {
        setUploadResultOk(true)
        setUploadResultMessage('Saved successfully (Done).')
        setIsSuccessModalOpen(true)

        const queryParam = `user_id=${encodeURIComponent(userIdForPayload)}`
        const docsRes = await fetch(`/api/esignature/signatures?${queryParam}`, { cache: 'no-store' })
        if (docsRes.ok) {
          const json = await docsRes.json()
          if (json.documents) setDocuments(json.documents)
        }

        void (async () => {
        try {
          const raw = typeof window !== 'undefined' ? window.localStorage.getItem('edc_admin_session') : null
          const parsed = raw ? JSON.parse(raw) : null
          const senderEmail = String(parsed?.email ?? '').trim().toLowerCase()

          if (senderEmail) {
            for (let i = 0; i < successCount; i += 1) {
              await fetch('/api/esign/deduct-credit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: senderEmail }),
              })
            }
          }
        } catch (err) {
          console.error('Failed to deduct credit:', err)
        }
        })()
      } else {
        setUploadResultOk(false)
        setUploadResultMessage(uploadJson?.error || 'Upload failed. Please try again.')
        setIsSuccessModalOpen(true)
      }
    } catch (err: any) {
      handleCloseModal()
      setUploadResultOk(false)
      setUploadResultMessage(err?.message || 'Unknown error')
      setIsSuccessModalOpen(true)
    } finally {
      setUploading(false)
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

  const persistUserSession = (userId: string, email?: string) => {
    if (typeof window === 'undefined' || !userId) return
    try {
      const raw = window.localStorage.getItem('edc_admin_session')
      const parsed = raw ? JSON.parse(raw) : {}
      const next = {
        ...parsed,
        user_id: userId,
        email: parsed?.email || email || '',
      }
      window.localStorage.setItem('edc_admin_session', JSON.stringify(next))
      window.dispatchEvent(new Event('edc_admin_session_changed'))
    } catch {
      // ignore
    }
  }

  const resolveUser = async (): Promise<{ userId: string; email: string }> => {
    // Require user_id; include email only as metadata.
    try {
      const { data } = await supabase.auth.getSession()
      const authId = String(data.session?.user?.id ?? '').trim()
      const authEmail = String(data.session?.user?.email ?? '').trim().toLowerCase()
      if (authId) {
        persistUserSession(authId, authEmail)
        return { userId: authId, email: authEmail }
      }
    } catch {
      // ignore
    }

    let storedId = ''
    let storedEmail = ''
    try {
      const raw = typeof window !== 'undefined' ? window.localStorage.getItem('edc_admin_session') : null
      const parsed = raw ? JSON.parse(raw) : null
      storedId = String(parsed?.user_id ?? '').trim()
      storedEmail = String(parsed?.email ?? '').trim().toLowerCase()
      if (storedId) return { userId: storedId, email: storedEmail }
    } catch {
      // ignore
    }

    // Fallback: resolve user_id from users table by email
    if (storedEmail) {
      try {
        const { data: userRow } = await supabase
          .from('users')
          .select('user_id')
          .eq('email', storedEmail)
          .limit(1)
          .maybeSingle()
        const resolvedId = String((userRow as any)?.user_id ?? '').trim()
        if (resolvedId) {
          persistUserSession(resolvedId, storedEmail)
          return { userId: resolvedId, email: storedEmail }
        }
      } catch {
        // ignore
      }
    }

    return { userId: '', email: storedEmail }
  }

  useEffect(() => {
    const fetchDocuments = async () => {
      try {
        setLoading(true)
        setError(null)

        const { userId, email } = await resolveUser()

        if (!userId) {
          setError('Please log in to view signature documents')
          setLoading(false)
          return
        }

        const queryParam = `user_id=${encodeURIComponent(userId)}`
        console.log('[Page] Fetching signatures with', { userId, email })

        const res = await fetch(`/api/esignature/signatures?${queryParam}`, { cache: 'no-store' })
        console.log('[Page] API response status:', res.status)
        
        if (!res.ok) {
          const errorText = await res.text().catch(() => '')
          console.error('[Page] API error response:', errorText)
          throw new Error(`Failed to load signature documents (${res.status})`)
        }
        const json = await res.json()
        console.log('[Page] API response json:', json)
        
        if (json.error) throw new Error(json.error)
        console.log('[Page] Setting documents:', json.documents?.length || 0)
        setDocuments(json.documents || [])
      } catch (e: any) {
        console.error('[Page] Error fetching:', e)
        setError(e?.message || 'Failed to load signature documents')
        setDocuments([]) // Clear old data on error
      } finally {
        setLoading(false)
      }
    }

    void fetchDocuments()
  }, [])

  const handleSendSignatureRequest = async (doc: Document) => {
    if (!doc.recipient) {
      setSendResultOk(false)
      setSendResultMessage('No recipient email found for this document')
      setSendResultModalOpen(true)
      return
    }
    setSendTarget(doc)
    setSigDataForModal(null)
    setSendModalOpen(true)
    // Fetch sig data to populate per-recipient list
    setLoadingModalRecipients(true)
    try {
      const sigRes = await fetch(`/api/esignature/signature/${encodeURIComponent(doc.id)}`, { cache: 'no-store' })
      if (sigRes.ok) {
        const sigData = await sigRes.json()
        setSigDataForModal(sigData)
      }
    } catch { /* show modal anyway */ }
    setLoadingModalRecipients(false)
  }

  // recipientId = specific recipient to send to; null = send to all
  const handleConfirmSendRequest = async (recipientId: string | null = null) => {
    if (!sendTarget) return
    const doc = sendTarget

    setSendingRequest(doc.id)
    setSendingToRecipient(recipientId ?? 'all')
    try {
      const sigData = sigDataForModal || (() => { throw new Error('No document data loaded') })()
      if (!sigData.document_file) throw new Error('No document file found in signature record')

      const appOrigin = 'https://easydrivecanada.com'

      const getDocumentUrl = (raw: string): string => {
        try {
          const parsed = JSON.parse(raw)
          const first = Array.isArray(parsed) ? parsed[0] : parsed
          return first?.url || first?.file_url || first?.file_b64 || ''
        } catch { return raw }
      }
      const documentUrl = getDocumentUrl(sigData.document_file)

      const siblings: any[] = sigData.siblings || []
      const allRecipients = [
        { id: sigData.id, email: sigData.email, full_name: sigData.full_name },
        ...siblings.map((s: any) => ({ id: s.id, email: s.email, full_name: s.full_name })),
      ]

      const targets = recipientId
        ? allRecipients.filter(r => r.id === recipientId)
        : allRecipients

      if (targets.length === 0) throw new Error('Recipient not found')

      const sendErrors: string[] = []
      for (const recipient of targets) {
        const signingLink = `${appOrigin}/admin/sales/deals/signature?${encodeURIComponent(recipient.id)}`
        const sendRes = await fetch('https://primary-production-6722.up.railway.app/webhook/request', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: recipient.full_name || recipient.email || '', email: recipient.email || '', link: signingLink, document_url: documentUrl }),
        })
        if (!sendRes.ok) {
          const t = await sendRes.text().catch(() => '')
          sendErrors.push(`${recipient.email}: ${t || sendRes.status}`)
        }
      }

      if (sendErrors.length > 0) throw new Error(`Some requests failed: ${sendErrors.join('; ')}`)

      setSendResultOk(true)
      setSendResultMessage(`Signature request sent to ${targets.length} recipient(s).`)
      setSendModalOpen(false)
      setSendTarget(null)
      setSigDataForModal(null)
      setSendResultModalOpen(true)
    } catch (e: any) {
      setSendResultOk(false)
      setSendResultMessage(`Failed to send signature request: ${e?.message || 'Unknown error'}`)
      setSendResultModalOpen(true)
    } finally {
      setSendingRequest(null)
      setSendingToRecipient(null)
    }
  }

  // Core PDF renderer for a single file entry
  const performFileDownload = async (
    fileEntry: SignatureDocumentFile,
    sigData: any,
    fields: EsignField[],
    fileIndex = 0
  ) => {
    const pdfjsLib = await loadPdfJs()

    let b64 = String(fileEntry.file_b64 || '').trim()
    const fileUrl = (fileEntry as any).url || fileEntry.file_url || ''
    if (!b64 && fileUrl) {
      const fileRes = await fetch(fileUrl, { cache: 'no-store' })
      if (!fileRes.ok) throw new Error(`Unable to fetch file: ${fileEntry.file_name || 'document'}`)
      const ab = await fileRes.arrayBuffer()
      b64 = arrayBufferToBase64(ab)
    }

    if (!b64) {
      throw new Error(`Missing file content for ${fileEntry.file_name || 'document'}`)
    }

    if (b64.startsWith('data:')) {
      b64 = b64.includes(',') ? b64.split(',')[1] : ''
    }

    const PAGE_WIDTH = 816
    const PAGE_HEIGHT = 1056
    const PDF_RENDER_QUALITY = 4
    const pdfDoc = await pdfjsLib.getDocument({ data: atob(b64) }).promise
    const numPages = pdfDoc.numPages
    const pageImages: string[] = []
    for (let i = 1; i <= numPages; i++) {
      const page = await pdfDoc.getPage(i)
      const unscaledViewport = page.getViewport({ scale: 1 })
      const scaleToWidth = PAGE_WIDTH / unscaledViewport.width
      const viewport = page.getViewport({ scale: scaleToWidth * PDF_RENDER_QUALITY })
      const canvas = document.createElement('canvas')
      canvas.width = viewport.width
      canvas.height = viewport.height
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        await page.render({ canvasContext: ctx, viewport }).promise
        pageImages.push(canvas.toDataURL('image/png'))
      }
    }
    if (pageImages.length === 0) throw new Error('Failed to render PDF pages')
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' })
    const pdfW = pdf.internal.pageSize.getWidth()
    const pdfH = pdf.internal.pageSize.getHeight()
    for (let i = 0; i < pageImages.length; i++) {
      if (i > 0) pdf.addPage()
      pdf.addImage(pageImages[i], 'PNG', 0, 0, pdfW, pdfH)
    }
    // Build per-recipient array: primary first, then siblings
    const recipients: any[] = [
      sigData,
      ...((sigData?.siblings as any[]) || []),
    ]

    const signedDate = (() => {
      const raw = String(sigData?.signed_at ?? sigData?.updated_at ?? sigData?.created_at ?? '').trim()
      if (!raw) return ''
      try { const d = new Date(raw); return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-CA') } catch { return '' }
    })()
    const xScale = pdfW / PAGE_WIDTH
    const yScale = pdfH / PAGE_HEIGHT
    const fileFields = fields.filter(f => (f as any).fileIndex === undefined ? fileIndex === 0 : (f as any).fileIndex === fileIndex)
    fileFields.forEach(field => {
      const recipIdx = (field as any).recipientIndex ?? 0
      const recip = recipients[recipIdx] ?? recipients[0] ?? sigData
      const fullName = String(recip?.full_name ?? '').trim()
      const initials = fullName ? fullName.split(' ').map((n: string) => n[0]).join('').toUpperCase() : ''
      const rawSig = String(recip?.signature_image ?? '').trim()
      const signature = rawSig
        ? (rawSig.startsWith('data:') || rawSig.startsWith('http') ? rawSig : `data:image/png;base64,${rawSig}`)
        : ''
      const company = String(recip?.company ?? '').trim()
      const title = String(recip?.title ?? '').trim()

      const pageNum = Math.min(Math.max(field.page || 1, 1), pdf.getNumberOfPages())
      pdf.setPage(pageNum)
      const x = field.x * xScale; const y = field.y * yScale
      const w = field.width * xScale; const h = field.height * yScale
      try {
        switch (field.type) {
          case 'signature':
            if (signature) { pdf.addImage(signature, 'PNG', x, y, w, h) }
            break
          case 'initial':
            if (initials) { pdf.setTextColor(29,78,216); pdf.setFontSize(14); pdf.setFont('helvetica','bold'); pdf.text(initials,x+w/2,y+h/2,{align:'center',baseline:'middle'}); pdf.setFont('helvetica','normal') }
            break
          case 'stamp':
            pdf.setDrawColor(220,38,38); pdf.setTextColor(220,38,38)
            pdf.circle(x+w/2,y+h/2,Math.max(Math.min(w,h)/2-2,2),'S'); pdf.circle(x+w/2,y+h/2,Math.max(Math.min(w,h)/2-8,1),'S')
            pdf.setFontSize(12); pdf.setFont('helvetica','bold'); pdf.text('APPROVED',x+w/2,y+h/2-5,{align:'center'})
            pdf.setFontSize(9); pdf.setFont('helvetica','normal'); pdf.text(new Date().toLocaleDateString('en-CA'),x+w/2,y+h/2+8,{align:'center'})
            break
          case 'dateSigned':
            if (signedDate) { pdf.setTextColor(55,65,81); pdf.setFontSize(10); pdf.text(signedDate,x+w/2,y+h/2,{align:'center',baseline:'middle'}) }
            break
          case 'name':
            pdf.setTextColor(17,24,39); pdf.setFontSize(10)
            if (fullName) pdf.text(fullName,x+5,y+h/2,{baseline:'middle'})
            else if (field.value) pdf.text(String(field.value),x+5,y+h/2,{baseline:'middle'})
            break
          case 'company':
            pdf.setTextColor(55,65,81); pdf.setFontSize(10)
            if (company) pdf.text(company,x+5,y+h/2,{baseline:'middle'})
            else if (field.value) pdf.text(String(field.value),x+5,y+h/2,{baseline:'middle'})
            break
          case 'title':
            pdf.setTextColor(55,65,81); pdf.setFontSize(10)
            if (title) pdf.text(title,x+5,y+h/2,{baseline:'middle'})
            else if (field.value) pdf.text(String(field.value),x+5,y+h/2,{baseline:'middle'})
            break
          case 'text':
            pdf.setTextColor(55,65,81); pdf.setFontSize(10)
            if (field.value) pdf.text(String(field.value),x+5,y+h/2,{baseline:'middle'})
            break
          case 'checkbox':
            pdf.setDrawColor(37,99,235); pdf.roundedRect(x+w/2-7.5,y+h/2-7.5,15,15,2,2,'S')
            if (['true','1','yes'].includes(String(field.value??'').toLowerCase())) { pdf.setTextColor(37,99,235); pdf.setFontSize(12); pdf.text('✓',x+w/2,y+h/2+1,{align:'center',baseline:'middle'}) }
            break
        }
      } catch (err) { console.error('Field render error:', field.id, err) }
    })
    const safeName = (fileEntry.file_name || 'document').replace(/[^a-z0-9._-]/gi, '_')
    pdf.save(safeName.endsWith('.pdf') ? safeName : `${safeName}.pdf`)
  }

  const handleDownloadDocument = async (doc: Document) => {
    if (typeof window === 'undefined') return
    try {
      const sigRes = await fetch(`/api/esignature/signature/${encodeURIComponent(doc.id)}`, { cache: 'no-store' })
      if (!sigRes.ok) throw new Error('Failed to load signature record')
      const sigData = await sigRes.json()
      if (!sigData?.document_file) throw new Error('No document file found')

      const fieldsRes = await fetch(`/api/esignature/fields?dealId=${encodeURIComponent(doc.id)}`, { cache: 'no-store' })
      const fieldsJson = fieldsRes.ok ? await fieldsRes.json().catch(() => null) : null
      const fields: EsignField[] = Array.isArray(fieldsJson?.fields) ? fieldsJson.fields : []

      // Parse document_file: may be JSON array, JSON object, or plain base64
      const rawDoc = String(sigData.document_file || '').trim()
      let fileList: SignatureDocumentFile[] = []
      if (rawDoc.startsWith('[')) {
        try { const p = JSON.parse(rawDoc); if (Array.isArray(p) && p.length > 0) fileList = p } catch {}
      } else if (rawDoc.startsWith('{')) {
        try { const p = JSON.parse(rawDoc); if (p?.file_b64 || p?.file_url) fileList = [p] } catch {}
      }
      if (fileList.length === 0) {
        fileList = [{ file_name: doc.title || 'document.pdf', file_type: 'application/pdf', file_b64: rawDoc }]
      }

      if (fileList.length === 1) {
        await performFileDownload(fileList[0], sigData, fields, 0)
      } else {
        setDownloadFilesCtx({ files: fileList, sigData, fields })
      }
    } catch (err: any) {
      console.error('Download error:', err)
      alert(`Download failed: ${err?.message || 'Unknown error'}`)
    }
  }

  // Helper to load PDF.js dynamically
  const loadPdfJs = async (): Promise<any> => {
    if ((window as any).pdfjsLib) return (window as any).pdfjsLib
    return new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'
      script.onload = () => {
        const lib = (window as any).pdfjsLib
        lib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
        resolve(lib)
      }
      script.onerror = () => reject(new Error('Failed to load PDF.js'))
      document.head.appendChild(script)
    })
  }

  const handleEditDeal = (dealId: string) => {
    router.push(`/admin/esignature/prepare/${encodeURIComponent(dealId)}`)
  }

  const handleDeleteDocument = async (doc: Document) => {
    setDeleteTarget(doc)
    setDeleteModalOpen(true)
  }

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return

    setDeletingId(deleteTarget.id)
    try {
      const res = await fetch(`/api/esignature/signature/${encodeURIComponent(deleteTarget.id)}/delete`, {
        method: 'DELETE',
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `Failed to delete (${res.status})`)
      }

      setDocuments((prev) => prev.filter((d) => d.id !== deleteTarget.id))
      setDeleteModalOpen(false)
      setDeleteTarget(null)
    } catch (err: any) {
      alert(`Failed to delete document: ${err?.message || 'Unknown error'}`)
    } finally {
      setDeletingId(null)
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
              <p className="text-sm text-slate-500">Unable to load documents. Please check your connection and try refreshing.</p>
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
            <div className="overflow-x-hidden">
              <table className="w-full table-fixed">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-4 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider w-[30%]">Document</th>
                    <th className="px-4 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider w-[22%]">Recipient</th>
                    <th className="px-4 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider w-[12%]">Status</th>
                    <th className="px-4 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider w-[12%]">Progress</th>
                    <th className="px-4 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider w-[10%]">Created</th>
                    <th className="px-4 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider w-[10%]">Last Modified</th>
                    <th className="px-4 py-4 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider w-[180px]">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredDocuments.map((doc) => (
                    <tr key={doc.id} className="hover:bg-slate-50 transition-colors group">
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-slate-900 truncate">{doc.title}</p>
                            <p className="text-xs text-slate-500 mt-0.5 truncate">ID: {doc.id}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <button
                          type="button"
                          onClick={() => { if ((doc.allRecipients?.length ?? 0) > 0) setRecipientModalDoc(doc) }}
                          className="flex items-center gap-2 min-w-0 text-left hover:opacity-80 transition-opacity"
                          title={(doc.allRecipients?.length ?? 0) > 1 ? `${doc.allRecipients!.length} recipients — click to view all` : doc.recipient}
                        >
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white text-xs font-semibold shrink-0">
                            {doc.recipient.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <span className="text-sm text-slate-700 truncate block">{doc.recipient}</span>
                            {(doc.allRecipients?.length ?? 0) > 1 && (
                              <span className="text-xs text-blue-500 font-medium">+{doc.allRecipients!.length - 1} more</span>
                            )}
                          </div>
                        </button>
                      </td>
                      <td className="px-4 py-4">{getStatusBadge(doc.status)}</td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-slate-200 rounded-full h-2 max-w-[100px]">
                            <div
                              className={`h-2 rounded-full ${doc.status === 'completed' ? 'bg-green-500' : doc.status === 'sent' ? 'bg-blue-500' : 'bg-slate-400'}`}
                              style={{ width: `${((typeof doc.progressCompleted === 'number' && typeof doc.progressTotal === 'number' && doc.progressTotal > 0)
                                ? (doc.progressCompleted / doc.progressTotal)
                                : (doc.completedSigners / doc.signers)) * 100}%` }}
                            />
                          </div>
                          <span className="text-xs text-slate-600 whitespace-nowrap">
                            {(typeof doc.progressCompleted === 'number' && typeof doc.progressTotal === 'number')
                              ? `${doc.progressCompleted}/${doc.progressTotal}`
                              : `${doc.completedSigners}/${doc.signers}`}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-600 whitespace-nowrap">{formatDate(doc.createdDate)}</td>
                      <td className="px-4 py-4 text-sm text-slate-600 whitespace-nowrap">{formatDate(doc.lastModified)}</td>
                      <td className="px-4 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handleEditDeal(doc.id)}
                            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Edit Document"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSendSignatureRequest(doc)}
                            disabled={sendingRequest === doc.id}
                            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            title={sendingRequest === doc.id ? 'Sending...' : 'Send Signature Request'}
                          >
                            {sendingRequest === doc.id ? (
                              <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V2C6.477 2 2 6.477 2 12h2z" />
                              </svg>
                            ) : (
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
                              </svg>
                            )}
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
                          <button
                            type="button"
                            onClick={() => handleDeleteDocument(doc)}
                            disabled={deletingId === doc.id}
                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            title={deletingId === doc.id ? 'Deleting...' : 'Delete Document'}
                          >
                            {deletingId === doc.id ? (
                              <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V2C6.477 2 2 6.477 2 12h2z" />
                              </svg>
                            ) : (
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            )}
                          </button>
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

      {/* Upload Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={handleCloseModal} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-500 px-6 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-white">Upload Document</h2>
                  <p className="text-blue-100 text-sm mt-0.5">Add a new document for e-signature</p>
                </div>
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleModalSubmit} className="p-6 space-y-5 max-h-[calc(90vh-96px)] overflow-y-auto">
              {/* File Upload */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Document File</label>
                <div className="relative">
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                    onChange={handleFileSelect}
                    className="hidden"
                    id="file-upload"
                  />
                  <label
                    htmlFor="file-upload"
                    className="flex items-center justify-center gap-3 w-full px-4 py-4 border-2 border-dashed border-slate-300 rounded-xl hover:border-blue-400 hover:bg-blue-50/50 transition-all cursor-pointer group"
                  >
                    <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                      <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-medium text-slate-700">
                        {uploadFiles.length > 0
                          ? `${uploadFiles.length} file${uploadFiles.length > 1 ? 's' : ''} selected`
                          : 'Click to upload file(s)'}
                      </p>
                      <p className="text-xs text-slate-500">PDF, DOC, DOCX, PNG, JPG up to 10MB each</p>
                    </div>
                  </label>
                </div>
                {uploadFiles.length > 0 ? (
                  <div className="mt-2 space-y-1 max-h-24 overflow-auto text-xs text-slate-500">
                    {uploadFiles.map((file) => (
                      <div key={`${file.name}-${file.size}-${file.lastModified}`} className="truncate">
                        {file.name}
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>

              {/* Recipients */}
              <div>
                <div className="flex items-center justify-between gap-3 mb-2">
                  <label className="block text-sm font-semibold text-slate-700">Recipients</label>
                  <button
                    type="button"
                    onClick={handleAddUploadRecipient}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-blue-200 text-blue-600 text-xs font-semibold hover:bg-blue-50 transition-colors"
                  >
                    <span className="text-sm leading-none">+</span>
                    Add recipient
                  </button>
                </div>
                <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-3">
                  {uploadRecipients.map((_, index) => {
                    const isActive = index === activeUploadRecipientIdx
                    return (
                      <button
                        key={`recipient-tab-${index}`}
                        type="button"
                        onClick={() => setActiveUploadRecipientIdx(index)}
                        className={`whitespace-nowrap px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                          isActive
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        Recipient {index + 1}
                      </button>
                    )
                  })}
                </div>

                {activeUploadRecipient ? (
                  <div className="rounded-xl border border-slate-200 p-3 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Recipient {activeUploadRecipientIdx + 1}</div>
                      <button
                        type="button"
                        onClick={() => handleRemoveUploadRecipient(activeUploadRecipientIdx)}
                        disabled={uploadRecipients.length === 1}
                        className="h-8 px-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-xs"
                      >
                        Remove
                      </button>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">Email Address</label>
                      <div className="relative">
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                          </svg>
                        </div>
                        <input
                          type="email"
                          value={activeUploadRecipient.email}
                          onChange={(e) => handleUploadRecipientChange(activeUploadRecipientIdx, 'email', e.target.value)}
                          placeholder={`recipient${activeUploadRecipientIdx + 1}@example.com`}
                          className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                          required
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">Full Name</label>
                        <div className="relative">
                          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                          </div>
                          <input
                            type="text"
                            value={activeUploadRecipient.name}
                            onChange={(e) => handleUploadRecipientChange(activeUploadRecipientIdx, 'name', e.target.value)}
                            placeholder="John Doe"
                            className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                            required
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">Company</label>
                        <div className="relative">
                          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                            </svg>
                          </div>
                          <input
                            type="text"
                            value={activeUploadRecipient.company}
                            onChange={(e) => handleUploadRecipientChange(activeUploadRecipientIdx, 'company', e.target.value)}
                            placeholder="Company Name"
                            className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                          />
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">Title / Position</label>
                      <div className="relative">
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <input
                          type="text"
                          value={activeUploadRecipient.title}
                          onChange={(e) => handleUploadRecipientChange(activeUploadRecipientIdx, 'title', e.target.value)}
                          placeholder="e.g. Sales Manager"
                          className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                        />
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="flex-1 px-4 py-3 border border-slate-200 text-slate-700 font-medium rounded-xl hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploading || uploadFiles.length === 0}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-600 to-blue-500 text-white font-medium rounded-xl shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:scale-[1.02] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                >
                  {uploading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Uploading...
                    </span>
                  ) : (
                    'Upload Document(s)'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {sendModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => {
              if (sendingRequest) return
              setSendModalOpen(false)
              setSendTarget(null)
              setSigDataForModal(null)
            }}
          />
          <div className="relative w-full max-w-sm rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
            {/* Header */}
            <div className="px-6 pt-5 pb-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-0.5">E-Signature</div>
                <div className="text-base font-bold text-slate-800">Send for Signing</div>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (sendingRequest) return
                  setSendModalOpen(false)
                  setSendTarget(null)
                  setSigDataForModal(null)
                }}
                disabled={!!sendingRequest}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-40"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
              </button>
            </div>

            {/* Recipient list */}
            <div className="px-6 py-4 space-y-2">
              <p className="text-xs text-slate-500 mb-3">Send signature requests individually or all at once.</p>
              {loadingModalRecipients ? (
                <div className="flex items-center justify-center py-6">
                  <svg className="w-5 h-5 animate-spin text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2a10 10 0 1 0 10 10"/></svg>
                </div>
              ) : sigDataForModal ? (() => {
                const recipientColors = ['bg-blue-500', 'bg-purple-500', 'bg-green-500', 'bg-orange-500', 'bg-pink-500']
                const modalRecipients = [
                  { id: sigDataForModal.id, email: sigDataForModal.email, full_name: sigDataForModal.full_name },
                  ...((sigDataForModal.siblings as any[]) || []).map((s: any) => ({ id: s.id, email: s.email, full_name: s.full_name })),
                ]
                return (
                  <>
                    {modalRecipients.map((r, idx) => {
                      const color = recipientColors[idx % recipientColors.length]
                      const isSendingThis = !!sendingRequest && sendingToRecipient === r.id
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
                            disabled={!!sendingRequest}
                            onClick={() => handleConfirmSendRequest(r.id)}
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
                    })}
                  </>
                )
              })() : (
                // Fallback: show just the primary recipient if sig data failed to load
                <div className="flex items-center gap-3 p-2.5 rounded-xl border border-slate-100 bg-slate-50">
                  <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-sm font-bold shrink-0">
                    {(sendTarget?.recipient || '?').charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-slate-800 truncate">{sendTarget?.recipientName || sendTarget?.recipient}</div>
                    {sendTarget?.recipientName && <div className="text-xs text-slate-400 truncate">{sendTarget.recipient}</div>}
                  </div>
                </div>
              )}
            </div>

            {/* Footer — Send All */}
            <div className="px-6 pb-5 pt-2 border-t border-slate-100">
              {(() => {
                const modalRecipients = sigDataForModal
                  ? [sigDataForModal, ...((sigDataForModal.siblings as any[]) || [])]
                  : []
                const isSendingAll = !!sendingRequest && sendingToRecipient === 'all'
                const label = modalRecipients.length > 1 ? `Send to All (${modalRecipients.length})` : 'Send Request'
                return (
                  <button
                    type="button"
                    disabled={!!sendingRequest || loadingModalRecipients}
                    onClick={() => handleConfirmSendRequest(null)}
                    className="w-full h-10 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
                  >
                    {isSendingAll ? (
                      <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2a10 10 0 1 0 10 10"/></svg>
                    ) : (
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>
                    )}
                    {label}
                  </button>
                )
              })()}
            </div>
          </div>
        </div>
      )}

      {sendResultModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSendResultModalOpen(false)} />
          <div className="relative w-full max-w-md rounded-xl border border-slate-200 bg-white shadow-2xl p-6">
            <div className={`text-lg font-bold ${sendResultOk ? 'text-green-600' : 'text-red-600'}`}>
              {sendResultOk ? '✓ Success' : '✗ Error'}
            </div>
            <div className="mt-2 text-sm text-slate-600 break-words whitespace-pre-wrap">{sendResultMessage}</div>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setSendResultModalOpen(false)}
                className="h-9 px-6 rounded-full bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {recipientModalDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setRecipientModalDoc(null)} />
          <div className="relative w-full max-w-sm rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200">
              <div className="text-base font-bold text-slate-900">Recipients</div>
              <div className="mt-0.5 text-xs text-slate-500 truncate">{recipientModalDoc.title}</div>
            </div>
            <div className="px-6 py-4 space-y-2 max-h-72 overflow-auto">
              {(recipientModalDoc.allRecipients && recipientModalDoc.allRecipients.length > 0
                ? recipientModalDoc.allRecipients
                : [recipientModalDoc.recipient]
              ).map((email, idx) => (
                <div key={`recip-${idx}`} className="flex items-center gap-3 py-2 border-b border-slate-100 last:border-0">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white text-xs font-semibold shrink-0">
                    {email.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-sm text-slate-700 break-all">{email}</span>
                </div>
              ))}
            </div>
            <div className="px-6 py-4 flex justify-end border-t border-slate-100">
              <button
                type="button"
                onClick={() => setRecipientModalDoc(null)}
                className="h-9 px-6 rounded-full bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => {
              if (deletingId) return
              setDeleteModalOpen(false)
              setDeleteTarget(null)
            }}
          />
          <div className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200">
              <div className="text-lg font-bold text-slate-900">Delete document?</div>
              <div className="mt-1 text-sm text-slate-600 break-words">
                Are you sure you want to delete <span className="font-semibold">{deleteTarget?.title || 'this document'}</span>? This action cannot be undone.
              </div>
            </div>
            <div className="px-6 py-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  if (deletingId) return
                  setDeleteModalOpen(false)
                  setDeleteTarget(null)
                }}
                disabled={!!deletingId}
                className="h-10 px-4 rounded-lg bg-slate-100 text-slate-700 text-sm font-semibold hover:bg-slate-200 border border-slate-200 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={!!deletingId}
                className="h-10 px-5 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {deletingId ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upload Result Modal */}
      {isSuccessModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 text-center">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${uploadResultOk ? 'bg-green-100' : 'bg-red-100'}`}>
              {uploadResultOk ? (
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
            </div>
            <h3 className={`text-lg font-bold mb-2 ${uploadResultOk ? 'text-slate-900' : 'text-red-700'}`}>
              {uploadResultOk ? 'Successfully Saved' : 'Unsuccessful Save'}
            </h3>
            <p className="text-sm text-slate-500 mb-6">{uploadResultMessage || (uploadResultOk ? 'Done' : 'Webhook did not return Done.')}</p>
            <button
              type="button"
              onClick={handleCloseSuccessModal}
              className={`w-full px-4 py-3 text-white font-medium rounded-xl transition-all ${uploadResultOk ? 'bg-gradient-to-r from-green-600 to-green-500 shadow-lg shadow-green-500/25 hover:shadow-green-500/40 hover:scale-[1.02]' : 'bg-gradient-to-r from-red-600 to-red-500 shadow-lg shadow-red-500/25 hover:shadow-red-500/40 hover:scale-[1.02]'}`}
            >
              OK
            </button>
          </div>
        </div>
      )}

      {/* E-Signature Credit Check Modal */}
      {esignModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200">
              <h3 className="text-lg font-bold text-slate-900">{esignModalTitle}</h3>
            </div>
            <div className="px-6 py-5">
              <p className="text-sm text-slate-600 leading-relaxed">{esignModalBody}</p>
            </div>
            <div className="px-6 py-4 bg-slate-50 flex items-center justify-end gap-3">
              {!esignModalBlocking && (
                <button
                  type="button"
                  onClick={closeEsignModal}
                  className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
              )}
              <button
                type="button"
                onClick={esignModalBlocking ? closeEsignModal : handleEsignModalContinue}
                className="px-5 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
              >
                {esignModalBlocking ? 'OK' : 'Continue'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Download files picker modal — shown when document has multiple files */}
      {downloadFilesCtx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => { setDownloadFilesCtx(null); setDownloadingFileIdx(null) }} />
          <div className="relative w-full max-w-sm rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200">
              <div className="text-base font-bold text-slate-900">Select file to download</div>
              <div className="mt-0.5 text-xs text-slate-500">This document has {downloadFilesCtx.files.length} files</div>
            </div>
            <div className="px-6 py-4 space-y-2 max-h-72 overflow-auto">
              {downloadFilesCtx.files.map((file, idx) => (
                <div key={`dl-file-${idx}`} className="flex items-center justify-between gap-3 py-2 border-b border-slate-100 last:border-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <svg className="w-5 h-5 text-blue-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span className="text-sm text-slate-700 truncate">{file.file_name || `File ${idx + 1}`}</span>
                  </div>
                  <button
                    type="button"
                    disabled={downloadingFileIdx === idx}
                    onClick={async () => {
                      setDownloadingFileIdx(idx)
                      try {
                        await performFileDownload(file, downloadFilesCtx.sigData, downloadFilesCtx.fields, idx)
                      } catch (err: any) {
                        alert(`Download failed: ${err?.message || 'Unknown error'}`)
                      } finally {
                        setDownloadingFileIdx(null)
                      }
                    }}
                    className="shrink-0 h-8 px-3 rounded-lg bg-green-600 text-white text-xs font-semibold hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
                  >
                    {downloadingFileIdx === idx ? (
                      <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                    ) : (
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
                    )}
                    {downloadingFileIdx === idx ? 'Downloading...' : 'Download'}
                  </button>
                </div>
              ))}
            </div>
            <div className="px-6 py-4 flex justify-end border-t border-slate-100">
              <button
                type="button"
                onClick={() => { setDownloadFilesCtx(null); setDownloadingFileIdx(null) }}
                className="h-9 px-6 rounded-full bg-slate-100 text-slate-700 text-sm font-semibold hover:bg-slate-200"
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
