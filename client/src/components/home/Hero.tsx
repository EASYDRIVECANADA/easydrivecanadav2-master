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
        const vehicles = data.vehicles || data || []
        setVehicleCount(vehicles.length)
      } catch (error) {
        setVehicleCount(0)
      }
    }
    fetchVehicleCount()
  }, [API_URL])

  return (
    <section className="relative min-h-[640px] lg:min-h-[720px] overflow-hidden" aria-label="Hero section">
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
        <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/50 to-black/40" aria-hidden="true" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/40 via-transparent to-black/20" aria-hidden="true" />
      </div>

      {/* Soft bottom fade into white */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-b from-transparent to-white" aria-hidden="true" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-32 md:pt-32 md:pb-40 lg:pt-36 lg:pb-44 flex flex-col items-center text-center">
        <div className="max-w-3xl">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-md text-white px-5 py-2.5 rounded-full text-sm font-medium mb-8 border border-white/20 shadow-lg" role="status">
            <span className="relative flex h-2.5 w-2.5" aria-hidden="true">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary-400" />
            </span>
            {vehicleCount !== null && vehicleCount > 0
              ? `${vehicleCount} Vehicles Available Now`
              : "Canada\u2019s Trusted Car Marketplace"}
          </div>

          {/* Headline */}
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-white mb-6 leading-[1.08] tracking-tight">
            Buy Your Next Car Online
            <br />
            <span className="bg-gradient-to-r from-primary-300 to-primary-500 bg-clip-text text-transparent">
              Simple, Transparent, Delivered
            </span>
          </h1>

          {/* Subheadline */}
          <p className="text-lg md:text-xl text-gray-200/90 mb-10 max-w-2xl mx-auto leading-relaxed">
            No hidden fees. 150+ point inspected vehicles. Easy online financing.
            <br className="hidden sm:block" />
            Your next car is just a few clicks away.
          </p>

          {/* Dual CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            {/* Primary CTA */}
            <Link
              href="/inventory"
              className="group w-full sm:w-auto inline-flex items-center justify-center gap-2.5 bg-primary-600 text-white px-8 py-4 rounded-full font-semibold text-lg hover:bg-primary-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-400 transition-all shadow-lg shadow-primary-600/30 hover:shadow-xl hover:shadow-primary-600/40 hover:-translate-y-0.5"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              Browse Vehicles
              <svg className="w-4 h-4 opacity-60 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>

            {/* Secondary CTA */}
            <Link
              href="/financing"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 bg-white/10 backdrop-blur-sm text-white px-8 py-4 rounded-full font-semibold text-lg border-2 border-white/30 hover:bg-white/20 hover:border-white/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white transition-all hover:-translate-y-0.5"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Get Pre-Approved
            </Link>
          </div>
        </div>

        {/* Trust Indicators */}
        <div className="mt-16 flex flex-col sm:flex-row items-center justify-center gap-6 sm:gap-10" role="region" aria-label="Trust indicators">
          <div className="flex items-center gap-2.5 text-white/90">
            <div className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center border border-white/10">
              <svg className="w-5 h-5 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <span className="text-sm font-medium">150+ Point Inspection</span>
          </div>

          <div className="hidden sm:block w-px h-6 bg-white/20" aria-hidden="true" />

          <div className="flex items-center gap-2.5 text-white/90">
            <div className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center border border-white/10">
              <svg className="w-5 h-5 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
              </svg>
            </div>
            <span className="text-sm font-medium">Free Delivery in Ontario</span>
          </div>

          <div className="hidden sm:block w-px h-6 bg-white/20" aria-hidden="true" />

          <div className="flex items-center gap-2.5 text-white/90">
            <div className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center border border-white/10">
              <svg className="w-5 h-5 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <span className="text-sm font-medium">Secure Checkout</span>
          </div>
        </div>
      </div>
    </section>
  )
}
