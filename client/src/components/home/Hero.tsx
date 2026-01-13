'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useState, useEffect } from 'react'

export default function Hero() {
  const [vehicleCount, setVehicleCount] = useState<number | null>(null)
  const API_URL = process.env.NEXT_PUBLIC_API_URL

  useEffect(() => {
    const fetchVehicleCount = async () => {
      if (!API_URL) {
        setVehicleCount(0)
        return
      }

      try {
        const controller = new AbortController()
        const timeoutId = window.setTimeout(() => controller.abort(), 2500)

        const response = await fetch(`${API_URL}/api/vehicles?status=ACTIVE`, {
          signal: controller.signal,
          cache: 'no-store',
        })

        window.clearTimeout(timeoutId)

        if (!response.ok) {
          setVehicleCount(0)
          return
        }
        const data = await response.json()
        // Get count from the response
        const vehicles = data.vehicles || data || []
        setVehicleCount(vehicles.length)
      } catch (error) {
        setVehicleCount(0)
      }
    }
    fetchVehicleCount()
  }, [API_URL])

  return (
    <section className="relative min-h-[600px] lg:min-h-[700px] overflow-hidden" aria-label="Hero section">
      {/* Background Image */}
      <div className="absolute inset-0">
        <Image
          src="/images/background.jpg"
          alt="Easy Drive Canada - Premium Vehicles"
          fill
          className="object-cover"
          priority
          sizes="100vw"
        />
        {/* Overlays for readability + depth */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/65 via-black/45 to-black/35" aria-hidden="true"></div>
        <div className="absolute inset-0 bg-gradient-to-r from-black/45 via-transparent to-black/20" aria-hidden="true"></div>
      </div>

      {/* Soft transition into next white section */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-b from-transparent to-white" aria-hidden="true"></div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-28 lg:py-32 flex flex-col items-center text-center">
        <div className="max-w-3xl">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm text-white px-4 py-2 rounded-full text-sm font-medium mb-6 border border-white/20" role="status">
            <span className="flex h-2 w-2 rounded-full bg-primary-400" aria-hidden="true"></span>
            Canada&apos;s Most Trusted Car Marketplace
          </div>

          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6 leading-[1.1]">
            Find Your Perfect Car
            <br />
            <span className="text-primary-400">100% Online</span>
          </h1>
          
          <p className="text-lg md:text-xl text-gray-200 mb-10 max-w-xl mx-auto">
            Browse quality-inspected vehicles with transparent pricing, 
            verified history, and delivery right to your door.
          </p>

          {/* CTA Button */}
          <Link
            href="/inventory"
            className="inline-flex items-center gap-2 bg-primary-600 text-white px-8 py-4 rounded-xl hover:bg-primary-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600 transition-all font-semibold shadow-lg hover:shadow-xl"
          >
            Browse All Cars
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </Link>
        </div>

        {/* Trust Indicators */}
        <div className={`mt-16 grid grid-cols-3 gap-4 sm:gap-6 max-w-2xl mx-auto transition-opacity duration-600 ${vehicleCount !== null ? 'opacity-100 animate-fade-in-up' : 'opacity-0'}`} role="region" aria-label="Trust indicators">
          <div className="flex flex-col items-center p-4 rounded-xl bg-white/10 backdrop-blur-sm border border-white/10">
            <div className="text-2xl sm:text-3xl md:text-4xl font-bold text-white">
              {vehicleCount || '—'}
            </div>
            <div className="text-gray-300 text-xs sm:text-sm text-center">Vehicles Listed</div>
          </div>
          <div className="flex flex-col items-center p-4 rounded-xl bg-white/10 backdrop-blur-sm border border-white/10">
            <div className="text-2xl sm:text-3xl md:text-4xl font-bold text-white">100%</div>
            <div className="text-gray-300 text-xs sm:text-sm text-center">Online Process</div>
          </div>
          <div className="flex flex-col items-center p-4 rounded-xl bg-white/10 backdrop-blur-sm border border-white/10">
            <div className="text-2xl sm:text-3xl md:text-4xl font-bold text-white">150+</div>
            <div className="text-gray-300 text-xs sm:text-sm text-center">Point Inspection</div>
          </div>
        </div>
      </div>
    </section>
  )
}
