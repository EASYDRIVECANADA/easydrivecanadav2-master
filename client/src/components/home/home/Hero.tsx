'use client'

import Link from 'next/link'
import { useState } from 'react'

export default function Hero() {
  const [searchQuery, setSearchQuery] = useState('')

  return (
    <section className="relative bg-gradient-to-br from-secondary-50 to-white overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute top-20 left-10 w-72 h-72 bg-primary-500 rounded-full blur-3xl"></div>
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-primary-400 rounded-full blur-3xl"></div>
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24">
        <div className="text-center max-w-4xl mx-auto">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-primary-50 text-primary-700 px-4 py-2 rounded-full text-sm font-medium mb-6">
            <span className="flex h-2 w-2 rounded-full bg-primary-500"></span>
            Canada&apos;s Most Trusted Car Marketplace
          </div>

          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-secondary-900 mb-6 leading-tight">
            Find Your Perfect Car,
            <br />
            <span className="text-primary-600">The Easier Way</span>
          </h1>
          
          <p className="text-lg md:text-xl text-secondary-600 mb-10 max-w-2xl mx-auto">
            Browse thousands of quality-inspected vehicles with transparent pricing, 
            verified history, and delivery right to your door.
          </p>

          {/* Search Box - Clutch Style */}
          <div className="bg-white rounded-2xl p-3 md:p-4 max-w-3xl mx-auto shadow-card border border-secondary-100">
            <div className="flex flex-col md:flex-row gap-3">
              {/* Search Input */}
              <div className="flex-1 relative">
                <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-secondary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  placeholder="Search by make, model, or keyword..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 rounded-xl border border-secondary-200 text-secondary-800 placeholder-secondary-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                />
              </div>

              {/* Filters Button */}
              <button className="flex items-center justify-center gap-2 px-6 py-4 bg-secondary-100 text-secondary-700 rounded-xl hover:bg-secondary-200 transition-colors font-medium">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                </svg>
                Filters
              </button>

              {/* Search Button */}
              <Link 
                href={`/cars${searchQuery ? `?q=${encodeURIComponent(searchQuery)}` : ''}`}
                className="bg-primary-600 text-white px-8 py-4 rounded-xl hover:bg-primary-700 transition-all font-semibold shadow-sm hover:shadow-md flex items-center justify-center gap-2"
              >
                Search Cars
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </Link>
            </div>

            {/* Quick Filters */}
            <div className="flex flex-wrap items-center gap-2 mt-4 pt-4 border-t border-secondary-100">
              <span className="text-sm text-secondary-500">Popular:</span>
              {['Toyota', 'Honda', 'SUVs', 'Under $20k', 'Electric'].map((filter) => (
                <Link
                  key={filter}
                  href={`/cars?filter=${filter.toLowerCase()}`}
                  className="px-3 py-1.5 bg-secondary-50 text-secondary-600 rounded-full text-sm hover:bg-primary-50 hover:text-primary-700 transition-colors"
                >
                  {filter}
                </Link>
              ))}
            </div>
          </div>

          {/* Trust Indicators */}
          <div className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-6 max-w-3xl mx-auto">
            <div className="flex flex-col items-center">
              <div className="text-3xl md:text-4xl font-bold text-secondary-900">2,500+</div>
              <div className="text-secondary-500 text-sm">Vehicles Listed</div>
            </div>
            <div className="flex flex-col items-center">
              <div className="text-3xl md:text-4xl font-bold text-secondary-900">4.9★</div>
              <div className="text-secondary-500 text-sm">Customer Rating</div>
            </div>
            <div className="flex flex-col items-center">
              <div className="text-3xl md:text-4xl font-bold text-secondary-900">150+</div>
              <div className="text-secondary-500 text-sm">Point Inspection</div>
            </div>
            <div className="flex flex-col items-center">
              <div className="text-3xl md:text-4xl font-bold text-secondary-900">10-Day</div>
              <div className="text-secondary-500 text-sm">Money-Back</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
