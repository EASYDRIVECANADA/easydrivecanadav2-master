'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'

export default function NewVehiclePage() {
  const [formData, setFormData] = useState({
    make: '',
    model: '',
    year: new Date().getFullYear(),
    trim: '',
    stockNumber: '',
    keyNumber: '',
    series: '',
    equipment: '',
    price: '',
    mileage: '',
    vin: '',
    fuelType: 'Gasoline',
    transmission: 'Automatic',
    bodyStyle: '',
    exteriorColor: '',
    interiorColor: '',
    drivetrain: 'FWD',
    city: '',
    province: 'ON',
    description: '',
    features: '',
    status: 'ACTIVE',
    inventoryType: 'FLEET',
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  useEffect(() => {
    const sessionStr = localStorage.getItem('edc_admin_session')
    if (!sessionStr) {
      router.push('/admin')
      return
    }
  }, [router])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData({ ...formData, [name]: value })
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

      router.push(`/admin/inventory/${data.id}/photos`)
    } catch {
      setError('Unable to create vehicle. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="w-full px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center">
            <h1 className="text-2xl font-bold text-gray-900">Add New Vehicle</h1>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow p-8">
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
              {error}
            </div>
          )}

          {/* Basic Info */}
          <div className="mb-8">
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
          </div>

          {/* Identification */}
          <div className="mb-8">
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
                <label className="block text-sm font-medium text-gray-700 mb-1">VIN *</label>
                <input
                  type="text"
                  name="vin"
                  required
                  value={formData.vin}
                  onChange={handleChange}
                  placeholder="Vehicle Identification Number"
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent"
                />
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

          {/* Specifications */}
          <div className="mb-8">
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

          {/* Colors */}
          <div className="mb-8">
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

          {/* Description & Features */}
          <div className="mb-8">
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

          {/* Submit */}
          <div className="flex gap-4">
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 bg-[#118df0] text-white py-3 rounded-lg font-semibold hover:bg-[#0d6ebd] transition-colors disabled:opacity-50"
            >
              {submitting ? 'Creating...' : 'Create Vehicle & Add Photos'}
            </button>
            <Link
              href="/admin/inventory"
              className="px-8 py-3 border border-gray-300 rounded-lg font-medium hover:bg-gray-50 transition-colors text-center"
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}
