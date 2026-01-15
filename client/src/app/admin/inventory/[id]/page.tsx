'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'

interface Vehicle {
  id: string
  make: string
  model: string
  year: number
  trim: string
  stockNumber: string
  keyNumber?: string
  series: string
  equipment: string
  vin: string
  price: number
  mileage: number
  exteriorColor: string
  interiorColor: string
  transmission: string
  drivetrain: string
  fuelType: string
  bodyStyle: string
  description: string
  features: string[]
  city: string
  province: string
  status: string
  inventoryType: string
}

interface VehicleFormData extends Omit<Partial<Vehicle>, 'features'> {
  features?: string | string[]
}

export default function AdminEditVehiclePage() {
  const params = useParams()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState<VehicleFormData>({})

  useEffect(() => {
    const sessionStr = localStorage.getItem('edc_admin_session')
    if (!sessionStr) {
      router.push('/admin')
      return
    }
    fetchVehicle()
  }, [params.id])

  const fetchVehicle = async () => {
    try {
      const { data, error } = await supabase
        .from('edc_vehicles')
        .select('*')
        .eq('id', String(params.id))
        .maybeSingle()

      if (error || !data) {
        router.push('/admin/inventory')
        return
      }

      setFormData({
        id: data.id,
        make: data.make,
        model: data.model,
        year: data.year,
        trim: data.trim || '',
        stockNumber: data.stock_number || '',
        keyNumber: data.key_number || '',
        series: data.series || '',
        equipment: data.equipment || '',
        vin: data.vin,
        price: data.price,
        mileage: data.mileage,
        exteriorColor: data.exterior_color || '',
        interiorColor: data.interior_color || '',
        transmission: data.transmission || '',
        drivetrain: data.drivetrain || '',
        fuelType: data.fuel_type || '',
        bodyStyle: data.body_style || '',
        description: data.description || '',
        features: Array.isArray(data.features) ? data.features : [],
        city: data.city,
        province: data.province,
        status: data.status,
        inventoryType: data.inventory_type,
      })
    } catch (error) {
      console.error('Error fetching vehicle:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData({ ...formData, [name]: value })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    try {
      const features =
        typeof formData.features === 'string'
          ? formData.features.split(',').map((f: string) => f.trim()).filter(Boolean)
          : Array.isArray(formData.features)
            ? formData.features
            : []

      const { error } = await supabase
        .from('edc_vehicles')
        .update({
          make: formData.make,
          model: formData.model,
          year: parseInt(String(formData.year)),
          trim: formData.trim || null,
          stock_number: formData.stockNumber || null,
          key_number: formData.keyNumber || null,
          series: formData.series || null,
          equipment: formData.equipment || null,
          vin: formData.vin,
          price: parseFloat(String(formData.price)),
          mileage: parseInt(String(formData.mileage)),
          status: formData.status,
          inventory_type: formData.inventoryType,
          fuel_type: formData.fuelType || null,
          transmission: formData.transmission || null,
          body_style: formData.bodyStyle || null,
          drivetrain: formData.drivetrain || null,
          city: formData.city,
          province: formData.province,
          exterior_color: formData.exteriorColor || null,
          interior_color: formData.interiorColor || null,
          description: formData.description || null,
          features,
        })
        .eq('id', String(params.id))

      if (!error) {
        router.push('/admin/inventory')
      }
    } catch (error) {
      console.error('Error saving vehicle:', error)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-[#118df0] border-t-transparent rounded-full"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="w-full px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-gray-900">Edit Vehicle</h1>
            </div>
            <Link
              href={`/admin/inventory/${params.id}/photos`}
              className="bg-[#118df0] text-white px-4 py-2 rounded-lg font-medium hover:bg-[#0d6ebd] transition-colors"
            >
              Manage Photos
            </Link>
          </div>
        </div>
      </div>

      <div className="w-full px-4 sm:px-6 lg:px-8 py-8">
        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Basic Info */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Make *</label>
              <input
                type="text"
                name="make"
                required
                value={formData.make || ''}
                onChange={handleChange}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Model *</label>
              <input
                type="text"
                name="model"
                required
                value={formData.model || ''}
                onChange={handleChange}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Year *</label>
              <input
                type="number"
                name="year"
                required
                value={formData.year || ''}
                onChange={handleChange}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Trim</label>
              <input
                type="text"
                name="trim"
                value={formData.trim || ''}
                onChange={handleChange}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Stock Number (Unit ID)</label>
              <input
                type="text"
                name="stockNumber"
                value={formData.stockNumber || ''}
                onChange={handleChange}
                placeholder="e.g., 8FDJTG"
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                🔑 Key Number (Keybox)
                <span className="text-gray-500 font-normal ml-2">Optional</span>
              </label>
              <input
                type="text"
                name="keyNumber"
                value={formData.keyNumber || ''}
                onChange={handleChange}
                placeholder="e.g., K-123, FOB-45"
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">Track which key/keyfob this vehicle uses from your keybox</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Series</label>
              <input
                type="text"
                name="series"
                value={formData.series || ''}
                onChange={handleChange}
                placeholder="e.g., 40K4, 45KF"
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">VIN *</label>
              <input
                type="text"
                name="vin"
                required
                value={formData.vin || ''}
                onChange={handleChange}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Price ($) *</label>
              <input
                type="number"
                name="price"
                required
                value={formData.price || ''}
                onChange={handleChange}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Mileage (km) *</label>
              <input
                type="number"
                name="mileage"
                required
                value={formData.mileage || ''}
                onChange={handleChange}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                name="status"
                value={formData.status || 'ACTIVE'}
                onChange={handleChange}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent"
              >
                <option value="ACTIVE">Active</option>
                <option value="SOLD">Sold</option>
                <option value="PENDING">Pending</option>
                <option value="DRAFT">Draft</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Inventory Type</label>
              <select
                name="inventoryType"
                value={formData.inventoryType || 'FLEET'}
                onChange={handleChange}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent"
              >
                <option value="FLEET">Fleet Cars</option>
                <option value="PREMIERE">Premiere Cars</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Exterior Color *</label>
              <input
                type="text"
                name="exteriorColor"
                required
                value={formData.exteriorColor || ''}
                onChange={handleChange}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Interior Color</label>
              <input
                type="text"
                name="interiorColor"
                value={formData.interiorColor || ''}
                onChange={handleChange}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Transmission *</label>
              <select
                name="transmission"
                required
                value={formData.transmission || ''}
                onChange={handleChange}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent"
              >
                <option value="">Select...</option>
                <option value="Automatic">Automatic</option>
                <option value="Manual">Manual</option>
                <option value="CVT">CVT</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Drivetrain</label>
              <select
                name="drivetrain"
                value={formData.drivetrain || ''}
                onChange={handleChange}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent"
              >
                <option value="">Select...</option>
                <option value="FWD">FWD</option>
                <option value="RWD">RWD</option>
                <option value="AWD">AWD</option>
                <option value="4WD">4WD</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fuel Type *</label>
              <select
                name="fuelType"
                required
                value={formData.fuelType || ''}
                onChange={handleChange}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent"
              >
                <option value="">Select...</option>
                <option value="Gasoline">Gasoline</option>
                <option value="Diesel">Diesel</option>
                <option value="Hybrid">Hybrid</option>
                <option value="Electric">Electric</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Body Style *</label>
              <select
                name="bodyStyle"
                required
                value={formData.bodyStyle || ''}
                onChange={handleChange}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent"
              >
                <option value="">Select...</option>
                <option value="Sedan">Sedan</option>
                <option value="SUV">SUV</option>
                <option value="Truck">Truck</option>
                <option value="Coupe">Coupe</option>
                <option value="Hatchback">Hatchback</option>
                <option value="Van">Van</option>
                <option value="Wagon">Wagon</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">City *</label>
              <input
                type="text"
                name="city"
                required
                value={formData.city || ''}
                onChange={handleChange}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Province *</label>
              <select
                name="province"
                required
                value={formData.province || ''}
                onChange={handleChange}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent"
              >
                <option value="">Select...</option>
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

          <div className="mt-6">
            <label className="block text-sm font-medium text-gray-700 mb-1">Equipment</label>
            <textarea
              name="equipment"
              rows={2}
              value={formData.equipment || ''}
              onChange={handleChange}
              placeholder="e.g., A3 40 KOMFORT AWD SEDAN"
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent"
            ></textarea>
            <p className="mt-1 text-xs text-gray-500">Full equipment description from EDC inventory</p>
          </div>

          <div className="mt-6">
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              name="description"
              rows={4}
              value={formData.description || ''}
              onChange={handleChange}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent"
            ></textarea>
          </div>

          <div className="mt-6">
            <label className="block text-sm font-medium text-gray-700 mb-1">Features (comma-separated)</label>
            <input
              type="text"
              name="features"
              value={Array.isArray(formData.features) ? formData.features.join(', ') : formData.features || ''}
              onChange={handleChange}
              placeholder="Leather seats, Sunroof, Backup camera..."
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent"
            />
          </div>

          <div className="mt-6 flex gap-4">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 bg-[#118df0] text-white py-3 rounded-lg font-semibold hover:bg-[#0d6ebd] transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
            <Link
              href="/admin/inventory"
              className="px-6 py-3 border border-gray-300 rounded-lg font-semibold text-gray-700 hover:bg-gray-50 transition-colors text-center"
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}
