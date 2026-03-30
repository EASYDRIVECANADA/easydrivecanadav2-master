"use client"

import { useEffect, useMemo, useState } from 'react'
import VehicleCard from '@/components/VehicleCard'
import { supabase } from '@/lib/supabaseClient'

type MarketVehicle = {
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
  bodyStyle?: string
  exteriorColor?: string
  interiorColor?: string
  vin?: string
  engine?: string
  drivetrain?: string
  odometer?: number
  odometerUnit?: string
  features?: string[]
  collection?: string
  adDescription?: string
  categories?: string
}

export default function MarketplacePage() {
  const [vehicles, setVehicles] = useState<MarketVehicle[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<MarketVehicle | null>(null)
  const [selectedImageIndex, setSelectedImageIndex] = useState(0)

  // CARFAX viewer modal
  const [carfaxModal, setCarfaxModal] = useState<{
    open: boolean
    loading: boolean
    files: { name: string; path: string; publicUrl: string }[]
    activeIndex: number
  }>({ open: false, loading: false, files: [], activeIndex: 0 })

  const [bucketImageCache] = useState(() => new Map<string, string[]>())

  const [make, setMake] = useState('')
  const [collection, setCollection] = useState('')
  const [category, setCategory] = useState('')
  const [bodyStyle, setBodyStyle] = useState('')
  const [exteriorColor, setExteriorColor] = useState('')
  const [feature, setFeature] = useState('')
  const [minPrice, setMinPrice] = useState('')
  const [maxPrice, setMaxPrice] = useState('')
  const [minYear, setMinYear] = useState('')
  const [maxYear, setMaxYear] = useState('')
  const [sort, setSort] = useState<'newest' | 'price_asc' | 'price_desc'>('newest')

  // Quick Filter states
  const [quickFilters, setQuickFilters] = useState({
    sellerTypes: [] as string[],
    newListings: false,
    dealOfWeek: false,
    featured: false,
    priceUnder: null as number | null,
  })

  const openCarfaxModal = async (vehicleId: string) => {
    setCarfaxModal({ open: true, loading: true, files: [] })
    try {
      const { data, error } = await supabase.storage
        .from('Carfax')
        .list(vehicleId, { limit: 100, sortBy: { column: 'name', order: 'asc' } })

      if (error || !Array.isArray(data) || data.length === 0) {
        setCarfaxModal({ open: true, loading: false, files: [], activeIndex: 0 })
        return
      }

      const files = data
        .filter((f) => !!f?.name && !String(f.name).endsWith('/'))
        .map((f) => {
          const path = `${vehicleId}/${f.name}`
          const { data: urlData } = supabase.storage.from('Carfax').getPublicUrl(path)
          return { name: f.name, path, publicUrl: urlData.publicUrl }
        })

      setCarfaxModal({ open: true, loading: false, files, activeIndex: 0 })
    } catch {
      setCarfaxModal({ open: true, loading: false, files: [], activeIndex: 0 })
    }
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

  useEffect(() => {
    let cancelled = false
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
          .map((x) => x.trim())
          .filter(Boolean)
      }
      return []
    }

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
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch('/api/vehicles', { cache: 'no-store' })
        if (!res.ok) {
          const text = await res.text().catch(() => '')
          throw new Error(text || `Failed to fetch vehicles (${res.status})`)
        }

        const json = await res.json().catch(() => null)
        const data = Array.isArray(json?.vehicles) ? json.vehicles : []
        if (cancelled) return
        const mapped: MarketVehicle[] = await Promise.all(
          (data || []).map(async (r: any) => {
            const id = String(r.id)
            const imgs = normalizeImages(r.images ?? r.image_urls ?? r.image)
            const features = normalizeFeatures(r.features)
            const bucketImgs = imgs.length === 0 ? await loadBucketImages(id) : []
            return {
              id,
              make: r.make || '',
              model: r.model || '',
              series: r.series || '',
              year: Number(r.year) || 0,
              price: Number(r.price) || 0,
              mileage: Number(r.mileage ?? r.odometer ?? 0) || 0,
              fuelType: r.fuelType || r.fuel_type || '',
              transmission: r.transmission || '',
              images: imgs.length ? imgs : bucketImgs,
              bodyStyle: r.body_style || r.bodyStyle || '',
              exteriorColor: r.exterior_color || r.color || '',
              interiorColor: r.interior_color || '',
              vin: r.vin || '',
              engine: r.engine || '',
              drivetrain: r.drivetrain || '',
              odometer: r.odometer === null || r.odometer === undefined ? undefined : Number(r.odometer || 0),
              odometerUnit: r.odometer_unit || '',
              features,
              collection: r.collection || r.inventory_type || '',
              adDescription: r.ad_description || '',
              categories: r.categories || r.category || '',
            }
          })
        )
        setVehicles(mapped)
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Failed to load vehicles')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  const filtered = useMemo(() => {
    const hasQuickFilters = 
      quickFilters.sellerTypes.length > 0 ||
      quickFilters.newListings ||
      quickFilters.dealOfWeek ||
      quickFilters.featured ||
      quickFilters.priceUnder !== null

    const noFilters =
      !make &&
      !collection &&
      !category &&
      !bodyStyle &&
      !exteriorColor &&
      !feature &&
      !minPrice.trim() &&
      !maxPrice.trim() &&
      !minYear.trim() &&
      !maxYear.trim() &&
      !hasQuickFilters

    let rows = [...vehicles]
    
    if (noFilters) {
      if (sort === 'newest') rows.sort((a, b) => b.year - a.year)
      if (sort === 'price_asc') rows.sort((a, b) => a.price - b.price)
      if (sort === 'price_desc') rows.sort((a, b) => b.price - a.price)
      return rows
    }

    // Apply sidebar filters
    const m = make.trim()
    const c = collection.trim()
    const cat = category.trim().toLowerCase()
    const bs = bodyStyle.trim()
    const ec = exteriorColor.trim()
    const ft = feature.trim()

    if (m) rows = rows.filter((v) => (v.make || '').trim() === m)
    if (c) rows = rows.filter((v) => ((v.collection || '').trim()) === c)
    if (cat) rows = rows.filter((v) => String((v as any)?.categories || '').toLowerCase().includes(cat))
    if (bs) rows = rows.filter((v) => ((v.bodyStyle || '').trim()) === bs)
    if (ec) rows = rows.filter((v) => ((v.exteriorColor || '').trim()) === ec)
    if (ft) rows = rows.filter((v) => (v.features || []).includes(ft))

    const hasMinPrice = minPrice.trim() !== ''
    const hasMaxPrice = maxPrice.trim() !== ''
    const hasMinYear = minYear.trim() !== ''
    const hasMaxYear = maxYear.trim() !== ''

    const pMin = hasMinPrice ? Number(minPrice) : null
    const pMax = hasMaxPrice ? Number(maxPrice) : null
    if (pMin !== null && Number.isFinite(pMin)) rows = rows.filter((v) => v.price >= pMin)
    if (pMax !== null && Number.isFinite(pMax)) rows = rows.filter((v) => v.price <= pMax)

    const yMin = hasMinYear ? Number(minYear) : null
    const yMax = hasMaxYear ? Number(maxYear) : null
    if (yMin !== null && Number.isFinite(yMin)) rows = rows.filter((v) => v.year >= yMin)
    if (yMax !== null && Number.isFinite(yMax)) rows = rows.filter((v) => v.year <= yMax)

    // Apply quick filters
    if (quickFilters.sellerTypes.length > 0) {
      rows = rows.filter((v) => {
        const sellerType = String((v as any)?.seller_type || (v as any)?.categories || '').toLowerCase()
        return quickFilters.sellerTypes.some(type => 
          sellerType.includes(type.toLowerCase()) ||
          (type === 'private' && sellerType.includes('private')) ||
          (type === 'dealer' && (sellerType.includes('dealer') || sellerType.includes('dealership'))) ||
          (type === 'fleet' && sellerType.includes('fleet')) ||
          (type === 'premier' && sellerType.includes('premier'))
        )
      })
    }

    if (quickFilters.newListings) {
      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
      rows = rows.filter((v) => {
        // Assuming vehicles have a created_at field - if not available, we'll use a fallback
        const createdAt = (v as any)?.created_at || (v as any)?.createdAt
        if (!createdAt) return false
        const vehicleDate = new Date(createdAt)
        return vehicleDate >= sevenDaysAgo
      })
    }

    if (quickFilters.dealOfWeek) {
      rows = rows.filter((v) => (v as any)?.deal_of_week === true || (v as any)?.dealOfWeek === true)
    }

    if (quickFilters.featured) {
      rows = rows.filter((v) => (v as any)?.featured === true)
    }

    if (quickFilters.priceUnder !== null) {
      rows = rows.filter((v) => v.price <= quickFilters.priceUnder!)
    }

    if (sort === 'newest') rows.sort((a, b) => b.year - a.year)
    if (sort === 'price_asc') rows.sort((a, b) => a.price - b.price)
    if (sort === 'price_desc') rows.sort((a, b) => b.price - a.price)
    return rows
  }, [vehicles, make, collection, category, bodyStyle, exteriorColor, feature, minPrice, maxPrice, minYear, maxYear, sort, quickFilters])

  const unique = (arr: (string | undefined)[]) => Array.from(new Set(arr.filter(Boolean))) as string[]
  const makes = unique(vehicles.map((v) => v.make))
  const collections = unique(vehicles.map((v) => v.collection))
  const bodyStyles = unique(vehicles.map((v) => v.bodyStyle))
  const colors = unique(vehicles.map((v) => v.exteriorColor))
  const features = unique(vehicles.flatMap((v) => v.features || []))

  // Quick filter helper functions
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

  const clearAllFilters = () => {
    setMake('')
    setCollection('')
    setCategory('')
    setBodyStyle('')
    setExteriorColor('')
    setFeature('')
    setMinPrice('')
    setMaxPrice('')
    setMinYear('')
    setMaxYear('')
    setSort('newest')
    setQuickFilters({
      sellerTypes: [],
      newListings: false,
      dealOfWeek: false,
      featured: false,
      priceUnder: null,
    })
  }

  return (
    <div className="px-6 lg:px-8 py-6">
      <div className="flex items-start gap-6">
        {/* Sidebar Filters (hidden on Marketplace as requested) */}
        <aside className="hidden w-72 bg-white rounded-2xl border border-slate-200/60 p-5 sticky top-6 self-start" style={{ boxShadow: '0 1px 3px rgba(0,0,0,.04)' }}>
          <div className="flex items-center justify-between pb-3 border-b border-slate-200/60">
            <div className="text-xs font-bold text-[#0B1F3A] uppercase tracking-wider">Filters</div>
            <button
              type="button"
              className="text-xs text-[#1EA7FF] hover:text-[#0B1F3A] font-medium transition-colors"
              onClick={clearAllFilters}
            >
              Clear
            </button>
          </div>
          <div className="mt-3 space-y-4">
            <div>
              <div className="text-xs font-semibold text-slate-500 mb-1">Make</div>
              <select value={make} onChange={(e) => setMake(e.target.value)} className="w-full h-9 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 px-2 focus:outline-none focus:ring-2 focus:ring-[#1EA7FF]/30 transition-all">
                <option value="">All Makes</option>
                {makes.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-500 mb-1">Collection</div>
              <select value={collection} onChange={(e) => setCollection(e.target.value)} className="w-full h-9 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 px-2 focus:outline-none focus:ring-2 focus:ring-[#1EA7FF]/30 transition-all">
                <option value="">All Vehicles</option>
                {collections.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-500 mb-1">Category</div>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full h-9 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 px-2 focus:outline-none focus:ring-2 focus:ring-[#1EA7FF]/30 transition-all">
                <option value="">All Categories</option>
                <option value="fleet">Fleet</option>
                <option value="dealer">Dealership</option>
                <option value="premier">Premier</option>
                <option value="private">Private</option>
              </select>
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-500 mb-1">Body Style</div>
              <select value={bodyStyle} onChange={(e) => setBodyStyle(e.target.value)} className="w-full h-9 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 px-2 focus:outline-none focus:ring-2 focus:ring-[#1EA7FF]/30 transition-all">
                <option value="">All Styles</option>
                {bodyStyles.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-500 mb-1">Exterior Color</div>
              <select value={exteriorColor} onChange={(e) => setExteriorColor(e.target.value)} className="w-full h-9 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 px-2 focus:outline-none focus:ring-2 focus:ring-[#1EA7FF]/30 transition-all">
                <option value="">All Colors</option>
                {colors.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-500 mb-1">Features</div>
              <select value={feature} onChange={(e) => setFeature(e.target.value)} className="w-full h-9 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 px-2 focus:outline-none focus:ring-2 focus:ring-[#1EA7FF]/30 transition-all">
                <option value="">All Features</option>
                {features.map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-500 mb-1">Price Range</div>
              <div className="grid grid-cols-2 gap-2">
                <input value={minPrice} onChange={(e) => setMinPrice(e.target.value)} placeholder="Min" className="w-full h-9 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 px-2 focus:outline-none focus:ring-2 focus:ring-[#1EA7FF]/30 transition-all" />
                <input value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} placeholder="Max" className="w-full h-9 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 px-2 focus:outline-none focus:ring-2 focus:ring-[#1EA7FF]/30 transition-all" />
              </div>
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-500 mb-1">Year Range</div>
              <div className="grid grid-cols-2 gap-2">
                <input value={minYear} onChange={(e) => setMinYear(e.target.value)} placeholder="Min" className="w-full h-9 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 px-2 focus:outline-none focus:ring-2 focus:ring-[#1EA7FF]/30 transition-all" />
                <input value={maxYear} onChange={(e) => setMaxYear(e.target.value)} placeholder="Max" className="w-full h-9 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 px-2 focus:outline-none focus:ring-2 focus:ring-[#1EA7FF]/30 transition-all" />
              </div>
            </div>
          </div>
        </aside>

        {/* Results */}
        <section className="flex-1">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm text-slate-500">{loading ? 'Loading…' : error ? 'Failed to load vehicles' : `Showing ${filtered.length} of ${vehicles.length} total vehicles`}</div>
            <div className="w-48">
              <select value={sort} onChange={(e) => setSort(e.target.value as any)} className="w-full h-10 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 px-3 focus:outline-none focus:ring-2 focus:ring-[#1EA7FF]/30 transition-all">
                <option value="newest">Newest</option>
                <option value="price_asc">Price: Low to High</option>
                <option value="price_desc">Price: High to Low</option>
              </select>
            </div>
          </div>

          {/* Quick Filters */}
          <div className="bg-white rounded-2xl border border-slate-200/60 p-5 mb-6" style={{ boxShadow: '0 1px 3px rgba(0,0,0,.04)' }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-[#0B1F3A] uppercase tracking-wider">Quick Filters</h3>
              <button
                type="button"
                onClick={clearAllFilters}
                className="px-3 py-1.5 text-xs font-medium text-[#1EA7FF] hover:text-white hover:bg-[#1EA7FF] border border-[#1EA7FF] rounded-full transition-all duration-200"
              >
                Clear Filters
              </button>
            </div>
            
            <div className="space-y-4">
              {/* Seller Type Filters */}
              <div>
                <div className="text-xs font-semibold text-slate-600 mb-2">Seller Type</div>
                <div className="flex flex-wrap gap-2 overflow-x-auto pb-2">
                  {[
                    { key: 'private', label: 'Private Sellers' },
                    { key: 'dealer', label: 'Dealers' },
                    { key: 'fleet', label: 'Fleet' },
                    { key: 'premier', label: 'Premier' }
                  ].map(({ key, label }) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => toggleSellerType(key)}
                      className={`px-4 py-2 text-sm font-medium rounded-full border transition-all duration-200 whitespace-nowrap ${
                        quickFilters.sellerTypes.includes(key)
                          ? 'bg-[#1EA7FF] text-white border-[#1EA7FF] shadow-lg shadow-[#1EA7FF]/30'
                          : 'bg-white text-slate-700 border-slate-200 hover:border-[#1EA7FF] hover:text-[#1EA7FF]'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Time Based & Promotional Filters */}
              <div>
                <div className="text-xs font-semibold text-slate-600 mb-2">Special Listings</div>
                <div className="flex flex-wrap gap-2 overflow-x-auto pb-2">
                  <button
                    type="button"
                    onClick={() => toggleQuickFilter('newListings')}
                    className={`px-4 py-2 text-sm font-medium rounded-full border transition-all duration-200 whitespace-nowrap ${
                      quickFilters.newListings
                        ? 'bg-[#1EA7FF] text-white border-[#1EA7FF] shadow-lg shadow-[#1EA7FF]/30'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-[#1EA7FF] hover:text-[#1EA7FF]'
                    }`}
                  >
                    New Listings
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleQuickFilter('dealOfWeek')}
                    className={`px-4 py-2 text-sm font-medium rounded-full border transition-all duration-200 whitespace-nowrap ${
                      quickFilters.dealOfWeek
                        ? 'bg-[#1EA7FF] text-white border-[#1EA7FF] shadow-lg shadow-[#1EA7FF]/30'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-[#1EA7FF] hover:text-[#1EA7FF]'
                    }`}
                  >
                    Deals of the Week
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleQuickFilter('featured')}
                    className={`px-4 py-2 text-sm font-medium rounded-full border transition-all duration-200 whitespace-nowrap ${
                      quickFilters.featured
                        ? 'bg-[#1EA7FF] text-white border-[#1EA7FF] shadow-lg shadow-[#1EA7FF]/30'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-[#1EA7FF] hover:text-[#1EA7FF]'
                    }`}
                  >
                    Featured
                  </button>
                </div>
              </div>

              {/* Price Quick Filters */}
              <div>
                <div className="text-xs font-semibold text-slate-600 mb-2">Cars Under</div>
                <div className="flex flex-wrap gap-2 overflow-x-auto pb-2">
                  {[
                    { value: 25000, label: '$25K' },
                    { value: 20000, label: '$20K' },
                    { value: 15000, label: '$15K' },
                    { value: 10000, label: '$10K' }
                  ].map(({ value, label }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => toggleQuickFilter('priceUnder', value)}
                      className={`px-4 py-2 text-sm font-medium rounded-full border transition-all duration-200 whitespace-nowrap ${
                        quickFilters.priceUnder === value
                          ? 'bg-[#1EA7FF] text-white border-[#1EA7FF] shadow-lg shadow-[#1EA7FF]/30'
                          : 'bg-white text-slate-700 border-slate-200 hover:border-[#1EA7FF] hover:text-[#1EA7FF]'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((v) => (
              <VehicleCard key={v.id} vehicle={v} hideFooter onClick={() => setSelected(v)} />
            ))}

            {filtered.length === 0 ? (
              <div className="col-span-full text-center text-sm text-slate-400 py-10">No vehicles found.</div>
            ) : null}
          </div>

          {selected ? (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
              role="dialog"
              aria-modal="true"
              onMouseDown={(e) => {
                if (e.target === e.currentTarget) setSelected(null)
              }}
            >
              <div
                className="absolute inset-0 bg-[#0B1F3A]/60 backdrop-blur-sm"
                onMouseDown={() => {
                  setSelected(null)
                  setSelectedImageIndex(0)
                }}
              />
              <div
                className="relative z-10 w-full max-w-6xl bg-white rounded-2xl shadow-premium overflow-hidden grid grid-cols-1 lg:grid-cols-3 h-[85vh] max-h-[85vh]"
                onMouseDown={(e) => e.stopPropagation()}
              >
                <div className="lg:col-span-2 p-6">
                  <div className="w-full h-80 md:h-[28rem] bg-slate-50 rounded-xl overflow-hidden flex items-center justify-center relative">
                    {selected.images?.length ? (
                      <>
                        <img
                          src={toImageSrc(selected.images[selectedImageIndex] || selected.images[0] || '')}
                          alt={`${selected.year} ${selected.make} ${selected.model}`}
                          className="w-full h-full object-contain bg-slate-50"
                        />
                        {selected.images.length > 1 ? (
                          <>
                            <button
                              type="button"
                              className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/80 hover:bg-white flex items-center justify-center shadow"
                              onClick={() =>
                                setSelectedImageIndex((i) =>
                                  (i - 1 + selected.images.length) % selected.images.length
                                )
                              }
                              aria-label="Previous image"
                            >
                              <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                              </svg>
                            </button>
                            <button
                              type="button"
                              className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/80 hover:bg-white flex items-center justify-center shadow"
                              onClick={() =>
                                setSelectedImageIndex((i) => (i + 1) % selected.images.length)
                              }
                              aria-label="Next image"
                            >
                              <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                            </button>
                            <div className="absolute bottom-3 right-3 bg-black/60 text-white text-xs px-2 py-1 rounded-full">
                              {Math.min(selectedImageIndex, selected.images.length - 1) + 1}/{selected.images.length}
                            </div>
                          </>
                        ) : null}
                      </>
                    ) : (
                      <div className="text-xs text-slate-400">No image</div>
                    )}
                  </div>
                  <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="bg-slate-50 rounded-xl p-4 text-center">
                      <div className="text-xs text-slate-500">Mileage</div>
                      <div className="text-lg font-semibold text-slate-800">{selected.mileage.toLocaleString()} km</div>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-4 text-center">
                      <div className="text-xs text-slate-500">Year</div>
                      <div className="text-lg font-semibold text-slate-800">{selected.year}</div>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-4 text-center">
                      <div className="text-xs text-slate-500">Fuel</div>
                      <div className="text-lg font-semibold text-slate-800">{selected.fuelType || '—'}</div>
                    </div>
                  </div>
                  <div className="mt-5 bg-slate-50 rounded-2xl border border-slate-100 p-5">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-1 h-6 rounded-full bg-navy-900"></div>
                      <div className="text-base font-semibold text-slate-800">Vehicle Specifications</div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <Spec label="Make" value={selected.make} icon="tag" />
                      <Spec label="Model" value={selected.model} icon="tag" />
                      <Spec label="Year" value={selected.year ? String(selected.year) : '—'} icon="calendar" />
                      <Spec
                        label="Odometer"
                        value={`${Number((selected.odometer ?? selected.mileage) || 0).toLocaleString()} ${String(selected.odometerUnit || '').trim().toLowerCase() === 'miles' ? 'mi' : 'km'}`}
                        icon="bolt"
                      />
                      <Spec label="Transmission" value={selected.transmission || '—'} icon="arrows" />
                      <Spec label="Fuel Type" value={selected.fuelType || '—'} icon="drop" />
                      <Spec label="Engine" value={selected.engine || '—'} icon="engine" />
                      <Spec label="Drivetrain" value={selected.drivetrain || '—'} icon="settings" />
                      <Spec label="Exterior Color" value={selected.exteriorColor || '—'} icon="paint" />
                      <Spec label="Interior Color" value={selected.interiorColor || '—'} icon="palette" />
                      <Spec label="Body Style" value={selected.bodyStyle || '—'} icon="building" />
                      <Spec label="VIN" value={selected.vin || '—'} icon="id" />
                    </div>
                  </div>
                </div>
                <div className="p-6 border-t lg:border-t-0 lg:border-l border-slate-100 flex flex-col gap-3 min-h-0 overflow-y-auto">
                  <div className="text-xl font-semibold text-slate-900">{selected.year} {selected.make} {selected.model}</div>
                  <div>
                    <span className="inline-flex items-center rounded-full bg-[#1EA7FF] text-white px-5 py-2 text-lg font-bold">
                      ${selected.price.toLocaleString()}
                    </span>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-col gap-2 mt-2">
                    <button
                      type="button"
                      onClick={() => openCarfaxModal(selected.id)}
                      className="w-full py-3 px-4 rounded-xl border border-[#B22222] text-[#B22222] bg-red-50 hover:bg-red-100 text-sm font-medium transition-colors flex items-center justify-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2a4 4 0 014-4h4M3 7h6m-6 4h6m-6 4h6M17 3l4 4-4 4" />
                      </svg>
                      View CARFAX Report
                    </button>
                    <button
                      type="button"
                      className="w-full py-3 px-4 rounded-xl border border-yellow-400 text-yellow-700 bg-yellow-50 hover:bg-yellow-100 text-sm font-medium transition-colors flex items-center justify-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                      </svg>
                      View Important Disclosure
                    </button>
                    <button
                      type="button"
                      className="w-full py-3 px-4 rounded-xl border border-slate-300 text-slate-700 bg-white hover:bg-slate-50 text-sm font-medium transition-colors flex items-center justify-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                      Ask a Question
                    </button>
                    <div className="flex items-center justify-center gap-2 py-2 text-sm text-slate-600">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                      Call Us (613) 777-2395
                    </div>
                  </div>

                  {/* Trust Badges */}
                  <div className="flex flex-col gap-2 mt-1">
                    {[
                      'CARFAX Report Available',
                      'Safety Inspected',
                      'Financing Available',
                    ].map((badge) => (
                      <div key={badge} className="flex items-center gap-2 text-sm text-green-700">
                        <svg className="w-5 h-5 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                        </svg>
                        {badge}
                      </div>
                    ))}
                  </div>

                  {selected.adDescription && selected.adDescription.trim() !== '' ? (
                    <div className="flex-1 min-h-0 mt-1">
                      <div className="text-sm font-semibold text-slate-800 mb-2">Description</div>
                      <div className="text-sm text-slate-600 bg-slate-50 rounded-xl p-3 overflow-auto whitespace-pre-wrap max-h-32">
                        {selected.adDescription}
                      </div>
                    </div>
                  ) : null}
                  <button
                    type="button"
                    className="edc-btn-ghost mt-auto text-sm"
                    onClick={() => {
                      setSelected(null)
                      setSelectedImageIndex(0)
                    }}
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          ) : null}

        {/* CARFAX Viewer Modal */}
        {carfaxModal.open && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60">
            <div className="w-full max-w-4xl bg-white rounded-2xl shadow-xl flex flex-col" style={{ height: '90vh' }}>
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0">
                <h3 className="text-base font-semibold text-gray-900">CARFAX Report</h3>
                <div className="flex items-center gap-3">
                  {/* File tabs if multiple */}
                  {carfaxModal.files.length > 1 && (
                    <div className="flex gap-1">
                      {carfaxModal.files.map((f, i) => (
                        <button
                          key={f.path}
                          type="button"
                          onClick={() => setCarfaxModal(prev => ({ ...prev, activeIndex: i }))}
                          className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                            carfaxModal.activeIndex === i
                              ? 'bg-[#B22222] text-white border-[#B22222]'
                              : 'text-gray-600 border-gray-300 hover:border-[#B22222]'
                          }`}
                        >
                          File {i + 1}
                        </button>
                      ))}
                    </div>
                  )}
                  {/* Open in new tab */}
                  {carfaxModal.files.length > 0 && (
                    <a
                      href={carfaxModal.files[carfaxModal.activeIndex]?.publicUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                      Open in new tab
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => setCarfaxModal({ open: false, loading: false, files: [], activeIndex: 0 })}
                    className="text-gray-400 hover:text-gray-600 ml-1"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Body */}
              <div className="flex-1 min-h-0">
                {carfaxModal.loading ? (
                  <div className="flex items-center justify-center h-full gap-2 text-gray-400">
                    <svg className="w-6 h-6 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    <span className="text-sm">Loading report…</span>
                  </div>
                ) : carfaxModal.files.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full">
                    <svg className="w-14 h-14 text-gray-200 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <p className="text-sm font-semibold text-gray-500">No CARFAX Report Uploaded</p>
                    <p className="text-xs text-gray-400 mt-1">No report has been uploaded for this vehicle yet.</p>
                  </div>
                ) : (
                  <iframe
                    src={carfaxModal.files[carfaxModal.activeIndex]?.publicUrl}
                    className="w-full h-full rounded-b-2xl"
                    title="CARFAX Report"
                  />
                )}
              </div>
            </div>
          </div>
        )}
        </section>
      </div>
    </div>
  )
}

function Spec({
  label,
  value,
  icon,
}: {
  label: string
  value: string
  icon: 'tag' | 'calendar' | 'bolt' | 'arrows' | 'drop' | 'engine' | 'settings' | 'paint' | 'palette' | 'building' | 'id'
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-9 h-9 rounded-xl bg-white border border-slate-100 flex items-center justify-center text-slate-500">
        {icon === 'tag' ? (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M3 11.5V5a2 2 0 012-2h6.5a2 2 0 011.414.586l8.5 8.5a2 2 0 010 2.828l-6.5 6.5a2 2 0 01-2.828 0l-8.5-8.5A2 2 0 013 11.5z" />
          </svg>
        ) : icon === 'calendar' ? (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        ) : icon === 'bolt' ? (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        ) : icon === 'arrows' ? (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h10M7 17h10M7 7l4 4M17 17l-4-4" />
          </svg>
        ) : icon === 'drop' ? (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3s7 7.5 7 12a7 7 0 11-14 0c0-4.5 7-12 7-12z" />
          </svg>
        ) : icon === 'engine' ? (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6l2 2h2v6h-2l-2 2H9l-2-2H5V9h2l2-2z" />
          </svg>
        ) : icon === 'settings' ? (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        ) : icon === 'paint' ? (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3c4.418 0 8 2.686 8 6 0 2.21-1.79 4-4 4h-1a2 2 0 00-2 2v1a3 3 0 01-3 3H9a6 6 0 01-6-6c0-5.523 4.477-10 9-10z" />
          </svg>
        ) : icon === 'palette' ? (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3C7.03 3 3 6.58 3 11c0 3.87 3.13 7 7 7h1a2 2 0 002-2v-1a2 2 0 012-2h1c3.87 0 7-3.13 7-7 0-4.42-4.03-8-9-8z" />
          </svg>
        ) : icon === 'building' ? (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21h18M5 21V7a2 2 0 012-2h10a2 2 0 012 2v14M9 21V9h6v12" />
          </svg>
        ) : (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 16H6a2 2 0 01-2-2V7a2 2 0 012-2h8l4 4v5a2 2 0 01-2 2h-2" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 16a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        )}
      </div>
      <div className="min-w-0">
        <div className="text-xs text-slate-500">{label}</div>
        <div className="text-sm font-semibold text-slate-800 break-words">{value}</div>
      </div>
    </div>
  )
}
