"use client"

import { useCallback, useEffect, useMemo, useState } from 'react'
import VehicleCard from '@/components/VehicleCard'
import { supabase } from '@/lib/supabaseClient'
import { buildVehiclePhotoUrls, normalizeVehicleImageList } from '@/lib/vehiclePhotoUrls.mjs'

type MarketVehicle = {
  id: string
  make: string
  model: string
  series: string
  year: number
  price: number
  retailPrice?: number | null
  financePrice?: number | null
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
  status?: string
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

  const [carfaxAvailable, setCarfaxAvailable] = useState<boolean | null>(null)
  const [certAvailable, setCertAvailable] = useState<boolean | null>(null)

  const [certModal, setCertModal] = useState<{
    open: boolean
    loading: boolean
    files: { name: string; publicUrl: string }[]
    activeIndex: number
  }>({ open: false, loading: false, files: [], activeIndex: 0 })

  const openCertModal = async (vehicleId: string) => {
    setCertModal({ open: true, loading: true, files: [], activeIndex: 0 })
    try {
      const { data, error } = await supabase
        .from('certificate')
        .select('id, certificate')
        .eq('vehicleId', vehicleId)
        .order('created_at', { ascending: true })

      if (error || !Array.isArray(data) || data.length === 0) {
        setCertModal({ open: true, loading: false, files: [], activeIndex: 0 })
        return
      }

      const files: { name: string; publicUrl: string }[] = data.map((row: any) => {
        try {
          const meta = JSON.parse(row.certificate)
          return { name: String(meta?.name || 'certificate'), publicUrl: String(meta?.url || '') }
        } catch {
          return { name: row.certificate.split('/').pop() ?? 'certificate', publicUrl: row.certificate }
        }
      }).filter((f) => !!f.publicUrl)

      setCertModal({ open: true, loading: false, files, activeIndex: 0 })
    } catch {
      setCertModal({ open: true, loading: false, files: [], activeIndex: 0 })
    }
  }

  const [disclosureModal, setDisclosureModal] = useState<'premier' | 'private' | 'fleet' | 'dealership' | null>(null)
  const [importantDisclosureText, setImportantDisclosureText] = useState<string | null>(null)
  const [importantDisclosureLoading, setImportantDisclosureLoading] = useState(false)

  const [bucketImageCache] = useState(() => new Map<string, string[]>())

  const loadBucketImages = useCallback(async (vehicleId: string): Promise<string[]> => {
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

      const urls = listError
        ? []
        : buildVehiclePhotoUrls(id, data, (path) => {
            const pub = supabase.storage.from('vehicle-photos').getPublicUrl(path)
            return String(pub?.data?.publicUrl || '').trim()
          })

      bucketImageCache.set(id, urls)
      return urls
    } catch {
      bucketImageCache.set(id, [])
      return []
    }
  }, [bucketImageCache])

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

  const [tab, setTab] = useState('All')

  // Quick Filter states
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [quickFilters, setQuickFilters] = useState({
    sellerTypes: [] as string[],
    newListings: false,
    dealOfWeek: false,
    featured: false,
    priceUnder: null as number | null,
  })

  const openCarfaxModal = async (vehicleId: string) => {
    setCarfaxModal({ open: true, loading: true, files: [], activeIndex: 0 })
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

  useEffect(() => {
    if (!selected) {
      setCarfaxAvailable(null)
      return
    }
    supabase.storage
      .from('Carfax')
      .list(selected.id, { limit: 1 })
      .then(({ data }) => {
        const hasFiles = Array.isArray(data) && data.some((f) => !!f?.name && !String(f.name).endsWith('/'))
        setCarfaxAvailable(hasFiles)
      })
      .catch(() => setCarfaxAvailable(false))
  }, [selected])

  useEffect(() => {
    if (!selected) {
      setCertAvailable(null)
      return
    }
    const checkCert = async () => {
      try {
        const { count } = await supabase
          .from('certificate')
          .select('id', { count: 'exact', head: true })
          .eq('vehicleId', selected.id)
        setCertAvailable((count ?? 0) > 0)
      } catch {
        setCertAvailable(false)
      }
    }
    checkCert()
  }, [selected])

  useEffect(() => {
    const load = async () => {
      if (!disclosureModal || !selected?.id) {
        setImportantDisclosureText(null)
        setImportantDisclosureLoading(false)
        return
      }
      setImportantDisclosureLoading(true)
      try {
        const vehicleId = String(selected.id)
        const { data, error } = await supabase
          .from('ImportantDisclosures')
          .select('disclosures')
          .eq('vehicleId', vehicleId)
          .maybeSingle()

        if (!error && data && typeof (data as any).disclosures === 'string' && (data as any).disclosures.trim() !== '') {
          setImportantDisclosureText(String((data as any).disclosures))
        } else {
          setImportantDisclosureText(null)
        }
      } catch {
        setImportantDisclosureText(null)
      } finally {
        setImportantDisclosureLoading(false)
      }
    }

    void load()
  }, [disclosureModal, selected?.id])

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
        const mapped: MarketVehicle[] =
          (data || []).map((r: any) => {
            const id = String(r.id)
            const imgs = normalizeVehicleImageList(r.images ?? r.image_urls ?? r.image)
            const features = normalizeFeatures(r.features)
            return {
              id,
              make: r.make || '',
              model: r.model || '',
              series: r.series || '',
              year: Number(r.year) || 0,
              price: Number(r.price) || 0,
              retailPrice: r.retail_price === null || r.retail_price === undefined ? null : Number(r.retail_price || 0),
              financePrice: r.finance_price === null || r.finance_price === undefined ? null : Number(r.finance_price || 0),
              mileage: Number(r.mileage ?? r.odometer ?? 0) || 0,
              fuelType: r.fuelType || r.fuel_type || '',
              transmission: r.transmission || '',
              images: imgs,
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
              status: r.status || '',
            }
          })
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
    if (c) rows = rows.filter((v) => {
      const col = String(v.collection || '').trim().toLowerCase()
      const cat = String(v.categories || '').trim().toLowerCase()
      const cl = c.trim().toLowerCase()
      return col.includes(cl) || cat.includes(cl) || cl.includes(col.split(' ')[0])
    })
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

  const getListingType = (v: MarketVehicle): string => {
    // Check categories first (more specific), then collection as fallback
    const cat = String(v.categories || '').toLowerCase()
    const col = String(v.collection || '').toLowerCase()
    const raw = cat || col

    if (raw.includes('private')) return 'Private Seller'
    if (raw.includes('premier')) return 'EDC Premier'
    if (raw.includes('dealer')) return 'Dealer Select'
    if (raw.includes('fleet')) return 'Fleet Select'
    // If only collection is set and it has no keyword, fall back to checking it explicitly
    if (!cat && col) {
      if (col.includes('private')) return 'Private Seller'
      if (col.includes('premier')) return 'EDC Premier'
      if (col.includes('dealer')) return 'Dealer Select'
      if (col.includes('fleet')) return 'Fleet Select'
    }
    return 'EDC Premier'
  }

  const LISTING_TABS = ['All', 'EDC Premier', 'Dealer Select', 'Fleet Select', 'Private Seller']
  const DOT_COLORS: Record<string, string> = {
    'EDC Premier': 'bg-[#1EA7FF]',
    'Dealer Select': 'bg-purple-500',
    'Fleet Select': 'bg-slate-400',
    'Private Seller': 'bg-amber-400',
  }
  const tabCounts = LISTING_TABS.reduce<Record<string, number>>((acc, t) => {
    acc[t] = t === 'All' ? filtered.length : filtered.filter((v) => getListingType(v) === t).length
    return acc
  }, {})
  const tabFiltered = tab === 'All' ? filtered : filtered.filter((v) => getListingType(v) === tab)
  const photoListings = tab === 'Fleet Select' ? [] : tabFiltered.filter((v) => getListingType(v) !== 'Fleet Select')
  const fleetListings = tab === 'All'
    ? tabFiltered.filter((v) => getListingType(v) === 'Fleet Select')
    : tab === 'Fleet Select'
      ? tabFiltered
      : []
  const visiblePhotoListings = photoListings
  const categories = unique(vehicles.map((v) => v.categories))

  useEffect(() => {
    const targets = visiblePhotoListings.slice(0, 24).filter((vehicle) =>
      (!vehicle.images || vehicle.images.length === 0) &&
      !bucketImageCache.has(vehicle.id)
    )
    if (targets.length === 0) return

    let cancelled = false
    void Promise.all(targets.map(async (vehicle) => ({ id: vehicle.id, images: await loadBucketImages(vehicle.id) })))
      .then((loaded) => {
        if (cancelled) return
        const imagesById = new Map(loaded.map((entry) => [entry.id, entry.images]))
        setVehicles((current) => current.map((vehicle) => {
          const images = imagesById.get(vehicle.id)
          return images ? { ...vehicle, images } : vehicle
        }))
        setSelected((current) => {
          if (!current) return current
          const images = imagesById.get(current.id)
          return images ? { ...current, images } : current
        })
      })

    return () => {
      cancelled = true
    }
  }, [bucketImageCache, loadBucketImages, visiblePhotoListings])

  const activeFilterCount = [
    make,
    collection,
    category,
    bodyStyle,
    exteriorColor,
    feature,
    minPrice,
    maxPrice,
    minYear,
    maxYear,
  ].filter((value) => String(value || '').trim()).length + quickFilters.sellerTypes.length +
    (quickFilters.newListings ? 1 : 0) +
    (quickFilters.dealOfWeek ? 1 : 0) +
    (quickFilters.featured ? 1 : 0) +
    (quickFilters.priceUnder !== null ? 1 : 0)

  return (
    <div className="min-h-screen bg-gray-50">
      <section className="mx-auto max-w-7xl px-4 pb-5 pt-8 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Marketplace</h1>
            <p className="mt-1 text-sm font-medium text-[#118df0]">
              {loading
                ? 'Loading vehicles...'
                : `${tabFiltered.length} of ${vehicles.length} listings published to AutoTrader, Kijiji and Facebook`}
            </p>
          </div>
          <button
            type="button"
            className="inline-flex h-10 items-center justify-center rounded-full bg-gray-900 px-5 text-sm font-semibold text-white transition-colors hover:bg-[#118df0]"
          >
            Sync now
          </button>
        </div>

        <div className="mt-5 inline-flex max-w-full flex-wrap gap-1 rounded-xl border border-gray-200 bg-white p-1 shadow-sm">
          {LISTING_TABS.map((t) => {
            const active = tab === t
            return (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`inline-flex min-h-9 items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
                  active
                    ? 'bg-gray-900 text-white'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                {t !== 'All' && (
                  <span className={`h-1.5 w-1.5 rounded-full ${DOT_COLORS[t] ?? 'bg-slate-400'}`} />
                )}
                {t}
                <span className={`text-[11px] ${active ? 'text-white/70' : 'text-gray-400'}`}>
                  {tabCounts[t] ?? 0}
                </span>
              </button>
            )
          })}
        </div>
      </section>

      {/* Grid area */}
      <div className="mx-auto max-w-7xl px-4 pb-8 sm:px-6 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <button
              type="button"
              onClick={() => setSidebarCollapsed((value) => !value)}
              className="mb-3 flex h-10 w-full items-center justify-between rounded-xl border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-700 shadow-sm lg:hidden"
            >
              Filters
              <span className="rounded-full bg-[#118df0] px-2 py-0.5 text-xs text-white">{activeFilterCount}</span>
            </button>
            <div className={`${sidebarCollapsed ? 'hidden lg:block' : 'block'} rounded-xl border border-gray-200 bg-white p-5 shadow-sm`}>
              <div className="mb-5 flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-bold text-gray-900">Refine listings</div>
                  <div className="text-xs text-gray-500">{activeFilterCount} active filters</div>
                </div>
                <button type="button" onClick={clearAllFilters} className="text-xs font-semibold text-[#118df0] hover:text-gray-900">
                  Reset
                </button>
              </div>

              <div className="space-y-5">
                <FilterSelect label="Make" value={make} onChange={setMake} options={makes} />
                <FilterSelect label="Collection" value={collection} onChange={setCollection} options={collections} />
                <FilterSelect label="Category" value={category} onChange={setCategory} options={categories} />
                <FilterSelect label="Body style" value={bodyStyle} onChange={setBodyStyle} options={bodyStyles} />
                <FilterSelect label="Exterior color" value={exteriorColor} onChange={setExteriorColor} options={colors} />
                <FilterSelect label="Feature" value={feature} onChange={setFeature} options={features} />

                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">Listing type</p>
                  <div className="space-y-1.5">
                    {[
                      { key: 'premier', label: 'EDC Premier', color: '#118df0' },
                      { key: 'dealer', label: 'Dealer Select', color: '#8b5cf6' },
                      { key: 'fleet', label: 'Fleet Select', color: '#64748b' },
                      { key: 'private', label: 'Private Seller', color: '#f59e0b' },
                    ].map(({ key, label, color }) => (
                      <label key={key} className="flex cursor-pointer items-center gap-2 text-sm text-gray-700">
                        <input
                          type="checkbox"
                          checked={quickFilters.sellerTypes.includes(key)}
                          onChange={() => toggleSellerType(key)}
                          className="accent-[#118df0]"
                        />
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
                        {label}
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">Quick filters</p>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { key: 'newListings' as const, label: 'New' },
                      { key: 'dealOfWeek' as const, label: 'Deal' },
                      { key: 'featured' as const, label: 'Featured' },
                    ].map((item) => (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => toggleQuickFilter(item.key)}
                        className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                          quickFilters[item.key]
                            ? 'border-[#118df0] bg-[#118df0] text-white'
                            : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                    {[25000, 50000].map((amount) => (
                      <button
                        key={amount}
                        type="button"
                        onClick={() => toggleQuickFilter('priceUnder', amount)}
                        className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                          quickFilters.priceUnder === amount
                            ? 'border-[#118df0] bg-[#118df0] text-white'
                            : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        Under ${amount / 1000}k
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">Price range</p>
                  <div className="grid grid-cols-2 gap-2">
                    <input value={minPrice} onChange={(e) => setMinPrice(e.target.value.replace(/[^0-9]/g, ''))} placeholder="Min" className="h-9 rounded-lg border border-gray-200 px-3 text-sm outline-none focus:border-[#118df0] focus:ring-2 focus:ring-[#118df0]/20" />
                    <input value={maxPrice} onChange={(e) => setMaxPrice(e.target.value.replace(/[^0-9]/g, ''))} placeholder="Max" className="h-9 rounded-lg border border-gray-200 px-3 text-sm outline-none focus:border-[#118df0] focus:ring-2 focus:ring-[#118df0]/20" />
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">Year range</p>
                  <div className="grid grid-cols-2 gap-2">
                    <input value={minYear} onChange={(e) => setMinYear(e.target.value.replace(/[^0-9]/g, ''))} placeholder="Min" className="h-9 rounded-lg border border-gray-200 px-3 text-sm outline-none focus:border-[#118df0] focus:ring-2 focus:ring-[#118df0]/20" />
                    <input value={maxYear} onChange={(e) => setMaxYear(e.target.value.replace(/[^0-9]/g, ''))} placeholder="Max" className="h-9 rounded-lg border border-gray-200 px-3 text-sm outline-none focus:border-[#118df0] focus:ring-2 focus:ring-[#118df0]/20" />
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">Sort by</p>
                  <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} className="h-9 w-full rounded-lg border border-gray-200 px-3 text-sm outline-none focus:border-[#118df0] focus:ring-2 focus:ring-[#118df0]/20">
                    <option value="newest">Newest</option>
                    <option value="price_asc">Price: low to high</option>
                    <option value="price_desc">Price: high to low</option>
                  </select>
                </div>
              </div>
            </div>
          </aside>

          <div className="min-w-0">
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-gray-500">
                Showing <span className="font-semibold text-gray-900">{tabFiltered.length}</span> listings
              </div>
            </div>
        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">{error}</div>
        ) : loading ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-slate-200 bg-white overflow-hidden animate-pulse">
                <div className="bg-slate-200" style={{ aspectRatio: '16/10' }} />
                <div className="p-4 space-y-3">
                  <div className="flex justify-between">
                    <div className="h-4 w-36 rounded bg-slate-200" />
                    <div className="h-4 w-16 rounded bg-slate-200" />
                  </div>
                  <div className="h-3 w-48 rounded bg-slate-100" />
                  <div className="flex gap-1.5">
                    <div className="h-5 w-16 rounded-full bg-slate-100" />
                    <div className="h-5 w-12 rounded-full bg-slate-100" />
                    <div className="h-5 w-16 rounded-full bg-slate-100" />
                  </div>
                  <div className="h-9 w-full rounded-full bg-slate-100" />
                </div>
              </div>
            ))}
          </div>
        ) : tabFiltered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <svg className="h-10 w-10 mb-3 opacity-40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm font-medium">No listings found</p>
          </div>
        ) : (
          <>
          {visiblePhotoListings.length > 0 ? (
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {visiblePhotoListings.map((v) => (
                <VehicleCard
                  key={v.id}
                  vehicle={v}
                  onClick={() => { setSelected(v); setSelectedImageIndex(0) }}
                />
              ))}
            </section>
          ) : null}

          {fleetListings.length > 0 ? (
            <section className={visiblePhotoListings.length > 0 ? 'mt-6' : ''}>
              <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-base font-bold text-slate-900">Fleet Select</h2>
                  <p className="text-xs text-slate-500">{fleetListings.length} bulk-imported listings shown in compact view</p>
                </div>
                {tab === 'All' ? (
                  <button
                    type="button"
                    onClick={() => setTab('Fleet Select')}
                    className="h-8 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    View fleet only
                  </button>
                ) : null}
              </div>
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="max-h-[520px] overflow-y-auto">
                  <table className="min-w-full text-sm">
                    <thead className="sticky top-0 z-10 bg-slate-50 text-left text-[11px] font-bold uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-4 py-3">Vehicle</th>
                        <th className="px-4 py-3">Odometer</th>
                        <th className="px-4 py-3">Price</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {fleetListings.map((v) => (
                        <tr key={v.id} className="hover:bg-slate-50">
                          <td className="px-4 py-3">
                            <div className="font-semibold text-slate-900">{v.year} {v.make} {v.model}{v.series ? ` ${v.series}` : ''}</div>
                            <div className="mt-0.5 text-xs text-slate-500">{v.vin || v.collection || 'Fleet Select'}</div>
                          </td>
                          <td className="px-4 py-3 text-slate-600">{Number(v.odometer ?? v.mileage ?? 0).toLocaleString()} km</td>
                          <td className="px-4 py-3 font-semibold text-slate-900">${Number(v.price || 0).toLocaleString()}</td>
                          <td className="px-4 py-3">
                            <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                              {v.status || 'Listed'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              type="button"
                              onClick={() => { setSelected(v); setSelectedImageIndex(0) }}
                              className="inline-flex h-8 items-center justify-center rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                            >
                              View listing
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          ) : null}

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
                className="relative z-10 w-full max-w-7xl bg-white rounded-2xl shadow-premium overflow-hidden flex flex-col lg:flex-row max-h-[95vh]"
                onMouseDown={(e) => e.stopPropagation()}
              >
                {/* LEFT — image + thumbnails + specs */}
                <div className="flex-1 min-w-0 overflow-y-auto p-6 flex flex-col gap-4">
                  {/* Main image */}
                  <div className="w-full h-80 md:h-[32rem] bg-slate-50 rounded-2xl overflow-hidden flex items-center justify-center relative">
                    {selected.images?.length ? (
                      <>
                        <img
                          src={toImageSrc(selected.images[selectedImageIndex] || selected.images[0] || '')}
                          alt={`${selected.year} ${selected.make} ${selected.model}`}
                          className="w-full h-full object-cover"
                        />
                        {selected.images.length > 1 && (
                          <>
                            <button
                              type="button"
                              className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/80 hover:bg-white flex items-center justify-center shadow"
                              onClick={() => setSelectedImageIndex((i) => (i - 1 + selected.images.length) % selected.images.length)}
                              aria-label="Previous image"
                            >
                              <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                            </button>
                            <button
                              type="button"
                              className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/80 hover:bg-white flex items-center justify-center shadow"
                              onClick={() => setSelectedImageIndex((i) => (i + 1) % selected.images.length)}
                              aria-label="Next image"
                            >
                              <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                            </button>
                            <div className="absolute bottom-3 right-3 bg-black/60 text-white text-xs px-2 py-1 rounded-full">
                              {Math.min(selectedImageIndex, selected.images.length - 1) + 1}/{selected.images.length}
                            </div>
                          </>
                        )}
                      </>
                    ) : (
                      <div className="text-sm text-slate-400">No image</div>
                    )}
                  </div>

                  {/* Thumbnail strip */}
                  {selected.images?.length > 1 && (
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {selected.images.map((img, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setSelectedImageIndex(i)}
                          className={`flex-shrink-0 w-16 h-12 rounded-lg overflow-hidden border-2 transition-colors ${i === selectedImageIndex ? 'border-[#1EA7FF]' : 'border-transparent hover:border-slate-300'}`}
                        >
                          <img src={toImageSrc(img)} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Specs */}
                  <div className="bg-slate-50 rounded-2xl border border-slate-100 p-5">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-1 h-5 rounded-full bg-[#1EA7FF]"></div>
                      <div className="text-sm font-semibold text-slate-800">Vehicle Specifications</div>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                      <Spec label="Make" value={selected.make || '—'} icon="tag" />
                      <Spec label="Model" value={selected.model || '—'} icon="tag" />
                      <Spec label="Year" value={selected.year ? String(selected.year) : '—'} icon="calendar" />
                      <Spec label="Odometer" value={`${Number((selected.odometer ?? selected.mileage) || 0).toLocaleString()} ${String(selected.odometerUnit || '').trim().toLowerCase() === 'miles' ? 'mi' : 'km'}`} icon="bolt" />
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

                {/* RIGHT — title, price, actions, badges */}
                <div className="w-full lg:w-80 flex-shrink-0 p-6 border-t lg:border-t-0 lg:border-l border-slate-100 flex flex-col gap-3 overflow-y-auto">
                  <div className="text-xl font-bold text-slate-900">{selected.year} {selected.make} {selected.model}</div>
                  <span className="inline-flex items-center rounded-full bg-[#1EA7FF] text-white px-5 py-2 text-lg font-bold self-start">
                    ${selected.price.toLocaleString()}
                  </span>

                  {selected.status && (() => {
                    const s = selected.status.toLowerCase()
                    const isAvailable = s === 'available' || s === 'active' || s === 'for sale'
                    const isSold = s === 'sold'
                    const isOnHold = s === 'on hold' || s === 'on_hold' || s === 'hold'
                    return (
                      <span className={`inline-flex items-center gap-1.5 self-start px-3 py-1 rounded-full text-sm font-semibold ${
                        isSold ? 'bg-red-100 text-red-700' :
                        isOnHold ? 'bg-yellow-100 text-yellow-700' :
                        isAvailable ? 'bg-green-100 text-green-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        <span className={`w-2 h-2 rounded-full ${
                          isSold ? 'bg-red-500' :
                          isOnHold ? 'bg-yellow-500' :
                          isAvailable ? 'bg-green-500' :
                          'bg-gray-500'
                        }`} />
                        {selected.status.charAt(0).toUpperCase() + selected.status.slice(1)}
                      </span>
                    )
                  })()}

                  <div className="flex flex-col gap-2 mt-1">
                    {carfaxAvailable && (
                      <button
                        type="button"
                        onClick={() => openCarfaxModal(selected.id)}
                        className="w-full py-3 px-4 rounded-xl border border-[#B22222] text-[#B22222] bg-red-50 hover:bg-red-100 text-sm font-medium transition-colors flex items-center justify-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2a4 4 0 014-4h4M3 7h6m-6 4h6m-6 4h6M17 3l4 4-4 4" /></svg>
                        View CARFAX Report
                      </button>
                    )}
                    {certAvailable && (
                      <button
                        type="button"
                        onClick={() => openCertModal(selected.id)}
                        className="w-full py-3 px-4 rounded-xl border border-blue-300 text-blue-700 bg-blue-50 hover:bg-blue-100 text-sm font-medium transition-colors flex items-center justify-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" /></svg>
                        Safety Certificate
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        const raw = String(selected?.categories || '').toLowerCase()
                        const type = raw.includes('private')
                          ? 'private'
                          : raw.includes('fleet')
                          ? 'fleet'
                          : raw.includes('dealer')
                          ? 'dealership'
                          : 'premier'
                        setDisclosureModal(type)
                      }}
                      className="w-full py-3 px-4 rounded-xl border border-yellow-400 text-yellow-700 bg-yellow-50 hover:bg-yellow-100 text-sm font-medium transition-colors flex items-center justify-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></svg>
                      View Important Disclosure
                    </button>
                    <button
                      type="button"
                      className="w-full py-3 px-4 rounded-xl border border-slate-300 text-slate-700 bg-white hover:bg-slate-50 text-sm font-medium transition-colors flex items-center justify-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                      Ask a Question
                    </button>
                    <div className="flex items-center justify-center gap-2 py-1 text-sm text-slate-600">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                      Call Us (613) 777-2395
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex flex-col gap-2">
                    {carfaxAvailable && (
                      <div className="flex items-center gap-2 text-sm text-green-700">
                        <svg className="w-5 h-5 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                        CARFAX Report Available
                      </div>
                    )}
                    {['Safety Inspected', 'Financing Available'].map((badge) => (
                      <div key={badge} className="flex items-center gap-2 text-sm text-green-700">
                        <svg className="w-5 h-5 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                        {badge}
                      </div>
                    ))}
                  </div>

                  {selected.adDescription && selected.adDescription.trim() !== '' && (
                    <div className="mt-1">
                      <div className="text-sm font-semibold text-slate-800 mb-1">Description</div>
                      <div className="text-sm text-slate-600 bg-slate-50 rounded-xl p-3 whitespace-pre-wrap max-h-28 overflow-auto">{selected.adDescription}</div>
                    </div>
                  )}

                  <button
                    type="button"
                    className="mt-auto w-full py-2.5 px-4 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm font-medium transition-colors"
                    onClick={() => { setSelected(null); setSelectedImageIndex(0) }}
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          ) : null}

        {/* Disclosure Modal */}
        {disclosureModal && (() => {
          const cfg = {
            premier:    { label: 'EDC Premier',     badge: 'bg-purple-100 text-purple-700', header: 'border-purple-200 bg-purple-50', title: 'text-purple-800', sub: 'text-purple-700', hover: 'hover:bg-purple-100', icon: 'text-purple-600', btn: 'bg-purple-500 hover:bg-purple-600' },
            private:    { label: 'EDC Private',     badge: 'bg-blue-100 text-blue-700',     header: 'border-blue-200 bg-blue-50',     title: 'text-blue-800',   sub: 'text-blue-700',   hover: 'hover:bg-blue-100',   icon: 'text-blue-600',   btn: 'bg-blue-500 hover:bg-blue-600' },
            fleet:      { label: 'EDC Fleet Select', badge: 'bg-amber-100 text-amber-700', header: 'border-amber-200 bg-amber-50',   title: 'text-amber-800',  sub: 'text-amber-700',  hover: 'hover:bg-amber-100',  icon: 'text-amber-600',  btn: 'bg-amber-500 hover:bg-amber-600' },
            dealership: { label: 'EDC Dealership',  badge: 'bg-gray-100 text-gray-700',     header: 'border-gray-200 bg-gray-50',     title: 'text-gray-800',   sub: 'text-gray-600',   hover: 'hover:bg-gray-100',   icon: 'text-gray-600',   btn: 'bg-gray-700 hover:bg-gray-800' },
          }[disclosureModal]
          return (
            <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 overflow-y-auto">
              <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setDisclosureModal(null)} />
              <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-8 flex flex-col max-h-[90vh]">
                <div className={`flex items-center justify-between px-6 py-4 border-b ${cfg.header} rounded-t-2xl flex-shrink-0`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 ${cfg.badge} rounded-full flex items-center justify-center`}>
                      <svg className={`w-5 h-5 ${cfg.icon}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                    </div>
                    <div>
                      <h2 className={`text-lg font-bold ${cfg.title}`}>IMPORTANT DISCLOSURE</h2>
                      <p className={`text-sm ${cfg.sub}`}>Please Read Carefully</p>
                    </div>
                  </div>
                  <button onClick={() => setDisclosureModal(null)} className={`p-2 ${cfg.hover} rounded-xl transition-colors`}>
                    <svg className={`w-6 h-6 ${cfg.icon}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <div className="overflow-y-auto flex-1 p-6">
                  {importantDisclosureLoading ? (
                    <div className="text-sm text-gray-500">Loading disclosure…</div>
                  ) : importantDisclosureText ? (
                    <div className="space-y-3 text-sm text-gray-700 whitespace-pre-line">
                      {importantDisclosureText}
                    </div>
                  ) : (
                    <>
                  <p className="text-gray-700 mb-6">
                    This vehicle is offered by EasyDrive Canada (EDC) as an{' '}
                    <strong className={cfg.title}>{cfg.label}</strong> vehicle.
                  </p>
                  <div className="space-y-5 text-sm">
                    {disclosureModal === 'premier' && <>
                      <div><h4 className="font-semibold text-gray-900 mb-2 flex items-center gap-2"><span className={`w-6 h-6 ${cfg.badge} rounded-full flex items-center justify-center text-xs font-bold`}>1</span>Vehicle Status – EDC Premier</h4><ul className="list-disc list-inside space-y-1 text-gray-600 ml-8"><li>This vehicle is owned and stocked by EasyDrive Canada.</li><li>Viewing and test drives are available by appointment.</li></ul></div>
                      <div><h4 className="font-semibold text-gray-900 mb-2 flex items-center gap-2"><span className={`w-6 h-6 ${cfg.badge} rounded-full flex items-center justify-center text-xs font-bold`}>2</span>Safety & Reconditioning</h4><ul className="list-disc list-inside space-y-1 text-gray-600 ml-8"><li>This vehicle will be sold with a valid Ontario Safety Standards Certificate prior to delivery.</li><li>Any required safety or reconditioning work has been completed or will be completed before delivery.</li></ul></div>
                      <div><h4 className="font-semibold text-gray-900 mb-2 flex items-center gap-2"><span className={`w-6 h-6 ${cfg.badge} rounded-full flex items-center justify-center text-xs font-bold`}>3</span>Fees & Licensing (Mandatory)</h4><ul className="list-disc list-inside space-y-1 text-gray-600 ml-8"><li>All transactions are subject to the mandatory OMVIC fee of <strong>$22 + HST</strong> per transaction, shown separately on the Bill of Sale.</li><li>A licensing fee of <strong>$59</strong> applies to every transaction and will be shown separately on the Bill of Sale.</li></ul></div>
                      <div><h4 className="font-semibold text-gray-900 mb-2 flex items-center gap-2"><span className={`w-6 h-6 ${cfg.badge} rounded-full flex items-center justify-center text-xs font-bold`}>4</span>CARFAX Disclosure</h4><ul className="list-disc list-inside space-y-1 text-gray-600 ml-8"><li>A CARFAX report will be provided to the client prior to completion of the sale.</li></ul></div>
                    </>}
                    {disclosureModal === 'private' && <>
                      <div><h4 className="font-semibold text-gray-900 mb-2 flex items-center gap-2"><span className={`w-6 h-6 ${cfg.badge} rounded-full flex items-center justify-center text-xs font-bold`}>1</span>Private Sale Disclosure</h4><ul className="list-disc list-inside space-y-1 text-gray-600 ml-8"><li>This vehicle is listed as a private sale facilitated through EasyDrive Canada.</li><li>The vehicle is sold as-is unless otherwise stated in writing.</li></ul></div>
                      <div><h4 className="font-semibold text-gray-900 mb-2 flex items-center gap-2"><span className={`w-6 h-6 ${cfg.badge} rounded-full flex items-center justify-center text-xs font-bold`}>2</span>Inspection & Test Drive</h4><ul className="list-disc list-inside space-y-1 text-gray-600 ml-8"><li>Viewing and test drives may be available subject to seller availability.</li><li>Buyers are encouraged to arrange an independent pre-purchase inspection.</li></ul></div>
                      <div><h4 className="font-semibold text-gray-900 mb-2 flex items-center gap-2"><span className={`w-6 h-6 ${cfg.badge} rounded-full flex items-center justify-center text-xs font-bold`}>3</span>Safety & Reconditioning</h4><ul className="list-disc list-inside space-y-1 text-gray-600 ml-8"><li>Safety certification is not included in the listed price unless explicitly noted.</li><li>Safety may be added through EasyDrive Canada starting at <strong>$999</strong>, which includes the Ontario Safety Standards Certificate.</li><li>Where permitted by law, the vehicle may also be purchased without safety.</li></ul></div>
                      <div><h4 className="font-semibold text-gray-900 mb-2 flex items-center gap-2"><span className={`w-6 h-6 ${cfg.badge} rounded-full flex items-center justify-center text-xs font-bold`}>4</span>Fees & Licensing (Mandatory)</h4><ul className="list-disc list-inside space-y-1 text-gray-600 ml-8"><li>All transactions are subject to the mandatory OMVIC fee of <strong>$22 + HST</strong> per transaction, shown separately on the Bill of Sale.</li><li>A licensing fee of <strong>$59</strong> applies to every transaction and will be shown separately on the Bill of Sale.</li></ul></div>
                      <div><h4 className="font-semibold text-gray-900 mb-2 flex items-center gap-2"><span className={`w-6 h-6 ${cfg.badge} rounded-full flex items-center justify-center text-xs font-bold`}>5</span>CARFAX Disclosure</h4><ul className="list-disc list-inside space-y-1 text-gray-600 ml-8"><li>A CARFAX report will be provided to the client prior to completion of the sale.</li></ul></div>
                    </>}
                    {disclosureModal === 'fleet' && <>
                      <div><h4 className="font-semibold text-gray-900 mb-2 flex items-center gap-2"><span className={`w-6 h-6 ${cfg.badge} rounded-full flex items-center justify-center text-xs font-bold`}>1</span>Fleet & Consignment Disclosure</h4><ul className="list-disc list-inside space-y-1 text-gray-600 ml-8"><li>This vehicle was previously registered as a fleet vehicle.</li><li>This vehicle is being sold by EasyDrive Canada as a consignment sale on behalf of the vehicle owner.</li></ul></div>
                      <div><h4 className="font-semibold text-gray-900 mb-2 flex items-center gap-2"><span className={`w-6 h-6 ${cfg.badge} rounded-full flex items-center justify-center text-xs font-bold`}>2</span>Purchase Process - EDC Fleet Select</h4><ul className="list-disc list-inside space-y-1 text-gray-600 ml-8"><li>No test drives are available.</li><li>No appointments or viewings are available.</li><li>This vehicle is offered under a streamlined, wholesale-style purchase option, which is reflected in the pricing.</li></ul></div>
                      <div><h4 className="font-semibold text-gray-900 mb-2 flex items-center gap-2"><span className={`w-6 h-6 ${cfg.badge} rounded-full flex items-center justify-center text-xs font-bold`}>3</span>Safety & Reconditioning</h4><ul className="list-disc list-inside space-y-1 text-gray-600 ml-8"><li>Safety and reconditioning are not included in the listed price.</li><li>Safety and reconditioning may be added through EasyDrive Canada starting at <strong>$999</strong>, which includes the Ontario Safety Standards Certificate.</li><li>If safety is purchased, the vehicle will be delivered with a valid Ontario Safety Standards Certificate.</li><li>Where permitted by law, the vehicle may also be purchased without safety.</li></ul></div>
                      <div><h4 className="font-semibold text-gray-900 mb-2 flex items-center gap-2"><span className={`w-6 h-6 ${cfg.badge} rounded-full flex items-center justify-center text-xs font-bold`}>4</span>Fees & Licensing (Mandatory)</h4><ul className="list-disc list-inside space-y-1 text-gray-600 ml-8"><li>All transactions are subject to the mandatory OMVIC fee of <strong>$22 + HST</strong> per transaction, shown separately on the Bill of Sale.</li><li>Licensing fee of <strong>$59</strong> applies to every transaction and will be shown separately on the Bill of Sale.</li></ul></div>
                      <div><h4 className="font-semibold text-gray-900 mb-2 flex items-center gap-2"><span className={`w-6 h-6 ${cfg.badge} rounded-full flex items-center justify-center text-xs font-bold`}>5</span>CARFAX Disclosure</h4><ul className="list-disc list-inside space-y-1 text-gray-600 ml-8"><li>A CARFAX report will be provided to the client prior to completion of the sale.</li></ul></div>
                      <div><h4 className="font-semibold text-gray-900 mb-2 flex items-center gap-2"><span className={`w-6 h-6 ${cfg.badge} rounded-full flex items-center justify-center text-xs font-bold`}>6</span>No Other Promises</h4><ul className="list-disc list-inside space-y-1 text-gray-600 ml-8"><li>No other promises, representations, or guarantees have been made, written or verbal, other than what is disclosed above and on the Bill of Sale.</li></ul></div>
                    </>}
                    {disclosureModal === 'dealership' && <>
                      <div><h4 className="font-semibold text-gray-900 mb-2 flex items-center gap-2"><span className={`w-6 h-6 ${cfg.badge} rounded-full flex items-center justify-center text-xs font-bold`}>1</span>Dealership Disclosure</h4><ul className="list-disc list-inside space-y-1 text-gray-600 ml-8"><li>This vehicle is listed through an authorized dealership partner of EasyDrive Canada.</li><li>All representations about this vehicle are made by the dealership.</li></ul></div>
                      <div><h4 className="font-semibold text-gray-900 mb-2 flex items-center gap-2"><span className={`w-6 h-6 ${cfg.badge} rounded-full flex items-center justify-center text-xs font-bold`}>2</span>Viewing & Test Drive</h4><ul className="list-disc list-inside space-y-1 text-gray-600 ml-8"><li>Viewing and test drives are available through the dealership by appointment.</li></ul></div>
                      <div><h4 className="font-semibold text-gray-900 mb-2 flex items-center gap-2"><span className={`w-6 h-6 ${cfg.badge} rounded-full flex items-center justify-center text-xs font-bold`}>3</span>Safety & Reconditioning</h4><ul className="list-disc list-inside space-y-1 text-gray-600 ml-8"><li>Safety certification status is determined by the dealership — please confirm prior to purchase.</li></ul></div>
                      <div><h4 className="font-semibold text-gray-900 mb-2 flex items-center gap-2"><span className={`w-6 h-6 ${cfg.badge} rounded-full flex items-center justify-center text-xs font-bold`}>4</span>Fees & Licensing (Mandatory)</h4><ul className="list-disc list-inside space-y-1 text-gray-600 ml-8"><li>All transactions are subject to the mandatory OMVIC fee of <strong>$22 + HST</strong> per transaction.</li><li>A licensing fee of <strong>$59</strong> applies to every transaction.</li></ul></div>
                      <div><h4 className="font-semibold text-gray-900 mb-2 flex items-center gap-2"><span className={`w-6 h-6 ${cfg.badge} rounded-full flex items-center justify-center text-xs font-bold`}>5</span>CARFAX Disclosure</h4><ul className="list-disc list-inside space-y-1 text-gray-600 ml-8"><li>A CARFAX report will be provided to the client prior to completion of the sale.</li></ul></div>
                    </>}
                    {disclosureModal !== 'fleet' && (
                      <div className="pt-4 mt-4 border-t border-gray-200">
                        <p className="text-gray-500 italic text-xs">
                          No other promises, representations, or guarantees have been made, written or verbal, other than
                          what is disclosed above and on the Bill of Sale.
                        </p>
                      </div>
                    )}
                  </div>
                    </>
                  )}
                </div>
                <div className="px-6 py-4 border-t border-gray-200 flex-shrink-0">
                  <button onClick={() => setDisclosureModal(null)} className={`w-full ${cfg.btn} text-white font-semibold py-3 rounded-xl transition-colors`}>I Understand</button>
                </div>
              </div>
            </div>
          )
        })()}

        {/* Certificate Viewer Modal */}
        {certModal.open && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60">
            <div className="w-full max-w-4xl bg-white rounded-2xl shadow-xl flex flex-col" style={{ height: '90vh' }}>
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0">
                <h3 className="text-base font-semibold text-gray-900">Certificate</h3>
                <div className="flex items-center gap-3">
                  {certModal.files.length > 1 && (
                    <div className="flex gap-1">
                      {certModal.files.map((f, i) => (
                        <button
                          key={f.publicUrl}
                          type="button"
                          onClick={() => setCertModal(prev => ({ ...prev, activeIndex: i }))}
                          className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                            certModal.activeIndex === i
                              ? 'bg-blue-600 text-white border-blue-600'
                              : 'text-gray-600 border-gray-300 hover:border-blue-400'
                          }`}
                        >
                          File {i + 1}
                        </button>
                      ))}
                    </div>
                  )}
                  {certModal.files.length > 0 && (
                    <a
                      href={certModal.files[certModal.activeIndex]?.publicUrl}
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
                    onClick={() => setCertModal({ open: false, loading: false, files: [], activeIndex: 0 })}
                    className="text-gray-400 hover:text-gray-600 ml-1"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
              <div className="flex-1 min-h-0">
                {certModal.loading ? (
                  <div className="flex items-center justify-center h-full gap-2 text-gray-400">
                    <svg className="w-6 h-6 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    <span className="text-sm">Loading certificate…</span>
                  </div>
                ) : certModal.files.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full">
                    <svg className="w-14 h-14 text-gray-200 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                    </svg>
                    <p className="text-sm font-semibold text-gray-500">No Certificate Uploaded</p>
                    <p className="text-xs text-gray-400 mt-1">No certificate has been uploaded for this vehicle yet.</p>
                  </div>
                ) : (() => {
                  const url = certModal.files[certModal.activeIndex]?.publicUrl || ''
                  const name = (certModal.files[certModal.activeIndex]?.name || '').toLowerCase()
                  const isImage = /\.(jpg|jpeg|png|webp|gif|bmp|svg)$/.test(name)
                  if (isImage) {
                    return (
                      <div className="flex items-center justify-center h-full bg-gray-50 p-4 rounded-b-2xl">
                        <img src={url} alt="Certificate" className="max-h-full max-w-full object-contain rounded-lg shadow" />
                      </div>
                    )
                  }
                  return (
                    <iframe src={url} className="w-full h-full rounded-b-2xl" title="Certificate" />
                  )
                })()}
              </div>
            </div>
          </div>
        )}

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
              <div className="flex-1 min-h-0 overflow-hidden">
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
                    style={{ display: 'block' }}
                  />
                )}
              </div>
            </div>
          </div>
        )}

          </>
        )
      }

          </div>
        </div>
      </div>
    </div>
  )
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: string[]
}) {
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">{label}</p>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 outline-none focus:border-[#118df0] focus:ring-2 focus:ring-[#118df0]/20"
      >
        <option value="">All</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
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
