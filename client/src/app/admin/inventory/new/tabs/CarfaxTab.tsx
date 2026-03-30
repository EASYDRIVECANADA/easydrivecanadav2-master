'use client'

import { useRef, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { FileText, Upload, Trash2, CheckCircle, XCircle, Loader2 } from 'lucide-react'

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
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)

  const uploadFile = async (file: File) => {
    setUploading(true)
    setError(null)
    setSuccessMsg(null)

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const path = `${vehicleId}/${Date.now()}_${safeName}`

    const { error: uploadError } = await supabase.storage
      .from('Carfax')
      .upload(path, file, { upsert: true })

    if (uploadError) {
      setError(`Upload failed: ${uploadError.message}`)
      setUploading(false)
      return
    }

    const { data } = supabase.storage.from('Carfax').getPublicUrl(path)

    setUploadedFiles((prev) => [
      ...prev,
      { name: file.name, path, publicUrl: data.publicUrl, size: file.size },
    ])
    setSuccessMsg(`"${file.name}" uploaded successfully.`)
    setUploading(false)
  }

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return
    Array.from(files).forEach(uploadFile)
  }

  const handleRemove = async (item: UploadedFile) => {
    await supabase.storage.from('Carfax').remove([item.path])
    setUploadedFiles((prev) => prev.filter((f) => f.path !== item.path))
  }

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-semibold text-gray-900">CARFAX Reports</h3>
        <p className="text-sm text-gray-500 mt-1">
          Upload CARFAX report files for this vehicle. Files are stored under{' '}
          <span className="font-mono text-xs bg-gray-100 px-1 py-0.5 rounded">
            Carfax/{vehicleId}/
          </span>
        </p>
      </div>

      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          handleFiles(e.dataTransfer.files)
        }}
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

      {successMsg && (
        <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-3">
          <CheckCircle className="w-4 h-4 flex-shrink-0" />
          {successMsg}
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          <XCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {uploadedFiles.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-700">Uploaded files</p>
          {uploadedFiles.map((f) => (
            <div key={f.path} className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg px-4 py-3">
              <div className="flex items-center gap-3 min-w-0">
                <FileText className="w-5 h-5 text-gray-400 flex-shrink-0" />
                <div className="min-w-0">
                  <a href={f.publicUrl} target="_blank" rel="noopener noreferrer"
                    className="text-sm font-medium text-blue-600 hover:underline truncate block">
                    {f.name}
                  </a>
                  <p className="text-xs text-gray-400">{formatBytes(f.size)}</p>
                </div>
              </div>
              <button type="button" onClick={() => handleRemove(f)}
                className="ml-3 text-gray-400 hover:text-red-500 transition-colors flex-shrink-0" title="Remove">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
