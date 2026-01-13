'use client'

import Link from 'next/link'
import { useState, useRef, useEffect } from 'react'

interface Vehicle {
  id: string
  make: string
  model: string
  year: number
  price: number
  mileage: number
  fuelType: string | null
  transmission: string | null
  images: string[]
  series: string | null
  inventoryType?: string
}

export default function FeaturedCars() {
  const [currentSlide, setCurrentSlide] = useState(0)
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [loading, setLoading] = useState(true)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const API_URL = process.env.NEXT_PUBLIC_API_URL

  useEffect(() => {
    const fetchFeaturedVehicles = async () => {
      if (!API_URL) {
        setVehicles([])
        setLoading(false)
        return
      }

      try {
        const controller = new AbortController()
        const timeoutId = window.setTimeout(() => controller.abort(), 2500)

        const response = await fetch(`${API_URL}/api/vehicles?limit=12&status=ACTIVE&sortBy=mileage&sortOrder=asc`, {
          signal: controller.signal,
          cache: 'no-store',
        })

        window.clearTimeout(timeoutId)

        if (!response.ok) {
          setVehicles([])
          return
        }
        const data = await response.json()
        // Only take first 12 vehicles
        const vehicleList = data.vehicles || data || []
        setVehicles(vehicleList.slice(0, 12))
      } catch (error) {
        setVehicles([])
      } finally {
        setLoading(false)
      }
    }

    fetchFeaturedVehicles()
  }, [API_URL])
  
  // Number of cards per slide
  const carsPerSlide = 3
  const totalSlides = Math.ceil(vehicles.length / carsPerSlide)

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: 'CAD',
      maximumFractionDigits: 0
    }).format(price)
  }

  const formatMileage = (km: number) => {
    return new Intl.NumberFormat('en-CA').format(km)
  }

  const goToSlide = (slideIndex: number) => {
    const newSlide = Math.max(0, Math.min(slideIndex, totalSlides - 1))
    setCurrentSlide(newSlide)
    
    if (scrollContainerRef.current) {
      const cardWidth = scrollContainerRef.current.scrollWidth / vehicles.length
      scrollContainerRef.current.scrollTo({
        left: cardWidth * newSlide * carsPerSlide,
        behavior: 'smooth'
      })
    }
  }

  const scrollLeft = () => goToSlide(currentSlide - 1)
  const scrollRight = () => goToSlide(currentSlide + 1)

  return (
    <section className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-10">
          <div>
            <span className="text-primary-600 font-semibold text-sm uppercase tracking-wider">Featured Vehicles</span>
            <h2 className="text-3xl md:text-4xl font-bold text-secondary-900 mt-2">
              Low Mileage Picks
            </h2>
          </div>
          <Link 
            href="/inventory" 
            className="mt-4 md:mt-0 text-primary-600 font-semibold hover:text-primary-700 inline-flex items-center gap-2"
          >
            View all vehicles
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </Link>
        </div>

        {/* Carousel Container */}
        <div className="relative">
          {loading ? (
            <div className="flex gap-6 overflow-hidden">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex-shrink-0 w-full md:w-[calc(33.333%-16px)] bg-white rounded-2xl border border-secondary-100 overflow-hidden animate-pulse">
                  <div className="h-48 bg-secondary-200"></div>
                  <div className="p-5 space-y-3">
                    <div className="h-6 bg-secondary-200 rounded w-3/4"></div>
                    <div className="h-4 bg-secondary-200 rounded w-full"></div>
                    <div className="h-8 bg-secondary-200 rounded w-1/2"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : vehicles.length === 0 ? (
            <div className="text-center py-12 text-secondary-500">
              No featured vehicles available at the moment.
            </div>
          ) : (
            <>
              {/* Scrollable Cards Container */}
              <div 
                ref={scrollContainerRef}
                className="flex gap-6 overflow-hidden scroll-smooth"
              >
                {vehicles.map((vehicle) => (
                  <Link 
                    key={vehicle.id}
                    href={`/inventory/${vehicle.id}`}
                    className="group flex-shrink-0 w-full md:w-[calc(33.333%-16px)] bg-white rounded-2xl border border-secondary-100 overflow-hidden hover:shadow-card-hover transition-all duration-300"
                  >
                    {/* Image Container */}
                    <div className="relative h-48 bg-secondary-100 overflow-hidden">
                      {vehicle.images && vehicle.images.length > 0 ? (
                        <img 
                          src={`${API_URL}${vehicle.images[0]}`}
                          alt={`${vehicle.year} ${vehicle.make} ${vehicle.model}`}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="absolute inset-0 bg-gradient-to-br from-secondary-200 to-secondary-300 flex items-center justify-center">
                          <svg className="w-16 h-16 text-secondary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 7h8m-8 5h8m-4-10v2m0 14v2m-6-6H4m16 0h-2M6.343 6.343l1.414 1.414m8.486 8.486l1.414 1.414M6.343 17.657l1.414-1.414m8.486-8.486l1.414-1.414" />
                          </svg>
                        </div>
                      )}
                      
                      {/* Low KM Badge */}
                      {vehicle.mileage < 30000 && (
                        <div className="absolute top-3 left-3 bg-primary-600 text-white text-xs font-semibold px-3 py-1 rounded-full">
                          Low KM
                        </div>
                      )}

                      {/* Save Button */}
                      <button 
                        className="absolute top-3 right-3 w-9 h-9 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center text-secondary-400 hover:text-primary-600 transition-colors"
                        onClick={(e) => { e.preventDefault(); }}
                        aria-label="Save vehicle to favorites"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                        </svg>
                      </button>
                    </div>

                    {/* Content */}
                    <div className="p-5">
                      {/* Title & Year */}
                      <div className="mb-3">
                        <h3 className="text-lg font-semibold text-secondary-900 group-hover:text-primary-600 transition-colors">
                          {vehicle.year} {vehicle.make} {vehicle.model}
                        </h3>
                        {vehicle.series && (
                          <p className="text-sm text-secondary-500">{vehicle.series}</p>
                        )}
                      </div>

                      {/* Specs */}
                      <div className="flex flex-wrap gap-2 mb-4">
                        {vehicle.fuelType && (
                          <>
                            <span className="inline-flex items-center gap-1 text-sm text-secondary-500">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                              </svg>
                              {vehicle.fuelType}
                            </span>
                            <span className="text-secondary-300">•</span>
                          </>
                        )}
                        {vehicle.transmission && (
                          <>
                            <span className="text-sm text-secondary-500">{vehicle.transmission}</span>
                            <span className="text-secondary-300">•</span>
                          </>
                        )}
                        <span className="text-sm text-secondary-500">{formatMileage(vehicle.mileage)} km</span>
                      </div>

                      {/* Price */}
                      <div className="flex items-end justify-between pt-4 border-t border-secondary-100">
                        <div>
                          <span className="text-2xl font-bold text-secondary-900">{formatPrice(vehicle.price)}</span>
                          <span className="text-secondary-400 text-sm ml-1">+ taxes</span>
                        </div>
                        <span className="text-sm text-primary-600 font-medium">
                          ~${Math.round(vehicle.price / 60)}/mo
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Navigation Controls - Arrows and Dots */}
        {!loading && vehicles.length > 0 && (
        <div className="flex justify-center items-center gap-4 mt-8">
          {/* Left Arrow */}
          <button
            onClick={scrollLeft}
            disabled={currentSlide === 0}
            className={`w-10 h-10 rounded-full border-2 flex items-center justify-center transition-all ${
              currentSlide === 0 
                ? 'border-secondary-200 text-secondary-300 cursor-not-allowed' 
                : 'border-primary-600 text-primary-600 hover:bg-primary-600 hover:text-white'
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          {/* Dot Indicators - each dot represents 3 cars */}
          <div className="flex items-center gap-2">
            {Array.from({ length: totalSlides }).map((_, index) => (
              <button
                key={index}
                onClick={() => goToSlide(index)}
                className={`w-3 h-3 rounded-full transition-all duration-300 ${
                  currentSlide === index
                    ? 'bg-primary-600 scale-110'
                    : 'bg-secondary-300 hover:bg-secondary-400'
                }`}
                aria-label={`Go to slide ${index + 1}`}
              />
            ))}
          </div>

          {/* Right Arrow */}
          <button
            onClick={scrollRight}
            disabled={currentSlide >= totalSlides - 1}
            className={`w-10 h-10 rounded-full border-2 flex items-center justify-center transition-all ${
              currentSlide >= totalSlides - 1 
                ? 'border-secondary-200 text-secondary-300 cursor-not-allowed' 
                : 'border-primary-600 text-primary-600 hover:bg-primary-600 hover:text-white'
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
        )}

        {/* View More Button */}
        {!loading && vehicles.length > 0 && (
        <div className="text-center mt-10">
          <Link 
            href="/inventory"
            className="inline-flex items-center gap-2 bg-primary-600 text-white px-8 py-4 rounded-full font-semibold hover:bg-primary-700 transition-all shadow-sm hover:shadow-md"
          >
            Browse All Vehicles
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </Link>
        </div>
        )}
      </div>
    </section>
  )
}
