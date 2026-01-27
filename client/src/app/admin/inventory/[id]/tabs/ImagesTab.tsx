'use client'

import { useState, useEffect } from 'react'
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

  const arrayBufferToBase64 = (buffer: ArrayBuffer) => {
    let binary = ''
    const bytes = new Uint8Array(buffer)
    const chunkSize = 0x8000
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, i + chunkSize)
      let s = ''
      for (let j = 0; j < chunk.length; j++) s += String.fromCharCode(chunk[j])
      binary += s
    }
    return btoa(binary)
  }

  const normalizeImages = (raw: any): string[] => {
    if (!raw) return []
    if (Array.isArray(raw)) return raw.map(String).filter(Boolean)
    if (typeof raw === 'string') {
      const s = raw.trim()
      if (!s) return []
      try {
        const parsed = JSON.parse(s)
        if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean)
      } catch {
        // ignore
      }
      // comma-separated fallback
      return s
        .split(',')
        .map(x => x.trim())
        .filter(Boolean)
    }
    return []
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

  const refreshImagesFromDb = async () => {
    try {
      const { data, error } = await supabase
        .from('edc_vehicles')
        .select('images')
        .eq('id', vehicleId)
        .maybeSingle()
      if (error) throw error
      const next = normalizeImages((data as any)?.images)
      onImagesUpdate(next)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setErrorMsg(msg || 'Error loading images')
      console.error('Error refreshing images:', e)
    }
  }

  useEffect(() => {
    refreshImagesFromDb()
  }, [vehicleId])

  useEffect(() => {
    return () => {
      pendingImages.forEach(p => URL.revokeObjectURL(p.previewUrl))
    }
  }, [pendingImages])

  const addFilesToPending = (files: FileList | null) => {
    if (!files || files.length === 0) return
    const next: PendingImage[] = []
    for (let i = 0; i < files.length; i++) {
      const f = files[i]
      next.push({
        id: `${Date.now()}_${i}_${Math.random().toString(16).slice(2)}`,
        file: f,
        previewUrl: URL.createObjectURL(f),
      })
    }
    setPendingImages(prev => [...prev, ...next])
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
      const imagesPayload: string[] = []
      for (const p of pendingImages) {
        const ab = await p.file.arrayBuffer()
        imagesPayload.push(arrayBufferToBase64(ab))
      }

      const res = await fetch('/api/image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'upload', vehicleId, images: imagesPayload }),
      })

      const text = await res.text().catch(() => '')
      if (!res.ok) throw new Error(text || `Webhook responded with ${res.status}`)
      if (!String(text).toLowerCase().includes('done')) throw new Error(text || 'Webhook did not return done')

      pendingImages.forEach(p => URL.revokeObjectURL(p.previewUrl))
      setPendingImages([])
      await refreshImagesFromDb()
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
      const res = await fetch('/api/image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', vehicleId, imageUrl }),
      })

      const text = await res.text().catch(() => '')
      if (!res.ok) throw new Error(text || `Webhook responded with ${res.status}`)
      if (!String(text).toLowerCase().includes('done')) throw new Error(text || 'Webhook did not return done')

      await refreshImagesFromDb()
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
    addFilesToPending(e.dataTransfer.files)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(true)
  }

  const handleDragLeave = () => {
    setDragOver(false)
  }

  return (
    <div className="bg-white rounded-xl shadow p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Vehicle Images</h2>

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
        <input
          type="file"
          multiple
          accept="image/*"
          onChange={(e) => {
            addFilesToPending(e.target.files)
            e.currentTarget.value = ''
          }}
          className="hidden"
          id="image-upload"
        />
        <label
          htmlFor="image-upload"
          className="inline-block bg-[#118df0] text-white px-6 py-2 rounded-lg font-medium hover:bg-[#0d6ebd] transition-colors cursor-pointer"
        >
          Select Images
        </label>
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
              {uploading ? 'Uploading...' : 'Upload Images'}
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
