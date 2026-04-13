'use client'

import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

type ShowroomVehicle = {
  id: string
  vehicle: string
  drive: string
  transmission: string
  cyl: string
  colour: string
  odometerKm: number
  odoUnit?: string
  price: number
  status: 'In Stock' | 'Deal Pending' | 'Sold'
  images?: string[]
  vin?: string
  stock?: string
  features?: string[]
  categories?: string
}

const getCategoryBadge = (categories?: string) => {
  const raw = String(categories ?? '').trim().toLowerCase()
  if (!raw) return null
  if (raw.includes('private')) return { label: 'Private', src: '/images/Private.png' }
  if (raw.includes('dealer')) return { label: 'Dealership', src: '/images/Dealership.png' }
  if (raw.includes('premier') || raw.includes('premiere')) return { label: 'Premier', src: '/images/Premier.png' }
  if (raw.includes('fleet')) return { label: 'Fleet Cars', src: '/images/Fleet%20Cars.png' }
  return null
}

export default function CustomerShowroomPage() {
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<'ALL' | ShowroomVehicle['status']>('ALL')
  const [selected, setSelected] = useState<ShowroomVehicle | null>(null)
  const [imageIdx, setImageIdx] = useState(0)
  const [viewMode, setViewMode] = useState<'TBL' | 'CRD'>('TBL')
  const [showPayment, setShowPayment] = useState(false)
  const [disclosureModal, setDisclosureModal] = useState<{
    open: boolean
    loading: boolean
    title: string
    body: string
  }>({ open: false, loading: false, title: '', body: '' })
  const [carfaxModal, setCarfaxModal] = useState<{
    open: boolean
    loading: boolean
    files: { name: string; path: string; publicUrl: string }[]
    activeIndex: number
  }>({ open: false, loading: false, files: [], activeIndex: 0 })
  const [carfaxAvailable, setCarfaxAvailable] = useState<boolean | null>(null)
  const [carfaxMap, setCarfaxMap] = useState<Map<string, boolean>>(new Map())
  const [disclosureMap, setDisclosureMap] = useState<Map<string, boolean>>(new Map())
  const [disclosureAvailable, setDisclosureAvailable] = useState<boolean | null>(null)
  const [termMonths, setTermMonths] = useState<number>(96)
  const [frequency, setFrequency] = useState<'Monthly' | 'Bi-Weekly' | 'Weekly' | 'Semi-Monthly'>('Bi-Weekly')
  const [interestRateStr, setInterestRateStr] = useState<string>('')
  const [downPaymentStr, setDownPaymentStr] = useState<string>('')

  // Filters drawer state
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [yearFrom, setYearFrom] = useState<number | ''>('')
  const [yearTo, setYearTo] = useState<number | ''>('')
  const [makeSel, setMakeSel] = useState<string>('')
  const [modelSel, setModelSel] = useState<string>('')
  const [priceMin, setPriceMin] = useState<number | ''>('')
  const [priceMax, setPriceMax] = useState<number | ''>('')
  const [odoMin, setOdoMin] = useState<number | ''>('')
  const [odoMax, setOdoMax] = useState<number | ''>('')
  const [driveSet, setDriveSet] = useState<Set<string>>(new Set())
  const [colourSet, setColourSet] = useState<Set<string>>(new Set())

  const [rows, setRows] = useState<ShowroomVehicle[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)

  const [bucketImageCache] = useState(() => new Map<string, string[]>())

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

  const openDisclosure = async (vehicleId: string) => {
    setDisclosureModal({ open: true, loading: true, title: '', body: '' })
    try {
      const { data, error } = await supabase
        .from('edc_disclosures')
        .select('disclosures_title, disclosures_body')
        .eq('vehicleId', vehicleId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (error || !data) {
        setDisclosureModal({ open: true, loading: false, title: 'No Disclosure', body: 'No disclosure information is available for this vehicle.' })
        return
      }
      setDisclosureModal({ open: true, loading: false, title: String(data.disclosures_title || 'Important Disclosure'), body: String(data.disclosures_body || '') })
    } catch {
      setDisclosureModal({ open: true, loading: false, title: 'Error', body: 'Failed to load disclosure.' })
    }
  }

  useEffect(() => {
    setMounted(true)
  }, [])

  // Check carfax + disclosure availability for selected vehicle
  useEffect(() => {
    if (!selected) { setCarfaxAvailable(null); setDisclosureAvailable(null); return }
    supabase.storage
      .from('Carfax')
      .list(selected.id, { limit: 1 })
      .then(({ data }) => setCarfaxAvailable(Array.isArray(data) && data.some((f) => !!f?.name && !String(f.name).endsWith('/'))))
      .catch(() => setCarfaxAvailable(false))
    supabase
      .from('edc_disclosures')
      .select('id', { count: 'exact', head: true })
      .eq('vehicleId', selected.id)
      .then(({ count }) => setDisclosureAvailable((count ?? 0) > 0))
      .catch(() => setDisclosureAvailable(false))
  }, [selected])

  // Bulk check carfax + disclosure for all rows
  useEffect(() => {
    if (rows.length === 0) return
    const newCarfax = new Map<string, boolean>()
    const newDisc = new Map<string, boolean>()
    const carfaxChecks = rows.map((r) =>
      supabase.storage
        .from('Carfax')
        .list(r.id, { limit: 1 })
        .then(({ data }) => { newCarfax.set(r.id, Array.isArray(data) && data.some((f) => !!f?.name && !String(f.name).endsWith('/'))) })
        .catch(() => { newCarfax.set(r.id, false) })
    )
    const discChecks = rows.map((r) =>
      supabase
        .from('edc_disclosures')
        .select('id', { count: 'exact', head: true })
        .eq('vehicleId', r.id)
        .then(({ count }) => { newDisc.set(r.id, (count ?? 0) > 0) })
        .catch(() => { newDisc.set(r.id, false) })
    )
    Promise.all(carfaxChecks).then(() => setCarfaxMap(new Map(newCarfax)))
    Promise.all(discChecks).then(() => setDisclosureMap(new Map(newDisc)))
  }, [rows])

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      try {
        setLoading(true)
        setFetchError(null)

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
        const storedSession = typeof window !== 'undefined' ? window.localStorage.getItem('edc_admin_session') : null
        const sessionData = storedSession ? (() => { try { return JSON.parse(storedSession) } catch { return null } })() : null
        const userId = String(sessionData?.user_id ?? '').trim()
        const res = await fetch(userId ? `/api/vehicles?user_id=${encodeURIComponent(userId)}` : '/api/vehicles', { cache: 'no-store' })
        const json = await res.json().catch(() => ({}))
        if (!res.ok || json.error) throw new Error(json.error || `Failed to fetch vehicles (${res.status})`)

        const vehicles = Array.isArray(json.vehicles) ? json.vehicles : []
        const mapped: ShowroomVehicle[] = await Promise.all(vehicles.map(async (v: any) => {
          const toNumber = (val: any) => {
            if (val === null || val === undefined) return 0
            if (typeof val === 'number') return Number.isFinite(val) ? val : 0
            const s = String(val).trim()
            if (!s) return 0
            const cleaned = s.replace(/[^0-9.-]/g, '')
            const n = cleaned ? Number(cleaned) : NaN
            return Number.isFinite(n) ? n : 0
          }

          const pickNumber = (...vals: any[]) => {
            let firstDefined = 0
            let hasDefined = false

            for (const val of vals) {
              if (val === null || val === undefined) continue
              if (typeof val === 'string' && val.trim() === '') continue
              const num = toNumber(val)
              if (!hasDefined) {
                firstDefined = num
                hasDefined = true
              }
              if (num > 0) return num
            }

            return hasDefined ? firstDefined : 0
          }

          const year = v.year ? String(v.year) : ''
          const make = v.make || ''
          const model = v.model || ''
          const trim = v.trim || ''
          const label = [year, make, model, trim].filter(Boolean).join(' ').trim() || v.vin || ''

          const drive = (v.drivetrain || v.drive || '').toString().trim()
          const trans = (v.transmission || '').toString().trim()
          const cyl = (v.cylinders || v.cyl || '').toString().trim()
          const colour = (v.exterior_color || v.colour || '').toString().trim()
          const odo = pickNumber(v.odometer, v.odometerKm, v.mileage, 0)
          const odoUnit = (v.odometer_unit || 'km').toString().trim()
          const price = pickNumber(
            v.price,
            v.list_price,
            v.listPrice,
            v.listprice,
            v.sale_price,
            v.salePrice,
            v.saleprice,
            v.msrp,
            v.advertised_price,
            v.advertisedPrice,
            0
          )
          const rawStatus = (v.status || '').toString().toLowerCase()
          const normalizedStatus: ShowroomVehicle['status'] = rawStatus.includes('pending')
            ? 'Deal Pending'
            : rawStatus.includes('sold')
              ? 'Sold'
              : 'In Stock'

          const imgsNormalized = await loadBucketImages(String(v.id || ''))

          // normalize features
          let feats: string[] = []
          const rawFeats = v.features
          if (Array.isArray(rawFeats)) feats = rawFeats.map((x: any) => String(x)).filter(Boolean)
          else if (typeof rawFeats === 'string' && rawFeats.trim()) {
            try {
              const parsed = JSON.parse(rawFeats)
              if (Array.isArray(parsed)) feats = parsed.map((x: any) => String(x)).filter(Boolean)
              else feats = rawFeats.split(',').map((s) => s.trim()).filter(Boolean)
            } catch {
              feats = rawFeats.split(',').map((s) => s.trim()).filter(Boolean)
            }
          }

          return {
            id: String(v.id || ''),
            vehicle: label,
            drive: drive || '-',
            transmission: trans || '-',
            cyl: cyl || '-',
            colour: colour || '-',
            odometerKm: odo,
            odoUnit,
            price,
            status: normalizedStatus,
            images: imgsNormalized,
            vin: (v.vin || '').toString().trim() || undefined,
            stock: (v.stock_number ?? v.stockNumber ?? '').toString().trim() || undefined,
            features: feats,
            categories: (v.categories || v.category || '').toString().trim() || undefined,
          }
        }))

        if (!cancelled) setRows(mapped)
      } catch (e: any) {
        if (!cancelled) setFetchError(e?.message || 'Failed to fetch vehicles')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  // derive facets
  const facets = useMemo(() => {
    const makes = new Set<string>()
    const models = new Set<string>()
    const drives = new Set<string>()
    const colours = new Set<string>()
    let minYear = Number.POSITIVE_INFINITY
    let maxYear = 0
    let minPrice = Number.POSITIVE_INFINITY
    let maxPrice = 0
    let minOdo = Number.POSITIVE_INFINITY
    let maxOdo = 0
    for (const r of rows) {
      const parts = r.vehicle.split(' ')
      const yr = parseInt(parts[0])
      if (!Number.isNaN(yr)) { minYear = Math.min(minYear, yr); maxYear = Math.max(maxYear, yr) }
      makes.add(parts[1] || '')
      models.add(parts[2] || '')
      if (r.drive) drives.add(r.drive)
      if (r.colour) colours.add(r.colour)
      minPrice = Math.min(minPrice, Number(r.price) || 0)
      maxPrice = Math.max(maxPrice, Number(r.price) || 0)
      minOdo = Math.min(minOdo, Number(r.odometerKm) || 0)
      maxOdo = Math.max(maxOdo, Number(r.odometerKm) || 0)
    }
    if (!isFinite(minYear)) { minYear = 0; maxYear = 0 }
    if (!isFinite(minPrice)) { minPrice = 0; maxPrice = 0 }
    if (!isFinite(minOdo)) { minOdo = 0; maxOdo = 0 }
    return { makes: Array.from(makes).filter(Boolean).sort(), models: Array.from(models).filter(Boolean).sort(), drives: Array.from(drives).filter(Boolean).sort(), colours: Array.from(colours).filter(Boolean).sort(), minYear, maxYear, minPrice, maxPrice, minOdo, maxOdo }
  }, [rows])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return rows.filter((r) => {
      if (status !== 'ALL' && r.status !== status) return false
      // Filters
      // year
      const yr = parseInt(r.vehicle.split(' ')[0])
      if (yearFrom !== '' && !Number.isNaN(yr) && yr < (yearFrom as number)) return false
      if (yearTo !== '' && !Number.isNaN(yr) && yr > (yearTo as number)) return false
      // make/model
      if (makeSel) {
        const mk = (r.vehicle.split(' ')[1] || '').toLowerCase()
        if (mk !== makeSel.toLowerCase()) return false
      }
      if (modelSel) {
        const md = (r.vehicle.split(' ')[2] || '').toLowerCase()
        if (md !== modelSel.toLowerCase()) return false
      }
      // price
      const p = Number(r.price) || 0
      if (priceMin !== '' && p < (priceMin as number)) return false
      if (priceMax !== '' && p > (priceMax as number)) return false
      // odometer
      const o = Number(r.odometerKm) || 0
      if (odoMin !== '' && o < (odoMin as number)) return false
      if (odoMax !== '' && o > (odoMax as number)) return false
      // drivetrain
      if (driveSet.size > 0 && !driveSet.has((r.drive || '').toUpperCase())) return false
      // colours
      if (colourSet.size > 0 && !colourSet.has((r.colour || '').toLowerCase())) return false
      if (!q) return true
      return (
        r.vehicle.toLowerCase().includes(q) ||
        r.colour.toLowerCase().includes(q) ||
        r.drive.toLowerCase().includes(q) ||
        r.transmission.toLowerCase().includes(q) ||
        r.status.toLowerCase().includes(q)
      )
    })
  }, [query, rows, status, yearFrom, yearTo, makeSel, modelSel, priceMin, priceMax, odoMin, odoMax, driveSet, colourSet])

  const resetFilters = () => {
    setYearFrom('')
    setYearTo('')
    setMakeSel('')
    setModelSel('')
    setPriceMin('')
    setPriceMax('')
    setOdoMin('')
    setOdoMax('')
    setDriveSet(new Set())
    setColourSet(new Set())
  }

  const payment = useMemo(() => {
    if (!selected) return 0
    const ir = parseFloat(interestRateStr || '0')
    const dp = parseFloat(downPaymentStr || '0')
    const principal = Math.max(0, (Number(selected.price) || 0) - (dp || 0))
    const periodsPerYear = frequency === 'Monthly' ? 12 : frequency === 'Semi-Monthly' ? 24 : frequency === 'Bi-Weekly' ? 26 : 52
    const totalPeriods = Math.max(1, Math.round(termMonths * (periodsPerYear / 12)))
    const r = (ir || 0) / 100 / periodsPerYear
    if (r <= 0) return principal / totalPeriods
    const pow = Math.pow(1 + r, -totalPeriods)
    return (r * principal) / (1 - pow)
  }, [selected, termMonths, frequency, interestRateStr, downPaymentStr])

  const fin = useMemo(() => {
    const price = Number(selected?.price || 0)
    const otherFees = 0
    const licensing = 0
    const tradeValue = 0
    const trueTradeValue = 0
    const lienPayout = 0
    const deposit = parseFloat(downPaymentStr || '0') || 0
    const subTotal = price + otherFees + licensing - tradeValue - trueTradeValue + lienPayout
    const taxRate = 0.13
    const hst = subTotal * taxRate
    const totalTaxes = hst
    const grandTotal = subTotal + totalTaxes
    const payableOnDelivery = Math.max(0, grandTotal - deposit)
    const fmt = (n: number) => `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    return {
      price: fmt(price),
      otherFees: fmt(otherFees),
      licensing: fmt(licensing),
      totalPrice: fmt(price + otherFees + licensing),
      tradeValue: fmt(tradeValue),
      trueTradeValue: fmt(trueTradeValue),
      lienPayout: fmt(lienPayout),
      subTotal: fmt(subTotal),
      hst: fmt(hst),
      totalTaxes: fmt(totalTaxes),
      grandTotal: fmt(grandTotal),
      deposit: fmt(deposit),
      payableOnDelivery: fmt(payableOnDelivery),
    }
  }, [selected, downPaymentStr])

  return (
    <div className="min-h-screen">
      <div className="edc-page-header">
        <h1 className="text-2xl font-bold text-slate-900">Customer Showroom</h1>
        <p className="text-sm text-slate-500 mt-0.5">Vehicles from Supabase (edc_vehicles)</p>
      </div>

      <div className="px-6 py-6">
        <div className="edc-card p-4">
          <div className="flex flex-col lg:flex-row lg:items-center gap-3">
            {/* View toggle */}
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <span className="hidden sm:block">View</span>
              <button
                type="button"
                onClick={() => setViewMode(viewMode === 'TBL' ? 'CRD' : 'TBL')}
                className={`h-8 w-20 rounded-full border ${viewMode === 'TBL' ? 'border-blue-300 bg-blue-50' : 'border-blue-300 bg-blue-50'}`}
                aria-label="Toggle view"
              >
                <div className="flex items-center justify-between w-full px-2">
                  {viewMode === 'TBL' ? (
                    <>
                      <span className="w-3 h-3 rounded-full bg-blue-600" />
                      <span className="text-[10px] font-bold tracking-wider">TBL</span>
                    </>
                  ) : (
                    <>
                      <span className="text-[10px] font-bold tracking-wider">CRD</span>
                      <span className="w-3 h-3 rounded-full bg-blue-600" />
                    </>
                  )}
                </div>
              </button>
            </div>

            <div className="flex-1">
              <div className="relative">
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search vehicle, drive, colour, status..."
                  className="edc-input pl-10"
                />
                <svg
                  className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35m1.35-5.65a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>

            <div className="w-full lg:w-64">
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="edc-input"
              >
                <option value="ALL">All Status</option>
                <option value="In Stock">In Stock</option>
                <option value="Deal Pending">Deal Pending</option>
                <option value="Sold">Sold</option>
              </select>
            </div>

            <div className="text-sm text-slate-500 whitespace-nowrap">Showing {filtered.length} of {rows.length}</div>
          </div>

          {fetchError ? (
            <div className="mt-3 text-sm text-danger-600">{fetchError}</div>
          ) : null}
        </div>

        {viewMode === 'TBL' ? (
        <div className="edc-card mt-4 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="edc-table">
              <thead>
                <tr>
                  <th className="px-3 py-3 w-12"></th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3">Vehicle</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3">Drive</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3">Trans.</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3">Cyl.</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3">Colour</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3">Odometer</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3">Price</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td className="px-6 py-10 text-center text-sm text-slate-400" colSpan={9}>Loading...</td></tr>
                ) : null}
                {filtered.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-3 py-3">
                      <button
                        type="button"
                        onClick={() => { setSelected(r); setImageIdx(0) }}
                        className="w-8 h-8 rounded-lg bg-green-600 hover:bg-green-700 text-white flex items-center justify-center transition-colors"
                        title="View vehicle"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13l-1.2 6H18M7 13l-1.6-8M9 21a1 1 0 100-2 1 1 0 000 2zm10 0a1 1 0 100-2 1 1 0 000 2z" />
                        </svg>
                      </button>
                    </td>
                    <td className="px-6 py-3 text-sm font-medium text-slate-800 whitespace-nowrap">
                      <button type="button" onClick={() => { setSelected(r); setImageIdx(0) }} className="text-cyan-600 hover:underline text-left">{r.vehicle}</button>
                    </td>
                    <td className="px-6 py-3 text-sm text-slate-600 whitespace-nowrap">{r.drive}</td>
                    <td className="px-6 py-3 text-sm text-slate-600 whitespace-nowrap">{r.transmission}</td>
                    <td className="px-6 py-3 text-sm text-slate-600 whitespace-nowrap">{r.cyl}</td>
                    <td className="px-6 py-3 text-sm text-slate-600 whitespace-nowrap">{r.colour}</td>
                    <td className="px-6 py-3 text-sm text-slate-600 whitespace-nowrap">{r.odometerKm.toLocaleString()} km</td>
                    <td className="px-6 py-3 text-sm font-semibold text-slate-800 whitespace-nowrap">${(Number(r.price) || 0).toLocaleString()}</td>
                    <td className="px-6 py-3 text-sm whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                        r.status === 'In Stock' ? 'bg-green-100 text-green-700'
                        : r.status === 'Deal Pending' ? 'bg-amber-100 text-amber-700'
                        : 'bg-slate-200 text-slate-700'
                      }`}>{r.status}</span>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && !loading ? (
                  <tr><td className="px-6 py-10 text-center text-sm text-slate-400" colSpan={9}>No results.</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
        ) : (
        <div className="edc-card mt-4 divide-y divide-slate-100">
          {loading ? (
            <div className="px-6 py-10 text-center text-sm text-slate-400">Loading...</div>
          ) : null}
          {filtered.map((r) => (
            <div key={r.id} className="flex items-stretch hover:bg-slate-50 transition-colors">
              {/* Thumbnail */}
              <div className="w-[160px] flex-shrink-0 bg-slate-100 flex items-center justify-center overflow-hidden">
                {Array.isArray(r.images) && r.images.length > 0 ? (
                  <img src={r.images[0]} alt={r.vehicle} className="w-full h-full object-cover" />
                ) : (
                  <svg className="w-10 h-10 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4-4a3 5 0 013 0l4 4M14 14l1-1a3 5 0 013 0l2 2" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
                  </svg>
                )}
              </div>
              {/* Info */}
              <div className="flex-1 min-w-0 px-5 py-4">
                <button
                  type="button"
                  onClick={() => { setSelected(r); setImageIdx(0) }}
                  className="text-base font-semibold text-cyan-600 hover:underline text-left"
                >
                  {r.vehicle} {r.colour}
                </button>
                <div className="text-sm text-slate-500 italic mt-0.5">
                  {r.odometerKm.toLocaleString()} kms &nbsp; {r.drive} &nbsp; {r.transmission}
                </div>
                <div className="text-xl font-bold text-slate-800 mt-1">
                  ${(Number(r.price) || 0).toLocaleString()}.00{' '}
                  <span className="text-xs font-normal text-slate-400">+ tax</span>
                </div>
                {(r.vin || r.stock) && (
                  <div className="text-xs text-slate-400 mt-1">
                    {r.vin ? <>VIN: {r.vin}</> : null}
                    {r.vin && r.stock ? <span className="mx-1">·</span> : null}
                    {r.stock ? <>Stock# {r.stock}</> : null}
                  </div>
                )}
              </div>
              {/* Cart button — opens modal */}
              <div className="flex items-end justify-end px-4 py-4">
                <button
                  type="button"
                  onClick={() => { setSelected(r); setImageIdx(0) }}
                  className="w-9 h-9 rounded-lg bg-green-600 hover:bg-green-700 text-white flex items-center justify-center transition-colors"
                  title="View vehicle"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13l-1.2 6H18M7 13l-1.6-8M9 21a1 1 0 100-2 1 1 0 000 2zm10 0a1 1 0 100-2 1 1 0 000 2z" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
          {filtered.length === 0 && !loading ? (
            <div className="px-6 py-10 text-center text-sm text-slate-400">No results.</div>
          ) : null}
        </div>
        )}

        {/* Filters Drawer Toggle */}
        <button
          type="button"
          onClick={() => setFiltersOpen(true)}
          className="fixed right-0 top-1/2 -translate-y-1/2 z-[70] bg-white border border-slate-200/60 rounded-l px-2 py-3 shadow-premium"
          style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
        >
          Filters
        </button>

        {/* Filters Drawer */}
        {filtersOpen && (
          <div className="fixed top-0 right-0 h-full w-[320px] bg-white border-l border-slate-200/60 shadow-premium z-[80] overflow-y-auto">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
              <div className="text-sm font-semibold text-slate-800">Filters</div>
              <button type="button" onClick={() => setFiltersOpen(false)} className="w-8 h-8 rounded hover:bg-slate-50 flex items-center justify-center transition-colors">
                <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="px-4 py-4 space-y-5 text-sm">
              {/* Year Range */}
              <div>
                <div className="text-center font-semibold mb-2">Year Range</div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <div className="text-xs text-slate-500 mb-1">From</div>
                    <select value={yearFrom} onChange={(e)=>setYearFrom(e.target.value?Number(e.target.value):'')} className="w-full border rounded px-2 py-1">
                      <option value="">Start Year</option>
                      {Array.from({length: (facets.maxYear - facets.minYear + 1)||0}, (_,i)=>facets.minYear+i).map(y => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 mb-1">To</div>
                    <select value={yearTo} onChange={(e)=>setYearTo(e.target.value?Number(e.target.value):'')} className="w-full border rounded px-2 py-1">
                      <option value="">End Year</option>
                      {Array.from({length: (facets.maxYear - facets.minYear + 1)||0}, (_,i)=>facets.minYear+i).map(y => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Make/Model */}
              <div className="space-y-3">
                <div className="text-center">
                  <button className="bg-navy-900 hover:bg-navy-800 text-white text-xs font-semibold rounded px-3 py-2 transition-colors">Makes ▾</button>
                </div>
                <select value={makeSel} onChange={(e)=>setMakeSel(e.target.value)} className="w-full border rounded px-2 py-1">
                  <option value="">All Makes</option>
                  {facets.makes.map(m => (<option key={m} value={m}>{m}</option>))}
                </select>
                <div className="text-center">
                  <button className="bg-navy-900 hover:bg-navy-800 text-white text-xs font-semibold rounded px-3 py-2 transition-colors">Models ▾</button>
                </div>
                <select value={modelSel} onChange={(e)=>setModelSel(e.target.value)} className="w-full border rounded px-2 py-1">
                  <option value="">All Models</option>
                  {facets.models.map(m => (<option key={m} value={m}>{m}</option>))}
                </select>
              </div>

              {/* Actions (top) */}
              <div className="flex items-center justify-center gap-2">
                <button type="button" onClick={()=>setFiltersOpen(false)} className="edc-btn-primary h-8 px-4 text-xs">Search</button>
                <button type="button" onClick={resetFilters} className="edc-btn-danger h-8 px-4 text-xs">Reset</button>
                <button type="button" className="edc-btn-ghost h-8 px-4 text-xs">Compare</button>
              </div>

              {/* Price Range */}
              <div>
                <div className="font-semibold mb-2">Price Range</div>
                <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                  <span>${(Number(priceMin!==''?priceMin:facets.minPrice)||0).toLocaleString(undefined,{maximumFractionDigits:0})}</span>
                  <span>${(Number(priceMax!==''?priceMax:facets.maxPrice)||0).toLocaleString(undefined,{maximumFractionDigits:0})}</span>
                </div>
                <div className="flex items-center gap-2">
                  <input type="range" min={facets.minPrice} max={facets.maxPrice} value={Number(priceMin!==''?priceMin:facets.minPrice)} onChange={(e)=>setPriceMin(Number(e.target.value))} className="w-full" />
                  <input type="range" min={facets.minPrice} max={facets.maxPrice} value={Number(priceMax!==''?priceMax:facets.maxPrice)} onChange={(e)=>setPriceMax(Number(e.target.value))} className="w-full" />
                </div>
              </div>

              {/* Odometer Range */}
              <div>
                <div className="font-semibold mb-2">Odometer Range</div>
                <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                  <span>{(Number(odoMin!==''?odoMin:facets.minOdo)||0).toLocaleString()} kms</span>
                  <span>{(Number(odoMax!==''?odoMax:facets.maxOdo)||0).toLocaleString()} kms</span>
                </div>
                <div className="flex items-center gap-2">
                  <input type="range" min={facets.minOdo} max={facets.maxOdo} value={Number(odoMin!==''?odoMin:facets.minOdo)} onChange={(e)=>setOdoMin(Number(e.target.value))} className="w-full" />
                  <input type="range" min={facets.minOdo} max={facets.maxOdo} value={Number(odoMax!==''?odoMax:facets.maxOdo)} onChange={(e)=>setOdoMax(Number(e.target.value))} className="w-full" />
                </div>
              </div>

              {/* Body (placeholder button to match UI) */}
              <div className="text-center">
                <button className="bg-navy-900 hover:bg-navy-800 text-white text-xs font-semibold rounded px-3 py-2 transition-colors">Body ▾</button>
              </div>

              {/* Options/Colours headers (visual only) */}
              <div className="text-center">
                <button className="bg-navy-900 hover:bg-navy-800 text-white text-xs font-semibold rounded px-3 py-2 transition-colors">Options ▾</button>
              </div>
              <div className="text-center">
                <button className="bg-navy-900 hover:bg-navy-800 text-white text-xs font-semibold rounded px-3 py-2 transition-colors">Colours ▾</button>
              </div>

              {/* Drive checkboxes two columns */}
              <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                {facets.drives.map(d => {
                  const val = d.toUpperCase()
                  const checked = driveSet.has(val)
                  return (
                    <label key={val} className="inline-flex items-center gap-2">
                      <input type="checkbox" checked={checked} onChange={() => {
                        const next = new Set(driveSet)
                        if (checked) next.delete(val); else next.add(val)
                        setDriveSet(next)
                      }} />
                      <span>{val}</span>
                    </label>
                  )
                })}
              </div>

              {/* Colours checkboxes two columns */}
              <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                {facets.colours.map(c => {
                  const key = c.toLowerCase()
                  const checked = colourSet.has(key)
                  return (
                    <label key={key} className="inline-flex items-center gap-2">
                      <input type="checkbox" checked={checked} onChange={() => {
                        const next = new Set(colourSet)
                        if (checked) next.delete(key); else next.add(key)
                        setColourSet(next)
                      }} />
                      <span>{c}</span>
                    </label>
                  )
                })}
              </div>
            </div>
          </div>
        )}
        {mounted && selected
          ? createPortal(
              <div
                className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
                role="dialog"
                aria-modal="true"
                onMouseDown={(e) => {
                  if (e.target === e.currentTarget) setSelected(null)
                }}
              >
                <div className="edc-overlay absolute inset-0" style={{ zIndex: 0 }} onMouseDown={() => setSelected(null)} />
                <div className="relative z-[1] w-full max-w-5xl bg-white rounded-2xl shadow-premium overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                    <button
                      type="button"
                      className="text-sm font-semibold text-cyan-600 hover:underline"
                      onClick={() => setSelected(null)}
                    >
                      ← Showroom
                    </button>
                    <button
                      type="button"
                      className="w-10 h-10 rounded-xl hover:bg-slate-50 flex items-center justify-center transition-colors"
                      onClick={() => setSelected(null)}
                      aria-label="Close"
                    >
                      <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2">
                    {/* Left panel — image + vehicle info */}
                    <div className="bg-slate-50 p-6 flex flex-col">
                      <div className="flex-1 rounded-xl bg-white border border-slate-200/60 flex items-center justify-center relative overflow-hidden" style={{ minHeight: 260 }}>
                        {Array.isArray(selected.images) && selected.images.length > 0 ? (
                          <img
                            src={selected.images[Math.min(imageIdx, selected.images.length - 1)]}
                            alt={selected.vehicle}
                            className="w-full h-full object-contain"
                          />
                        ) : (
                          <div className="text-center">
                            <svg className="w-20 h-20 text-slate-300 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4-4a3 5 0 013 0l4 4M14 14l1-1a3 5 0 013 0l2 2" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
                            </svg>
                            <div className="text-slate-400 text-sm font-semibold">NO IMAGE AVAILABLE</div>
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => setImageIdx((i) => selected.images && selected.images.length ? (i - 1 + selected.images.length) % selected.images.length : 0)}
                          className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/80 hover:bg-white flex items-center justify-center"
                          disabled={!selected.images || selected.images.length <= 1}
                        >
                          <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => setImageIdx((i) => selected.images && selected.images.length ? (i + 1) % selected.images.length : 0)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/80 hover:bg-white flex items-center justify-center"
                          disabled={!selected.images || selected.images.length <= 1}
                        >
                          <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                        </button>
                      </div>
                      <div className="mt-4">
                        <div className="text-lg font-semibold text-slate-800">{selected.vehicle} {selected.colour}</div>
                        <div className="text-sm text-slate-500 mt-0.5">
                          {selected.odometerKm.toLocaleString()} {selected.odoUnit || 'kms'} <span className="text-slate-300 mx-1">·</span> {selected.drive} <span className="text-slate-300 mx-1">·</span> {selected.transmission}
                        </div>
                        {selected.vin ? <div className="text-xs text-slate-400 mt-1">VIN: {selected.vin}</div> : null}
                        {selected.stock ? <div className="text-xs text-slate-400">Stock# {selected.stock}</div> : null}
                      </div>
                    </div>

                    {/* Right panel — finance table */}
                    <div className="p-6">
                      <div className="bg-slate-50 rounded-xl border border-slate-200/60 overflow-hidden">
                        <div className="divide-y divide-slate-200/60">
                          <Row label="Vehicle Price" value={fin.price} bold />
                          <Row label="Other Fees" value={fin.otherFees} />
                          <Row label="Licensing" value={fin.licensing} />
                          <Row label="Total Price" value={fin.totalPrice} />
                          <Row label="Trade Value" value={fin.tradeValue} />
                          <Row label="True Trade Value" value={fin.trueTradeValue} />
                          <Row label="Lien Payout" value={fin.lienPayout} />
                          <Row label="Sub Total" value={fin.subTotal} />
                          <Row label="HST" value={fin.hst} />
                          <Row label="Total Tax(s)" value={fin.totalTaxes} />
                          <Row label="Grand Total" value={fin.grandTotal} bold />
                          <Row label="Deposit" value={fin.deposit} />
                          <Row label="Payable on Delivery" value={fin.payableOnDelivery} bold highlight />
                        </div>
                      </div>

                      <div className="mt-4 flex items-center justify-end gap-2">
                        {/* Disclosure — only if available */}
                        {disclosureAvailable && (
                          <button
                            type="button"
                            onClick={() => openDisclosure(selected.id)}
                            className="w-10 h-10 rounded-lg bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-600 flex items-center justify-center transition-colors"
                            title="View Disclosure"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                          </button>
                        )}
                        {/* CARFAX — only if available */}
                        {carfaxAvailable && (
                          <button
                            type="button"
                            onClick={() => openCarfaxModal(selected.id)}
                            className="w-10 h-10 rounded-lg bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 flex items-center justify-center transition-colors"
                            title="View CARFAX Report"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => router.push(`/admin/sales/deals/new?vehicleId=${encodeURIComponent(selected.id)}`)}
                          className="h-10 px-4 rounded-lg bg-green-600 text-white text-sm font-semibold hover:bg-green-700"
                        >
                          BUY NOW
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowPayment(true)}
                          className="h-10 w-10 rounded-lg bg-navy-900 text-white flex items-center justify-center hover:bg-navy-800 transition-colors"
                          aria-label="Payment details"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6h10M10 12h10M10 18h10M4 6h.01M4 12h.01M4 18h.01" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>,
              document.body
            )
          : null}

        {mounted && showPayment && selected
          ? createPortal(
              <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4" role="dialog" aria-modal="true">
                <div className="edc-overlay absolute inset-0" style={{ zIndex: 0 }} onMouseDown={() => setShowPayment(false)} />
                <div className="edc-modal w-full max-w-md relative z-[1] overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                    <div className="text-lg font-semibold text-slate-800">Payment</div>
                    <button
                      type="button"
                      onClick={() => setShowPayment(false)}
                      className="w-8 h-8 rounded hover:bg-slate-50 flex items-center justify-center transition-colors"
                    >
                      <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  <div className="px-5 py-4 space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <div className="text-slate-600">Purchase Price</div>
                      <div className="font-semibold">
                        ${ (Number(selected.price) || 0).toLocaleString(undefined, { minimumFractionDigits: 2 }) }
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-sm">
                      <div className="text-slate-600">Interest Rate</div>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          inputMode="decimal"
                          placeholder="0"
                          value={interestRateStr}
                          onChange={(e) => {
                            let v = e.target.value.replace(/[^\d.]/g, '')
                            const firstDot = v.indexOf('.')
                            if (firstDot !== -1) {
                              v = v.slice(0, firstDot + 1) + v.slice(firstDot + 1).replace(/\./g, '')
                            }
                            v = v.replace(/^0+(?=\d)/, '')
                            setInterestRateStr(v)
                          }}
                          className="edc-input w-24 text-right"
                        />
                        <span className="text-slate-500">%</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-sm">
                      <div className="text-slate-600">Down Payment</div>
                      <input
                        type="text"
                        inputMode="decimal"
                        placeholder="0"
                        value={downPaymentStr}
                        onChange={(e) => {
                          let v = e.target.value.replace(/[^\d.]/g, '')
                          const firstDot = v.indexOf('.')
                          if (firstDot !== -1) {
                            v = v.slice(0, firstDot + 1) + v.slice(firstDot + 1).replace(/\./g, '')
                          }
                          v = v.replace(/^0+(?=\d)/, '')
                          setDownPaymentStr(v)
                        }}
                        className="edc-input w-32 text-right"
                      />
                    </div>

                    <div className="border-t border-slate-200/60 pt-3">
                      <div className="text-center text-cyan-600 font-semibold mb-2">Payment Details</div>
                      <div className="text-center text-2xl font-bold mb-3">Payment ${payment.toFixed(2)}</div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <div className="text-xs text-slate-500 mb-1">Term</div>
                          <select
                            value={termMonths}
                            onChange={(e) => setTermMonths(Number(e.target.value))}
                            className="w-full edc-input"
                          >
                            {[6, 12, 18, 24, 30, 36, 42, 48, 54, 60, 66, 72, 78, 84, 90, 96].map((m) => (
                              <option key={m} value={m}>
                                {m}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <div className="text-xs text-slate-500 mb-1">Frequency</div>
                          <select
                            value={frequency}
                            onChange={(e) => setFrequency(e.target.value as any)}
                            className="w-full edc-input"
                          >
                            {['Monthly', 'Bi-Weekly', 'Weekly', 'Semi-Monthly'].map((f) => (
                              <option key={f} value={f}>
                                {f}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>

                    <div className="pt-2 flex justify-end">
                      <button
                        type="button"
                        className="h-9 px-4 rounded bg-green-600 text-white text-sm font-semibold"
                        onClick={() => setShowPayment(false)}
                      >
                        BUY NOW
                      </button>
                    </div>
                  </div>
                </div>
              </div>,
              document.body
            )
          : null}

        {/* Disclosure Modal */}
        {mounted && disclosureModal.open
          ? createPortal(
              <div className="fixed inset-0 z-[10001] flex items-center justify-center p-4 overflow-y-auto">
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setDisclosureModal({ open: false, loading: false, title: '', body: '' })} />
                <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-8 flex flex-col max-h-[90vh]">
                  <div className="flex items-center justify-between px-6 py-4 border-b border-amber-200 bg-amber-50 rounded-t-2xl flex-shrink-0">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-amber-100 text-amber-700 rounded-full flex items-center justify-center">
                        <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                      </div>
                      <div>
                        <h2 className="text-lg font-bold text-amber-800">{disclosureModal.title || 'Important Disclosure'}</h2>
                        <p className="text-sm text-amber-700">Please Read Carefully</p>
                      </div>
                    </div>
                    <button onClick={() => setDisclosureModal({ open: false, loading: false, title: '', body: '' })} className="p-2 hover:bg-amber-100 rounded-xl transition-colors">
                      <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <div className="overflow-y-auto flex-1 p-6">
                    {disclosureModal.loading ? (
                      <div className="flex items-center justify-center py-10 gap-2 text-slate-400">
                        <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" /></svg>
                        <span className="text-sm">Loading disclosure…</span>
                      </div>
                    ) : (
                      <div className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                        {disclosureModal.body || 'No disclosure content available.'}
                      </div>
                    )}
                  </div>
                  <div className="px-6 py-4 border-t border-gray-200 flex-shrink-0">
                    <button onClick={() => setDisclosureModal({ open: false, loading: false, title: '', body: '' })} className="w-full bg-amber-500 hover:bg-amber-600 text-white font-semibold py-3 rounded-xl transition-colors">I Understand</button>
                  </div>
                </div>
              </div>,
              document.body
            )
          : null}

        {/* CARFAX Modal */}
        {mounted && carfaxModal.open
          ? createPortal(
              <div className="fixed inset-0 z-[10001] flex items-center justify-center p-4 bg-black/60">
                <div className="w-full max-w-4xl bg-white rounded-2xl shadow-xl flex flex-col" style={{ height: '90vh' }}>
                  <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0">
                    <h3 className="text-base font-semibold text-gray-900">CARFAX Report</h3>
                    <div className="flex items-center gap-3">
                      {carfaxModal.files.length > 1 && (
                        <div className="flex gap-1">
                          {carfaxModal.files.map((f, i) => (
                            <button key={f.path} type="button" onClick={() => setCarfaxModal(prev => ({ ...prev, activeIndex: i }))}
                              className={`px-3 py-1 text-xs rounded-full border transition-colors ${carfaxModal.activeIndex === i ? 'bg-red-600 text-white border-red-600' : 'text-gray-600 border-gray-300 hover:border-red-400'}`}>
                              File {i + 1}
                            </button>
                          ))}
                        </div>
                      )}
                      {carfaxModal.files.length > 0 && (
                        <a href={carfaxModal.files[carfaxModal.activeIndex]?.publicUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-blue-600 hover:underline">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                          Open in new tab
                        </a>
                      )}
                      <button type="button" onClick={() => setCarfaxModal({ open: false, loading: false, files: [], activeIndex: 0 })} className="text-gray-400 hover:text-gray-600 ml-1">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </div>
                  </div>
                  <div className="flex-1 min-h-0">
                    {carfaxModal.loading ? (
                      <div className="flex items-center justify-center h-full gap-2 text-gray-400">
                        <svg className="w-6 h-6 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" /></svg>
                        <span className="text-sm">Loading report…</span>
                      </div>
                    ) : carfaxModal.files.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full">
                        <svg className="w-14 h-14 text-gray-200 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                        <p className="text-sm font-semibold text-gray-500">No CARFAX Report Uploaded</p>
                        <p className="text-xs text-gray-400 mt-1">No report has been uploaded for this vehicle yet.</p>
                      </div>
                    ) : (
                      <iframe src={carfaxModal.files[carfaxModal.activeIndex]?.publicUrl} className="w-full h-full rounded-b-2xl" title="CARFAX Report" />
                    )}
                  </div>
                </div>
              </div>,
              document.body
            )
          : null}
      </div>
    </div>
  )
}

function Row({ label, value, bold, highlight }: { label: string; value: string; bold?: boolean; highlight?: boolean }) {
  return (
    <div className={`flex items-center justify-between px-5 py-3 ${highlight ? 'bg-white' : ''}`}>
      <div className={`${bold ? 'font-semibold text-slate-800' : 'text-slate-600'} text-sm`}>{label}</div>
      <div className={`${bold ? 'font-semibold text-slate-800' : 'text-slate-600'} text-sm`}>{value}</div>
    </div>
  )
}
