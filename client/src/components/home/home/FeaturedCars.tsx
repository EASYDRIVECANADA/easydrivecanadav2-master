'use client'

import Link from 'next/link'
import { useState, useRef } from 'react'

// Mock data - in real app this would come from API
const featuredCars = [
  {
    id: 1,
    make: 'Toyota',
    model: 'RAV4 XLE',
    year: 2022,
    price: 32999,
    mileage: 28500,
    image: '/cars/rav4.jpg',
    fuelType: 'Hybrid',
    transmission: 'Automatic',
    badge: 'Popular'
  },
  {
    id: 2,
    make: 'Honda',
    model: 'Civic Touring',
    year: 2023,
    price: 29499,
    mileage: 15200,
    image: '/cars/civic.jpg',
    fuelType: 'Gas',
    transmission: 'CVT',
    badge: 'Low KM'
  },
  {
    id: 3,
    make: 'Tesla',
    model: 'Model 3',
    year: 2022,
    price: 45999,
    mileage: 22000,
    image: '/cars/model3.jpg',
    fuelType: 'Electric',
    transmission: 'Automatic',
    badge: 'Electric'
  },
  {
    id: 4,
    make: 'Ford',
    model: 'F-150 XLT',
    year: 2021,
    price: 42500,
    mileage: 45000,
    image: '/cars/f150.jpg',
    fuelType: 'Gas',
    transmission: 'Automatic',
    badge: null
  },
  {
    id: 5,
    make: 'Mazda',
    model: 'CX-5 GT',
    year: 2023,
    price: 35999,
    mileage: 8500,
    image: '/cars/cx5.jpg',
    fuelType: 'Gas',
    transmission: 'Automatic',
    badge: 'Like New'
  },
  {
    id: 6,
    make: 'BMW',
    model: '330i xDrive',
    year: 2022,
    price: 48500,
    mileage: 19000,
    image: '/cars/330i.jpg',
    fuelType: 'Gas',
    transmission: 'Automatic',
    badge: 'Luxury'
  },
]

export default function FeaturedCars() {
  const [currentSlide, setCurrentSlide] = useState(0)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  
  // Number of cards per slide
  const carsPerSlide = 3
  const totalSlides = Math.ceil(featuredCars.length / carsPerSlide)

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
      const cardWidth = scrollContainerRef.current.scrollWidth / featuredCars.length
      scrollContainerRef.current.scrollTo({
        left: cardWidth * newSlide * carsPerSlide,
        behavior: 'smooth'
      })
    }
  }

  const scrollLeft = () => goToSlide(currentSlide - 1)
  const scrollRight = () => goToSlide(currentSlide + 1)

  return (
    <section className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-10">
          <div>
            <span className="text-primary-600 font-semibold text-sm uppercase tracking-wider">Featured Vehicles</span>
            <h2 className="text-3xl md:text-4xl font-bold text-secondary-900 mt-2">
              Recently Added
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
          {/* Scrollable Cards Container */}
          <div 
            ref={scrollContainerRef}
            className="flex gap-6 overflow-hidden scroll-smooth"
          >
            {featuredCars.map((car) => (
              <Link 
                key={car.id}
                href={`/cars/${car.id}`}
                className="group flex-shrink-0 w-full md:w-[calc(33.333%-16px)] bg-white rounded-2xl border border-secondary-100 overflow-hidden hover:shadow-card-hover transition-all duration-300"
              >
                {/* Image Container */}
                <div className="relative h-48 bg-secondary-100 overflow-hidden">
                  {/* Placeholder gradient - replace with real images */}
                  <div className="absolute inset-0 bg-gradient-to-br from-secondary-200 to-secondary-300 flex items-center justify-center">
                    <svg className="w-16 h-16 text-secondary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 7h8m-8 5h8m-4-10v2m0 14v2m-6-6H4m16 0h-2M6.343 6.343l1.414 1.414m8.486 8.486l1.414 1.414M6.343 17.657l1.414-1.414m8.486-8.486l1.414-1.414" />
                    </svg>
                  </div>
                  
                  {/* Badge */}
                  {car.badge && (
                    <div className="absolute top-3 left-3 bg-primary-600 text-white text-xs font-semibold px-3 py-1 rounded-full">
                      {car.badge}
                    </div>
                  )}

                  {/* Save Button */}
                  <button 
                    className="absolute top-3 right-3 w-9 h-9 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center text-secondary-400 hover:text-primary-600 transition-colors"
                    onClick={(e) => { e.preventDefault(); }}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                    </svg>
                  </button>
                </div>

                {/* Content */}
                <div className="p-5">
                  {/* Title & Year */}
                  <div className="mb-3">
                    <h3 className="text-lg font-semibold text-secondary-900 group-hover:text-primary-600 transition-colors">
                      {car.year} {car.make} {car.model}
                    </h3>
                  </div>

                  {/* Specs */}
                  <div className="flex flex-wrap gap-2 mb-4">
                    <span className="inline-flex items-center gap-1 text-sm text-secondary-500">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      {car.fuelType}
                    </span>
                    <span className="text-secondary-300">•</span>
                    <span className="text-sm text-secondary-500">{car.transmission}</span>
                    <span className="text-secondary-300">•</span>
                    <span className="text-sm text-secondary-500">{formatMileage(car.mileage)} km</span>
                  </div>

                  {/* Price */}
                  <div className="flex items-end justify-between pt-4 border-t border-secondary-100">
                    <div>
                      <span className="text-2xl font-bold text-secondary-900">{formatPrice(car.price)}</span>
                      <span className="text-secondary-400 text-sm ml-1">+ taxes</span>
                    </div>
                    <span className="text-sm text-primary-600 font-medium">
                      ~${Math.round(car.price / 60)}/mo
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Navigation Controls - Arrows and Dots */}
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

        {/* View More Button */}
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
      </div>
    </section>
  )
}
