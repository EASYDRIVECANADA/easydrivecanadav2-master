'use client'

import { useEffect, useState } from 'react'

interface VehicleFormData {
  id?: string
  make?: string
  model?: string
  year?: number
  trim?: string
  stockNumber?: string
  keyNumber?: string
  keyDescription?: string
  series?: string
  equipment?: string
  vin?: string
  price?: number
  mileage?: number
  odometer?: string
  odometerUnit?: string
  inStockDate?: string
  exteriorColor?: string
  interiorColor?: string
  transmission?: string
  drivetrain?: string
  fuelType?: string
  bodyStyle?: string
  vehicleType?: string
  description?: string
  adDescription?: string
  features?: string | string[]
  city?: string
  province?: string
  status?: string
  inventoryType?: string
  condition?: string
  statusColour?: string
  retailWholesale?: string
  substatus?: string
  assignment?: string
  lotLocation?: string
  keywords?: string
  feedwords?: string
  distanceDisclaimer?: boolean
  feedToAutotrader?: boolean
  feedToCarpages?: boolean
  feedToCargurus?: boolean
  engine?: string
  cylinders?: string
  doors?: string
  other?: string
  notes?: string
  certified?: boolean
  verified?: boolean
}

interface VehicleDetailsTabProps {
  formData: VehicleFormData
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void
  onFormDataChange: (data: Partial<VehicleFormData>) => void
  onSubmit: (e: React.FormEvent) => void
  saving: boolean
}

export default function VehicleDetailsTab({ formData, onChange, onFormDataChange, onSubmit, saving }: VehicleDetailsTabProps) {
  const [certified, setCertified] = useState(formData.certified || false)
  const [verified, setVerified] = useState(formData.verified || false)
  const [distanceDisclaimer, setDistanceDisclaimer] = useState(formData.distanceDisclaimer || false)
  const [feedToAutotrader, setFeedToAutotrader] = useState(formData.feedToAutotrader || false)
  const [feedToCarpages, setFeedToCarpages] = useState(formData.feedToCarpages || false)
  const [feedToCargurus, setFeedToCargurus] = useState(formData.feedToCargurus || false)
  const [sendingVin, setSendingVin] = useState(false)
  const [vinPrefilled, setVinPrefilled] = useState(false)
  const [lastVinSent, setLastVinSent] = useState<string>('')

  useEffect(() => {
    if (!formData?.vin || formData.vin !== lastVinSent) {
      setVinPrefilled(false)
    }
  }, [formData?.vin, lastVinSent])

  const handleToggle = (field: string, value: boolean, setter: (v: boolean) => void) => {
    setter(value)
    onFormDataChange({ [field]: value })
  }

  const handleSendVin = async () => {
    if (!formData?.vin || String(formData.vin).trim().length < 5) {
      alert('Please enter a valid VIN before sending.')
      return
    }

    try {
      setSendingVin(true)
      const res = await fetch('/api/vincode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vin: String(formData.vin).trim() }),
      })

      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(text || `Webhook responded with ${res.status}`)
      }

      const json = await res.json().catch(() => null)
      console.log('[vin+][edit-details] webhook response:', json)

      const first: any = Array.isArray(json) ? (json[0] || {}) : (json || {})
      const decode = Array.isArray(first.decode) ? first.decode : []
      const byLabel = (label: string) => decode.find((d: any) => d?.label === label)?.value
      const flatGet = (key: string) => {
        const entries = Object.entries(first || {}).map(([k, v]) => [String(k).trim().toLowerCase(), v] as const)
        const want = key.trim().toLowerCase()
        const hit = entries.find(([k]) => k === want)
        return hit ? hit[1] : undefined
      }

      const mapBodyToBodyStyle = (val: string | undefined) => {
        if (!val) return ''
        const s = String(val).toLowerCase()
        if (s.includes('pickup')) return 'Truck'
        if (s.includes('suv')) return 'SUV'
        if (s.includes('truck')) return 'Truck'
        if (s.includes('coupe')) return 'Coupe'
        if (s.includes('hatch')) return 'Hatchback'
        if (s.includes('wagon')) return 'Wagon'
        if (s.includes('van')) return 'Van'
        if (s.includes('convertible')) return 'Convertible'
        if (s.includes('sedan')) return 'Sedan'
        return ''
      }

      const mapDrive = (val: string | undefined) => {
        if (!val) return ''
        const s = String(val).toUpperCase()
        if (s.includes('4WD') || s.includes('4X4')) return '4WD'
        if (s.includes('AWD')) return 'AWD'
        if (s.includes('RWD')) return 'RWD'
        if (s.includes('FWD')) return 'FWD'
        return ''
      }

      const make = byLabel('Make') || flatGet('make') || ''
      const model = byLabel('Model') || flatGet('model') || ''
      const year = byLabel('Model Year') || flatGet('year') || ''
      const body = byLabel('Body') || flatGet('body style') || flatGet('body') || ''
      const trim = byLabel('Trim') || flatGet('trim') || ''
      const drive = byLabel('Drive') || flatGet('drivetrain') || ''
      const cylinders = byLabel('Engine Cylinders') || flatGet('cylinders') || ''
      const fuelPrimary = byLabel('Fuel Type - Primary') || flatGet('fuel type') || ''
      const transmission = byLabel('Transmission') || flatGet('transmission') || ''
      const doors = byLabel('Number of Doors') || flatGet('doors') || ''
      const engine = byLabel('Engine Model') || flatGet('engine') || ''

      onFormDataChange({
        make: String(make || formData.make || ''),
        model: String(model || formData.model || ''),
        year: Number(year) || formData.year,
        bodyStyle: mapBodyToBodyStyle(String(body)) || formData.bodyStyle,
        drivetrain: mapDrive(String(drive)) || formData.drivetrain,
        fuelType: String(fuelPrimary || formData.fuelType || ''),
        transmission: String(transmission || formData.transmission || ''),
        trim: String(trim || formData.trim || ''),
        doors: String(doors || formData.doors || ''),
        cylinders: String(cylinders || formData.cylinders || ''),
        engine: String(engine || formData.engine || ''),
        stockNumber: String(flatGet('stock number (unit id)') || formData.stockNumber || ''),
      })

      setVinPrefilled(true)
      setLastVinSent(String(formData.vin).trim())
    } catch (err) {
      console.error('Error sending VIN webhook:', err)
      alert('Failed to send VIN. Please try again.')
    } finally {
      setSendingVin(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="bg-white rounded-xl shadow p-6">
      <div className="space-y-6">
        {/* Top Row: Toggles */}
        <div className="flex justify-end items-center gap-6 mb-4">
          <label className="flex items-center gap-2 text-sm">
            <span>CERTIFIED/AS-IS</span>
            <button
              type="button"
              onClick={() => handleToggle('certified', !certified, setCertified)}
              className={`relative w-12 h-6 rounded-full transition-colors ${certified ? 'bg-[#118df0]' : 'bg-gray-300'}`}
            >
              <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${certified ? 'right-1' : 'left-1'}`}></span>
            </button>
            <span className="text-xs px-2 py-0.5 rounded bg-green-100 text-green-700">CERT</span>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <span>Verified?</span>
            <button
              type="button"
              onClick={() => handleToggle('verified', !verified, setVerified)}
              className={`relative w-12 h-6 rounded-full transition-colors ${verified ? 'bg-[#118df0]' : 'bg-gray-300'}`}
            >
              <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${verified ? 'right-1' : 'left-1'}`}></span>
            </button>
            <span className="text-xs px-2 py-0.5 rounded bg-yellow-100 text-yellow-700">YB</span>
          </label>
        </div>

        {/* Row 1: Condition, Status, Status Colour, Retail/Wholesale */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm text-gray-600 mb-1">Condition</label>
            <select name="condition" value={formData.condition || 'Used'} onChange={onChange} className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-1 focus:ring-[#118df0] focus:border-[#118df0]">
              <option value="Used">Used</option>
              <option value="New">New</option>
              <option value="Certified">Certified</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Status</label>
            <select name="status" value={formData.status || 'In Stock'} onChange={onChange} className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-1 focus:ring-[#118df0] focus:border-[#118df0]">
              <option value="In Stock">In Stock</option>
              <option value="In Stock (No Feed)">In Stock (No Feed)</option>
              <option value="Coming Soon">Coming Soon</option>
              <option value="In Trade">In Trade</option>
              <option value="Deal Pending">Deal Pending</option>
              <option value="Sold">Sold</option>
              <option value="Void">Void</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Status Colour</label>
            <select name="statusColour" value={formData.statusColour || ''} onChange={onChange} className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-1 focus:ring-[#118df0] focus:border-[#118df0]">
              <option value="">Colour</option>
              <option value="Green">Green</option>
              <option value="Yellow">Yellow</option>
              <option value="Red">Red</option>
              <option value="Blue">Blue</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Retail/Wholesale</label>
            <select name="retailWholesale" value={formData.retailWholesale || ''} onChange={onChange} className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-1 focus:ring-[#118df0] focus:border-[#118df0]">
              <option value="">Classification</option>
              <option value="Retail">Retail</option>
              <option value="Wholesale">Wholesale</option>
            </select>
          </div>
        </div>

        {/* Row 2: Substatuses, Assignment */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm text-gray-600 mb-1">Substatuses</label>
            <input type="text" name="substatus" value={formData.substatus || ''} onChange={onChange} placeholder="Substatus" className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-1 focus:ring-[#118df0] focus:border-[#118df0]" />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1 flex items-center gap-1">Assignment <span className="text-blue-500 cursor-help" title="Assign to a user">ⓘ</span></label>
            <select name="assignment" value={formData.assignment || ''} onChange={onChange} className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-1 focus:ring-[#118df0] focus:border-[#118df0]">
              <option value="">None</option>
              <option value="Sales">Sales</option>
              <option value="Service">Service</option>
              <option value="Manager">Manager</option>
            </select>
          </div>
        </div>

        {/* Row 3: Stock #, In Stock Date */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-600 mb-1">Stock #</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">#</span>
              <input type="text" name="stockNumber" value={formData.stockNumber || ''} onChange={onChange} placeholder="1012" className="w-full border border-gray-300 rounded pl-8 pr-3 py-2 text-sm focus:ring-1 focus:ring-[#118df0] focus:border-[#118df0]" />
            </div>
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">In Stock Date</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">📅</span>
              <input type="date" name="inStockDate" value={formData.inStockDate || ''} onChange={onChange} className="w-full border border-gray-300 rounded pl-10 pr-3 py-2 text-sm focus:ring-1 focus:ring-[#118df0] focus:border-[#118df0]" />
            </div>
          </div>
        </div>

        {/* Row 4: VIN, Odometer */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-600 mb-1">VIN</label>
            <div className="flex">
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">▦</span>
                <input type="text" name="vin" value={formData.vin || ''} onChange={onChange} placeholder="VIN" className="w-full border border-gray-300 rounded-l pl-8 pr-3 py-2 text-sm focus:ring-1 focus:ring-[#118df0] focus:border-[#118df0]" />
              </div>
              <button
                type="button"
                onClick={handleSendVin}
                disabled={sendingVin}
                className="px-4 py-2 bg-[#118df0] text-white text-sm font-medium rounded-r hover:bg-[#0d6ebd] disabled:opacity-50"
              >
                {sendingVin ? 'Decoding...' : vinPrefilled ? 'Decoded' : 'Decode'}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Odometer</label>
            <div className="flex">
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">⊕</span>
                <input type="number" name="odometer" value={formData.odometer || formData.mileage || ''} onChange={onChange} placeholder="odometer" className="w-full border border-gray-300 rounded-l pl-8 pr-3 py-2 text-sm focus:ring-1 focus:ring-[#118df0] focus:border-[#118df0]" />
              </div>
              <select name="odometerUnit" value={formData.odometerUnit || 'kms'} onChange={onChange} className="border border-l-0 border-gray-300 rounded-r px-3 py-2 text-sm bg-white focus:ring-1 focus:ring-[#118df0] focus:border-[#118df0]">
                <option value="kms">kms</option>
                <option value="miles">miles</option>
              </select>
            </div>
          </div>
        </div>

        {/* Distance Disclaimer */}
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="distanceDisclaimer"
            checked={distanceDisclaimer}
            onChange={(e) => handleToggle('distanceDisclaimer', e.target.checked, setDistanceDisclaimer)}
            className="w-4 h-4 text-[#118df0] border-gray-300 rounded focus:ring-[#118df0]"
          />
          <label htmlFor="distanceDisclaimer" className="text-sm text-gray-600">Distance travelled may be substantially higher than odometer reading</label>
        </div>

        {/* Row 5: Year, Make, Model */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm text-gray-600 mb-1">Year</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">📅</span>
              <input type="number" name="year" value={formData.year || ''} onChange={onChange} placeholder="year" className="w-full border border-gray-300 rounded pl-10 pr-3 py-2 text-sm focus:ring-1 focus:ring-[#118df0] focus:border-[#118df0]" />
            </div>
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Make</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🚗</span>
              <input type="text" name="make" value={formData.make || ''} onChange={onChange} placeholder="make" className="w-full border border-gray-300 rounded pl-10 pr-3 py-2 text-sm focus:ring-1 focus:ring-[#118df0] focus:border-[#118df0]" />
            </div>
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Model</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">⚙</span>
              <input type="text" name="model" value={formData.model || ''} onChange={onChange} placeholder="model" className="w-full border border-gray-300 rounded pl-10 pr-3 py-2 text-sm focus:ring-1 focus:ring-[#118df0] focus:border-[#118df0]" />
            </div>
          </div>
        </div>

        {/* Row 6: Trim, Vehicle Type, Body Type */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm text-gray-600 mb-1">Trim</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">✂</span>
              <input type="text" name="trim" value={formData.trim || ''} onChange={onChange} placeholder="trim" className="w-full border border-gray-300 rounded pl-10 pr-3 py-2 text-sm focus:ring-1 focus:ring-[#118df0] focus:border-[#118df0]" />
            </div>
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Vehicle Type</label>
            <select name="vehicleType" value={formData.vehicleType || ''} onChange={onChange} className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-1 focus:ring-[#118df0] focus:border-[#118df0]">
              <option value="">Vehicle Type</option>
              <option value="Car">Car</option>
              <option value="Truck">Truck</option>
              <option value="SUV">SUV</option>
              <option value="Van">Van</option>
              <option value="Motorcycle">Motorcycle</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Body Type</label>
            <select name="bodyStyle" value={formData.bodyStyle || ''} onChange={onChange} className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-1 focus:ring-[#118df0] focus:border-[#118df0]">
              <option value="">Body Style</option>
              <option value="Sedan">Sedan</option>
              <option value="SUV">SUV</option>
              <option value="Truck">Truck</option>
              <option value="Coupe">Coupe</option>
              <option value="Hatchback">Hatchback</option>
              <option value="Wagon">Wagon</option>
              <option value="Van">Van</option>
              <option value="Convertible">Convertible</option>
            </select>
          </div>
        </div>

        {/* Engine Section */}
        <div className="border-t border-gray-200 pt-4">
          <h3 className="text-sm font-semibold text-gray-800 mb-4">Engine</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">Engine</label>
              <input type="text" name="engine" value={formData.engine || ''} onChange={onChange} placeholder="engine" className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-1 focus:ring-[#118df0] focus:border-[#118df0]" />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Cylinders</label>
              <input type="text" name="cylinders" value={formData.cylinders || ''} onChange={onChange} placeholder="cylinders" className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-1 focus:ring-[#118df0] focus:border-[#118df0]" />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Fuel Type</label>
              <select name="fuelType" value={formData.fuelType || ''} onChange={onChange} className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-1 focus:ring-[#118df0] focus:border-[#118df0]">
                <option value="">Fuel Type</option>
                <option value="Gasoline">Gasoline</option>
                <option value="Diesel">Diesel</option>
                <option value="Hybrid">Hybrid</option>
                <option value="Electric">Electric</option>
                <option value="Plug-in Hybrid">Plug-in Hybrid</option>
              </select>
            </div>
          </div>
        </div>

        {/* Transmission Section */}
        <div className="border-t border-gray-200 pt-4">
          <h3 className="text-sm font-semibold text-gray-800 mb-4">Transmission</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">Transmission</label>
              <select name="transmission" value={formData.transmission || ''} onChange={onChange} className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-1 focus:ring-[#118df0] focus:border-[#118df0]">
                <option value="">Transmission Type</option>
                <option value="Automatic">Automatic</option>
                <option value="Manual">Manual</option>
                <option value="CVT">CVT</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Drive Type</label>
              <select name="drivetrain" value={formData.drivetrain || ''} onChange={onChange} className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-1 focus:ring-[#118df0] focus:border-[#118df0]">
                <option value="">Drive Type</option>
                <option value="FWD">FWD</option>
                <option value="RWD">RWD</option>
                <option value="AWD">AWD</option>
                <option value="4WD">4WD</option>
              </select>
            </div>
          </div>
        </div>

        {/* Other Section */}
        <div className="border-t border-gray-200 pt-4">
          <h3 className="text-sm font-semibold text-gray-800 mb-4">Other</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">Doors</label>
              <input type="text" name="doors" value={formData.doors || ''} onChange={onChange} placeholder="door qty" className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-1 focus:ring-[#118df0] focus:border-[#118df0]" />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">Exterior Colour</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🎨</span>
                <input type="text" name="exteriorColor" value={formData.exteriorColor || ''} onChange={onChange} placeholder="exterior colour" className="w-full border border-gray-300 rounded pl-10 pr-3 py-2 text-sm focus:ring-1 focus:ring-[#118df0] focus:border-[#118df0]" />
              </div>
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Interior Colour</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🎨</span>
                <input type="text" name="interiorColor" value={formData.interiorColor || ''} onChange={onChange} placeholder="interior colour" className="w-full border border-gray-300 rounded pl-10 pr-3 py-2 text-sm focus:ring-1 focus:ring-[#118df0] focus:border-[#118df0]" />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">Key #</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔑</span>
                <input type="text" name="keyNumber" value={formData.keyNumber || ''} onChange={onChange} placeholder="key #" className="w-full border border-gray-300 rounded pl-10 pr-3 py-2 text-sm focus:ring-1 focus:ring-[#118df0] focus:border-[#118df0]" />
              </div>
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Key Description</label>
              <textarea name="keyDescription" value={formData.keyDescription || ''} onChange={onChange} placeholder="description" rows={3} className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-1 focus:ring-[#118df0] focus:border-[#118df0]"></textarea>
            </div>
          </div>
        </div>

        {/* Lot Location, Other, Notes */}
        <div className="border-t border-gray-200 pt-4 space-y-4">
          <div>
            <label className="block text-sm text-gray-600 mb-1">Lot Location</label>
            <textarea name="lotLocation" value={formData.lotLocation || ''} onChange={onChange} placeholder="Ex: At auction" rows={3} className="w-full max-w-md border border-gray-300 rounded px-3 py-2 text-sm focus:ring-1 focus:ring-[#118df0] focus:border-[#118df0]"></textarea>
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Other</label>
            <input type="text" name="other" value={formData.other || ''} onChange={onChange} placeholder="Ex: paid" className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-1 focus:ring-[#118df0] focus:border-[#118df0]" />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Notes</label>
            <textarea name="notes" value={formData.notes || ''} onChange={onChange} placeholder="Ex: Has funny smell." rows={4} className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-1 focus:ring-[#118df0] focus:border-[#118df0]"></textarea>
          </div>
        </div>

        {/* Inventory Export Feeds */}
        <div className="border-t border-gray-200 pt-4">
          <h3 className="text-sm font-semibold text-gray-800 mb-2">Inventory Export Feeds</h3>
          <p className="text-xs text-gray-500 mb-4">The integration feeds you have enabled will be shown below. To begin sending this inventory unit to a feed just toggle the feed you want to send it to below.</p>
          <div className="space-y-2">
            <div className="flex items-center gap-4">
              <span className="text-sm w-32">Feed to AutoTrader?</span>
              <button type="button" onClick={() => handleToggle('feedToAutotrader', !feedToAutotrader, setFeedToAutotrader)} className={`relative w-12 h-6 rounded-full transition-colors ${feedToAutotrader ? 'bg-[#118df0]' : 'bg-gray-300'}`}>
                <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${feedToAutotrader ? 'right-1' : 'left-1'}`}></span>
              </button>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm w-32">Feed to Carpages?</span>
              <button type="button" onClick={() => handleToggle('feedToCarpages', !feedToCarpages, setFeedToCarpages)} className={`relative w-12 h-6 rounded-full transition-colors ${feedToCarpages ? 'bg-[#118df0]' : 'bg-gray-300'}`}>
                <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${feedToCarpages ? 'right-1' : 'left-1'}`}></span>
              </button>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm w-32">Feed to Cargurus?</span>
              <button type="button" onClick={() => handleToggle('feedToCargurus', !feedToCargurus, setFeedToCargurus)} className={`relative w-12 h-6 rounded-full transition-colors ${feedToCargurus ? 'bg-[#118df0]' : 'bg-gray-300'}`}>
                <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${feedToCargurus ? 'right-1' : 'left-1'}`}></span>
              </button>
            </div>
          </div>

          {/* Tips */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div className="bg-blue-50 border border-blue-200 rounded p-3">
              <p className="text-xs text-blue-800"><strong>ⓘ Tip:</strong> Add your keywords below instead of the trim field above to give your ads a bit more information.</p>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded p-3">
              <p className="text-xs text-blue-800"><strong>ⓘ Tip:</strong> Add your feedwords below to send additional information to your website provider.</p>
            </div>
          </div>

          {/* Keywords and Feedwords */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">Keywords</label>
              <input type="text" name="keywords" value={formData.keywords || ''} onChange={onChange} className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-1 focus:ring-[#118df0] focus:border-[#118df0]" />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Feedwords</label>
              <input type="text" name="feedwords" value={formData.feedwords || ''} onChange={onChange} placeholder="Add feedword" className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-1 focus:ring-[#118df0] focus:border-[#118df0]" />
            </div>
          </div>
        </div>

        {/* Advertisement Description */}
        <div className="border-t border-gray-200 pt-4">
          <h3 className="text-sm font-semibold text-gray-800 mb-2">Advertisement Description</h3>
          <div className="border border-gray-300 rounded">
            <div className="flex flex-wrap items-center gap-1 p-2 border-b border-gray-300 bg-gray-50">
              <button type="button" className="px-2 py-1 border border-gray-300 bg-white rounded text-sm font-bold">B</button>
              <button type="button" className="px-2 py-1 border border-gray-300 bg-white rounded text-sm italic">I</button>
              <button type="button" className="px-2 py-1 border border-gray-300 bg-white rounded text-sm underline">U</button>
              <button type="button" className="px-2 py-1 border border-gray-300 bg-white rounded text-sm">≡</button>
              <span className="w-px h-6 bg-gray-300 mx-1"></span>
              <button type="button" className="px-2 py-1 border border-gray-300 bg-white rounded text-sm line-through">S</button>
              <button type="button" className="px-2 py-1 border border-gray-300 bg-white rounded text-sm">X²</button>
              <button type="button" className="px-2 py-1 border border-gray-300 bg-white rounded text-sm">X₂</button>
              <span className="w-px h-6 bg-gray-300 mx-1"></span>
              <select className="border border-gray-300 bg-white rounded px-2 py-1 text-sm">
                <option>16</option>
                <option>12</option>
                <option>14</option>
                <option>18</option>
                <option>24</option>
              </select>
              <input type="color" defaultValue="#ffff00" className="w-8 h-8 p-0 border border-gray-300 rounded" />
              <button type="button" className="px-2 py-1 border border-gray-300 bg-white rounded text-sm">•</button>
              <button type="button" className="px-2 py-1 border border-gray-300 bg-white rounded text-sm">1.</button>
            </div>
            <textarea name="adDescription" value={formData.adDescription || ''} onChange={onChange} rows={10} className="w-full p-4 focus:outline-none resize-none text-sm"></textarea>
          </div>
        </div>

        {/* History Section */}
        <div className="border-t border-gray-200 pt-4">
          <h3 className="text-sm font-semibold text-gray-800 mb-2">History</h3>
          <div className="border border-gray-300 rounded p-4 min-h-[100px] bg-gray-50">
            <p className="text-sm text-gray-400">No history available</p>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end pt-4">
          <button
            type="submit"
            disabled={saving}
            className="px-8 py-2 bg-[#118df0] text-white font-medium rounded hover:bg-[#0d6ebd] disabled:opacity-50 transition-colors"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </form>
  )
}
