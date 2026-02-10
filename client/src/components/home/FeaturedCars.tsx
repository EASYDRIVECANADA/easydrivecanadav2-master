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
    <section className="py-20 lg:py-28 bg-secondary-50" aria-label="Featured vehicles">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-12">
          <div>
            <span className="inline-flex items-center gap-1.5 text-primary-600 font-semibold text-sm uppercase tracking-wider mb-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
              </svg>
              Featured Vehicles
            </span>
            <h2 className="text-3xl md:text-4xl font-bold text-secondary-900 mt-1">
              Low Mileage Picks
            </h2>
            <p className="text-secondary-500 mt-2 max-w-lg">
              Hand-picked vehicles with the lowest mileage in our inventory.
            </p>
          </div>
          <Link 
            href="/inventory" 
            className="group mt-4 md:mt-0 inline-flex items-center gap-2 text-primary-600 font-semibold hover:text-primary-700 transition-colors"
          >
            View all vehicles
            <svg className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </Link>
        </div>

        {/* Carousel Container */}
        <div className="relative">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="bg-white rounded-2xl overflow-hidden shadow-card animate-pulse">
                  <div className="h-52 bg-secondary-200" />
                  <div className="p-6 space-y-3">
                    <div className="h-5 bg-secondary-200 rounded-lg w-3/4" />
                    <div className="h-4 bg-secondary-100 rounded-lg w-full" />
                    <div className="h-4 bg-secondary-100 rounded-lg w-2/3" />
                    <div className="pt-4 border-t border-secondary-100 flex justify-between">
                      <div className="h-7 bg-secondary-200 rounded-lg w-1/3" />
                      <div className="h-7 bg-secondary-100 rounded-lg w-1/4" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : vehicles.length === 0 ? (
            /* Empty State — Premium Design */
            <div className="text-center py-16 px-6 bg-white rounded-3xl shadow-card">
              <div className="w-20 h-20 bg-primary-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <svg className="w-10 h-10 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7h8m-8 5h8m-4-10v2m0 14v2m-6-6H4m16 0h-2M6.343 6.343l1.414 1.414m8.486 8.486l1.414 1.414M6.343 17.657l1.414-1.414m8.486-8.486l1.414-1.414" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-secondary-900 mb-2">New Inventory Arriving Daily</h3>
              <p className="text-secondary-500 mb-8 max-w-md mx-auto">
                We&apos;re constantly adding quality vehicles to our lineup. Be the first to know when new cars arrive.
              </p>
              <Link
                href="/contact"
                className="inline-flex items-center gap-2.5 bg-primary-600 text-white px-7 py-3.5 rounded-full font-semibold hover:bg-primary-700 transition-all shadow-lg shadow-primary-600/20 hover:shadow-xl hover:-translate-y-0.5"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                Get Notified
              </Link>
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
                    className="group flex-shrink-0 w-full md:w-[calc(33.333%-16px)] bg-white rounded-2xl overflow-hidden shadow-card hover:shadow-card-hover transition-all duration-300 hover:-translate-y-1"
                  >
                    {/* Image Container */}
                    <div className="relative h-52 bg-secondary-100 overflow-hidden">
                      {vehicle.images && vehicle.images.length > 0 ? (
                        <img 
                          src={`${API_URL}${vehicle.images[0]}`}
                          alt={`${vehicle.year} ${vehicle.make} ${vehicle.model}`}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      ) : (
                        <div className="absolute inset-0 bg-gradient-to-br from-secondary-100 to-secondary-200 flex items-center justify-center">
                          <svg className="w-16 h-16 text-secondary-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                      )}
                      
                      {/* Low KM Badge */}
                      {vehicle.mileage < 30000 && (
                        <div className="absolute top-3 left-3 bg-accent-green text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-sm flex items-center gap-1">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                          </svg>
                          Low KM
                        </div>
                      )}

                      {/* Save Button */}
                      <button 
                        className="absolute top-3 right-3 w-9 h-9 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center text-secondary-400 hover:text-primary-600 hover:bg-white transition-all shadow-sm"
                        onClick={(e) => { e.preventDefault(); }}
                        aria-label="Save vehicle to favorites"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                        </svg>
                      </button>

                      {/* View Details overlay on hover */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end justify-center pb-4">
                        <span className="inline-flex items-center gap-1.5 text-white text-sm font-semibold bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full border border-white/30">
                          View Details
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </span>
                      </div>
                    </div>

                    {/* Content */}
                    <div className="p-5">
                      {/* Title & Year */}
                      <div className="mb-3">
                        <h3 className="text-lg font-bold text-secondary-900 group-hover:text-primary-600 transition-colors leading-snug">
                          {vehicle.year} {vehicle.make} {vehicle.model}
                        </h3>
                        {vehicle.series && (
                          <p className="text-sm text-secondary-400 mt-0.5">{vehicle.series}</p>
                        )}
                      </div>

                      {/* Specs Pills */}
                      <div className="flex flex-wrap gap-1.5 mb-4">
                        {vehicle.fuelType && (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-secondary-600 bg-secondary-50 px-2.5 py-1 rounded-full">
                            <svg className="w-3.5 h-3.5 text-secondary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                            {vehicle.fuelType}
                          </span>
                        )}
                        {vehicle.transmission && (
                          <span className="inline-flex items-center text-xs font-medium text-secondary-600 bg-secondary-50 px-2.5 py-1 rounded-full">
                            {vehicle.transmission}
                          </span>
                        )}
                        <span className="inline-flex items-center text-xs font-medium text-secondary-600 bg-secondary-50 px-2.5 py-1 rounded-full">
                          {formatMileage(vehicle.mileage)} km
                        </span>
                      </div>

                      {/* Price */}
                      <div className="flex items-end justify-between pt-4 border-t border-secondary-100">
                        <div>
                          <span className="text-2xl font-bold text-secondary-900">{formatPrice(vehicle.price)}</span>
                          <span className="text-secondary-400 text-xs ml-1">+ tax</span>
                        </div>
                        <div className="text-right">
                          <span className="text-sm font-semibold text-primary-600">
                            ~${Math.round(vehicle.price / 60)}/mo
                          </span>
                          <span className="block text-[10px] text-secondary-400">est. financing</span>
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Navigation Controls */}
        {!loading && vehicles.length > 0 && (
        <div className="flex justify-center items-center gap-4 mt-10">
          <button
            onClick={scrollLeft}
            disabled={currentSlide === 0}
            className={`w-11 h-11 rounded-full border-2 flex items-center justify-center transition-all ${
              currentSlide === 0 
                ? 'border-secondary-200 text-secondary-300 cursor-not-allowed' 
                : 'border-primary-600 text-primary-600 hover:bg-primary-600 hover:text-white shadow-sm hover:shadow-md'
            }`}
            aria-label="Previous slide"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <div className="flex items-center gap-2">
            {Array.from({ length: totalSlides }).map((_, index) => (
              <button
                key={index}
                onClick={() => goToSlide(index)}
                className={`rounded-full transition-all duration-300 ${
                  currentSlide === index
                    ? 'bg-primary-600 w-8 h-3'
                    : 'bg-secondary-300 hover:bg-secondary-400 w-3 h-3'
                }`}
                aria-label={`Go to slide ${index + 1}`}
              />
            ))}
          </div>

          <button
            onClick={scrollRight}
            disabled={currentSlide >= totalSlides - 1}
            className={`w-11 h-11 rounded-full border-2 flex items-center justify-center transition-all ${
              currentSlide >= totalSlides - 1 
                ? 'border-secondary-200 text-secondary-300 cursor-not-allowed' 
                : 'border-primary-600 text-primary-600 hover:bg-primary-600 hover:text-white shadow-sm hover:shadow-md'
            }`}
            aria-label="Next slide"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
        )}

        {/* Browse All CTA */}
        {!loading && vehicles.length > 0 && (
        <div className="text-center mt-10">
          <Link 
            href="/inventory"
            className="group inline-flex items-center gap-2.5 bg-primary-600 text-white px-8 py-4 rounded-full font-semibold text-lg hover:bg-primary-700 transition-all shadow-lg shadow-primary-600/20 hover:shadow-xl hover:-translate-y-0.5"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            Browse All Vehicles
            <svg className="w-4 h-4 opacity-60 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
        )}
      </div>
    </section>
  )
}
