
'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

interface Vehicle {
  id: string
  make: string
  model: string
  series: string
  year: number
  price: number
  mileage: number
  fuelType: string
  transmission: string
  bodyType: string
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
}

export default function VehicleDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [vehicle, setVehicle] = useState<Vehicle | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedImage, setSelectedImage] = useState(0)
  const [showInquiryForm, setShowInquiryForm] = useState(false)
  const [showTestDriveModal, setShowTestDriveModal] = useState(false)
  const [showDisclosureModal, setShowDisclosureModal] = useState(false)
  const [showPremiereDisclosureModal, setShowPremiereDisclosureModal] = useState(false)
  const [inquiryForm, setInquiryForm] = useState({
    name: '',
    email: '',
    phone: '',
    message: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const [isVerified, setIsVerified] = useState(false)

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsVerified(window.localStorage.getItem('edc_account_verified') === 'true')
    }
  }, [])

  useEffect(() => {
    if (params.id) {
      fetchVehicle()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id])

  const fetchVehicle = async () => {
    try {
      const res = await fetch(`${API_URL}/api/vehicles/${params.id}`)
      if (res.ok) {
        const data = await res.json()
        setVehicle(data)
      }
    } catch (_error) {
      console.error('Error fetching vehicle:', _error)
    } finally {
      setLoading(false)
    }
  }

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
    <div className="min-h-screen">
      {/* Breadcrumb */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <nav className="flex items-center text-sm">
          <Link href="/" className="text-gray-500 hover:text-[#118df0] transition-colors">Home</Link>
          <svg className="w-4 h-4 mx-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <Link href="/inventory" className="text-gray-500 hover:text-[#118df0] transition-colors">Inventory</Link>
          <svg className="w-4 h-4 mx-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span className="text-gray-900 font-medium">{vehicle.year} {vehicle.make} {vehicle.model} {vehicle.series}</span>
        </nav>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Images & Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Main Image */}
            <div className="glass-card rounded-2xl overflow-hidden">
              <div className="relative h-[400px] md:h-[500px] bg-gradient-to-br from-gray-100 to-gray-200">
                {vehicle.images && vehicle.images.length > 0 ? (
                  <img
                    src={`${API_URL}${vehicle.images[selectedImage]}`}
                    alt={`${vehicle.year} ${vehicle.make} ${vehicle.model} ${vehicle.series}`}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <div className="text-center">
                      <svg className="w-24 h-24 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <p className="text-gray-500">No Image Available</p>
                    </div>
                  </div>
                )}
                {/* Image Counter */}
                {vehicle.images && vehicle.images.length > 1 && (
                  <div className="absolute bottom-4 right-4 bg-black/60 backdrop-blur-sm text-white px-3 py-1.5 rounded-lg text-sm font-medium">
                    {selectedImage + 1} / {vehicle.images.length}
                  </div>
                )}
                {/* Navigation Arrows */}
                {vehicle.images && vehicle.images.length > 1 && (
                  <>
                    <button
                      onClick={() => setSelectedImage(selectedImage === 0 ? vehicle.images.length - 1 : selectedImage - 1)}
                      className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/80 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-white transition-colors shadow-lg"
                    >
                      <svg className="w-5 h-5 text-gray-800" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                    <button
                      onClick={() => setSelectedImage(selectedImage === vehicle.images.length - 1 ? 0 : selectedImage + 1)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/80 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-white transition-colors shadow-lg"
                    >
                      <svg className="w-5 h-5 text-gray-800" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Thumbnail Gallery */}
            {vehicle.images && vehicle.images.length > 1 && (
              <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
                {vehicle.images.map((image, index) => (
                  <button
                    key={index}
                    onClick={() => setSelectedImage(index)}
                    className={`flex-shrink-0 w-24 h-20 rounded-xl overflow-hidden transition-all duration-200 ${
                      selectedImage === index 
                        ? 'ring-2 ring-[#118df0] ring-offset-2 scale-105' 
                        : 'opacity-70 hover:opacity-100'
                    }`}
                  >
                    <img
                      src={`${API_URL}${image}`}
                      alt={`View ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}

            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto">
              <div className="glass-card rounded-xl p-5 text-center">
                <div className="icon-container w-10 h-10 mx-auto mb-2">
                  <svg className="w-5 h-5 text-[#118df0]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <p className="text-xl font-bold text-gray-900">{vehicle.mileage?.toLocaleString()}</p>
                <p className="text-xs text-gray-500 mt-1">Kilometers</p>
              </div>
              <div className="glass-card rounded-xl p-5 text-center">
                <div className="icon-container w-10 h-10 mx-auto mb-2">
                  <svg className="w-5 h-5 text-[#118df0]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <p className="text-xl font-bold text-gray-900">{vehicle.year}</p>
                <p className="text-xs text-gray-500 mt-1">Year</p>
              </div>
            </div>

            {/* Vehicle Details */}
            <div className="glass-card rounded-2xl p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center">
                <span className="w-1 h-6 bg-gradient-to-b from-[#118df0] to-[#0a6bc4] rounded-full mr-3"></span>
                Vehicle Specifications
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-y-5 gap-x-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                  <div>
                    <span className="text-gray-500 text-sm">Make</span>
                    <p className="font-semibold text-gray-900">{vehicle.make}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                    </svg>
                  </div>
                  <div>
                    <span className="text-gray-500 text-sm">Model</span>
                    <p className="font-semibold text-gray-900">{vehicle.model}</p>
                  </div>
                </div>
                {vehicle.series && (
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
                      </svg>
                    </div>
                    <div>
                      <span className="text-gray-500 text-sm">Series</span>
                      <p className="font-semibold text-gray-900">{vehicle.series}</p>
                    </div>
                  </div>
                )}
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div>
                    <span className="text-gray-500 text-sm">Year</span>
                    <p className="font-semibold text-gray-900">{vehicle.year}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <div>
                    <span className="text-gray-500 text-sm">Mileage</span>
                    <p className="font-semibold text-gray-900">{vehicle.mileage?.toLocaleString()} km</p>
                  </div>
                </div>
                {vehicle.transmission && vehicle.transmission.trim() !== '' && (
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                      </svg>
                    </div>
                    <div>
                      <span className="text-gray-500 text-sm">Transmission</span>
                      <p className="font-semibold text-gray-900">{vehicle.transmission}</p>
                    </div>
                  </div>
                )}
                {vehicle.fuelType && vehicle.fuelType.trim() !== '' && (
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
                      </svg>
                    </div>
                    <div>
                      <span className="text-gray-500 text-sm">Fuel Type</span>
                      <p className="font-semibold text-gray-900">{vehicle.fuelType}</p>
                    </div>
                  </div>
                )}
                {vehicle.engine && (
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </div>
                    <div>
                      <span className="text-gray-500 text-sm">Engine</span>
                      <p className="font-semibold text-gray-900">{vehicle.engine}</p>
                    </div>
                  </div>
                )}
                {vehicle.drivetrain && (
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                      </svg>
                    </div>
                    <div>
                      <span className="text-gray-500 text-sm">Drivetrain</span>
                      <p className="font-semibold text-gray-900">{vehicle.drivetrain}</p>
                    </div>
                  </div>
                )}
                {vehicle.exteriorColor && (
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                      </svg>
                    </div>
                    <div>
                      <span className="text-gray-500 text-sm">Exterior Color</span>
                      <p className="font-semibold text-gray-900">{vehicle.exteriorColor}</p>
                    </div>
                  </div>
                )}
                {vehicle.interiorColor && (
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
                      </svg>
                    </div>
                    <div>
                      <span className="text-gray-500 text-sm">Interior Color</span>
                      <p className="font-semibold text-gray-900">{vehicle.interiorColor}</p>
                    </div>
                  </div>
                )}
                {(vehicle.bodyType || vehicle.bodyStyle) && (
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                    </div>
                    <div>
                      <span className="text-gray-500 text-sm">Body Style</span>
                      <p className="font-semibold text-gray-900">{vehicle.bodyType || vehicle.bodyStyle}</p>
                    </div>
                  </div>
                )}
                {vehicle.vin && (
                  <div className="flex items-start gap-3 col-span-2 md:col-span-3">
                    <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" />
                      </svg>
                    </div>
                    <div>
                      <span className="text-gray-500 text-sm">VIN</span>
                      <p className="font-semibold text-gray-900 font-mono text-sm">{vehicle.vin}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Description */}
            {vehicle.description && (
              <div className="glass-card rounded-2xl p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
                  <span className="w-1 h-6 bg-gradient-to-b from-[#118df0] to-[#0a6bc4] rounded-full mr-3"></span>
                  Description
                </h2>
                <p className="text-gray-700 whitespace-pre-line leading-relaxed">{vehicle.description}</p>
              </div>
            )}

            {/* Features */}
            {vehicle.features && vehicle.features.length > 0 && (
              <div className="glass-card rounded-2xl p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center">
                  <span className="w-1 h-6 bg-gradient-to-b from-[#118df0] to-[#0a6bc4] rounded-full mr-3"></span>
                  Features & Equipment
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {vehicle.features.map((feature, index) => (
                    <div key={index} className="flex items-center gap-2 py-2">
                      <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <svg className="w-3.5 h-3.5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <span className="text-gray-700">{feature}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right Column - Price & Actions */}
          <div className="lg:col-span-1">
            <div className="glass-card rounded-2xl p-6 sticky top-24">
              {/* Price Header */}
              <div className="text-center mb-6">
                <h1 className="text-2xl font-bold text-gray-900 mb-2">
                  {vehicle.year} {vehicle.make} {vehicle.model}
                </h1>
                {(vehicle.city || vehicle.province) && (
                  <p className="text-gray-500 flex items-center justify-center gap-1 mb-4">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    {vehicle.city}, {vehicle.province}
                  </p>
                )}
                <div className="inline-block bg-gradient-to-r from-[#118df0] to-[#0a6bc4] text-white text-3xl font-bold px-6 py-3 rounded-xl shadow-lg shadow-[#118df0]/25">
                  {formatPrice(vehicle.price)}
                </div>
              </div>
              
              <div className="border-t border-gray-200/60 my-6"></div>

              {/* Action Buttons */}
              <div className="space-y-3">
                {isVerified ? (
                  <button
                    type="button"
                    onClick={() => router.push(`/purchase/${vehicle.id}`)}
                    className="btn-primary w-full flex items-center justify-center"
                  >
                    Proceed to Deposit
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => router.push('/account/verification')}
                    className="w-full flex items-center justify-center gap-2 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 font-semibold px-4 py-3 rounded-xl transition-colors"
                  >
                    Verify Account to Continue
                  </button>
                )}

                {/* Fleet Disclosure Button */}
                {vehicle.inventoryType === 'FLEET' && (
                  <button
                    onClick={() => setShowDisclosureModal(true)}
                    className="w-full flex items-center justify-center gap-2 bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-800 font-semibold px-4 py-3 rounded-xl transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    View Important Disclosure
                  </button>
                )}

                {vehicle.inventoryType !== 'FLEET' && (
                  <>
                    <button
                      onClick={() => setShowPremiereDisclosureModal(true)}
                      className="w-full flex items-center justify-center gap-2 bg-purple-50 hover:bg-purple-100 border border-purple-300 text-purple-800 font-semibold px-4 py-3 rounded-xl transition-colors"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                      </svg>
                      View Important Disclosure
                    </button>
                    <button
                      onClick={() => setShowTestDriveModal(true)}
                      className="btn-primary w-full flex items-center justify-center"
                    >
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      Schedule Test Drive
                    </button>
                  </>
                )}

                <button
                  onClick={() => setShowInquiryForm(!showInquiryForm)}
                  className="btn-outline w-full flex items-center justify-center"
                >
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  Ask a Question
                </button>

                <a
                  href="tel:+16137772395"
                  className="btn-secondary w-full flex items-center justify-center"
                >
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  Call Us (613) 777-2395
                </a>
              </div>

              {/* Inquiry Form */}
              {showInquiryForm && (
                <form onSubmit={handleInquirySubmit} className="mt-6 space-y-4 pt-6 border-t border-gray-200/60">
                  <h3 className="font-semibold text-gray-900">Send an Inquiry</h3>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                    <input
                      type="text"
                      required
                      value={inquiryForm.name}
                      onChange={(e) => setInquiryForm({ ...inquiryForm, name: e.target.value })}
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <input
                      type="email"
                      required
                      value={inquiryForm.email}
                      onChange={(e) => setInquiryForm({ ...inquiryForm, email: e.target.value })}
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                    <input
                      type="tel"
                      required
                      value={inquiryForm.phone}
                      onChange={(e) => setInquiryForm({ ...inquiryForm, phone: e.target.value })}
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
                    <textarea
                      rows={3}
                      value={inquiryForm.message}
                      onChange={(e) => setInquiryForm({ ...inquiryForm, message: e.target.value })}
                      placeholder={`I'm interested in the ${vehicle.year} ${vehicle.make} ${vehicle.model}...`}
                      className="input-field resize-none"
                    ></textarea>
                  </div>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="btn-primary w-full disabled:opacity-50"
                  >
                    {submitting ? 'Sending...' : 'Send Inquiry'}
                  </button>
                </form>
              )}

              {/* Success Message */}
              {submitted && (
                <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-xl">
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-green-800 font-semibold">Thank you!</p>
                      <p className="text-green-700 text-sm">We&apos;ll be in touch soon.</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Trust Badges */}
              <div className="mt-6 pt-6 border-t border-gray-200/60">
                <div className="flex items-center gap-2 text-sm text-gray-600 mb-3">
                  <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  CARFAX Report Available
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600 mb-3">
                  <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Safety Inspected
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  Financing Available
                </div>
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

      {/* Fleet Disclosure Modal */}
      {showDisclosureModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowDisclosureModal(false)}
          ></div>
          
          {/* Modal */}
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-8 flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-amber-200 bg-amber-50 rounded-t-2xl flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-lg font-bold text-amber-800">IMPORTANT DISCLOSURE</h2>
                  <p className="text-sm text-amber-700">Please Read Carefully</p>
                </div>
              </div>
              <button
                onClick={() => setShowDisclosureModal(false)}
                className="p-2 hover:bg-amber-100 rounded-xl transition-colors"
              >
                <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {/* Content */}
            <div className="overflow-y-auto flex-1 p-6">
              <p className="text-gray-700 mb-6">
                This vehicle is offered by EasyDrive Canada (EDC) as an <strong className="text-amber-700">EDC Fleet Select</strong> vehicle.
              </p>
              
              <div className="space-y-5 text-sm">
                <div>
                  <h4 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                    <span className="w-6 h-6 bg-amber-100 rounded-full flex items-center justify-center text-amber-700 text-xs font-bold">1</span>
                    Fleet Disclosure
                  </h4>
                  <ul className="list-disc list-inside space-y-1 text-gray-600 ml-8">
                    <li>This vehicle was previously registered as a fleet vehicle.</li>
                  </ul>
                </div>
                
                <div>
                  <h4 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                    <span className="w-6 h-6 bg-amber-100 rounded-full flex items-center justify-center text-amber-700 text-xs font-bold">2</span>
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
                    <span className="w-6 h-6 bg-amber-100 rounded-full flex items-center justify-center text-amber-700 text-xs font-bold">3</span>
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
                    <span className="w-6 h-6 bg-amber-100 rounded-full flex items-center justify-center text-amber-700 text-xs font-bold">4</span>
                    Fees & Licensing
                  </h4>
                  <ul className="list-disc list-inside space-y-1 text-gray-600 ml-8">
                    <li>All transactions are subject to the mandatory OMVIC fee of <strong>$22 + HST</strong> per transaction, shown separately on the Bill of Sale.</li>
                    <li>A licensing fee of <strong>$59</strong> applies to every transaction and will be shown separately on the Bill of Sale.</li>
                  </ul>
                </div>
                
                <div>
                  <h4 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                    <span className="w-6 h-6 bg-amber-100 rounded-full flex items-center justify-center text-amber-700 text-xs font-bold">5</span>
                    CARFAX Disclosure
                  </h4>
                  <ul className="list-disc list-inside space-y-1 text-gray-600 ml-8">
                    <li>A CARFAX report will be provided to the client prior to completion of the sale.</li>
                  </ul>
                </div>
                
                <div className="pt-4 mt-4 border-t border-gray-200">
                  <p className="text-gray-500 italic text-xs">No other promises, representations, or guarantees have been made, written or verbal, other than what is disclosed above and on the Bill of Sale.</p>
                </div>
              </div>
            </div>
            
            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-200 flex-shrink-0">
              <button
                onClick={() => setShowDisclosureModal(false)}
                className="w-full bg-amber-500 hover:bg-amber-600 text-white font-semibold py-3 rounded-xl transition-colors"
              >
                I Understand
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Premiere Disclosure Modal */}
      {showPremiereDisclosureModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowPremiereDisclosureModal(false)}
          ></div>
          
          {/* Modal */}
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-8 flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-purple-200 bg-purple-50 rounded-t-2xl flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-lg font-bold text-purple-800">IMPORTANT DISCLOSURE</h2>
                  <p className="text-sm text-purple-700">Please Read Carefully</p>
                </div>
              </div>
              <button
                onClick={() => setShowPremiereDisclosureModal(false)}
                className="p-2 hover:bg-purple-100 rounded-xl transition-colors"
              >
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {/* Content */}
            <div className="overflow-y-auto flex-1 p-6">
              <p className="text-gray-700 mb-6">
                This vehicle is offered by EasyDrive Canada (EDC) as an <strong className="text-purple-700">EDC Premier</strong> vehicle.
              </p>
              
              <div className="space-y-5 text-sm">
                <div>
                  <h4 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                    <span className="w-6 h-6 bg-purple-100 rounded-full flex items-center justify-center text-purple-700 text-xs font-bold">1</span>
                    Vehicle Status – EDC Premier
                  </h4>
                  <ul className="list-disc list-inside space-y-1 text-gray-600 ml-8">
                    <li>This vehicle is owned and stocked by EasyDrive Canada.</li>
                    <li>Viewing and test drives are available by appointment.</li>
                  </ul>
                </div>
                
                <div>
                  <h4 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                    <span className="w-6 h-6 bg-purple-100 rounded-full flex items-center justify-center text-purple-700 text-xs font-bold">2</span>
                    Safety & Reconditioning
                  </h4>
                  <ul className="list-disc list-inside space-y-1 text-gray-600 ml-8">
                    <li>This vehicle will be sold with a valid Ontario Safety Standards Certificate prior to delivery.</li>
                    <li>Any required safety or reconditioning work has been completed or will be completed before delivery.</li>
                  </ul>
                </div>
                
                <div>
                  <h4 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                    <span className="w-6 h-6 bg-purple-100 rounded-full flex items-center justify-center text-purple-700 text-xs font-bold">3</span>
                    Fees & Licensing (Mandatory)
                  </h4>
                  <ul className="list-disc list-inside space-y-1 text-gray-600 ml-8">
                    <li>All transactions are subject to the mandatory OMVIC fee of <strong>$22 + HST</strong> per transaction, shown separately on the Bill of Sale.</li>
                    <li>A licensing fee of <strong>$59</strong> applies to every transaction and will be shown separately on the Bill of Sale.</li>
                  </ul>
                </div>
                
                <div>
                  <h4 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                    <span className="w-6 h-6 bg-purple-100 rounded-full flex items-center justify-center text-purple-700 text-xs font-bold">4</span>
                    CARFAX Disclosure
                  </h4>
                  <ul className="list-disc list-inside space-y-1 text-gray-600 ml-8">
                    <li>A CARFAX report will be provided to the client prior to completion of the sale.</li>
                  </ul>
                </div>
                
                <div className="pt-4 mt-4 border-t border-gray-200">
                  <p className="text-gray-500 italic text-xs">No other promises, representations, or guarantees have been made, written or verbal, other than what is disclosed above and on the Bill of Sale.</p>
                </div>
              </div>
            </div>
            
            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-200 flex-shrink-0">
              <button
                onClick={() => setShowPremiereDisclosureModal(false)}
                className="w-full bg-purple-500 hover:bg-purple-600 text-white font-semibold py-3 rounded-xl transition-colors"
              >
                I Understand
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
