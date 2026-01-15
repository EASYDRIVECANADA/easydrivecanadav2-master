'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'

interface Vehicle {
  id: string
  make: string
  model: string
  year: number
  trim?: string
  stockNumber: string
  price: number
  mileage: number
  status: string
  inventoryType: string
  images: string[]
  photos?: string[]
  keyNumber?: string
  vin?: string
  createdAt: string
}

export default function AdminInventoryPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [filteredVehicles, setFilteredVehicles] = useState<Vehicle[]>([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [inventoryTypeFilter, setInventoryTypeFilter] = useState<'' | 'FLEET' | 'PREMIERE'>('')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalVehicles, setTotalVehicles] = useState(0)
  const [statusTab, setStatusTab] = useState<'ACTIVE' | 'PENDING' | 'SOLD'>('ACTIVE')
  const [showAddModal, setShowAddModal] = useState(false)
  const [addSubmitting, setAddSubmitting] = useState(false)
  const [addError, setAddError] = useState('')
  const [addFormData, setAddFormData] = useState({
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
  const itemsPerPage = 20
  const router = useRouter()

  useEffect(() => {
    // Check auth
    const sessionStr = localStorage.getItem('edc_admin_session')
    if (!sessionStr) {
      router.push('/admin')
      return
    }
    fetchVehicles()
  }, [statusTab])

  const handleOpenAddModal = () => {
    setAddError('')
    setAddSubmitting(false)
    setAddFormData({
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
    setShowAddModal(true)
  }

  const handleAddChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target
    setAddFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setAddSubmitting(true)
    setAddError('')

    try {
      const payload = {
        ...addFormData,
        price: parseFloat(addFormData.price),
        mileage: parseInt(addFormData.mileage),
        year: parseInt(addFormData.year.toString()),
        features: addFormData.features.split(',').map((f) => f.trim()).filter(Boolean),
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
        setAddError('Failed to create vehicle')
        return
      }

      setShowAddModal(false)
      router.push(`/admin/inventory/${data.id}/photos`)
    } catch {
      setAddError('Unable to create vehicle. Please try again.')
    } finally {
      setAddSubmitting(false)
    }
  }

  const fetchVehicles = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('edc_vehicles')
        .select('id, make, model, year, trim, stock_number, price, mileage, status, inventory_type, images, key_number, vin, created_at')
        .eq('status', statusTab)
        .order('created_at', { ascending: false })

      if (error) throw error

      const mapped: Vehicle[] = (data || []).map((v: any) => ({
        id: v.id,
        make: v.make,
        model: v.model,
        year: v.year,
        trim: v.trim || undefined,
        stockNumber: v.stock_number || '',
        price: v.price,
        mileage: v.mileage,
        status: v.status,
        inventoryType: v.inventory_type,
        images: Array.isArray(v.images) ? v.images : [],
        keyNumber: v.key_number || undefined,
        vin: v.vin || undefined,
        createdAt: v.created_at,
      }))

      setVehicles(mapped)
      setTotalVehicles(mapped.length)
      setFilteredVehicles(mapped)
      setCurrentPage(1)
    } catch (error) {
      console.error('Error fetching vehicles:', error)
    } finally {
      setLoading(false)
    }
  }

  // Search and filter vehicles
  useEffect(() => {
    let filtered = vehicles

    // Filter by inventory type
    if (inventoryTypeFilter) {
      filtered = filtered.filter(vehicle => vehicle.inventoryType === inventoryTypeFilter)
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(vehicle => 
        vehicle.make.toLowerCase().includes(query) ||
        vehicle.model.toLowerCase().includes(query) ||
        vehicle.year.toString().includes(query) ||
        vehicle.stockNumber?.toLowerCase().includes(query) ||
        vehicle.vin?.toLowerCase().includes(query) ||
        vehicle.keyNumber?.toLowerCase().includes(query) ||
        `${vehicle.year} ${vehicle.make} ${vehicle.model}`.toLowerCase().includes(query)
      )
    }
    
    setFilteredVehicles(filtered)
    setTotalVehicles(filtered.length)
    setCurrentPage(1)
  }, [searchQuery, inventoryTypeFilter, vehicles])

  // Get paginated vehicles
  const paginatedVehicles = filteredVehicles.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  )
  
  const totalPages = Math.ceil(totalVehicles / itemsPerPage)

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this vehicle?')) return

    setDeleting(id)
    try {
      const { error } = await supabase.from('edc_vehicles').delete().eq('id', id)
      if (!error) {
        setVehicles(vehicles.filter((v) => v.id !== id))
      }
    } catch (error) {
      console.error('Error deleting vehicle:', error)
    } finally {
      setDeleting(null)
    }
  }

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: 'CAD',
      minimumFractionDigits: 0,
    }).format(price)
  }

  const handleStatusChange = async (vehicleId: string, newStatus: 'ACTIVE' | 'PENDING' | 'SOLD') => {
    try {
      const { error } = await supabase.from('edc_vehicles').update({ status: newStatus }).eq('id', vehicleId)

      if (!error) {
        // Remove from current list since it changed status
        setVehicles(prev => prev.filter(v => v.id !== vehicleId))
        setFilteredVehicles(prev => prev.filter(v => v.id !== vehicleId))
        setTotalVehicles(prev => prev - 1)
      } else {
        alert('Failed to update vehicle status')
      }
    } catch (error) {
      console.error('Error updating status:', error)
      alert('Failed to update vehicle status')
    }
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="w-full px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-gray-900">Inventory Management</h1>
            </div>
            <button
              type="button"
              onClick={handleOpenAddModal}
              className="bg-[#118df0] text-white px-4 py-2 rounded-lg font-medium hover:bg-[#0d6ebd] transition-colors"
            >
              + Add Vehicle
            </button>
          </div>
        </div>
      </div>

      <div className="w-full px-4 sm:px-6 lg:px-8 py-8">
        {/* Status Tabs */}
        <div className="bg-white rounded-xl shadow mb-6">
          <div className="border-b border-gray-200">
            <nav className="flex -mb-px">
              <button
                onClick={() => setStatusTab('ACTIVE')}
                className={`py-4 px-6 text-sm font-medium border-b-2 transition-colors ${
                  statusTab === 'ACTIVE'
                    ? 'border-[#118df0] text-[#118df0]'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Active
              </button>
              <button
                onClick={() => setStatusTab('PENDING')}
                className={`py-4 px-6 text-sm font-medium border-b-2 transition-colors ${
                  statusTab === 'PENDING'
                    ? 'border-[#118df0] text-[#118df0]'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Pending
              </button>
              <button
                onClick={() => setStatusTab('SOLD')}
                className={`py-4 px-6 text-sm font-medium border-b-2 transition-colors ${
                  statusTab === 'SOLD'
                    ? 'border-[#118df0] text-[#118df0]'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Sold
              </button>
            </nav>
          </div>
        </div>

        {/* Search Bar & Filters */}
        <div className="bg-white rounded-xl shadow p-4 mb-6">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex-1 min-w-[200px] relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by make, model, year, stock #, VIN, or key number..."
                className="w-full border border-gray-300 rounded-lg pl-10 pr-4 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent"
              />
              <svg className="absolute left-3 top-2.5 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            {/* Inventory Type Filter */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setInventoryTypeFilter('')}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  inventoryTypeFilter === ''
                    ? 'bg-gray-900 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setInventoryTypeFilter('FLEET')}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  inventoryTypeFilter === 'FLEET'
                    ? 'bg-blue-600 text-white'
                    : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                }`}
              >
                🚗 Fleet
              </button>
              <button
                onClick={() => setInventoryTypeFilter('PREMIERE')}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  inventoryTypeFilter === 'PREMIERE'
                    ? 'bg-amber-500 text-white'
                    : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                }`}
              >
                ✨ Premiere
              </button>
            </div>
            <div className="text-sm text-gray-600">
              Showing {paginatedVehicles.length} of {totalVehicles} vehicles
            </div>
          </div>
        </div>

        {loading ? (
          <div className="bg-white rounded-xl shadow p-8 text-center">
            <div className="animate-spin w-8 h-8 border-4 border-[#118df0] border-t-transparent rounded-full mx-auto"></div>
            <p className="mt-4 text-gray-500">Loading vehicles...</p>
          </div>
        ) : vehicles.length === 0 ? (
          <div className="bg-white rounded-xl shadow p-8 text-center">
            <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            <h3 className="text-xl font-semibold text-gray-700 mb-2">No Vehicles</h3>
            <p className="text-gray-500 mb-4">Start by adding your first vehicle or importing a CSV file.</p>
            <div className="flex justify-center gap-4">
              <button
                type="button"
                onClick={handleOpenAddModal}
                className="bg-[#118df0] text-white px-6 py-2 rounded-lg font-medium hover:bg-[#0d6ebd] transition-colors"
              >
                Add Vehicle
              </button>
              <Link
                href="/admin/import"
                className="border border-[#118df0] text-[#118df0] px-6 py-2 rounded-lg font-medium hover:bg-[#118df0] hover:text-white transition-colors"
              >
                Import CSV
              </Link>
            </div>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden lg:block bg-white rounded-xl shadow overflow-hidden overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Vehicle</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Stock #</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Key #</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Price</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Mileage</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Photos</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {paginatedVehicles.map((vehicle) => (
                  <tr key={vehicle.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-12 h-12 bg-gray-200 rounded-lg overflow-hidden flex-shrink-0">
                          {vehicle.images && vehicle.images.length > 0 ? (
                            <img
                              src={vehicle.images[0]}
                              alt=""
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none'
                              }}
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-400">
                              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                            </div>
                          )}
                        </div>
                        <div className="ml-4">
                          <a
                            href={`/inventory/${vehicle.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm font-medium text-gray-900 hover:text-[#118df0] hover:underline"
                            title="View on shop"
                          >
                            {vehicle.year} {vehicle.make} {vehicle.model}
                          </a>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {vehicle.stockNumber || '—'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {vehicle.keyNumber ? (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          🔑 {vehicle.keyNumber}
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatPrice(vehicle.price)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {vehicle.mileage?.toLocaleString()} km
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <select
                        value={vehicle.status}
                        onChange={(e) => handleStatusChange(vehicle.id, e.target.value as 'ACTIVE' | 'PENDING' | 'SOLD')}
                        className={`px-2 py-1 text-xs font-medium rounded-full border-0 focus:ring-2 focus:ring-[#118df0] ${
                          vehicle.status === 'ACTIVE' ? 'bg-green-100 text-green-800' :
                          vehicle.status === 'SOLD' ? 'bg-red-100 text-red-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`}
                      >
                        <option value="ACTIVE">Active</option>
                        <option value="PENDING">Pending</option>
                        <option value="SOLD">Sold</option>
                      </select>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {vehicle.images?.length || 0} photos
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Link
                          href={`/admin/inventory/${vehicle.id}/photos`}
                          className="p-2 text-[#118df0] hover:bg-blue-50 rounded-lg transition-colors"
                          title="Manage photos"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </Link>
                        <Link
                          href={`/admin/inventory/${vehicle.id}`}
                          className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                          title="Edit vehicle"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </Link>
                        <button
                          onClick={() => handleDelete(vehicle.id)}
                          disabled={deleting === vehicle.id}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-50 transition-colors"
                          title="Delete vehicle"
                        >
                          {deleting === vehicle.id ? (
                            <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                          ) : (
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="lg:hidden space-y-3">
            {paginatedVehicles.map((vehicle) => (
              <div key={vehicle.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                {/* Top Section: Image + Basic Info */}
                <div className="flex p-3 gap-3">
                  {/* Vehicle Image */}
                  <div className="w-28 h-28 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                    {vehicle.images && vehicle.images.length > 0 ? (
                      <img
                        src={vehicle.images[0]}
                        alt={`${vehicle.year} ${vehicle.make} ${vehicle.model}`}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none'
                          e.currentTarget.parentElement!.innerHTML = `
                            <div class="w-full h-full flex items-center justify-center text-gray-400">
                              <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                            </div>
                          `
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400">
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                    )}
                  </div>
                  
                  {/* Vehicle Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <Link href={`/inventory/${vehicle.id}`} className="min-w-0 group">
                        <h3 className="font-semibold text-gray-900 text-sm leading-tight group-hover:text-blue-600 transition-colors">
                          {vehicle.year} {vehicle.make}
                        </h3>
                        <p className="text-sm text-gray-800 font-medium truncate group-hover:text-blue-600 transition-colors">{vehicle.model}</p>
                        {vehicle.trim && (
                          <p className="text-xs text-gray-500 truncate">{vehicle.trim}</p>
                        )}
                      </Link>
                      {/* Status & Type Badges */}
                      <div className="flex flex-col gap-1 flex-shrink-0">
                        <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                          vehicle.status === 'ACTIVE'
                            ? 'bg-green-100 text-green-700'
                            : vehicle.status === 'PENDING'
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-gray-100 text-gray-700'
                        }`}>
                          {vehicle.status === 'ACTIVE' ? 'Active' : vehicle.status}
                        </span>
                        <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                          vehicle.inventoryType === 'PREMIERE' 
                            ? 'bg-amber-100 text-amber-700' 
                            : 'bg-blue-100 text-blue-700'
                        }`}>
                          {vehicle.inventoryType === 'PREMIERE' ? '✨ Premiere' : '🚗 Fleet'}
                        </span>
                      </div>
                    </div>
                    
                    {/* Price */}
                    <p className="text-lg font-bold text-blue-600 mt-1">
                      ${vehicle.price?.toLocaleString()}
                    </p>
                    
                    {/* Key Details Row */}
                    <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-xs text-gray-600">
                      <span>📍 {vehicle.stockNumber}</span>
                      <span>🔑 {vehicle.keyNumber || 'N/A'}</span>
                      <span>🛣️ {vehicle.mileage?.toLocaleString()} km</span>
                    </div>
                  </div>
                </div>

                {/* Action Bar */}
                <div className="flex border-t border-gray-100 divide-x divide-gray-100">
                  <button
                    onClick={() => router.push(`/admin/inventory/${vehicle.id}/photos`)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium text-blue-600 hover:bg-blue-50 active:bg-blue-100 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    Photos ({vehicle.images?.length || 0})
                  </button>
                  <button
                    onClick={() => router.push(`/admin/inventory/${vehicle.id}`)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium text-gray-600 hover:bg-gray-50 active:bg-gray-100 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(vehicle.id)}
                    disabled={deleting === vehicle.id}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium text-red-600 hover:bg-red-50 active:bg-red-100 transition-colors disabled:opacity-50"
                  >
                    {deleting === vehicle.id ? (
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    )}
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="bg-white rounded-xl shadow px-4 py-3 flex items-center justify-between mt-6">
              <div className="text-sm text-gray-700">
                Page {currentPage} of {totalPages}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  className="px-3 py-1 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  First
                </button>
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`px-3 py-1 border rounded-md text-sm font-medium ${
                        currentPage === pageNum
                          ? 'bg-[#118df0] text-white border-[#118df0]'
                          : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
                <button
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
                <button
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Last
                </button>
              </div>
            </div>
          )}
        </>
        )}
      </div>

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => (addSubmitting ? null : setShowAddModal(false))}
          ></div>
          <div className="relative bg-white w-full max-w-4xl mx-4 rounded-2xl shadow-xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Add New Vehicle</h2>
                <p className="text-sm text-gray-500">Create a vehicle and then add photos</p>
              </div>
              <button
                type="button"
                onClick={() => (addSubmitting ? null : setShowAddModal(false))}
                className="p-2 rounded-lg hover:bg-gray-100"
                aria-label="Close"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 overflow-y-auto">
              <form onSubmit={handleAddSubmit} className="space-y-8">
                {addError && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">{addError}</div>
                )}

                <div>
                  <h3 className="text-lg font-semibold mb-4 border-b pb-2">Basic Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Make *</label>
                      <input
                        type="text"
                        name="make"
                        required
                        value={addFormData.make}
                        onChange={handleAddChange}
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
                        value={addFormData.model}
                        onChange={handleAddChange}
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
                        value={addFormData.year}
                        onChange={handleAddChange}
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
                        value={addFormData.price}
                        onChange={handleAddChange}
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
                        value={addFormData.mileage}
                        onChange={handleAddChange}
                        placeholder="e.g., 50000"
                        className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                      <select
                        name="status"
                        value={addFormData.status}
                        onChange={handleAddChange}
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
                        value={addFormData.inventoryType}
                        onChange={handleAddChange}
                        className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent"
                      >
                        <option value="FLEET">Fleet Cars</option>
                        <option value="PREMIERE">Premiere Cars</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-4 border-b pb-2">Identification & Location</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Stock Number (Unit ID)</label>
                      <input
                        type="text"
                        name="stockNumber"
                        value={addFormData.stockNumber}
                        onChange={handleAddChange}
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
                        value={addFormData.vin}
                        onChange={handleAddChange}
                        placeholder="Vehicle Identification Number"
                        className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Series</label>
                      <input
                        type="text"
                        name="series"
                        value={addFormData.series}
                        onChange={handleAddChange}
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
                        value={addFormData.city}
                        onChange={handleAddChange}
                        placeholder="e.g., Toronto"
                        className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Province *</label>
                      <select
                        name="province"
                        required
                        value={addFormData.province}
                        onChange={handleAddChange}
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
                        <option value="NL">Newfoundland and Labrador</option>
                        <option value="PE">Prince Edward Island</option>
                        <option value="NT">Northwest Territories</option>
                        <option value="NU">Nunavut</option>
                        <option value="YT">Yukon</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Key #</label>
                      <input
                        type="text"
                        name="keyNumber"
                        value={addFormData.keyNumber}
                        onChange={handleAddChange}
                        placeholder="e.g., 12"
                        className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-4 border-b pb-2">Specifications</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Fuel Type</label>
                      <select
                        name="fuelType"
                        value={addFormData.fuelType}
                        onChange={handleAddChange}
                        className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent"
                      >
                        <option value="Gasoline">Gasoline</option>
                        <option value="Diesel">Diesel</option>
                        <option value="Hybrid">Hybrid</option>
                        <option value="Electric">Electric</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Transmission</label>
                      <select
                        name="transmission"
                        value={addFormData.transmission}
                        onChange={handleAddChange}
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
                        value={addFormData.drivetrain}
                        onChange={handleAddChange}
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
                      <input
                        type="text"
                        name="bodyStyle"
                        required
                        value={addFormData.bodyStyle}
                        onChange={handleAddChange}
                        placeholder="e.g., Sedan"
                        className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Trim</label>
                      <input
                        type="text"
                        name="trim"
                        value={addFormData.trim}
                        onChange={handleAddChange}
                        placeholder="e.g., SE, XLE"
                        className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-4 border-b pb-2">Colors</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Exterior Color *</label>
                      <input
                        type="text"
                        name="exteriorColor"
                        required
                        value={addFormData.exteriorColor}
                        onChange={handleAddChange}
                        placeholder="e.g., Silver"
                        className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Interior Color</label>
                      <input
                        type="text"
                        name="interiorColor"
                        value={addFormData.interiorColor}
                        onChange={handleAddChange}
                        placeholder="e.g., Black"
                        className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-4 border-b pb-2">Description & Features</h3>
                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Equipment</label>
                      <textarea
                        name="equipment"
                        rows={2}
                        value={addFormData.equipment}
                        onChange={handleAddChange}
                        placeholder="e.g., A3 40 KOMFORT AWD SEDAN"
                        className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent"
                      ></textarea>
                      <p className="mt-1 text-xs text-gray-500">Full equipment description from EDC inventory</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                      <textarea
                        name="description"
                        value={addFormData.description}
                        onChange={handleAddChange}
                        rows={4}
                        className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Features (comma-separated)</label>
                      <textarea
                        name="features"
                        value={addFormData.features}
                        onChange={handleAddChange}
                        rows={3}
                        placeholder="Bluetooth, Backup Camera, Sunroof"
                        className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    disabled={addSubmitting}
                    className="px-5 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={addSubmitting}
                    className="bg-[#118df0] text-white px-6 py-2 rounded-lg font-semibold hover:bg-[#0d6ebd] transition-colors disabled:opacity-50"
                  >
                    {addSubmitting ? 'Creating…' : 'Create Vehicle & Add Photos'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
