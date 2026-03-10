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
  progressTotal?: number
  progressCompleted?: number
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
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadEmail, setUploadEmail] = useState('')
  const [uploadName, setUploadName] = useState('')
  const [uploadCompany, setUploadCompany] = useState('')
  const [uploadTitle, setUploadTitle] = useState('')
  const [uploadSignature, setUploadSignature] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const signatureInputRef = useRef<HTMLInputElement>(null)

  const handleUploadClick = () => {
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setUploadFile(null)
    setUploadEmail('')
    setUploadName('')
    setUploadCompany('')
    setUploadTitle('')
    setUploadSignature(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
    if (signatureInputRef.current) signatureInputRef.current.value = ''
  }

  const handleCloseSuccessModal = () => {
    setIsSuccessModalOpen(false)
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) setUploadFile(file)
  }

  const handleSignatureFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) setUploadSignature(file)
  }

  const clearSignature = () => {
    setUploadSignature(null)
    if (signatureInputRef.current) signatureInputRef.current.value = ''
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
    if (!uploadFile) {
      alert('Please select a file to upload')
      return
    }
    setUploading(true)
    try {
      // Get user_id from localStorage
      let userId = ''
      try {
        const raw = typeof window !== 'undefined' ? window.localStorage.getItem('edc_admin_session') : null
        const parsed = raw ? JSON.parse(raw) : null
        userId = String(parsed?.user_id ?? '').trim()
      } catch {
        userId = ''
      }

      // Convert files to base64
      const fileB64 = await fileToBase64(uploadFile)
      const signatureB64 = uploadSignature ? await fileToBase64(uploadSignature) : ''

      const payload = {
        file_name: uploadFile.name,
        file_type: uploadFile.type,
        file_b64: fileB64,
        signature_name: uploadSignature?.name || '',
        signature_type: uploadSignature?.type || '',
        signature_b64: signatureB64,
        email: uploadEmail,
        name: uploadName,
        company: uploadCompany,
        title: uploadTitle,
        user_id: userId,
      }

      const res = await fetch('https://primary-production-6722.up.railway.app/webhook/file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error('Upload failed')

      // Check if response text is "Done"
      const responseText = await res.text()
      if (responseText.trim() === 'Done') {
        // Close upload modal and show success modal
        handleCloseModal()
        setIsSuccessModalOpen(true)
        // Refresh documents from signature table API
        const docsRes = await fetch(`/api/esignature/signatures?user_id=${encodeURIComponent(userId)}`, { cache: 'no-store' })
        if (docsRes.ok) {
          const json = await docsRes.json()
          if (json.documents) setDocuments(json.documents)
        }
      } else {
        throw new Error('Unexpected response from server')
      }
    } catch (err: any) {
      alert(`Upload failed: ${err?.message || 'Unknown error'}`)
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

        console.log('[Page] Fetching with user_id:', userId)

        const res = await fetch(`/api/esignature/signatures?user_id=${encodeURIComponent(userId)}`, { cache: 'no-store' })
        console.log('[Page] API response status:', res.status)
        
        if (!res.ok) {
          const errorText = await res.text().catch(() => '')
          console.error('[Page] API error response:', errorText)
          throw new Error(`Failed to load signature documents (${res.status}): ${errorText}`)
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

    fetchDocuments()
  }, [])

  const handleSendSignatureRequest = async (doc: Document) => {
    if (!doc.recipient) {
      alert('No recipient email found for this document')
      return
    }

    if (!confirm(`Send signature request to ${doc.recipientName || doc.recipient}?`)) {
      return
    }

    setSendingRequest(doc.id)
    try {
      const toEmail = String(doc.recipient || '').trim().toLowerCase()

      // Fetch the signature record (document_file)
      const sigRes = await fetch(`/api/esignature/signature/${encodeURIComponent(doc.id)}`, { cache: 'no-store' })
      if (!sigRes.ok) {
        throw new Error('Failed to load signature record')
      }
      const sigData = await sigRes.json()
      if (!sigData || !sigData.document_file) {
        throw new Error('No document file found in signature record')
      }

      // Fetch the fields for this document
      const fieldsRes = await fetch(`/api/esignature/fields?dealId=${encodeURIComponent(doc.id)}`, { cache: 'no-store' })
      const fieldsJson = fieldsRes.ok ? await fieldsRes.json().catch(() => null) : null
      const fields: EsignField[] = Array.isArray(fieldsJson?.fields) ? fieldsJson.fields : []

      // Generate the signature link with email as query param
      const signatureLink = (() => {
        try {
          if (typeof window === 'undefined') return ''
          const appOrigin = 'https://easydrivecanada.com'
          return `${appOrigin}/admin/sales/deals/signature?${encodeURIComponent(toEmail)}`
        } catch {
          return ''
        }
      })()

      // POST to the webhook
      const payload = {
        id: doc.id,
        email: toEmail,
        full_name: sigData.full_name || doc.recipientName || '',
        company: sigData.company || '',
        title: sigData.title || '',
        document_file: sigData.document_file,
        fields: fields,
        link: signatureLink,
      }

      const sendRes = await fetch('https://primary-production-6722.up.railway.app/webhook/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!sendRes.ok) {
        const t = await sendRes.text().catch(() => '')
        throw new Error(t || `Webhook failed (${sendRes.status})`)
      }

      alert('Signature request sent successfully!')
    } catch (e: any) {
      alert(`Failed to send signature request: ${e?.message || 'Unknown error'}`)
    } finally {
      setSendingRequest(null)
    }
  }

  const handleDownloadDocument = async (doc: Document) => {
    if (typeof window === 'undefined') return

    try {
      // 1. Fetch signature record to get document_file
      const sigRes = await fetch(`/api/esignature/signature/${encodeURIComponent(doc.id)}`, { cache: 'no-store' })
      if (!sigRes.ok) throw new Error('Failed to load signature record')
      const sigData = await sigRes.json()
      if (!sigData?.document_file) throw new Error('No document file found')

      // 2. Fetch fields for this document
      const fieldsRes = await fetch(`/api/esignature/fields?dealId=${encodeURIComponent(doc.id)}`, { cache: 'no-store' })
      const fieldsJson = fieldsRes.ok ? await fieldsRes.json().catch(() => null) : null
      const fields: EsignField[] = Array.isArray(fieldsJson?.fields) ? fieldsJson.fields : []

      // 3. Load PDF.js
      const pdfjsLib = await loadPdfJs()

      // 4. Convert document_file to proper data URL
      let pdfSrc = sigData.document_file
      if (!pdfSrc.startsWith('data:')) {
        pdfSrc = `data:application/pdf;base64,${pdfSrc}`
      }

      // 5. Load and render PDF pages to images
      const pdfDoc = await pdfjsLib.getDocument({ data: atob(pdfSrc.split(',')[1]) }).promise
      const numPages = pdfDoc.numPages
      const PAGE_WIDTH = 816
      const PAGE_HEIGHT = 1056
      const PDF_RENDER_QUALITY = 4
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

      // 6. Create output PDF with jsPDF
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' })
      const pdfW = pdf.internal.pageSize.getWidth()
      const pdfH = pdf.internal.pageSize.getHeight()

      for (let i = 0; i < pageImages.length; i++) {
        if (i > 0) pdf.addPage()
        pdf.addImage(pageImages[i], 'PNG', 0, 0, pdfW, pdfH)
      }

      // 7. Overlay fields
      const fullName = String(sigData.full_name ?? '').trim()
      const initials = fullName ? fullName.split(' ').map((n: string) => n[0]).join('').toUpperCase() : ''
      const signature = String(sigData.signature_image ?? '').trim()
      const signedDate = (() => {
        const raw = String(sigData.signed_at ?? sigData.updated_at ?? sigData.created_at ?? '').trim()
        if (!raw) return ''
        try {
          const d = new Date(raw)
          return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-CA')
        } catch { return '' }
      })()

      const xScale = pdfW / PAGE_WIDTH
      const yScale = pdfH / PAGE_HEIGHT

      fields.forEach(field => {
        const pageNum = Math.min(Math.max(field.page || 1, 1), pdf.getNumberOfPages())
        pdf.setPage(pageNum)
        const x = field.x * xScale
        const y = field.y * yScale
        const w = field.width * xScale
        const h = field.height * yScale

        try {
          switch (field.type) {
            case 'signature':
              if (signature) {
                let src = signature
                if (!signature.startsWith('data:') && !signature.startsWith('http')) {
                  src = `data:image/png;base64,${signature}`
                }
                pdf.addImage(src, 'PNG', x, y, w, h)
              }
              break
            case 'initial':
              if (initials) {
                pdf.setTextColor(29, 78, 216)
                pdf.setFontSize(14)
                pdf.setFont('helvetica', 'bold')
                pdf.text(initials, x + w / 2, y + h / 2, { align: 'center', baseline: 'middle' })
                pdf.setFont('helvetica', 'normal')
              }
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
              if (signedDate) {
                pdf.setTextColor(55, 65, 81)
                pdf.setFontSize(10)
                pdf.text(signedDate, x + w / 2, y + h / 2, { align: 'center', baseline: 'middle' })
              }
              break
            case 'name':
              pdf.setTextColor(17, 24, 39)
              pdf.setFontSize(10)
              if (fullName) {
                pdf.text(fullName, x + 5, y + h / 2, { baseline: 'middle' })
              } else if (field.value) {
                pdf.text(String(field.value), x + 5, y + h / 2, { baseline: 'middle' })
              }
              break
            case 'company':
            case 'title':
            case 'text':
              pdf.setTextColor(55, 65, 81)
              pdf.setFontSize(10)
              if (field.value) pdf.text(String(field.value), x + 5, y + h / 2, { baseline: 'middle' })
              break
            case 'checkbox':
              pdf.setDrawColor(37, 99, 235)
              pdf.roundedRect(x + w / 2 - 7.5, y + h / 2 - 7.5, 15, 15, 2, 2, 'S')
              if (['true', '1', 'yes'].includes(String(field.value ?? '').toLowerCase())) {
                pdf.setTextColor(37, 99, 235)
                pdf.setFontSize(12)
                pdf.text('✓', x + w / 2, y + h / 2 + 1, { align: 'center', baseline: 'middle' })
              }
              break
          }
        } catch (err) {
          console.error('Field render error:', field.id, err)
        }
      })

      // 8. Save PDF
      pdf.save(`Document_${doc.id}_with_fields.pdf`)
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
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white text-xs font-semibold">
                            {doc.recipient.charAt(0).toUpperCase()}
                          </div>
                          <span className="text-sm text-slate-700 truncate min-w-0">{doc.recipient}</span>
                        </div>
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
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10l9-6 9 6-9 6-9-6z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10v10l9-6 9 6V10" />
                                </svg>
                              )}
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

      {/* Upload Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={handleCloseModal} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
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
            <form onSubmit={handleModalSubmit} className="p-6 space-y-5">
              {/* File Upload */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Document File</label>
                <div className="relative">
                  <input
                    ref={fileInputRef}
                    type="file"
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
                        {uploadFile ? uploadFile.name : 'Click to upload file'}
                      </p>
                      <p className="text-xs text-slate-500">PDF, DOC, DOCX, PNG, JPG up to 10MB</p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Email */}
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
                    value={uploadEmail}
                    onChange={(e) => setUploadEmail(e.target.value)}
                    placeholder="recipient@example.com"
                    className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    required
                  />
                </div>
              </div>

              {/* Name & Company Row */}
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
                      value={uploadName}
                      onChange={(e) => setUploadName(e.target.value)}
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
                      value={uploadCompany}
                      onChange={(e) => setUploadCompany(e.target.value)}
                      placeholder="Company Name"
                      className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    />
                  </div>
                </div>
              </div>

              {/* Title */}
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
                    value={uploadTitle}
                    onChange={(e) => setUploadTitle(e.target.value)}
                    placeholder="e.g. Sales Manager"
                    className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  />
                </div>
              </div>

              {/* Signature */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Signature Image</label>
                <div className="relative">
                  <input
                    ref={signatureInputRef}
                    type="file"
                    accept=".png,.jpg,.jpeg"
                    onChange={handleSignatureFileSelect}
                    className="hidden"
                    id="signature-upload"
                  />
                  <label
                    htmlFor="signature-upload"
                    className="flex items-center justify-center gap-3 w-full px-4 py-4 border-2 border-dashed border-slate-300 rounded-xl hover:border-blue-400 hover:bg-blue-50/50 transition-all cursor-pointer group"
                  >
                    <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                      <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </div>
                    <div className="text-left flex-1">
                      <p className="text-sm font-medium text-slate-700">
                        {uploadSignature ? uploadSignature.name : 'Click to upload signature image'}
                      </p>
                      <p className="text-xs text-slate-500">PNG, JPG up to 5MB</p>
                    </div>
                    {uploadSignature && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault()
                          clearSignature()
                        }}
                        className="p-1.5 text-red-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </label>
                </div>
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
                  disabled={uploading || !uploadFile}
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
                    'Upload Document'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Success Modal - shows when upload is Done */}
      {isSuccessModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">Already Save</h3>
            <p className="text-sm text-slate-500 mb-6">Your document has been uploaded and saved successfully.</p>
            <button
              type="button"
              onClick={handleCloseSuccessModal}
              className="w-full px-4 py-3 bg-gradient-to-r from-green-600 to-green-500 text-white font-medium rounded-xl shadow-lg shadow-green-500/25 hover:shadow-green-500/40 hover:scale-[1.02] transition-all"
            >
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
