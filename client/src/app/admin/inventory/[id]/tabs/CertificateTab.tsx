'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'

interface CertificateRow {
  id: string
  vehicleId: string
  user_id: string | null
  certificate: string // JSON string: { name, url, type, size }
  created_at: string
}

interface CertificateItem {
  rowId: string
  name: string
  url: string
  type: string
  size: number
}

interface CertificateTabProps {
  vehicleId: string
}

export default function CertificateTab({ vehicleId }: CertificateTabProps) {
  const [files, setFiles] = useState<CertificateItem[]>([])
  const [uploading, setUploading] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [preview, setPreview] = useState<{ url: string; type: string; name: string } | null>(null)
  const [userId, setUserId] = useState<string>('')

  useEffect(() => {
    try {
      const raw = typeof window !== 'undefined' ? window.localStorage.getItem('edc_admin_session') : null
      if (raw) setUserId(String((JSON.parse(raw) as { user_id?: string })?.user_id ?? ''))
    } catch { /* ignore */ }
    fetchFiles()
  }, [vehicleId])

  const fetchFiles = async () => {
    try {
      const { data, error } = await supabase
        .from('certificate')
        .select('id, vehicleId, user_id, certificate, created_at')
        .eq('vehicleId', vehicleId)
        .order('created_at', { ascending: true })

      if (error) {
        console.error('Error fetching certificates:', error)
        return
      }

      const parsed: CertificateItem[] = ((data as CertificateRow[]) || []).map((row) => {
        try {
          const meta = JSON.parse(row.certificate)
          return {
            rowId: row.id,
            name: String(meta?.name ?? ''),
            url: String(meta?.url ?? ''),
            type: String(meta?.type ?? ''),
            size: Number(meta?.size ?? 0),
          }
        } catch {
          // fallback: treat certificate value as a plain URL
          return {
            rowId: row.id,
            name: row.certificate.split('/').pop() ?? 'certificate',
            url: row.certificate,
            type: row.certificate.match(/\.(pdf)$/i) ? 'application/pdf' : 'image/jpeg',
            size: 0,
          }
        }
      })

      setFiles(parsed)
    } catch (err) {
      console.error('Error fetching certificates:', err)
    }
  }

  const handleFileUpload = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return

    setUploading(true)
    try {
      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i]
        const storagePath = `${vehicleId}/certificates/${Date.now()}_${file.name}`

        const { error: uploadError } = await supabase.storage
          .from('Certificate')
          .upload(storagePath, file)

        if (uploadError) {
          console.error('Upload error:', uploadError)
          continue
        }

        const { data: urlData } = supabase.storage
          .from('Certificate')
          .getPublicUrl(storagePath)

        if (!urlData?.publicUrl) continue

        const meta = JSON.stringify({
          name: file.name,
          url: urlData.publicUrl,
          type: file.type || 'application/octet-stream',
          size: file.size,
        })

        const { error: insertError } = await supabase
          .from('certificate')
          .insert({
            vehicleId,
            user_id: userId || null,
            certificate: meta,
          })

        if (insertError) {
          console.error('Insert error:', insertError)
        }
      }

      await fetchFiles()
    } catch (err) {
      console.error('Error uploading certificates:', err)
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async (rowId: string) => {
    if (!confirm('Are you sure you want to delete this certificate?')) return

    setDeleting(rowId)
    try {
      const { error } = await supabase
        .from('certificate')
        .delete()
        .eq('id', rowId)

      if (!error) {
        setFiles((prev) => prev.filter((f) => f.rowId !== rowId))
      }
    } catch (err) {
      console.error('Error deleting certificate:', err)
    } finally {
      setDeleting(null)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    handleFileUpload(e.dataTransfer.files)
  }

  const formatFileSize = (bytes: number) => {
    if (!bytes) return ''
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  return (
    <div className="bg-white rounded-xl shadow p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-1">Certificates</h2>
      <p className="text-sm text-gray-600 mb-6">
        Upload certificate images or documents for this vehicle (e.g. safety certificate, emission test, inspection).
      </p>

      {/* Upload Area */}
      <div
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
          dragOver ? 'border-[#118df0] bg-blue-50' : 'border-gray-300 hover:border-gray-400'
        }`}
      >
        <svg className="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>
        <p className="text-gray-600 mb-2">Drag and drop files here, or click to select</p>
        <p className="text-xs text-gray-500 mb-4">Supports images (JPG, PNG, WEBP) and PDF</p>
        <input
          type="file"
          multiple
          accept="image/*,.pdf"
          onChange={(e) => handleFileUpload(e.target.files)}
          className="hidden"
          id="certificate-upload"
        />
        <label
          htmlFor="certificate-upload"
          className="inline-block bg-[#118df0] text-white px-6 py-2 rounded-lg font-medium hover:bg-[#0d6ebd] transition-colors cursor-pointer"
        >
          {uploading ? 'Uploading...' : 'Select Files'}
        </label>
      </div>

      {/* Files Grid */}
      {files.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Uploaded Certificates ({files.length})</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {files.map((file) => {
              const isImage = file.type.startsWith('image/')
              return (
                <div key={file.rowId} className="group relative rounded-lg border border-gray-200 overflow-hidden bg-gray-50 hover:border-[#118df0] transition-colors">
                  {/* Thumbnail */}
                  <div
                    className="relative h-32 flex items-center justify-center cursor-pointer bg-white"
                    onClick={() => setPreview({ url: file.url, type: file.type, name: file.name })}
                  >
                    {isImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={file.url} alt={file.name} className="h-full w-full object-cover" />
                    ) : (
                      <svg className="w-12 h-12 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                    )}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <span className="text-white text-xs font-medium">View</span>
                    </div>
                  </div>

                  {/* Info + Actions */}
                  <div className="p-2">
                    <p className="text-xs font-medium text-gray-800 truncate" title={file.name}>{file.name}</p>
                    {file.size > 0 && <p className="text-xs text-gray-400 mt-0.5">{formatFileSize(file.size)}</p>}
                    <div className="flex items-center gap-1 mt-2">
                      <a
                        href={file.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 text-center text-xs text-[#118df0] hover:underline py-1"
                      >
                        Open
                      </a>
                      <button
                        onClick={() => handleDelete(file.rowId)}
                        disabled={deleting === file.rowId}
                        className="text-xs text-red-500 hover:text-red-700 px-2 py-1 disabled:opacity-50"
                      >
                        {deleting === file.rowId ? '...' : 'Delete'}
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {files.length === 0 && !uploading && (
        <div className="mt-6 text-center text-gray-500 py-8">
          <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
          </svg>
          <p>No certificates uploaded yet.</p>
          <p className="text-sm mt-2">Upload safety certificates, inspection reports, or other certificate documents.</p>
        </div>
      )}

      {/* Preview Modal */}
      {preview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
          onClick={() => setPreview(null)}
        >
          <div
            className="relative max-w-4xl max-h-[90vh] rounded-xl overflow-hidden bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <span className="text-sm font-medium text-gray-800 truncate max-w-xs">{preview.name}</span>
              <button onClick={() => setPreview(null)} className="ml-4 text-gray-500 hover:text-gray-800 text-xl leading-none">×</button>
            </div>
            <div className="p-4 overflow-auto max-h-[80vh] flex items-center justify-center">
              {preview.type.startsWith('image/') ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview.url} alt={preview.name} className="max-w-full max-h-full object-contain" />
              ) : (
                <iframe src={preview.url} className="w-[720px] h-[540px]" title={preview.name} />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
