'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
import {
  ArrowLeft, ArrowRight, CheckCircle2, ChevronDown, Copy, CreditCard,
  FileSignature, FileText, IdCard, Mail,
  Package, ShieldAlert, ShieldCheck, Shield,
  Sparkles, User, Upload, FileCheck2, X, Eraser,
} from 'lucide-react'
import { warrantyPlans, getGroupedPlans, type WarrantyPlan } from '@/lib/bridgewarranty'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface CustomerInfo {
  firstName: string; middleName: string; lastName: string
  email: string; phone: string; addressLine1: string
  city: string; province: string; postalCode: string; dob: string
  licenceNumber: string; licenceExpiry: string
}

interface FileRef {
  name: string; size: number; type: string; dataUrl: string | null; uploadedAt: string
}

interface SignatureRecord {
  typedName: string; drawnDataUrl: string; signedAt: string
}

interface WarrantySelection {
  planSlug: string; planName: string; termLabel: string; total: number
}

type AddOnId =
  | 'delivery'
  | 'ppf_partial'
  | 'ppf_full_front'
  | 'ppf_full_body'
  | 'ceramic_1yr'
  | 'ceramic_5yr'
  | 'ceramic_lifetime'

interface AddOn {
  id: AddOnId
  group: 'delivery' | 'ppf' | 'ceramic'
  label: string
  description: string
  price: number
  taxable: boolean
}

interface PricingLineItem {
  label: string; amount: number; taxable: boolean
  waived?: boolean; originalAmount?: number
}

interface PricingBreakdown {
  salePrice: number
  lineItems: PricingLineItem[]
  addOns: Array<{ id: string; label: string; amount: number; taxable: boolean }>
  warrantyLine: { label: string; amount: number } | null
  hst: number; total: number; deposit: number; balanceDue: number
}

interface Order {
  id: string; vehicleId: string
  vehicleSnapshot: {
    id: string; year: number; make: string; model: string; trim: string
    stockNumber: string; vin: string; salePrice: number; image: string; listingType: string
  }
  customer: CustomerInfo
  pricing: PricingBreakdown
  selectedAddOnIds: AddOnId[]
  warranty: WarrantySelection | null
  warrantyDeclined: boolean
  documents: { licenceFront: FileRef | null; licenceBack: FileRef | null }
  carfax: { acknowledgedAt: string | null; initialDataUrl: string | null; typedInitials?: string | null }
  signatures: {
    billOfSaleCustomer: SignatureRecord | null
    dealerGuaranteeCustomer: SignatureRecord | null
  }
  status: 'deposit_pending'
  depositSentByCustomerAt: string | null
  events: Array<{ at: string; type: string; actor: string; note?: string }>
  createdAt: string
}

interface Vehicle {
  id: string; make: string; model: string; trim: string; year: number
  price: number; mileage: number; vin: string; stockNumber: string
  image: string; listingType: string; category: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const STEPS = [
  { key: 'customer',  label: 'Your details',      Icon: User },
  { key: 'licence',   label: "Driver's licence",  Icon: IdCard },
  { key: 'warranty',  label: 'Extended warranty', Icon: Shield },
  { key: 'addons',    label: 'Add-ons',           Icon: Sparkles },
  { key: 'carfax',    label: 'CARFAX review',     Icon: FileText },
  { key: 'bos',       label: 'Bill of Sale',      Icon: FileSignature },
  { key: 'guarantee', label: 'Dealer Guarantee',  Icon: ShieldCheck },
  { key: 'deposit',   label: 'Deposit terms',     Icon: ShieldAlert },
  { key: 'etransfer', label: 'Send e-transfer',   Icon: Mail },
  { key: 'confirm',   label: 'Confirmation',      Icon: CheckCircle2 },
] as const

const ADDONS: AddOn[] = [
  { id: 'delivery',         group: 'delivery', label: 'Home Delivery (Ontario)',    description: 'Doorstep delivery anywhere in ON. Outside ON quoted separately.', price: 299,  taxable: true },
  { id: 'ppf_partial',      group: 'ppf',      label: 'PPF — Partial Front',        description: 'Bumper, partial hood, partial fenders, mirror caps.',              price: 899,  taxable: true },
  { id: 'ppf_full_front',   group: 'ppf',      label: 'PPF — Full Front',           description: 'Full bumper, full hood, full fenders, mirrors.',                   price: 1799, taxable: true },
  { id: 'ppf_full_body',    group: 'ppf',      label: 'PPF — Full Body',            description: 'Self-healing film over the entire painted body.',                  price: 4995, taxable: true },
  { id: 'ceramic_1yr',      group: 'ceramic',  label: 'Ceramic Coating - 1 year',   description: 'Entry-level hydrophobic protection.',                              price: 499,  taxable: true },
  { id: 'ceramic_5yr',      group: 'ceramic',  label: 'Ceramic Coating - 5 year',   description: 'Multi-layer professional grade coating.',                          price: 1299, taxable: true },
  { id: 'ceramic_lifetime', group: 'ceramic',  label: 'Ceramic Coating - Lifetime', description: 'Lifetime warranty graphene coating.',                              price: 2495, taxable: true },
]

const BRAND_BLUE = '#1aa6ff'

const DEPOSIT = 1000
const HST_RATE = 0.13
const PREMIER_DOC_FEE_LIST = 999
const PREMIER_ADMIN_FEE_LIST = 999
const PREMIER_OMVIC_FEE = 22
const PREMIER_LICENSING = 59
const STANDARD_DOC_FEE = 599
const STANDARD_LICENSING = 120
const STORAGE_KEY = 'edc.orders.v2'

// ─────────────────────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────────────────────

function fullName(c: CustomerInfo): string {
  return [c.firstName, c.middleName, c.lastName].filter(Boolean).join(' ')
}

function generateOrderId(): string {
  const d = new Date()
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase()
  return `ORD-${ymd}-${rand}`
}

function saveOrder(order: Order): void {
  if (typeof window === 'undefined') return
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const orders: Order[] = raw ? JSON.parse(raw) : []
    const idx = orders.findIndex(o => o.vehicleId === order.vehicleId)
    if (idx >= 0) orders[idx] = order
    else orders.push(order)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(orders))
  } catch { /* ignore */ }
}

function activeOrderForVehicle(vehicleId: string): Order | undefined {
  if (typeof window === 'undefined') return undefined
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const orders: Order[] = raw ? JSON.parse(raw) : []
    return orders.find(o => o.vehicleId === vehicleId && (o.status as string) !== 'picked_up' && (o.status as string) !== 'cancelled')
  } catch {
    return undefined
  }
}

function computePricing(
  salePrice: number,
  category: string,
  selectedAddOnIds: AddOnId[] = [],
  warranty: WarrantySelection | null = null,
): PricingBreakdown {
  const lineItems: PricingLineItem[] = []

  if (category === 'premier') {
    lineItems.push({ label: 'Documentation Fee', amount: 0, taxable: false, waived: true, originalAmount: PREMIER_DOC_FEE_LIST })
    lineItems.push({ label: 'Dealer Admin Fee',   amount: 0, taxable: false, waived: true, originalAmount: PREMIER_ADMIN_FEE_LIST })
    lineItems.push({ label: 'OMVIC Fee',           amount: PREMIER_OMVIC_FEE,  taxable: true })
    lineItems.push({ label: 'New Plates / Licensing', amount: PREMIER_LICENSING, taxable: false })
  } else {
    lineItems.push({ label: 'Documentation Fee', amount: STANDARD_DOC_FEE,    taxable: true })
    lineItems.push({ label: 'Licensing',          amount: STANDARD_LICENSING,  taxable: false })
  }

  const addOns = selectedAddOnIds
    .map(id => ADDONS.find(a => a.id === id))
    .filter((a): a is AddOn => Boolean(a))
    .map(a => ({ id: a.id, label: a.label, amount: a.price, taxable: a.taxable }))

  const warrantyLine = warranty
    ? { label: `Vehicle Service Contract - ${warranty.planName}`, amount: warranty.total }
    : null

  const warrantyAmount = warranty?.total ?? 0

  const taxableBase =
    salePrice +
    lineItems.filter(l => l.taxable).reduce((s, l) => s + l.amount, 0) +
    addOns.filter(a => a.taxable).reduce((s, a) => s + a.amount, 0) +
    warrantyAmount

  const hst = Math.round(taxableBase * HST_RATE)
  const lineSum = lineItems.reduce((s, l) => s + l.amount, 0)
  const addOnSum = addOns.reduce((s, a) => s + a.amount, 0)
  const total = salePrice + lineSum + addOnSum + warrantyAmount + hst

  return {
    salePrice, lineItems, addOns, warrantyLine, hst, total,
    deposit: DEPOSIT, balanceDue: total - DEPOSIT,
  }
}

function fmt(n: number): string {
  return n.toLocaleString('en-CA')
}

function validateCustomer(c: CustomerInfo): Record<string, string> {
  const e: Record<string, string> = {}
  if (!c.firstName.trim()) e.firstName = 'First name required'
  if (!c.lastName.trim()) e.lastName = 'Last name required'
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(c.email.trim())) e.email = 'Valid email required'
  if (c.phone.replace(/\D/g, '').length < 10) e.phone = 'Phone required (10+ digits)'
  if (c.addressLine1.trim().length < 3) e.addressLine1 = 'Address required'
  if (c.city.trim().length < 2) e.city = 'City required'
  if (!c.province.trim()) e.province = 'Province required'
  if (c.postalCode.trim().length < 5) e.postalCode = 'Postal code required'
  if (!c.dob || c.dob.length < 8) e.dob = 'Date of birth required'
  if (!c.licenceNumber.trim()) e.licenceNumber = 'Licence number required'
  if (!c.licenceExpiry) e.licenceExpiry = 'Expiry date required'
  return e
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────────────────────

export default function PurchasePage() {
  const params = useParams()
  const vehicleId = String(params.vehicleId || '')

  const [vehicle, setVehicle] = useState<Vehicle | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!vehicleId) return
    const loadVehicle = async () => {
      try {
        const { data, error } = await supabase
          .from('edc_vehicles')
          .select('*')
          .eq('id', vehicleId)
          .maybeSingle()

        if (error || !data) { setLoading(false); return }

        let image = ''
        try {
          const { data: files } = await supabase.storage
            .from('vehicle-photos')
            .list(String(data.id), { limit: 1, sortBy: { column: 'name', order: 'asc' } })
          if (files && files.length > 0 && files[0].name) {
            const path = `${data.id}/${files[0].name}`
            const pub = supabase.storage.from('vehicle-photos').getPublicUrl(path)
            image = String(pub?.data?.publicUrl || '')
          }
        } catch { /* no image */ }

        const rawCat = String(data.categories || data.inventory_type || '').trim().toLowerCase()
        const category =
          rawCat === 'premiere' || rawCat === 'premier' ? 'premier'
          : rawCat === 'fleet'      ? 'fleet'
          : rawCat === 'private'    ? 'private'
          : rawCat === 'dealership' ? 'dealership'
          : 'premier'

        const listingType =
          category === 'premier'    ? 'EDC Premier'
          : category === 'fleet'      ? 'Fleet Select'
          : category === 'private'    ? 'Private Seller'
          : 'Dealer Select'

        setVehicle({
          id: String(data.id),
          make: String(data.make || ''),
          model: String(data.model || ''),
          trim: String(data.series || ''),
          year: Number(data.year || 0),
          price: Number(data.price || 0),
          mileage: Number((data.odometer ?? data.mileage) || 0),
          vin: String(data.vin || ''),
          stockNumber: String(data.stock_number || ''),
          image,
          listingType,
          category,
        })

        // If vehicle is back In Stock (e.g. submission was declined), clear the stale localStorage order
        const dbStatus = String(data.status || '').toLowerCase()
        if (dbStatus === 'in stock' || dbStatus === 'in_stock' || dbStatus === '') {
          try {
            const raw = localStorage.getItem(STORAGE_KEY)
            if (raw) {
              const orders: Order[] = JSON.parse(raw)
              const filtered = orders.filter(o => o.vehicleId !== String(data.id))
              localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered))
            }
          } catch { /* ignore */ }
        }
      } catch { /* ignore */ } finally {
        setLoading(false)
      }
    }
    void loadVehicle()
  }, [vehicleId])

  const [step, setStep] = useState(0)
  const [orderId, setOrderId] = useState('')
  useEffect(() => { if (!orderId) setOrderId(generateOrderId()) }, [orderId])

  const [customer, setCustomer] = useState<CustomerInfo>({
    firstName: '', middleName: '', lastName: '',
    email: '', phone: '', addressLine1: '',
    city: '', province: '', postalCode: '', dob: '',
    licenceNumber: '', licenceExpiry: '',
  })
  const [customerErrors, setCustomerErrors] = useState<Record<string, string>>({})

  const [licenceFront, setLicenceFront] = useState<FileRef | null>(null)
  const [licenceBack,  setLicenceBack]  = useState<FileRef | null>(null)

  const [warrantySelection, setWarrantySelection] = useState<WarrantySelection | null>(null)
  const [warrantyDeclined,  setWarrantyDeclined]  = useState(false)
  const [warrantyTermsAck,  setWarrantyTermsAck]  = useState(false)

  const [selectedAddOns, setSelectedAddOns] = useState<AddOnId[]>([])

  const [carfaxInitial,  setCarfaxInitial]  = useState<string | null>(null)
  const [carfaxAck,      setCarfaxAck]      = useState(false)
  const [carfaxTyped,    setCarfaxTyped]    = useState('')
  const [carfaxUseTyped, setCarfaxUseTyped] = useState(false)

  const [bosTyped,     setBosTyped]     = useState('')
  const [bosDrawn,     setBosDrawn]     = useState<string | null>(null)
  const [bosAgree,     setBosAgree]     = useState(false)
  const [bosUseTyped,  setBosUseTyped]  = useState(false)

  const [dgTyped,    setDgTyped]    = useState('')
  const [dgDrawn,    setDgDrawn]    = useState<string | null>(null)
  const [dgAgree,    setDgAgree]    = useState(false)
  const [dgUseTyped, setDgUseTyped] = useState(false)

  const [agreeDeposit,    setAgreeDeposit]    = useState(false)
  const [agreeDiscretion, setAgreeDiscretion] = useState(false)

  const [etransferSent, setEtransferSent] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const pricing = useMemo(
    () => vehicle ? computePricing(vehicle.price, vehicle.category, selectedAddOns, warrantySelection) : null,
    [vehicle, selectedAddOns, warrantySelection],
  )

  const canNext: boolean = (() => {
    const key = STEPS[step].key
    if (key === 'customer')  return true  // validation runs on click via goNext
    if (key === 'licence')   return !!licenceFront && !!licenceBack
    if (key === 'warranty')  return (warrantySelection !== null || warrantyDeclined) && (warrantyDeclined || warrantyTermsAck)
    if (key === 'addons')    return true
    if (key === 'carfax')    return (carfaxUseTyped ? carfaxTyped.trim().length > 1 : !!carfaxInitial) && carfaxAck
    if (key === 'bos')       return bosTyped.trim().length > 1 && (bosUseTyped || !!bosDrawn) && bosAgree
    if (key === 'guarantee') return dgTyped.trim().length > 1 && (dgUseTyped || !!dgDrawn) && dgAgree
    if (key === 'deposit')   return agreeDeposit && agreeDiscretion
    if (key === 'etransfer') return etransferSent
    return true
  })()

  const goNext = () => {
    if (STEPS[step].key === 'customer') {
      const errs = validateCustomer(customer)
      if (Object.keys(errs).length > 0) { setCustomerErrors(errs); return }
      setCustomerErrors({})
    }
    if (STEPS[step].key === 'etransfer') { void finalize(); return }
    setStep(s => Math.min(STEPS.length - 1, s + 1))
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const finalize = async () => {
    if (!vehicle || !pricing) return
    setSubmitting(true)
    setSubmitError(null)
    const now = new Date().toISOString()
    const sigBoS: SignatureRecord = { typedName: bosTyped.trim(), drawnDataUrl: bosDrawn!, signedAt: now }
    const sigDG:  SignatureRecord = { typedName: dgTyped.trim(),  drawnDataUrl: dgDrawn!,  signedAt: now }
    const order: Order = {
      id: orderId, vehicleId: vehicle.id,
      vehicleSnapshot: {
        id: vehicle.id, year: vehicle.year, make: vehicle.make, model: vehicle.model,
        trim: vehicle.trim, stockNumber: vehicle.stockNumber, vin: vehicle.vin,
        salePrice: vehicle.price, image: vehicle.image, listingType: vehicle.listingType,
      },
      customer, pricing,
      selectedAddOnIds: selectedAddOns,
      warranty: warrantySelection, warrantyDeclined,
      documents: { licenceFront, licenceBack },
      carfax: { acknowledgedAt: now, initialDataUrl: carfaxInitial, typedInitials: carfaxUseTyped ? carfaxTyped.trim() : null },
      signatures: { billOfSaleCustomer: sigBoS, dealerGuaranteeCustomer: sigDG },
      status: 'deposit_pending',
      depositSentByCustomerAt: now,
      events: [
        { at: now, type: 'order_created',               actor: 'customer' },
        { at: now, type: 'licence_uploaded',            actor: 'customer' },
        { at: now, type: warrantyDeclined ? 'warranty_declined' : 'warranty_selected', actor: 'customer',
          note: warrantySelection ? `${warrantySelection.planName} - ${warrantySelection.termLabel} - $${warrantySelection.total}` : 'declined' },
        { at: now, type: 'addons_selected',             actor: 'customer', note: selectedAddOns.join(',') || 'none' },
        { at: now, type: 'carfax_acknowledged',         actor: 'customer' },
        { at: now, type: 'bill_of_sale_signed_customer',actor: 'customer' },
        { at: now, type: 'dealer_guarantee_signed',     actor: 'customer' },
        { at: now, type: 'deposit_terms_acknowledged',  actor: 'customer' },
        { at: now, type: 'deposit_marked_sent',         actor: 'customer' },
      ],
      createdAt: now,
    }
    saveOrder(order)

    // Save to DB for dealer approval
    try {
      const res = await fetch('/api/purchase-submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vehicle_id: vehicle.id,
          vehicle_year: vehicle.year,
          vehicle_make: vehicle.make,
          vehicle_model: vehicle.model,
          vehicle_trim: vehicle.trim,
          vehicle_vin: vehicle.vin,
          vehicle_stock_number: vehicle.stockNumber,
          vehicle_price: vehicle.price,
          customer_first_name: customer.firstName,
          customer_last_name: customer.lastName,
          customer_email: customer.email,
          customer_phone: customer.phone,
          customer_address: customer.addressLine1,
          customer_city: customer.city,
          customer_province: customer.province,
          customer_postal_code: customer.postalCode,
          deposit_amount: pricing.deposit,
          total_price: pricing.total,
          hst: pricing.hst,
          warranty_name: warrantySelection?.planName ?? null,
          warranty_total: warrantySelection?.total ?? null,
          add_ons: selectedAddOns,
          order_data: order,
          submitted_at: now,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        const msg = (data as any)?.error || `Server error (${res.status})`
        setSubmitError(msg)
        setSubmitting(false)
        return
      }
    } catch {
      setSubmitError('Network error — please check your connection and try again.')
      setSubmitting(false)
      return
    }

    setSubmitting(false)
    setStep(STEPS.length - 1)
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const copyToClipboard = (text: string, key: string) => {
    void navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
  }

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-gray-500 text-sm">Loading vehicle details...</div>
      </div>
    )
  }

  if (!vehicle) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Vehicle not found</h1>
          <p className="mt-2 text-gray-500">This vehicle may no longer be available.</p>
          <Link href="/inventory" className="mt-6 inline-block btn-primary px-6 py-3 rounded-xl">
            Back to Inventory
          </Link>
        </div>
      </div>
    )
  }

  const existing = typeof window !== 'undefined' ? activeOrderForVehicle(vehicleId) : undefined
  if (existing && step === 0) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="w-full max-w-md rounded-2xl border border-amber-200 bg-amber-50 p-8 text-center">
          <ShieldAlert className="mx-auto h-12 w-12 text-amber-500" />
          <h1 className="mt-4 text-xl font-bold text-gray-900">Vehicle already under contract</h1>
          <p className="mt-2 text-sm text-gray-600">
            Order <span className="font-mono font-semibold">{existing.id}</span> is already active for this vehicle.
          </p>
          <Link href="/inventory" className="mt-6 inline-block btn-primary px-6 py-3 rounded-xl text-sm">
            Browse inventory
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 bg-gray-50">
      <div className="section-container pt-6 pb-2">
        <Link href={`/inventory/${vehicleId}`} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition">
          <ArrowLeft className="h-4 w-4" />
          Back to vehicle
        </Link>
      </div>

      <div className="section-container pb-8">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_360px]">

          <div className="min-w-0">
            <Stepper current={step} onJump={(i) => { if (i < step) setStep(i) }} />

            <div className="mt-6 rounded-2xl border border-gray-200 bg-white shadow-soft overflow-hidden">
              <div className="p-6 sm:p-8">

                {STEPS[step].key === 'customer' && (
                  <StepCustomer customer={customer} setCustomer={setCustomer} errors={customerErrors} />
                )}
                {STEPS[step].key === 'licence' && (
                  <StepLicence front={licenceFront} back={licenceBack} onFront={setLicenceFront} onBack={setLicenceBack} />
                )}
                {STEPS[step].key === 'warranty' && (
                  <StepWarranty
                    selection={warrantySelection}
                    setSelection={(s) => { setWarrantySelection(s); if (s) setWarrantyDeclined(false) }}
                    declined={warrantyDeclined}
                    setDeclined={(d) => { setWarrantyDeclined(d); if (d) setWarrantySelection(null) }}
                    termsAck={warrantyTermsAck}
                    setTermsAck={setWarrantyTermsAck}
                  />
                )}
                {STEPS[step].key === 'addons' && (
                  <StepAddOns selected={selectedAddOns} setSelected={setSelectedAddOns} />
                )}
                {STEPS[step].key === 'carfax' && (
                  <StepCarfax
                    vehicleId={vehicle.id}
                    vin={vehicle.vin}
                    initial={carfaxInitial} setInitial={setCarfaxInitial}
                    ack={carfaxAck} setAck={setCarfaxAck}
                    typed={carfaxTyped} setTyped={setCarfaxTyped}
                    useTyped={carfaxUseTyped} setUseTyped={setCarfaxUseTyped}
                  />
                )}
                {STEPS[step].key === 'bos' && pricing && (
                  <StepSign
                    title="Sign your Bill of Sale"
                    contentTitle="Bill of Sale Preview"
                    content={<BillOfSaleContent vehicle={vehicle} customer={customer} pricing={pricing} orderId={orderId} />}
                    agreeLabel="I have read the Bill of Sale and agree to the terms."
                    typed={bosTyped} setTyped={setBosTyped}
                    drawn={bosDrawn} setDrawn={setBosDrawn}
                    agree={bosAgree} setAgree={setBosAgree}
                    customerName={`${customer.firstName} ${customer.lastName}`.trim()}
                    useTyped={bosUseTyped} setUseTyped={setBosUseTyped}
                  />
                )}
                {STEPS[step].key === 'guarantee' && (
                  <StepSign
                    title="Sign the 30-Day Dealer Guarantee"
                    contentTitle="Dealer Guarantee Policy"
                    content={<DealerGuaranteeContent />}
                    agreeLabel="I acknowledge and agree to the 30-Day Dealer Guarantee."
                    typed={dgTyped} setTyped={setDgTyped}
                    drawn={dgDrawn} setDrawn={setDgDrawn}
                    agree={dgAgree} setAgree={setDgAgree}
                    customerName={`${customer.firstName} ${customer.lastName}`.trim()}
                    useTyped={dgUseTyped} setUseTyped={setDgUseTyped}
                  />
                )}
                {STEPS[step].key === 'deposit' && (
                  <StepDeposit
                    agreeDeposit={agreeDeposit} setAgreeDeposit={setAgreeDeposit}
                    agreeDiscretion={agreeDiscretion} setAgreeDiscretion={setAgreeDiscretion}
                  />
                )}
                {STEPS[step].key === 'etransfer' && (
                  <StepEtransfer
                    orderId={orderId} customerEmail={customer.email}
                    sent={etransferSent} setSent={setEtransferSent}
                    copied={copied} onCopy={copyToClipboard}
                  />
                )}
                {STEPS[step].key === 'confirm' && (
                  <StepConfirm orderId={orderId} customerEmail={customer.email} />
                )}
              </div>

              {STEPS[step].key !== 'confirm' && (
                <div className="flex items-center justify-between border-t border-gray-100 bg-white px-6 py-4 sm:px-8">
                  <button
                    type="button"
                    onClick={() => setStep(s => Math.max(0, s - 1))}
                    disabled={step === 0}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
                  >
                    <ArrowLeft className="h-4 w-4" /> Back
                  </button>
                  <button
                    type="button"
                    onClick={goNext}
                    disabled={!canNext || submitting}
                    className="btn-primary inline-flex items-center gap-1.5 px-6 py-2.5 text-sm rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submitting ? 'Submitting…' : STEPS[step].key === 'etransfer' ? 'Submit sale request' : 'Continue'}
                    {!submitting && <ArrowRight className="h-4 w-4" />}
                  </button>
                </div>
              )}
              {submitError && (
                <p className="px-6 pb-4 text-sm text-red-600 text-right">{submitError}</p>
              )}

              {STEPS[step].key === 'confirm' && (
                <div className="flex flex-wrap items-center justify-end gap-3 border-t border-gray-100 bg-white px-6 py-4 sm:px-8">
                  <Link href="/inventory" className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 px-5 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 transition">
                    Browse more vehicles
                  </Link>
                  <Link href="/" className="btn-primary px-5 py-2.5 text-sm rounded-xl">
                    Back to Home
                  </Link>
                </div>
              )}
            </div>
          </div>

          {pricing && (
            <SummarySidebar vehicle={vehicle} pricing={pricing} orderId={orderId} step={step} />
          )}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Stepper
// ─────────────────────────────────────────────────────────────────────────────

function Stepper({ current, onJump }: { current: number; onJump: (i: number) => void }) {
  const scrollerRef = useRef<HTMLOListElement>(null)
  const itemRefs = useRef<Array<HTMLLIElement | null>>([])

  useEffect(() => {
    const el = itemRefs.current[current]
    const scroller = scrollerRef.current
    if (!el || !scroller) return
    const elLeft = el.offsetLeft
    const elRight = elLeft + el.offsetWidth
    const viewLeft = scroller.scrollLeft
    const viewRight = viewLeft + scroller.clientWidth
    if (elLeft < viewLeft + 12 || elRight > viewRight - 12) {
      scroller.scrollTo({
        left: Math.max(0, elLeft - (scroller.clientWidth - el.offsetWidth) / 2),
        behavior: 'smooth',
      })
    }
  }, [current])

  return (
    <ol
      ref={scrollerRef}
      className="flex items-center gap-1.5 overflow-x-auto rounded-full border border-gray-200 bg-white p-1.5 shadow-soft scroll-smooth [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
    >
      {STEPS.map((s, i) => {
        const done = i < current
        const active = i === current
        const clickable = i < current
        return (
          <li
            key={s.key}
            ref={el => { itemRefs.current[i] = el }}
            className="shrink-0"
          >
            <button
              type="button"
              onClick={() => onJump(i)}
              disabled={!clickable}
              className={`flex items-center gap-2 whitespace-nowrap rounded-full px-3.5 py-2 text-sm font-semibold transition ${
                active
                  ? 'bg-[#0B1C2D] text-white shadow-sm'
                  : clickable
                    ? 'text-gray-700 hover:bg-gray-100 cursor-pointer'
                    : 'text-gray-400 cursor-default'
              }`}
            >
              <span
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                  active
                    ? 'bg-white text-[#0B1C2D]'
                    : done
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-500'
                }`}
              >
                {done ? <CheckCircle2 className="h-3 w-3" /> : i + 1}
              </span>
              <span>{s.label}</span>
            </button>
          </li>
        )
      })}
    </ol>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 1 - Your Details
// ─────────────────────────────────────────────────────────────────────────────

function StepCustomer({
  customer, setCustomer, errors,
}: {
  customer: CustomerInfo
  setCustomer: (c: CustomerInfo) => void
  errors: Record<string, string>
}) {
  const set = (k: keyof CustomerInfo) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setCustomer({ ...customer, [k]: e.target.value })

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900">Tell us about you</h2>
      <p className="mt-1 text-sm text-gray-500">
        Enter your legal name exactly as it appears on your driver licence - this prints on your Bill of Sale.
      </p>
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Field label="First name *" error={errors.firstName}>
          <input className="input-field" value={customer.firstName} onChange={set('firstName')} placeholder="Jane" />
        </Field>
        <Field label="Middle name (optional)" error={errors.middleName}>
          <input className="input-field" value={customer.middleName} onChange={set('middleName')} placeholder="A." />
        </Field>
        <Field label="Last name *" error={errors.lastName}>
          <input className="input-field" value={customer.lastName} onChange={set('lastName')} placeholder="Doe" />
        </Field>
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field label="Date of birth *" error={errors.dob}>
          <input className="input-field" type="date" value={customer.dob} onChange={set('dob')} />
        </Field>
        <Field label="Email *" error={errors.email}>
          <input className="input-field" type="email" value={customer.email} onChange={set('email')} placeholder="you@example.com" />
        </Field>
        <Field label="Phone *" error={errors.phone}>
          <input className="input-field" type="tel" value={customer.phone} onChange={set('phone')} placeholder="(416) 555-0101" />
        </Field>
        <Field label="Address *" error={errors.addressLine1}>
          <input className="input-field" value={customer.addressLine1} onChange={set('addressLine1')} placeholder="123 Main St" />
        </Field>
        <Field label="City *" error={errors.city}>
          <input className="input-field" value={customer.city} onChange={set('city')} placeholder="Toronto" />
        </Field>
        <Field label="Province *" error={errors.province}>
          <input className="input-field" value={customer.province} onChange={set('province')} placeholder="ON" />
        </Field>
        <Field label="Postal code *" error={errors.postalCode}>
          <input className="input-field" value={customer.postalCode} onChange={set('postalCode')} placeholder="M5V 2T6" />
        </Field>
        <Field label="Driver's licence number *" error={errors.licenceNumber}>
          <input className="input-field" value={customer.licenceNumber} onChange={set('licenceNumber')} placeholder="A1234-56789-90123" />
        </Field>
        <Field label="Licence expiry date *" error={errors.licenceExpiry}>
          <input className="input-field" type="date" value={customer.licenceExpiry} onChange={set('licenceExpiry')} />
        </Field>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 2 - Driver Licence
// ─────────────────────────────────────────────────────────────────────────────

function StepLicence({
  front, back, onFront, onBack,
}: {
  front: FileRef | null; back: FileRef | null
  onFront: (f: FileRef | null) => void; onBack: (f: FileRef | null) => void
}) {
  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900">Upload your driver licence</h2>
      <p className="mt-1 text-sm text-gray-500">
        Required for identity verification. Images are used only for this purchase.
      </p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <FileUpload label="Front of licence" value={front} onChange={onFront} required />
        <FileUpload label="Back of licence"  value={back}  onChange={onBack}  required />
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 3 - Extended Warranty
// ─────────────────────────────────────────────────────────────────────────────

function lowestPlanPrice(plan: WarrantyPlan): number | null {
  return plan.pricingTiers.reduce<number | null>((min, t) => {
    const row = t.rows.find(r => r.label === 'Base Price')
    const first = row?.values.find(v => typeof v === 'number') as number | undefined
    if (first === undefined) return min
    return min === null || first < min ? first : min
  }, null)
}

function WarrantyPlanCard({
  plan,
  selection,
  setSelection,
  isActive,
  onActivate,
}: {
  plan: WarrantyPlan
  selection: WarrantySelection | null
  setSelection: (s: WarrantySelection | null) => void
  isActive: boolean
  onActivate: () => void
}) {
  const tier = plan.pricingTiers[0]
  const isSelected = selection?.planSlug === plan.slug
  const termLabel = tier?.terms[0]?.label ?? ''
  const lowestPrice = lowestPlanPrice(plan)

  return (
    <div
      onClick={() => {
        onActivate()
        if (isSelected) setSelection(null)
        else if (lowestPrice !== null) setSelection({ planSlug: plan.slug, planName: plan.name, termLabel, total: lowestPrice })
      }}
      className={`rounded-xl border p-3 cursor-pointer transition ${
        isSelected
          ? 'border-[#1aa6ff] bg-[#f0f9ff] ring-1 ring-[#1aa6ff]/20'
          : isActive
          ? 'border-slate-300 bg-slate-50'
          : 'border-slate-200 bg-white hover:border-slate-300'
      }`}
    >
      <div className="flex items-start justify-between gap-1 mb-0.5">
        <span className="font-semibold text-sm text-slate-900 leading-tight">{plan.name}</span>
        {plan.salesTag && (
          <span className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap" style={{ background: '#1aa6ff1a', color: '#1aa6ff' }}>
            {plan.salesTag.label}
          </span>
        )}
      </div>
      <div className="text-xs text-slate-400 mb-2">{plan.claimRange}</div>
      <div className={`w-full text-center rounded-full py-1.5 text-xs font-semibold transition pointer-events-none ${
        isSelected ? 'bg-[#1aa6ff] text-white' : 'border border-slate-300 text-slate-700'
      }`}>
        {isSelected ? '✓ Selected' : lowestPrice !== null ? `Select — $${lowestPrice.toLocaleString()}` : 'Contact us'}
      </div>
    </div>
  )
}

function WarrantyDetailPanel({ plan }: { plan: WarrantyPlan }) {
  const lowestPrice = lowestPlanPrice(plan)
  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-start justify-between gap-2 mb-0.5">
          <span className="font-bold text-slate-900 text-base leading-tight">{plan.name}</span>
          {plan.salesTag && (
            <span className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap" style={{ background: '#1aa6ff', color: '#fff' }}>
              {plan.salesTag.label}
            </span>
          )}
        </div>
        <div className="text-xs text-slate-500 leading-snug mb-1">{plan.eligibility}</div>
        <div className="text-xs text-slate-400">{plan.claimRange} · {plan.deductible} deductible</div>
        {lowestPrice !== null && (
          <div className="mt-2 text-sm font-bold" style={{ color: '#1aa6ff' }}>Starting from ${lowestPrice.toLocaleString()}</div>
        )}
      </div>

      <div>
        <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Highlights</div>
        <ul className="space-y-1">
          {plan.highlights.map((h, i) => (
            <li key={i} className="flex items-start gap-1.5 text-xs text-slate-600">
              <span className="text-emerald-500 shrink-0">✓</span>{h}
            </li>
          ))}
        </ul>
      </div>

      <div>
        <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">What&apos;s covered</div>
        <div className="flex flex-wrap gap-1">
          {plan.includedCoverage.map((c, i) => (
            <span key={i} className="rounded-full px-2 py-0.5 text-[10px] bg-white border border-slate-200 text-slate-600">{c}</span>
          ))}
        </div>
      </div>

      {plan.benefits.length > 0 && (
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Benefits</div>
          <ul className="space-y-1">
            {plan.benefits.map((b, i) => (
              <li key={i} className="flex items-center justify-between gap-2 text-xs">
                <span className="text-slate-600">{b.name}</span>
                <span className="text-slate-400 shrink-0">{b.limit}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Coverage levels</div>
        <div className="space-y-1.5">
          {plan.pricingTiers.map((t, i) => {
            const row = t.rows.find(r => r.label === 'Base Price')
            const firstPrice = row?.values.find(v => typeof v === 'number') as number | undefined
            return firstPrice !== undefined ? (
              <div key={i} className="flex items-center justify-between text-xs bg-white rounded-lg px-3 py-2 border border-slate-200">
                <span className="text-slate-500">${t.perClaimAmount.toLocaleString()}/claim</span>
                <span className="font-semibold text-slate-800">from ${firstPrice.toLocaleString()}</span>
              </div>
            ) : null
          })}
        </div>
      </div>

      {plan.importantNotes && plan.importantNotes.length > 0 && (
        <div className="rounded-lg bg-amber-50 border border-amber-100 p-3 text-xs text-amber-800">
          <div className="font-semibold mb-1">Important notes</div>
          <ul className="space-y-0.5 list-disc list-inside">
            {plan.importantNotes.map((n, i) => <li key={i}>{n}</li>)}
          </ul>
        </div>
      )}
    </div>
  )
}

function StepWarranty({
  selection, setSelection, declined, setDeclined, termsAck, setTermsAck,
}: {
  selection: WarrantySelection | null
  setSelection: (s: WarrantySelection | null) => void
  declined: boolean; setDeclined: (b: boolean) => void
  termsAck: boolean; setTermsAck: (b: boolean) => void
}) {
  const grouped = getGroupedPlans('A-Protect')
  const [activePlan, setActivePlan] = useState<WarrantyPlan>(grouped[0])

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900">Extended warranty</h2>
      <p className="mt-1 text-sm text-gray-500">
        Protect your investment with an A-Protect vehicle service contract. You can also add one at pickup.
      </p>

      {/* Split panel */}
      <div className="mt-5 flex gap-4" style={{ height: '480px' }}>
        {/* Left — scrollable plan list */}
        <div className="flex flex-col gap-2 overflow-y-auto pr-1 shrink-0 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-track]:bg-slate-100 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300" style={{ width: '200px' }}>
          {grouped.map(plan => (
            <WarrantyPlanCard
              key={plan.slug}
              plan={plan}
              selection={selection}
              setSelection={s => { setSelection(s); if (s) setDeclined(false) }}
              isActive={activePlan.slug === plan.slug}
              onActivate={() => setActivePlan(plan)}
            />
          ))}
        </div>
        {/* Right — detail panel */}
        <div className="flex-1 overflow-y-auto rounded-2xl border border-slate-200 bg-[#f8fcff] p-5 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-track]:bg-slate-100 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-200">
          <WarrantyDetailPanel plan={activePlan} />
        </div>
      </div>

      {selection && (
        <div className="mt-4">
          <CheckItem checked={termsAck} onChange={setTermsAck}>
            I acknowledge the warranty terms and agree to pay <strong>${fmt(selection.total)}</strong> for the {selection.planName} ({selection.termLabel}).
          </CheckItem>
        </div>
      )}
      <div className="mt-4">
        <CheckItem checked={declined} onChange={v => { setDeclined(v); if (v) setSelection(null) }}>
          No thanks — I decline extended warranty coverage.
        </CheckItem>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 4 - Add-ons
// ─────────────────────────────────────────────────────────────────────────────

function StepAddOns({ selected, setSelected }: { selected: AddOnId[]; setSelected: (s: AddOnId[]) => void }) {
  const toggle = (a: AddOn) => {
    if (a.group === 'ppf' || a.group === 'ceramic') {
      const sameGroupIds = ADDONS.filter(x => x.group === a.group).map(x => x.id)
      const others = selected.filter(id => !sameGroupIds.includes(id))
      const isOn = selected.includes(a.id)
      setSelected(isOn ? others : [...others, a.id])
    } else {
      setSelected(selected.includes(a.id) ? selected.filter(id => id !== a.id) : [...selected, a.id])
    }
  }

  const groups: Array<{ key: AddOn['group']; title: string; subtitle: string }> = [
    { key: 'delivery', title: 'Home Delivery',              subtitle: 'Skip the trip - we bring the car to you.' },
    { key: 'ppf',      title: 'Paint Protection Film (PPF)', subtitle: 'Self-healing film that shields your paint from chips and scratches.' },
    { key: 'ceramic',  title: 'Ceramic Coating',            subtitle: 'Hydrophobic, gloss-enhancing paint protection.' },
  ]

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900">Customize your purchase</h2>
      <p className="mt-1 text-sm text-gray-500">Optional add-ons - select at most one tier per category.</p>
      <div className="mt-6 space-y-6">
        {groups.map(g => {
          const items = ADDONS.filter(a => a.group === g.key)
          return (
            <section key={g.key}>
              <div className="mb-3">
                <h3 className="text-sm font-semibold text-gray-900">{g.title}</h3>
                <p className="text-xs text-gray-500">{g.subtitle}</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {items.map(a => {
                  const on = selected.includes(a.id)
                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => toggle(a)}
                      className={`rounded-2xl border p-4 text-left transition ${on ? 'border-[#118df0] bg-blue-50 ring-2 ring-blue-200' : 'border-gray-200 bg-white hover:border-gray-300'}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="font-semibold text-sm text-gray-900">{a.label}</div>
                        <div className="text-sm font-bold tabular-nums text-gray-900">${fmt(a.price)}</div>
                      </div>
                      <p className="mt-1 text-xs text-gray-500">{a.description}</p>
                      <div className={`mt-3 inline-flex items-center gap-1 text-xs font-semibold ${on ? 'text-[#118df0]' : 'text-gray-400'}`}>
                        {on ? <><CheckCircle2 className="h-3.5 w-3.5" /> Added</> : 'Tap to add'}
                      </div>
                    </button>
                  )
                })}
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 5 - CARFAX Review
// ─────────────────────────────────────────────────────────────────────────────

function StepCarfax({
  vehicleId, vin, initial, setInitial, ack, setAck,
  typed, setTyped, useTyped, setUseTyped,
}: {
  vehicleId: string; vin: string; initial: string | null; setInitial: (s: string | null) => void; ack: boolean; setAck: (b: boolean) => void
  typed: string; setTyped: (s: string) => void
  useTyped: boolean; setUseTyped: (b: boolean) => void
}) {
  const [carfaxModal, setCarfaxModal] = useState<{
    open: boolean; loading: boolean
    files: { name: string; publicUrl: string }[]; activeIndex: number
  }>({ open: false, loading: false, files: [], activeIndex: 0 })

  const openCarfax = async () => {
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
        .filter(f => !!f?.name && !String(f.name).endsWith('/'))
        .map(f => {
          const path = `${vehicleId}/${f.name}`
          const { data: urlData } = supabase.storage.from('Carfax').getPublicUrl(path)
          return { name: f.name, publicUrl: urlData.publicUrl }
        })
      setCarfaxModal({ open: true, loading: false, files, activeIndex: 0 })
    } catch {
      setCarfaxModal({ open: true, loading: false, files: [], activeIndex: 0 })
    }
  }
  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900">Review the CARFAX report</h2>
      <p className="mt-1 text-sm text-gray-500">Confirm you have reviewed the vehicle history before proceeding.</p>
      <div className="mt-5 rounded-2xl border border-gray-200 bg-gray-50 p-5">
        <div className="flex items-start gap-3">
          <FileText className="h-6 w-6 text-red-500 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900">CARFAX Canada Report</h3>
            <p className="text-xs text-gray-500 mt-0.5">VIN: {vin || 'N/A'}</p>
            <p className="mt-2 text-sm text-gray-600">No accident/damage records found. Last registered in Ontario. Service records on file. No open recalls.</p>
            <button
              type="button"
              onClick={openCarfax}
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 transition"
            >
              Open full report
            </button>

          {/* CARFAX Modal */}
          {carfaxModal.open && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl flex flex-col" style={{ maxHeight: '90vh' }}>
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                  <span className="font-bold text-gray-900">CARFAX Report</span>
                  <div className="flex items-center gap-3">
                    {carfaxModal.files.length > 0 && (
                      <a href={carfaxModal.files[carfaxModal.activeIndex]?.publicUrl} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                        Open in new tab
                      </a>
                    )}
                    <button type="button" onClick={() => setCarfaxModal(m => ({ ...m, open: false }))} className="text-gray-400 hover:text-gray-600">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                </div>
                {carfaxModal.files.length > 1 && (
                  <div className="flex gap-2 px-5 pt-3">
                    {carfaxModal.files.map((f, i) => (
                      <button key={i} type="button"
                        onClick={() => setCarfaxModal(m => ({ ...m, activeIndex: i }))}
                        className={`px-3 py-1 rounded-lg text-xs font-medium border transition ${
                          carfaxModal.activeIndex === i ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                        }`}>{f.name}</button>
                    ))}
                  </div>
                )}
                <div className="flex-1 overflow-hidden p-4">
                  {carfaxModal.loading ? (
                    <div className="flex items-center justify-center h-48 text-gray-500 text-sm">Loading…</div>
                  ) : carfaxModal.files.length === 0 ? (
                    <div className="flex items-center justify-center h-48 text-gray-500 text-sm">No CARFAX report on file for this vehicle.</div>
                  ) : (
                    <iframe
                      src={carfaxModal.files[carfaxModal.activeIndex]?.publicUrl}
                      className="w-full rounded-lg border border-gray-200"
                      style={{ height: 'calc(90vh - 140px)' }}
                      title="CARFAX Report"
                    />
                  )}
                </div>
              </div>
            </div>
          )}
          </div>
        </div>
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-xs font-semibold text-gray-700">
              {useTyped ? 'Type your name here *' : 'Draw your signature *'}
            </label>
            <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs font-medium">
              <button
                type="button"
                onClick={() => setUseTyped(false)}
                className={`px-3 py-1 transition ${!useTyped ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
              >
                Draw
              </button>
              <button
                type="button"
                onClick={() => { setUseTyped(true); setInitial(null) }}
                className={`px-3 py-1 transition ${useTyped ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
              >
                Type
              </button>
            </div>
          </div>
          {useTyped ? (
            <div>
              <input
                className="input-field"
                value={typed}
                onChange={e => setTyped(e.target.value)}
                placeholder="Type your name here"
                maxLength={60}
              />
              {typed.trim() && (
                <div className="mt-2 flex items-center justify-center rounded-xl border border-gray-200 bg-white h-[80px]">
                  <span style={{ fontFamily: '"Brush Script MT", "Segoe Script", cursive', fontSize: '2rem', color: '#1e293b' }}>{typed}</span>
                </div>
              )}
            </div>
          ) : (
            <SignaturePad onChange={setInitial} height={120} />
          )}
          {(initial || (useTyped && typed.trim().length > 1)) && (
            <p className="mt-1.5 text-xs font-medium text-green-600"><CheckCircle2 className="inline h-3.5 w-3.5 mr-1" />{useTyped ? 'Signature applied' : 'Signature captured'}</p>
          )}
        </div>
        <div className="flex items-start pt-6">
          <CheckItem checked={ack} onChange={setAck}>
            I have reviewed the CARFAX report for this vehicle and accept it as part of my decision to purchase.
          </CheckItem>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 6 & 7 - Signature Steps
// ─────────────────────────────────────────────────────────────────────────────

function StepSign({
  title, contentTitle, content, agreeLabel,
  typed, setTyped, drawn, setDrawn, agree, setAgree, customerName,
  useTyped, setUseTyped,
}: {
  title: string; contentTitle: string; content: React.ReactNode; agreeLabel: string
  typed: string; setTyped: (s: string) => void
  drawn: string | null; setDrawn: (s: string | null) => void
  agree: boolean; setAgree: (b: boolean) => void
  customerName?: string
  useTyped: boolean; setUseTyped: (b: boolean) => void
}) {
  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900">{title}</h2>
      <p className="mt-1 text-sm text-gray-500">{contentTitle}</p>
      <div className="mt-5 max-h-[380px] overflow-y-auto rounded-2xl border border-gray-200 bg-gray-50 p-5 text-sm text-gray-700">
        {content}
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-xs font-semibold text-gray-700">Type your full legal name *</label>
            {customerName && (
              <button
                type="button"
                onClick={() => setTyped(customerName)}
                className="text-xs font-medium text-blue-600 hover:text-blue-800 transition"
              >
                Use my name
              </button>
            )}
          </div>
          <input className="input-field" value={typed} onChange={e => setTyped(e.target.value)} placeholder="Jane Doe" />
        </div>
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-xs font-semibold text-gray-700">Signature *</label>
            <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs font-medium">
              <button
                type="button"
                onClick={() => setUseTyped(false)}
                className={`px-3 py-1 transition ${!useTyped ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
              >
                Draw
              </button>
              <button
                type="button"
                onClick={() => { setUseTyped(true); setDrawn(null) }}
                className={`px-3 py-1 transition ${useTyped ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
              >
                Type
              </button>
            </div>
          </div>
          {useTyped ? (
            <div className="flex items-center justify-center rounded-xl border border-gray-200 bg-white h-[100px] px-4">
              {typed.trim() ? (
                <span style={{ fontFamily: '"Brush Script MT", "Segoe Script", cursive', fontSize: '1.6rem', color: '#1e293b' }}>{typed}</span>
              ) : (
                <span className="text-gray-400 text-sm">Your name will appear here as your signature</span>
              )}
            </div>
          ) : (
            <SignaturePad onChange={setDrawn} height={100} />
          )}
        </div>
      </div>
      {(drawn || useTyped) && (
        <p className="mt-2 text-xs font-medium text-green-600">
          <CheckCircle2 className="inline h-3.5 w-3.5 mr-1" />
          {useTyped ? 'Typed signature applied' : 'Signature captured'}
        </p>
      )}
      <div className="mt-4">
        <CheckItem checked={agree} onChange={setAgree}>{agreeLabel}</CheckItem>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 8 - Deposit Terms
// ─────────────────────────────────────────────────────────────────────────────

function StepDeposit({
  agreeDeposit, setAgreeDeposit, agreeDiscretion, setAgreeDiscretion,
}: {
  agreeDeposit: boolean; setAgreeDeposit: (b: boolean) => void
  agreeDiscretion: boolean; setAgreeDiscretion: (b: boolean) => void
}) {
  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900">Deposit terms</h2>
      <p className="mt-1 text-sm text-gray-500">Review and acknowledge before sending your e-transfer.</p>
      <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5">
        <div className="text-3xl font-bold text-gray-900">${fmt(DEPOSIT)}</div>
        <div className="text-sm font-semibold text-gray-800 mt-0.5">Non-refundable deposit</div>
        <p className="mt-2 text-sm text-gray-600">
          Send a $1,000 e-transfer to <span className="font-semibold">info@easydrivecanada.com</span> to secure a hold on your vehicle. The deposit is <strong>non-refundable</strong> except at EasyDrive Canada's discretion.
        </p>
      </div>
      <ul className="mt-6 space-y-3">
        <CheckItem checked={agreeDeposit} onChange={setAgreeDeposit}>
          I understand the $1,000 deposit is <strong>non-refundable</strong>.
        </CheckItem>
        <CheckItem checked={agreeDiscretion} onChange={setAgreeDiscretion}>
          I acknowledge that EasyDrive Canada reserves the right to cancel this transaction and refund the deposit at its sole discretion.
        </CheckItem>
        <CheckItem checked disabled>
          After delivery is approved, I have <strong>72 hours</strong> to pay the remaining balance and upload proof of insurance, or this purchase is cancelled and the deposit is forfeited.
        </CheckItem>
      </ul>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 9 - Send E-transfer
// ─────────────────────────────────────────────────────────────────────────────

function StepEtransfer({
  orderId, customerEmail, sent, setSent, copied, onCopy,
}: {
  orderId: string; customerEmail: string
  sent: boolean; setSent: (b: boolean) => void
  copied: string | null; onCopy: (text: string, key: string) => void
}) {
  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900">Send your $1,000 e-transfer</h2>
      <p className="mt-1 text-sm text-gray-500">From your online banking, send an Interac e-transfer using the details below.</p>
      <div className="mt-6 space-y-3">
        <CopyRow label="Recipient email"    value="info@easydrivecanada.com" rowKey="email"  copied={copied} onCopy={onCopy} />
        <CopyRow label="Amount (CAD)"       value="$1,000.00"               rowKey="amount" copied={copied} onCopy={onCopy} />
        <CopyRow label="Message / reference" value={`Deposit ${orderId}`}   rowKey="ref"    copied={copied} onCopy={onCopy} />
        <CopyRow label="Security answer"    value="EDC2025"                 rowKey="answer" copied={copied} onCopy={onCopy} hint="Use this exact answer (case-sensitive)." />
      </div>
      <div className="mt-6 rounded-xl bg-gray-50 border border-gray-200 p-4 text-xs text-gray-500">
        We will send a confirmation to <span className="font-medium text-gray-700">{customerEmail || 'your email'}</span> when we receive your deposit. Most e-transfers process in under 30 minutes.
      </div>
      <div className="mt-6">
        <button
          type="button"
          onClick={() => setSent(true)}
          className={`inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold transition ${sent ? 'border border-green-200 bg-green-50 text-green-700' : 'btn-primary'}`}
        >
          {sent ? <><CheckCircle2 className="h-4 w-4" /> Marked as sent</> : <><Mail className="h-4 w-4" /> I have sent the e-transfer</>}
        </button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 10 - Confirmation
// ─────────────────────────────────────────────────────────────────────────────

function StepConfirm({ orderId, customerEmail }: { orderId: string; customerEmail: string }) {
  return (
    <div className="text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
        <CheckCircle2 className="h-8 w-8 text-green-600" />
      </div>
      <h2 className="mt-4 text-2xl font-bold text-gray-900">Sale request submitted!</h2>
      <p className="mt-1 text-sm text-gray-500">
        Order <span className="font-mono font-semibold text-gray-800">{orderId}</span>
      </p>
      <p className="mt-2 text-sm text-gray-500">
        A confirmation will be sent to <span className="font-medium text-gray-800">{customerEmail || 'your email'}</span>.
      </p>
      <div className="mx-auto mt-8 max-w-md rounded-2xl border border-gray-200 bg-gray-50 p-5 text-left">
        <h3 className="text-sm font-semibold text-gray-900">What happens next</h3>
        <ol className="mt-3 space-y-3">
          {[
            'EasyDrive confirms receipt of your $1,000 e-transfer.',
            'EasyDrive counter-signs the Bill of Sale.',
            'We send our direct deposit info - pay the remaining balance.',
            'We mark your vehicle ready for delivery (you have 72 hours).',
            'Upload proof of insurance, then come pick up your car.',
          ].map((s, i) => (
            <li key={i} className="flex gap-3 text-sm">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#118df0]/10 text-xs font-bold text-[#118df0]">{i + 1}</span>
              <span className="text-gray-600">{s}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Order Summary Sidebar
// ─────────────────────────────────────────────────────────────────────────────

const BADGE_STYLES: Record<string, string> = {
  premier:    'bg-[#118df0] text-white',
  fleet:      'bg-[#374151] text-white',
  private:    'bg-[#f59e0b] text-white',
  dealership: 'bg-[#8b5cf6] text-white',
}
const BADGE_LABELS: Record<string, string> = {
  premier:    'EDC PREMIER',
  fleet:      'FLEET SELECT',
  private:    'PRIVATE SELLER',
  dealership: 'DEALER SELECT',
}

function SummarySidebar({ vehicle, pricing, orderId, step }: { vehicle: Vehicle; pricing: PricingBreakdown; orderId: string; step: number }) {
  return (
    <aside className="lg:sticky lg:top-20 lg:self-start">
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-soft">
        <div className="aspect-[16/10] overflow-hidden bg-gray-100">
          {vehicle.image
            ? <img src={vehicle.image} alt="" className="h-full w-full object-cover" />
            : <div className="h-full w-full flex items-center justify-center text-gray-400 text-xs">No image</div>}
        </div>
        <div className="p-5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-[10px] font-bold text-gray-600">Order {orderId || '-'}</span>
            <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${BADGE_STYLES[vehicle.category] || BADGE_STYLES.premier}`}>
              {BADGE_LABELS[vehicle.category] || 'EDC PREMIER'}
            </span>
          </div>
          <div className="mt-2 font-semibold text-gray-900">{vehicle.year} {vehicle.make} {vehicle.model}</div>
          <div className="text-xs text-gray-500">
            {vehicle.trim && <span>{vehicle.trim} </span>}
            {vehicle.stockNumber && <span>Stock #{vehicle.stockNumber}</span>}
          </div>
          <div className="mt-4 space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Sale price</span>
              <span className="tabular-nums font-medium">${fmt(pricing.salePrice)}</span>
            </div>
            {pricing.lineItems.map((li, i) => (
              <div key={i} className="flex justify-between">
                <span className="text-gray-500">{li.label}</span>
                {li.waived && li.originalAmount
                  ? <span className="tabular-nums"><span className="mr-1 text-gray-400 line-through text-xs">${li.originalAmount}</span><span className="text-green-600 font-semibold text-xs">WAIVED</span></span>
                  : <span className="tabular-nums">${fmt(li.amount)}</span>}
              </div>
            ))}
            {(pricing.addOns.length > 0 || pricing.warrantyLine) && (
              <div className="mt-2 border-t border-gray-100 pt-2">
                <div className="mb-1.5 flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-gray-400">
                  <Package className="h-3 w-3" /> Add-ons
                </div>
                {pricing.warrantyLine && (
                  <div className="flex justify-between">
                    <span className="text-gray-500 truncate pr-2 text-xs">{pricing.warrantyLine.label}</span>
                    <span className="tabular-nums shrink-0">${fmt(pricing.warrantyLine.amount)}</span>
                  </div>
                )}
                {pricing.addOns.map(a => (
                  <div key={a.id} className="flex justify-between">
                    <span className="text-gray-500 truncate pr-2 text-xs">{a.label}</span>
                    <span className="tabular-nums shrink-0">${fmt(a.amount)}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-gray-500">HST (13%)</span>
              <span className="tabular-nums">${fmt(pricing.hst)}</span>
            </div>
            <div className="flex items-center justify-between border-t border-gray-200 pt-2 mt-1 text-base font-bold text-gray-900">
              <span>Total</span>
              <span className="tabular-nums">${fmt(pricing.total)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Deposit today</span>
              <span className="tabular-nums text-gray-700">${fmt(pricing.deposit)}</span>
            </div>
            <div className="flex justify-between text-sm font-semibold text-gray-900">
              <span>Balance due before delivery</span>
              <span className="tabular-nums">${fmt(pricing.balanceDue)}</span>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2 rounded-xl bg-gray-50 p-3 text-xs text-gray-500">
            <CreditCard className="h-4 w-4 text-[#118df0]" />
            Step {Math.min(step + 1, STEPS.length)} of {STEPS.length}
          </div>
        </div>
      </div>
    </aside>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Bill of Sale Content
// ─────────────────────────────────────────────────────────────────────────────

function BillOfSaleContent({ vehicle, customer, pricing, orderId }: { vehicle: Vehicle; customer: CustomerInfo; pricing: PricingBreakdown; orderId: string }) {
  const now = new Date()
  return (
    <div className="space-y-4 text-xs leading-relaxed text-gray-700">
      <div className="border-b border-gray-200 pb-3">
        <div className="text-base font-bold text-gray-900">BILL OF SALE</div>
        <div className="text-gray-500">EasyDrive Canada - {now.toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
        <div className="font-mono text-[10px] text-gray-400">Order ID: {orderId}</div>
      </div>
      <div>
        <div className="font-semibold text-gray-900 mb-1">SELLER</div>
        <div>EasyDrive Canada Inc.</div>
        <div>info@easydrivecanada.com</div>
      </div>
      <div>
        <div className="font-semibold text-gray-900 mb-1">BUYER</div>
        <div>{fullName(customer) || '-'}</div>
        <div>{customer.addressLine1 && `${customer.addressLine1}, `}{customer.city && `${customer.city}, `}{customer.province} {customer.postalCode}</div>
        <div>{customer.email}</div>
        <div>DOB: {customer.dob}</div>
      </div>
      <div>
        <div className="font-semibold text-gray-900 mb-1">VEHICLE</div>
        <div>{vehicle.year} {vehicle.make} {vehicle.model} {vehicle.trim}</div>
        <div>VIN: {vehicle.vin || 'N/A'}</div>
        <div>Stock #: {vehicle.stockNumber || 'N/A'}</div>
        <div>Listing: {vehicle.listingType}</div>
        <div>Odometer: {fmt(vehicle.mileage)} km</div>
      </div>
      <div>
        <div className="font-semibold text-gray-900 mb-1">PRICING</div>
        <div className="space-y-0.5">
          <div className="flex justify-between"><span>Sale Price</span><span>${fmt(pricing.salePrice)}</span></div>
          {pricing.lineItems.map((li, i) => (
            <div key={i} className="flex justify-between"><span>{li.label}</span><span>{li.waived ? 'WAIVED' : `$${fmt(li.amount)}`}</span></div>
          ))}
          {pricing.warrantyLine && (
            <div className="flex justify-between"><span>{pricing.warrantyLine.label}</span><span>${fmt(pricing.warrantyLine.amount)}</span></div>
          )}
          {pricing.addOns.map(a => (
            <div key={a.id} className="flex justify-between"><span>{a.label}</span><span>${fmt(a.amount)}</span></div>
          ))}
          <div className="flex justify-between"><span>HST (13%)</span><span>${fmt(pricing.hst)}</span></div>
          <div className="flex justify-between font-bold text-gray-900 border-t border-gray-200 pt-1 mt-1">
            <span>TOTAL</span><span>${fmt(pricing.total)}</span>
          </div>
          <div className="flex justify-between"><span>Deposit Paid</span><span>${fmt(pricing.deposit)}</span></div>
          <div className="flex justify-between font-semibold"><span>Balance Due</span><span>${fmt(pricing.balanceDue)}</span></div>
        </div>
      </div>
      <div>
        <div className="font-semibold text-gray-900 mb-1">TERMS</div>
        <p>This vehicle is sold as-is unless an extended warranty is included above. The buyer acknowledges they have been given the opportunity to inspect the vehicle and accepts it in its current condition.</p>
        <p className="mt-2">The $1,000 deposit is non-refundable unless EasyDrive Canada cancels this transaction at its sole discretion. The remaining balance is due within 72 hours of notification that the vehicle is ready for delivery.</p>
        <p className="mt-2">Title transfers to the buyer only upon receipt of full payment and proof of insurance. Ontario HST has been applied at 13% on applicable items.</p>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Dealer Guarantee Content
// ─────────────────────────────────────────────────────────────────────────────

function DealerGuaranteeContent() {
  return (
    <div className="space-y-4 text-xs leading-relaxed text-gray-700">
      <div className="border-b border-gray-200 pb-3">
        <div className="text-base font-bold text-gray-900">30-DAY DEALER GUARANTEE</div>
        <div className="text-gray-500">EasyDrive Canada Inc.</div>
      </div>
      <p className="font-semibold text-gray-900">EasyDrive Canada 30-Day Guarantee Policy</p>
      <p>EasyDrive Canada stands behind every vehicle in our inventory. This guarantee outlines your rights and our commitments as your trusted dealer.</p>
      <div>
        <div className="font-semibold mb-1">1. Vehicle Accuracy Guarantee</div>
        <p>All vehicle descriptions, odometer readings, and condition disclosures are accurate to the best of our knowledge. If a material misrepresentation is discovered within 30 days of purchase, we will work with you to find an equitable resolution.</p>
      </div>
      <div>
        <div className="font-semibold mb-1">2. Mechanical Disclosure</div>
        <p>Any known mechanical defects have been disclosed prior to sale. Vehicles are sold in their disclosed condition. We encourage buyers to perform an independent inspection prior to finalizing the purchase.</p>
      </div>
      <div>
        <div className="font-semibold mb-1">3. Title and Lien Guarantee</div>
        <p>EasyDrive Canada guarantees that the vehicle will be delivered free and clear of any undisclosed liens or encumbrances. Title will be transferred to the buyer promptly upon receipt of full payment.</p>
      </div>
      <div>
        <div className="font-semibold mb-1">4. Dispute Resolution</div>
        <p>Any disputes arising from this sale will first be addressed through direct negotiation. If unresolved, disputes will be submitted to Ontario Mandatory Mediation. Ontario law governs this agreement.</p>
      </div>
      <div>
        <div className="font-semibold mb-1">5. Contact</div>
        <p>EasyDrive Canada Inc. - info@easydrivecanada.com</p>
      </div>
      <p className="text-gray-500 text-[10px]">This guarantee is provided in addition to your statutory rights under Ontario consumer protection legislation, including the Motor Vehicle Dealers Act (MVDA). OMVIC registration ensures all transactions adhere to provincial standards.</p>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: FileUpload
// ─────────────────────────────────────────────────────────────────────────────

function FileUpload({ label, accept = 'image/*,application/pdf', value, onChange, required }: { label: string; accept?: string; value: FileRef | null; onChange: (f: FileRef | null) => void; required?: boolean }) {
  const ref = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)

  const handle = async (file: File) => {
    setError(null)
    if (file.size > 10 * 1024 * 1024) { setError('File too large (max 10 MB)'); return }
    let dataUrl: string | null = null
    if (file.type.startsWith('image/') && file.size < 1024 * 1024) {
      dataUrl = await new Promise<string>(resolve => {
        const r = new FileReader()
        r.onload = () => resolve(r.result as string)
        r.readAsDataURL(file)
      })
    }
    onChange({ name: file.name, size: file.size, type: file.type, dataUrl, uploadedAt: new Date().toISOString() })
  }

  return (
    <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-gray-700">{label} {required && <span className="text-red-500">*</span>}</div>
          {!value && <div className="text-xs text-gray-400 mt-0.5">JPG, PNG, or PDF - max 10 MB</div>}
        </div>
        {!value
          ? <button type="button" onClick={() => ref.current?.click()} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition"><Upload className="h-3.5 w-3.5" /> Upload</button>
          : <button type="button" onClick={() => onChange(null)} className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs text-gray-500 hover:text-red-600 transition"><X className="h-3.5 w-3.5" /> Remove</button>}
        <input ref={ref} type="file" accept={accept} className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) void handle(f); e.target.value = '' }} />
      </div>
      {value && (
        <div className="mt-3 flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-2">
          {value.dataUrl
            ? <img src={value.dataUrl} alt={value.name} className="h-12 w-16 rounded object-cover" />
            : <div className="flex h-12 w-16 items-center justify-center rounded bg-green-50"><FileCheck2 className="h-5 w-5 text-green-600" /></div>}
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium text-gray-800">{value.name}</div>
            <div className="text-xs text-gray-400">{(value.size / 1024).toFixed(0)} KB</div>
          </div>
          <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
        </div>
      )}
      {error && <div className="mt-2 text-xs text-red-600">{error}</div>}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: SignaturePad
// ─────────────────────────────────────────────────────────────────────────────

function SignaturePad({ onChange, height = 160 }: { onChange: (d: string | null) => void; height?: number }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const [drawing, setDrawing] = useState(false)
  const [hasInk, setHasInk] = useState(false)

  useEffect(() => {
    const c = ref.current; if (!c) return
    const dpr = window.devicePixelRatio || 1
    const rect = c.getBoundingClientRect()
    c.width = rect.width * dpr; c.height = rect.height * dpr
    const ctx = c.getContext('2d'); if (!ctx) return
    ctx.scale(dpr, dpr); ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.strokeStyle = '#0a1628'
  }, [])

  const pos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = ref.current!.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }
  const start = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const ctx = ref.current!.getContext('2d')!
    const { x, y } = pos(e); ctx.beginPath(); ctx.moveTo(x, y)
    setDrawing(true);(e.target as Element).setPointerCapture(e.pointerId)
  }
  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing) return
    const ctx = ref.current!.getContext('2d')!
    const { x, y } = pos(e); ctx.lineTo(x, y); ctx.stroke(); setHasInk(true)
  }
  const end = () => {
    if (!drawing) return; setDrawing(false)
    onChange(hasInk ? ref.current!.toDataURL('image/png') : null)
  }
  const clear = () => {
    const c = ref.current!; const ctx = c.getContext('2d')!
    ctx.clearRect(0, 0, c.width, c.height); setHasInk(false); onChange(null)
  }

  return (
    <div>
      <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
        <canvas
          ref={ref}
          style={{ width: '100%', height, touchAction: 'none', cursor: 'crosshair', display: 'block' }}
          onPointerDown={start} onPointerMove={move}
          onPointerUp={end} onPointerCancel={end} onPointerLeave={end}
        />
      </div>
      <div className="mt-1.5 flex items-center justify-between">
        <span className="text-xs text-gray-400">Sign with finger or mouse</span>
        <button type="button" onClick={clear} className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition"><Eraser className="h-3 w-3" /> Clear</button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: Field
// ─────────────────────────────────────────────────────────────────────────────

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-700 mb-1.5">{label}</label>
      {children}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: CheckItem
// ─────────────────────────────────────────────────────────────────────────────

function CheckItem({ checked, onChange, disabled, children }: { checked: boolean; onChange?: (b: boolean) => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <div
      className={`flex items-start gap-3 rounded-xl border p-3 transition ${disabled ? 'border-gray-100 bg-gray-50' : 'border-gray-200 bg-white cursor-pointer hover:bg-gray-50'}`}
      onClick={() => !disabled && onChange?.(!checked)}
    >
      <div className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition ${checked ? 'border-[#118df0] bg-[#118df0]' : 'border-gray-300 bg-white'}`}>
        {checked && (
          <svg viewBox="0 0 12 12" fill="none" className="h-3 w-3">
            <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>
      <span className="text-sm text-gray-700">{children}</span>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: CopyRow
// ─────────────────────────────────────────────────────────────────────────────

function CopyRow({ label, value, hint, rowKey, copied, onCopy }: { label: string; value: string; hint?: string; rowKey: string; copied: string | null; onCopy: (v: string, k: string) => void }) {
  const isCopied = copied === rowKey
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-3">
      <div>
        <div className="text-[10px] uppercase tracking-wider font-semibold text-gray-400">{label}</div>
        <div className="font-mono text-sm font-semibold text-gray-900">{value}</div>
        {hint && <div className="mt-0.5 text-xs text-gray-400">{hint}</div>}
      </div>
      <button
        type="button"
        onClick={() => onCopy(value, rowKey)}
        className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition shrink-0"
      >
        {isCopied ? <CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
        {isCopied ? 'Copied' : 'Copy'}
      </button>
    </div>
  )
}
