'use client'

import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import jsPDF from 'jspdf'
import { useRouter, useSearchParams } from 'next/navigation'

import CustomersTabNew from './CustomersTabNew'
import DeliveryTab from './DeliveryTab'
import DisclosuresTab from './DisclosuresTab'
import VehiclesTab from './VehiclesTab'
import WorksheetTab from './WorksheetTab'
import { renderBillOfSalePdf, type BillOfSaleData } from './billOfSalePdf'
import { renderDisclosureFormPdf } from './disclosureFormPdf'

type DealTab = 'customers' | 'vehicles' | 'worksheet' | 'disclosures' | 'delivery'

function SalesNewDealPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const editDealId = searchParams.get('dealId') // present when editing an existing deal
  const vehicleId = searchParams.get('vehicleId') // present when coming from showroom

  const formMode: 'create' | 'edit' = editDealId ? 'edit' : 'create'

  // Store initial vehicleId to only affect first load
  const [initialVehicleId] = useState(vehicleId)
  const [activeTab, setActiveTab] = useState<DealTab>(initialVehicleId ? 'vehicles' : 'customers')
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
  const [prefillLoading, setPrefillLoading] = useState(false)

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

  // Track whether auto-save has fired for showroom prefill
  const autoSaveRan = useRef(false)
  const [autoSavedVehicles, setAutoSavedVehicles] = useState(false)
  const [autoSavedWorksheet, setAutoSavedWorksheet] = useState(false)
  const [autoSavedDisclosures, setAutoSavedDisclosures] = useState(false)

  const parseJsonLoose = (v: any) => {
    if (!v) return null
    if (typeof v === 'object') return v
    if (typeof v !== 'string') return null
    const s = v.trim()
    if (!s) return null
    try { return JSON.parse(s) } catch { return null }
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

  // Clear URL params immediately to prevent navigation issues
  useEffect(() => {
    if (initialVehicleId && typeof window !== 'undefined') {
      // Clear the vehicleId param from URL immediately
      const newUrl = window.location.pathname + (editDealId ? `?dealId=${editDealId}` : '')
      window.history.replaceState({}, '', newUrl)
    }
  }, [])

  // Auto-save prefilled data to Supabase on first load when coming from showroom
  useEffect(() => {
    if (!vehiclePrefill?.vehicle || autoSaveRan.current) return
    autoSaveRan.current = true
    const v = vehiclePrefill.vehicle
    const sellPrice = getVehicleSellPrice(v)
    const currentDealId = dealId

    // 1) Auto-save Vehicles directly to Supabase
    fetch('/api/deals/insert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        table: 'edc_deals_vehicles',
        data: {
          id: currentDealId,
          selected_stock_number: v.stock_number ?? null,
          selected_year: v.year ?? null,
          selected_make: v.make ?? null,
          selected_model: v.model ?? null,
          selected_trim: v.trim ?? null,
          selected_vin: v.vin ?? null,
          selected_exterior_color: v.exterior_color ?? null,
          selected_interior_color: v.interior_color ?? null,
          selected_odometer: v.odometer ?? v.mileage ?? null,
          selected_odometer_unit: v.odometer_unit ?? null,
          selected_status: v.status ?? null,
        },
      }),
    })
      .then((r) => r.json())
      .then((j) => {
        console.log('[Auto-save Vehicles] Response:', j)
        setAutoSavedVehicles(true)
      })
      .catch((e) => console.error('[Auto-save Vehicles] Error:', e))

    // 2) Auto-save Worksheet directly to Supabase
    const purchase = vehiclePrefill.purchase
    fetch('/api/deals/insert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        table: 'edc_deals_worksheet',
        data: {
          id: currentDealId,
          deal_type: 'Cash',
          deal_date: dealDate,
          deal_mode: 'RTL',
          purchase_price: String(sellPrice || 0),
          discount: '0',
          subtotal: String(sellPrice || 0),
          trade_value: '0',
          actual_cash_value: '0',
          net_difference: '0',
          tax_code: 'HST',
          tax_rate: '0.13',
          tax_override: false,
          tax_manual: '0',
          total_tax: String(Number(sellPrice || 0) * 0.13),
          lien_payout: '0',
          trade_equity: '0',
          license_fee: purchase?.license_fee ?? null,
          new_plates: false,
          renewal_only: false,
          total_balance_due: String(Number(sellPrice || 0) * 1.13),
          fees: [],
          accessories: [],
          warranties: [],
          insurances: [],
          payments: [],
        },
      }),
    })
      .then((r) => r.json())
      .then((j) => {
        console.log('[Auto-save Worksheet] Response:', j)
        setAutoSavedWorksheet(true)
      })
      .catch((e) => console.error('[Auto-save Worksheet] Error:', e))

    // 3) Auto-save Disclosures directly to Supabase
    const disc = vehiclePrefill.disclosures
    const discHtml = Array.isArray(disc) && disc.length > 0
      ? disc.map((d: any) => `<p><strong>${d.disclosures_tittle || ''}</strong></p><p>${d.disclosures_body || ''}</p>`).join('')
      : ''
    fetch('/api/deals/insert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        table: 'edc_deals_disclosures',
        data: {
          id: currentDealId,
          disclosures_html: discHtml || null,
          conditions: null,
        },
      }),
    })
      .then((r) => r.json())
      .then((j) => {
        console.log('[Auto-save Disclosures] Response:', j)
        setAutoSavedDisclosures(true)
      })
      .catch((e) => console.error('[Auto-save Disclosures] Error:', e))
  }, [vehiclePrefill, dealId, dealDate])

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
      // Fetch all deal data from Supabase
      const res = await fetch(`/api/deals/${encodeURIComponent(dealId)}`)
      const deal = res.ok ? await res.json() : null
      const c = deal?.customer || {}
      const vRaw = deal?.vehicles?.[0] || {}
      const vp = vehiclePrefill?.vehicle || {}
      // edc_deals_vehicles stores vehicle info in selected_* columns (or camelCase variants)
      const sv = vRaw.selectedVehicle || vRaw  // webhook may nest under selectedVehicle
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

      const parseFeeItems = (raw: any): any[] => {
        if (!raw) return []
        if (Array.isArray(raw)) return raw
        if (typeof raw === 'string') {
          try {
            const parsed = JSON.parse(raw)
            return Array.isArray(parsed) ? parsed : []
          } catch {
            return []
          }
        }
        return []
      }

      const getOmvicFromFees = (rawFees: any): number => {
        const fees = parseFeeItems(rawFees)
        for (const f of fees) {
          const name = String(f?.fee_name ?? f?.name ?? f?.label ?? '').toLowerCase()
          if (!name) continue
          if (name.includes('omvic')) {
            const amt = Number(f?.fee_amount ?? f?.amount ?? f?.value ?? 0)
            return Number.isFinite(amt) ? amt : 0
          }
        }
        return 0
      }

      const price = Number(w.purchase_price ?? v.price ?? 0)
      const omvic = Number(w.omvic_fee ?? getOmvicFromFees(w.fees) ?? 0)
      const discount = Number(w.discount ?? 0)
      const subtotal1 = price + omvic
      const tradeValue = Number(w.trade_value ?? 0)
      const lienPayout = Number(w.lien_payout ?? 0)
      const netDiff = subtotal1 - discount - tradeValue + lienPayout
      const taxRate = Number(w.tax_rate ?? 0.13)
      const hst = netDiff * taxRate
      const totalTax = hst
      const licenseFee = Number(w.license_fee ?? 91)

      const sumItems = (raw: any, amtKey: string) => {
        const items = parseFeeItems(raw)
        return items.reduce((s: number, i: any) => s + (Number(i?.[amtKey] ?? 0) || 0), 0)
      }
      const feesTotal = sumItems(w.fees, 'amount')
      const accessoriesTotal = sumItems(w.accessories, 'price')
      const warrantiesTotal = sumItems(w.warranties, 'amount')
      const insurancesTotal = sumItems(w.insurances, 'amount')
      const paymentsTotal = sumItems(w.payments, 'amount')

      const subtotal2 = netDiff + totalTax + licenseFee + feesTotal + accessoriesTotal + warrantiesTotal + insurancesTotal + paymentsTotal
      const deposit = Number(w.deposit ?? 0)
      const downPayment = Number(w.down_payment ?? 0)
      const taxInsurance = Number(w.tax_on_insurance ?? 0)
      const totalDue = subtotal2 - deposit - downPayment + taxInsurance

      const fullName = [c.firstname, c.lastname].filter(Boolean).join(' ') || [c.first_name, c.last_name].filter(Boolean).join(' ') || ''

      const billData: BillOfSaleData = {
        dealDate: dealDate ? new Date(dealDate + 'T00:00:00').toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' }) : '',
        invoiceNumber: String(dealId || ''),
        fullName,
        phone: c.phone ?? '',
        mobile: c.mobile ?? '',
        email: c.email ?? '',
        address: c.street_address ?? c.streetaddress ?? '',
        city: c.city ?? '',
        province: c.province ?? 'ON',
        postalCode: c.postal_code ?? c.postalcode ?? '',
        driversLicense: c.drivers_license ?? c.driverslicense ?? '',
        insuranceCompany: c.insurance_company ?? c.insurancecompany ?? '',
        policyNumber: c.policy_number ?? c.policynumber ?? '',
        policyExpiry: c.policy_expiry ?? c.policyexpiry ?? '',
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
        vehiclePrice: String(price),
        omvicFee: String(omvic),
        subtotal1: String(subtotal1),
        netDifference: String(netDiff),
        hstOnNetDifference: String(hst),
        totalTax: String(totalTax),
        licenseFee: String(licenseFee),
        feesTotal: String(feesTotal),
        accessoriesTotal: String(accessoriesTotal),
        warrantiesTotal: String(warrantiesTotal),
        insurancesTotal: String(insurancesTotal),
        paymentsTotal: String(paymentsTotal),
        subtotal2: String(subtotal2),
        deposit: String(deposit),
        downPayment: String(downPayment),
        taxOnInsurance: String(taxInsurance),
        totalBalanceDue: String(totalDue),
        extendedWarranty: 'DECLINED',
        commentsHtml: disc.disclosures_html ?? '',
        purchaserName: fullName,
        purchaserSignatureB64: c.signature ?? undefined,
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
      const res = await fetch(`/api/deals/${encodeURIComponent(dealId)}`)
      const deal = res.ok ? await res.json() : null
      const c = deal?.customer || {}
      const toEmail = String(c.email ?? '').trim()
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

      const parseFeeItems = (raw: any): any[] => {
        if (!raw) return []
        if (Array.isArray(raw)) return raw
        if (typeof raw === 'string') {
          try {
            const parsed = JSON.parse(raw)
            return Array.isArray(parsed) ? parsed : []
          } catch {
            return []
          }
        }
        return []
      }

      const getOmvicFromFees = (rawFees: any): number => {
        const fees = parseFeeItems(rawFees)
        for (const f of fees) {
          const name = String(f?.fee_name ?? f?.name ?? f?.label ?? '').toLowerCase()
          if (!name) continue
          if (name.includes('omvic')) {
            const amt = Number(f?.fee_amount ?? f?.amount ?? f?.value ?? 0)
            return Number.isFinite(amt) ? amt : 0
          }
        }
        return 0
      }

      const price = Number(w.purchase_price ?? v.price ?? 0)
      const omvic = Number(w.omvic_fee ?? getOmvicFromFees(w.fees) ?? 0)
      const discount = Number(w.discount ?? 0)
      const subtotal1 = price + omvic
      const tradeValue = Number(w.trade_value ?? 0)
      const lienPayout = Number(w.lien_payout ?? 0)
      const netDiff = subtotal1 - discount - tradeValue + lienPayout
      const taxRate = Number(w.tax_rate ?? 0.13)
      const hst = netDiff * taxRate
      const totalTax = hst
      const licenseFee = Number(w.license_fee ?? 91)

      const sumItems = (raw: any, amtKey: string) => {
        const items = parseFeeItems(raw)
        return items.reduce((s: number, i: any) => s + (Number(i?.[amtKey] ?? 0) || 0), 0)
      }
      const feesTotal = sumItems(w.fees, 'amount')
      const accessoriesTotal = sumItems(w.accessories, 'price')
      const warrantiesTotal = sumItems(w.warranties, 'amount')
      const insurancesTotal = sumItems(w.insurances, 'amount')
      const paymentsTotal = sumItems(w.payments, 'amount')

      const subtotal2 = netDiff + totalTax + licenseFee + feesTotal + accessoriesTotal + warrantiesTotal + insurancesTotal + paymentsTotal
      const deposit = Number(w.deposit ?? 0)
      const downPayment = Number(w.down_payment ?? 0)
      const taxInsurance = Number(w.tax_on_insurance ?? 0)
      const totalDue = subtotal2 - deposit - downPayment + taxInsurance

      const fullName = [c.firstname, c.lastname].filter(Boolean).join(' ') || [c.first_name, c.last_name].filter(Boolean).join(' ') || ''

      const billData: BillOfSaleData = {
        dealDate: dealDate ? new Date(dealDate + 'T00:00:00').toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' }) : '',
        invoiceNumber: String(dealId || ''),
        fullName,
        phone: c.phone ?? '',
        mobile: c.mobile ?? '',
        email: toEmail,
        address: c.street_address ?? c.streetaddress ?? '',
        city: c.city ?? '',
        province: c.province ?? 'ON',
        postalCode: c.postal_code ?? c.postalcode ?? '',
        driversLicense: c.drivers_license ?? c.driverslicense ?? '',
        insuranceCompany: c.insurance_company ?? c.insurancecompany ?? '',
        policyNumber: c.policy_number ?? c.policynumber ?? '',
        policyExpiry: c.policy_expiry ?? c.policyexpiry ?? '',
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
        vehiclePrice: String(price),
        omvicFee: String(omvic),
        subtotal1: String(subtotal1),
        netDifference: String(netDiff),
        hstOnNetDifference: String(hst),
        totalTax: String(totalTax),
        licenseFee: String(licenseFee),
        feesTotal: String(feesTotal),
        accessoriesTotal: String(accessoriesTotal),
        warrantiesTotal: String(warrantiesTotal),
        insurancesTotal: String(insurancesTotal),
        paymentsTotal: String(paymentsTotal),
        subtotal2: String(subtotal2),
        deposit: String(deposit),
        downPayment: String(downPayment),
        taxOnInsurance: String(taxInsurance),
        totalBalanceDue: String(totalDue),
        extendedWarranty: 'DECLINED',
        commentsHtml: disc.disclosures_html ?? '',
        purchaserName: fullName,
        purchaserSignatureB64: c.signature ?? undefined,
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
          const origin = window.location.origin
          return `${origin}/admin/sales/deals/signature?dealId=${encodeURIComponent(String(dealId || ''))}`
        } catch {
          return null
        }
      })()

      const formData = new FormData()
      formData.append('email', toEmail)
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
                {emailLoading ? 'Sending...' : 'Email'}
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
              <div style={{ display: activeTab === 'customers' ? 'block' : 'none' }}>
                <CustomersTabNew
                  hideAddButton={!isRetail}
                  dealId={dealId}
                  dealDate={dealDate}
                  dealType={dealType}
                  dealMode={isRetail ? 'RTL' : 'WHL'}
                  onSaved={() => setActiveTab('vehicles')}
                  initialData={prefill?.customer ?? null}
                />
              </div>
              <div style={{ display: activeTab === 'vehicles' ? 'block' : 'none' }}>
                <VehiclesTab
                  dealId={dealId}
                  dealMode={isRetail ? 'RTL' : 'WHL'}
                  dealType={dealType}
                  onSaved={() => setActiveTab('worksheet')}
                  initialData={prefill?.vehicles ?? (autoSavedVehicles ? [{ id: dealId }] : null)}
                  autoSaved={autoSavedVehicles}
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
                />
              </div>
              <div style={{ display: activeTab === 'worksheet' ? 'block' : 'none' }}>
                <WorksheetTab
                  dealId={dealId}
                  dealMode={isRetail ? 'RTL' : 'WHL'}
                  dealType={dealType}
                  dealDate={dealDate}
                  formMode={formMode}
                  onSaved={() => setActiveTab('disclosures')}
                  autoSaved={autoSavedWorksheet}
                  initialData={prefill?.worksheet ?? (
                    initialVehicleId && vehiclePrefill?.vehicle ? {
                      ...(autoSavedWorksheet ? { id: dealId } : {}),
                      purchase_price: String(getVehicleSellPrice(vehiclePrefill.vehicle)),
                      discount: '0',
                      tax_code: 'HST',
                      license_fee: vehiclePrefill?.purchase?.license_fee ?? '',
                      trade_value: '0',
                      actual_cash_value: '0',
                      lien_payout: '0',
                    } : null
                  )}
                />
              </div>
              <div style={{ display: activeTab === 'disclosures' ? 'block' : 'none' }}>
                <DisclosuresTab
                  dealId={dealId}
                  dealMode={isRetail ? 'RTL' : 'WHL'}
                  dealType={dealType}
                  formMode={formMode}
                  onSaved={() => setActiveTab('delivery')}
                  autoSaved={autoSavedDisclosures}
                  initialData={prefill?.disclosures ?? (
                    initialVehicleId && vehiclePrefill?.disclosures && vehiclePrefill.disclosures.length > 0
                      ? {
                          ...(autoSavedDisclosures ? { id: dealId } : {}),
                          disclosures_html: vehiclePrefill.disclosures.map((d: any) => `<p><strong>${d.disclosures_tittle || ''}</strong></p><p>${d.disclosures_body || ''}</p>`).join(''),
                          conditions: '',
                        }
                      : null
                  )}
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
