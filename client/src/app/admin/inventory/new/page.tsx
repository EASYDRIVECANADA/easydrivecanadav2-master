'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
import DisclosuresTab from './tabs/DisclosuresTab'
import PurchaseTab from './tabs/PurchaseTab'
import CostsTab from './tabs/CostsTab'
import WarrantyTab from './tabs/WarrantyTab'
import ImagesTab from './tabs/ImagesTab'
import FilesTab from './tabs/FilesTab'

type TabType = 'details' | 'disclosures' | 'purchase' | 'costs' | 'warranty' | 'images' | 'files'

export default function NewVehiclePage() {
  const [activeTab, setActiveTab] = useState<TabType>('details')
  const [createdVehicleId, setCreatedVehicleId] = useState<string>('')
  const [images, setImages] = useState<string[]>([])
  const [formData, setFormData] = useState({
    make: '',
    model: '',
    year: new Date().getFullYear(),
    trim: '',
    stockNumber: '',
    inStockDate: new Date().toISOString().split('T')[0],
    odometer: '',
    odometerUnit: 'kms',
    keyNumber: '',
    keyDescription: '',
    series: '',
    equipment: '',
    price: '',
    mileage: '',
    vin: '',
    condition: 'Used',
    fuelType: 'Gasoline',
    transmission: 'Automatic',
    bodyStyle: '',
    vehicleType: '',
    exteriorColor: '',
    interiorColor: '',
    drivetrain: 'FWD',
    doors: '',
    city: '',
    province: 'ON',
    description: '',
    adDescription: '',
    features: '',
    status: 'ACTIVE',
    inventoryType: 'FLEET',
    statusColour: '',
    retailWholesale: '',
    substatus: '',
    assignment: '',
    lotLocation: '',
    keywords: '',
    feedwords: '',
    distanceDisclaimer: false,
    feedToAutotrader: false,
    feedToCarpages: false,
    feedToCargurus: false,
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const [sendingVin, setSendingVin] = useState(false)
  const [vinPrefilled, setVinPrefilled] = useState(false)
  const [lastVinSent, setLastVinSent] = useState<string>('')

  useEffect(() => {
    const sessionStr = localStorage.getItem('edc_admin_session')
    if (!sessionStr) {
      router.push('/admin')
      return
    }
  }, [router])

  useEffect(() => {
    if (!formData?.vin || formData.vin !== lastVinSent) {
      setVinPrefilled(false)
    }
  }, [formData?.vin, lastVinSent])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData({ ...formData, [name]: value })
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
        body: JSON.stringify({
          vin: String(formData.vin).trim(),
        }),
      })
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(text || `Webhook responded with ${res.status}`)
      }
      const json = await res.json().catch(() => null)
      console.log('[vin+][new-page] webhook response:', json)
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
      const year = byLabel('Model Year') || flatGet('year') || flatGet('year ') || ''
      const body = byLabel('Body') || flatGet('body style') || ''
      const trim = byLabel('Trim') || flatGet('trim') || ''
      const drive = byLabel('Drive') || flatGet('drivetrain') || ''
      const cylinders = byLabel('Engine Cylinders') || flatGet('cylinders') || flatGet(' cylinders') || ''
      const fuelPrimary = byLabel('Fuel Type - Primary') || flatGet('fuel type') || ''
      const transmission = byLabel('Transmission') || flatGet('transmission') || ''
      const doors = byLabel('Number of Doors') || flatGet('doors') || ''
      const engine = byLabel('Engine Model') || flatGet('engine') || ''

      setFormData((prev: any) => ({
        ...prev,
        make: String(make || prev.make || ''),
        model: String(model || prev.model || ''),
        year: Number(year) || prev.year,
        bodyStyle: mapBodyToBodyStyle(String(body)) || prev.bodyStyle,
        drivetrain: mapDrive(String(drive)) || prev.drivetrain,
        fuelType: String(fuelPrimary || prev.fuelType || ''),
        transmission: String(transmission || prev.transmission || ''),
        trim: String(trim || prev.trim || ''),
        doors: String(doors || prev.doors || ''),
        cylinders: String(cylinders || (prev as any).cylinders || ''),
        engine: String(engine || (prev as any).engine || ''),
        stockNumber: String(flatGet('stock number (unit id)') || prev.stockNumber || ''),
      }))
      console.log('[vin+][new-page] parsed:', { make, model, year, body, drive, fuelPrimary, transmission, trim, doors, cylinders, engine })
      console.log('[vin+][new-page] formData updated')
      setVinPrefilled(true)
      setLastVinSent(String(formData.vin).trim())
    } catch (err) {
      console.error('Error sending VIN webhook:', err)
      alert('Failed to send VIN. Please try again.')
    } finally {
      setSendingVin(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError('')

    try {
      const payload = {
        ...formData,
        price: parseFloat(formData.price),
        mileage: parseInt(formData.mileage),
        year: parseInt(formData.year.toString()),
        features: formData.features.split(',').map((f) => f.trim()).filter(Boolean),
      }

      // Fire-and-forget webhook for Add
      try {
        fetch('/api/inventory-add', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }).catch(() => {})
      } catch {}

      const { data, error: dbError } = await supabase
        .from('edc_vehicles')
        .insert({
          make: payload.make,
          model: payload.model,
          year: payload.year,
          trim: payload.trim || null,
          stock_number: payload.stockNumber || null,
          series: payload.series || null,
          equipment: payload.equipment || null,
          vin: payload.vin,
          price: payload.price,
          mileage: payload.mileage,
          status: payload.status,
          inventory_type: payload.inventoryType,
          fuel_type: payload.fuelType || null,
          transmission: payload.transmission || null,
          body_style: payload.bodyStyle || null,
          drivetrain: payload.drivetrain || null,
          city: payload.city,
          province: payload.province,
          exterior_color: payload.exteriorColor || null,
          interior_color: payload.interiorColor || null,
          description: payload.description || null,
          features: payload.features,
          images: [],
          key_number: payload.keyNumber || null,
        })
        .select('id')
        .single()

      if (dbError || !data?.id) {
        setError('Failed to create vehicle')
        return
      }

      // Save vehicle ID and move to Images tab
      setCreatedVehicleId(data.id)
      setActiveTab('images')
    } catch {
      setError('Unable to create vehicle. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleNext = () => {
    const tabOrder: TabType[] = ['details', 'images', 'disclosures', 'purchase', 'costs', 'warranty', 'files']
    const currentIndex = tabOrder.indexOf(activeTab)
    if (currentIndex < tabOrder.length - 1) {
      setActiveTab(tabOrder[currentIndex + 1])
    }
  }

  const handleImagesUpdate = (newImages: string[]) => {
    setImages(newImages)
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="w-full px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">Add New Vehicle</h1>
            <Link
              href="/admin/inventory"
              className="px-4 py-2 border border-gray-300 rounded-lg font-medium hover:bg-gray-50 transition-colors"
            >
              ← Back to Inventory
            </Link>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b">
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8">
            <button
              type="button"
              onClick={() => setActiveTab('details')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'details'
                  ? 'border-[#118df0] text-[#118df0]'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              🚗 Vehicle Details
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('disclosures')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'disclosures'
                  ? 'border-[#118df0] text-[#118df0]'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              📋 Disclosures
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('purchase')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'purchase'
                  ? 'border-[#118df0] text-[#118df0]'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              💰 Purchase
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('costs')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'costs'
                  ? 'border-[#118df0] text-[#118df0]'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              💵 Costs
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('warranty')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'warranty'
                  ? 'border-[#118df0] text-[#118df0]'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              🛡️ Warranty
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('images')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'images'
                  ? 'border-[#118df0] text-[#118df0]'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              📷 Images
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('files')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'files'
                  ? 'border-[#118df0] text-[#118df0]'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              📁 Files
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow p-8">
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
              {error}
            </div>
          )}

          {/* Vehicle Details Tab */}
          {activeTab === 'details' && (
            <div>
              <h2 className="text-lg font-semibold mb-4 border-b pb-2">Basic Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Make *</label>
                <input
                  type="text"
                  name="make"
                  required
                  value={formData.make}
                  onChange={handleChange}
                  placeholder="e.g., Toyota"
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Model *</label>
                <input
                  type="text"
                  name="model"
                  required
                  value={formData.model}
                  onChange={handleChange}
                  placeholder="e.g., Camry"
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Year *</label>
                <input
                  type="number"
                  name="year"
                  required
                  value={formData.year}
                  onChange={handleChange}
                  min="1990"
                  max={new Date().getFullYear() + 1}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Price ($) *</label>
                <input
                  type="number"
                  name="price"
                  required
                  value={formData.price}
                  onChange={handleChange}
                  placeholder="e.g., 25000"
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mileage (km) *</label>
                <input
                  type="number"
                  name="mileage"
                  required
                  value={formData.mileage}
                  onChange={handleChange}
                  placeholder="e.g., 50000"
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent"
                >
                  <option value="ACTIVE">Active</option>
                  <option value="PENDING">Pending</option>
                  <option value="SOLD">Sold</option>
                  <option value="DRAFT">Draft</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Inventory Type</label>
                <select
                  name="inventoryType"
                  value={formData.inventoryType}
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent"
                >
                  <option value="FLEET">Fleet Cars</option>
                  <option value="PREMIERE">Premiere Cars</option>
                </select>
              </div>
            </div>

            <div className="mt-8">
              <h2 className="text-lg font-semibold mb-4 border-b pb-2">Identification & Location</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Stock Number (Unit ID)</label>
                <input
                  type="text"
                  name="stockNumber"
                  value={formData.stockNumber}
                  onChange={handleChange}
                  placeholder="e.g., 8FDJTG"
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">In Stock Date</label>
                <input
                  type="date"
                  name="inStockDate"
                  value={formData.inStockDate}
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">VIN *</label>
                <div className="relative">
                  <input
                    type="text"
                    name="vin"
                    required
                    value={formData.vin}
                    onChange={handleChange}
                    placeholder="Vehicle Identification Number"
                    className="w-full border border-gray-300 rounded-lg pl-4 pr-10 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent"
                  />
                  {(!vinPrefilled || String(formData.vin).trim() !== lastVinSent) && (
                    <button
                      type="button"
                      title="Add VIN"
                      className={`absolute inset-y-0 right-0 flex items-center px-3 text-white rounded-r-lg ${sendingVin ? 'bg-gray-400 cursor-not-allowed' : 'bg-[#118df0] hover:bg-[#0d6ebd]'}`}
                      onClick={handleSendVin}
                      disabled={sendingVin}
                    >
                      {sendingVin ? '...' : '+'}
                    </button>
                  )}
                </div>
              </div>
              <div className="md:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Odometer</label>
                  <input
                    type="number"
                    name="odometer"
                    value={formData.odometer}
                    onChange={handleChange}
                    placeholder="odometer"
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
                  <select
                    name="odometerUnit"
                    value={formData.odometerUnit}
                    onChange={handleChange}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent"
                  >
                    <option value="kms">kms</option>
                    <option value="miles">miles</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Series</label>
                <input
                  type="text"
                  name="series"
                  value={formData.series}
                  onChange={handleChange}
                  placeholder="e.g., 40K4, 45KF"
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">City *</label>
                <input
                  type="text"
                  name="city"
                  required
                  value={formData.city}
                  onChange={handleChange}
                  placeholder="e.g., Toronto"
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Province *</label>
                <select
                  name="province"
                  required
                  value={formData.province}
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent"
                >
                  <option value="ON">Ontario</option>
                  <option value="QC">Quebec</option>
                  <option value="BC">British Columbia</option>
                  <option value="AB">Alberta</option>
                  <option value="MB">Manitoba</option>
                  <option value="SK">Saskatchewan</option>
                  <option value="NS">Nova Scotia</option>
                  <option value="NB">New Brunswick</option>
                  <option value="NL">Newfoundland</option>
                  <option value="PE">PEI</option>
                </select>
              </div>
            </div>
            </div>

            <div className="mt-8">
              <h2 className="text-lg font-semibold mb-4 border-b pb-2">Specifications</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fuel Type</label>
                <select
                  name="fuelType"
                  value={formData.fuelType}
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent"
                >
                  <option value="Gasoline">Gasoline</option>
                  <option value="Diesel">Diesel</option>
                  <option value="Hybrid">Hybrid</option>
                  <option value="Electric">Electric</option>
                  <option value="Plug-in Hybrid">Plug-in Hybrid</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Transmission</label>
                <select
                  name="transmission"
                  value={formData.transmission}
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent"
                >
                  <option value="Automatic">Automatic</option>
                  <option value="Manual">Manual</option>
                  <option value="CVT">CVT</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Drivetrain</label>
                <select
                  name="drivetrain"
                  value={formData.drivetrain}
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent"
                >
                  <option value="FWD">FWD</option>
                  <option value="RWD">RWD</option>
                  <option value="AWD">AWD</option>
                  <option value="4WD">4WD</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Body Style *</label>
                <select
                  name="bodyStyle"
                  required
                  value={formData.bodyStyle}
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent"
                >
                  <option value="">Select...</option>
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
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Trim</label>
                <input
                  type="text"
                  name="trim"
                  value={formData.trim}
                  onChange={handleChange}
                  placeholder="e.g., SE, XLE, Limited"
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent"
                />
              </div>
            </div>
            </div>

            <div className="mt-8">
              <h2 className="text-lg font-semibold mb-4 border-b pb-2">Colors</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Exterior Color</label>
                <input
                  type="text"
                  name="exteriorColor"
                  value={formData.exteriorColor}
                  onChange={handleChange}
                  placeholder="e.g., Silver"
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Interior Color</label>
                <input
                  type="text"
                  name="interiorColor"
                  value={formData.interiorColor}
                  onChange={handleChange}
                  placeholder="e.g., Black"
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent"
                />
              </div>
            </div>
            </div>

            <div className="mt-8">
              <h2 className="text-lg font-semibold mb-4 border-b pb-2">Description & Features</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Equipment</label>
                <textarea
                  name="equipment"
                  rows={2}
                  value={formData.equipment}
                  onChange={handleChange}
                  placeholder="e.g., A3 40 KOMFORT AWD SEDAN"
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent"
                ></textarea>
                <p className="mt-1 text-xs text-gray-500">Full equipment description from EDC inventory</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  name="description"
                  rows={4}
                  value={formData.description}
                  onChange={handleChange}
                  placeholder="Detailed description of the vehicle..."
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent"
                ></textarea>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Features (comma-separated)</label>
                <textarea
                  name="features"
                  rows={3}
                  value={formData.features}
                  onChange={handleChange}
                  placeholder="Bluetooth, Backup Camera, Sunroof, Heated Seats..."
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent"
                ></textarea>
              </div>
            </div>
            </div>
            {/* Additional sections */}
            <div className="mt-8">
              <h2 className="text-lg font-semibold mb-4 border-b pb-2">Engine</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Engine</label>
                  <input type="text" name="engine" value={(formData as any).engine || ''} onChange={handleChange} className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cylinders</label>
                  <input type="text" name="cylinders" value={(formData as any).cylinders || ''} onChange={handleChange} className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fuel Type</label>
                  <select name="fuelType" value={formData.fuelType} onChange={handleChange} className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent">
                    <option value="Gasoline">Gasoline</option>
                    <option value="Diesel">Diesel</option>
                    <option value="Hybrid">Hybrid</option>
                    <option value="Electric">Electric</option>
                    <option value="Plug-in Hybrid">Plug-in Hybrid</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="mt-8">
              <h2 className="text-lg font-semibold mb-4 border-b pb-2">Transmission</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Transmission Type</label>
                  <select name="transmission" value={formData.transmission} onChange={handleChange} className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent">
                    <option value="Automatic">Automatic</option>
                    <option value="Manual">Manual</option>
                    <option value="CVT">CVT</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Drive Type</label>
                  <select name="drivetrain" value={formData.drivetrain} onChange={handleChange} className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent">
                    <option value="FWD">FWD</option>
                    <option value="RWD">RWD</option>
                    <option value="AWD">AWD</option>
                    <option value="4WD">4WD</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="mt-8">
              <h2 className="text-lg font-semibold mb-4 border-b pb-2">Other</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Doors</label>
                  <input type="number" name="doors" value={formData.doors} onChange={handleChange} className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Exterior Colour</label>
                  <input type="text" name="exteriorColor" value={formData.exteriorColor} onChange={handleChange} className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Interior Colour</label>
                  <input type="text" name="interiorColor" value={formData.interiorColor} onChange={handleChange} className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Key #</label>
                  <input type="text" name="keyNumber" value={formData.keyNumber} onChange={handleChange} className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Key Description</label>
                  <input type="text" name="keyDescription" value={formData.keyDescription} onChange={handleChange} className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Lot Location</label>
                  <textarea name="lotLocation" rows={2} value={formData.lotLocation} onChange={handleChange} className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent" placeholder="Ex: At auction"></textarea>
                </div>
                <div className="md:col-span-3">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Other</label>
                  <input type="text" name="other" value={(formData as any).other || ''} onChange={handleChange} placeholder="Ex: paid" className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent" />
                </div>
                <div className="md:col-span-3">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                  <textarea name="notes" rows={3} value={(formData as any).notes || ''} onChange={handleChange} placeholder="Ex: Has funny smell." className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent"></textarea>
                </div>
              </div>
            </div>

            <div className="mt-8">
              <h2 className="text-lg font-semibold mb-4 border-b pb-2">Inventory Export Feeds</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex items-center justify-between border rounded px-3 py-2">
                  <span>Feed to AutoTrader?</span>
                  <input type="checkbox" checked={!!(formData as any).feedToAutotrader} onChange={(e)=>setFormData(prev=>({...prev, feedToAutotrader: e.target.checked}))} />
                </div>
                <div className="flex items-center justify-between border rounded px-3 py-2">
                  <span>Feed to Carpages?</span>
                  <input type="checkbox" checked={!!(formData as any).feedToCarpages} onChange={(e)=>setFormData(prev=>({...prev, feedToCarpages: e.target.checked}))} />
                </div>
                <div className="flex items-center justify-between border rounded px-3 py-2">
                  <span>Feed to Cargurus?</span>
                  <input type="checkbox" checked={!!(formData as any).feedToCargurus} onChange={(e)=>setFormData(prev=>({...prev, feedToCargurus: e.target.checked}))} />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Keywords</label>
                  <input type="text" name="keywords" value={(formData as any).keywords || ''} onChange={handleChange} placeholder="Add keywords" className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Feedwords</label>
                  <input type="text" name="feedwords" value={(formData as any).feedwords || ''} onChange={handleChange} placeholder="Add feedword" className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent" />
                </div>
              </div>
            </div>

            <div className="mt-8">
              <h2 className="text-lg font-semibold mb-4 border-b pb-2">Advertisement Description</h2>
              <textarea name="adDescription" rows={8} value={(formData as any).adDescription || ''} onChange={handleChange} className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent" />
            </div>
            </div>
          )}

          {/* Other Tabs */}
          {activeTab === 'images' && (
            <div>
              <ImagesTab vehicleId={createdVehicleId} images={images} onImagesUpdate={handleImagesUpdate} />
              <div className="mt-6">
                <button
                  onClick={handleNext}
                  className="w-full bg-[#118df0] text-white py-3 rounded-lg font-semibold hover:bg-[#0d6ebd] transition-colors"
                >
                  Next: Disclosures →
                </button>
              </div>
            </div>
          )}
          {activeTab === 'disclosures' && (
            <div>
              <DisclosuresTab vehicleId={createdVehicleId} />
              <div className="mt-6">
                <button
                  onClick={handleNext}
                  className="w-full bg-[#118df0] text-white py-3 rounded-lg font-semibold hover:bg-[#0d6ebd] transition-colors"
                >
                  Next: Purchase →
                </button>
              </div>
            </div>
          )}
          {activeTab === 'purchase' && (
            <div>
              <PurchaseTab vehicleId={createdVehicleId} stockNumber={formData.stockNumber} />
              <div className="mt-6">
                <button
                  onClick={handleNext}
                  className="w-full bg-[#118df0] text-white py-3 rounded-lg font-semibold hover:bg-[#0d6ebd] transition-colors"
                >
                  Next: Costs →
                </button>
              </div>
            </div>
          )}
          {activeTab === 'costs' && (
            <div>
              <CostsTab vehicleId={createdVehicleId} vehiclePrice={parseFloat(String(formData.price || 0)) || 0} stockNumber={formData.stockNumber || ''} />
              <div className="mt-6">
                <button
                  onClick={handleNext}
                  className="w-full bg-[#118df0] text-white py-3 rounded-lg font-semibold hover:bg-[#0d6ebd] transition-colors"
                >
                  Next: Warranty →
                </button>
              </div>
            </div>
          )}
          {activeTab === 'warranty' && (
            <div>
              <WarrantyTab vehicleId={createdVehicleId} />
              <div className="mt-6">
                <button
                  onClick={handleNext}
                  className="w-full bg-[#118df0] text-white py-3 rounded-lg font-semibold hover:bg-[#0d6ebd] transition-colors"
                >
                  Next: Files →
                </button>
              </div>
            </div>
          )}
          {activeTab === 'files' && (
            <div>
              <FilesTab vehicleId={createdVehicleId} />
              <div className="mt-6 flex gap-4">
                <Link
                  href="/admin/inventory"
                  className="flex-1 bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 transition-colors text-center"
                >
                  ✓ Complete & View Inventory
                </Link>
                <Link
                  href={`/admin/inventory/${createdVehicleId}`}
                  className="flex-1 bg-[#118df0] text-white py-3 rounded-lg font-semibold hover:bg-[#0d6ebd] transition-colors text-center"
                >
                  Edit Vehicle Details
                </Link>
              </div>
            </div>
          )}

          {/* Submit - Only show on details tab */}
          {activeTab === 'details' && (
          <div className="flex gap-4">
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 bg-[#118df0] text-white py-3 rounded-lg font-semibold hover:bg-[#0d6ebd] transition-colors disabled:opacity-50"
            >
              {submitting ? 'Creating...' : 'Save & Continue to Images →'}
            </button>
            <Link
              href="/admin/inventory"
              className="px-8 py-3 border border-gray-300 rounded-lg font-medium hover:bg-gray-50 transition-colors text-center"
            >
              Cancel
            </Link>
          </div>
          )}
        </form>
      </div>
    </div>
  )
}
