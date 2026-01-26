'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'

interface Vehicle {
  id: string
  make: string
  model: string
  year: number
  images: string[]
}

export default function AdminVehiclePhotosPage() {
  const params = useParams()
  const router = useRouter()
  const [vehicle, setVehicle] = useState<Vehicle | null>(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const BUCKET = 'vehicle-photos'

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

  useEffect(() => {
    const sessionStr = localStorage.getItem('edc_admin_session')
    if (!sessionStr) {
      router.push('/admin')
      return
    }
    fetchVehicle()
  }, [params.id])

  const fetchVehicle = async () => {
    try {
      const { data, error } = await supabase
        .from('edc_vehicles')
        .select('id, make, model, year, images')
        .eq('id', String(params.id))
        .maybeSingle()

      if (error || !data) {
        router.push('/admin/inventory')
        return
      }

      setVehicle({
        id: data.id,
        make: data.make,
        model: data.model,
        year: data.year,
        images: Array.isArray(data.images) ? data.images : [],
      })
    } catch (error) {
      console.error('Error fetching vehicle:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return

    setUploading(true)

    const files = Array.from(e.target.files)

    try {
      const uploadedUrls: string[] = []

      for (const file of files) {
        const fileName = `${Date.now()}_${file.name}`
        const objectPath = `${String(params.id)}/${fileName}`

        const { error: uploadError } = await supabase.storage.from(BUCKET).upload(objectPath, file, {
          upsert: false,
          contentType: file.type || undefined,
        })

        if (uploadError) {
          console.error('Upload error:', uploadError)
          continue
        }

        const { data: publicData } = supabase.storage.from(BUCKET).getPublicUrl(objectPath)
        if (publicData?.publicUrl) uploadedUrls.push(publicData.publicUrl)
      }

      if (uploadedUrls.length === 0) {
        alert('No photos uploaded')
        return
      }

      const updatedImages = [...(vehicle?.images || []), ...uploadedUrls]
      const { error: dbError } = await supabase
        .from('edc_vehicles')
        .update({ images: updatedImages })
        .eq('id', String(params.id))

      if (dbError) {
        console.error('DB update error:', dbError)
        alert('Uploaded files, but failed to save to vehicle')
        return
      }

      setVehicle((prev) => (prev ? { ...prev, images: updatedImages } : prev))
      // After successful upload, go to Disclosures tab
      router.push(`/admin/inventory/${String(params.id)}?tab=disclosures`)
    } catch (error) {
      console.error('Error uploading photos:', error)
    } finally {
      setUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleDeletePhoto = async (photoPath: string) => {
    if (!vehicle) return
    
    if (!confirm('Are you sure you want to delete this photo? This cannot be undone.')) {
      return
    }
    
    setDeleting(photoPath)
    
    try {
      const storagePath = getStoragePathFromPublicUrl(photoPath)
      if (storagePath) {
        const { error: storageError } = await supabase.storage.from(BUCKET).remove([storagePath])
        if (storageError) console.error('Storage delete error:', storageError)
      }

      const updatedImages = vehicle.images.filter((img) => img !== photoPath)
      const { error: dbError } = await supabase
        .from('edc_vehicles')
        .update({ images: updatedImages })
        .eq('id', String(params.id))

      if (dbError) {
        alert('Failed to delete photo')
        return
      }

      setVehicle({ ...vehicle, images: updatedImages })
    } catch (error) {
      console.error('Error deleting photo:', error)
      alert('Failed to delete photo')
    } finally {
      setDeleting(null)
    }
  }

  const handleSetMainPhoto = async (photoPath: string) => {
    if (!vehicle) return
    
    try {
      // Reorder images array to put the selected image first
      const updatedImages = [photoPath, ...vehicle.images.filter(img => img !== photoPath)]

      const { error } = await supabase
        .from('edc_vehicles')
        .update({ images: updatedImages })
        .eq('id', String(params.id))

      if (error) {
        alert('Failed to update main photo')
        return
      }

      setVehicle({ ...vehicle, images: updatedImages })
    } catch (error) {
      console.error('Error setting main photo:', error)
      alert('Failed to update main photo')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-[#118df0] border-t-transparent rounded-full"></div>
      </div>
    )
  }

  if (!vehicle) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="w-full px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-gray-900">
                Photos: {vehicle.year} {vehicle.make} {vehicle.model}
              </h1>
            </div>
            <Link
              href={`/admin/inventory/${params.id}`}
              className="text-[#118df0] font-medium hover:underline"
            >
              Edit Details
            </Link>
          </div>
        </div>
      </div>

      <div className="w-full px-4 sm:px-6 lg:px-8 py-8">
        {/* Upload Section */}
        <div className="bg-white rounded-xl shadow p-6 mb-8">
          <h2 className="text-lg font-semibold mb-4">Upload Photos</h2>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileSelect}
            className="hidden"
            id="photo-upload"
          />
          <label
            htmlFor="photo-upload"
            className={`block border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-[#118df0] transition-colors ${
              uploading ? 'opacity-50 pointer-events-none' : ''
            }`}
          >
            {uploading ? (
              <div className="flex items-center justify-center">
                <div className="animate-spin w-6 h-6 border-4 border-[#118df0] border-t-transparent rounded-full mr-3"></div>
                <span>Uploading...</span>
              </div>
            ) : (
              <>
                <svg className="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p className="text-gray-600">Click to select photos or drag and drop</p>
                <p className="text-sm text-gray-400 mt-1">You can select multiple photos at once</p>
              </>
            )}
          </label>
        </div>

        {/* Photo Gallery */}
        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="text-lg font-semibold mb-4">
            Current Photos ({vehicle.images?.length || 0})
          </h2>

          {vehicle.images && vehicle.images.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {vehicle.images.map((image, index) => (
                <div key={index} className="relative group">
                  <div className="aspect-video bg-gray-200 rounded-lg overflow-hidden">
                    <img
                      src={image}
                      alt={`Photo ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  
                  {/* Delete Button */}
                  <button
                    onClick={() => handleDeletePhoto(image)}
                    disabled={deleting === image}
                    className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 disabled:opacity-50"
                  >
                    {deleting === image ? (
                      <div className="w-5 h-5 animate-spin border-2 border-white border-t-transparent rounded-full"></div>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    )}
                  </button>
                  
                  {/* Main Photo Badge or Set as Main Button */}
                  {index === 0 ? (
                    <span className="absolute bottom-2 left-2 bg-[#118df0] text-white text-xs px-2 py-1 rounded font-medium">
                      ⭐ Main Photo
                    </span>
                  ) : (
                    <button
                      onClick={() => handleSetMainPhoto(image)}
                      className="absolute bottom-2 left-2 bg-white/90 hover:bg-[#118df0] hover:text-white text-gray-700 text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-all font-medium"
                    >
                      Set as Main
                    </button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500">
              <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p>No photos uploaded yet</p>
              <p className="text-sm mt-1">Upload photos to make this listing more attractive</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
