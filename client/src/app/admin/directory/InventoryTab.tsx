'use client'

import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabaseClient'
import type { ComponentType } from 'react'
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
import VehicleDetailsTab from '../inventory/[id]/tabs/VehicleDetailsTab'
import ImagesTab from '../inventory/[id]/tabs/ImagesTab'
import DisclosuresTab from '../inventory/[id]/tabs/DisclosuresTab'
import ImportantDisclosuresTab from '../inventory/[id]/tabs/ImportantDisclosuresTab'
import PurchaseTab from '../inventory/[id]/tabs/PurchaseTab'
import CostsTab from '../inventory/[id]/tabs/CostsTab'
import WarrantyTab from '../inventory/[id]/tabs/WarrantyTab'
import FilesTab from '../inventory/[id]/tabs/FilesTab'
import CarfaxTab from '../inventory/[id]/tabs/CarfaxTab'

type VehicleRow = {
  id: string
  stock_number: string | null
  make: string | null
  model: string | null
  year: number | null
  vin: string | null
  price: number | null
  mileage: number | null
  odometer: string | null
  odometer_unit: string | null
  status: string | null
  inventory_type: string | null
  condition: string | null
  created_at: string | null
  user_id: string | null
}

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

type TabType = 'details' | 'images' | 'disclosures' | 'importantDisclosures' | 'purchase' | 'costs' | 'warranty' | 'files' | 'carfax'
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

export default function InventoryTab() {
  const [rows, setRows] = useState<VehicleRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [pageSize, setPageSize] = useState(10)
  const [page, setPage] = useState(1)
  const [userFilter, setUserFilter] = useState<string>('')
  const [userOptions, setUserOptions] = useState<{ user_id: string; name: string }[]>([])

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<TabType>('details')
  const [formData, setFormData] = useState<VehicleFormData>({})
  const [images, setImages] = useState<string[]>([])
  const [loadingVehicle, setLoadingVehicle] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveModalOpen, setSaveModalOpen] = useState(false)
  const [saveModalTitle, setSaveModalTitle] = useState('')
  const [saveModalMessage, setSaveModalMessage] = useState('')

  useEffect(() => { fetchVehicles(); fetchUsers() }, [])

  const fetchVehicles = async () => {
    setLoading(true)
    setError(null)
    try {
      const { data, error: dbError } = await supabase
        .from('edc_vehicles')
        .select('id, stock_number, make, model, year, vin, price, mileage, odometer, odometer_unit, status, inventory_type, condition, created_at, user_id')
        .order('created_at', { ascending: false })
        .limit(1000)
      if (dbError) throw dbError
      setRows(Array.isArray(data) ? data : [])
    } catch (e: any) {
      setError(e?.message || 'Failed to load vehicles')
      setRows([])
    } finally {
      setLoading(false)
    }
  }

  const fetchUsers = async () => {
    try {
      const { data } = await supabase
        .from('users')
        .select('user_id, first_name, last_name')
        .order('first_name', { ascending: true })
      if (Array.isArray(data)) {
        setUserOptions(
          data
            .filter((u) => u.user_id)
            .map((u) => ({
              user_id: u.user_id,
              name: [u.first_name, u.last_name].filter(Boolean).join(' ') || u.user_id,
            }))
        )
      }
    } catch { /* ignore */ }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return rows.filter((r) => {
      if (userFilter && r.user_id !== userFilter) return false
      if (!q) return true
      return [r.stock_number, r.make, r.model, String(r.year), r.vin, r.status]
        .filter(Boolean).join(' ').toLowerCase().includes(q)
    })
  }, [rows, query, userFilter])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const paged = filtered.slice((safePage - 1) * pageSize, safePage * pageSize)

  const handleEdit = async (id: string) => {
    setEditingId(id)
    setActiveTab('details')
    setFormData({})
    setImages([])
    setLoadingVehicle(true)
    try {
      const toBool = (v: any): boolean => {
        if (typeof v === 'boolean') return v
        if (typeof v === 'number') return v === 1
        const s = String(v ?? '').trim().toLowerCase()
        return s === 'true' || s === '1' || s === 'yes' || s === 'y'
      }
      const { data, error } = await supabase.from('edc_vehicles').select('*').eq('id', id).maybeSingle()
      if (error || !data) { setEditingId(null); return }
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
      // Load images
      try {
        const { data: imgData } = await supabase.storage.from('vehicle-photos').list(id, { limit: 100, sortBy: { column: 'name', order: 'asc' } })
        if (Array.isArray(imgData) && imgData.length > 0) {
          const urls: string[] = []
          for (const f of imgData.filter((f) => !!f?.name && !String(f.name).endsWith('/'))) {
            const pub = supabase.storage.from('vehicle-photos').getPublicUrl(`${id}/${f.name}`)
            const url = String(pub?.data?.publicUrl || '').trim()
            if (url) urls.push(url)
          }
          setImages(urls)
        }
      } catch { /* ignore image load errors */ }
    } catch (e) {
      console.error('Failed to load vehicle', e)
      setEditingId(null)
    } finally {
      setLoadingVehicle(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingId) return
    setSaving(true)
    try {
      const toNumberOrNull = (v: any) => { const n = Number(v); return Number.isFinite(n) ? n : null }
      const toIntOrNull = (v: any) => { const n = parseInt(String(v)); return Number.isFinite(n) ? n : null }
      const features = typeof formData.features === 'string'
        ? formData.features.split(',').map((f) => f.trim()).filter(Boolean)
        : Array.isArray(formData.features) ? formData.features : []

      const payload: Record<string, any> = {
        make: formData.make || null,
        model: formData.model || null,
        year: toIntOrNull(formData.year),
        trim: formData.trim || null,
        stock_number: formData.stockNumber || null,
        key_number: formData.keyNumber || null,
        key_description: formData.keyDescription || null,
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
        condition: formData.condition || null,
        status_colour: formData.statusColour || null,
        retail_wholesale: formData.retailWholesale || null,
        substatus: formData.substatus || null,
        assignment: formData.assignment || null,
        lot_location: formData.lotLocation || null,
        keywords: formData.keywords || null,
        feedwords: formData.feedwords || null,
        odometer: formData.odometer || null,
        odometer_unit: formData.odometerUnit || null,
        in_stock_date: formData.inStockDate || null,
        vehicle_type: formData.vehicleType || null,
        engine: formData.engine || null,
        cylinders: formData.cylinders || null,
        doors: formData.doors || null,
        other: formData.other || null,
        notes: formData.notes || null,
        ad_description: formData.adDescription || null,
        distance_disclaimer: Boolean(formData.distanceDisclaimer),
        feed_to_autotrader: Boolean(formData.feedToAutotrader),
        feed_to_carpages: Boolean(formData.feedToCarpages),
        feed_to_cargurus: Boolean(formData.feedToCargurus),
        certified: Boolean(formData.certified),
        verified: Boolean(formData.verified),
        updated_at: new Date().toISOString(),
      }

      const { error } = await supabase.from('edc_vehicles').update(payload).eq('id', editingId)
      if (error) {
        setSaveModalTitle('Save Failed')
        setSaveModalMessage(error.message || 'Failed to update vehicle.')
      } else {
        setSaveModalTitle('Saved')
        setSaveModalMessage('Vehicle saved successfully.')
        await fetchVehicles()
      }
      setSaveModalOpen(true)
    } catch (err) {
      setSaveModalTitle('Save Failed')
      setSaveModalMessage(err instanceof Error ? err.message : 'An unexpected error occurred.')
      setSaveModalOpen(true)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this vehicle?')) return
    try {
      const { error: delError } = await supabase.from('edc_vehicles').delete().eq('id', id)
      if (delError) throw delError
      await fetchVehicles()
    } catch (e: any) {
      alert(e?.message || 'Failed to delete')
    }
  }

  const formatPrice = (price: number | null) => {
    if (!price) return '-'
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(price)
  }

  // --- Edit view ---
  if (editingId) {
    const vehicleTitle = [formData.year, formData.make, formData.model].filter(Boolean).join(' ')
    return (
      <div className="min-h-screen bg-gray-100 -mx-6 -mt-6">
        {/* Header */}
        <div className="bg-white shadow">
          <div className="w-full px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => setEditingId(null)}
                  className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                  title="Back to list"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                </button>
                <div>
                  <h1 className="text-xl font-bold text-gray-900">{vehicleTitle || 'Edit Vehicle'}</h1>
                  <p className="text-sm text-gray-500">Stock: {formData.stockNumber || 'N/A'} • VIN: {formData.vin || 'N/A'}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                  formData.status === 'In Stock' ? 'bg-green-100 text-green-800' :
                  formData.status === 'Sold' ? 'bg-blue-100 text-blue-800' :
                  formData.status === 'Deal Pending' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-gray-100 text-gray-800'
                }`}>{formData.status || '-'}</span>
                <span className="px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
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
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                      activeTab === tab.id ? 'border-black text-black' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
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

        {loadingVehicle ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin w-8 h-8 border-4 border-[#118df0] border-t-transparent rounded-full" />
          </div>
        ) : (
          <div className="w-full px-4 sm:px-6 lg:px-8 py-6">
            {activeTab === 'details' && (
              <VehicleDetailsTab
                formData={formData}
                onChange={handleChange}
                onFormDataChange={(data) => setFormData((prev) => ({ ...prev, ...data }))}
                onSubmit={handleSubmit}
                saving={saving}
              />
            )}
            {activeTab === 'images' && (
              <ImagesTab vehicleId={editingId} images={images} onImagesUpdate={setImages} />
            )}
            {activeTab === 'disclosures' && <DisclosuresTab vehicleId={editingId} />}
            {activeTab === 'importantDisclosures' && <ImportantDisclosuresTab vehicleId={editingId} />}
            {activeTab === 'purchase' && <PurchaseTab vehicleId={editingId} stockNumber={formData.stockNumber || ''} />}
            {activeTab === 'costs' && <CostsTab vehicleId={editingId} vehiclePrice={formData.price || 0} />}
            {activeTab === 'warranty' && <WarrantyTab vehicleId={editingId} />}
            {activeTab === 'files' && <FilesTab vehicleId={editingId} />}
            {activeTab === 'carfax' && <CarfaxTab vehicleId={editingId} />}
          </div>
        )}

        {saveModalOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">{saveModalTitle}</h3>
                <button onClick={() => setSaveModalOpen(false)} className="p-1 text-gray-400 hover:text-gray-600">×</button>
              </div>
              <div className="px-6 py-5 text-sm text-gray-700 whitespace-pre-line">{saveModalMessage}</div>
              <div className="px-6 py-4 border-t border-gray-100 flex justify-end">
                <button type="button" onClick={() => setSaveModalOpen(false)} className="px-4 py-2 bg-[#118df0] text-white rounded-md hover:bg-[#0d6ebd]">OK</button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // --- List view ---
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search inventory..."
            autoComplete="off"
            className="h-10 w-64 max-w-full pl-4 pr-4 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1EA7FF]/30 focus:border-[#1EA7FF]/40 transition-all"
          />
          <select
            value={userFilter}
            onChange={(e) => { setUserFilter(e.target.value); setPage(1) }}
            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-[#1EA7FF]/30 transition-all"
          >
            <option value="">All Users</option>
            {userOptions.map((u) => (
              <option key={u.user_id} value={u.user_id}>{u.name}</option>
            ))}
          </select>
        </div>
        <select
          value={pageSize}
          onChange={(e) => setPageSize(Number(e.target.value) || 10)}
          className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-[#1EA7FF]/30 transition-all"
        >
          <option value={10}>10 per page</option>
          <option value={20}>20 per page</option>
          <option value={50}>50 per page</option>
          <option value={100}>100 per page</option>
        </select>
      </div>

      {error && <div className="text-sm text-red-600 bg-red-50 px-4 py-3 rounded-xl">{error}</div>}

      <div className="overflow-hidden rounded-xl border border-slate-200/60">
        <table className="w-full table-auto text-sm">
          <thead className="bg-slate-50/80 text-slate-600">
            <tr>
              <th className="w-28 px-3 py-3 text-left font-semibold">STOCK #</th>
              <th className="w-48 px-3 py-3 text-left font-semibold">VEHICLE</th>
              <th className="w-44 px-3 py-3 text-left font-semibold">VIN</th>
              <th className="w-28 px-3 py-3 text-right font-semibold">PRICE</th>
              <th className="w-24 px-3 py-3 text-right font-semibold">ODOMETER</th>
              <th className="w-28 px-3 py-3 text-left font-semibold">STATUS</th>
              <th className="w-24 px-3 py-3 text-left font-semibold">TYPE</th>
              <th className="w-24 px-3 py-3 text-left font-semibold">CONDITION</th>
              <th className="w-28 px-3 py-3 text-center font-semibold">ACTIONS</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td className="px-4 py-4 text-slate-400 text-center" colSpan={9}>Loading...</td></tr>
            ) : paged.length === 0 ? (
              <tr><td className="px-4 py-4 text-slate-400 text-center" colSpan={9}>No vehicles found.</td></tr>
            ) : (
              paged.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="px-3 py-2 text-slate-900 font-medium">{r.stock_number || '-'}</td>
                  <td className="px-3 py-2 text-slate-900">{[r.year, r.make, r.model].filter(Boolean).join(' ') || '-'}</td>
                  <td className="px-3 py-2 text-slate-600 text-xs font-mono">{r.vin || '-'}</td>
                  <td className="px-3 py-2 text-slate-900 text-right font-semibold">{formatPrice(r.price)}</td>
                  <td className="px-3 py-2 text-slate-600 text-right">
                    {r.odometer ? `${Number(r.odometer).toLocaleString()} ${r.odometer_unit || 'kms'}` : '-'}
                  </td>
                  <td className="px-3 py-2">
                    <span className={`inline-flex px-2 py-1 rounded-lg text-xs font-semibold ${
                      r.status === 'In Stock' ? 'bg-green-100 text-green-700' :
                      r.status === 'Sold' ? 'bg-blue-100 text-blue-700' :
                      r.status === 'Deal Pending' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-slate-100 text-slate-700'
                    }`}>{r.status || '-'}</span>
                  </td>
                  <td className="px-3 py-2 text-slate-600 text-xs">{r.inventory_type || '-'}</td>
                  <td className="px-3 py-2 text-slate-600 text-xs">{r.condition || '-'}</td>
                  <td className="px-3 py-2 text-center">
                    <div className="flex items-center justify-center gap-3">
                      <button
                        type="button"
                        onClick={() => handleEdit(r.id)}
                        className="text-slate-400 hover:text-[#1EA7FF] transition-colors"
                        title="Edit"
                      >
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 3.5a2.121 2.121 0 113 3L7 19l-4 1 1-4 12.5-12.5z" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(r.id)}
                        className="text-red-400 hover:text-red-600 transition-colors"
                        title="Delete"
                      >
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M10 11v6m4-6v6" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-xs text-slate-500">
        <div>
          {filtered.length > 0 ? `Showing ${(safePage - 1) * pageSize + 1} to ${Math.min(safePage * pageSize, filtered.length)} of ${filtered.length}` : ''}
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={safePage <= 1} className="rounded-lg border border-slate-200/60 px-3 py-1 hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">Previous</button>
          <span className="px-2">Page {safePage} of {totalPages}</span>
          <button type="button" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={safePage >= totalPages} className="rounded-lg border border-slate-200/60 px-3 py-1 hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">Next</button>
        </div>
      </div>
    </div>
  )
}
