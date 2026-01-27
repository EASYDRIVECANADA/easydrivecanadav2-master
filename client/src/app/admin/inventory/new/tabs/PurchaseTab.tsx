'use client'

import { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react'

// Supported tax rates for purchase calculations
const TAX_RATES: Record<string, number> = {
  HST: 0.13,
  RST: 0.08,
  GST: 0.05,
  PST: 0.06,
  QST: 0.09975,
  Exempt: 0,
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

interface PurchaseTabProps {
  vehicleId: string
  stockNumber?: string
  onError?: (message: string) => void
  hideSaveButton?: boolean
}

export interface PurchaseTabHandle {
  save: () => Promise<boolean>
  getData: () => PurchaseData
}

const PurchaseTab = forwardRef<PurchaseTabHandle, PurchaseTabProps>(function PurchaseTab({ vehicleId, stockNumber, onError, hideSaveButton }, ref) {
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
  const [vendorSearch, setVendorSearch] = useState('')
  const isCompany = formData.publicOrCompany === 'company'
  const [publicIdType, setPublicIdType] = useState<'dl' | 'rin'>('dl')
  const driverLicenseRef = useRef<HTMLInputElement | null>(null)
  const rinRef = useRef<HTMLInputElement | null>(null)

  useImperativeHandle(ref, () => ({
    save: handleSave,
    getData: () => formData,
  }))

  useEffect(() => {
    // webhook-driven: no client-side supabase prefill
  }, [vehicleId, stockNumber])

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
        const rate = TAX_RATES[next.taxType || 'Exempt'] ?? 0
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
      if (!stockNumber || !String(stockNumber).trim()) {
        const msg = 'Missing stock number. Please set Stock # in Vehicle Details first.'
        onError?.(msg)
        return false
      }

      const fullPayload: Record<string, any> = {
        vehicleId: String(vehicleId),
        stockNumber: String(stockNumber).trim(),
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
            <div className="flex items-center">
              <span className="bg-gray-100 border border-r-0 border-gray-300 px-3 py-2 rounded-l-lg text-gray-500">🔍</span>
              <input
                type="text"
                placeholder="vendor search"
                value={vendorSearch}
                onChange={(e) => setVendorSearch(e.target.value)}
                className="flex-1 border border-gray-300 rounded-r-lg px-3 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent"
              />
            </div>
          </div>
          <a href="#" className="text-sm text-[#118df0] hover:underline">Didn't find what you're looking for? Add new</a>
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
              value={formData.taxType || 'HST'}
              onChange={handleChange}
              className="w-48 border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent"
            >
              <option value="HST">HST 13%</option>
              <option value="RST">RST 8%</option>
              <option value="GST">GST 5%</option>
              <option value="PST">PST 6%</option>
              <option value="QST">QST 9.975%</option>
              <option value="Exempt">Exempt 0%</option>
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
          <label className="block text-sm font-medium text-gray-700 mb-1">{formData.taxType || 'HST'}</label>
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
    </div>
  )
})

export default PurchaseTab
