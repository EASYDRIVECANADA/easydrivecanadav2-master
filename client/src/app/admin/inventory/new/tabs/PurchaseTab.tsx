'use client'

import { useState, useEffect } from 'react'
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
}

export default function PurchaseTab({ vehicleId, stockNumber }: PurchaseTabProps) {
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

  useEffect(() => {
    fetchPurchaseData()
  }, [vehicleId, stockNumber])

  const fetchPurchaseData = async () => {
    try {
      // Primary: prefill from edc_purchase using stock number if available
      if (stockNumber) {
        try { console.info('[PurchaseTab] Prefill fallback from edc_purchase using stock_number:', stockNumber) } catch {}
        const { data: purchaseRow, error: purchaseErr } = await supabase
          .from('edc_purchase')
          .select('*')
          .eq('stock_number', stockNumber)
          .order('updated_at', { ascending: false })
          .limit(1)
          .single()

        let row = purchaseRow
        if ((!row || purchaseErr) && stockNumber) {
          // Fallback to created_at in case updated_at is null
          const { data: purchaseRow2 } = await supabase
            .from('edc_purchase')
            .select('*')
            .eq('stock_number', stockNumber)
            .order('created_at', { ascending: false })
            .limit(1)
            .single()
          row = purchaseRow2 || row
        }

        if (row) {
          // Map columns from edc_purchase to PurchaseData shape
          const mapped: PurchaseData = {
            publicOrCompany: row.public_or_company || undefined,
            vendorName: row.vendor_name || undefined,
            salespersonRegistration: row.salesperson_registration || undefined,
            companyMvda: row.company_mvda || undefined,
            taxNumber: row.tax_number || undefined,
            vendorPhone: row.vendor_phone || undefined,
            vendorMobile: row.vendor_mobile || undefined,
            vendorFax: row.vendor_fax || undefined,
            vendorEmail: row.vendor_email || undefined,
            vendorLocation: row.vendor_location || undefined,
            vendorAptSuite: row.vendor_apt_suite || undefined,
            vendorCity: row.vendor_city || undefined,
            vendorProvince: row.vendor_province || undefined,
            vendorPostalCode: row.vendor_postal_code || undefined,
            vendorCountry: row.vendor_country || undefined,
            driverLicense: row.driver_license || undefined,
            rin: row.rin || undefined,
            plateNumber: row.plate_number || undefined,
            saleState: row.sale_state || undefined,
            licenseFee: row.license_fee ?? undefined,
            purchasedThroughAuction: row.purchased_through_auction ?? undefined,
            paymentStatus: row.payment_status || undefined,
            purchasedOn: row.purchased_on || undefined,
            dateReceived: row.date_received || undefined,
            dateDelivered: row.date_delivered || undefined,
            reconCompletedBy: row.recon_completed_by || undefined,
            ownershipStatus: row.ownership_status || undefined,
            titleReceived: row.title_received || undefined,
            ownershipNotes: row.ownership_notes || undefined,
            purchasePrice: row.purchase_price ?? undefined,
            actualCashValue: row.actual_cash_value ?? undefined,
            discount: row.discount ?? undefined,
            taxType: row.tax_type || undefined,
            taxOverride: row.tax_override ?? undefined,
            vehicleTax: row.vehicle_tax ?? undefined,
            totalVehicleTax: row.total_vehicle_tax ?? undefined,
          }
          try { console.info('[PurchaseTab] Prefilled from edc_purchase for stock:', stockNumber, mapped) } catch {}
          setFormData(prev => ({ ...prev, ...mapped }))
          return
        }
      }

      // Secondary: if no stock number data was found, try vehicle's stored purchase_data
      const { data, error } = await supabase
        .from('edc_vehicles')
        .select('purchase_data')
        .eq('id', vehicleId)
        .maybeSingle()

      if (data?.purchase_data && Object.keys(data.purchase_data || {}).length > 0) {
        try { console.info('[PurchaseTab] Prefill from edc_vehicles.purchase_data (secondary)') } catch {}
        setFormData(prev => ({ ...prev, ...data.purchase_data }))
        return
      }
    } catch (error) {
      console.error('Error fetching purchase data:', error)
    }
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

  const handleSave = async () => {
    setSaving(true)
    try {
      // Remove undefined values to ensure clean JSON payload
      const cleanData: PurchaseData = JSON.parse(JSON.stringify(formData))

      const { data: vehRows, error: vehiclesErr } = await supabase
        .from('edc_vehicles')
        .update({ purchase_data: cleanData })
        .eq('id', vehicleId)
        .select('id')

      if (vehiclesErr) {
        console.error('Error updating edc_vehicles.purchase_data:', vehiclesErr)
      }

      // Also persist into edc_purchase keyed by stock number if present
      let purchaseErr: any = null
      let purchaseChanged = false
      if (stockNumber) {
        // Map full set of known columns in your table
        const purchaseRow: any = {
          public_or_company: cleanData.publicOrCompany || null,
          vendor_name: cleanData.vendorName || null,
          salesperson_registration: cleanData.salespersonRegistration || null,
          company_mvda: cleanData.companyMvda || null,
          tax_number: cleanData.taxNumber || null,
          vendor_phone: cleanData.vendorPhone || null,
          vendor_mobile: cleanData.vendorMobile || null,
          vendor_fax: cleanData.vendorFax || null,
          vendor_email: cleanData.vendorEmail || null,
          vendor_location: cleanData.vendorLocation || null,
          vendor_apt_suite: cleanData.vendorAptSuite || null,
          vendor_city: cleanData.vendorCity || null,
          vendor_postal_code: cleanData.vendorPostalCode || null,
          plate_number: cleanData.plateNumber || null,
          sale_state: cleanData.saleState || null,
          purchased_through_auction: cleanData.purchasedThroughAuction ?? null,
          purchase_price: cleanData.purchasePrice ?? null,
          actual_cash_value: cleanData.actualCashValue ?? null,
          discount: cleanData.discount ?? null,
          tax_type: cleanData.taxType || null,
          tax_override: cleanData.taxOverride ?? null,
          vehicle_tax: cleanData.vehicleTax ?? null,
          total_vehicle_tax: cleanData.totalVehicleTax ?? null,
          license_fee: cleanData.licenseFee ?? null,
          purchased_on: cleanData.purchasedOn || null,
          date_received: cleanData.dateReceived || null,
          date_delivered: cleanData.dateDelivered || null,
          recon_completed_by: cleanData.reconCompletedBy || null,
          title_received: cleanData.titleReceived || null,
          ownership_status: cleanData.ownershipStatus || null,
          ownership_notes: cleanData.ownershipNotes || null,
          driver_license: cleanData.driverLicense || null,
          rin: cleanData.rin || null,
          payment_status: cleanData.paymentStatus || null,
          updated_at: new Date().toISOString(),
        }

        // First try to update by stock_number
        const { data: updRows, error: updErr } = await supabase
          .from('edc_purchase')
          .update(purchaseRow)
          .eq('stock_number', stockNumber)
          .select('id')

        if (updErr) {
          console.error('Error updating edc_purchase by stock_number:', updErr)
          purchaseErr = updErr
        }

        // If no row updated, insert a new one with stock_number
        if (!purchaseErr && (!updRows || updRows.length === 0)) {
          const insertPayload = { stock_number: stockNumber, ...purchaseRow }
          const { data: insRow, error: insErr } = await supabase
            .from('edc_purchase')
            .insert(insertPayload)
            .select('id')
            .single()
          if (insErr) {
            console.error('Error inserting edc_purchase:', insErr)
            purchaseErr = insErr
          } else if (insRow?.id) {
            purchaseChanged = true
          }
        } else if (updRows && updRows.length > 0) {
          purchaseChanged = true
        }
      }

      const vehiclesChanged = Array.isArray(vehRows) && vehRows.length > 0
      const success = vehiclesChanged || purchaseChanged
      if (success) {
        alert('Purchase information saved successfully!')
        fetchPurchaseData()
      } else {
        alert('Error saving purchase information. See console for details.')
      }
    } catch (error) {
      console.error('Failed to send purchase to webhook:', error)
      alert('Error saving purchase info')
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
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="radio"
              name="publicOrCompany"
              value="public"
              checked={formData.publicOrCompany === 'public'}
              onChange={handleChange}
              className="w-4 h-4 text-[#118df0] focus:ring-[#118df0]"
            />
            <span className="text-sm">on</span>
          </label>
          <span className="w-8 h-5 bg-green-500 rounded-full relative">
            <span className="absolute right-0.5 top-0.5 w-4 h-4 bg-white rounded-full"></span>
          </span>
        </div>

        {/* Vendor Details Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">👤 Name</label>
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
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">🪪 Driver License</label>
            <div className="flex items-center">
              <span className="bg-gray-100 border border-r-0 border-gray-300 px-3 py-2 rounded-l-lg text-gray-500">🪪</span>
              <input
                type="text"
                name="driverLicense"
                value={formData.driverLicense || ''}
                onChange={handleChange}
                placeholder="driver license"
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
                className="flex-1 border border-gray-300 rounded-r-lg px-3 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent"
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">👤 Salesperson Registration *</label>
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
            <label className="block text-sm font-medium text-gray-700 mb-1">🏢 Company MVDA #</label>
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

        {/* QuickBooks Info */}
        <div className="bg-blue-600 text-white rounded-lg p-3 mb-4">
          <p className="text-sm">ℹ️ Connect QuickBooks in Settings to enable vendor selection for Bill generation.</p>
        </div>

        {/* Contact Details */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">📞 Phone</label>
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
            <label className="block text-sm font-medium text-gray-700 mb-1">📱 Mobile</label>
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
            <label className="block text-sm font-medium text-gray-700 mb-1">📠 Fax</label>
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
            <label className="block text-sm font-medium text-gray-700 mb-1">✉️ Email</label>
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
            <label className="block text-sm font-medium text-gray-700 mb-1">📍 Enter a location</label>
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
            <label className="block text-sm font-medium text-gray-700 mb-1">📍 Apt/Suite #</label>
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
            <label className="block text-sm font-medium text-gray-700 mb-1">📍 City</label>
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
            <label className="block text-sm font-medium text-gray-700 mb-1">📍 Postal Code</label>
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
      <div className="flex gap-4">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex-1 bg-[#118df0] text-white py-3 rounded-lg font-semibold hover:bg-[#0d6ebd] transition-colors disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Purchase Info'}
        </button>
      </div>
    </div>
  )
}
