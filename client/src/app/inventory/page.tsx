'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
import { PHASE3_CHANGE_EVENT, getVehicleHoldRecord } from '@/lib/phase3Mock'

interface Vehicle {
  id: string
  stockNumber?: string
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
  city: string
  province: string
  features?: string[]
  images: string[]
  status: string
  inventoryType?: string
}

type SortOption =
  | 'newest'
  | 'price-low'
  | 'price-high'
  | 'mileage-low'
  | 'mileage-high'
  | 'year-new'
  | 'year-old'
  | 'features-most'
  | 'features-least'

export default function InventoryPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [loading, setLoading] = useState(true)
  const [phase3Tick, setPhase3Tick] = useState(0)
  const [searchQuery, setSearchQuery] = useState('')
  const [showMobileFilters, setShowMobileFilters] = useState(false)
  const [sortBy, setSortBy] = useState<SortOption>('newest')
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 12
  const [filters, setFilters] = useState({
    make: '',
    bodyStyle: '',
    exteriorColor: '',
    inventoryType: '',
    features: [] as string[],
    minPrice: '',
    maxPrice: '',
    minYear: '',
    maxYear: '',
  })

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

  const normalizeFeatures = (raw: any): string[] => {
    if (!raw) return []
    if (Array.isArray(raw)) return raw.map(String).map((s) => s.trim()).filter(Boolean)
    if (typeof raw === 'string') {
      const s = raw.trim()
      if (!s) return []
      try {
        const parsed = JSON.parse(s)
        if (Array.isArray(parsed)) return parsed.map(String).map((x) => x.trim()).filter(Boolean)
      } catch {
        // ignore
      }
      return s
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean)
    }
    return []
  }

  const formatLocation = (city?: string, province?: string) => {
    const c = String(city || '').trim()
    const p = String(province || '').trim()
    if (c && p) return `${c}, ${p}`
    if (c) return c
    if (p) return p
    return ''
  }

  useEffect(() => {
    fetchVehicles()
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const onChange = () => setPhase3Tick((t) => t + 1)
    window.addEventListener(PHASE3_CHANGE_EVENT, onChange)
    return () => window.removeEventListener(PHASE3_CHANGE_EVENT, onChange)
  }, [])

  void phase3Tick

  const fetchVehicles = async () => {
    try {
      const { data, error } = await supabase
        .from('edc_vehicles')
        .select(
          'id, stock_number, make, model, series, year, price, mileage, odometer, odometer_unit, fuel_type, transmission, body_style, exterior_color, city, province, images, status, inventory_type, features'
        )
        .not('status', 'in', '("SOLD","Sold","VOID","Void")')
        .order('created_at', { ascending: false })

      if (error) throw error

      const mapped: Vehicle[] = (data || []).map((v: any) => ({
        id: v.id,
        stockNumber: v.stock_number || undefined,
        make: v.make,
        model: v.model,
        series: v.series || '',
        year: v.year,
        price: Number(v.price || 0),
        mileage: Number((v.odometer ?? v.mileage) || 0),
        odometer: v.odometer === null || v.odometer === undefined ? undefined : Number(v.odometer || 0),
        odometerUnit: v.odometer_unit || '',
        fuelType: v.fuel_type || '',
        transmission: v.transmission || '',
        bodyStyle: v.body_style || '',
        exteriorColor: v.exterior_color || '',
        city: v.city || '',
        province: v.province || '',
        features: normalizeFeatures(v.features),
        images: normalizeImages(v.images),
        status: v.status,
        inventoryType: v.inventory_type || '',
      }))

      setVehicles(mapped)
    } catch (_error) {
      console.error('Error fetching vehicles:', _error)
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

  const formatOdometer = (vehicle: Vehicle) => {
    const value = Number((vehicle.odometer ?? vehicle.mileage) || 0)
    const unitRaw = String(vehicle.odometerUnit || '').trim().toLowerCase()
    const unit = unitRaw === 'miles' || unitRaw === 'mi' ? 'mi' : 'km'
    return `${value.toLocaleString()} ${unit}`
  }

  // Get unique values from vehicles dynamically
  const uniqueMakes = useMemo(() => {
    const makes = Array.from(new Set(vehicles.map((v) => v.make).filter(Boolean)))
    return makes.sort()
  }, [vehicles])
  
  const uniqueBodyStyles = useMemo(() => {
    const styles = Array.from(new Set(vehicles.map((v) => v.bodyStyle).filter(Boolean)))
    return styles.sort()
  }, [vehicles])
  
  const uniqueColors = useMemo(() => {
    const colors = Array.from(new Set(vehicles.map((v) => v.exteriorColor).filter(Boolean)))
    return colors.sort()
  }, [vehicles])

  const uniqueFeatures = useMemo(() => {
    const all = vehicles.flatMap((v) => (Array.isArray(v.features) ? v.features : []))
    const uniq = Array.from(new Set(all.map((f) => String(f).trim()).filter(Boolean)))
    return uniq.sort((a, b) => a.localeCompare(b))
  }, [vehicles])

  // Get year range from actual vehicle data
  const yearRange = useMemo(() => {
    if (vehicles.length === 0) return []
    const years = vehicles.map((v) => v.year).filter(Boolean)
    const minYear = Math.min(...years)
    const maxYear = Math.max(...years)
    const range = []
    for (let y = maxYear; y >= minYear; y--) {
      range.push(y)
    }
    return range
  }, [vehicles])

  // Filter and search vehicles
  const filteredVehicles = useMemo(() => {
    const result = vehicles.filter((vehicle) => {
      // Search query - searches make, model, year
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        const searchString = `${vehicle.year} ${vehicle.make} ${vehicle.model}`.toLowerCase()
        if (!searchString.includes(query)) {
          return false
        }
      }
      
      // Filters
      if (filters.make && vehicle.make !== filters.make) return false
      if (filters.bodyStyle && vehicle.bodyStyle !== filters.bodyStyle) return false
      if (filters.exteriorColor && vehicle.exteriorColor !== filters.exteriorColor) return false
      if (filters.inventoryType && vehicle.inventoryType !== filters.inventoryType) return false
      if (filters.features.length > 0) {
        const vehicleFeatures = Array.isArray(vehicle.features)
          ? vehicle.features.map((f) => String(f).trim())
          : []
        const hasAll = filters.features.every((f) => vehicleFeatures.includes(String(f).trim()))
        if (!hasAll) return false
      }
      if (filters.minPrice && vehicle.price < parseInt(filters.minPrice)) return false
      if (filters.maxPrice && vehicle.price > parseInt(filters.maxPrice)) return false
      if (filters.minYear && vehicle.year < parseInt(filters.minYear)) return false
      if (filters.maxYear && vehicle.year > parseInt(filters.maxYear)) return false
      
      return true
    })

    // Sort
    switch (sortBy) {
      case 'price-low':
        result.sort((a, b) => a.price - b.price)
        break
      case 'price-high':
        result.sort((a, b) => b.price - a.price)
        break
      case 'mileage-low':
        result.sort((a, b) => a.mileage - b.mileage)
        break
      case 'mileage-high':
        result.sort((a, b) => b.mileage - a.mileage)
        break
      case 'year-new':
        result.sort((a, b) => b.year - a.year)
        break
      case 'year-old':
        result.sort((a, b) => a.year - b.year)
        break
      case 'features-most':
        result.sort(
          (a, b) => (Array.isArray(b.features) ? b.features.length : 0) - (Array.isArray(a.features) ? a.features.length : 0)
        )
        break
      case 'features-least':
        result.sort(
          (a, b) => (Array.isArray(a.features) ? a.features.length : 0) - (Array.isArray(b.features) ? b.features.length : 0)
        )
        break
      default:
        break
    }

    return result
  }, [vehicles, searchQuery, filters, sortBy])

  // Pagination
  const totalPages = Math.ceil(filteredVehicles.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedVehicles = filteredVehicles.slice(startIndex, endIndex)

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, filters, sortBy])

  const clearFilters = () => {
    setFilters({
      make: '',
      bodyStyle: '',
      exteriorColor: '',
      inventoryType: '',
      features: [],
      minPrice: '',
      maxPrice: '',
      minYear: '',
      maxYear: '',
    })
    setSearchQuery('')
  }

  const activeFilterCount =
    (searchQuery ? 1 : 0) +
    (filters.make ? 1 : 0) +
    (filters.bodyStyle ? 1 : 0) +
    (filters.exteriorColor ? 1 : 0) +
    (filters.inventoryType ? 1 : 0) +
    (filters.minPrice ? 1 : 0) +
    (filters.maxPrice ? 1 : 0) +
    (filters.minYear ? 1 : 0) +
    (filters.maxYear ? 1 : 0) +
    (filters.features.length > 0 ? 1 : 0)

  const FilterSidebar = ({ mobile = false }: { mobile?: boolean }) => (
    <div className={mobile ? '' : 'glass-card rounded-2xl p-6 sticky top-24'}>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
          <svg className="w-5 h-5 text-[#118df0]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
          Filters
        </h2>
        {activeFilterCount > 0 && (
          <button
            onClick={clearFilters}
            className="text-sm text-[#118df0] hover:underline"
          >
            Clear all
          </button>
        )}
      </div>

      <div className="space-y-5">
        {/* Make Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Make</label>
          <select
            value={filters.make}
            onChange={(e) => setFilters({ ...filters, make: e.target.value })}
            className="select-field"
          >
            <option value="">All Makes</option>
            {uniqueMakes.map((make) => (
              <option key={make} value={make}>{make}</option>
            ))}
          </select>
        </div>

        {/* Inventory Type Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Collection</label>
          <select
            value={filters.inventoryType}
            onChange={(e) => setFilters({ ...filters, inventoryType: e.target.value })}
            className="select-field"
          >
            <option value="">All Vehicles</option>
            <option value="FLEET">Fleet Cars</option>
            <option value="PREMIERE">Premiere Cars</option>
          </select>
        </div>

        {/* Body Style Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Body Style</label>
          <select
            value={filters.bodyStyle}
            onChange={(e) => setFilters({ ...filters, bodyStyle: e.target.value })}
            className="select-field"
          >
            <option value="">All Styles</option>
            {uniqueBodyStyles.map((style) => (
              <option key={style} value={style}>{style}</option>
            ))}
          </select>
        </div>

        {/* Exterior Color */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Exterior Color</label>
          <select
            value={filters.exteriorColor}
            onChange={(e) => setFilters({ ...filters, exteriorColor: e.target.value })}
            className="select-field"
          >
            <option value="">All Colors</option>
            {uniqueColors.map((color) => (
              <option key={color} value={color}>{color}</option>
            ))}
          </select>
        </div>

        {/* Features */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Features</label>
          <select
            value={filters.features[0] || ''}
            onChange={(e) => {
              const v = String(e.target.value || '').trim()
              if (!v) {
                setFilters({ ...filters, features: [] })
                return
              }
              setFilters({ ...filters, features: [v] })
            }}
            className="select-field"
          >
            <option value="">All Features</option>
            {uniqueFeatures.map((f) => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
        </div>

        {/* Price Range */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Price Range</label>
          <div className="grid grid-cols-2 gap-2">
            <select
              value={filters.minPrice}
              onChange={(e) => setFilters({ ...filters, minPrice: e.target.value })}
              className="select-field text-sm"
            >
              <option value="">Min</option>
              {[5000, 10000, 15000, 20000, 25000, 30000, 35000, 40000, 50000, 60000, 75000, 100000]
                .filter(price => !filters.maxPrice || price <= parseInt(filters.maxPrice))
                .map(price => (
                  <option key={price} value={price}>${price >= 1000 ? `${price / 1000}k` : price}</option>
                ))}
            </select>
            <select
              value={filters.maxPrice}
              onChange={(e) => setFilters({ ...filters, maxPrice: e.target.value })}
              className="select-field text-sm"
            >
              <option value="">Max</option>
              {[10000, 15000, 20000, 25000, 30000, 35000, 40000, 50000, 60000, 75000, 100000, 150000]
                .filter(price => !filters.minPrice || price >= parseInt(filters.minPrice))
                .map(price => (
                  <option key={price} value={price}>${price >= 1000 ? `${price / 1000}k` : price}</option>
                ))}
            </select>
          </div>
        </div>

        {/* Year Range */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Year Range</label>
          <div className="grid grid-cols-2 gap-2">
            <select
              value={filters.minYear}
              onChange={(e) => setFilters({ ...filters, minYear: e.target.value })}
              className="select-field text-sm"
            >
              <option value="">Min</option>
              {yearRange
                .filter(year => !filters.maxYear || year <= parseInt(filters.maxYear))
                .map((year) => (
                  <option key={year} value={year}>{year}</option>
                ))}
            </select>
            <select
              value={filters.maxYear}
              onChange={(e) => setFilters({ ...filters, maxYear: e.target.value })}
              className="select-field text-sm"
            >
              <option value="">Max</option>
              {yearRange
                .filter(year => !filters.minYear || year >= parseInt(filters.minYear))
                .map((year) => (
                  <option key={year} value={year}>{year}</option>
                ))}
            </select>
          </div>
        </div>
      </div>

      {mobile && (
        <div className="mt-6 flex gap-3">
          <button
            onClick={() => setShowMobileFilters(false)}
            className="flex-1 btn-primary"
          >
            Show {filteredVehicles.length} Results
          </button>
        </div>
      )}
    </div>
  )

  return (
    <div className="min-h-screen">
      {/* Hero Header */}
      <section className="relative overflow-hidden py-14 lg:py-18">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-[#118df0]/20 via-transparent to-transparent" />
        <div className="absolute top-10 right-10 w-72 h-72 bg-[#118df0]/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-96 h-48 bg-[#118df0]/5 rounded-full blur-3xl" />
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium bg-white/10 backdrop-blur-sm border border-white/20 text-white/90 mb-5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#38bdf8] opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#38bdf8]" />
              </span>
              {vehicles.length} Vehicles Available
            </span>
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-extrabold text-white mb-4 tracking-tight">
              Find Your Perfect <span className="bg-gradient-to-r from-[#38bdf8] to-[#0ea5e9] bg-clip-text text-transparent">Vehicle</span>
            </h1>
            <p className="text-slate-300 text-lg max-w-2xl mx-auto mb-8">
              Browse our selection of quality pre-owned vehicles
            </p>

            {/* Search Bar */}
            <div className="max-w-2xl mx-auto">
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                  <svg className="w-5 h-5 text-white/40 group-focus-within:text-[#38bdf8] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <input
                  type="text"
                  placeholder="Search by make, model, or year..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-13 pr-12 py-4 bg-white/10 backdrop-blur-xl border border-white/20 rounded-full text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-[#0ea5e9]/50 focus:border-[#0ea5e9]/30 focus:bg-white/15 transition-all shadow-lg shadow-black/10"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute inset-y-0 right-0 pr-5 flex items-center text-white/40 hover:text-white transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Desktop Filters Sidebar */}
          <div className="hidden lg:block lg:w-72 flex-shrink-0">
            <FilterSidebar />
          </div>

          {/* Vehicle Grid */}
          <div className="flex-1">
            {/* Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-4">
                {/* Mobile Filter Button */}
                <button
                  onClick={() => setShowMobileFilters(true)}
                  className="lg:hidden flex items-center gap-2 px-4 py-2 glass-card rounded-xl text-gray-700 font-medium"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                  </svg>
                  Filters
                  {activeFilterCount > 0 && (
                    <span className="bg-[#118df0] text-white text-xs px-2 py-0.5 rounded-full">
                      {activeFilterCount}
                    </span>
                  )}
                </button>

                <p className="text-gray-600">
                  Showing {startIndex + 1}-{Math.min(endIndex, filteredVehicles.length)} of {' '}
                  <span className="font-semibold text-gray-900">{filteredVehicles.length}</span>
                  {' '}total vehicles
                </p>
              </div>

              {/* Sort Dropdown */}
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-600">Sort by:</label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortOption)}
                  className="select-field py-2 text-sm w-auto"
                >
                  <option value="newest">Newest</option>
                  <option value="price-low">Price: Low to High</option>
                  <option value="price-high">Price: High to Low</option>
                  <option value="mileage-low">Mileage: Low to High</option>
                  <option value="mileage-high">Mileage: High to Low</option>
                  <option value="year-new">Year: Newest First</option>
                  <option value="year-old">Year: Oldest First</option>
                  <option value="features-most">Features: Most</option>
                  <option value="features-least">Features: Least</option>
                </select>
              </div>
            </div>

            {/* Active Filters Pills */}
            {activeFilterCount > 0 && (
              <div className="flex flex-wrap gap-2 mb-6">
                {searchQuery && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 bg-[#118df0]/10 text-[#118df0] rounded-full text-sm">
                    Search: &quot;{searchQuery}&quot;
                    <button onClick={() => setSearchQuery('')} className="hover:text-[#0a7dd4]">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </span>
                )}
                {filters.make && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 bg-[#118df0]/10 text-[#118df0] rounded-full text-sm">
                    {filters.make}
                    <button onClick={() => setFilters({ ...filters, make: '' })} className="hover:text-[#0a7dd4]">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </span>
                )}
                {filters.bodyStyle && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 bg-[#118df0]/10 text-[#118df0] rounded-full text-sm">
                    {filters.bodyStyle}
                    <button onClick={() => setFilters({ ...filters, bodyStyle: '' })} className="hover:text-[#0a7dd4]">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </span>
                )}
                {filters.exteriorColor && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 bg-[#118df0]/10 text-[#118df0] rounded-full text-sm">
                    {filters.exteriorColor}
                    <button onClick={() => setFilters({ ...filters, exteriorColor: '' })} className="hover:text-[#0a7dd4]">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </span>
                )}
                {filters.features.length > 0 && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 bg-[#118df0]/10 text-[#118df0] rounded-full text-sm">
                    Feature: {filters.features[0]}
                    <button onClick={() => setFilters({ ...filters, features: [] })} className="hover:text-[#0a7dd4]">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </span>
                )}
              </div>
            )}

            {/* Vehicle Grid */}
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="glass-card rounded-2xl overflow-hidden">
                    <div className="h-52 shimmer" />
                    <div className="p-5 space-y-3">
                      <div className="h-5 shimmer rounded-lg w-3/4" />
                      <div className="h-4 shimmer rounded-lg w-1/2" />
                      <div className="flex gap-2 pt-2">
                        <div className="h-8 shimmer rounded-full w-20" />
                        <div className="h-8 shimmer rounded-full w-20" />
                        <div className="h-8 shimmer rounded-full w-16" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredVehicles.length > 0 ? (
              <>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {paginatedVehicles.map((vehicle) => (
                  <Link key={vehicle.id} href={`/inventory/${vehicle.id}`}>
                    <div className="glass-card rounded-2xl overflow-hidden group h-full flex flex-col transition-all duration-300 hover:shadow-xl hover:shadow-black/10 hover:-translate-y-1 hover:bg-white/90">
                      <div className="relative h-52 bg-gradient-to-br from-gray-100 to-gray-200 overflow-hidden flex-shrink-0">
                        {(() => {
                          const rec = getVehicleHoldRecord(vehicle.id)
                          const isOnHold = rec?.status === 'ON_HOLD'
                          return isOnHold ? (
                            <div className="absolute top-4 left-4 z-10">
                              <span className="inline-flex items-center rounded-full bg-amber-500/90 px-3 py-1 text-xs font-semibold text-white shadow">
                                On Hold
                              </span>
                            </div>
                          ) : null
                        })()}

                        {vehicle.images && vehicle.images.length > 0 ? (
                          <img
                            src={toImageSrc(vehicle.images[0])}
                            alt={`${vehicle.year} ${vehicle.make} ${vehicle.model}`}
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
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
                        {/* Hover overlay with View Vehicle button */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end justify-center pb-4">
                          <span className="inline-flex items-center gap-1.5 text-white text-sm font-semibold bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full border border-white/30">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                            View Vehicle
                          </span>
                        </div>
                        <div className="absolute top-4 right-4 price-tag">
                          {formatPrice(vehicle.price)}
                        </div>
                      </div>
                      <div className="p-5 flex flex-col flex-1">
                        <h3 className="text-lg font-bold text-gray-900 group-hover:text-[#118df0] transition-colors line-clamp-2 leading-snug">
                          {vehicle.year} {vehicle.make} {vehicle.model} {vehicle.series}
                        </h3>
                        {formatLocation(vehicle.city, vehicle.province) && (
                          <p className="text-sm text-gray-500 mt-1 flex items-center gap-1">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            </svg>
                            {formatLocation(vehicle.city, vehicle.province)}
                          </p>
                        )}
                        <div className="flex flex-wrap gap-1.5 mt-3">
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-600 bg-gray-100/80 px-2.5 py-1.5 rounded-full">
                            <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            {formatOdometer(vehicle)}
                          </span>
                          {vehicle.transmission && vehicle.transmission.trim() !== '' && (
                            <span className="inline-flex items-center text-xs font-medium text-gray-600 bg-gray-100/80 px-2.5 py-1.5 rounded-full">
                              {vehicle.transmission}
                            </span>
                          )}
                          {vehicle.fuelType && vehicle.fuelType.trim() !== '' && (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-600 bg-gray-100/80 px-2.5 py-1.5 rounded-full">
                              <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                              {vehicle.fuelType}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="mt-12 flex justify-center items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className={`px-4 py-2 rounded-lg font-medium transition-all ${
                      currentPage === 1
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : 'bg-white text-gray-700 hover:bg-[#118df0] hover:text-white shadow-sm'
                    }`}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>

                  {/* Page Numbers */}
                  <div className="flex gap-2">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum
                      if (totalPages <= 5) {
                        pageNum = i + 1
                      } else if (currentPage <= 3) {
                        pageNum = i + 1
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i
                      } else {
                        pageNum = currentPage - 2 + i
                      }
                      
                      return (
                        <button
                          key={pageNum}
                          onClick={() => setCurrentPage(pageNum)}
                          className={`px-4 py-2 rounded-lg font-medium transition-all ${
                            currentPage === pageNum
                              ? 'bg-[#118df0] text-white shadow-md'
                              : 'bg-white text-gray-700 hover:bg-gray-100 shadow-sm'
                          }`}
                        >
                          {pageNum}
                        </button>
                      )
                    })}
                  </div>

                  <button
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className={`px-4 py-2 rounded-lg font-medium transition-all ${
                      currentPage === totalPages
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : 'bg-white text-gray-700 hover:bg-[#118df0] hover:text-white shadow-sm'
                    }`}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              )}
              </>
            ) : (
              <div className="glass-card rounded-2xl text-center py-16 px-6">
                <div className="w-20 h-20 bg-gradient-to-br from-[#118df0]/10 to-[#118df0]/5 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <svg className="w-10 h-10 text-[#118df0]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-gray-700 mb-2">No Vehicles Found</h3>
                <p className="text-gray-500 mb-8 max-w-md mx-auto">Try adjusting your filters or search query to find what you&apos;re looking for.</p>
                <button onClick={clearFilters} className="inline-flex items-center gap-2 bg-[#118df0] text-white px-6 py-3 rounded-full font-semibold hover:bg-[#0a7dd4] transition-all shadow-lg shadow-[#118df0]/20 hover:shadow-xl hover:-translate-y-0.5">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                  Clear All Filters
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Filter Drawer */}
      {showMobileFilters && (
        <div className="fixed inset-0 z-50 lg:hidden">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowMobileFilters(false)}
          ></div>
          
          {/* Drawer */}
          <div className="absolute right-0 top-0 h-full w-full max-w-sm bg-white shadow-2xl overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900">Filters</h2>
                <button
                  onClick={() => setShowMobileFilters(false)}
                  className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <FilterSidebar mobile />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
