
'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
// phase3Mock removed — reservation status now comes from edc_vehicles.status

interface Vehicle {
  id: string
  make: string
  model: string
  series: string
  year: number
  price: number
  mileage: number
  odometer?: number
  odometerUnit?: string
  fuelType: string
  transmission: string
  bodyStyle: string
  exteriorColor: string
  interiorColor: string
  vin: string
  stockNumber: string
  engine: string
  drivetrain: string
  doors: number
  seats: number
  features: string[]
  description: string
  images: string[]
  status: string
  city: string
  province: string
  inventoryType?: string
  vehicleId?: string
  category?: string
}

export default function VehicleDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [vehicle, setVehicle] = useState<Vehicle | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedImage, setSelectedImage] = useState(0)
  const [showInquiryForm, setShowInquiryForm] = useState(false)
  const [showTestDriveModal, setShowTestDriveModal] = useState(false)
  const [downPayment, setDownPayment] = useState(2000)
  const [termLength, setTermLength] = useState(60)
  const [openFaq, setOpenFaq] = useState<number | null>(null)
  const [disclosureModal, setDisclosureModal] = useState<'premier' | 'private' | 'fleet' | 'dealership' | null>(null)
  const [carfaxModal, setCarfaxModal] = useState<{
    open: boolean
    loading: boolean
    files: { name: string; path: string; publicUrl: string }[]
    activeIndex: number
  }>({ open: false, loading: false, files: [], activeIndex: 0 })
  const [carfaxAvailable, setCarfaxAvailable] = useState<boolean | null>(null)
  const [certAvailable, setCertAvailable] = useState<boolean | null>(null)

  const [certModal, setCertModal] = useState<{
    open: boolean
    loading: boolean
    files: { name: string; publicUrl: string }[]
    activeIndex: number
  }>({ open: false, loading: false, files: [], activeIndex: 0 })

  const openCertModal = async (vehicleId: string) => {
    setCertModal({ open: true, loading: true, files: [], activeIndex: 0 })
    try {
      // Try both the vehicleId field and the URL param id as fallback
      const urlId = String(params.id || '')
      const idsToTry = Array.from(new Set([vehicleId, urlId].filter(Boolean)))

      let rows: any[] = []
      for (const id of idsToTry) {
        const { data, error } = await supabase
          .from('certificate')
          .select('id, certificate')
          .eq('vehicleId', id)
          .order('created_at', { ascending: true })

        console.log('[CertModal] trying vehicleId:', id, 'data:', data, 'error:', error)

        if (!error && Array.isArray(data) && data.length > 0) {
          rows = data
          break
        }
      }

      if (rows.length === 0) {
        setCertModal({ open: true, loading: false, files: [], activeIndex: 0 })
        return
      }

      const files: { name: string; publicUrl: string }[] = rows.map((row: any) => {
        try {
          const meta = JSON.parse(row.certificate)
          return { name: String(meta?.name || 'certificate'), publicUrl: String(meta?.url || '') }
        } catch {
          return { name: row.certificate.split('/').pop() ?? 'certificate', publicUrl: row.certificate }
        }
      }).filter((f) => !!f.publicUrl)

      setCertModal({ open: true, loading: false, files, activeIndex: 0 })
    } catch {
      setCertModal({ open: true, loading: false, files: [], activeIndex: 0 })
    }
  }
  const [inquiryForm, setInquiryForm] = useState({
    name: '',
    email: '',
    phone: '',
    message: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const [isVerified, setIsVerified] = useState(false)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  // Reservation status comes from vehicle.status in DB (Reserved / Sold / In Stock)

  const API_URL = process.env.NEXT_PUBLIC_API_URL || ''

  const openCarfaxModal = async (vehicleId: string) => {
    setCarfaxModal({ open: true, loading: true, files: [], activeIndex: 0 })
    try {
      const { data, error } = await supabase.storage
        .from('Carfax')
        .list(vehicleId, { limit: 100, sortBy: { column: 'name', order: 'asc' } })

      if (error || !Array.isArray(data) || data.length === 0) {
        setCarfaxModal({ open: true, loading: false, files: [], activeIndex: 0 })
        return
      }

      const files = data
        .filter((f) => !!f?.name && !String(f.name).endsWith('/'))
        .map((f) => {
          const path = `${vehicleId}/${f.name}`
          const { data: urlData } = supabase.storage.from('Carfax').getPublicUrl(path)
          return { name: f.name, path, publicUrl: urlData.publicUrl }
        })

      setCarfaxModal({ open: true, loading: false, files, activeIndex: 0 })
    } catch {
      setCarfaxModal({ open: true, loading: false, files: [], activeIndex: 0 })
    }
  }

  const [bucketImageCache] = useState(() => new Map<string, string[]>())

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
    const head = v.slice(0, 10)
    let mime = 'image/jpeg'
    if (head.startsWith('iVBOR')) mime = 'image/png'
    else if (head.startsWith('R0lGOD')) mime = 'image/gif'
    else if (head.startsWith('UklGR')) mime = 'image/webp'
    return `data:${mime};base64,${v}`
  }

  const formatLocation = (city?: string, province?: string) => {
    const c = String(city || '').trim()
    const p = String(province || '').trim()
    if (c && p) return `${c}, ${p}`
    if (c) return c
    if (p) return p
    return ''
  }

  const formatOdometer = (v: Vehicle) => {
    const value = Number((v.odometer ?? v.mileage) || 0)
    const unitRaw = String(v.odometerUnit || '').trim().toLowerCase()
    const unit = unitRaw === 'miles' || unitRaw === 'mi' ? 'mi' : 'km'
    return `${value.toLocaleString()} ${unit}`
  }

  const odometerLabel = (v: Vehicle) => {
    const unitRaw = String(v.odometerUnit || '').trim().toLowerCase()
    const unit = unitRaw === 'miles' || unitRaw === 'mi' ? 'Miles' : 'Kilometers'
    return unit
  }

  const normalizeFeatures = (raw: any): string[] => {
    if (!raw) return []
    if (Array.isArray(raw)) return raw.map(String).map(s => s.trim()).filter(Boolean)
    if (typeof raw === 'string') {
      const s = raw.trim()
      if (!s) return []
      try {
        const parsed = JSON.parse(s)
        if (Array.isArray(parsed)) return parsed.map(String).map(x => x.trim()).filter(Boolean)
      } catch {
        // ignore
      }
      return s
        .split('|')
        .join(',')
        .split(',')
        .map(x => x.trim())
        .filter(Boolean)
    }
    return []
  }

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsVerified(window.localStorage.getItem('edc_account_verified') === 'true')
    }
  }, [])

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getSession()
      setUserEmail(data.session?.user?.email || null)
    }
    void init()
  }, [])

  useEffect(() => {
    if (!vehicle?.id) return
  }, [vehicle?.id, userEmail])

  useEffect(() => {
    if (params.id) {
      fetchVehicle()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id])

  const fetchVehicle = async () => {
    try {
      const { data, error } = await supabase
        .from('edc_vehicles')
        .select('*')
        .eq('id', String(params.id))
        .maybeSingle()

      if (error) {
        console.error('Supabase error fetching vehicle:', error)
      }

      if (error || !data) {
        setVehicle(null)
        return
      }

      const loadBucketImages = async (vehicleId: string): Promise<string[]> => {
        const id = String(vehicleId || '').trim()
        if (!id) return []
        const cached = bucketImageCache.get(id)
        if (cached) return cached

        try {
          const { data, error: listError } = await supabase.storage
            .from('vehicle-photos')
            .list(id, {
              limit: 100,
              sortBy: { column: 'name', order: 'asc' },
            })

          if (listError || !Array.isArray(data) || data.length === 0) {
            bucketImageCache.set(id, [])
            return []
          }

          const files = data
            .filter((f) => !!f?.name && !String(f.name).endsWith('/'))
            .map((f) => `${id}/${f.name}`)

          const urls: string[] = []
          for (const path of files) {
            const pub = supabase.storage.from('vehicle-photos').getPublicUrl(path)
            const publicUrl = String(pub?.data?.publicUrl || '').trim()
            if (publicUrl) {
              urls.push(publicUrl)
              continue
            }

            const { data: signed } = await supabase.storage
              .from('vehicle-photos')
              .createSignedUrl(path, 60 * 60)
            const signedUrl = String((signed as any)?.signedUrl || '').trim()
            if (signedUrl) urls.push(signedUrl)
          }

          bucketImageCache.set(id, urls)
          return urls
        } catch {
          bucketImageCache.set(id, [])
          return []
        }
      }

      const anyData = data as any
      const mapped: Vehicle = {
        id: String(anyData.id || ''),
        make: String(anyData.make || ''),
        model: String(anyData.model || ''),
        series: String(anyData.series || ''),
        year: Number(anyData.year || 0),
        price: Number(anyData.price || 0),
        mileage: Number((anyData.odometer ?? anyData.mileage) || 0),
        odometer: anyData.odometer === null || anyData.odometer === undefined ? undefined : Number(anyData.odometer || 0),
        odometerUnit: String(anyData.odometer_unit ?? anyData.odometerUnit ?? ''),
        fuelType: String(anyData.fuel_type ?? anyData.fuelType ?? ''),
        transmission: String(anyData.transmission || ''),
        bodyStyle: String(anyData.body_style ?? anyData.bodyStyle ?? ''),
        exteriorColor: String(anyData.exterior_color ?? anyData.exteriorColor ?? ''),
        interiorColor: String(anyData.interior_color ?? anyData.interiorColor ?? ''),
        vin: String(anyData.vin || ''),
        stockNumber: String(anyData.stock_number ?? anyData.stockNumber ?? ''),
        engine: String(anyData.engine || ''),
        drivetrain: String(anyData.drivetrain || ''),
        doors: Number(anyData.doors || 0),
        seats: Number(anyData.seats || 0),
        features: normalizeFeatures(anyData.features),
        description: String(anyData.description || anyData.ad_description || anyData.adDescription || ''),
        images: await loadBucketImages(String(anyData.id || params.id || '')),
        status: String(anyData.status || ''),
        city: String(anyData.city || ''),
        province: String(anyData.province || ''),
        inventoryType: String(anyData.inventory_type ?? anyData.inventoryType ?? ''),
        vehicleId: String(anyData.vehicleId || anyData.vehicle_id || anyData.id || ''),
        category: (() => {
          const c = String(anyData.categories || anyData.category || '').trim().toLowerCase()
          if (c === 'premiere' || c === 'premier') return 'premier'
          if (c === 'fleet') return 'fleet'
          if (c === 'private') return 'private'
          if (c === 'dealership') return 'dealership'
          const inv = String(anyData.inventory_type || '').trim().toLowerCase()
          if (inv === 'premiere' || inv === 'premier') return 'premier'
          if (inv === 'fleet') return 'fleet'
          if (inv === 'private') return 'private'
          if (inv === 'dealership') return 'dealership'
          return 'premier' // default
        })(),
      }

      setVehicle(mapped)
    } catch (_error) {
      console.error('Error fetching vehicle:', _error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!vehicle) {
      setCarfaxAvailable(null)
      return
    }
    const lookupId = vehicle.vehicleId || vehicle.id
    supabase.storage
      .from('Carfax')
      .list(lookupId, { limit: 1 })
      .then(({ data }) => {
        const hasFiles = Array.isArray(data) && data.some((f) => !!f?.name && !String(f.name).endsWith('/'))
        setCarfaxAvailable(hasFiles)
      })
      .catch(() => setCarfaxAvailable(false))
  }, [vehicle])

  useEffect(() => {
    if (!vehicle) {
      setCertAvailable(null)
      return
    }
    const lookupId = vehicle.vehicleId || vehicle.id
    const checkCert = async () => {
      try {
        const { count } = await supabase
          .from('certificate')
          .select('id', { count: 'exact', head: true })
          .eq('vehicleId', lookupId)
        setCertAvailable((count ?? 0) > 0)
      } catch {
        setCertAvailable(false)
      }
    }
    checkCert()
  }, [vehicle])

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: 'CAD',
      minimumFractionDigits: 0,
    }).format(price)
  }

  const handleInquirySubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    try {
      const res = await fetch(`${API_URL}/api/leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...inquiryForm,
          vehicleInterest: vehicle ? `${vehicle.year} ${vehicle.make} ${vehicle.model}` : '',
          source: 'vehicle_inquiry',
        }),
      })

      if (res.ok) {
        setSubmitted(true)
        setShowInquiryForm(false)
      }
    } catch (_error) {
      console.error('Error submitting inquiry:', _error)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-48 mb-6"></div>
            <div className="h-[500px] bg-gray-200 rounded-2xl mb-4"></div>
            <div className="flex gap-2 mb-8">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="w-24 h-20 bg-gray-200 rounded-xl"></div>
              ))}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-4">
                <div className="h-8 bg-gray-200 rounded w-3/4"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!vehicle) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="glass-card rounded-2xl p-12 text-center">
          <div className="icon-container mx-auto mb-6">
            <svg className="w-8 h-8 text-[#118df0]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Vehicle Not Found</h2>
          <p className="text-gray-500 mb-6">This vehicle may have been sold or removed.</p>
          <Link href="/inventory" className="btn-primary inline-flex items-center">
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Inventory
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Breadcrumb */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <nav className="flex items-center gap-1 text-sm text-gray-500">
          <Link href="/" className="hover:text-[#118df0] transition-colors">Home</Link>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          <Link href="/inventory" className="hover:text-[#118df0] transition-colors">Inventory</Link>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          <span className="text-gray-900 font-medium">{vehicle.year} {vehicle.make} {vehicle.model}</span>
        </nav>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">

          {/* LEFT COLUMN */}
          <div className="lg:col-span-3 space-y-5">

            {/* Main Image */}
            <div className="relative rounded-xl overflow-hidden bg-gray-100" style={{ aspectRatio: '16/10' }}>
              {vehicle.images && vehicle.images.length > 0 ? (
                <img
                  src={toImageSrc(vehicle.images[selectedImage])}
                  alt={`${vehicle.year} ${vehicle.make} ${vehicle.model}`}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center min-h-[280px]">
                  <svg className="w-20 h-20 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
              )}
              {vehicle.images && vehicle.images.length > 1 && (
                <>
                  <button
                    onClick={() => setSelectedImage(selectedImage === 0 ? vehicle.images.length - 1 : selectedImage - 1)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 bg-white/80 rounded-full flex items-center justify-center shadow hover:bg-white transition-colors"
                  >
                    <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                  </button>
                  <button
                    onClick={() => setSelectedImage(selectedImage === vehicle.images.length - 1 ? 0 : selectedImage + 1)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 bg-white/80 rounded-full flex items-center justify-center shadow hover:bg-white transition-colors"
                  >
                    <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                  </button>
                  <div className="absolute bottom-3 right-3 bg-black/50 text-white text-xs px-2.5 py-1 rounded-lg font-medium">
                    {selectedImage + 1} / {vehicle.images.length}
                  </div>
                </>
              )}
            </div>

            {/* Thumbnails */}
            {vehicle.images && vehicle.images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {vehicle.images.map((img, index) => (
                  <button
                    key={index}
                    onClick={() => setSelectedImage(index)}
                    className={`flex-shrink-0 w-20 h-16 rounded-lg overflow-hidden border-2 transition-all ${
                      selectedImage === index ? 'border-[#118df0]' : 'border-transparent opacity-60 hover:opacity-100'
                    }`}
                  >
                    <img src={toImageSrc(img)} alt={`View ${index + 1}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}

            {/* Quick Stats */}
            <div className="grid grid-cols-2 gap-4">
              <div className="border border-gray-100 rounded-xl p-5 text-center">
                <div className="flex justify-center mb-2">
                  <svg className="w-6 h-6 text-[#118df0]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <p className="text-xl font-bold text-gray-900">{formatOdometer(vehicle)}</p>
                <p className="text-xs text-[#118df0] mt-0.5">{odometerLabel(vehicle)}</p>
              </div>
              <div className="border border-gray-100 rounded-xl p-5 text-center">
                <div className="flex justify-center mb-2">
                  <svg className="w-6 h-6 text-[#118df0]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <p className="text-xl font-bold text-gray-900">{vehicle.year}</p>
                <p className="text-xs text-[#118df0] mt-0.5">Year</p>
              </div>
            </div>

            {/* Vehicle Specifications */}
            <div>
              <h2 className="text-lg font-bold text-gray-900 mb-5 flex items-center gap-2">
                <span className="w-1 h-5 bg-[#118df0] rounded-full inline-block" />
                Vehicle Specifications
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {([
                  { label: 'Make', value: vehicle.make },
                  { label: 'Model', value: vehicle.model },
                  { label: 'Year', value: String(vehicle.year) },
                  { label: 'Odometer', value: formatOdometer(vehicle) },
                  vehicle.transmission ? { label: 'Transmission', value: vehicle.transmission } : null,
                  vehicle.drivetrain ? { label: 'Drivetrain', value: vehicle.drivetrain } : null,
                  vehicle.fuelType ? { label: 'Fuel', value: vehicle.fuelType } : null,
                  vehicle.engine ? { label: 'Engine', value: vehicle.engine } : null,
                  vehicle.exteriorColor ? { label: 'Colour', value: vehicle.exteriorColor } : null,
                  vehicle.doors ? { label: 'Doors', value: String(vehicle.doors) } : null,
                  vehicle.bodyStyle ? { label: 'Body Style', value: vehicle.bodyStyle } : null,
                  vehicle.vin ? { label: 'VIN', value: vehicle.vin } : null,
                  vehicle.stockNumber ? { label: 'Stock #', value: vehicle.stockNumber } : null,
                ] as ({ label: string; value: string } | null)[]).filter((s): s is { label: string; value: string } => !!s).map((spec) => (
                  <div key={spec.label} className="border border-gray-200 rounded-xl p-4 bg-white">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-[#118df0] mb-1">{spec.label}</p>
                    <p className="text-sm font-semibold text-gray-900 break-words">{spec.value}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* About this vehicle */}
            {vehicle.description && (
              <div className="border border-gray-100 rounded-xl p-6">
                <h2 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
                  <span className="w-1 h-5 bg-[#118df0] rounded-full inline-block" />
                  About this vehicle
                </h2>
                <p className="text-gray-700 leading-relaxed whitespace-pre-line text-sm">{vehicle.description}</p>
              </div>
            )}

            {/* Features */}
            {vehicle.features && vehicle.features.length > 0 && (
              <div className="border border-gray-100 rounded-xl p-6">
                <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <span className="w-1 h-5 bg-[#118df0] rounded-full inline-block" />
                  Features
                </h2>
                <div className="grid grid-cols-2 gap-y-2.5 gap-x-4">
                  {vehicle.features.map((feature, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-sm text-gray-700">{feature}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Financing FAQ */}
            <div className="border border-gray-100 rounded-xl p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-1 flex items-center gap-2">
                <span className="w-1 h-5 bg-[#118df0] rounded-full inline-block" />
                Financing — frequently asked
              </h2>
              <p className="text-sm text-gray-500 mb-4">
                Quick answers about how financing works on this vehicle. For the full list see our{' '}
                <Link href="/financing" className="text-[#118df0] hover:underline">financing page</Link>.
              </p>
              <div className="divide-y divide-gray-100">
                {[
                  { q: 'Will I get approved for a car loan?', a: 'We work with a wide network of lenders and help customers with all credit types — good, bad, or no credit history. Approval depends on your income, credit, and the vehicle.' },
                  { q: 'How do I know what my interest rate will be?', a: "Your rate depends on your credit profile, the loan term, and the lender. Rates typically range from 7.99% to 29.99% APR. We'll find you the best rate available." },
                  { q: 'Does submitting a financing application impact my credit score?', a: 'A pre-approval soft check does not affect your credit. A full application may result in a hard inquiry, which has a minor and temporary impact.' },
                  { q: 'Do all loans require a down payment?', a: 'Not always. Some approvals require no down payment. However, putting money down reduces your monthly payments and total interest paid.' },
                  { q: 'Can I pay off my loan at any time?', a: "Yes — most of our lenders allow early repayment. Some loans may have a small prepayment penalty; we'll make sure you know the details before signing." },
                  { q: 'How long does a financing approval take?', a: 'Many approvals come back within hours. In most cases, we can have you approved and in your vehicle within 1–2 business days.' },
                ].map((item, i) => (
                  <div key={i}>
                    <button
                      className="w-full text-left py-4 flex items-center justify-between gap-4"
                      onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    >
                      <span className="text-sm font-medium text-gray-800">{item.q}</span>
                      <svg className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform duration-200 ${openFaq === i ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    {openFaq === i && (
                      <p className="pb-4 text-sm text-gray-600 leading-relaxed pr-6">{item.a}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* RIGHT COLUMN — Sticky */}
          <div className="lg:col-span-2">
            <div className="sticky top-24 space-y-4">

              {/* Main Info Card */}
              <div className="border border-gray-100 rounded-xl p-6 shadow-sm">
                <h1 className="text-2xl font-bold text-gray-900">{vehicle.year} {vehicle.make} {vehicle.model}</h1>
                {formatLocation(vehicle.city, vehicle.province) && (
                  <p className="text-sm text-gray-500 flex items-center gap-1 mt-1">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    </svg>
                    {formatLocation(vehicle.city, vehicle.province)}
                  </p>
                )}
                {vehicle.category && (
                  <span className={`inline-block mt-2 px-3 py-1 rounded-full text-xs font-bold tracking-wide ${
                    vehicle.category === 'premier' ? 'bg-[#118df0] text-white' :
                    vehicle.category === 'fleet' ? 'bg-gray-700 text-white' :
                    vehicle.category === 'private' ? 'bg-yellow-400 text-gray-900' :
                    'bg-[#8b5cf6] text-white'
                  }`}>
                    {vehicle.category === 'premier' ? 'EDC PREMIER' :
                     vehicle.category === 'fleet' ? 'FLEET SELECT' :
                     vehicle.category === 'private' ? 'PRIVATE SELLER' : 'DEALER SELECT'}
                  </span>
                )}

                {/* Price + Status */}
                <div className="flex items-center gap-3 mt-4">
                  <div className="bg-[#118df0] text-white text-2xl font-bold px-5 py-2.5 rounded-xl">
                    {formatPrice(vehicle.price)}
                  </div>
                  {vehicle.status && (() => {
                    const s = vehicle.status.toLowerCase()
                    const isSold = s === 'sold'
                    const isHeld = s === 'on hold' || s === 'on_hold' || s === 'hold'
                    return (
                      <span className={`flex items-center gap-1.5 text-sm font-medium ${isSold ? 'text-red-600' : isHeld ? 'text-amber-600' : 'text-green-600'}`}>
                        <span className={`w-2 h-2 rounded-full ${isSold ? 'bg-red-500' : isHeld ? 'bg-amber-500' : 'bg-green-500'}`} />
                        {isSold ? 'Sold' : isHeld ? 'On Hold' : 'In Stock'}
                      </span>
                    )
                  })()}
                </div>

                {/* Action Buttons */}
                <div className="mt-5 space-y-2.5">
                  <button
                    type="button"
                    onClick={() => router.push(`/purchase/${vehicle.id}`)}
                    disabled={vehicle.status?.toLowerCase() === 'reserved' || vehicle.status?.toLowerCase() === 'sold'}
                    className={`w-full py-3 rounded-xl font-semibold text-sm transition-colors ${
                      vehicle.status?.toLowerCase() === 'sold'
                        ? 'bg-red-100 text-red-400 cursor-not-allowed'
                        : vehicle.status?.toLowerCase() === 'reserved'
                        ? 'bg-amber-100 text-amber-700 cursor-not-allowed'
                        : 'bg-gray-900 hover:bg-gray-800 text-white'
                    }`}
                  >
                    {vehicle.status?.toLowerCase() === 'sold'
                      ? 'This vehicle has been sold'
                      : vehicle.status?.toLowerCase() === 'reserved'
                      ? '🔒 Reserved — Purchase Pending'
                      : 'Buy Online — $1,000 Deposit'}
                  </button>

                  {carfaxAvailable && (
                    <button
                      type="button"
                      onClick={() => openCarfaxModal(vehicle.vehicleId || vehicle.id)}
                      className="w-full py-3 rounded-xl font-semibold text-sm border border-red-300 bg-red-50 hover:bg-red-100 text-red-700 flex items-center justify-center gap-2 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                      View CARFAX Report
                    </button>
                  )}

                  {certAvailable && (
                    <button
                      type="button"
                      onClick={() => openCertModal(vehicle.vehicleId || vehicle.id)}
                      className="w-full py-3 rounded-xl font-semibold text-sm border border-blue-300 bg-blue-50 hover:bg-blue-100 text-blue-700 flex items-center justify-center gap-2 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" /></svg>
                      Safety Certificate
                    </button>
                  )}

                  {(() => {
                    const cat = String(vehicle.category || 'premier').toLowerCase()
                    const styles =
                      cat === 'fleet' ? 'border-gray-300 bg-gray-50 hover:bg-gray-100 text-gray-800' :
                      cat === 'private' ? 'border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-800' :
                      cat === 'dealership' || cat === 'dealer' ? 'border-violet-300 bg-violet-50 hover:bg-violet-100 text-violet-800' :
                      'border-blue-300 bg-blue-50 hover:bg-blue-100 text-[#118df0]'
                    return (
                  <button
                    onClick={() => {
                      if (cat === 'fleet') setDisclosureModal('fleet')
                      else if (cat === 'private') setDisclosureModal('private')
                      else if (cat === 'dealership' || cat === 'dealer') setDisclosureModal('dealership')
                      else setDisclosureModal('premier')
                    }}
                    className={`w-full py-3 rounded-xl font-semibold text-sm border flex items-center justify-center gap-2 transition-colors ${styles}`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                    View Important Disclosure
                  </button>
                    )
                  })()}

                  <button
                    onClick={() => setShowInquiryForm(!showInquiryForm)}
                    className="w-full py-3 rounded-xl font-semibold text-sm border border-gray-200 hover:bg-gray-50 text-gray-700 flex items-center justify-center gap-2 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                    Ask a Question
                  </button>

                  <a
                    href="tel:+16137772395"
                    className="w-full py-3 rounded-xl font-semibold text-sm border border-gray-200 hover:bg-gray-50 text-gray-700 flex items-center justify-center gap-2 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                    Call Us (613) 777-2395
                  </a>
                </div>

                {/* Inquiry Form */}
                {showInquiryForm && (
                  <form onSubmit={handleInquirySubmit} className="mt-5 pt-5 border-t border-gray-100 space-y-3">
                    <h3 className="text-sm font-semibold text-gray-900">Send an Inquiry</h3>
                    {(['name', 'email', 'phone'] as const).map((key) => (
                      <div key={key}>
                        <label className="block text-xs font-medium text-gray-600 mb-1 capitalize">{key}</label>
                        <input
                          type={key === 'email' ? 'email' : key === 'phone' ? 'tel' : 'text'}
                          required
                          value={inquiryForm[key]}
                          onChange={(e) => setInquiryForm({ ...inquiryForm, [key]: e.target.value })}
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#118df0]/30"
                        />
                      </div>
                    ))}
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Message</label>
                      <textarea
                        rows={3}
                        value={inquiryForm.message}
                        onChange={(e) => setInquiryForm({ ...inquiryForm, message: e.target.value })}
                        placeholder={`I'm interested in the ${vehicle.year} ${vehicle.make} ${vehicle.model}...`}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#118df0]/30 resize-none"
                      />
                    </div>
                    <button type="submit" disabled={submitting} className="w-full bg-[#118df0] hover:bg-[#0a7dd4] text-white py-2.5 rounded-lg text-sm font-semibold disabled:opacity-50 transition-colors">
                      {submitting ? 'Sending...' : 'Send Inquiry'}
                    </button>
                  </form>
                )}
                {submitted && (
                  <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700 flex items-center gap-2">
                    <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    Thank you! We&apos;ll be in touch soon.
                  </div>
                )}

                {/* Trust Badges */}
                <div className="mt-5 pt-5 border-t border-gray-100 space-y-2">
                  {carfaxAvailable && (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                      CARFAX Report Available
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    Safety Inspected
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                    Financing Available
                  </div>
                </div>
              </div>

              {/* Extended Warranty */}
              <div className="border border-gray-200 rounded-xl p-5 shadow-sm">
                <div className="flex items-start gap-3 mb-4">
                  <div className="w-9 h-9 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-[#118df0]" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                      <polyline points="9 12 11 14 15 10"/>
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-gray-900">Extended warranty available</h3>
                    <p className="text-xs text-gray-500 mt-0.5">12 A-Protect plans qualify for this vehicle.</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => router.push('/warranty')}
                    className="py-2.5 rounded-full text-sm font-semibold border border-gray-300 text-gray-800 hover:bg-gray-50 transition-colors"
                  >
                    View plans
                  </button>
                  <button
                    type="button"
                    onClick={() => router.push(`/purchase/${vehicle.id}`)}
                    className="py-2.5 rounded-full text-sm font-semibold bg-[#118df0] hover:bg-[#0a7dd4] text-white transition-colors"
                  >
                    Add at checkout
                  </button>
                </div>
              </div>

              {/* Payment Calculator */}
              <div className="border border-gray-100 rounded-xl p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-gray-900">Payment calculator</h3>
                  <span className="text-xs text-gray-400">Est. 7.99% APR OAC</span>
                </div>
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Down Payment</label>
                    <div className="flex items-center gap-1 border border-gray-200 rounded-lg px-2 py-1">
                      <span className="text-sm text-gray-500">$</span>
                      <input
                        type="number"
                        min={0}
                        max={Math.min(Math.round(vehicle.price * 0.5), 50000)}
                        step={100}
                        value={downPayment}
                        onChange={(e) => {
                          const v = Number(e.target.value) || 0
                          const cap = Math.min(Math.round(vehicle.price * 0.5), 50000)
                          setDownPayment(Math.max(0, Math.min(v, cap)))
                        }}
                        className="w-20 text-sm font-semibold text-gray-900 text-right focus:outline-none bg-transparent"
                      />
                    </div>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={Math.min(Math.round(vehicle.price * 0.5), 50000)}
                    step={500}
                    value={downPayment}
                    onChange={(e) => setDownPayment(Number(e.target.value))}
                    className="w-full accent-gray-900"
                  />
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {[0, 1000, 2500, 5000, 10000].map((amt) => {
                      const cap = Math.min(Math.round(vehicle.price * 0.5), 50000)
                      if (amt > cap) return null
                      return (
                        <button
                          key={amt}
                          onClick={() => setDownPayment(amt)}
                          className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                            downPayment === amt
                              ? 'bg-gray-900 text-white'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          ${amt.toLocaleString()}
                        </button>
                      )
                    })}
                  </div>
                </div>
                <div className="mb-5">
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2 block">Term Length</label>
                  <div className="flex gap-1.5 flex-wrap">
                    {[36, 48, 60, 72, 84].map((t) => (
                      <button
                        key={t}
                        onClick={() => setTermLength(t)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${termLength === t ? 'bg-[#118df0] text-white' : 'border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                      >
                        {t} mo
                      </button>
                    ))}
                  </div>
                </div>
                {(() => {
                  const loan = Math.max(0, vehicle.price - downPayment)
                  const r = 0.0799 / 12
                  const n = termLength
                  const monthly = loan > 0 ? (loan * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1) : 0
                  const biweekly = monthly * 12 / 26
                  return (
                    <div className="grid grid-cols-2 gap-3 mb-4">
                      <div className="bg-[#118df0]/5 rounded-xl p-4 text-center">
                        <p className="text-2xl font-bold text-[#118df0]">${Math.round(monthly).toLocaleString()}</p>
                        <p className="text-xs text-gray-500 mt-0.5">/ month</p>
                        <p className="text-[10px] text-gray-400">over {termLength} mo</p>
                      </div>
                      <div className="bg-gray-50 rounded-xl p-4 text-center">
                        <p className="text-2xl font-bold text-gray-700">${Math.round(biweekly).toLocaleString()}</p>
                        <p className="text-xs text-gray-500 mt-0.5">/ biweekly</p>
                        <p className="text-[10px] text-gray-400">26 payments / yr</p>
                      </div>
                    </div>
                  )
                })()}
                <button
                  onClick={() => router.push('/financing')}
                  className="w-full py-2.5 bg-white border border-gray-300 hover:bg-gray-50 text-gray-900 rounded-xl text-sm font-semibold transition-colors"
                >
                  Get pre-approved
                </button>
                <p className="text-[10px] text-gray-400 text-center mt-2">Estimate only. Final rate &amp; terms depend on lender approval.</p>
              </div>

              {/* Listing Type */}
              <div className="border border-gray-100 rounded-xl p-5 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Listing Type</p>
                  <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${
                    vehicle.category === 'premier' ? 'bg-[#118df0] text-white' :
                    vehicle.category === 'fleet' ? 'bg-gray-700 text-white' :
                    vehicle.category === 'private' ? 'bg-yellow-400 text-gray-900' :
                    'bg-[#8b5cf6] text-white'
                  }`}>
                    {vehicle.category === 'premier' ? 'EDC PREMIER' :
                     vehicle.category === 'fleet' ? 'FLEET SELECT' :
                     vehicle.category === 'private' ? 'PRIVATE SELLER' : 'DEALER SELECT'}
                  </span>
                </div>
                <p className="text-sm text-gray-600">Sold by <span className="font-medium text-gray-900">EasyDrive Canada</span></p>
              </div>

            </div>
          </div>

        </div>
      </div>

      {/* Test Drive Scheduling Modal - Only for non-fleet vehicles */}
      {showTestDriveModal && vehicle.inventoryType !== 'FLEET' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowTestDriveModal(false)}
          ></div>
          
          {/* Modal */}
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-8 flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Schedule a Test Drive</h2>
                <p className="text-sm text-gray-500 mt-1">
                  {vehicle.year} {vehicle.make} {vehicle.model}
                </p>
              </div>
              <button
                onClick={() => setShowTestDriveModal(false)}
                className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
              >
                <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {/* Calendar Widget */}
            <div className="overflow-y-auto flex-1 p-6">
              <iframe
                src="https://api.leadconnectorhq.com/widget/booking/v4xgBoz3TjpnjV7L7QK4"
                className="w-full border-0 rounded-lg"
                style={{ minHeight: '700px', height: '100%' }}
                title="Schedule Test Drive"
              ></iframe>
            </div>
          </div>
        </div>
      )}

      {/* Unified Disclosure Modal — 4 categories */}
      {disclosureModal && (() => {
        const cfg = {
          premier:     { accent: 'blue',   label: 'EDC Premier',      badge: 'bg-blue-100 text-blue-700',     header: 'border-blue-200 bg-blue-50',     title: 'text-blue-800',   sub: 'text-blue-700',   hover: 'hover:bg-blue-100',   icon: 'text-blue-600',   btn: 'bg-blue-500 hover:bg-blue-600' },
          private:     { accent: 'amber',  label: 'EDC Private',      badge: 'bg-amber-100 text-amber-700',   header: 'border-amber-200 bg-amber-50',   title: 'text-amber-800',  sub: 'text-amber-700',  hover: 'hover:bg-amber-100',  icon: 'text-amber-600',  btn: 'bg-amber-500 hover:bg-amber-600' },
          fleet:       { accent: 'gray',   label: 'EDC Fleet Select', badge: 'bg-gray-100 text-gray-700',     header: 'border-gray-200 bg-gray-50',     title: 'text-gray-800',   sub: 'text-gray-600',   hover: 'hover:bg-gray-100',   icon: 'text-gray-600',   btn: 'bg-gray-700 hover:bg-gray-800' },
          dealership:  { accent: 'violet', label: 'EDC Dealer Select', badge: 'bg-violet-100 text-violet-700', header: 'border-violet-200 bg-violet-50', title: 'text-violet-800', sub: 'text-violet-700', hover: 'hover:bg-violet-100', icon: 'text-violet-600', btn: 'bg-violet-500 hover:bg-violet-600' },
        }[disclosureModal]

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setDisclosureModal(null)} />
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-8 flex flex-col max-h-[90vh]">
              {/* Header */}
              <div className={`flex items-center justify-between px-6 py-4 border-b ${cfg.header} rounded-t-2xl flex-shrink-0`}>
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 ${cfg.badge} rounded-full flex items-center justify-center`}>
                    <svg className={`w-5 h-5 ${cfg.icon}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <div>
                    <h2 className={`text-lg font-bold ${cfg.title}`}>IMPORTANT DISCLOSURE</h2>
                    <p className={`text-sm ${cfg.sub}`}>Please Read Carefully</p>
                  </div>
                </div>
                <button onClick={() => setDisclosureModal(null)} className={`p-2 ${cfg.hover} rounded-xl transition-colors`}>
                  <svg className={`w-6 h-6 ${cfg.icon}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Content */}
              <div className="overflow-y-auto flex-1 p-6">
                <p className="text-gray-700 mb-6">
                  This vehicle is offered by EasyDrive Canada (EDC) as an <strong className={cfg.title}>{cfg.label}</strong> vehicle.
                </p>

                <div className="space-y-5 text-sm">

                  {/* PREMIER */}
                  {disclosureModal === 'premier' && <>
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                        <span className={`w-6 h-6 ${cfg.badge} rounded-full flex items-center justify-center text-xs font-bold`}>1</span>
                        Vehicle Status – EDC Premier
                      </h4>
                      <ul className="list-disc list-inside space-y-1 text-gray-600 ml-8">
                        <li>This vehicle is owned and stocked by EasyDrive Canada.</li>
                        <li>Viewing and test drives are available by appointment.</li>
                      </ul>
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                        <span className={`w-6 h-6 ${cfg.badge} rounded-full flex items-center justify-center text-xs font-bold`}>2</span>
                        Safety & Reconditioning
                      </h4>
                      <ul className="list-disc list-inside space-y-1 text-gray-600 ml-8">
                        <li>This vehicle will be sold with a valid Ontario Safety Standards Certificate prior to delivery.</li>
                        <li>Any required safety or reconditioning work has been completed or will be completed before delivery.</li>
                      </ul>
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                        <span className={`w-6 h-6 ${cfg.badge} rounded-full flex items-center justify-center text-xs font-bold`}>3</span>
                        Fees & Licensing (Mandatory)
                      </h4>
                      <ul className="list-disc list-inside space-y-1 text-gray-600 ml-8">
                        <li>All transactions are subject to the mandatory OMVIC fee of <strong>$22 + HST</strong> per transaction, shown separately on the Bill of Sale.</li>
                        <li>A licensing fee of <strong>$59</strong> applies to every transaction and will be shown separately on the Bill of Sale.</li>
                      </ul>
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                        <span className={`w-6 h-6 ${cfg.badge} rounded-full flex items-center justify-center text-xs font-bold`}>4</span>
                        CARFAX Disclosure
                      </h4>
                      <ul className="list-disc list-inside space-y-1 text-gray-600 ml-8">
                        <li>A CARFAX report will be provided to the client prior to completion of the sale.</li>
                      </ul>
                    </div>
                  </>}

                  {/* PRIVATE */}
                  {disclosureModal === 'private' && <>
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                        <span className={`w-6 h-6 ${cfg.badge} rounded-full flex items-center justify-center text-xs font-bold`}>1</span>
                        Private Sale Disclosure
                      </h4>
                      <ul className="list-disc list-inside space-y-1 text-gray-600 ml-8">
                        <li>This vehicle is listed as a private sale facilitated through EasyDrive Canada.</li>
                        <li>The vehicle is sold as-is unless otherwise stated in writing.</li>
                      </ul>
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                        <span className={`w-6 h-6 ${cfg.badge} rounded-full flex items-center justify-center text-xs font-bold`}>2</span>
                        Inspection & Test Drive
                      </h4>
                      <ul className="list-disc list-inside space-y-1 text-gray-600 ml-8">
                        <li>Viewing and test drives may be available subject to seller availability.</li>
                        <li>Buyers are encouraged to arrange an independent pre-purchase inspection.</li>
                      </ul>
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                        <span className={`w-6 h-6 ${cfg.badge} rounded-full flex items-center justify-center text-xs font-bold`}>3</span>
                        Safety & Reconditioning
                      </h4>
                      <ul className="list-disc list-inside space-y-1 text-gray-600 ml-8">
                        <li>Safety certification is not included in the listed price unless explicitly noted.</li>
                        <li>Safety may be added through EasyDrive Canada starting at <strong>$999</strong>, which includes the Ontario Safety Standards Certificate.</li>
                        <li>Where permitted by law, the vehicle may also be purchased without safety.</li>
                      </ul>
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                        <span className={`w-6 h-6 ${cfg.badge} rounded-full flex items-center justify-center text-xs font-bold`}>4</span>
                        Fees & Licensing (Mandatory)
                      </h4>
                      <ul className="list-disc list-inside space-y-1 text-gray-600 ml-8">
                        <li>All transactions are subject to the mandatory OMVIC fee of <strong>$22 + HST</strong> per transaction, shown separately on the Bill of Sale.</li>
                        <li>A licensing fee of <strong>$59</strong> applies to every transaction and will be shown separately on the Bill of Sale.</li>
                      </ul>
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                        <span className={`w-6 h-6 ${cfg.badge} rounded-full flex items-center justify-center text-xs font-bold`}>5</span>
                        CARFAX Disclosure
                      </h4>
                      <ul className="list-disc list-inside space-y-1 text-gray-600 ml-8">
                        <li>A CARFAX report will be provided to the client prior to completion of the sale.</li>
                      </ul>
                    </div>
                  </>}

                  {/* FLEET */}
                  {disclosureModal === 'fleet' && <>
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                        <span className={`w-6 h-6 ${cfg.badge} rounded-full flex items-center justify-center text-xs font-bold`}>1</span>
                        Fleet Disclosure
                      </h4>
                      <ul className="list-disc list-inside space-y-1 text-gray-600 ml-8">
                        <li>This vehicle was previously registered as a fleet vehicle.</li>
                      </ul>
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                        <span className={`w-6 h-6 ${cfg.badge} rounded-full flex items-center justify-center text-xs font-bold`}>2</span>
                        Purchase Process – EDC Fleet Select
                      </h4>
                      <ul className="list-disc list-inside space-y-1 text-gray-600 ml-8">
                        <li>No test drives are available.</li>
                        <li>No appointments or viewings are available.</li>
                        <li>This vehicle is offered under a streamlined, wholesale-style purchase option, reflected in its pricing.</li>
                      </ul>
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                        <span className={`w-6 h-6 ${cfg.badge} rounded-full flex items-center justify-center text-xs font-bold`}>3</span>
                        Safety & Reconditioning
                      </h4>
                      <ul className="list-disc list-inside space-y-1 text-gray-600 ml-8">
                        <li>Safety and reconditioning are not included in the listed price.</li>
                        <li>Safety and reconditioning may be added through EasyDrive Canada starting at <strong>$999</strong>, which includes the Ontario Safety Standards Certificate.</li>
                        <li>If safety is purchased, the vehicle will be delivered with a valid Ontario Safety Standards Certificate.</li>
                        <li>Where permitted by law, the vehicle may also be purchased without safety.</li>
                      </ul>
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                        <span className={`w-6 h-6 ${cfg.badge} rounded-full flex items-center justify-center text-xs font-bold`}>4</span>
                        Fees & Licensing
                      </h4>
                      <ul className="list-disc list-inside space-y-1 text-gray-600 ml-8">
                        <li>All transactions are subject to the mandatory OMVIC fee of <strong>$22 + HST</strong> per transaction, shown separately on the Bill of Sale.</li>
                        <li>A licensing fee of <strong>$59</strong> applies to every transaction and will be shown separately on the Bill of Sale.</li>
                      </ul>
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                        <span className={`w-6 h-6 ${cfg.badge} rounded-full flex items-center justify-center text-xs font-bold`}>5</span>
                        CARFAX Disclosure
                      </h4>
                      <ul className="list-disc list-inside space-y-1 text-gray-600 ml-8">
                        <li>A CARFAX report will be provided to the client prior to completion of the sale.</li>
                      </ul>
                    </div>
                  </>}

                  {/* DEALERSHIP */}
                  {disclosureModal === 'dealership' && <>
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                        <span className={`w-6 h-6 ${cfg.badge} rounded-full flex items-center justify-center text-xs font-bold`}>1</span>
                        Dealership Disclosure
                      </h4>
                      <ul className="list-disc list-inside space-y-1 text-gray-600 ml-8">
                        <li>This vehicle is listed through an authorized dealership partner of EasyDrive Canada.</li>
                        <li>All representations about this vehicle are made by the dealership.</li>
                      </ul>
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                        <span className={`w-6 h-6 ${cfg.badge} rounded-full flex items-center justify-center text-xs font-bold`}>2</span>
                        Viewing & Test Drive
                      </h4>
                      <ul className="list-disc list-inside space-y-1 text-gray-600 ml-8">
                        <li>Viewing and test drives are available through the dealership by appointment.</li>
                        <li>Contact the dealership directly to arrange a viewing.</li>
                      </ul>
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                        <span className={`w-6 h-6 ${cfg.badge} rounded-full flex items-center justify-center text-xs font-bold`}>3</span>
                        Safety & Reconditioning
                      </h4>
                      <ul className="list-disc list-inside space-y-1 text-gray-600 ml-8">
                        <li>Safety certification status is determined by the dealership — please confirm prior to purchase.</li>
                        <li>Any reconditioning or warranty details are provided by the dealership.</li>
                      </ul>
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                        <span className={`w-6 h-6 ${cfg.badge} rounded-full flex items-center justify-center text-xs font-bold`}>4</span>
                        Fees & Licensing (Mandatory)
                      </h4>
                      <ul className="list-disc list-inside space-y-1 text-gray-600 ml-8">
                        <li>All transactions are subject to the mandatory OMVIC fee of <strong>$22 + HST</strong> per transaction, shown separately on the Bill of Sale.</li>
                        <li>A licensing fee of <strong>$59</strong> applies to every transaction and will be shown separately on the Bill of Sale.</li>
                      </ul>
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                        <span className={`w-6 h-6 ${cfg.badge} rounded-full flex items-center justify-center text-xs font-bold`}>5</span>
                        CARFAX Disclosure
                      </h4>
                      <ul className="list-disc list-inside space-y-1 text-gray-600 ml-8">
                        <li>A CARFAX report will be provided to the client prior to completion of the sale.</li>
                      </ul>
                    </div>
                  </>}

                  <div className="pt-4 mt-4 border-t border-gray-200">
                    <p className="text-gray-500 italic text-xs">No other promises, representations, or guarantees have been made, written or verbal, other than what is disclosed above and on the Bill of Sale.</p>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t border-gray-200 flex-shrink-0">
                <button
                  onClick={() => setDisclosureModal(null)}
                  className={`w-full ${cfg.btn} text-white font-semibold py-3 rounded-xl transition-colors`}
                >
                  I Understand
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* CARFAX Report Modal */}
      {certModal.open && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60">
          <div className="w-full max-w-4xl bg-white rounded-2xl shadow-xl flex flex-col" style={{ height: '90vh' }}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0">
              <h3 className="text-base font-semibold text-gray-900">Certificate</h3>
              <div className="flex items-center gap-3">
                {certModal.files.length > 1 && (
                  <div className="flex gap-1">
                    {certModal.files.map((f, i) => (
                      <button
                        key={f.publicUrl}
                        type="button"
                        onClick={() => setCertModal(prev => ({ ...prev, activeIndex: i }))}
                        className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                          certModal.activeIndex === i
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'text-gray-600 border-gray-300 hover:border-blue-400'
                        }`}
                      >
                        File {i + 1}
                      </button>
                    ))}
                  </div>
                )}
                {certModal.files.length > 0 && (
                  <a
                    href={certModal.files[certModal.activeIndex]?.publicUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                    Open in new tab
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => setCertModal({ open: false, loading: false, files: [], activeIndex: 0 })}
                  className="text-gray-400 hover:text-gray-600 ml-1"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="flex-1 min-h-0">
              {certModal.loading ? (
                <div className="flex items-center justify-center h-full gap-2 text-gray-400">
                  <svg className="w-6 h-6 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  <span className="text-sm">Loading certificate…</span>
                </div>
              ) : certModal.files.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full">
                  <svg className="w-14 h-14 text-gray-200 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                  </svg>
                  <p className="text-sm font-semibold text-gray-500">No Certificate Uploaded</p>
                  <p className="text-xs text-gray-400 mt-1">No certificate has been uploaded for this vehicle yet.</p>
                </div>
              ) : (() => {
                const url = certModal.files[certModal.activeIndex]?.publicUrl || ''
                const name = (certModal.files[certModal.activeIndex]?.name || '').toLowerCase()
                const isImage = /\.(jpg|jpeg|png|webp|gif|bmp|svg)$/.test(name)
                if (isImage) {
                  return (
                    <div className="flex items-center justify-center h-full bg-gray-50 p-4 rounded-b-2xl">
                      <img src={url} alt="Certificate" className="max-h-full max-w-full object-contain rounded-lg shadow" />
                    </div>
                  )
                }
                return (
                  <iframe src={url} className="w-full h-full rounded-b-2xl" title="Certificate" />
                )
              })()}
            </div>
          </div>
        </div>
      )}

      {carfaxModal.open && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center sm:p-4 bg-black/60">
          <div className="w-full sm:max-w-4xl bg-white sm:rounded-2xl shadow-xl flex flex-col h-[100dvh] sm:h-[90vh]">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0">
              <h3 className="text-base font-semibold text-gray-900">CARFAX Report</h3>
              <div className="flex items-center gap-3">
                {carfaxModal.files.length > 1 && (
                  <div className="flex gap-1">
                    {carfaxModal.files.map((f, i) => (
                      <button
                        key={f.path}
                        type="button"
                        onClick={() => setCarfaxModal(prev => ({ ...prev, activeIndex: i }))}
                        className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                          carfaxModal.activeIndex === i
                            ? 'bg-red-600 text-white border-red-600'
                            : 'text-gray-600 border-gray-300 hover:border-red-400'
                        }`}
                      >
                        File {i + 1}
                      </button>
                    ))}
                  </div>
                )}
                {carfaxModal.files.length > 0 && (
                  <a
                    href={carfaxModal.files[carfaxModal.activeIndex]?.publicUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                    Open in new tab
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => setCarfaxModal({ open: false, loading: false, files: [], activeIndex: 0 })}
                  className="text-gray-400 hover:text-gray-600 ml-1"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 min-h-0 overflow-hidden">
              {carfaxModal.loading ? (
                <div className="flex items-center justify-center h-full gap-2 text-gray-400">
                  <svg className="w-6 h-6 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  <span className="text-sm">Loading report…</span>
                </div>
              ) : carfaxModal.files.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full">
                  <svg className="w-14 h-14 text-gray-200 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p className="text-sm font-semibold text-gray-500">No CARFAX Report Uploaded</p>
                  <p className="text-xs text-gray-400 mt-1">No report has been uploaded for this vehicle yet.</p>
                </div>
              ) : (
                <iframe
                  src={carfaxModal.files[carfaxModal.activeIndex]?.publicUrl}
                  className="w-full h-full sm:rounded-b-2xl"
                  title="CARFAX Report"
                  style={{ display: 'block' }}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
