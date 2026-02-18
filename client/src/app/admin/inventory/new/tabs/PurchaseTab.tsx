'use client'

import { useCallback, useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react'
import { supabase } from '@/lib/supabaseClient'

// Supported tax rates for purchase calculations
const TAX_RATES: Record<string, number> = {
  HST: 0.13,
  RST: 0.08,
  GST: 0.05,
  PST: 0.06,
  QST: 0.09975,
  Exempt: 0,
}

type TaxPresetRow = {
  id: string
  name: string | null
  rate: number | string | null
  default_tax_rate: boolean | null
}

interface PurchaseData {
  purchasedOn?: string
  dateReceived?: string
  dateDelivered?: string
  reconCompletedBy?: string
  ownershipStatus?: string
  titleReceived?: string
  ownershipNotes?: string
  vendorName?: string
  vendorCompany?: string
  vendorPhone?: string
  vendorMobile?: string
  vendorFax?: string
  vendorEmail?: string
  vendorLocation?: string
  vendorAptSuite?: string
  vendorCity?: string
  vendorProvince?: string
  vendorPostalCode?: string
  salespersonRegistration?: string
  companyMvda?: string
  rin?: string
  taxNumber?: string
  plateNumber?: string
  saleStatus?: string
  licenseFee?: number
  purchasedThroughAuction?: boolean
  publicOrCompany?: 'public' | 'company'
  // Purchase totals & tax
  purchasePrice?: number
  actualCashValue?: number
  discount?: number
  taxType?: string
  taxOverride?: boolean
  vehicleTax?: number
  totalVehicleTax?: number
  saleState?: string
  paymentStatus?: string
  vendorCountry?: string
  driverLicense?: string
}

interface VendorRow {
  id: string
  company_name: string | null
  vendor_name: string | null
  contact_first_name: string | null
  contact_last_name: string | null
  street_address: string | null
  suite_apt: string | null
  city: string | null
  province: string | null
  postal_code: string | null
  country: string | null
  rin: string | null
  salesperson_registration: string | null
  company_mvda: string | null
  tax_number: string | null
  phone: string | null
  mobile: string | null
  email: string | null
  fax: string | null
}

interface PurchaseTabProps {
  vehicleId: string
  userId?: string | null
  stockNumber?: string
  onError?: (message: string) => void
  hideSaveButton?: boolean
}

export interface PurchaseTabHandle {
  save: () => Promise<boolean>
  getData: () => PurchaseData
}

const PurchaseTab = forwardRef<PurchaseTabHandle, PurchaseTabProps>(function PurchaseTab({ vehicleId, userId, stockNumber, onError, hideSaveButton }, ref) {
  const [formData, setFormData] = useState<PurchaseData>({
    publicOrCompany: 'public',
    purchasedThroughAuction: false,
    taxType: 'HST',
    purchasePrice: 0,
    actualCashValue: 0,
    discount: 0,
    taxOverride: false,
    vehicleTax: 0,
    totalVehicleTax: 0,
  })
  const [saving, setSaving] = useState(false)
  const [taxPresets, setTaxPresets] = useState<TaxPresetRow[]>([])
  const [loadingTaxPresets, setLoadingTaxPresets] = useState(false)
  const [vendorSearch, setVendorSearch] = useState('')
  const [vendorResults, setVendorResults] = useState<VendorRow[]>([])
  const [vendorLoading, setVendorLoading] = useState(false)
  const [showVendorDropdown, setShowVendorDropdown] = useState(false)
  const [scopedUserId, setScopedUserId] = useState<string | null>(null)
  const [showNewVendorModal, setShowNewVendorModal] = useState(false)
  const [savingNewVendor, setSavingNewVendor] = useState(false)
  const [newVendorForm, setNewVendorForm] = useState({
    companyName: '',
    contactFirstName: '',
    contactLastName: '',
    streetAddress: '',
    suiteApt: '',
    city: '',
    province: '',
    postalCode: '',
    country: 'CA',
    rin: '',
    salespersonRegistration: '',
    companyMvda: '',
    taxNumber: '',
    phone: '',
    mobile: '',
    email: '',
    fax: '',
  })
  const isCompany = formData.publicOrCompany === 'company'
  const [publicIdType, setPublicIdType] = useState<'dl' | 'rin'>('dl')
  const driverLicenseRef = useRef<HTMLInputElement | null>(null)
  const rinRef = useRef<HTMLInputElement | null>(null)

  const getLoggedInAdminDbUserId = useCallback(async (): Promise<string | null> => {
    try {
      if (typeof window === 'undefined') return null
      const raw = window.localStorage.getItem('edc_admin_session')
      if (!raw) return null
      const parsed = JSON.parse(raw) as { email?: string; user_id?: string }
      const sessionUserId = String(parsed?.user_id ?? '').trim()
      if (sessionUserId) return sessionUserId
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
  }, [])

  useEffect(() => {
    const load = async () => {
      const id = await getLoggedInAdminDbUserId()
      setScopedUserId(id)
    }
    void load()
  }, [getLoggedInAdminDbUserId])

  useImperativeHandle(ref, () => ({
    save: handleSave,
    getData: () => formData,
  }))

  useEffect(() => {
    // webhook-driven: no client-side supabase prefill
  }, [vehicleId, stockNumber])

  useEffect(() => {
    const getLoggedInAdminDbUserId = async (): Promise<string | null> => {
      try {
        if (typeof window === 'undefined') return null
        const raw = window.localStorage.getItem('edc_admin_session')
        if (!raw) return null
        const parsed = JSON.parse(raw) as { email?: string; user_id?: string }
        const sessionUserId = String(parsed?.user_id ?? '').trim()
        if (sessionUserId) return sessionUserId
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

    const load = async () => {
      setLoadingTaxPresets(true)
      try {
        const scopedUserId = await getLoggedInAdminDbUserId()
        if (!scopedUserId) {
          setTaxPresets([])
          return
        }

        const { data, error } = await supabase
          .from('presets_tax')
          .select('id, name, rate, default_tax_rate')
          .eq('user_id', scopedUserId)
          .order('name', { ascending: true })

        if (error) throw error
        const rows = Array.isArray(data) ? (data as TaxPresetRow[]) : []
        setTaxPresets(rows)
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        onError?.(msg)
        setTaxPresets([])
      } finally {
        setLoadingTaxPresets(false)
      }
    }

    void load()
  }, [userId, onError])

  useEffect(() => {
    if (!taxPresets.length) return
    setFormData((prev) => {
      const current = String(prev.taxType || '').trim()
      const hasCurrent = current && taxPresets.some((t) => String(t.name || '').trim() === current)
      if (hasCurrent) return prev

      const defaultRow = taxPresets.find((t) => Boolean(t.default_tax_rate) && String(t.name || '').trim())
      const firstRow = taxPresets.find((t) => String(t.name || '').trim())
      const nextName = String((defaultRow || firstRow)?.name || '').trim()
      if (!nextName) return prev
      return { ...prev, taxType: nextName }
    })
  }, [taxPresets])

  const resolveTaxRate = (taxType: string | undefined) => {
    const key = String(taxType || '').trim()
    if (!key) return 0
    const preset = taxPresets.find((t) => String(t.name || '').trim() === key)
    if (preset) {
      const n = typeof preset.rate === 'number' ? preset.rate : parseFloat(String(preset.rate || '0'))
      return Number.isFinite(n) ? n : 0
    }
    return 0
  }

  const formatTaxLabel = (name: string, rate: number) => {
    const pct = rate * 100
    const pctStr = Number.isFinite(pct) ? String(pct.toFixed(3)).replace(/\.?(0+)$/, '').replace(/\.$/, '') : '0'
    return `${name} ${pctStr}%`
  }

  const getSelectedTaxLabel = () => {
    const name = String(formData.taxType || '').trim() || 'Tax'
    const rate = resolveTaxRate(formData.taxType)
    if (rate === 0 && name === 'Tax') return 'Tax'
    return formatTaxLabel(name, rate)
  }

  useEffect(() => {
    const q = vendorSearch.trim()
    if (!q) {
      setVendorResults([])
      setVendorLoading(false)
      setShowVendorDropdown(false)
      return
    }

    if (!scopedUserId) {
      setVendorResults([])
      setVendorLoading(false)
      setShowVendorDropdown(false)
      return
    }

    setVendorLoading(true)
    setShowVendorDropdown(true)
    const id = setTimeout(async () => {
      try {
        const safe = q.replace(/[%_]/g, '\\$&')
        const like = `%${safe}%`

        const { data, error } = await supabase
          .from('edc_vendors')
          .select(
            'id, company_name, vendor_name, contact_first_name, contact_last_name, street_address, suite_apt, city, province, postal_code, country, rin, salesperson_registration, company_mvda, tax_number, phone, mobile, email, fax'
          )
          .eq('user_id', scopedUserId)
          .or(
            [
              `company_name.ilike.${like}`,
              `vendor_name.ilike.${like}`,
              `contact_first_name.ilike.${like}`,
              `contact_last_name.ilike.${like}`,
              `phone.ilike.${like}`,
              `email.ilike.${like}`,
            ].join(',')
          )
          .limit(10)

        if (error) throw error
        setVendorResults(Array.isArray(data) ? (data as VendorRow[]) : [])
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        onError?.(msg)
        setVendorResults([])
      } finally {
        setVendorLoading(false)
      }
    }, 250)

    return () => clearTimeout(id)
  }, [vendorSearch, onError, scopedUserId])

  const applyVendorToPurchase = (v: VendorRow) => {
    const company = (v.company_name || '').trim()
    const fullName = (v.vendor_name || `${v.contact_first_name || ''} ${v.contact_last_name || ''}`)
      .replace(/\s+/g, ' ')
      .trim()

    const isCompanyVendor = Boolean(
      company ||
        (v.salesperson_registration || '').trim() ||
        (v.company_mvda || '').trim() ||
        (v.tax_number || '').trim()
    )

    setFormData(prev => ({
      ...prev,
      publicOrCompany: isCompanyVendor ? 'company' : 'public',
      vendorCompany: isCompanyVendor ? (company || prev.vendorCompany) : '',
      vendorName: fullName || prev.vendorName,
      vendorLocation: v.street_address || prev.vendorLocation,
      vendorAptSuite: v.suite_apt || prev.vendorAptSuite,
      vendorCity: v.city || prev.vendorCity,
      vendorProvince: v.province || prev.vendorProvince,
      vendorPostalCode: v.postal_code || prev.vendorPostalCode,
      vendorCountry: v.country || prev.vendorCountry,
      rin: v.rin || prev.rin,
      salespersonRegistration: v.salesperson_registration || prev.salespersonRegistration,
      companyMvda: v.company_mvda || prev.companyMvda,
      taxNumber: v.tax_number || prev.taxNumber,
      vendorPhone: v.phone || prev.vendorPhone,
      vendorMobile: v.mobile || prev.vendorMobile,
      vendorEmail: v.email || prev.vendorEmail,
      vendorFax: v.fax || prev.vendorFax,
    }))

    if (!isCompanyVendor) {
      if (v.rin) setPublicIdType('rin')
    }

    setVendorSearch(company || fullName)
    setShowVendorDropdown(false)
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target
    const checked = (e.target as HTMLInputElement).checked
    setFormData(prev => {
      const next: PurchaseData = { ...prev }
      if (type === 'checkbox') {
        ;(next as any)[name] = checked
      } else if (name === 'purchasePrice' || name === 'actualCashValue' || name === 'discount' || name === 'vehicleTax') {
        ;(next as any)[name] = parseFloat(value) || 0
      } else if (name === 'taxType') {
        next.taxType = value
      } else {
        ;(next as any)[name] = value
      }

      // Recompute taxes when inputs change, unless taxOverride is enabled and user is editing vehicleTax directly
      if (!next.taxOverride || (name !== 'vehicleTax')) {
        const rate = resolveTaxRate(next.taxType) ?? 0
        const purchasePrice = Number(next.purchasePrice || 0)
        const acv = Number(next.actualCashValue || 0)
        const discount = Number(next.discount || 0)
        const taxable = Math.max(0, purchasePrice - acv - discount)
        const vehicleTax = taxable * rate
        next.vehicleTax = vehicleTax
        next.totalVehicleTax = vehicleTax
      } else {
        // When overriding tax manually, sync total with the entered value
        next.totalVehicleTax = Number(next.vehicleTax || 0)
      }
      return next
    })
  }

  const handleSave = async (): Promise<boolean> => {
    setSaving(true)
    try {
      if (!vehicleId) return false

      let resolvedStockNumber = stockNumber ? String(stockNumber).trim() : ''
      if (!resolvedStockNumber) {
        const { data, error } = await supabase
          .from('edc_vehicles')
          .select('stock_number')
          .eq('id', String(vehicleId))
          .limit(1)
          .maybeSingle()

        if (error) {
          onError?.(error.message)
          return false
        }

        const dbStock = (data as any)?.stock_number
        resolvedStockNumber = dbStock ? String(dbStock).trim() : ''
      }

      if (!resolvedStockNumber) {
        const msg = 'Missing stock number. Please set Stock # in Vehicle Details first.'
        onError?.(msg)
        return false
      }

      const fullPayload: Record<string, any> = {
        user_id: userId ?? null,
        vehicleId: String(vehicleId),
        stockNumber: resolvedStockNumber,
        purchasedOn: formData.purchasedOn,
        dateReceived: formData.dateReceived,
        dateDelivered: formData.dateDelivered,
        reconCompletedBy: formData.reconCompletedBy,
        ownershipStatus: formData.ownershipStatus,
        titleReceived: formData.titleReceived,
        ownershipNotes: formData.ownershipNotes,
        vendorName: formData.vendorName,
        vendorCompany: formData.vendorCompany,
        vendorPhone: formData.vendorPhone,
        vendorMobile: formData.vendorMobile,
        vendorFax: formData.vendorFax,
        vendorEmail: formData.vendorEmail,
        vendorLocation: formData.vendorLocation,
        vendorAptSuite: formData.vendorAptSuite,
        vendorCity: formData.vendorCity,
        vendorProvince: formData.vendorProvince,
        vendorPostalCode: formData.vendorPostalCode,
        salespersonRegistration: formData.salespersonRegistration,
        companyMvda: formData.companyMvda,
        rin: formData.rin,
        taxNumber: formData.taxNumber,
        plateNumber: formData.plateNumber,
        saleStatus: formData.saleStatus,
        licenseFee: formData.licenseFee,
        purchasedThroughAuction: formData.purchasedThroughAuction,
        publicOrCompany: formData.publicOrCompany,
        purchasePrice: formData.purchasePrice,
        actualCashValue: formData.actualCashValue,
        discount: formData.discount,
        taxType: formData.taxType,
        taxOverride: formData.taxOverride,
        vehicleTax: formData.vehicleTax,
        totalVehicleTax: formData.totalVehicleTax,
        saleState: formData.saleState,
        paymentStatus: formData.paymentStatus,
        vendorCountry: formData.vendorCountry,
        driverLicense: formData.driverLicense,
      }

      const payload = Object.fromEntries(
        Object.entries(fullPayload).map(([k, v]) => {
          if (v === undefined) return [k, null]
          if (typeof v === 'string') {
            const trimmed = v.trim()
            return [k, trimmed === '' ? null : trimmed]
          }
          return [k, v]
        })
      )

      const res = await fetch('/api/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const text = await res.text().catch(() => '')
      if (!res.ok) throw new Error(text || `Webhook responded with ${res.status}`)

      if (!String(text).toLowerCase().includes('done')) {
        throw new Error(text || 'Webhook did not return done')
      }

      return true
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      onError?.(msg)
      return false
    } finally {
      setSaving(false)
    }
  }

  const handleClear = () => {
    setFormData({
      publicOrCompany: 'public',
      purchasedThroughAuction: false,
    })
  }

  const openNewVendorModal = () => {
    setNewVendorForm({
      companyName: '',
      contactFirstName: '',
      contactLastName: '',
      streetAddress: '',
      suiteApt: '',
      city: '',
      province: '',
      postalCode: '',
      country: 'CA',
      rin: '',
      salespersonRegistration: '',
      companyMvda: '',
      taxNumber: '',
      phone: '',
      mobile: '',
      email: '',
      fax: '',
    })
    setShowNewVendorModal(true)
  }

  const applyNewVendorToPurchase = () => {
    const fullName = `${newVendorForm.contactFirstName} ${newVendorForm.contactLastName}`.trim()
    setFormData(prev => ({
      ...prev,
      vendorCompany: newVendorForm.companyName || prev.vendorCompany,
      vendorName: fullName || prev.vendorName,
      vendorLocation: newVendorForm.streetAddress || prev.vendorLocation,
      vendorAptSuite: newVendorForm.suiteApt || prev.vendorAptSuite,
      vendorCity: newVendorForm.city || prev.vendorCity,
      vendorProvince: newVendorForm.province || prev.vendorProvince,
      vendorPostalCode: newVendorForm.postalCode || prev.vendorPostalCode,
      vendorCountry: newVendorForm.country || prev.vendorCountry,
      rin: newVendorForm.rin || prev.rin,
      salespersonRegistration: newVendorForm.salespersonRegistration || prev.salespersonRegistration,
      companyMvda: newVendorForm.companyMvda || prev.companyMvda,
      taxNumber: newVendorForm.taxNumber || prev.taxNumber,
      vendorPhone: newVendorForm.phone || prev.vendorPhone,
      vendorMobile: newVendorForm.mobile || prev.vendorMobile,
      vendorEmail: newVendorForm.email || prev.vendorEmail,
      vendorFax: newVendorForm.fax || prev.vendorFax,
    }))
    setShowNewVendorModal(false)
  }

  const submitNewVendor = async () => {
    setSavingNewVendor(true)
    try {
      const fullName = `${newVendorForm.contactFirstName} ${newVendorForm.contactLastName}`.trim()
      const payload = {
        user_id: userId ?? null,
        ...newVendorForm,
        vendorName: fullName,
      }

      const res = await fetch('/api/addvendor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const text = await res.text().catch(() => '')
      if (!res.ok) throw new Error(text || `Webhook responded with ${res.status}`)
    } finally {
      setSavingNewVendor(false)
    }
  }

  const handleNewVendorOk = async () => {
    try {
      await submitNewVendor()
      applyNewVendorToPurchase()
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      onError?.(msg)
    }
  }

  return (
    <div className="bg-white rounded-xl shadow p-6">
      
      {/* Dates Section */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Purchased On</label>
          <input
            type="date"
            name="purchasedOn"
            value={formData.purchasedOn || ''}
            onChange={handleChange}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Date Received</label>
          <input
            type="date"
            name="dateReceived"
            value={formData.dateReceived || ''}
            onChange={handleChange}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Date Delivered</label>
          <input
            type="date"
            name="dateDelivered"
            value={formData.dateDelivered || ''}
            onChange={handleChange}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Recon Completed By</label>
          <input
            type="date"
            name="reconCompletedBy"
            value={formData.reconCompletedBy || ''}
            onChange={handleChange}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent"
          />
        </div>
      </div>

      

      {/* Ownership Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Ownership Status</label>
          <select
            name="ownershipStatus"
            value={formData.ownershipStatus || ''}
            onChange={handleChange}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent"
          >
            <option value="">Not Available</option>
            <option value="Arrived (Not transferred yet)">Arrived (Not transferred yet)</option>
            <option value="Transfer In Progress">Transfer In Progress</option>
            <option value="Ready (In our name)">Ready (In our name)</option>
            <option value="In customers name">In customers name</option>
            <option value="Waiting on seller">Waiting on seller</option>
            <option value="Waiting on auction">Waiting on auction</option>
            <option value="Waiting on license office">Waiting on license office</option>
            <option value="Stuck">Stuck</option>
            <option value="Other">Other</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Title Received</label>
          <input
            type="date"
            name="titleReceived"
            value={formData.titleReceived || ''}
            onChange={handleChange}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Ownership Notes</label>
          <input
            type="text"
            name="ownershipNotes"
            value={formData.ownershipNotes || ''}
            onChange={handleChange}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent"
          />
        </div>
      </div>

      {/* Purchased From Section */}
      <div className="border-t border-gray-200 pt-6 mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Purchased From</h3>
        <p className="text-sm text-gray-600 mb-4">Who did you purchase the vehicle from?</p>

        {/* Info Banner */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
          <p className="text-sm text-blue-800">
            💡 You can copy the purchase details from a vendor by using the search box below. If the vendor does not exist you can create a new one by clicking 'Add New'. Vendors cannot be edited or updated from here and any changes made will copy only.
          </p>
        </div>

        {/* Vendor Search */}
        <div className="flex items-center justify-between gap-4 mb-4">
          <div className="flex-1">
            <div className="relative">
              <div className="flex items-center">
                <span className="bg-gray-100 border border-r-0 border-gray-300 px-3 py-2 rounded-l-lg text-gray-500">🔍</span>
              <input
                type="text"
                placeholder="vendor search"
                value={vendorSearch}
                onChange={(e) => setVendorSearch(e.target.value)}
                onFocus={() => {
                  if (vendorSearch.trim()) setShowVendorDropdown(true)
                }}
                className="flex-1 border border-gray-300 rounded-r-lg px-3 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent"
              />
            </div>

            {showVendorDropdown && (vendorLoading || vendorResults.length > 0) && (
              <div className="absolute z-20 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg">
                {vendorLoading && (
                  <div className="px-3 py-2 text-sm text-gray-500">Searching...</div>
                )}

                {!vendorLoading && vendorResults.map((v) => {
                  const company = (v.company_name || '').trim()
                  const fullName = (v.vendor_name || `${v.contact_first_name || ''} ${v.contact_last_name || ''}`)
                    .replace(/\s+/g, ' ')
                    .trim()
                  const primary = company || fullName || '(Unnamed vendor)'
                  const secondary = company && fullName ? fullName : (v.email || v.phone || '')
                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => applyVendorToPurchase(v)}
                      className="w-full px-3 py-2 text-left hover:bg-gray-50"
                    >
                      <div className="text-sm text-gray-900">{primary}</div>
                      {secondary ? <div className="text-xs text-gray-500">{secondary}</div> : null}
                    </button>
                  )
                })}
              </div>
            )}
            </div>
          </div>
          <button
            type="button"
            onClick={openNewVendorModal}
            className="text-sm text-[#118df0] hover:underline"
          >
            Didn't find what you're looking for? Add new
          </button>
        </div>

        {/* Public or Company Toggle */}
        <div className="flex items-center gap-4 mb-4">
          <span className="text-sm text-gray-700">Public or Company?</span>
          <button
            type="button"
            onClick={() => {
              const nextIsCompany = !isCompany
              setFormData(prev => ({
                ...prev,
                publicOrCompany: nextIsCompany ? 'company' : 'public',
                ...(nextIsCompany
                  ? { driverLicense: '' }
                  : { vendorCompany: '', companyMvda: '', taxNumber: '', rin: '' }),
              }))
              if (!nextIsCompany) setPublicIdType('dl')
            }}
            className="relative inline-flex items-center px-7 py-1 rounded-full border border-[#118df0] text-[#118df0] text-xs font-medium"
          >
            <span>{isCompany ? 'CMP' : 'PUB'}</span>
            <span
              className={`absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-[#118df0] transition-all ${isCompany ? 'right-1' : 'left-1'}`}
            ></span>
          </button>
        </div>

        {/* Vendor Details Grid */}
        <div className={`grid grid-cols-1 ${isCompany ? 'md:grid-cols-3' : 'md:grid-cols-2'} gap-4 mb-4`}>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <div className="flex items-center">
              <span className="bg-gray-100 border border-r-0 border-gray-300 px-3 py-2 rounded-l-lg text-gray-500">👤</span>
              <input
                type="text"
                name="vendorName"
                value={formData.vendorName || ''}
                onChange={handleChange}
                placeholder="name"
                className="flex-1 border border-gray-300 rounded-r-lg px-3 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent"
              />
            </div>
          </div>

          {!isCompany ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Driver License</label>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setPublicIdType(prev => {
                      const next = prev === 'dl' ? 'rin' : 'dl'
                      setFormData(fd => ({
                        ...fd,
                        ...(next === 'dl' ? { rin: '' } : { driverLicense: '' }),
                      }))
                      setTimeout(() => {
                        if (next === 'dl') driverLicenseRef.current?.focus()
                        else rinRef.current?.focus()
                      }, 0)
                      return next
                    })
                  }}
                  className="relative inline-flex items-center px-7 py-1 rounded-full border border-[#118df0] text-[#118df0] text-xs font-medium"
                >
                  {publicIdType === 'dl' ? 'DL' : 'RIN'}
                  <span
                    className={`absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-[#118df0] transition-all ${publicIdType === 'rin' ? 'right-1' : 'left-1'}`}
                  ></span>
                </button>
                <span className="bg-gray-100 border border-r-0 border-gray-300 px-3 py-2 rounded-l-lg text-gray-500">🪪</span>
                {publicIdType === 'dl' ? (
                  <input
                    type="text"
                    name="driverLicense"
                    value={formData.driverLicense || ''}
                    onChange={handleChange}
                    placeholder="driver license"
                    ref={driverLicenseRef}
                    className="flex-1 border border-gray-300 rounded-r-lg px-3 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent"
                  />
                ) : (
                  <input
                    type="text"
                    name="rin"
                    value={formData.rin || ''}
                    onChange={handleChange}
                    placeholder="RIN"
                    ref={rinRef}
                    className="flex-1 border border-gray-300 rounded-r-lg px-3 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent"
                  />
                )}
              </div>
            </div>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Company</label>
                <div className="flex items-center">
                  <span className="bg-gray-100 border border-r-0 border-gray-300 px-3 py-2 rounded-l-lg text-gray-500">🏢</span>
                  <input
                    type="text"
                    name="vendorCompany"
                    value={formData.vendorCompany || ''}
                    onChange={handleChange}
                    placeholder="company"
                    className="flex-1 border border-gray-300 rounded-r-lg px-3 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">RIN</label>
                <div className="flex items-center">
                  <span className="bg-gray-100 border border-r-0 border-gray-300 px-3 py-2 rounded-l-lg text-gray-500">🪪</span>
                  <input
                    type="text"
                    name="rin"
                    value={formData.rin || ''}
                    onChange={handleChange}
                    ref={rinRef}
                    className="flex-1 border border-gray-300 rounded-r-lg px-3 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent"
                  />
                </div>
              </div>
            </>
          )}
        </div>

        {isCompany && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Salesperson Registration *</label>
              <div className="flex items-center">
                <span className="bg-gray-100 border border-r-0 border-gray-300 px-3 py-2 rounded-l-lg text-gray-500">🧑‍💼</span>
                <input
                  type="text"
                  name="salespersonRegistration"
                  value={formData.salespersonRegistration || ''}
                  onChange={handleChange}
                  placeholder="# Salesperson Registration"
                  className="flex-1 border border-gray-300 rounded-r-lg px-3 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Company MVDA #</label>
              <div className="flex items-center">
                <span className="bg-gray-100 border border-r-0 border-gray-300 px-3 py-2 rounded-l-lg text-gray-500">#</span>
                <input
                  type="text"
                  name="companyMvda"
                  value={formData.companyMvda || ''}
                  onChange={handleChange}
                  placeholder="Company MVDA #"
                  className="flex-1 border border-gray-300 rounded-r-lg px-3 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1"># Tax Number</label>
              <div className="flex items-center">
                <span className="bg-gray-100 border border-r-0 border-gray-300 px-3 py-2 rounded-l-lg text-gray-500">#</span>
                <input
                  type="text"
                  name="taxNumber"
                  value={formData.taxNumber || ''}
                  onChange={handleChange}
                  placeholder="# Tax Number"
                  className="flex-1 border border-gray-300 rounded-r-lg px-3 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent"
                />
              </div>
            </div>
          </div>
        )}

        {/* QuickBooks Info */}
        <div className="bg-blue-600 text-white rounded-lg p-3 mb-4">
          <p className="text-sm">ℹ️ Connect QuickBooks in Settings to enable vendor selection for Bill generation.</p>
        </div>

        {/* Contact Details */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
            <div className="flex items-center">
              <span className="bg-gray-100 border border-r-0 border-gray-300 px-3 py-2 rounded-l-lg text-gray-500">📞</span>
              <input
                type="tel"
                name="vendorPhone"
                value={formData.vendorPhone || ''}
                onChange={handleChange}
                placeholder="phone"
                className="flex-1 border border-gray-300 rounded-r-lg px-3 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Mobile</label>
            <div className="flex items-center">
              <span className="bg-gray-100 border border-r-0 border-gray-300 px-3 py-2 rounded-l-lg text-gray-500">📱</span>
              <input
                type="tel"
                name="vendorMobile"
                value={formData.vendorMobile || ''}
                onChange={handleChange}
                placeholder="mobile"
                className="flex-1 border border-gray-300 rounded-r-lg px-3 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fax</label>
            <div className="flex items-center">
              <span className="bg-gray-100 border border-r-0 border-gray-300 px-3 py-2 rounded-l-lg text-gray-500">📠</span>
              <input
                type="tel"
                name="vendorFax"
                value={formData.vendorFax || ''}
                onChange={handleChange}
                placeholder="fax"
                className="flex-1 border border-gray-300 rounded-r-lg px-3 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <div className="flex items-center">
              <span className="bg-gray-100 border border-r-0 border-gray-300 px-3 py-2 rounded-l-lg text-gray-500">✉️</span>
              <input
                type="email"
                name="vendorEmail"
                value={formData.vendorEmail || ''}
                onChange={handleChange}
                placeholder="email"
                className="flex-1 border border-gray-300 rounded-r-lg px-3 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent"
              />
            </div>
          </div>
        </div>

        {/* Address */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Enter a location</label>
            <div className="flex items-center">
              <span className="bg-gray-100 border border-r-0 border-gray-300 px-3 py-2 rounded-l-lg text-gray-500">📍</span>
              <input
                type="text"
                name="vendorLocation"
                value={formData.vendorLocation || ''}
                onChange={handleChange}
                placeholder="Enter a location"
                className="flex-1 border border-gray-300 rounded-r-lg px-3 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Apt/Suite #</label>
            <div className="flex items-center">
              <span className="bg-gray-100 border border-r-0 border-gray-300 px-3 py-2 rounded-l-lg text-gray-500">#</span>
              <input
                type="text"
                name="vendorAptSuite"
                value={formData.vendorAptSuite || ''}
                onChange={handleChange}
                placeholder="apt/suite #"
                className="flex-1 border border-gray-300 rounded-r-lg px-3 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent"
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
            <div className="flex items-center">
              <span className="bg-gray-100 border border-r-0 border-gray-300 px-3 py-2 rounded-l-lg text-gray-500">📍</span>
              <input
                type="text"
                name="vendorCity"
                value={formData.vendorCity || ''}
                onChange={handleChange}
                placeholder="city"
                className="flex-1 border border-gray-300 rounded-r-lg px-3 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Postal Code</label>
            <div className="flex items-center">
              <span className="bg-gray-100 border border-r-0 border-gray-300 px-3 py-2 rounded-l-lg text-gray-500">🏷️</span>
              <input
                type="text"
                name="vendorPostalCode"
                value={formData.vendorPostalCode || ''}
                onChange={handleChange}
                placeholder="postal code"
                className="flex-1 border border-gray-300 rounded-r-lg px-3 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
            <div className="flex items-center">
              <span className="bg-gray-100 border border-r-0 border-gray-300 px-3 py-2 rounded-l-lg text-gray-500">🌐</span>
              <select
                name="vendorCountry"
                value={formData.vendorCountry || 'CA'}
                onChange={handleChange}
                className="flex-1 border border-gray-300 rounded-r-lg px-3 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent"
              >
                <option value="CA">CA</option>
                <option value="US">US</option>
              </select>
            </div>
          </div>
        </div>

        <div className="flex justify-end mb-4">
          <button
            type="button"
            onClick={handleClear}
            className="text-[#118df0] hover:underline text-sm"
          >
            Clear
          </button>
        </div>

        {/* Plate & Sale Info */
        }
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Plate #</label>
            <input
              type="text"
              name="plateNumber"
              value={formData.plateNumber || ''}
              onChange={handleChange}
              placeholder="plate number"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Sale State</label>
            <select
              name="saleState"
              value={formData.saleState || ''}
              onChange={handleChange}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent"
            >
              <option value="">Not Set</option>
              <option value="resale">Resale</option>
              <option value="wrecking">Wrecking</option>
              <option value="consignment">Consignment</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">License Fee (Purchase Agreement)</label>
            <input
              type="number"
              name="licenseFee"
              value={formData.licenseFee || 0}
              onChange={handleChange}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent"
            />
          </div>
        </div>

        {/* Auction Toggle */}
        <div className="flex items-center gap-2 mb-6">
          <span className="text-sm text-gray-700">Was this vehicle purchased through an auction?</span>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              name="purchasedThroughAuction"
              checked={formData.purchasedThroughAuction || false}
              onChange={handleChange}
              className="w-4 h-4 text-[#118df0] focus:ring-[#118df0] rounded"
            />
            <span className="text-sm">{formData.purchasedThroughAuction ? 'Yes' : 'No'}</span>
          </label>
        </div>
      </div>

      {/* Purchase price, ACV, Discount */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Purchase Price</label>
          <div className="flex items-center">
            <span className="bg-gray-100 border border-r-0 border-gray-300 px-3 py-2 rounded-l-lg text-gray-500">$</span>
            <input
              type="number"
              name="purchasePrice"
              value={formData.purchasePrice || 0}
              onChange={handleChange}
              className="flex-1 border border-gray-300 rounded-r-lg px-3 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Actual Cash Value</label>
          <div className="flex items-center">
            <span className="bg-gray-100 border border-r-0 border-gray-300 px-3 py-2 rounded-l-lg text-gray-500">$</span>
            <input
              type="number"
              name="actualCashValue"
              value={formData.actualCashValue || 0}
              onChange={handleChange}
              className="flex-1 border border-gray-300 rounded-r-lg px-3 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Discount</label>
          <div className="flex items-center">
            <span className="bg-gray-100 border border-r-0 border-gray-300 px-3 py-2 rounded-l-lg text-gray-500">$</span>
            <input
              type="number"
              name="discount"
              value={formData.discount || 0}
              onChange={handleChange}
              className="flex-1 border border-gray-300 rounded-r-lg px-3 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {/* Tax Rate & Override */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="flex items-center gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Select Tax Rates</label>
            <select
              name="taxType"
              value={formData.taxType || ''}
              onChange={handleChange}
              className="w-48 border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent"
            >
              {loadingTaxPresets ? (
                <option value="">Loading...</option>
              ) : taxPresets.length ? (
                taxPresets
                  .filter((t) => String(t.name || '').trim())
                  .map((t) => {
                    const name = String(t.name || '').trim()
                    const rate = typeof t.rate === 'number' ? t.rate : parseFloat(String(t.rate || '0'))
                    return (
                      <option key={t.id} value={name}>
                        {formatTaxLabel(name, Number.isFinite(rate) ? rate : 0)}
                      </option>
                    )
                  })
              ) : (
                <option value="">No tax presets</option>
              )}
            </select>
          </div>
          <label className="mt-6 flex items-center gap-2">
            <input
              type="checkbox"
              name="taxOverride"
              checked={!!formData.taxOverride}
              onChange={handleChange}
              className="w-4 h-4 text-[#118df0] focus:ring-[#118df0] rounded"
            />
            <span className="text-sm text-gray-700">Tax override</span>
          </label>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{getSelectedTaxLabel()}</label>
          <div className="flex items-center">
            <span className="bg-gray-100 border border-r-0 border-gray-300 px-3 py-2 rounded-l-lg text-gray-500">$</span>
            <input
              type="number"
              name="vehicleTax"
              value={formData.vehicleTax || 0}
              onChange={handleChange}
              readOnly={!formData.taxOverride}
              className={`flex-1 border border-gray-300 rounded-r-lg px-3 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent ${formData.taxOverride ? '' : 'bg-gray-100'}`}
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Total Vehicle Tax</label>
          <div className="flex items-center">
            <span className="bg-gray-100 border border-r-0 border-gray-300 px-3 py-2 rounded-l-lg text-gray-500">$</span>
            <input
              type="number"
              name="totalVehicleTax"
              value={formData.totalVehicleTax || 0}
              onChange={handleChange}
              readOnly
              className="flex-1 border border-gray-300 rounded-r-lg px-3 py-2 bg-gray-100"
            />
          </div>
        </div>
      </div>

      {/* Payment Status */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-1">Payment Status <span className="text-xs text-gray-400">Ex: Paid</span></label>
        <div className="flex items-center gap-3">
          <select
            name="paymentStatus"
            value={formData.paymentStatus || ''}
            onChange={handleChange}
            className="w-64 border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent"
          >
            <option value="">Ex: Paid</option>
            <option value="paid">Paid</option>
            <option value="not_paid">Not Paid</option>
            <option value="waiting">Waiting</option>
            <option value="negotiation">Negotiation</option>
            <option value="arb_issue">Arb Issue</option>
            <option value="problem">Problem</option>
            <option value="voided">Voided</option>
          </select>
          <a className="text-sm text-gray-500 hover:underline" href="#">More »</a>
        </div>
      </div>

      {/* Action Buttons */}
      {!hideSaveButton && (
        <div className="mt-8 flex gap-4">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 bg-[#118df0] text-white py-3 rounded-lg font-semibold hover:bg-[#0d6ebd] transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Purchase Info'}
          </button>
        </div>
      )}

      {showNewVendorModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-3xl rounded-lg bg-white shadow-lg">
            <div className="px-6 py-4">
              <h3 className="text-lg font-semibold text-gray-900">New Vendor</h3>
            </div>

            <div className="max-h-[70vh] overflow-y-auto px-6 pb-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Company Name</label>
                  <div className="flex items-center">
                    <span className="bg-gray-100 border border-r-0 border-gray-300 px-3 py-2 rounded-l-lg text-gray-500">🏢</span>
                    <input
                      type="text"
                      value={newVendorForm.companyName}
                      onChange={(e) => setNewVendorForm(prev => ({ ...prev, companyName: e.target.value }))}
                      className="flex-1 border border-gray-300 rounded-r-lg px-3 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Contact First Name</label>
                  <div className="flex items-center">
                    <span className="bg-gray-100 border border-r-0 border-gray-300 px-3 py-2 rounded-l-lg text-gray-500">👤</span>
                    <input
                      type="text"
                      value={newVendorForm.contactFirstName}
                      onChange={(e) => setNewVendorForm(prev => ({ ...prev, contactFirstName: e.target.value }))}
                      className="flex-1 border border-gray-300 rounded-r-lg px-3 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Contact Last Name</label>
                  <div className="flex items-center">
                    <span className="bg-gray-100 border border-r-0 border-gray-300 px-3 py-2 rounded-l-lg text-gray-500">👤</span>
                    <input
                      type="text"
                      value={newVendorForm.contactLastName}
                      onChange={(e) => setNewVendorForm(prev => ({ ...prev, contactLastName: e.target.value }))}
                      className="flex-1 border border-gray-300 rounded-r-lg px-3 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent"
                    />
                  </div>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Street Address</label>
                  <div className="flex items-center">
                    <span className="bg-gray-100 border border-r-0 border-gray-300 px-3 py-2 rounded-l-lg text-gray-500">📍</span>
                    <input
                      type="text"
                      value={newVendorForm.streetAddress}
                      onChange={(e) => setNewVendorForm(prev => ({ ...prev, streetAddress: e.target.value }))}
                      className="flex-1 border border-gray-300 rounded-r-lg px-3 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Suite/Apt</label>
                  <div className="flex items-center">
                    <span className="bg-gray-100 border border-r-0 border-gray-300 px-3 py-2 rounded-l-lg text-gray-500">#</span>
                    <input
                      type="text"
                      value={newVendorForm.suiteApt}
                      onChange={(e) => setNewVendorForm(prev => ({ ...prev, suiteApt: e.target.value }))}
                      className="flex-1 border border-gray-300 rounded-r-lg px-3 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                  <div className="flex items-center">
                    <span className="bg-gray-100 border border-r-0 border-gray-300 px-3 py-2 rounded-l-lg text-gray-500">📍</span>
                    <input
                      type="text"
                      value={newVendorForm.city}
                      onChange={(e) => setNewVendorForm(prev => ({ ...prev, city: e.target.value }))}
                      className="flex-1 border border-gray-300 rounded-r-lg px-3 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Province</label>
                  <select
                    value={newVendorForm.province}
                    onChange={(e) => setNewVendorForm(prev => ({ ...prev, province: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Postal Code</label>
                  <div className="flex items-center">
                    <span className="bg-gray-100 border border-r-0 border-gray-300 px-3 py-2 rounded-l-lg text-gray-500">🏷️</span>
                    <input
                      type="text"
                      value={newVendorForm.postalCode}
                      onChange={(e) => setNewVendorForm(prev => ({ ...prev, postalCode: e.target.value }))}
                      className="flex-1 border border-gray-300 rounded-r-lg px-3 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
                  <select
                    value={newVendorForm.country}
                    onChange={(e) => setNewVendorForm(prev => ({ ...prev, country: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent"
                  >
                    <option value="CA">CA</option>
                    <option value="US">US</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">RIN</label>
                  <div className="flex items-center">
                    <span className="bg-gray-100 border border-r-0 border-gray-300 px-3 py-2 rounded-l-lg text-gray-500">🪪</span>
                    <input
                      type="text"
                      value={newVendorForm.rin}
                      onChange={(e) => setNewVendorForm(prev => ({ ...prev, rin: e.target.value }))}
                      className="flex-1 border border-gray-300 rounded-r-lg px-3 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent"
                    />
                  </div>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Salesperson Registration #</label>
                  <div className="flex items-center">
                    <span className="bg-gray-100 border border-r-0 border-gray-300 px-3 py-2 rounded-l-lg text-gray-500">🧑‍💼</span>
                    <input
                      type="text"
                      value={newVendorForm.salespersonRegistration}
                      onChange={(e) => setNewVendorForm(prev => ({ ...prev, salespersonRegistration: e.target.value }))}
                      className="flex-1 border border-gray-300 rounded-r-lg px-3 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent"
                    />
                  </div>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Company MVDA #</label>
                  <div className="flex items-center">
                    <span className="bg-gray-100 border border-r-0 border-gray-300 px-3 py-2 rounded-l-lg text-gray-500">#</span>
                    <input
                      type="text"
                      value={newVendorForm.companyMvda}
                      onChange={(e) => setNewVendorForm(prev => ({ ...prev, companyMvda: e.target.value }))}
                      className="flex-1 border border-gray-300 rounded-r-lg px-3 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent"
                    />
                  </div>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tax Number</label>
                  <div className="flex items-center">
                    <span className="bg-gray-100 border border-r-0 border-gray-300 px-3 py-2 rounded-l-lg text-gray-500">#</span>
                    <input
                      type="text"
                      value={newVendorForm.taxNumber}
                      onChange={(e) => setNewVendorForm(prev => ({ ...prev, taxNumber: e.target.value }))}
                      className="flex-1 border border-gray-300 rounded-r-lg px-3 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                  <div className="flex items-center">
                    <span className="bg-gray-100 border border-r-0 border-gray-300 px-3 py-2 rounded-l-lg text-gray-500">📞</span>
                    <input
                      type="text"
                      value={newVendorForm.phone}
                      onChange={(e) => setNewVendorForm(prev => ({ ...prev, phone: e.target.value }))}
                      className="flex-1 border border-gray-300 rounded-r-lg px-3 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Mobile</label>
                  <div className="flex items-center">
                    <span className="bg-gray-100 border border-r-0 border-gray-300 px-3 py-2 rounded-l-lg text-gray-500">📱</span>
                    <input
                      type="text"
                      value={newVendorForm.mobile}
                      onChange={(e) => setNewVendorForm(prev => ({ ...prev, mobile: e.target.value }))}
                      className="flex-1 border border-gray-300 rounded-r-lg px-3 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <div className="flex items-center">
                    <span className="bg-gray-100 border border-r-0 border-gray-300 px-3 py-2 rounded-l-lg text-gray-500">✉️</span>
                    <input
                      type="email"
                      value={newVendorForm.email}
                      onChange={(e) => setNewVendorForm(prev => ({ ...prev, email: e.target.value }))}
                      className="flex-1 border border-gray-300 rounded-r-lg px-3 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fax</label>
                  <div className="flex items-center">
                    <span className="bg-gray-100 border border-r-0 border-gray-300 px-3 py-2 rounded-l-lg text-gray-500">📠</span>
                    <input
                      type="text"
                      value={newVendorForm.fax}
                      onChange={(e) => setNewVendorForm(prev => ({ ...prev, fax: e.target.value }))}
                      className="flex-1 border border-gray-300 rounded-r-lg px-3 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 px-6 py-4">
              <button
                type="button"
                onClick={() => setShowNewVendorModal(false)}
                disabled={savingNewVendor}
                className="rounded-md bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-600"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleNewVendorOk}
                disabled={savingNewVendor}
                className="rounded-md bg-[#118df0] px-4 py-2 text-sm font-medium text-white hover:bg-[#0d6ebd]"
              >
                {savingNewVendor ? 'Saving...' : 'OK'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
})

export default PurchaseTab
