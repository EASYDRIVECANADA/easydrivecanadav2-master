'use client'

import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { FileText, Upload, Trash2, Loader2 } from 'lucide-react'

type UploadedFile = {
  name: string
  path: string
  publicUrl: string
  size: number
}

type Props = {
  vehicleId: string
}

export default function CarfaxTab({ vehicleId }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [loadingFiles, setLoadingFiles] = useState(true)
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])
  const [dragging, setDragging] = useState(false)

  // Upload result modal
  const [uploadModal, setUploadModal] = useState<{ open: boolean; success: boolean; message: string }>({
    open: false, success: false, message: '',
  })

  // Delete confirmation modal
  const [deleteModal, setDeleteModal] = useState<{ open: boolean; file: UploadedFile | null }>({
    open: false, file: null,
  })
  const [deleting, setDeleting] = useState(false)

  // Load existing files from bucket on mount
  useEffect(() => {
    if (!vehicleId) return
    let cancelled = false
    const load = async () => {
      setLoadingFiles(true)
      try {
        const { data, error: listError } = await supabase.storage
          .from('Carfax')
          .list(vehicleId, { limit: 100, sortBy: { column: 'name', order: 'asc' } })

        if (cancelled) return
        if (listError || !Array.isArray(data) || data.length === 0) return

        const files: UploadedFile[] = data
          .filter((f) => !!f?.name && !String(f.name).endsWith('/'))
          .map((f) => {
            const path = `${vehicleId}/${f.name}`
            const { data: urlData } = supabase.storage.from('Carfax').getPublicUrl(path)
            return {
              name: f.name,
              path,
              publicUrl: urlData.publicUrl,
              size: f.metadata?.size ?? 0,
            }
          })

        if (!cancelled) setUploadedFiles(files)
      } finally {
        if (!cancelled) setLoadingFiles(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [vehicleId])

  const uploadFile = async (file: File) => {
    setUploading(true)
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const path = `${vehicleId}/${Date.now()}_${safeName}`

    const { error: uploadError } = await supabase.storage
      .from('Carfax')
      .upload(path, file, { upsert: true })

    if (uploadError) {
      setUploadModal({ open: true, success: false, message: `Upload failed: ${uploadError.message}` })
      setUploading(false)
      return
    }

    const { data } = supabase.storage.from('Carfax').getPublicUrl(path)
    setUploadedFiles((prev) => [
      ...prev,
      { name: file.name, path, publicUrl: data.publicUrl, size: file.size },
    ])
    setUploadModal({ open: true, success: true, message: `"${file.name}" uploaded successfully.` })
    setUploading(false)
  }

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return
    Array.from(files).forEach(uploadFile)
  }

  const confirmDelete = async () => {
    if (!deleteModal.file) return
    setDeleting(true)
    await supabase.storage.from('Carfax').remove([deleteModal.file.path])
    setUploadedFiles((prev) => prev.filter((f) => f.path !== deleteModal.file!.path))
    setDeleting(false)
    setDeleteModal({ open: false, file: null })
  }

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <div className="space-y-6">
      <h3 className="text-base font-semibold text-gray-900">CARFAX Reports</h3>

      {/* Drop Zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files) }}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${
          dragging ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png"
          multiple
          className="hidden"
          onChange={(e) => { handleFiles(e.target.files); e.target.value = '' }}
        />
        {uploading ? (
          <div className="flex flex-col items-center gap-2 text-blue-600">
            <Loader2 className="w-8 h-8 animate-spin" />
            <p className="text-sm font-medium">Uploading…</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 text-gray-400">
            <Upload className="w-8 h-8" />
            <p className="text-sm font-medium text-gray-600">Click to upload or drag &amp; drop</p>
            <p className="text-xs">PDF, JPG, PNG supported</p>
          </div>
        )}
      </div>

      {/* Files list */}
      {loadingFiles ? (
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading files…
        </div>
      ) : uploadedFiles.length > 0 ? (
        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-700">Uploaded files ({uploadedFiles.length})</p>
          {uploadedFiles.map((f) => (
            <div key={f.path} className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg px-4 py-3">
              <div className="flex items-center gap-3 min-w-0">
                <FileText className="w-5 h-5 text-gray-400 flex-shrink-0" />
                <div className="min-w-0">
                  <a href={f.publicUrl} target="_blank" rel="noopener noreferrer"
                    className="text-sm font-medium text-blue-600 hover:underline truncate block">
                    {f.name}
                  </a>
                  {f.size > 0 && <p className="text-xs text-gray-400">{formatBytes(f.size)}</p>}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDeleteModal({ open: true, file: f })}
                className="ml-3 text-gray-400 hover:text-red-500 transition-colors flex-shrink-0"
                title="Delete"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-gray-400">No files uploaded yet.</p>
      )}

      {/* Upload result modal */}
      {uploadModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-[92vw] max-w-sm bg-white rounded-xl shadow-xl p-6">
            <div className={`text-base font-semibold mb-1 ${uploadModal.success ? 'text-green-700' : 'text-red-700'}`}>
              {uploadModal.success ? 'Upload Successful' : 'Upload Failed'}
            </div>
            <p className="text-sm text-gray-600">{uploadModal.message}</p>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setUploadModal({ open: false, success: false, message: '' })}
                className="px-4 py-2 bg-[#118df0] text-white text-sm font-semibold rounded-lg hover:bg-[#0d6ebd]"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-[92vw] max-w-sm bg-white rounded-xl shadow-xl p-6">
            <div className="text-base font-semibold text-gray-900 mb-1">Delete File</div>
            <p className="text-sm text-gray-600">
              Are you sure you want to delete <span className="font-medium">"{deleteModal.file?.name}"</span>? This cannot be undone.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteModal({ open: false, file: null })}
                disabled={deleting}
                className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={deleting}
                className="px-4 py-2 bg-red-600 text-white text-sm font-semibold rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
              >
                {deleting && <Loader2 className="w-3 h-3 animate-spin" />}
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
