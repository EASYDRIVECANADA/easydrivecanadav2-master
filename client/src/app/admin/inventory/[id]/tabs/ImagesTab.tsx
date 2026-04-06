'use client'

import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

interface ImagesTabProps {
  vehicleId: string
  images: string[]
  onImagesUpdate: (images: string[]) => void
}

type PendingImage = {
  id: string
  file: File
  previewUrl: string
}

export default function ImagesTab({ vehicleId, images, onImagesUpdate }: ImagesTabProps) {
  const [uploading, setUploading] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string>('')
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([])
  const [generating, setGenerating] = useState(false)
  const [accountRole, setAccountRole] = useState<string>('')

  const [genConfirmOpen, setGenConfirmOpen] = useState(false)
  const [genInsufficientOpen, setGenInsufficientOpen] = useState(false)
  const [genInsufficientMessage, setGenInsufficientMessage] = useState('')
  const [genDontShowAgain, setGenDontShowAgain] = useState(false)
  const [genBalance, setGenBalance] = useState<number | null>(null)
  const genConfirmActionRef = useRef<(() => void) | null>(null)

  const BUCKET = 'vehicle-photos'

  const busy = generating || uploading

  const getStoragePathFromPublicUrl = (publicUrl: string) => {
    try {
      const u = new URL(publicUrl)
      const marker = `/storage/v1/object/public/${BUCKET}/`
      const idx = u.pathname.indexOf(marker)
      if (idx === -1) return null
      return decodeURIComponent(u.pathname.substring(idx + marker.length))
    } catch {
      return null
    }
  }

  const toImageSrc = (value: string) => {
    const v = String(value || '').trim()
    if (!v) return ''
    if (v.startsWith('http://') || v.startsWith('https://') || v.startsWith('data:')) return v
    // Assume base64 without prefix
    const head = v.slice(0, 10)
    let mime = 'image/jpeg'
    if (head.startsWith('iVBOR')) mime = 'image/png'
    else if (head.startsWith('R0lGOD')) mime = 'image/gif'
    else if (head.startsWith('UklGR')) mime = 'image/webp'
    return `data:${mime};base64,${v}`
  }

  const refreshImagesFromBucket = async () => {
    try {
      const id = String(vehicleId || '').trim()
      if (!id) {
        onImagesUpdate([])
        return
      }

      const { data, error: listError } = await supabase.storage.from(BUCKET).list(id, {
        limit: 100,
        sortBy: { column: 'name', order: 'asc' },
      })

      if (listError || !Array.isArray(data) || data.length === 0) {
        onImagesUpdate([])
        return
      }

      const files = data
        .filter((f) => !!f?.name && !String(f.name).endsWith('/'))
        .map((f) => `${id}/${f.name}`)

      const urls: string[] = []
      for (const path of files) {
        const pub = supabase.storage.from(BUCKET).getPublicUrl(path)
        const publicUrl = String(pub?.data?.publicUrl || '').trim()
        if (publicUrl) {
          urls.push(publicUrl)
          continue
        }

        const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 60)
        const signedUrl = String((signed as any)?.signedUrl || '').trim()
        if (signedUrl) urls.push(signedUrl)
      }

      onImagesUpdate(urls)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setErrorMsg(msg || 'Error loading images')
      console.error('Error refreshing images:', e)
    }
  }

  useEffect(() => {
    refreshImagesFromBucket()
  }, [vehicleId])

  useEffect(() => {
    const loadRole = async () => {
      try {
        const raw = typeof window !== 'undefined' ? window.localStorage.getItem('edc_admin_session') : null
        const parsed = raw ? (JSON.parse(raw) as any) : null
        const sessionEmail = String(parsed?.email || '').trim().toLowerCase()
        const sessionUserId = String(parsed?.user_id || '').trim()

        const { data: byId } = sessionUserId
          ? await supabase.from('users').select('role').eq('user_id', sessionUserId).maybeSingle()
          : ({ data: null } as any)
        const { data: byEmail } = !byId?.role && sessionEmail
          ? await supabase.from('users').select('role').eq('email', sessionEmail).maybeSingle()
          : ({ data: null } as any)

        const r = String((byId as any)?.role ?? (byEmail as any)?.role ?? '').trim().toLowerCase()
        setAccountRole(r)
      } catch {
        setAccountRole('')
      }
    }
    void loadRole()
  }, [])

  useEffect(() => {
    return () => {
      pendingImages.forEach(p => URL.revokeObjectURL(p.previewUrl))
    }
  }, [pendingImages])

  const isHeic = (f: File) => {
    const name = f.name.toLowerCase()
    return name.endsWith('.heic') || name.endsWith('.heif') || f.type === 'image/heic' || f.type === 'image/heif'
  }

  // Approach 1: canvas (works when browser natively supports HEIC — Safari/Mac)
  const convertHeicViaCanvas = (f: File): Promise<File> =>
    new Promise((resolve, reject) => {
      const url = URL.createObjectURL(f)
      const img = new Image()
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas')
          canvas.width = img.naturalWidth
          canvas.height = img.naturalHeight
          const ctx = canvas.getContext('2d')
          if (!ctx) { URL.revokeObjectURL(url); reject(new Error('No canvas context')); return }
          ctx.drawImage(img, 0, 0)
          canvas.toBlob(blob => {
            URL.revokeObjectURL(url)
            if (!blob) { reject(new Error('Canvas toBlob failed')); return }
            const name = f.name.replace(/\.(heic|heif)$/i, '.jpg')
            resolve(new File([blob], name, { type: 'image/jpeg' }))
          }, 'image/jpeg', 0.92)
        } catch (e) { URL.revokeObjectURL(url); reject(e) }
      }
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Browser cannot decode HEIC natively')) }
      img.src = url
    })

  // Approach 2: heic2any library (works in Chrome/Windows without native codec)
  const convertHeicViaLibrary = async (f: File): Promise<File> => {
    const mod = await import('heic2any')
    const fn: Function = typeof (mod as any).default === 'function'
      ? (mod as any).default
      : typeof mod === 'function'
        ? mod as unknown as Function
        : null
    if (!fn) throw new Error('heic2any not loaded')
    const result = await fn({ blob: f, toType: 'image/jpeg', quality: 0.92, multiple: false })
    const blob: Blob = Array.isArray(result) ? result[0] : result
    const name = f.name.replace(/\.(heic|heif)$/i, '.jpg')
    return new File([blob], name, { type: 'image/jpeg' })
  }

  // Approach 3: server-side via Sharp (always works, any browser/OS)
  const convertHeicViaServer = async (f: File): Promise<File> => {
    const form = new FormData()
    form.append('file', f)
    const res = await fetch('/api/convert-heic', { method: 'POST', body: form })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
      throw new Error(err?.error || 'Server conversion failed')
    }
    const blob = await res.blob()
    const name = f.name.replace(/\.(heic|heif)$/i, '.jpg')
    return new File([blob], name, { type: 'image/jpeg' })
  }

  const convertHeicToJpeg = async (f: File): Promise<File> => {
    // 1. Canvas (native HEIC support — Mac/Safari/iOS)
    try { return await convertHeicViaCanvas(f) } catch { /* fall through */ }
    // 2. heic2any library (Windows Chrome with libheif)
    try { return await convertHeicViaLibrary(f) } catch { /* fall through */ }
    // 3. Server-side Sharp (guaranteed fallback — works everywhere)
    return await convertHeicViaServer(f)
  }

  const parseHeicError = (err: unknown): string => {
    if (err instanceof Error) return err.message
    if (err && typeof err === 'object') {
      const o = err as Record<string, unknown>
      if (typeof o.message === 'string') return o.message
      try { return JSON.stringify(o) } catch { /* ignore */ }
    }
    return String(err)
  }

  const addFilesToPending = async (files: FileList | File[] | null) => {
    if (!files || files.length === 0) return
    const fileArray: File[] = Array.from(files)
    const next: PendingImage[] = []
    const conversionErrors: string[] = []
    for (let i = 0; i < fileArray.length; i++) {
      let f = fileArray[i]
      if (isHeic(f)) {
        try {
          f = await convertHeicToJpeg(f)
        } catch (err) {
          conversionErrors.push(`"${fileArray[i].name}": ${parseHeicError(err)}`)
          continue
        }
      }
      next.push({
        id: `${Date.now()}_${i}_${Math.random().toString(16).slice(2)}`,
        file: f,
        previewUrl: URL.createObjectURL(f),
      })
    }
    if (conversionErrors.length > 0) {
      setErrorMsg(`Failed to convert HEIC image(s) — please convert to JPG first:\n${conversionErrors.join('\n')}`)
    }
    if (next.length > 0) {
      setPendingImages(prev => [...prev, ...next])
    }
  }

  const movePending = (id: string, dir: -1 | 1) => {
    setPendingImages(prev => {
      const idx = prev.findIndex(p => p.id === id)
      if (idx === -1) return prev
      const nextIdx = idx + dir
      if (nextIdx < 0 || nextIdx >= prev.length) return prev
      const arr = [...prev]
      const tmp = arr[idx]
      arr[idx] = arr[nextIdx]
      arr[nextIdx] = tmp
      return arr
    })
  }

  const removePending = (id: string) => {
    setPendingImages(prev => {
      const item = prev.find(p => p.id === id)
      if (item) URL.revokeObjectURL(item.previewUrl)
      return prev.filter(p => p.id !== id)
    })
  }

  const handleUploadPending = async () => {
    if (pendingImages.length === 0) return

    setUploading(true)
    setErrorMsg('')

    try {
      const id = String(vehicleId || '').trim()
      if (!id) throw new Error('Missing vehicle id')

      for (const p of pendingImages) {
        const safeName = String(p.file?.name || 'image').replace(/[^a-zA-Z0-9._-]/g, '_')
        const objectPath = `${id}/${Date.now()}_${safeName}`
        const { error: uploadError } = await supabase.storage.from(BUCKET).upload(objectPath, p.file, {
          upsert: false,
          contentType: p.file?.type || undefined,
        })
        if (uploadError) throw uploadError
      }

      pendingImages.forEach(p => URL.revokeObjectURL(p.previewUrl))
      setPendingImages([])
      await refreshImagesFromBucket()
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      setErrorMsg(msg || 'Error uploading images')
      console.error('Error uploading images:', error)
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async (imageUrl: string) => {
    setDeleting(imageUrl)
    setErrorMsg('')
    try {
      const storagePath = getStoragePathFromPublicUrl(imageUrl)
      if (storagePath) {
        const { error: storageError } = await supabase.storage.from(BUCKET).remove([storagePath])
        if (storageError) throw storageError
      }

      await refreshImagesFromBucket()
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      setErrorMsg(msg || 'Error deleting image')
      console.error('Error deleting image:', error)
    } finally {
      setDeleting(null)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    void addFilesToPending(e.dataTransfer.files)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(true)
  }

  const handleDragLeave = () => {
    setDragOver(false)
  }

  const handleGenerateImage = async () => {
    if (generating) return
    setErrorMsg('')

    let sessionEmail = ''
    try {
      if (typeof window !== 'undefined') {
        const raw = window.localStorage.getItem('edc_admin_session')
        if (raw) {
          const parsed = JSON.parse(raw) as { email?: string }
          sessionEmail = String(parsed?.email || '').trim().toLowerCase()
        }
      }
    } catch {
      sessionEmail = ''
    }

    if (!sessionEmail) {
      setErrorMsg('Missing email. Please sign in again.')
      return
    }

    // Premier users get free image generation - skip all payment checks
    const isPremier = accountRole === 'premier'
    
    if (isPremier) {
      // Direct generation for Premier users - no payment required
      const runGenerate = async () => {
        setGenerating(true)
        try {
          const res = await fetch('/api/generate-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ vehicleId, email: sessionEmail }),
          })
          const json = await res.json().catch(() => null)
          if (!res.ok) throw new Error(String(json?.error || 'Failed to generate image'))
          await refreshImagesFromBucket()
        } catch (e) {
          setErrorMsg(String((e as any)?.message || e || 'Failed to generate image'))
        } finally {
          setGenerating(false)
        }
      }
      await runGenerate()
      return
    }

    const skipConfirm = (() => {
      try {
        if (typeof window === 'undefined') return false
        return window.localStorage.getItem('edc_skip_generate_image_confirm') === '1'
      } catch {
        return false
      }
    })()

    const cost = 0.5
    try {
      const balRes = await fetch('/api/users/balance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: sessionEmail }),
      })
      const balJson = await balRes.json().catch(() => null)
      if (!balRes.ok || !balJson?.ok) throw new Error(String(balJson?.error || 'Unable to check balance'))

      const balance = Number(balJson?.balance ?? 0)
      const safeBalance = Number.isFinite(balance) ? balance : 0
      setGenBalance(safeBalance)

      if (safeBalance < cost) {
        setGenInsufficientMessage('Insufficient Load Balance. $0.50 required to generate an image.')
        setGenInsufficientOpen(true)
        return
      }
    } catch (e) {
      setErrorMsg(String((e as any)?.message || e || 'Unable to check balance'))
      return
    }

    const runGenerate = async () => {
      if (generating) return
      setGenerating(true)
      setErrorMsg('')
      try {
        const { data, error } = await supabase.from('edc_vehicles').select('*').eq('id', vehicleId).maybeSingle()
        if (error) throw error

        const res = await fetch('/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ vehicleId, vehicle: data ?? null, email: sessionEmail }),
        })

        const text = await res.text().catch(() => '')
        if (!res.ok) throw new Error(text || `Webhook responded with ${res.status}`)

        await refreshImagesFromBucket()
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error)
        setErrorMsg(msg || 'Error generating image')
        console.error('Error generating image:', error)
      } finally {
        setGenerating(false)
      }
    }

    if (skipConfirm) {
      await runGenerate()
      return
    }

    genConfirmActionRef.current = () => {
      void runGenerate()
    }
    setGenDontShowAgain(false)
    setGenConfirmOpen(true)
  }

  return (
    <div className="bg-white rounded-xl shadow p-6">
      {genConfirmOpen ? (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-navy-900/60 backdrop-blur-sm" onMouseDown={() => setGenConfirmOpen(false)} />
          <div className="edc-modal w-full max-w-md relative z-10" onMouseDown={(e) => e.stopPropagation()}>
            <div className="h-11 px-4 border-b border-slate-200/60 flex items-center justify-between">
              <div className="text-sm font-semibold text-slate-800">Generate Image</div>
              <button type="button" className="h-8 w-8 flex items-center justify-center" onClick={() => setGenConfirmOpen(false)}>
                <span className="text-xl leading-none text-slate-400">×</span>
              </button>
            </div>
            <div className="p-4 text-sm text-slate-700">
              <div>This action will generate an image using Load Balance.</div>
              <div className="mt-2">Cost: <span className="font-semibold">$0.50</span></div>
              <div className="text-xs text-slate-500 mt-1">Your balance: {genBalance === null ? '—' : `$${genBalance.toFixed(2)}`}</div>
              <label className="mt-3 flex items-center gap-2 text-xs text-slate-600">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={genDontShowAgain}
                  onChange={(e) => setGenDontShowAgain(e.target.checked)}
                />
                Don't show again
              </label>
            </div>
            <div className="h-12 px-4 border-t border-slate-200/60 flex items-center justify-end gap-2">
              <button type="button" className="edc-btn-secondary h-8 px-4 text-xs" onClick={() => setGenConfirmOpen(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="edc-btn-primary h-8 px-4 text-xs"
                disabled={generating}
                onClick={() => {
                  if (genDontShowAgain) {
                    try {
                      if (typeof window !== 'undefined') window.localStorage.setItem('edc_skip_generate_image_confirm', '1')
                    } catch {
                      // ignore
                    }
                  }
                  setGenConfirmOpen(false)
                  genConfirmActionRef.current?.()
                  genConfirmActionRef.current = null
                }}
              >
                {generating ? 'Processing…' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {genInsufficientOpen ? (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-navy-900/60 backdrop-blur-sm" onMouseDown={() => setGenInsufficientOpen(false)} />
          <div className="edc-modal w-full max-w-md relative z-10" onMouseDown={(e) => e.stopPropagation()}>
            <div className="h-11 px-4 border-b border-slate-200/60 flex items-center justify-between">
              <div className="text-sm font-semibold text-slate-800">Insufficient Balance</div>
              <button type="button" className="h-8 w-8 flex items-center justify-center" onClick={() => setGenInsufficientOpen(false)}>
                <span className="text-xl leading-none text-slate-400">×</span>
              </button>
            </div>
            <div className="p-4 text-sm text-slate-700">{genInsufficientMessage || 'Insufficient Load Balance.'}</div>
            <div className="h-12 px-4 border-t border-slate-200/60 flex items-center justify-end">
              <button type="button" className="edc-btn-primary h-8 px-4 text-xs" onClick={() => setGenInsufficientOpen(false)}>
                OK
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <h2 className="text-lg font-semibold text-gray-900 mb-4">Vehicle Images</h2>

      <style jsx>{`
        @keyframes edc-spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
        @keyframes edc-pulse {
          0%,
          100% {
            transform: translate(-50%, -50%) scale(1);
            filter: drop-shadow(0 0 0 rgba(17, 141, 240, 0));
          }
          50% {
            transform: translate(-50%, -50%) scale(1.08);
            filter: drop-shadow(0 0 14px rgba(17, 141, 240, 0.65));
          }
        }
        @keyframes edc-dots {
          0% {
            content: '';
          }
          33% {
            content: '.';
          }
          66% {
            content: '..';
          }
          100% {
            content: '...';
          }
        }
        .edc-ring {
          animation: edc-spin 0.9s linear infinite;
          border-radius: 9999px;
          background: conic-gradient(
            from 0deg,
            rgba(17, 141, 240, 0) 0deg,
            rgba(17, 141, 240, 0.95) 70deg,
            rgba(17, 141, 240, 0.25) 170deg,
            rgba(17, 141, 240, 0) 360deg
          );
          -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 6px), #000 calc(100% - 6px));
          mask: radial-gradient(farthest-side, transparent calc(100% - 6px), #000 calc(100% - 6px));
        }
        .edc-center {
          animation: edc-pulse 1.2s ease-in-out infinite;
        }
        .edc-text {
          letter-spacing: 0.2px;
        }
        .edc-text::after {
          content: '';
          display: inline-block;
          width: 1.2em;
          text-align: left;
          animation: edc-dots 1.2s steps(1, end) infinite;
        }
      `}</style>

      {busy && (
        <div className="fixed inset-0 z-[70] grid place-items-center bg-black/60">
          <div className="flex flex-col items-center justify-center gap-4">
            <div className="text-white text-base font-semibold edc-text">
              {generating ? 'Generating image' : 'Uploading images'}
            </div>
          </div>
        </div>
      )}

      {errorMsg && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">
          {errorMsg}
        </div>
      )}
      
      {/* Upload Area */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
          dragOver ? 'border-[#118df0] bg-blue-50' : 'border-gray-300 hover:border-gray-400'
        }`}
      >
        <svg className="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <p className="text-gray-600 mb-2">Drag and drop images here, or click to select</p>
        <p className="text-xs text-gray-400 mb-2">Supports JPG, PNG, WEBP, HEIC (iPhone)</p>
        <input
          type="file"
          multiple
          accept="image/*,.heic,.heif"
          onChange={(e) => {
            const filesArr = e.target.files ? Array.from(e.target.files) : []
            e.currentTarget.value = ''
            if (filesArr.length > 0) void addFilesToPending(filesArr)
          }}
          className="hidden"
          id="image-upload"
        />
        <div className="relative mt-1 flex flex-col items-center justify-center">
          <div className="flex items-center justify-center gap-3">
            <label
              htmlFor="image-upload"
              className="inline-block bg-[#118df0] text-white px-6 py-2 rounded-lg font-medium hover:bg-[#0d6ebd] transition-colors cursor-pointer"
            >
              Select Images
            </label>
            {accountRole === 'premier' && (
              <button
                type="button"
                onClick={handleGenerateImage}
                disabled={generating}
                className="inline-block bg-[#118df0] text-white px-6 py-2 rounded-lg font-medium hover:bg-[#0d6ebd] transition-colors disabled:opacity-50"
              >
                {generating ? 'Generating...' : 'Generate Image'}
              </button>
            )}
          </div>

          {null}
        </div>
      </div>

      {pendingImages.length > 0 && (
        <div className="mt-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-gray-700">Selected Images (Arrange Order)</h3>
            <button
              type="button"
              onClick={handleUploadPending}
              disabled={uploading}
              className="bg-[#118df0] text-white px-5 py-2 rounded-lg font-semibold hover:bg-[#0d6ebd] transition-colors disabled:opacity-50"
            >
              {uploading ? 'Uploading...' : 'Save'}
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {pendingImages.map((p, idx) => (
              <div key={p.id} className="relative border border-gray-200 rounded-lg overflow-hidden">
                <img src={p.previewUrl} alt={p.file.name} className="w-full h-28 object-cover" />
                <div className="p-2 text-[11px] text-gray-600 truncate">{p.file.name}</div>
                <div className="absolute top-2 left-2 bg-black/60 text-white text-[11px] px-2 py-0.5 rounded">
                  {idx + 1}
                </div>
                <div className="absolute top-2 right-2 flex gap-1">
                  <button
                    type="button"
                    onClick={() => movePending(p.id, -1)}
                    className="px-2 py-1 bg-white/90 border border-gray-200 rounded text-xs"
                    title="Move up"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => movePending(p.id, 1)}
                    className="px-2 py-1 bg-white/90 border border-gray-200 rounded text-xs"
                    title="Move down"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => removePending(p.id)}
                    className="px-2 py-1 bg-red-600 text-white rounded text-xs"
                    title="Remove"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Image Grid */}
      {images.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Current Images ({images.length})</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {images.map((image, index) => (
              <div key={index} className="relative group aspect-square">
                <img
                  src={toImageSrc(image)}
                  alt={`Vehicle image ${index + 1}`}
                  className="w-full h-full object-cover rounded-lg"
                />
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                  <button
                    onClick={() => handleDelete(image)}
                    disabled={deleting === image}
                    className="p-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors disabled:opacity-50"
                    title="Delete image"
                  >
                    {deleting === image ? (
                      <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    )}
                  </button>
                </div>
                {index === 0 && (
                  <span className="absolute top-2 left-2 bg-[#118df0] text-white text-xs px-2 py-1 rounded">
                    Main
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {images.length === 0 && (
        <div className="mt-6 text-center text-gray-500">
          <p>No images uploaded yet. Add some photos to showcase this vehicle.</p>
        </div>
      )}
    </div>
  )
}
