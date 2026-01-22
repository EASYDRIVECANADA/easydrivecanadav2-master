'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'

// Tab Components
import VehicleDetailsTab from './tabs/VehicleDetailsTab'
import ImagesTab from './tabs/ImagesTab'
import DisclosuresTab from './tabs/DisclosuresTab'
import PurchaseTab from './tabs/PurchaseTab'
import CostsTab from './tabs/CostsTab'
import WarrantyTab from './tabs/WarrantyTab'
import FilesTab from './tabs/FilesTab'

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
  images: string[]
}

interface VehicleFormData extends Omit<Partial<Vehicle>, 'features'> {
  features?: string | string[]
}

type TabType = 'details' | 'images' | 'disclosures' | 'purchase' | 'costs' | 'warranty' | 'files'

const TABS: { id: TabType; label: string; icon: string }[] = [
  { id: 'details', label: 'Vehicle Details', icon: '🚗' },
  { id: 'disclosures', label: 'Disclosures', icon: '📋' },
  { id: 'purchase', label: 'Purchase', icon: '💵' },
  { id: 'costs', label: 'Costs', icon: '📊' },
  { id: 'warranty', label: 'Warranty', icon: '🛡️' },
  { id: 'images', label: 'Images', icon: '🖼️' },
  { id: 'files', label: 'Files', icon: '📁' },
]

export default function AdminEditVehiclePage() {
  const params = useParams()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState<VehicleFormData>({})
  const [images, setImages] = useState<string[]>([])
  const [activeTab, setActiveTab] = useState<TabType>('details')

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
      setImages(Array.isArray(data.images) ? data.images : [])
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
        alert('Vehicle saved successfully!')
      }
    } catch (error) {
      console.error('Error saving vehicle:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleImagesUpdate = (newImages: string[]) => {
    setImages(newImages)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-[#118df0] border-t-transparent rounded-full"></div>
      </div>
    )
  }

  const vehicleTitle = `${formData.year} ${formData.make} ${formData.model}`

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="w-full px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <Link
                href="/admin/inventory"
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                title="Back to Inventory"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </Link>
              <div>
                <h1 className="text-xl font-bold text-gray-900">{vehicleTitle}</h1>
                <p className="text-sm text-gray-500">Stock: {formData.stockNumber || 'N/A'} • VIN: {formData.vin || 'N/A'}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                formData.status === 'ACTIVE' ? 'bg-green-100 text-green-800' :
                formData.status === 'SOLD' ? 'bg-red-100 text-red-800' :
                'bg-yellow-100 text-yellow-800'
              }`}>
                {formData.status}
              </span>
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                formData.inventoryType === 'PREMIERE' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
              }`}>
                {formData.inventoryType === 'PREMIERE' ? '✨ Premiere' : '🚗 Fleet'}
              </span>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="w-full px-4 sm:px-6 lg:px-8 border-t border-gray-200">
          <nav className="flex gap-1 overflow-x-auto" aria-label="Tabs">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-[#118df0] text-[#118df0]'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Tab Content */}
      <div className="w-full px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'details' && (
          <VehicleDetailsTab
            formData={formData}
            onChange={handleChange}
            onSubmit={handleSubmit}
            saving={saving}
          />
        )}

        {activeTab === 'images' && (
          <ImagesTab
            vehicleId={String(params.id)}
            images={images}
            onImagesUpdate={handleImagesUpdate}
          />
        )}

        {activeTab === 'disclosures' && (
          <DisclosuresTab vehicleId={String(params.id)} />
        )}

        {activeTab === 'purchase' && (
          <PurchaseTab vehicleId={String(params.id)} stockNumber={formData.stockNumber || ''} />
        )}

        {activeTab === 'costs' && (
          <CostsTab
            vehicleId={String(params.id)}
            vehiclePrice={formData.price || 0}
            stockNumber={formData.stockNumber || ''}
          />
        )}

        {activeTab === 'warranty' && (
          <WarrantyTab vehicleId={String(params.id)} />
        )}

        {activeTab === 'files' && (
          <FilesTab vehicleId={String(params.id)} />
        )}
      </div>
    </div>
  )
}
