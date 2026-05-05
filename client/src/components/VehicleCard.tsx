import { useState } from 'react'

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
  images: string[]
  inventoryType?: string
  categories?: string
  collection?: string
  vin?: string
  status?: string
}

interface VehicleCardProps {
  vehicle: Vehicle
  hideFooter?: boolean
  onClick?: () => void
}

export default function VehicleCard({ vehicle, onClick }: VehicleCardProps) {
  const [imageError, setImageError] = useState(false)
  const API_URL = process.env.NEXT_PUBLIC_API_URL || ''

  const categoryBadge = (() => {
    const raw = String((vehicle as any)?.categories || (vehicle as any)?.collection || '').trim().toLowerCase()
    if (!raw) return null
    if (raw.includes('private')) return { label: 'Private Seller', cls: 'bg-amber-500 text-white' }
    if (raw.includes('premier')) return { label: 'EDC Premier', cls: 'bg-[#1EA7FF] text-white' }
    if (raw.includes('fleet')) return { label: 'Fleet Select', cls: 'bg-slate-600 text-white' }
    if (raw.includes('dealer')) return { label: 'Dealer Select', cls: 'bg-purple-600 text-white' }
    return null
  })()

  const toImageSrc = (value: string) => {
    const v = String(value || '').trim()
    if (!v) return ''
    if (v.startsWith('http://') || v.startsWith('https://') || v.startsWith('data:')) return v
    const head = v.slice(0, 10)
    if (/^[A-Za-z0-9+/=]+$/.test(v) && v.length > 100) {
      let mime = 'image/jpeg'
      if (head.startsWith('iVBOR')) mime = 'image/png'
      else if (head.startsWith('R0lGOD')) mime = 'image/gif'
      else if (head.startsWith('UklGR')) mime = 'image/webp'
      return `data:${mime};base64,${v}`
    }
    const path = v.startsWith('/') ? v : `/${v}`
    return `${API_URL}${path}`
  }

  const formatMileage = (mileage: number) =>
    new Intl.NumberFormat('en-CA').format(mileage)

  const formatPrice = (price: number) =>
    new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', minimumFractionDigits: 0 }).format(price)

  return (
    <div
      className="bg-white rounded-2xl overflow-hidden border border-slate-100 shadow-sm hover:shadow-md transition-shadow cursor-pointer group"
      onClick={onClick}
      role="button"
    >
      {/* Image */}
      <div className="relative overflow-hidden" style={{ aspectRatio: '16/10' }}>
        {vehicle.images && vehicle.images.length > 0 && !imageError ? (
          <img
            src={toImageSrc(vehicle.images[0])}
            alt={`${vehicle.year} ${vehicle.make} ${vehicle.model}`}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="w-full h-full bg-slate-100 flex flex-col items-center justify-center gap-2">
            <svg className="w-10 h-10 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p className="text-xs text-slate-400">No Image</p>
          </div>
        )}

        {/* Category badge — top left */}
        {categoryBadge && (
          <span className={`absolute top-3 left-3 inline-flex items-center px-3 py-1 rounded-full text-xs font-bold tracking-wide shadow ${categoryBadge.cls}`}>
            {categoryBadge.label.toUpperCase()}
          </span>
        )}
      </div>

      {/* Body */}
      <div className="p-4">
        {/* Title row */}
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-base font-bold text-slate-900 leading-snug">
            {vehicle.year} {vehicle.make} {vehicle.model}
            {vehicle.series ? ` ${vehicle.series}` : ''}
          </h3>
          <span className="flex-shrink-0 text-base font-bold text-slate-900">
            {formatPrice(vehicle.price)}
          </span>
        </div>

        {/* Stock + dealer */}
        {vehicle.mileage != null && (
          <p className="mt-0.5 text-xs text-slate-400">
            {formatMileage(vehicle.mileage)} km
          </p>
        )}

        {/* Spec pills */}
        <div className="flex flex-wrap gap-1.5 mt-3">
          {vehicle.fuelType && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
              {vehicle.fuelType}
            </span>
          )}
          {vehicle.transmission && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
              {vehicle.transmission}
            </span>
          )}
        </div>

        {/* View listing button */}
        <button
          type="button"
          className="mt-3 w-full flex items-center justify-center gap-1.5 py-2 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
          onClick={onClick}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
          View listing
        </button>
      </div>
    </div>
  )
}
