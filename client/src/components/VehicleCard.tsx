import Link from 'next/link'
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
}

interface VehicleCardProps {
  vehicle: Vehicle
}

export default function VehicleCard({ vehicle }: VehicleCardProps) {
  const [imageError, setImageError] = useState(false)
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: 'CAD',
      minimumFractionDigits: 0,
    }).format(price)
  }

  const formatMileage = (mileage: number) => {
    return new Intl.NumberFormat('en-CA').format(mileage)
  }

  return (
    <Link href={`/inventory/${vehicle.id}`}>
      <div className="glass-card-hover rounded-2xl overflow-hidden group">
        {/* Image */}
        <div className="relative h-52 bg-gradient-to-br from-gray-100 to-gray-200 overflow-hidden">
          {vehicle.images && vehicle.images.length > 0 && !imageError ? (
            <img
              src={`${API_URL}${vehicle.images[0]}`}
              alt=""
              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
              onError={() => setImageError(true)}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <div className="text-center">
                <svg className="w-16 h-16 mx-auto mb-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p className="text-sm text-gray-500">No Image</p>
              </div>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
          
          <div className="absolute top-4 right-4 price-tag">
            {formatPrice(vehicle.price)}
          </div>
        </div>

        {/* Details */}
        <div className="p-5">
          <h3 className="text-lg font-bold text-gray-900 mb-2 group-hover:text-[#118df0] transition-colors">
            {vehicle.year} {vehicle.make} {vehicle.model} {vehicle.series}
          </h3>
          
          <div className="flex flex-wrap gap-2 mt-3">
            <span className="inline-flex items-center text-sm text-gray-500 bg-gray-100/80 px-3 py-1.5 rounded-lg">
              <svg className="w-4 h-4 mr-1.5 text-[#118df0]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              {formatMileage(vehicle.mileage)} km
            </span>
            <span className="inline-flex items-center text-sm text-gray-500 bg-gray-100/80 px-3 py-1.5 rounded-lg">
              <svg className="w-4 h-4 mr-1.5 text-[#118df0]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              {vehicle.fuelType}
            </span>
            <span className="inline-flex items-center text-sm text-gray-500 bg-gray-100/80 px-3 py-1.5 rounded-lg">
              <svg className="w-4 h-4 mr-1.5 text-[#118df0]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              {vehicle.transmission}
            </span>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <span className="text-[#118df0] font-semibold group-hover:underline">
              View Details →
            </span>
          </div>
        </div>
      </div>
    </Link>
  )
}
