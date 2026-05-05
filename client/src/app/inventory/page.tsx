'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
// phase3Mock removed — reservation status now comes from edc_vehicles.status

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
  categories?: string
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
  const [searchQuery, setSearchQuery] = useState('')
  const [showMobileFilters, setShowMobileFilters] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
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

  const [quickFilters, setQuickFilters] = useState({
    sellerTypes: [] as string[],
    newListings: false,
    dealOfWeek: false,
    featured: false,
    priceUnder: null as number | null,
  })

  const toggleSellerType = (type: string) => {
    setQuickFilters(prev => ({
      ...prev,
      sellerTypes: prev.sellerTypes.includes(type)
        ? prev.sellerTypes.filter(t => t !== type)
        : [...prev.sellerTypes, type]
    }))
  }

  const toggleQuickFilter = (key: keyof typeof quickFilters, value?: any) => {
    setQuickFilters(prev => ({
      ...prev,
      [key]: key === 'priceUnder' ? (prev.priceUnder === value ? null : value) : !prev[key]
    }))
  }

  const [bucketImageCache] = useState(() => new Map<string, string[]>())

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

  const fetchVehicles = async () => {
    try {
      const { data, error } = await supabase
        .from('edc_vehicles')
        .select(
          'id, stock_number, make, model, series, year, price, mileage, odometer, odometer_unit, fuel_type, transmission, body_style, exterior_color, city, province, status, inventory_type, features, categories'
        )
        .order('created_at', { ascending: false })

      if (error) throw error

      const loadBucketImages = async (vehicleId: string): Promise<string[]> => {
        const id = String(vehicleId || '').trim()
        if (!id) return []
        const cached = bucketImageCache.get(id)
        if (cached) return cached

        try {
          const { data, error: listError } = await supabase.storage
            .from('vehicle-photos')
            .list(id, {
              limit: 100,
              sortBy: { column: 'name', order: 'asc' },
            })

          if (listError || !Array.isArray(data) || data.length === 0) {
            bucketImageCache.set(id, [])
            return []
          }

          const files = data
            .filter((f) => !!f?.name && !String(f.name).endsWith('/'))
            .map((f) => `${id}/${f.name}`)

          const urls: string[] = []
          for (const path of files) {
            const pub = supabase.storage.from('vehicle-photos').getPublicUrl(path)
            const publicUrl = String(pub?.data?.publicUrl || '').trim()
            if (publicUrl) {
              urls.push(publicUrl)
              continue
            }

            const { data: signed } = await supabase.storage
              .from('vehicle-photos')
              .createSignedUrl(path, 60 * 60)
            const signedUrl = String((signed as any)?.signedUrl || '').trim()
            if (signedUrl) urls.push(signedUrl)
          }

          bucketImageCache.set(id, urls)
          return urls
        } catch {
          bucketImageCache.set(id, [])
          return []
        }
      }

      const mapped: Vehicle[] = await Promise.all(
        (data || []).map(async (v: any) => ({
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
          images: await loadBucketImages(String(v.id)),
          status: v.status,
          inventoryType: v.inventory_type || '',
          categories: v.categories || '',
        }))
      )

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

      // Quick filters
      if (quickFilters.sellerTypes.length > 0) {
        const cat = String((vehicle as any)?.categories || '').toLowerCase()
        const match = quickFilters.sellerTypes.some(type =>
          (type === 'private' && cat.includes('private')) ||
          (type === 'dealer' && (cat.includes('dealer') || cat.includes('dealership'))) ||
          (type === 'fleet' && cat.includes('fleet')) ||
          (type === 'premier' && cat.includes('premier'))
        )
        if (!match) return false
      }
      if (quickFilters.newListings) {
        const sevenDaysAgo = new Date()
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
        const createdAt = (vehicle as any)?.created_at || (vehicle as any)?.createdAt
        if (!createdAt || new Date(createdAt) < sevenDaysAgo) return false
      }
      if (quickFilters.dealOfWeek && !(vehicle as any)?.deal_of_week) return false
      if (quickFilters.featured && !(vehicle as any)?.featured) return false
      if (quickFilters.priceUnder !== null && vehicle.price > quickFilters.priceUnder) return false

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
  }, [vehicles, searchQuery, filters, sortBy, quickFilters])

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
    setQuickFilters({ sellerTypes: [], newListings: false, dealOfWeek: false, featured: false, priceUnder: null })
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
    <div className="min-h-screen bg-gray-50">
      {/* Page Header */}
      <section className="px-4 sm:px-6 lg:px-8 pt-8 pb-6 max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-1">Shop our inventory</h1>
        <div className="flex items-center justify-between gap-4">
          <p className="text-[#118df0] font-medium text-sm">{vehicles.length} vehicles available</p>
          {!loading && filteredVehicles.length > 0 && (
            <p className="hidden lg:block text-sm text-gray-500">
              Showing {startIndex + 1}–{Math.min(endIndex, filteredVehicles.length)} of{' '}
              <span className="font-semibold text-gray-900">{filteredVehicles.length}</span> vehicles
            </p>
          )}
        </div>
      </section>

      {/* Main Content */}
      <div className="w-full px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto pb-6">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Filter Sidebar */}
          <aside className="hidden lg:block w-64 flex-shrink-0">
            <div className="sticky top-24 bg-white border border-gray-300 rounded-xl shadow-sm p-5 space-y-6">
              {/* Search */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Search</p>
                <input
                  type="text"
                  placeholder="Make, model..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#118df0]/30 focus:border-[#118df0]"
                />
              </div>

              {/* Max Price Slider */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  Max Price: {filters.maxPrice ? `$${parseInt(filters.maxPrice).toLocaleString()}` : '$150,000'}
                </p>
                <input
                  type="range"
                  min={5000}
                  max={150000}
                  step={1000}
                  value={filters.maxPrice || 150000}
                  onChange={(e) => setFilters({ ...filters, maxPrice: e.target.value })}
                  className="w-full accent-gray-900"
                />
              </div>

              {/* Min Year Slider */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  Min Year: {filters.minYear || new Date().getFullYear() - 10}
                </p>
                <input
                  type="range"
                  min={2000}
                  max={new Date().getFullYear()}
                  step={1}
                  value={filters.minYear || new Date().getFullYear() - 10}
                  onChange={(e) => setFilters({ ...filters, minYear: e.target.value })}
                  className="w-full accent-gray-900"
                />
              </div>

              {/* Make */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Make</p>
                <div className="space-y-1">
                  {uniqueMakes.map((make) => (
                    <label key={make} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="make"
                        value={make}
                        checked={filters.make === make}
                        onChange={() => {}}
                        onClick={() => setFilters({ ...filters, make: filters.make === make ? '' : make })}
                        className="accent-[#118df0]"
                      />
                      <span className="text-sm text-gray-700">{make}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Body Type */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Body Type</p>
                <div className="space-y-1">
                  {uniqueBodyStyles.map((style) => (
                    <label key={style} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="bodyStyle"
                        value={style}
                        checked={filters.bodyStyle === style}
                        onChange={() => {}}
                        onClick={() => setFilters({ ...filters, bodyStyle: filters.bodyStyle === style ? '' : style })}
                        className="accent-[#118df0]"
                      />
                      <span className="text-sm text-gray-700">{style}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Listing Type */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Listing Type</p>
                <div className="space-y-1.5">
                  {[
                    { key: 'premier', label: 'EDC Premier', color: '#118df0' },
                    { key: 'dealer', label: 'Dealer Select', color: '#8b5cf6' },
                    { key: 'fleet', label: 'Fleet Select', color: '#374151' },
                    { key: 'private', label: 'Private Seller', color: '#f59e0b' },
                  ].map(({ key, label, color }) => (
                    <label key={key} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="sellerType"
                        value={key}
                        checked={quickFilters.sellerTypes.includes(key)}
                        onChange={() => {}}
                        onClick={() => toggleSellerType(key)}
                        className="accent-[#118df0]"
                      />
                      <span className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                      <span className="text-sm text-gray-700">{label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Sort By */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Sort By</p>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortOption)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#118df0]/30 focus:border-[#118df0]"
                >
                  <option value="newest">Newest</option>
                  <option value="price-low">Price: Low to High</option>
                  <option value="price-high">Price: High to Low</option>
                  <option value="mileage-low">Mileage: Low to High</option>
                  <option value="mileage-high">Mileage: High to Low</option>
                  <option value="year-new">Year: Newest First</option>
                  <option value="year-old">Year: Oldest First</option>
                </select>
              </div>

              {/* Reset */}
              <button
                onClick={clearFilters}
                className="w-full border border-gray-300 rounded-full py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Reset filters
              </button>
            </div>
          </aside>

          {/* Vehicle Grid */}
          <div className="flex-1 min-w-0">
            {/* Toolbar (mobile only) */}
            <div className="lg:hidden flex flex-wrap items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-4">
                {/* Mobile Filter Button */}
                <button
                  onClick={() => setShowMobileFilters(true)}
                  className="lg:hidden flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-xl text-gray-700 font-medium text-sm"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                  </svg>
                  Filters
                  {activeFilterCount > 0 && (
                    <span className="bg-[#118df0] text-white text-xs px-2 py-0.5 rounded-full">
                      {activeFilterCount}
                    </span>
                  )}
                </button>
                <p className="lg:hidden text-sm text-gray-500">
                  Showing {startIndex + 1}–{Math.min(endIndex, filteredVehicles.length)} of{' '}
                  <span className="font-semibold text-gray-900">{filteredVehicles.length}</span> vehicles
                </p>
              </div>

              {/* Sort Dropdown */}
              <div className="lg:hidden flex items-center gap-2">
                <label className="text-sm text-gray-500">Sort by:</label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortOption)}
                  className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#118df0]/30"
                >
                  <option value="newest">Newest</option>
                  <option value="price-low">Price: Low to High</option>
                  <option value="price-high">Price: High to Low</option>
                  <option value="mileage-low">Mileage: Low to High</option>
                  <option value="mileage-high">Mileage: High to Low</option>
                  <option value="year-new">Year: Newest First</option>
                  <option value="year-old">Year: Oldest First</option>
                </select>
              </div>
            </div>

            {/* Vehicle Grid */}
            {loading ? (
              <div className="grid grid-cols-2 md:grid-cols-2 xl:grid-cols-3 gap-3 md:gap-5">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="border border-gray-300 rounded-xl overflow-hidden shadow-sm">
                    <div className="h-48 bg-gray-100 animate-pulse" />
                    <div className="p-4 space-y-3">
                      <div className="h-4 bg-gray-100 animate-pulse rounded w-3/4" />
                      <div className="h-5 bg-gray-100 animate-pulse rounded w-1/3" />
                      <div className="h-3 bg-gray-100 animate-pulse rounded w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredVehicles.length > 0 ? (
              <>
              <div className="grid grid-cols-2 md:grid-cols-2 xl:grid-cols-3 gap-3 md:gap-5">
                {paginatedVehicles.map((vehicle) => {
                  const raw = String((vehicle as any)?.categories ?? '').trim().toLowerCase()
                  let badgeLabel = ''
                  let badgeBg = '#118df0'
                  if (raw.includes('premier') || raw.includes('premiere')) {
                    badgeLabel = 'EDC PREMIER'; badgeBg = '#118df0'
                  } else if (raw.includes('dealer')) {
                    badgeLabel = 'DEALER SELECT'; badgeBg = '#8b5cf6'
                  } else if (raw.includes('fleet')) {
                    badgeLabel = 'FLEET SELECT'; badgeBg = '#374151'
                  } else if (raw.includes('private')) {
                    badgeLabel = 'PRIVATE SELLER'; badgeBg = '#f59e0b'
                  }

                  const sellerName = (vehicle as any)?.sellerName || (vehicle as any)?.dealer_name || ''

                  return (
                    <Link key={vehicle.id} href={`/inventory/${vehicle.id}`} className="block h-full">
                      <div className="h-full flex flex-col border border-gray-300 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-200 bg-white group">
                        {/* Image */}
                        <div className="relative h-36 sm:h-48 bg-gray-100 overflow-hidden">
                          {badgeLabel && (
                            <span
                              className="absolute top-2 left-2 z-10 text-[10px] font-bold tracking-wider px-2.5 py-1 rounded-full text-white shadow-sm"
                              style={{ backgroundColor: badgeBg }}
                            >
                              {badgeLabel}
                            </span>
                          )}
                          {(() => {
                            const s = vehicle.status?.toLowerCase()
                            if (s !== 'reserved') return null
                            return (
                              <span className="absolute top-2 right-2 z-10 text-[10px] font-bold px-2 py-1 rounded bg-amber-500 text-white tracking-wider">
                                RESERVED
                              </span>
                            )
                          })()}
                          {vehicle.images && vehicle.images.length > 0 ? (
                            <img
                              src={toImageSrc(vehicle.images[0])}
                              alt={`${vehicle.year} ${vehicle.make} ${vehicle.model}`}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <svg className="w-12 h-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                            </div>
                          )}
                        </div>

                        {/* Card Body */}
                        <div className="p-3 sm:p-4 flex-1 flex flex-col">
                          <h3 className="text-sm font-semibold text-gray-900 leading-snug line-clamp-1">
                            {vehicle.year} {vehicle.make} {vehicle.model}
                          </h3>
                          {/* Series — desktop only */}
                          {vehicle.series && (
                            <p className="hidden sm:block text-xs text-[#118df0] font-medium mt-1 line-clamp-1">{vehicle.series}</p>
                          )}

                          {/* Mobile: miles + price only */}
                          <div className="flex sm:hidden items-center justify-between mt-auto pt-2">
                            <span className="flex items-center gap-1 text-xs text-gray-500">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              {formatOdometer(vehicle)}
                            </span>
                            <p className="text-sm font-bold text-gray-900">{formatPrice(vehicle.price)}</p>
                          </div>

                          {/* Desktop: full stats */}
                          <div className="hidden sm:flex items-center justify-between gap-2 mt-2">
                            <p className="text-base font-bold text-gray-900">{formatPrice(vehicle.price)}</p>
                          </div>
                          <div className="hidden sm:flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 mt-2">
                            <span className="flex items-center gap-1">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              {formatOdometer(vehicle)}
                            </span>
                            {vehicle.transmission && (
                              <span className="flex items-center gap-1">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
                                </svg>
                                {vehicle.transmission}
                              </span>
                            )}
                            {vehicle.fuelType && (
                              <span className="flex items-center gap-1">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                </svg>
                                {vehicle.fuelType}
                              </span>
                            )}
                          </div>

                          {/* Seller info — desktop only */}
                          {sellerName && (
                            <p className="hidden sm:block text-xs text-gray-400 mt-2">Sold by {sellerName}</p>
                          )}
                        </div>
                      </div>
                    </Link>
                  )
                })}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="mt-10 flex justify-center items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                      currentPage === 1
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : 'bg-white border border-gray-200 text-gray-700 hover:bg-[#118df0] hover:text-white hover:border-[#118df0]'
                    }`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <div className="flex gap-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum
                      if (totalPages <= 5) { pageNum = i + 1 }
                      else if (currentPage <= 3) { pageNum = i + 1 }
                      else if (currentPage >= totalPages - 2) { pageNum = totalPages - 4 + i }
                      else { pageNum = currentPage - 2 + i }
                      return (
                        <button
                          key={pageNum}
                          onClick={() => setCurrentPage(pageNum)}
                          className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                            currentPage === pageNum
                              ? 'bg-[#118df0] text-white'
                              : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
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
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                      currentPage === totalPages
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : 'bg-white border border-gray-200 text-gray-700 hover:bg-[#118df0] hover:text-white hover:border-[#118df0]'
                    }`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              )}
              </>
            ) : (
              <div className="text-center py-16 px-6 border border-gray-300 rounded-xl">
                <svg className="w-12 h-12 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h3 className="text-lg font-semibold text-gray-700 mb-2">No Vehicles Found</h3>
                <p className="text-gray-400 text-sm mb-6">Try adjusting your filters or search query.</p>
                <button onClick={clearFilters} className="inline-flex items-center gap-2 bg-[#118df0] text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-[#0a7dd4] transition-colors">
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
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowMobileFilters(false)} />
          <div className="absolute right-0 top-0 h-full w-full max-w-sm bg-white shadow-2xl overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-gray-900">Filters</h2>
                <button onClick={() => setShowMobileFilters(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

