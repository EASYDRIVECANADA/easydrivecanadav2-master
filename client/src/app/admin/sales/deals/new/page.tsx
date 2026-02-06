'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'

import CustomersTabNew from './CustomersTabNew'
import DeliveryTab from './DeliveryTab'
import DisclosuresTab from './DisclosuresTab'
import VehiclesTab from './VehiclesTab'
import WorksheetTab from './WorksheetTab'

type DealTab = 'customers' | 'vehicles' | 'worksheet' | 'disclosures' | 'delivery'

export default function SalesNewDealPage() {
  const searchParams = useSearchParams()
  const editDealId = searchParams.get('dealId') // present when editing an existing deal
  const vehicleId = searchParams.get('vehicleId') // present when coming from showroom

  const [activeTab, setActiveTab] = useState<DealTab>(vehicleId ? 'vehicles' : 'customers')
  const [dealId] = useState(() => {
    // If editing, reuse the existing dealId from the URL
    if (typeof window !== 'undefined' && editDealId) return editDealId
    try {
      const key = 'edc_deal_id_counter'
      const raw = typeof window !== 'undefined' ? window.localStorage.getItem(key) : null
      const next = (raw ? parseInt(raw, 10) : 0) + 1
      if (typeof window !== 'undefined') window.localStorage.setItem(key, String(next))
      return String(next)
    } catch {
      return String(Date.now())
    }
  })
  const [isRetail, setIsRetail] = useState(true)
  const [dealDate, setDealDate] = useState('2026-02-03')
  const [dealType, setDealType] = useState<'Cash' | 'Finance'>('Cash')

  // Prefill data fetched from the database when editing
  const [prefill, setPrefill] = useState<any>(null)
  const [vehiclePrefill, setVehiclePrefill] = useState<any>(null)
  const [vehiclePrefillLoading, setVehiclePrefillLoading] = useState(false)
  const [prefillLoading, setPrefillLoading] = useState(false)

  // Track whether auto-save has fired for showroom prefill
  const autoSaveRan = useRef(false)
  const [autoSavedVehicles, setAutoSavedVehicles] = useState(false)
  const [autoSavedWorksheet, setAutoSavedWorksheet] = useState(false)
  const [autoSavedDisclosures, setAutoSavedDisclosures] = useState(false)

  const fetchPrefill = useCallback(async () => {
    if (!editDealId) return
    try {
      setPrefillLoading(true)
      const res = await fetch(`/api/deals/${encodeURIComponent(editDealId)}`)
      if (!res.ok) throw new Error(`Failed to fetch deal (${res.status})`)
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setPrefill(data)
      // Set top-level fields from customer data
      const c = data.customer
      if (c) {
        if (c.dealdate) setDealDate(c.dealdate)
        if (c.dealtype) setDealType(c.dealtype === 'Finance' ? 'Finance' : 'Cash')
        if (c.dealmode) setIsRetail(c.dealmode === 'RTL')
      }
    } catch (e) {
      console.error('[Prefill] Error:', e)
    } finally {
      setPrefillLoading(false)
    }
  }, [editDealId])

  const fetchVehiclePrefill = useCallback(async () => {
    if (!vehicleId) return
    try {
      setVehiclePrefillLoading(true)
      const res = await fetch(`/api/vehicles/${encodeURIComponent(vehicleId)}`, { cache: 'no-store' })
      if (!res.ok) throw new Error(`Failed to fetch vehicle (${res.status})`)
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setVehiclePrefill(data)
    } catch (e) {
      console.error('[Vehicle Prefill] Error:', e)
    } finally {
      setVehiclePrefillLoading(false)
    }
  }, [vehicleId])

  useEffect(() => {
    fetchPrefill()
  }, [fetchPrefill])

  useEffect(() => {
    fetchVehiclePrefill()
  }, [fetchVehiclePrefill])

  // Auto-save prefilled data to Supabase on first load when coming from showroom
  useEffect(() => {
    if (!vehiclePrefill?.vehicle || autoSaveRan.current) return
    autoSaveRan.current = true
    const v = vehiclePrefill.vehicle
    const currentDealId = dealId

    // 1) Auto-save Vehicles via webhook
    const vehiclePayload = {
      dealId: currentDealId,
      selectedVehicle: {
        id: v.id ?? null,
        year: v.year ?? null,
        make: v.make ?? null,
        model: v.model ?? null,
        trim: v.trim ?? null,
        vin: v.vin ?? null,
        exteriorColor: v.exterior_color ?? null,
        interiorColor: v.interior_color ?? null,
        odometer: v.odometer ?? v.mileage ?? null,
        odometerUnit: v.odometer_unit ?? null,
        status: v.status ?? null,
        stockNumber: v.stock_number ?? null,
      },
    }
    fetch('https://primary-production-6722.up.railway.app/webhook/vehicles-deals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(vehiclePayload),
    })
      .then((r) => r.text())
      .then((t) => {
        console.log('[Auto-save Vehicles] Response:', t)
        setAutoSavedVehicles(true)
      })
      .catch((e) => console.error('[Auto-save Vehicles] Error:', e))

    // 2) Auto-save Worksheet via webhook
    const purchase = vehiclePrefill.purchase
    const worksheetPayload = {
      dealId: currentDealId,
      dealType: 'Cash',
      dealDate: dealDate,
      dealMode: 'RTL',
      purchasePrice: String(v.price ?? '0'),
      discount: '0',
      subtotal: String(v.price ?? '0'),
      tradeValue: '0',
      actualCashValue: '0',
      netDifference: '0',
      taxCode: 'HST',
      taxRate: '0.13',
      taxOverride: false,
      taxManual: '0',
      totalTax: String(Number(v.price ?? 0) * 0.13),
      lienPayout: '0',
      tradeEquity: '0',
      licenseFee: purchase?.license_fee ?? '',
      newPlates: false,
      renewalOnly: false,
      totalBalanceDue: String(Number(v.price ?? 0) * 1.13),
      fees: [],
      accessories: [],
      warranties: [],
      insurances: [],
      payments: [],
    }
    fetch('https://primary-production-6722.up.railway.app/webhook/worksheet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(worksheetPayload),
    })
      .then((r) => r.text())
      .then((t) => {
        console.log('[Auto-save Worksheet] Response:', t)
        setAutoSavedWorksheet(true)
      })
      .catch((e) => console.error('[Auto-save Worksheet] Error:', e))

    // 3) Auto-save Disclosures via webhook (if disclosures data exists)
    const disc = vehiclePrefill.disclosures
    const discHtml = Array.isArray(disc) && disc.length > 0
      ? disc.map((d: any) => `<p><strong>${d.disclosures_tittle || ''}</strong></p><p>${d.disclosures_body || ''}</p>`).join('')
      : ''
    const discPayload = {
      dealId: currentDealId,
      disclosuresHtml: discHtml || null,
      conditions: null,
    }
    fetch('/api/deals_disclosures', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(discPayload),
    })
      .then((r) => r.text())
      .then((t) => {
        console.log('[Auto-save Disclosures] Response:', t)
        setAutoSavedDisclosures(true)
      })
      .catch((e) => console.error('[Auto-save Disclosures] Error:', e))
  }, [vehiclePrefill, dealId, dealDate])

  return (
    <div className="w-full min-h-[calc(100vh-64px)] bg-gradient-to-b from-[#f6f7f9] to-[#e9eaee]">
      <div className="w-full px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-sm font-semibold text-gray-900">Retail/Wholesale</div>
            <div className="mt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsRetail((v) => !v)}
                aria-label="Toggle Retail/Wholesale"
                className="h-6 w-[58px] px-2 rounded-full border border-[#118df0] bg-white flex items-center justify-between"
              >
                {isRetail ? (
                  <>
                    <div className="text-[10px] font-semibold text-[#118df0] leading-none">RTL</div>
                    <div className="h-3 w-3 rounded-full bg-[#118df0]" />
                  </>
                ) : (
                  <>
                    <div className="h-3 w-3 rounded-full bg-[#118df0]" />
                    <div className="text-[10px] font-semibold text-[#118df0] leading-none">WHL</div>
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div>
              <div className="text-xs font-semibold text-gray-600 mb-1">Deal Date</div>
              <input
                type="date"
                value={dealDate}
                onChange={(e) => setDealDate(e.target.value)}
                className="w-full border border-gray-200 rounded px-3 py-2 text-sm bg-white"
              />
            </div>
            <div>
              <div className="text-xs font-semibold text-gray-600 mb-1">Deal Type</div>
              <select
                value={dealType}
                onChange={(e) => setDealType(e.target.value as 'Cash' | 'Finance')}
                className="w-full border border-gray-200 rounded px-3 py-2 text-sm bg-white"
              >
                <option value="Cash">Cash</option>
                <option value="Finance">Finance</option>
              </select>
            </div>
            <div className="flex items-end justify-end gap-2">
              <div className="text-xs font-semibold text-gray-600 mr-2">Reports</div>
              <button type="button" className="h-9 px-3 rounded bg-[#118df0] text-white text-sm font-semibold hover:bg-[#0d6ebd]">Email</button>
              <button type="button" className="h-9 px-3 rounded bg-[#118df0] text-white text-sm font-semibold hover:bg-[#0d6ebd]">Print</button>
            </div>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3">
          {(
            [
              { key: 'customers', label: 'Customers' },
              { key: 'vehicles', label: 'Vehicles' },
              { key: 'worksheet', label: 'Worksheet' },
              { key: 'disclosures', label: 'Disclosures' },
              { key: 'delivery', label: 'Delivery' },
            ] as const
          ).map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setActiveTab(t.key)}
              className={
                activeTab === t.key
                  ? 'h-10 px-4 rounded bg-[#118df0] text-white text-sm font-semibold'
                  : 'h-10 px-4 rounded bg-white/70 text-gray-700 text-sm font-semibold hover:bg-white'
              }
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="mt-4">
          {prefillLoading ? (
            <div className="bg-white rounded-xl shadow p-8 text-center text-gray-500 text-sm">Loading deal data...</div>
          ) : (
            <>
              {activeTab === 'customers' && (
                <CustomersTabNew
                  hideAddButton={!isRetail}
                  dealId={dealId}
                  dealDate={dealDate}
                  dealType={dealType}
                  dealMode={isRetail ? 'RTL' : 'WHL'}
                  onSaved={() => setActiveTab('vehicles')}
                  initialData={prefill?.customer ?? null}
                />
              )}
              {activeTab === 'vehicles' && (
                <VehiclesTab
                  dealId={dealId}
                  onSaved={() => setActiveTab('worksheet')}
                  initialData={prefill?.vehicles ?? null}
                  autoSaved={autoSavedVehicles}
                  prefillSelected={vehiclePrefill?.vehicle ? {
                    id: vehiclePrefill.vehicle.id,
                    year: vehiclePrefill.vehicle.year,
                    make: vehiclePrefill.vehicle.make,
                    model: vehiclePrefill.vehicle.model,
                    trim: vehiclePrefill.vehicle.trim,
                    vin: vehiclePrefill.vehicle.vin,
                    exterior_color: vehiclePrefill.vehicle.exterior_color,
                    interior_color: vehiclePrefill.vehicle.interior_color,
                    odometer: vehiclePrefill.vehicle.odometer ?? vehiclePrefill.vehicle.mileage,
                    odometer_unit: vehiclePrefill.vehicle.odometer_unit,
                    status: vehiclePrefill.vehicle.status,
                    stock_number: vehiclePrefill.vehicle.stock_number,
                  } : null}
                />
              )}
              {activeTab === 'worksheet' && (
                <WorksheetTab
                  dealId={dealId}
                  dealMode={isRetail ? 'RTL' : 'WHL'}
                  dealType={dealType}
                  dealDate={dealDate}
                  onSaved={() => setActiveTab('disclosures')}
                  autoSaved={autoSavedWorksheet}
                  initialData={prefill?.worksheet ?? (
                    vehiclePrefill?.vehicle ? {
                      purchase_price: String(vehiclePrefill.vehicle.price ?? '0'),
                      discount: '0',
                      tax_code: 'HST',
                      license_fee: vehiclePrefill?.purchase?.license_fee ?? '',
                      trade_value: '0',
                      actual_cash_value: '0',
                      lien_payout: '0',
                    } : null
                  )}
                />
              )}
              {activeTab === 'disclosures' && (
                <DisclosuresTab
                  dealId={dealId}
                  onSaved={() => setActiveTab('delivery')}
                  autoSaved={autoSavedDisclosures}
                  initialData={prefill?.disclosures ?? (
                    vehiclePrefill?.disclosures && vehiclePrefill.disclosures.length > 0
                      ? {
                          disclosures_html: vehiclePrefill.disclosures.map((d: any) => `<p><strong>${d.disclosures_tittle || ''}</strong></p><p>${d.disclosures_body || ''}</p>`).join(''),
                          conditions: '',
                        }
                      : null
                  )}
                />
              )}
              {activeTab === 'delivery' && (
                <DeliveryTab
                  dealId={dealId}
                  dealMode={isRetail ? 'RTL' : 'WHL'}
                  initialData={prefill?.delivery ?? null}
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
