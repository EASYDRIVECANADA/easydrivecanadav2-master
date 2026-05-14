'use client'

import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import jsPDF from 'jspdf'
import { useRouter, useSearchParams } from 'next/navigation'

import CustomersTabNew, { type CustomersTabHandle } from './CustomersTabNew'
import DeliveryTab from './DeliveryTab'
import DisclosuresTab from './DisclosuresTab'
import VehiclesTab, { type VehiclesTabHandle } from './VehiclesTab'
import WorksheetTab, { type WorksheetTabHandle } from './WorksheetTab'
import { renderBillOfSalePdf, type BillOfSaleData } from './billOfSalePdf'
import { buildBillOfSaleCustomerFields } from './billOfSaleCustomers'
import { buildBillOfSaleSettlement } from './billOfSaleSettlement'
import { renderDisclosureFormPdf } from './disclosureFormPdf'
import { supabase } from '@/lib/supabaseClient'

type DealTab = 'customers' | 'drivers-license' | 'vehicles' | 'worksheet' | 'disclosures' | 'delivery'
type ExtendedWarrantyData = NonNullable<BillOfSaleData['extendedWarrantyData']>

function SalesNewDealPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const editDealId = searchParams.get('dealId') // present when editing an existing deal
  const vehicleId = searchParams.get('vehicleId') // present when coming from showroom

  const formMode: 'create' | 'edit' = editDealId ? 'edit' : 'create'

  // Store initial vehicleId to only affect first load
  const [initialVehicleId] = useState(vehicleId)
  const [activeTab, setActiveTab] = useState<DealTab>('customers')
  const [unlockedTabs, setUnlockedTabs] = useState<Set<DealTab>>(() =>
    new Set<DealTab>(['customers', 'drivers-license', 'vehicles', 'worksheet', 'disclosures', 'delivery'])
  )
  const unlockTab = (tab: DealTab) => {
    setUnlockedTabs(prev => new Set(Array.from(prev).concat(tab)))
  }
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
  const [dealDate, setDealDate] = useState(() => {
    const d = new Date()
    const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    return local.toISOString().slice(0, 10)
  })
  const [dealType, setDealType] = useState<'Cash' | 'Finance'>('Cash')

  // Prefill data fetched from the database when editing
  const [prefill, setPrefill] = useState<any>(null)
  const [vehiclePrefill, setVehiclePrefill] = useState<any>(null)
  const [vehiclePrefillLoading, setVehiclePrefillLoading] = useState(false)
  // Start as true in edit mode so CustomersTabNew only mounts after data is loaded
  const [prefillLoading, setPrefillLoading] = useState(() => Boolean(editDealId))
  const [dealHasSignature, setDealHasSignature] = useState(false)
  const [selectedVehicleData, setSelectedVehicleData] = useState<any>(null)

  // Print dropdown & Documents Preview modal
  const [showPrintMenu, setShowPrintMenu] = useState(false)
  const [printBillOfSale, setPrintBillOfSale] = useState(true)
  const [printDisclosure, setPrintDisclosure] = useState(false)
  const [showDocPreview, setShowDocPreview] = useState(false)
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null)
  const [pdfObjectUrl, setPdfObjectUrl] = useState<string | null>(null)
  const [pdfLoading, setPdfLoading] = useState(false)
  const [emailLoading, setEmailLoading] = useState(false)
  const printMenuRef = useRef<HTMLDivElement>(null)
  const vehiclesTabRef = useRef<VehiclesTabHandle>(null)
  const customersTabRef = useRef<CustomersTabHandle>(null)
  const worksheetTabRef = useRef<WorksheetTabHandle>(null)

  const [esignModalOpen, setEsignModalOpen] = useState(false)
  const [esignModalTitle, setEsignModalTitle] = useState('')
  const [esignModalBody, setEsignModalBody] = useState('')
  const [esignModalBlocking, setEsignModalBlocking] = useState(false)
  const esignModalResolverRef = useRef<((v: boolean) => void) | null>(null)

  const openEsignModal = (opts: { title: string; body: string; blocking: boolean }) => {
    setEsignModalTitle(opts.title)
    setEsignModalBody(opts.body)
    setEsignModalBlocking(opts.blocking)
    setEsignModalOpen(true)
  }

  const confirmEsignChargeIfNeeded = async (senderEmail: string) => {
    try {
      if (!senderEmail) return true
      const res = await fetch('/api/esign/wallet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: senderEmail }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) throw new Error(String(json?.error || 'Unable to check E‑Signature credits'))

      // Premier users get unlimited access - no modals or charges
      if (json?.premier_unlimited === true) {
        return true
      }

      const credits = Number(json?.esign_credits ?? 0)
      const balance = Number(json?.balance ?? 0)
      const unlimitedUntilRaw = (json as any)?.esign_unlimited_until ?? null
      const safeCredits = Number.isFinite(credits) ? credits : 0
      const safeBalance = Number.isFinite(balance) ? balance : 0

      try {
        const until = unlimitedUntilRaw ? new Date(String(unlimitedUntilRaw)) : null
        if (until && !Number.isNaN(until.getTime()) && until.getTime() > Date.now()) {
          return true
        }
      } catch {
        // ignore
      }

      if (safeCredits > 0) return true

      if (safeBalance < 3) {
        openEsignModal({
          title: 'No E‑Signature Credits',
          body: `You have 0 E‑Signature credits and your Load Balance is too low to send this request. Please top up your balance or buy the bundle.`,
          blocking: true,
        })
        return false
      }

      return await new Promise<boolean>((resolve) => {
        esignModalResolverRef.current = resolve
        openEsignModal({
          title: 'No E‑Signature Credits',
          body: `You have 0 E‑Signature credits. Sending this request will charge $3.00 from your Load Balance. Do you want to continue?`,
          blocking: false,
        })
      })
    } catch (e) {
      openEsignModal({
        title: 'E‑Signature Error',
        body: String((e as any)?.message || e || 'Unable to check E‑Signature credits.'),
        blocking: true,
      })
      return false
    }
  }

  // Auto-save removed - prefill data will display but not save until user clicks Save

  const parseJsonLoose = (v: any) => {
    if (!v) return null
    if (typeof v === 'object') return v
    if (typeof v !== 'string') return null
    const s = v.trim()
    if (!s) return null
    try { return JSON.parse(s) } catch { return null }
  }

  const getAdminUserId = async (): Promise<string | null> => {
    try {
      const raw = typeof window !== 'undefined' ? window.localStorage.getItem('edc_admin_session') : null
      if (!raw) return null
      const parsed = JSON.parse(raw) as { email?: string; user_id?: string }
      const directId = String(parsed?.user_id ?? '').trim()
      if (directId) return directId
      const email = String(parsed?.email ?? '').trim().toLowerCase()
      if (!email) return null
      const { data } = await supabase.from('edc_account_verifications').select('id').eq('email', email).order('created_at', { ascending: false }).limit(1).maybeSingle()
      return (data as any)?.id ?? null
    } catch {
      return null
    }
  }

  const fetchWarrantyPresets = async (): Promise<Record<string, { duration: string; distance: string; price: string; cost: string; description: string }>> => {
    try {
      const userId = await getAdminUserId()
      if (!userId) {
        // Fallback: fetch without user_id filter (returns all, use name as key — last write wins)
        const { data } = await supabase.from('presets_warranty').select('name, duration, distance, price, cost, description')
        if (!Array.isArray(data)) return {}
        const map: Record<string, { duration: string; distance: string; price: string; cost: string; description: string }> = {}
        for (const p of data) {
          if (p.name) map[String(p.name).trim()] = { duration: p.duration || '', distance: p.distance || '', price: p.price || '', cost: p.cost || '', description: p.description || '' }
        }
        return map
      }
      const { data } = await supabase.from('presets_warranty').select('name, duration, distance, price, cost, description').eq('user_id', userId)
      if (!Array.isArray(data)) return {}
      const map: Record<string, { duration: string; distance: string; price: string; cost: string; description: string }> = {}
      for (const p of data) {
        if (p.name) map[String(p.name).trim()] = { duration: p.duration || '', distance: p.distance || '', price: p.price || '', cost: p.cost || '', description: p.description || '' }
      }
      return map
    } catch {
      return {}
    }
  }

  const toMoneyNumber = (v: any) => {
    if (v === null || v === undefined) return 0
    if (typeof v === 'number') return Number.isFinite(v) ? v : 0
    const s = String(v).trim()
    if (!s) return 0
    const cleaned = s.replace(/[^0-9.-]/g, '')
    const n = parseFloat(cleaned)
    return Number.isNaN(n) ? 0 : n
  }

  const getVehicleSellPrice = (veh: any) => {
    const costs1 = parseJsonLoose(veh?.costsData) || parseJsonLoose(veh?.costs_data) || parseJsonLoose(veh?.costs_data_json)
    const costs2 = parseJsonLoose(veh?.costs_data)
    const purchaseData = parseJsonLoose(veh?.purchaseData) || parseJsonLoose(veh?.purchase_data)

    const candidates = [
      veh?.saleprice,
      veh?.sale_price,
      veh?.salePrice,
      veh?.listPrice,
      veh?.listprice,
      veh?.list_price,
      costs1?.salePrice,
      costs1?.saleprice,
      costs1?.sale_price,
      costs1?.listPrice,
      costs1?.listprice,
      costs1?.list_price,
      costs2?.salePrice,
      costs2?.saleprice,
      costs2?.sale_price,
      costs2?.listPrice,
      costs2?.listprice,
      costs2?.list_price,
      purchaseData?.vehiclePrice,
      purchaseData?.vehicle_price,
      veh?.price,
    ]

    for (const c of candidates) {
      const n = toMoneyNumber(c)
      if (n > 0) return n
    }
    return 0
  }

  const fetchPrefill = useCallback(async () => {
    if (!editDealId) return
    try {
      setPrefillLoading(true)
      const res = await fetch(`/api/deals/${encodeURIComponent(editDealId)}`)
      if (!res.ok) throw new Error(`Failed to fetch deal (${res.status})`)
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setPrefill(data)
      setDealHasSignature(Boolean(data?.customers?.[0]?.signature || data?.customer?.signature))
      // Set top-level fields from first customer
      const c = data.customers?.[0] ?? data.customer
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

  // Fetch selected vehicle data when deal has vehicles
  useEffect(() => {
    const fetchSelectedVehicle = async () => {
      if (!dealId) return
      
      try {
        console.log('[page.tsx] Fetching deal data for dealId:', dealId)
        const res = await fetch(`/api/deals/${encodeURIComponent(dealId)}`)
        if (!res.ok) {
          console.log('[page.tsx] Deal fetch failed:', res.status)
          return
        }
        const data = await res.json()
        console.log('[page.tsx] Deal data received:', { vehicles: data?.vehicles })
        
        const vehicleData = data?.vehicles?.[0]
        const vehicleId = vehicleData?.selected_id || vehicleData?.id
        console.log('[page.tsx] Vehicle ID from deal:', vehicleId, 'vehicleData:', vehicleData)
        
        if (!vehicleId) {
          console.log('[page.tsx] No vehicle ID found in deal')
          return
        }
        
        // Fetch full vehicle details from edc_vehicles
        console.log('[page.tsx] Fetching vehicle details for ID:', vehicleId)
        const vRes = await fetch(`/api/vehicles/${encodeURIComponent(vehicleId)}`, { cache: 'no-store' })
        if (!vRes.ok) {
          console.log('[page.tsx] Vehicle fetch failed:', vRes.status)
          return
        }
        const vData = await vRes.json()
        
        if (vData?.vehicle) {
          console.log('[page.tsx] Vehicle data received:', {
            id: vData.vehicle.id,
            saleprice: vData.vehicle.saleprice,
            price: vData.vehicle.price,
            stock_number: vData.vehicle.stock_number
          })
          setSelectedVehicleData(vData.vehicle)
        }
      } catch (e) {
        console.error('[Selected Vehicle Fetch] Error:', e)
      }
    }
    
    fetchSelectedVehicle()
  }, [dealId, activeTab])

  // Clear URL params immediately to prevent navigation issues
  useEffect(() => {
    if (initialVehicleId && typeof window !== 'undefined') {
      // Clear the vehicleId param from URL immediately
      const newUrl = window.location.pathname + (editDealId ? `?dealId=${editDealId}` : '')
      window.history.replaceState({}, '', newUrl)
    }
  }, [])

  // Auto-save Vehicles + Worksheet tabs when coming from Showroom BUY NOW
  const autoSaveTriggered = useRef(false)
  useEffect(() => {
    if (!initialVehicleId) return
    if (autoSaveTriggered.current) return
    if (vehiclePrefillLoading || !vehiclePrefill?.vehicle) return
    autoSaveTriggered.current = true

    const vehicle = vehiclePrefill.vehicle
    const run = async () => {
      try {
        await vehiclesTabRef.current?.saveWithVehicle(vehicle)
      } catch { /* ignore */ }
      try {
        await worksheetTabRef.current?.save(true)
      } catch { /* ignore */ }
    }
    run()
  }, [initialVehicleId, vehiclePrefillLoading, vehiclePrefill])

  // When a vehicle is selected in VehiclesTab, fetch its warranty and auto-add to worksheet
  const handleVehicleSelected = useCallback(async (vehicle: any) => {
    const vehicleId = vehicle?.id
    if (!vehicleId) return
    try {
      const res = await fetch(`/api/warranty/vehicle?vehicleId=${encodeURIComponent(vehicleId)}`)
      if (!res.ok) return
      const data = await res.json()
      const w = data?.warranty
      if (!w || !w.has_warranty) return

      const name = [w.warranty_provider || '', w.warranty_type || ''].filter(Boolean).join(' | ') || 'Warranty'
      const desc = w.warranty_description || ''
      const amount = Number(w.extended_warranty_cost ?? w.warranty_cost ?? 0)
      const duration = w.warranty_end_date
        ? `Until ${w.warranty_end_date}`
        : w.extended_warranty_end_date
        ? `Until ${w.extended_warranty_end_date}`
        : ''
      const distance = w.warranty_mileage_limit ? `${w.warranty_mileage_limit} km` : w.extended_warranty_mileage_limit ? `${w.extended_warranty_mileage_limit} km` : ''

      worksheetTabRef.current?.addWarranty({ name, desc, amount, duration, distance })
    } catch {
      // ignore warranty fetch errors — not critical
    }
  }, [])

  // Close print menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (printMenuRef.current && !printMenuRef.current.contains(e.target as Node)) {
        setShowPrintMenu(false)
      }
    }
    if (showPrintMenu) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showPrintMenu])

  useEffect(() => {
    return () => {
      if (pdfObjectUrl) URL.revokeObjectURL(pdfObjectUrl)
    }
  }, [pdfObjectUrl])

  const handlePrint = async () => {
    if (!printBillOfSale && !printDisclosure) return
    setShowPrintMenu(false)
    setPdfLoading(true)
    try {
      // Auto-save worksheet so latest in-memory state (warranties, etc.) is persisted before PDF generation
      try { await worksheetTabRef.current?.save(true) } catch { /* ignore */ }

      // Fetch all deal data from Supabase
      const res = await fetch(`/api/deals/${encodeURIComponent(dealId)}`)
      const deal = res.ok ? await res.json() : null
      const customerFields = buildBillOfSaleCustomerFields(deal)
      const vRaw = deal?.vehicles?.[0] || {}
      const vp = vehiclePrefill?.vehicle || {}
      // edc_deals_vehicles stores vehicle info in selected_* columns (or camelCase variants)
      const sv = vRaw.selectedVehicle || vRaw
      const v = {
        stock_number: sv.selected_stock_number ?? sv.stockNumber ?? sv.stock_number ?? vp.stock_number ?? '',
        year: sv.selected_year ?? sv.year ?? vp.year ?? '',
        make: sv.selected_make ?? sv.make ?? vp.make ?? '',
        model: sv.selected_model ?? sv.model ?? vp.model ?? '',
        trim: sv.selected_trim ?? sv.trim ?? vp.trim ?? '',
        vin: sv.selected_vin ?? sv.vin ?? vp.vin ?? '',
        exterior_color: sv.selected_exterior_color ?? sv.exteriorColor ?? sv.exterior_color ?? vp.exterior_color ?? '',
        interior_color: sv.selected_interior_color ?? sv.interiorColor ?? sv.interior_color ?? vp.interior_color ?? '',
        odometer: sv.selected_odometer ?? sv.odometer ?? vp.odometer ?? vp.mileage ?? '',
        odometer_unit: sv.selected_odometer_unit ?? sv.odometerUnit ?? sv.odometer_unit ?? vp.odometer_unit ?? 'kms',
        status: sv.selected_status ?? sv.status ?? vp.status ?? 'Used',
        price: vp.price ?? 0,
      }
      const w = deal?.worksheet || {}
      const d = deal?.delivery || {}
      const disc = deal?.disclosures || {}

      // Augment worksheet with submission data if arrays are empty (deals approved before the fix)
      const sub = deal?.submission
      const subOrderData = sub?.order_data || {}
      if (sub && Array.isArray(w.accessories) && w.accessories.length === 0) {
        const subAddOns: any[] = Array.isArray(subOrderData.pricing?.addOns) ? subOrderData.pricing.addOns : []
        if (subAddOns.length > 0) {
          w.accessories = subAddOns.map((a: any) => ({
            id: `acc_${a.id || a.label}`,
            name: a.label || a.id || 'Add-on',
            desc: '',
            price: Number(a.amount || a.price || 0),
            cost: 0,
            taxSelected: {},
            taxOverride: false,
          }))
        }
      }
      if (sub && Array.isArray(w.warranties) && w.warranties.length === 0) {
        const subWarrantyName = sub.warranty_name || subOrderData.warranty?.planName || null
        const subWarrantyTotal = Number(sub.warranty_total ?? subOrderData.warranty?.total ?? 0)
        if (subWarrantyName && subWarrantyTotal > 0) {
          w.warranties = [{
            id: 'war_sub_warranty',
            name: subWarrantyName,
            desc: 'Vehicle Service Contract selected by customer',
            amount: subWarrantyTotal,
            cost: 0,
            duration: subOrderData.warranty?.termLabel || '',
            distance: '',
            taxSelected: {},
            taxOverride: false,
          }]
        }
      }

      // Build warrantyData: prefer worksheet warranties array, fall back to edc_warranty table
      let warrantyData: ExtendedWarrantyData | null = null

      // 1. Worksheet warranties (added in the deal's Worksheet tab)
      const parseFeeItemsEarly = (raw: any): any[] => {
        if (!raw) return []
        if (Array.isArray(raw)) return raw
        if (typeof raw === 'string') { try { const p = JSON.parse(raw); return Array.isArray(p) ? p : [] } catch { return [] } }
        return []
      }
      const wsWarranties = parseFeeItemsEarly(w.warranties)
      if (wsWarranties.length > 0) {
        const warrantyPresetMap = await fetchWarrantyPresets()
        const desc = wsWarranties.map((wi: any) => {
          const wiName = String(wi.name || '').trim()
          const preset = warrantyPresetMap[wiName] as any
          // Use preset description if available, otherwise fall back to stored desc
          const descText = (preset as any)?.description || String(wi.desc || '').trim()
          return wiName && descText ? `${wiName}\n${descText}` : wiName || descText
        }).filter(Boolean).join('\n\n')
        const totalCost = wsWarranties.reduce((s: number, wi: any) => s + (Number(wi.amount || 0)), 0)
        const firstWi = wsWarranties[0] || {}
        const presetMatch = warrantyPresetMap[String(firstWi.name || '').trim()] || {}
        const dur = wsWarranties.find((wi: any) => wi.duration)?.duration || presetMatch.duration || ''
        const dist = wsWarranties.find((wi: any) => wi.distance)?.distance || presetMatch.distance || ''
        // Pull add-ons from submission if available (e.g. Zero Deductible, Hi-Tech Components)
        const subOdWarranty = deal?.submission?.order_data?.warranty
        const wsAddOns: Array<{ label: string; price: number }> = Array.isArray(subOdWarranty?.addOns) ? subOdWarranty.addOns : []
        warrantyData = {
          has_extended: true,
          description: desc,
          duration: String(dur),
          distance: String(dist),
          cost: totalCost > 0 ? String(totalCost) : '',
          basePrice: subOdWarranty?.baseTotal ? String(subOdWarranty.baseTotal) : '',
          addOns: wsAddOns,
        }
      }

      // 2. Fallback: purchase submission's order_data.warranty (for deals approved before worksheet fix)
      if (!warrantyData) {
        const sub = deal?.submission
        const odWarranty = sub?.order_data?.warranty
        if (odWarranty && !sub?.warrantyDeclined && odWarranty.planName && odWarranty.total > 0) {
          warrantyData = {
            has_extended: true,
            description: odWarranty.planName || '',
            duration: odWarranty.termLabel || '',
            distance: '',
            cost: String(odWarranty.total || ''),
            basePrice: odWarranty.baseTotal ? String(odWarranty.baseTotal) : '',
            addOns: Array.isArray(odWarranty.addOns) ? odWarranty.addOns : [],
          }
        }
      }

      // 3. Fallback: edc_warranty table by vehicle_id / stock_number
      if (!warrantyData) {
        const vehicleId = vRaw?.selected_id || vRaw?.id || sv?.selected_id || sv?.id || ''
        const stockNumberForWarranty = v.stock_number || ''
        if (vehicleId || stockNumberForWarranty) {
          try {
            const wParams = new URLSearchParams()
            if (vehicleId) wParams.set('vehicleId', vehicleId)
            if (stockNumberForWarranty) wParams.set('stockNumber', stockNumberForWarranty)
            const wRes = await fetch(`/api/warranty/vehicle?${wParams.toString()}`, { cache: 'no-store' })
            if (wRes.ok) {
              const wJson = await wRes.json()
              const wr = wJson?.warranty
              if (wr && (wr.extended_warranty || wr.has_warranty)) {
                warrantyData = {
                  has_extended: true,
                  description: [
                    wr.extended_warranty_provider || wr.warranty_provider || '',
                    wr.warranty_type || '',
                  ].filter(Boolean).join(' | ') || '',
                  duration: String(wr.extended_warranty_end_date || wr.warranty_end_date || ''),
                  distance: String(wr.extended_warranty_mileage_limit || wr.warranty_mileage_limit || ''),
                  cost: String(wr.extended_warranty_cost || ''),
                }
              }
            }
          } catch { /* non-fatal */ }
        }
      }

      const settlement = buildBillOfSaleSettlement(w, v.price)

      const billData: BillOfSaleData = {
        dealDate: dealDate ? new Date(dealDate + 'T00:00:00').toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' }) : '',
        invoiceNumber: String(dealId || ''),
        ...customerFields,
        stockNumber: v.stock_number,
        year: String(v.year),
        make: v.make,
        model: v.model,
        trim: v.trim,
        colour: v.exterior_color,
        keyNumber: '',
        vin: v.vin,
        odometerStatus: v.status,
        odometer: v.odometer ? `${Number(v.odometer).toLocaleString()} ${v.odometer_unit || 'kms'}` : '',
        serviceDate: '',
        deliveryDate: d.delivery_date ?? '',
        ...settlement,
        extendedWarranty: warrantyData ? '' : 'DECLINED',
        extendedWarrantyData: warrantyData,
        commentsHtml: disc.disclosures_html ?? '',
        salesperson: d.salesperson ?? '',
        salespersonRegNo: '4782496',
        acceptorName: d.approved_by ?? 'Syed Islam',
        acceptorRegNo: '4782496',
      }

      const totalPages = (printDisclosure ? 1 : 0) + (printBillOfSale ? 3 : 0)
      const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' })

      let currentPage = 1

      if (printDisclosure) {
        renderDisclosureFormPdf(doc, {
          dealDate: billData.dealDate,
          stockNumber: billData.stockNumber,
          year: billData.year,
          make: billData.make,
          model: billData.model,
          trim: billData.trim,
          colour: billData.colour,
          vin: billData.vin,
          odometer: billData.odometer,
          disclosuresText: billData.commentsHtml,
          conditionsText: disc?.conditions ?? '',
        }, { pageNumber: currentPage, totalPages })
        currentPage += 1
      }

      if (printBillOfSale) {
        if (printDisclosure) doc.addPage()
        renderBillOfSalePdf(doc, billData, { pageStart: currentPage, totalPages })
      }

      const ab = doc.output('arraybuffer')
      const blob = new Blob([ab], { type: 'application/pdf' })

      if (pdfObjectUrl) URL.revokeObjectURL(pdfObjectUrl)
      const nextUrl = URL.createObjectURL(blob)

      setPdfBlob(blob)
      setPdfObjectUrl(nextUrl)
      setShowDocPreview(true)
    } catch (e) {
      console.error('[Print] Error generating PDF:', e)
    } finally {
      setPdfLoading(false)
    }
  }

  const handleEmail = async () => {
    if (emailLoading) return
    setEmailLoading(true)
    try {
      let senderEmail = ''
      try {
        if (typeof window !== 'undefined') {
          const raw = window.localStorage.getItem('edc_admin_session')
          if (raw) {
            const parsed = JSON.parse(raw) as { email?: string }
            senderEmail = String(parsed?.email || '').trim().toLowerCase()
          }
        }
      } catch {
        senderEmail = ''
      }

      const okToSend = await confirmEsignChargeIfNeeded(senderEmail)
      if (!okToSend) return

      // Auto-save current tabs so the PDF is generated from visible, current data.
      await customersTabRef.current?.save(true)
      try { await worksheetTabRef.current?.save(true) } catch { /* ignore */ }

      const res = await fetch(`/api/deals/${encodeURIComponent(dealId)}`)
      const deal = res.ok ? await res.json() : null
      const c = deal?.customer || {}
      const customerFields = buildBillOfSaleCustomerFields(deal)
      const toEmail = String(customerFields.email || c.email || '').trim()
      if (!toEmail) throw new Error('Missing customer email')

      const vRaw = deal?.vehicles?.[0] || {}
      const vp = vehiclePrefill?.vehicle || {}
      const sv = vRaw.selectedVehicle || vRaw
      const v = {
        stock_number: sv.selected_stock_number ?? sv.stockNumber ?? sv.stock_number ?? vp.stock_number ?? '',
        year: sv.selected_year ?? sv.year ?? vp.year ?? '',
        make: sv.selected_make ?? sv.make ?? vp.make ?? '',
        model: sv.selected_model ?? sv.model ?? vp.model ?? '',
        trim: sv.selected_trim ?? sv.trim ?? vp.trim ?? '',
        vin: sv.selected_vin ?? sv.vin ?? vp.vin ?? '',
        exterior_color: sv.selected_exterior_color ?? sv.exteriorColor ?? sv.exterior_color ?? vp.exterior_color ?? '',
        interior_color: sv.selected_interior_color ?? sv.interiorColor ?? sv.interior_color ?? vp.interior_color ?? '',
        odometer: sv.selected_odometer ?? sv.odometer ?? vp.odometer ?? vp.mileage ?? '',
        odometer_unit: sv.selected_odometer_unit ?? sv.odometerUnit ?? sv.odometer_unit ?? vp.odometer_unit ?? 'kms',
        status: sv.selected_status ?? sv.status ?? vp.status ?? 'Used',
        price: vp.price ?? 0,
      }

      const w = deal?.worksheet || {}
      const d = deal?.delivery || {}
      const disc = deal?.disclosures || {}

      // Augment worksheet with submission data if arrays are empty (deals approved before the fix)
      const subE = deal?.submission
      const subOrderDataE = subE?.order_data || {}
      if (subE && Array.isArray(w.accessories) && w.accessories.length === 0) {
        const subAddOnsE: any[] = Array.isArray(subOrderDataE.pricing?.addOns) ? subOrderDataE.pricing.addOns : []
        if (subAddOnsE.length > 0) {
          w.accessories = subAddOnsE.map((a: any) => ({
            id: `acc_${a.id || a.label}`,
            name: a.label || a.id || 'Add-on',
            desc: '',
            price: Number(a.amount || a.price || 0),
            cost: 0,
            taxSelected: {},
            taxOverride: false,
          }))
        }
      }
      if (subE && Array.isArray(w.warranties) && w.warranties.length === 0) {
        const subWarrantyNameE = subE.warranty_name || subOrderDataE.warranty?.planName || null
        const subWarrantyTotalE = Number(subE.warranty_total ?? subOrderDataE.warranty?.total ?? 0)
        if (subWarrantyNameE && subWarrantyTotalE > 0) {
          w.warranties = [{
            id: 'war_sub_warranty',
            name: subWarrantyNameE,
            desc: 'Vehicle Service Contract selected by customer',
            amount: subWarrantyTotalE,
            cost: 0,
            duration: subOrderDataE.warranty?.termLabel || '',
            distance: '',
            taxSelected: {},
            taxOverride: false,
          }]
        }
      }

      // Build warrantyDataE: prefer worksheet warranties, fall back to edc_warranty table
      let warrantyDataE: ExtendedWarrantyData | null = null

      const parseFeeItemsEarlyE = (raw: any): any[] => {
        if (!raw) return []
        if (Array.isArray(raw)) return raw
        if (typeof raw === 'string') { try { const p = JSON.parse(raw); return Array.isArray(p) ? p : [] } catch { return [] } }
        return []
      }
      const wsWarrantiesE = parseFeeItemsEarlyE(w.warranties)
      if (wsWarrantiesE.length > 0) {
        const warrantyPresetMapE = await fetchWarrantyPresets()
        const desc = wsWarrantiesE.map((wi: any) => {
          const wiName = String(wi.name || '').trim()
          const preset = warrantyPresetMapE[wiName] as any
          const descText = preset?.description || String(wi.desc || '').trim()
          return wiName && descText ? `${wiName}\n${descText}` : wiName || descText
        }).filter(Boolean).join('\n\n')
        const totalCost = wsWarrantiesE.reduce((s: number, wi: any) => s + (Number(wi.amount || 0)), 0)
        const firstWiE = wsWarrantiesE[0] || {}
        const presetMatchE = warrantyPresetMapE[String(firstWiE.name || '').trim()] || {}
        const dur = wsWarrantiesE.find((wi: any) => wi.duration)?.duration || presetMatchE.duration || ''
        const dist = wsWarrantiesE.find((wi: any) => wi.distance)?.distance || presetMatchE.distance || ''
        const subOdWarrantyE = deal?.submission?.order_data?.warranty
        const wsAddOnsE: Array<{ label: string; price: number }> = Array.isArray(subOdWarrantyE?.addOns) ? subOdWarrantyE.addOns : []
        warrantyDataE = {
          has_extended: true,
          description: desc,
          duration: String(dur),
          distance: String(dist),
          cost: totalCost > 0 ? String(totalCost) : '',
          basePrice: subOdWarrantyE?.baseTotal ? String(subOdWarrantyE.baseTotal) : '',
          addOns: wsAddOnsE,
        }
      }

      if (!warrantyDataE) {
        // Fallback: submission order_data.warranty (the w.warranties augmentation above handles this,
        // but in case it still missed, check directly)
        const odWarrantyE = subOrderDataE.warranty
        if (odWarrantyE && !subE?.warrantyDeclined && odWarrantyE.planName && odWarrantyE.total > 0) {
          warrantyDataE = {
            has_extended: true,
            description: odWarrantyE.planName || '',
            duration: odWarrantyE.termLabel || '',
            distance: '',
            cost: String(odWarrantyE.total || ''),
            basePrice: odWarrantyE.baseTotal ? String(odWarrantyE.baseTotal) : '',
            addOns: Array.isArray(odWarrantyE.addOns) ? odWarrantyE.addOns : [],
          }
        }
      }

      if (!warrantyDataE) {
        const vehicleIdE = vRaw?.selected_id || vRaw?.id || sv?.selected_id || sv?.id || ''
        const stockNumberForWarrantyE = v.stock_number || ''
        if (vehicleIdE || stockNumberForWarrantyE) {
          try {
            const wParamsE = new URLSearchParams()
            if (vehicleIdE) wParamsE.set('vehicleId', vehicleIdE)
            if (stockNumberForWarrantyE) wParamsE.set('stockNumber', stockNumberForWarrantyE)
            const wRes = await fetch(`/api/warranty/vehicle?${wParamsE.toString()}`, { cache: 'no-store' })
            if (wRes.ok) {
              const wJson = await wRes.json()
              const wr = wJson?.warranty
              if (wr && (wr.extended_warranty || wr.has_warranty)) {
                warrantyDataE = {
                  has_extended: true,
                  description: [
                    wr.extended_warranty_provider || wr.warranty_provider || '',
                    wr.warranty_type || '',
                  ].filter(Boolean).join(' | ') || '',
                  duration: String(wr.extended_warranty_end_date || wr.warranty_end_date || ''),
                  distance: String(wr.extended_warranty_mileage_limit || wr.warranty_mileage_limit || ''),
                  cost: String(wr.extended_warranty_cost || ''),
                }
              }
            }
          } catch { /* non-fatal */ }
        }
      }

      const settlement = buildBillOfSaleSettlement(w, v.price)

      const billData: BillOfSaleData = {
        dealDate: dealDate ? new Date(dealDate + 'T00:00:00').toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' }) : '',
        invoiceNumber: String(dealId || ''),
        ...customerFields,
        email: toEmail,
        stockNumber: v.stock_number,
        year: String(v.year),
        make: v.make,
        model: v.model,
        trim: v.trim,
        colour: v.exterior_color,
        keyNumber: '',
        vin: v.vin,
        odometerStatus: v.status,
        odometer: v.odometer ? `${Number(v.odometer).toLocaleString()} ${v.odometer_unit || 'kms'}` : '',
        serviceDate: '',
        deliveryDate: d.delivery_date ?? '',
        ...settlement,
        extendedWarranty: warrantyDataE ? '' : 'DECLINED',
        extendedWarrantyData: warrantyDataE,
        commentsHtml: disc.disclosures_html ?? '',
        salesperson: d.salesperson ?? '',
        salespersonRegNo: '4782496',
        acceptorName: d.approved_by ?? 'Syed Islam',
        acceptorRegNo: '4782496',
      }

      const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' })
      renderBillOfSalePdf(doc, billData, { pageStart: 1, totalPages: 3 })
      const ab = doc.output('arraybuffer')
      const blob = new Blob([ab], { type: 'application/pdf' })

      const arrayBufferToBase64 = (buffer: ArrayBuffer) => {
        let binary = ''
        const bytes = new Uint8Array(buffer)
        const chunkSize = 0x8000
        for (let i = 0; i < bytes.length; i += chunkSize) {
          const chunk = bytes.subarray(i, i + chunkSize)
          binary += String.fromCharCode.apply(null, chunk as unknown as number[])
        }
        return btoa(binary)
      }

      const fileName = `Bill_of_Sale_${dealId}.pdf`
      const fileB64 = arrayBufferToBase64(ab)

      const signatureLink = (() => {
        try {
          if (typeof window === 'undefined') return null
          const appOrigin = (process.env.NEXT_PUBLIC_APP_ORIGIN || 'https://easydrivecanada.com').replace(/\/+$/, '')
          return `${appOrigin}/admin/sales/deals/signature?dealId=${encodeURIComponent(String(dealId || ''))}`
        } catch {
          return null
        }
      })()

      const formData = new FormData()
      formData.append('email', toEmail)
      if (senderEmail) formData.append('sender_email', senderEmail)
      formData.append('dealId', String(dealId || ''))
      if (signatureLink) formData.append('link', signatureLink)
      formData.append('file', blob, fileName)
      formData.append('file_b64', fileB64)
      formData.append('file_name', fileName)

      const sendRes = await fetch('/api/email', {
        method: 'POST',
        body: formData,
      })

      if (!sendRes.ok) {
        const t = await sendRes.text().catch(() => '')
        throw new Error(t || `Email webhook failed (${sendRes.status})`)
      }
    } catch (e) {
      console.error('[Email] Error:', e)
    } finally {
      setEmailLoading(false)
    }
  }

  const handleDownloadPdf = () => {
    if (!pdfBlob) return
    const url = URL.createObjectURL(pdfBlob)
    const a = document.createElement('a')
    a.href = url
    a.download = `Bill_of_Sale_${dealId}.pdf`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="w-full min-h-[calc(100vh-64px)] bg-gradient-to-b from-[#f6f7f9] to-[#e9eaee]">
      <div className="w-full px-4 sm:px-6 lg:px-8 py-6">
        {dealHasSignature ? (
          <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Already have signature.
          </div>
        ) : null}

        <div className="mb-4">
          <button
            type="button"
            onClick={() => router.push('/admin/sales/deals')}
            className="flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-800 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            Back to Deals
          </button>
        </div>

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
              <button
                type="button"
                onClick={handleEmail}
                disabled={emailLoading}
                className="h-9 px-3 rounded bg-[#118df0] text-white text-sm font-semibold hover:bg-[#0d6ebd] flex items-center gap-1 disabled:opacity-50"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                {emailLoading ? 'Sending...' : 'Request Signature'}
              </button>
              <div className="relative" ref={printMenuRef}>
                <div className="flex">
                  <button
                    type="button"
                    onClick={handlePrint}
                    disabled={pdfLoading}
                    className="h-9 px-3 rounded-l bg-[#118df0] text-white text-sm font-semibold hover:bg-[#0d6ebd] flex items-center gap-1 disabled:opacity-50"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                    {pdfLoading ? 'Loading...' : 'Print'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowPrintMenu((v) => !v)}
                    className="h-9 px-1.5 rounded-r bg-[#118df0] text-white text-sm font-semibold hover:bg-[#0d6ebd] border-l border-white/30"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                  </button>
                </div>
                {showPrintMenu && (
                  <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-gray-200 rounded shadow-lg z-50">
                    <div className="px-3 py-2 border-b border-gray-100 text-xs font-semibold text-gray-600">Reports</div>
                    <label className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer">
                      <input type="checkbox" className="h-4 w-4 accent-[#118df0]" checked={printBillOfSale} onChange={(e) => setPrintBillOfSale(e.target.checked)} />
                      <span className="text-sm text-gray-800 font-medium">Bill of Sale</span>
                    </label>
                    <label className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer">
                      <input type="checkbox" className="h-4 w-4 accent-[#118df0]" checked={printDisclosure} onChange={(e) => setPrintDisclosure(e.target.checked)} />
                      <span className="text-sm text-gray-800">Disclosure Form</span>
                    </label>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3">
          {(
            [
              { key: 'customers', label: 'Customers' },
              { key: 'drivers-license', label: "Driver's License" },
              { key: 'vehicles', label: 'Vehicles' },
              { key: 'worksheet', label: 'Worksheet' },
              { key: 'disclosures', label: 'Disclosures' },
              { key: 'delivery', label: 'Delivery' },
            ] as const
          ).map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => { if (unlockedTabs.has(t.key)) setActiveTab(t.key) }}
              disabled={!unlockedTabs.has(t.key)}
              className={
                !unlockedTabs.has(t.key)
                  ? 'h-10 px-4 rounded bg-gray-100 text-gray-400 text-sm font-semibold cursor-not-allowed opacity-50'
                  : activeTab === t.key
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
              <div style={{ display: activeTab === 'drivers-license' ? 'block' : 'none' }}>
                {(() => {
                  const c = prefill?.customers?.[0] ?? prefill?.customer
                  const docs = prefill?.submission?.order_data?.documents
                  const licFront = docs?.licenceFront?.dataUrl as string | undefined
                  const licBack = docs?.licenceBack?.dataUrl as string | undefined
                  const dlNumber = c?.driverslicense || c?.driversLicense || ''
                  const dlExpiry = c?.expdate || c?.expDate || ''
                  const dob = c?.dateofbirth || c?.dateOfBirth || ''
                  return (
                    <div className="bg-white rounded-xl shadow p-6 space-y-6">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div>
                          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">ID Number</div>
                          <div className="text-base font-semibold text-gray-900">{dlNumber || <span className="text-gray-300">—</span>}</div>
                        </div>
                        <div>
                          <div className="text-xs font-semibold text-amber-500 uppercase tracking-wide mb-1">DL Expiry</div>
                          <div className="text-base font-semibold text-gray-900">{dlExpiry || <span className="text-gray-300">—</span>}</div>
                        </div>
                        <div>
                          <div className="text-xs font-semibold text-blue-500 uppercase tracking-wide mb-1">Date of Birth</div>
                          <div className="text-base font-semibold text-gray-900">{dob || <span className="text-gray-300">—</span>}</div>
                        </div>
                      </div>

                      <div>
                        <div className="text-sm font-semibold text-gray-700 mb-3">Photos</div>
                        {(licFront || licBack) ? (
                          <div className="flex flex-wrap gap-6">
                            {licFront && (
                              <div className="flex flex-col items-center gap-2">
                                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Front</span>
                                <a href={licFront} target="_blank" rel="noopener noreferrer">
                                  <img src={licFront} alt="Licence front" className="h-44 w-auto rounded-lg border border-gray-200 object-cover cursor-pointer hover:opacity-80 transition shadow-sm" />
                                </a>
                              </div>
                            )}
                            {licBack && (
                              <div className="flex flex-col items-center gap-2">
                                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Back</span>
                                <a href={licBack} target="_blank" rel="noopener noreferrer">
                                  <img src={licBack} alt="Licence back" className="h-44 w-auto rounded-lg border border-gray-200 object-cover cursor-pointer hover:opacity-80 transition shadow-sm" />
                                </a>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="text-sm text-gray-400">No licence photos submitted.</div>
                        )}
                      </div>
                    </div>
                  )
                })()}
              </div>

              <div style={{ display: activeTab === 'customers' ? 'block' : 'none' }}>
                <CustomersTabNew
                  ref={customersTabRef}
                  key={editDealId ? `edit-${editDealId}-${prefill?.customers?.[0]?.id ?? prefill?.customer?.id ?? '0'}` : 'new'}
                  hideAddButton={!isRetail}
                  dealId={dealId}
                  dealDate={dealDate}
                  dealType={dealType}
                  dealMode={isRetail ? 'RTL' : 'WHL'}
                  onSaved={() => unlockTab('vehicles')}
                  initialData={prefill?.customers?.length ? prefill.customers : (prefill?.customer ? [prefill.customer] : null)}
                  submission={prefill?.submission ?? null}
                />
              </div>
              <div style={{ display: activeTab === 'vehicles' ? 'block' : 'none' }}>
                <VehiclesTab
                  ref={vehiclesTabRef}
                  dealId={dealId}
                  dealMode={isRetail ? 'RTL' : 'WHL'}
                  dealType={dealType}
                  onSaved={() => unlockTab('worksheet')}
                  initialData={prefill?.vehicles ?? null}
                  autoSaved={false}
                  prefillSelected={initialVehicleId && vehiclePrefill?.vehicle ? {
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
                  onVehicleSelected={handleVehicleSelected}
                />
              </div>
              <div style={{ display: activeTab === 'worksheet' ? 'block' : 'none' }}>
                <WorksheetTab
                  ref={worksheetTabRef}
                  key={`worksheet-${dealId}-${selectedVehicleData?.id || 'no-vehicle'}`}
                  dealId={dealId}
                  dealMode={isRetail ? 'RTL' : 'WHL'}
                  dealType={dealType}
                  dealDate={dealDate}
                  formMode={formMode}
                  onSaved={() => unlockTab('disclosures')}
                  autoSaved={false}
                  initialData={(() => {
                    // Get vehicle price from available sources
                    const vehicleSource = selectedVehicleData || vehiclePrefill?.vehicle
                    const vehiclePrice = vehicleSource ? getVehicleSellPrice(vehicleSource) : 0
                    
                    // Check if worksheet has a valid purchase price
                    const worksheetPrice = toMoneyNumber(prefill?.worksheet?.purchase_price)
                    
                    // Use vehicle price if worksheet price is 0 or not set
                    const finalPurchasePrice = worksheetPrice > 0 ? worksheetPrice : vehiclePrice
                    
                    const worksheetData = prefill?.worksheet ? {
                      ...prefill.worksheet,
                      purchase_price: String(finalPurchasePrice),
                    } : vehicleSource ? {
                      purchase_price: String(vehiclePrice),
                      discount: '0',
                      tax_code: 'HST',
                      license_fee: vehiclePrefill?.purchase?.license_fee ?? '',
                      trade_value: '0',
                      actual_cash_value: '0',
                      lien_payout: '0',
                    } : null
                    
                    // Backfill accessories from submission if worksheet has none
                    if (worksheetData && !(Array.isArray(worksheetData.accessories) && worksheetData.accessories.length > 0)) {
                      const sub = prefill?.submission
                      const od = sub?.order_data || {}
                      const odAddOns = Array.isArray(od.pricing?.addOns) ? od.pricing.addOns : []
                      if (odAddOns.length > 0) {
                        worksheetData.accessories = odAddOns.map((a: any) => ({
                          id: `acc_${a.id || a.label}`,
                          name: a.label || a.id || 'Add-on',
                          desc: '',
                          price: Number(a.amount || a.price || 0),
                          cost: 0,
                          taxSelected: { 'HST 13 %': true },
                          taxOverride: false,
                        }))
                      }
                    }

                    // Backfill warranties from submission if worksheet has none
                    if (worksheetData && !(Array.isArray(worksheetData.warranties) && worksheetData.warranties.length > 0)) {
                      const sub = prefill?.submission
                      const od = sub?.order_data || {}
                      const subOdWarranty = od.warranty || null
                      const warrantyName = sub?.warranty_name || subOdWarranty?.planName || null
                      const warrantyTotal = Number(sub?.warranty_total ?? subOdWarranty?.total ?? 0)
                      if (warrantyName && warrantyTotal > 0) {
                        worksheetData.warranties = [{
                          id: 'war_sub_warranty',
                          name: warrantyName,
                          desc: 'Vehicle Service Contract selected by customer',
                          amount: warrantyTotal,
                          cost: 0,
                          duration: subOdWarranty?.termLabel || '',
                          distance: '',
                          isDealerGuaranty: false,
                          taxSelected: { 'Default Tax 0 %': true },
                          taxOverride: false,
                        }]
                      }
                    }

                    console.log('[page.tsx] WorksheetTab initialData:', {
                      vehiclePrice,
                      worksheetPrice,
                      finalPurchasePrice,
                      selectedVehicleData,
                      finalData: worksheetData
                    })
                    return worksheetData
                  })()}
                />
              </div>
              <div style={{ display: activeTab === 'disclosures' ? 'block' : 'none' }}>
                <DisclosuresTab
                  dealId={dealId}
                  dealMode={isRetail ? 'RTL' : 'WHL'}
                  dealType={dealType}
                  formMode={formMode}
                  onSaved={() => unlockTab('delivery')}
                  autoSaved={false}
                  initialData={prefill?.disclosures ?? null}
                  submission={prefill?.submission ?? null}
                />
              </div>
              <div style={{ display: activeTab === 'delivery' ? 'block' : 'none' }}>
                <DeliveryTab
                  dealId={dealId}
                  dealMode={isRetail ? 'RTL' : 'WHL'}
                  formMode={formMode}
                  initialData={prefill?.delivery ?? null}
                />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Documents Preview Modal */}
      {showDocPreview && pdfObjectUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => {
              setShowDocPreview(false)
              setPdfBlob(null)
              if (pdfObjectUrl) URL.revokeObjectURL(pdfObjectUrl)
              setPdfObjectUrl(null)
            }}
          />
          <div className="relative w-full max-w-3xl h-[90vh] rounded-xl bg-white shadow-xl border border-gray-200 flex flex-col">
            <div className="px-5 py-3 border-b border-gray-200 flex items-center justify-between">
              <div className="text-sm font-semibold text-gray-900">Documents Preview</div>
              <button
                type="button"
                className="text-gray-500 hover:text-gray-700 text-lg"
                onClick={() => {
                  setShowDocPreview(false)
                  setPdfBlob(null)
                  if (pdfObjectUrl) URL.revokeObjectURL(pdfObjectUrl)
                  setPdfObjectUrl(null)
                }}
                aria-label="Close"
              >
                &times;
              </button>
            </div>
            <div className="px-5 py-2 border-b border-gray-100 flex items-center gap-3">
              <button
                type="button"
                onClick={handleDownloadPdf}
                className="text-gray-600 hover:text-[#118df0]" title="Download PDF"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
              </button>
            </div>
            <div className="flex-1 overflow-auto bg-gray-100 p-4">
              <iframe
                src={pdfObjectUrl}
                className="w-full h-full rounded border border-gray-200 bg-white"
                title="Bill of Sale Preview"
              />
            </div>
          </div>
        </div>
      )}

      {esignModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Close"
            className="absolute inset-0 bg-black/40"
            onClick={() => {
              if (esignModalBlocking) {
                setEsignModalOpen(false)
                return
              }
              const r = esignModalResolverRef.current
              esignModalResolverRef.current = null
              setEsignModalOpen(false)
              if (r) r(false)
            }}
          />
          <div className="relative w-full max-w-md rounded-xl bg-white shadow-xl border border-gray-200">
            <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between gap-3">
              <div className="text-sm font-semibold text-gray-900">{esignModalTitle}</div>
              <button
                type="button"
                className="text-gray-500 hover:text-gray-700 text-lg"
                onClick={() => {
                  if (esignModalBlocking) {
                    setEsignModalOpen(false)
                    return
                  }
                  const r = esignModalResolverRef.current
                  esignModalResolverRef.current = null
                  setEsignModalOpen(false)
                  if (r) r(false)
                }}
                aria-label="Close"
              >
                &times;
              </button>
            </div>
            <div className="px-5 py-4">
              <div className="text-sm text-gray-700">{esignModalBody}</div>
              <div className="mt-5 flex items-center justify-end gap-2">
                {esignModalBlocking ? (
                  <button
                    type="button"
                    className="h-9 px-4 rounded bg-[#118df0] text-white text-sm font-semibold hover:bg-[#0d6ebd]"
                    onClick={() => setEsignModalOpen(false)}
                  >
                    OK
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      className="h-9 px-4 rounded bg-white border border-gray-200 text-gray-700 text-sm font-semibold hover:bg-gray-50"
                      onClick={() => {
                        const r = esignModalResolverRef.current
                        esignModalResolverRef.current = null
                        setEsignModalOpen(false)
                        if (r) r(false)
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="h-9 px-4 rounded bg-[#118df0] text-white text-sm font-semibold hover:bg-[#0d6ebd]"
                      onClick={() => {
                        const r = esignModalResolverRef.current
                        esignModalResolverRef.current = null
                        setEsignModalOpen(false)
                        if (r) r(true)
                      }}
                    >
                      Continue
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function SalesNewDealPage() {
  return (
    <Suspense fallback={
      <div className="w-full min-h-[calc(100vh-64px)] bg-gradient-to-b from-[#f6f7f9] to-[#e9eaee] flex items-center justify-center">
        <div className="text-gray-500 text-sm">Loading...</div>
      </div>
    }>
      <SalesNewDealPageContent />
    </Suspense>
  )
}




