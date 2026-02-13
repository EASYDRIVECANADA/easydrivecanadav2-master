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
}

export default function MarketplacePage() {
  const [vehicles, setVehicles] = useState<MarketVehicle[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<MarketVehicle | null>(null)
  const [selectedImageIndex, setSelectedImageIndex] = useState(0)

  const getLoggedInAdminDbUserId = async (): Promise<string | null> => {
    try {
      if (typeof window === 'undefined') return null
      const raw = window.localStorage.getItem('edc_admin_session')
      if (!raw) return null
      const parsed = JSON.parse(raw) as { email?: string }
      const email = String(parsed?.email ?? '').trim().toLowerCase()
      if (!email) return null

      const { data, error } = await supabase
        .from('edc_account_verifications')
        .select('id')
        .eq('email', email)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (error) return null
      return (data as any)?.id ?? null
    } catch {
      return null
    }
  }

  const [make, setMake] = useState('')
  const [collection, setCollection] = useState('')
  const [bodyStyle, setBodyStyle] = useState('')
  const [exteriorColor, setExteriorColor] = useState('')
  const [feature, setFeature] = useState('')
  const [minPrice, setMinPrice] = useState('')
  const [maxPrice, setMaxPrice] = useState('')
  const [minYear, setMinYear] = useState('')
  const [maxYear, setMaxYear] = useState('')
  const [sort, setSort] = useState<'newest' | 'price_asc' | 'price_desc'>('newest')

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
        const scopedUserId = await getLoggedInAdminDbUserId()
        if (!scopedUserId) {
          if (!cancelled) setVehicles([])
          return
        }

        const { data, error } = await supabase
          .from('edc_vehicles')
          .select('*')
          .eq('user_id', scopedUserId)
          .limit(500)
        if (error) throw error
        if (cancelled) return
        const mapped: MarketVehicle[] = (data || []).map((r: any) => {
          const imgs = normalizeImages(r.images ?? r.image_urls ?? r.image)
          const features = normalizeFeatures(r.features)
          return {
            id: String(r.id),
            make: r.make || '',
            model: r.model || '',
            series: r.series || '',
            year: Number(r.year) || 0,
            price: Number(r.price) || 0,
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
    const noFilters =
      !make &&
      !collection &&
      !bodyStyle &&
      !exteriorColor &&
      !feature &&
      !minPrice.trim() &&
      !maxPrice.trim() &&
      !minYear.trim() &&
      !maxYear.trim()

    let rows = [...vehicles]
    if (noFilters) {
      if (sort === 'newest') rows.sort((a, b) => b.year - a.year)
      if (sort === 'price_asc') rows.sort((a, b) => a.price - b.price)
      if (sort === 'price_desc') rows.sort((a, b) => b.price - a.price)
      return rows
    } else {
      const m = make.trim()
      const c = collection.trim()
      const bs = bodyStyle.trim()
      const ec = exteriorColor.trim()
      const ft = feature.trim()

      if (m) rows = rows.filter((v) => (v.make || '').trim() === m)
      if (c) rows = rows.filter((v) => ((v.collection || '').trim()) === c)
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
    }
    if (sort === 'newest') rows.sort((a, b) => b.year - a.year)
    if (sort === 'price_asc') rows.sort((a, b) => a.price - b.price)
    if (sort === 'price_desc') rows.sort((a, b) => b.price - a.price)
    return rows
  }, [vehicles, make, collection, bodyStyle, exteriorColor, feature, minPrice, maxPrice, minYear, maxYear, sort])

  const unique = (arr: (string | undefined)[]) => Array.from(new Set(arr.filter(Boolean))) as string[]
  const makes = unique(vehicles.map((v) => v.make))
  const collections = unique(vehicles.map((v) => v.collection))
  const bodyStyles = unique(vehicles.map((v) => v.bodyStyle))
  const colors = unique(vehicles.map((v) => v.exteriorColor))
  const features = unique(vehicles.flatMap((v) => v.features || []))

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 py-6">
      <div className="flex items-start gap-6">
        {/* Sidebar Filters */}
        <aside className="w-72 bg-white rounded-xl shadow p-4">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold text-gray-700">Filters</div>
            <button
              type="button"
              className="text-xs text-[#118df0] hover:underline"
              onClick={() => {
                setMake('')
                setCollection('')
                setBodyStyle('')
                setExteriorColor('')
                setFeature('')
                setMinPrice('')
                setMaxPrice('')
                setMinYear('')
                setMaxYear('')
                setSort('newest')
              }}
            >
              Clear
            </button>
          </div>
          <div className="mt-3 space-y-4">
            <div>
              <div className="text-xs font-semibold text-gray-600 mb-1">Make</div>
              <select value={make} onChange={(e) => setMake(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                <option value="">All Makes</option>
                {makes.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
            <div>
              <div className="text-xs font-semibold text-gray-600 mb-1">Collection</div>
              <select value={collection} onChange={(e) => setCollection(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                <option value="">All Vehicles</option>
                {collections.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <div className="text-xs font-semibold text-gray-600 mb-1">Body Style</div>
              <select value={bodyStyle} onChange={(e) => setBodyStyle(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                <option value="">All Styles</option>
                {bodyStyles.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>
            <div>
              <div className="text-xs font-semibold text-gray-600 mb-1">Exterior Color</div>
              <select value={exteriorColor} onChange={(e) => setExteriorColor(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                <option value="">All Colors</option>
                {colors.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <div className="text-xs font-semibold text-gray-600 mb-1">Features</div>
              <select value={feature} onChange={(e) => setFeature(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                <option value="">All Features</option>
                {features.map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </div>
            <div>
              <div className="text-xs font-semibold text-gray-600 mb-1">Price Range</div>
              <div className="grid grid-cols-2 gap-2">
                <input value={minPrice} onChange={(e) => setMinPrice(e.target.value)} placeholder="Min" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                <input value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} placeholder="Max" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              </div>
            </div>
            <div>
              <div className="text-xs font-semibold text-gray-600 mb-1">Year Range</div>
              <div className="grid grid-cols-2 gap-2">
                <input value={minYear} onChange={(e) => setMinYear(e.target.value)} placeholder="Min" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                <input value={maxYear} onChange={(e) => setMaxYear(e.target.value)} placeholder="Max" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              </div>
            </div>
          </div>
        </aside>

        {/* Results */}
        <section className="flex-1">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm text-gray-600">{loading ? 'Loading…' : error ? 'Failed to load vehicles' : `Showing ${filtered.length} of ${vehicles.length} total vehicles`}</div>
            <div className="w-48">
              <select value={sort} onChange={(e) => setSort(e.target.value as any)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                <option value="newest">Newest</option>
                <option value="price_asc">Price: Low to High</option>
                <option value="price_desc">Price: High to Low</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((v) => (
              <VehicleCard key={v.id} vehicle={v} hideFooter onClick={() => setSelected(v)} />
            ))}

            {filtered.length === 0 ? (
              <div className="col-span-full text-center text-sm text-gray-500 py-10">No vehicles found.</div>
            ) : null}
          </div>

          {selected ? (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
              role="dialog"
              aria-modal="true"
              onMouseDown={(e) => {
                if (e.target === e.currentTarget) setSelected(null)
              }}
            >
              <div className="w-full max-w-6xl bg-white rounded-2xl shadow-xl overflow-hidden grid grid-cols-1 lg:grid-cols-3 h-[85vh] max-h-[85vh]">
                <div className="lg:col-span-2 p-6">
                  <div className="w-full h-80 md:h-[28rem] bg-gray-100 rounded-xl overflow-hidden flex items-center justify-center relative">
                    {selected.images && selected.images.length > 0 ? (
                      <img
                        src={toImageSrc(selected.images[Math.min(selectedImageIndex, selected.images.length - 1)])}
                        alt="Vehicle"
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <div className="text-center text-gray-500">No Image</div>
                    )}

                    {selected.images && selected.images.length > 1 ? (
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
                          <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                          <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                        <div className="absolute bottom-3 right-3 bg-black/60 text-white text-xs px-2 py-1 rounded-full">
                          {Math.min(selectedImageIndex, selected.images.length - 1) + 1}/{selected.images.length}
                        </div>
                      </>
                    ) : null}
                  </div>
                  <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="bg-gray-50 rounded-xl p-4 text-center">
                      <div className="text-xs text-gray-500">Mileage</div>
                      <div className="text-lg font-semibold text-gray-900">{selected.mileage.toLocaleString()} km</div>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-4 text-center">
                      <div className="text-xs text-gray-500">Year</div>
                      <div className="text-lg font-semibold text-gray-900">{selected.year}</div>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-4 text-center">
                      <div className="text-xs text-gray-500">Fuel</div>
                      <div className="text-lg font-semibold text-gray-900">{selected.fuelType || '—'}</div>
                    </div>
                  </div>
                  <div className="mt-5 bg-gray-50 rounded-2xl border border-gray-100 p-5">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-1 h-6 rounded-full bg-[#118df0]"></div>
                      <div className="text-base font-semibold text-gray-900">Vehicle Specifications</div>
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
                <div className="p-6 border-t lg:border-t-0 lg:border-l border-gray-100 flex flex-col gap-3 min-h-0">
                  <div className="text-xl font-semibold text-gray-900">{selected.year} {selected.make} {selected.model}</div>
                  <div>
                    <span className="inline-flex items-center rounded-full bg-[#118df0] text-white px-3 py-1 text-sm font-semibold">
                      ${selected.price.toLocaleString()}
                    </span>
                  </div>
                  {selected.adDescription && selected.adDescription.trim() !== '' ? (
                    <div className="flex-1 min-h-0">
                      <div className="text-sm font-semibold text-gray-900 mb-2">Description</div>
                      <div className="text-sm text-gray-700 bg-gray-50 rounded-xl p-3 h-full overflow-auto whitespace-pre-wrap">
                        {selected.adDescription}
                      </div>
                    </div>
                  ) : null}
                  <button
                    type="button"
                    className="mt-auto h-10 px-4 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-800 text-sm font-semibold"
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
      <div className="w-9 h-9 rounded-xl bg-white border border-gray-100 flex items-center justify-center text-gray-600">
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
        <div className="text-xs text-gray-500">{label}</div>
        <div className="text-sm font-semibold text-gray-900 break-words">{value}</div>
      </div>
    </div>
  )
}
