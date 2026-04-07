'use client'

import { useState, useEffect } from 'react'
import type { ComponentType } from 'react'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
import {
  CarFront,
  ClipboardList,
  BadgeDollarSign,
  Receipt,
  ShieldCheck,
  ImageIcon,
  FolderOpen,
  FileSearch,
} from 'lucide-react'

// Tab Components
import VehicleDetailsTab from './tabs/VehicleDetailsTab'
import ImagesTab from './tabs/ImagesTab'
import DisclosuresTab from './tabs/DisclosuresTab'
import ImportantDisclosuresTab from './tabs/ImportantDisclosuresTab'
import PurchaseTab from './tabs/PurchaseTab'
import CostsTab from './tabs/CostsTab'
import WarrantyTab from './tabs/WarrantyTab'
import FilesTab from './tabs/FilesTab'
import CarfaxTab from './tabs/CarfaxTab'

interface Vehicle {
  id: string
  make: string
  model: string
  year: number
  trim: string
  stockNumber: string
  keyNumber?: string
  keyDescription?: string
  series: string
  equipment: string
  vin: string
  price: number
  mileage: number
  odometer?: string
  odometerUnit?: string
  inStockDate?: string
  exteriorColor: string
  interiorColor: string
  transmission: string
  drivetrain: string
  fuelType: string
  bodyStyle: string
  vehicleType?: string
  description: string
  adDescription?: string
  features: string[]
  city: string
  province: string
  status: string
  inventoryType: string
  images: string[]
  condition?: string
  statusColour?: string
  retailWholesale?: string
  substatus?: string
  assignment?: string
  lotLocation?: string
  keywords?: string
  feedwords?: string
  engine?: string
  cylinders?: string
  doors?: string
  other?: string
  notes?: string
  distanceDisclaimer?: boolean
  feedToAutotrader?: boolean
  feedToCarpages?: boolean
  feedToCargurus?: boolean
  certified?: boolean
  verified?: boolean
}

interface VehicleFormData extends Omit<Partial<Vehicle>, 'features'> {
  features?: string | string[]
}

type TabType =
  | 'details'
  | 'images'
  | 'disclosures'
  | 'importantDisclosures'
  | 'purchase'
  | 'costs'
  | 'warranty'
  | 'files'
  | 'carfax'

type TabIcon = ComponentType<{ className?: string }>

const TABS: { id: TabType; label: string; icon: TabIcon }[] = [
  { id: 'details', label: 'Vehicle Details', icon: CarFront },
  { id: 'disclosures', label: 'Disclosures', icon: ClipboardList },
  { id: 'importantDisclosures', label: 'Important Disclosures', icon: ClipboardList },
  { id: 'purchase', label: 'Purchase', icon: BadgeDollarSign },
  { id: 'costs', label: 'Costs', icon: Receipt },
  { id: 'warranty', label: 'Warranty', icon: ShieldCheck },
  { id: 'images', label: 'Images', icon: ImageIcon },
  { id: 'files', label: 'Files', icon: FolderOpen },
  { id: 'carfax', label: 'CARFAX', icon: FileSearch },
]

export default function AdminEditVehiclePage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState<VehicleFormData>({})
  const [images, setImages] = useState<string[]>([])
  const [activeTab, setActiveTab] = useState<TabType>('details')
  const [carfaxFolderId, setCarfaxFolderId] = useState<string>('')
  const [saveModalOpen, setSaveModalOpen] = useState(false)
  const [saveModalTitle, setSaveModalTitle] = useState('')
  const [saveModalMessage, setSaveModalMessage] = useState('')

  const [bucketImageCache] = useState(() => new Map<string, string[]>())

  useEffect(() => {
    const sessionStr = localStorage.getItem('edc_admin_session')
    if (!sessionStr) {
      router.push('/admin')
      return
    }
    fetchVehicle()
  }, [params.id])

  // Pick active tab from URL query param (?tab=disclosures, images, etc.)
  useEffect(() => {
    const tab = (searchParams?.get('tab') || '').toLowerCase()
    const validTabs: TabType[] = [
      'details',
      'images',
      'disclosures',
      'importantDisclosures',
      'purchase',
      'costs',
      'warranty',
      'files',
      'carfax',
    ]
    if (validTabs.includes(tab as TabType)) {
      setActiveTab(tab as TabType)
    }
  }, [searchParams])

  const fetchVehicle = async () => {
    try {
      const toBool = (v: any): boolean => {
        if (typeof v === 'boolean') return v
        if (typeof v === 'number') return v === 1
        const s = String(v ?? '').trim().toLowerCase()
        return s === 'true' || s === '1' || s === 'yes' || s === 'y'
      }

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
        keyDescription: data.key_description || '',
        series: data.series || '',
        equipment: data.equipment || '',
        vin: data.vin,
        price: data.price,
        mileage: data.mileage,
        odometer: data.odometer || '',
        odometerUnit: data.odometer_unit || 'kms',
        inStockDate: data.in_stock_date || '',
        exteriorColor: data.exterior_color || '',
        interiorColor: data.interior_color || '',
        transmission: data.transmission || '',
        drivetrain: data.drivetrain || '',
        fuelType: data.fuel_type || '',
        bodyStyle: data.body_style || '',
        vehicleType: data.vehicle_type || '',
        description: data.description || '',
        adDescription: data.ad_description || '',
        features: Array.isArray(data.features) ? data.features : [],
        city: data.city,
        province: data.province,
        status: data.status,
        inventoryType: data.inventory_type,
        condition: data.condition || 'Used',
        statusColour: data.status_colour || '',
        retailWholesale: data.retail_wholesale || '',
        substatus: data.substatus || '',
        assignment: data.assignment || '',
        lotLocation: data.lot_location || '',
        keywords: data.keywords || '',
        feedwords: data.feedwords || '',
        engine: data.engine || '',
        cylinders: data.cylinders || '',
        doors: data.doors || '',
        other: data.other || '',
        notes: data.notes || '',
        distanceDisclaimer: toBool(data.distance_disclaimer),
        feedToAutotrader: toBool(data.feed_to_autotrader),
        feedToCarpages: toBool(data.feed_to_carpages),
        feedToCargurus: toBool(data.feed_to_cargurus),
        certified: toBool(data.certified),
        verified: toBool(data.verified),
      })

      // Use the vehicleId column (added by user) as the Carfax folder name, fall back to the row id
      setCarfaxFolderId(String(data.vehicleId || data.vehicle_id || data.id || ''))

      const loadBucketImages = async (vehicleId: string): Promise<string[]> => {
        const id = String(vehicleId || '').trim()
        if (!id) return []
        const cached = bucketImageCache.get(id)
        if (cached) return cached

        try {
          const { data, error: listError } = await supabase.storage
            .from('vehicle-photos')
            .list(id, {
              limit: 100,
              sortBy: { column: 'name', order: 'asc' },
            })

          if (listError || !Array.isArray(data) || data.length === 0) {
            bucketImageCache.set(id, [])
            return []
          }

          const files = data
            .filter((f) => !!f?.name && !String(f.name).endsWith('/'))
            .map((f) => `${id}/${f.name}`)

          const urls: string[] = []
          for (const path of files) {
            const pub = supabase.storage.from('vehicle-photos').getPublicUrl(path)
            const publicUrl = String(pub?.data?.publicUrl || '').trim()
            if (publicUrl) {
              urls.push(publicUrl)
              continue
            }

            const { data: signed } = await supabase.storage
              .from('vehicle-photos')
              .createSignedUrl(path, 60 * 60)
            const signedUrl = String((signed as any)?.signedUrl || '').trim()
            if (signedUrl) urls.push(signedUrl)
          }

          bucketImageCache.set(id, urls)
          return urls
        } catch {
          bucketImageCache.set(id, [])
          return []
        }
      }

      setImages(await loadBucketImages(String(data.id)))
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
      const toNumberOrNull = (v: any) => {
        const n = Number(v)
        return Number.isFinite(n) ? n : null
      }
      const toIntOrNull = (v: any) => {
        const n = parseInt(String(v))
        return Number.isFinite(n) ? n : null
      }
      const features =
        typeof formData.features === 'string'
          ? formData.features.split(',').map((f: string) => f.trim()).filter(Boolean)
          : Array.isArray(formData.features)
            ? formData.features
            : []

      const payload: Record<string, any> = {
        make: formData.make || null,
        model: formData.model || null,
        year: toIntOrNull(formData.year),
        trim: formData.trim || null,
        stock_number: formData.stockNumber || null,
        key_number: formData.keyNumber || null,
        key_description: (formData as any).keyDescription || null,
        series: formData.series || null,
        equipment: formData.equipment || null,
        vin: formData.vin || null,
        price: toNumberOrNull(formData.price),
        mileage: toIntOrNull(formData.mileage),
        status: formData.status || null,
        inventory_type: formData.inventoryType || null,
        fuel_type: formData.fuelType || null,
        transmission: formData.transmission || null,
        body_style: formData.bodyStyle || null,
        drivetrain: formData.drivetrain || null,
        city: formData.city || null,
        province: formData.province || null,
        exterior_color: formData.exteriorColor || null,
        interior_color: formData.interiorColor || null,
        description: formData.description || null,
        features,
        condition: (formData as any).condition || null,
        status_colour: (formData as any).statusColour || null,
        retail_wholesale: (formData as any).retailWholesale || null,
        substatus: (formData as any).substatus || null,
        assignment: (formData as any).assignment || null,
        lot_location: (formData as any).lotLocation || null,
        keywords: (formData as any).keywords || null,
        feedwords: (formData as any).feedwords || null,
        odometer: (formData as any).odometer || null,
        odometer_unit: (formData as any).odometerUnit || null,
        in_stock_date: (formData as any).inStockDate || null,
        vehicle_type: (formData as any).vehicleType || null,
        engine: (formData as any).engine || null,
        cylinders: (formData as any).cylinders || null,
        doors: (formData as any).doors || null,
        other: (formData as any).other || null,
        notes: (formData as any).notes || null,
        ad_description: (formData as any).adDescription || null,
        distance_disclaimer: Boolean((formData as any).distanceDisclaimer),
        feed_to_autotrader: Boolean((formData as any).feedToAutotrader),
        feed_to_carpages: Boolean((formData as any).feedToCarpages),
        feed_to_cargurus: Boolean((formData as any).feedToCargurus),
        certified: Boolean((formData as any).certified),
        verified: Boolean((formData as any).verified),
        updated_at: new Date().toISOString(),
      }

      // Update directly to edc_vehicles table
      const { error } = await supabase
        .from('edc_vehicles')
        .update(payload)
        .eq('id', String(params.id))

      if (error) {
        setSaveModalTitle('Save Failed')
        setSaveModalMessage(error.message || 'Failed to update vehicle.')
        setSaveModalOpen(true)
      } else {
        setSaveModalTitle('Saved')
        setSaveModalMessage('Vehicle saved successfully.')
        setSaveModalOpen(true)
        await fetchVehicle()
      }
    } catch (error) {
      console.error('Error saving vehicle:', error)
      const msg = error instanceof Error ? error.message : 'An unexpected error occurred while saving.'
      setSaveModalTitle('Save Failed')
      setSaveModalMessage(msg)
      setSaveModalOpen(true)
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
            {TABS.map((tab) => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'border-black text-black'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${activeTab === tab.id ? 'text-black' : 'text-gray-500'}`} />
                  <span>{tab.label}</span>
                </button>
              )
            })}
          </nav>
        </div>
      </div>

      {saveModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">{saveModalTitle}</h3>
              <button
                onClick={() => setSaveModalOpen(false)}
                className="p-1 text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </div>
            <div className="px-6 py-5 text-sm text-gray-700 whitespace-pre-line">
              {saveModalMessage}
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end">
              <button
                type="button"
                onClick={() => setSaveModalOpen(false)}
                className="px-4 py-2 bg-[#118df0] text-white rounded-md hover:bg-[#0d6ebd]"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tab Content */}
      <div className="w-full px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'details' && (
          <VehicleDetailsTab
            formData={formData}
            onChange={handleChange}
            onFormDataChange={(data) => setFormData(prev => ({ ...prev, ...data }))}
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

        {activeTab === 'importantDisclosures' && (
          <ImportantDisclosuresTab vehicleId={String(params.id)} />
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

        {activeTab === 'carfax' && (
          <CarfaxTab vehicleId={carfaxFolderId || String(params.id)} />
        )}
      </div>
    </div>
  )
}
