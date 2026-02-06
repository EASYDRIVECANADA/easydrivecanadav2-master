'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

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
}

export default function CustomerShowroomPage() {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<'ALL' | ShowroomVehicle['status']>('ALL')
  const [selected, setSelected] = useState<ShowroomVehicle | null>(null)
  const [imageIdx, setImageIdx] = useState(0)
  const [viewMode, setViewMode] = useState<'TBL' | 'CRD'>('TBL')
  const [showPayment, setShowPayment] = useState(false)
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

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      try {
        setLoading(true)
        setFetchError(null)
        const res = await fetch('/api/vehicles', { cache: 'no-store' })
        const json = await res.json().catch(() => ({}))
        if (!res.ok || json.error) throw new Error(json.error || `Failed to fetch vehicles (${res.status})`)

        const vehicles = Array.isArray(json.vehicles) ? json.vehicles : []
        const mapped: ShowroomVehicle[] = vehicles.map((v: any) => {
          const year = v.year ? String(v.year) : ''
          const make = v.make || ''
          const model = v.model || ''
          const trim = v.trim || ''
          const label = [year, make, model, trim].filter(Boolean).join(' ').trim() || v.vin || ''

          const drive = (v.drivetrain || v.drive || '').toString().trim()
          const trans = (v.transmission || '').toString().trim()
          const cyl = (v.cylinders || v.cyl || '').toString().trim()
          const colour = (v.exterior_color || v.colour || '').toString().trim()
          const odo = Number(v.odometer ?? v.mileage ?? 0) || 0
          const odoUnit = (v.odometer_unit || 'km').toString().trim()
          const price = Number(v.price ?? 0) || 0
          const rawStatus = (v.status || '').toString().toLowerCase()
          const normalizedStatus: ShowroomVehicle['status'] = rawStatus.includes('pending')
            ? 'Deal Pending'
            : rawStatus.includes('sold')
              ? 'Sold'
              : 'In Stock'

          // normalize images to string array
          let imgs: string[] = []
          const rawImgs = v.images
          if (Array.isArray(rawImgs)) imgs = rawImgs.filter(Boolean).map((x: any) => String(x))
          else if (typeof rawImgs === 'string' && rawImgs.trim()) {
            try {
              const parsed = JSON.parse(rawImgs)
              if (Array.isArray(parsed)) imgs = parsed.filter(Boolean).map((x: any) => String(x))
              else imgs = rawImgs.split(',').map((s) => s.trim()).filter(Boolean)
            } catch {
              imgs = rawImgs.split(',').map((s) => s.trim()).filter(Boolean)
            }
          }

          // if images are base64 (no scheme), prefix with data:image/jpeg
          const imgsNormalized = imgs
            .map((s) => s.startsWith('data:image') ? s : (s ? `data:image/jpeg;base64,${s}` : ''))
            .filter(Boolean)

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
            stock: (v.stock_number || '').toString().trim() || undefined,
            features: feats,
          }
        })

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
    <div className="w-full">
      <div className="bg-white shadow">
        <div className="w-full px-4 sm:px-6 lg:px-8 py-4">
          <h1 className="text-2xl font-bold text-gray-900">Customer Showroom</h1>
          <p className="text-sm text-gray-500">Vehicles from Supabase (edc_vehicles)</p>
        </div>
      </div>

      <div className="w-full px-4 sm:px-6 lg:px-8 py-6">
        <div className="bg-white rounded-xl shadow p-4">
          <div className="flex flex-col lg:flex-row lg:items-center gap-3">
            {/* View toggle */}
            <div className="flex items-center gap-2 text-sm text-gray-700">
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
                  className="w-full border border-gray-200 rounded-lg px-10 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent"
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
                className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent"
              >
                <option value="ALL">All Status</option>
                <option value="In Stock">In Stock</option>
                <option value="Deal Pending">Deal Pending</option>
                <option value="Sold">Sold</option>
              </select>
            </div>

            <div className="text-sm text-gray-500 whitespace-nowrap">Showing {filtered.length} of {rows.length}</div>
          </div>

          {fetchError ? (
            <div className="mt-3 text-sm text-red-600">{fetchError}</div>
          ) : null}
        </div>

        {viewMode === 'TBL' ? (
        <div className="bg-white rounded-xl shadow mt-4 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left text-xs font-semibold text-gray-600 uppercase tracking-wider px-3 py-3 w-12"></th>
                  <th className="text-left text-xs font-semibold text-gray-600 uppercase tracking-wider px-6 py-3">Vehicle</th>
                  <th className="text-left text-xs font-semibold text-gray-600 uppercase tracking-wider px-6 py-3">Drive</th>
                  <th className="text-left text-xs font-semibold text-gray-600 uppercase tracking-wider px-6 py-3">Trans.</th>
                  <th className="text-left text-xs font-semibold text-gray-600 uppercase tracking-wider px-6 py-3">Cyl.</th>
                  <th className="text-left text-xs font-semibold text-gray-600 uppercase tracking-wider px-6 py-3">Colour</th>
                  <th className="text-right text-xs font-semibold text-gray-600 uppercase tracking-wider px-6 py-3">Odometer</th>
                  <th className="text-right text-xs font-semibold text-gray-600 uppercase tracking-wider px-6 py-3">Price</th>
                  <th className="text-right text-xs font-semibold text-gray-600 uppercase tracking-wider px-6 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td className="px-6 py-10 text-center text-sm text-gray-500" colSpan={9}>
                      Loading...
                    </td>
                  </tr>
                ) : null}

                {filtered.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-3 py-3">
                      <button
                        type="button"
                        onClick={() => { setSelected(r); setImageIdx(0) }}
                        className="w-9 h-9 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
                        title="Open deal sheet"
                        aria-label="Open deal sheet"
                      >
                        <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13l-1.2 6H18M7 13l-1.6-8M9 21a1 1 0 100-2 1 1 0 000 2zm10 0a1 1 0 100-2 1 1 0 000 2z"
                          />
                        </svg>
                      </button>
                    </td>
                    <td className="px-6 py-3 text-sm font-medium text-[#118df0] whitespace-nowrap">{r.vehicle}</td>
                    <td className="px-6 py-3 text-sm text-gray-700 whitespace-nowrap">{r.drive}</td>
                    <td className="px-6 py-3 text-sm text-gray-700 whitespace-nowrap">{r.transmission}</td>
                    <td className="px-6 py-3 text-sm text-gray-700 whitespace-nowrap">{r.cyl}</td>
                    <td className="px-6 py-3 text-sm text-gray-700 whitespace-nowrap">{r.colour}</td>
                    <td className="px-6 py-3 text-sm text-gray-700 whitespace-nowrap text-right">{r.odometerKm.toLocaleString()} km</td>
                    <td className="px-6 py-3 text-sm text-gray-900 whitespace-nowrap text-right">${r.price.toLocaleString()}</td>
                    <td className="px-6 py-3 text-sm whitespace-nowrap text-right">
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                          r.status === 'In Stock'
                            ? 'bg-green-100 text-green-700'
                            : r.status === 'Deal Pending'
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {r.status}
                      </span>
                    </td>
                  </tr>
                ))}

                {filtered.length === 0 ? (
                  <tr>
                    <td className="px-6 py-10 text-center text-sm text-gray-500" colSpan={9}>
                      No results.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
        ) : (
        <div className="bg-white rounded-xl shadow mt-4">
          <ul role="list" className="divide-y divide-gray-100">
            {loading ? (
              <li className="px-4 py-10 text-center text-sm text-gray-500">Loading...</li>
            ) : null}
            {filtered.map((r) => (
              <li key={r.id} className="p-4 hover:bg-gray-50">
                <div className="flex items-start gap-4">
                  <div className="w-40 h-28 bg-gray-100 rounded-lg border border-gray-200 flex items-center justify-center overflow-hidden">
                    {Array.isArray(r.images) && r.images.length > 0 ? (
                      <img src={r.images[0]} alt={r.vehicle} className="w-full h-full object-cover" />
                    ) : (
                      <svg className="w-10 h-10 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4-4a3 5 0 013 0l4 4M14 14l1-1a3 5 0 013 0l2 2" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
                      </svg>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <button type="button" className="text-sm font-semibold text-[#118df0] hover:underline truncate text-left" onClick={() => { setSelected(r); setImageIdx(0) }}>{r.vehicle}</button>
                      <div className="text-lg font-bold text-gray-900">${r.price.toLocaleString()}</div>
                    </div>
                    <div className="mt-1 text-xs text-gray-600">
                      {r.odometerKm.toLocaleString()} kms <span className="text-gray-400">•</span> {r.drive} <span className="text-gray-400">•</span> {r.transmission}
                    </div>
                    <div className="mt-1 text-[11px] text-gray-500">Status: {r.status}</div>
                    <div className="mt-2 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => { setSelected(r); setImageIdx(0) }}
                        className="h-8 px-3 rounded bg-gray-100 hover:bg-gray-200 text-xs font-semibold"
                      >
                        Open
                      </button>
                      <button
                        type="button"
                        onClick={() => router.push(`/admin/sales/deals/new?vehicleId=${encodeURIComponent(r.id)}`)}
                        className="h-8 px-3 rounded bg-green-600 hover:bg-green-700 text-white text-xs font-semibold"
                      >
                        BUY NOW
                      </button>
                    </div>
                  </div>
                </div>
              </li>
            ))}
            {filtered.length === 0 && !loading ? (
              <li className="px-4 py-10 text-center text-sm text-gray-500">No results.</li>
            ) : null}
          </ul>
        </div>
        )}

        {/* Filters Drawer Toggle */}
        <button
          type="button"
          onClick={() => setFiltersOpen(true)}
          className="fixed right-0 top-1/2 -translate-y-1/2 z-40 bg-white border border-gray-300 rounded-l px-2 py-3 shadow"
          style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
        >
          Filters
        </button>

        {/* Filters Drawer */}
        {filtersOpen && (
          <div className="fixed top-0 right-0 h-full w-[320px] bg-white border-l border-gray-200 shadow-2xl z-50 overflow-y-auto">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <div className="text-sm font-semibold">Filters</div>
              <button type="button" onClick={() => setFiltersOpen(false)} className="w-8 h-8 rounded hover:bg-gray-100 flex items-center justify-center">
                <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="px-4 py-4 space-y-5 text-sm">
              {/* Year Range */}
              <div>
                <div className="text-center font-semibold mb-2">Year Range</div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <div className="text-xs text-gray-600 mb-1">From</div>
                    <select value={yearFrom} onChange={(e)=>setYearFrom(e.target.value?Number(e.target.value):'')} className="w-full border rounded px-2 py-1">
                      <option value="">Start Year</option>
                      {Array.from({length: (facets.maxYear - facets.minYear + 1)||0}, (_,i)=>facets.minYear+i).map(y => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <div className="text-xs text-gray-600 mb-1">To</div>
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
                  <button className="bg-[#118df0] hover:bg-blue-600 text-white text-xs font-semibold rounded px-3 py-2">Makes ▾</button>
                </div>
                <select value={makeSel} onChange={(e)=>setMakeSel(e.target.value)} className="w-full border rounded px-2 py-1">
                  <option value="">All Makes</option>
                  {facets.makes.map(m => (<option key={m} value={m}>{m}</option>))}
                </select>
                <div className="text-center">
                  <button className="bg-[#118df0] hover:bg-blue-600 text-white text-xs font-semibold rounded px-3 py-2">Models ▾</button>
                </div>
                <select value={modelSel} onChange={(e)=>setModelSel(e.target.value)} className="w-full border rounded px-2 py-1">
                  <option value="">All Models</option>
                  {facets.models.map(m => (<option key={m} value={m}>{m}</option>))}
                </select>
              </div>

              {/* Actions (top) */}
              <div className="flex items-center justify-center gap-2">
                <button type="button" onClick={()=>setFiltersOpen(false)} className="h-8 px-4 rounded bg-green-600 text-white text-xs font-semibold">Search</button>
                <button type="button" onClick={resetFilters} className="h-8 px-4 rounded bg-red-600 text-white text-xs font-semibold">Reset</button>
                <button type="button" className="h-8 px-4 rounded bg-[#118df0] text-white text-xs font-semibold">Compare</button>
              </div>

              {/* Price Range */}
              <div>
                <div className="font-semibold mb-2">Price Range</div>
                <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
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
                <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
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
                <button className="bg-[#118df0] hover:bg-blue-600 text-white text-xs font-semibold rounded px-3 py-2">Body ▾</button>
              </div>

              {/* Options/Colours headers (visual only) */}
              <div className="text-center">
                <button className="bg-[#118df0] hover:bg-blue-600 text-white text-xs font-semibold rounded px-3 py-2">Options ▾</button>
              </div>
              <div className="text-center">
                <button className="bg-[#118df0] hover:bg-blue-600 text-white text-xs font-semibold rounded px-3 py-2">Colours ▾</button>
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
        {selected ? (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            role="dialog"
            aria-modal="true"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) setSelected(null)
            }}
          >
            <div className="w-full max-w-5xl bg-white rounded-2xl shadow-xl overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <button
                  type="button"
                  className="text-sm font-semibold text-[#118df0] hover:underline"
                  onClick={() => setSelected(null)}
                >
                  ← Showroom
                </button>
                <button
                  type="button"
                  className="w-10 h-10 rounded-xl hover:bg-gray-100 flex items-center justify-center"
                  onClick={() => setSelected(null)}
                  aria-label="Close"
                >
                  <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2">
                <div className="bg-gray-100 p-6 flex flex-col">
                  <div className="flex-1 rounded-xl bg-white border border-gray-200 flex items-center justify-center relative overflow-hidden">
                    {Array.isArray(selected.images) && selected.images.length > 0 ? (
                      <img
                        src={selected.images[Math.min(imageIdx, selected.images.length - 1)]}
                        alt={selected.vehicle}
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <div className="text-center">
                        <svg className="w-20 h-20 text-gray-300 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4-4a3 5 0 013 0l4 4M14 14l1-1a3 5 0 013 0l2 2" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
                        </svg>
                        <div className="text-gray-400 text-sm font-semibold">NO IMAGE AVAILABLE</div>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => setImageIdx((i) => (selected.images && selected.images.length ? (i - 1 + selected.images.length) % selected.images.length : 0))}
                      className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/80 hover:bg-white flex items-center justify-center"
                      disabled={!selected.images || selected.images.length <= 1}
                    >
                      <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => setImageIdx((i) => (selected.images && selected.images.length ? (i + 1) % selected.images.length : 0))}
                      className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/80 hover:bg-white flex items-center justify-center"
                      disabled={!selected.images || selected.images.length <= 1}
                    >
                      <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>

                  <div className="mt-4">
                    <div className="text-lg font-semibold text-gray-900">{selected.vehicle} {selected.colour}</div>
                    <div className="text-sm text-gray-600">
                      {selected.odometerKm.toLocaleString()} {selected.odoUnit || 'kms'} <span className="text-gray-400">•</span> {selected.drive}
                      <span className="text-gray-400">•</span> {selected.transmission}
                    </div>
                    {selected.vin ? (
                      <div className="text-xs text-gray-500 mt-1">VIN: {selected.vin}</div>
                    ) : null}
                    {selected.stock ? (
                      <div className="text-xs text-gray-500">Stock# {selected.stock}</div>
                    ) : null}
                  </div>
                </div>

                <div className="p-6">
                  <div className="bg-gray-50 rounded-xl border border-gray-200 overflow-hidden">
                    <div className="divide-y divide-gray-200">
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
                    <button
                      type="button"
                      onClick={() => router.push(`/admin/sales/deals/new?vehicleId=${encodeURIComponent(selected.id)}`)}
                      className="h-10 px-4 rounded-lg bg-green-600 text-white text-sm font-semibold hover:bg-green-700"
                    >
                      BUY NOW
                    </button>
                    <button type="button" onClick={() => setShowPayment(true)} className="h-10 w-10 rounded-lg bg-[#118df0] text-white flex items-center justify-center" aria-label="Payment details">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6h10M10 12h10M10 18h10M4 6h.01M4 12h.01M4 18h.01" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {showPayment && selected ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) setShowPayment(false) }}>
            <div className="w-full max-w-md bg-white rounded-xl shadow-xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <div className="text-lg font-semibold">Payment</div>
                <button type="button" onClick={() => setShowPayment(false)} className="w-8 h-8 rounded hover:bg-gray-100 flex items-center justify-center">
                  <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>

              <div className="px-5 py-4 space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <div className="text-gray-600">Purchase Price</div>
                  <div className="font-semibold">${(Number(selected.price) || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <div className="text-gray-600">Interest Rate</div>
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
                      className="w-24 border border-gray-200 rounded px-2 py-1 text-right"
                    />
                    <span className="text-gray-600">%</span>
                  </div>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <div className="text-gray-600">Down Payment</div>
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
                    className="w-32 border border-gray-200 rounded px-2 py-1 text-right"
                  />
                </div>

                <div className="border-t border-gray-200 pt-3">
                  <div className="text-center text-[#118df0] font-semibold mb-2">Payment Details</div>
                  <div className="text-center text-2xl font-bold mb-3">Payment ${payment.toFixed(2)}</div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="text-xs text-gray-600 mb-1">Term</div>
                      <select value={termMonths} onChange={(e) => setTermMonths(Number(e.target.value))} className="w-full border border-gray-200 rounded px-2 py-2">
                        {[6,12,18,24,30,36,42,48,54,60,66,72,78,84,90,96].map(m => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <div className="text-xs text-gray-600 mb-1">Frequency</div>
                      <select value={frequency} onChange={(e) => setFrequency(e.target.value as any)} className="w-full border border-gray-200 rounded px-2 py-2">
                        {['Monthly','Bi-Weekly','Weekly','Semi-Monthly'].map(f => (
                          <option key={f} value={f}>{f}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <button type="button" className="h-9 px-4 rounded bg-green-600 text-white text-sm font-semibold" onClick={() => setShowPayment(false)}>BUY NOW</button>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}

function Row({ label, value, bold, highlight }: { label: string; value: string; bold?: boolean; highlight?: boolean }) {
  return (
    <div className={`flex items-center justify-between px-5 py-3 ${highlight ? 'bg-white' : ''}`}>
      <div className={`${bold ? 'font-semibold text-gray-900' : 'text-gray-700'} text-sm`}>{label}</div>
      <div className={`${bold ? 'font-semibold text-gray-900' : 'text-gray-700'} text-sm`}>{value}</div>
    </div>
  )
}
