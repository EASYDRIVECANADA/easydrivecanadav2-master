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
  salePrice?: any
  mileage: number
  status: string
  inventoryType: string
  images: string[]
  photos?: string[]
  keyNumber?: string
  vin?: string
  createdAt: string
  updatedAt?: string
  series?: string
  equipment?: string
  fuelType?: string
  transmission?: string
  bodyStyle?: string
  drivetrain?: string
  city?: string
  province?: string
  exteriorColor?: string
  interiorColor?: string
  description?: string
  features?: string[]
  costsData?: any
  purchaseData?: any
  cylinders?: string
  odometer?: number
  odometerUnit?: string
  condition?: string
  certified?: string
  raw?: any
}

export default function AdminInventoryPage() {
  const STATUS_OPTIONS = [
    'In Stock',
    'In Stock (No Feed)',
    'Coming Soon',
    'In Trade',
    'Deal Pending',
    'Sold',
    'Void',
    'Other',
  ] as const

  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [filteredVehicles, setFilteredVehicles] = useState<Vehicle[]>([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [inventoryTypeFilter, setInventoryTypeFilter] = useState<'' | 'FLEET' | 'PREMIERE'>('')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalVehicles, setTotalVehicles] = useState(0)
  const [statusFilter, setStatusFilter] = useState<Set<string>>(new Set())
  const [statusFilterOpen, setStatusFilterOpen] = useState(false)
  const [itemsPerPage, setItemsPerPage] = useState(10)
  const [showAddModal, setShowAddModal] = useState(false)
  const [addSubmitting, setAddSubmitting] = useState(false)
  const [addError, setAddError] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [modalOpen, setModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState<'confirm' | 'alert'>('alert')
  const [modalTitle, setModalTitle] = useState('')
  const [modalMessage, setModalMessage] = useState('')
  const [modalBusy, setModalBusy] = useState(false)
  const [modalOnConfirm, setModalOnConfirm] = useState<(() => Promise<void> | void) | null>(null)
  const [scopedUserId, setScopedUserId] = useState<string | null>(null)
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
  const router = useRouter()
  const [drawerVehicle, setDrawerVehicle] = useState<Vehicle | null>(null)
  const closeDrawer = () => setDrawerVehicle(null)
  const [drawerCosts, setDrawerCosts] = useState<any>({
    purchasePrice: 0,
    actualCashValue: 0,
    additionalExpenses: 0,
    taxTotal: 0,
  })

  const parseCostsData = (val: any) => {
    if (!val) return undefined
    if (typeof val === 'string') {
      try {
        return JSON.parse(val)
      } catch {
        return undefined
      }
    }
    return val
  }

  const parsePurchaseData = (val: any) => {
    if (!val) return undefined
    if (typeof val === 'string') {
      try {
        return JSON.parse(val)
      } catch {
        return undefined
      }
    }
    return val
  }

  const getLoggedInAdminDbUserId = async (): Promise<string | null> => {
    try {
      if (typeof window === 'undefined') return null
      const raw = window.localStorage.getItem('edc_admin_session')
      if (!raw) return null
      const parsed = JSON.parse(raw) as { email?: string }
      const email = String(parsed?.email ?? '').trim().toLowerCase()
      if (!email) return null

      const { data, error } = await supabase
        .from('edc_account_verifications')
        .select('id')
        .eq('email', email)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (error) return null
      return (data as any)?.id ?? null
    } catch {
      return null
    }
  }

  const normalizeStatus = (raw: any) => {
    const s = String(raw ?? '').trim()
    const upper = s.toUpperCase()
    if (upper === 'ACTIVE') return 'In Stock'
    if (upper === 'PENDING') return 'Deal Pending'
    if (upper === 'SOLD') return 'Sold'
    return s
  }

  const fetchDrawerPurchase = async (stockNumber?: string) => {
    try {
      if (!stockNumber) return
      const { data, error } = await supabase
        .from('edc_purchase')
        .select('purchase_price, actual_cash_value')
        .eq('stock_number', stockNumber)
        .order('updated_at', { ascending: false })
        .limit(1)
        .single()
      if (error) {
        console.error('Failed to fetch purchase values:', error)
        return
      }
      const price = Number(data?.purchase_price || 0)
      const acv = Number(data?.actual_cash_value || 0)
      setDrawerCosts((prev: any) => ({
        ...prev,
        purchasePrice: isNaN(price) ? 0 : price,
        actualCashValue: isNaN(acv) ? 0 : acv,
      }))
    } catch (err) {
      console.error('Error fetching purchase values:', err)
    }
  }

  const fetchDrawerCosts = async (stockNumber?: string) => {
    if (!stockNumber) return
    try {
      const { data, error } = await supabase
        .from('edc_costs')
        .select('*')
        .eq('stock_number', stockNumber)
        .order('created_at', { ascending: true })

      if (!error && Array.isArray(data)) {
        const additionalTotal = data.reduce((sum, r: any) => {
          const total = parseFloat(r.total ?? '0') || 0
          return sum + total
        }, 0)
        const taxTotal = data.reduce((sum, r: any) => {
          const tax = parseFloat(r.tax ?? '0') || 0
          return sum + tax
        }, 0)
        setDrawerCosts((prev: any) => ({ ...prev, additionalExpenses: additionalTotal, taxTotal }))
      }
    } catch (err) {
      console.error('Error fetching edc_costs by stock number:', err)
    }
  }

  useEffect(() => {
    const stock = drawerVehicle?.stockNumber
    if (!stock) return
    setDrawerCosts({
      purchasePrice: 0,
      actualCashValue: 0,
      additionalExpenses: 0,
      taxTotal: 0,
    })
    fetchDrawerPurchase(stock)
    fetchDrawerCosts(stock)

    const ch1 = supabase
      .channel(`drawer-costs-${stock}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'edc_costs', filter: `stock_number=eq.${stock}` }, () => {
        fetchDrawerCosts(stock)
      })
      .subscribe()

    const ch2 = supabase
      .channel(`drawer-purchase-${stock}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'edc_purchase', filter: `stock_number=eq.${stock}` }, () => {
        fetchDrawerPurchase(stock)
      })
      .subscribe()

    return () => {
      supabase.removeChannel(ch1)
      supabase.removeChannel(ch2)
    }
  }, [drawerVehicle?.id, drawerVehicle?.stockNumber])

  useEffect(() => {
    // Check auth
    const sessionStr = localStorage.getItem('edc_admin_session')
    if (!sessionStr) {
      router.push('/admin')
      return
    }
    const boot = async () => {
      const uid = await getLoggedInAdminDbUserId()
      setScopedUserId(uid)
      await fetchVehicles(uid)
    }
    void boot()
  }, [])

  const handleOpenAddModal = () => {
    // Navigate to the new tabbed Add Vehicle page
    router.push('/admin/inventory/new')
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
          user_id: scopedUserId,
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

  const fetchVehicles = async (userId: string | null) => {
    setLoading(true)
    try {
      let q = supabase
        .from('edc_vehicles')
        .select('*')
        // Order by stock_number descending so the most recent is on top
        // Note: stock_number is stored as text; server-side order will be lexicographic.
        // We'll enforce a numeric sort on the client after mapping as a reliable fallback.
        .order('stock_number', { ascending: false })

      if (userId) {
        q = q.eq('user_id', userId)
      }

      const { data, error } = await q

      if (error) throw error

      // Debug: Inspect a few rows to verify fields coming from Supabase
      if (process.env.NODE_ENV !== 'production') {
        try {
          // Log first three rows and selected fields
          // eslint-disable-next-line no-console
          console.log('edc_vehicles sample:', (data || []).slice(0, 3).map((r: any) => ({
            id: r.id,
            trim: r.trim,
            body_style: r.body_style,
            drivetrain: r.drivetrain,
            transmission: r.transmission,
            exterior_color: r.exterior_color,
            city: r.city,
            province: r.province,
          })))
        } catch {}
      }

      const safe = (s: any) => typeof s === 'string' ? s.trim() : s
      const mapped: Vehicle[] = (data || []).map((v: any) => ({
        id: v.id,
        make: safe(v.make),
        model: safe(v.model),
        year: v.year,
        trim: safe(v.trim) || undefined,
        stockNumber: safe(v.stock_number) || '',
        price: v.price,
        salePrice: (v as any).saleprice ?? (v as any).sale_price ?? undefined,
        mileage: v.mileage,
        status: safe(v.status),
        inventoryType: safe(v.inventory_type) || safe((v as any).vehicle_type),
        images: normalizeImages(v.images),
        keyNumber: safe(v.key_number) || undefined,
        vin: safe(v.vin) || undefined,
        createdAt: v.created_at,
        updatedAt: v.updated_at || undefined,
        series: safe(v.series) || undefined,
        equipment: safe(v.equipment) || undefined,
        fuelType: safe(v.fuel_type) || undefined,
        transmission: safe(v.transmission) || safe((v as any).gearbox) || undefined,
        bodyStyle: safe(v.body_style) || safe((v as any).vehicle_type) || undefined,
        drivetrain: safe(v.drivetrain) || safe((v as any).drive) || undefined,
        city: safe(v.city) || undefined,
        province: safe(v.province) || undefined,
        exteriorColor: safe(v.exterior_color) || safe((v as any).colour) || safe((v as any).color) || undefined,
        interiorColor: safe(v.interior_color) || undefined,
        description: safe(v.description) || undefined,
        features: Array.isArray(v.features) ? v.features : undefined,
        costsData: parseCostsData((v as any).costs_data),
        purchaseData: parsePurchaseData((v as any).purchase_data),
        cylinders: safe((v as any).cylinders) || undefined,
        odometer: typeof (v as any).odometer === 'number' ? (v as any).odometer : Number((v as any).odometer) || undefined,
        odometerUnit: safe((v as any).odometer_unit) || undefined,
        condition: safe((v as any).condition) || undefined,
        certified: safe((v as any).certified) || undefined,
        raw: v,
      }))

      // Ensure final ordering by numeric stock number desc (recent on top)
      const toNum = (s: string) => {
        const n = parseInt((s || '').replace(/[^0-9]/g, ''), 10)
        return Number.isFinite(n) ? n : -Infinity
      }
      const sorted = [...mapped].sort((a, b) => toNum(b.stockNumber) - toNum(a.stockNumber))

      setVehicles(sorted)
      setTotalVehicles(sorted.length)
      setFilteredVehicles(sorted)
      setCurrentPage(1)

      if (statusFilter.size === 0) {
        setStatusFilter(new Set(STATUS_OPTIONS as unknown as string[]))
      }
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

    if (statusFilter.size > 0 && statusFilter.size < STATUS_OPTIONS.length) {
      const known = new Set<string>(STATUS_OPTIONS.filter((s) => s !== 'Other') as unknown as string[])
      filtered = filtered.filter((vehicle) => {
        const normalized = normalizeStatus(vehicle.status)
        if (statusFilter.has(normalized)) return true
        if (statusFilter.has('Other') && normalized && !known.has(normalized)) return true
        return false
      })
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
  }, [searchQuery, inventoryTypeFilter, vehicles, statusFilter])

  // Get paginated vehicles
  const paginatedVehicles = filteredVehicles.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  )
  
  const totalPages = Math.ceil(totalVehicles / itemsPerPage)

  const allStatusOptions = [...STATUS_OPTIONS]

  const toggleStatus = (s: string, checked: boolean) => {
    setStatusFilter(prev => {
      const next = new Set(prev)
      if (checked) next.add(s)
      else next.delete(s)
      return next
    })
  }

  const selectedStatusLabel = (() => {
    if (statusFilter.size === 0) return 'Status'
    if (statusFilter.size === allStatusOptions.length) return 'Status'
    return `${statusFilter.size} Selected`
  })()

  const getDaysInInventory = (v: Vehicle) => {
    const raw = (v as any).inStockDate || (v as any).in_stock_date || v.createdAt
    const d = raw ? new Date(String(raw)) : null
    if (!d || Number.isNaN(d.getTime())) return '—'
    const now = new Date()
    const diff = Math.max(0, now.getTime() - d.getTime())
    return String(Math.floor(diff / (1000 * 60 * 60 * 24)))
  }

  const formatMoney = (n: any) => {
    const num = Number(n || 0)
    if (Number.isNaN(num)) return '$0.00'
    return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', minimumFractionDigits: 2 }).format(num)
  }

  const formatPrice = (n: number) =>
    (Number.isFinite(n) ? Number(n) : 0).toLocaleString('en-CA', {
      style: 'currency',
      currency: 'CAD',
      maximumFractionDigits: 0,
    })

  const normalizeImages = (raw: any): string[] => {
    if (!raw) return []
    if (Array.isArray(raw)) return raw.map(String).filter(Boolean)
    if (typeof raw === 'string') {
      const s = raw.trim()
      if (!s) return []
      try {
        const parsed = JSON.parse(s)
        if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean)
      } catch {
        // ignore
      }
      return s
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean)
    }
    return []
  }

  const toImageSrc = (value: any) => {
    const v = typeof value === 'string' ? value.trim() : String(value ?? '').trim()
    if (!v) return ''
    if (v.startsWith('http://') || v.startsWith('https://') || v.startsWith('data:')) return v
    const head = v.slice(0, 10)
    let mime = 'image/jpeg'
    if (head.startsWith('iVBOR')) mime = 'image/png'
    else if (head.startsWith('R0lGOD')) mime = 'image/gif'
    else if (head.startsWith('UklGR')) mime = 'image/webp'
    return `data:${mime};base64,${v}`
  }

  const allSelected = selectedIds.size > 0 && filteredVehicles.length > 0 && selectedIds.size === filteredVehicles.length
  const toggleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(filteredVehicles.map(v => v.id)))
    } else {
      setSelectedIds(new Set())
    }
  }
  const toggleSelect = (id: string, checked: boolean) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  const closeModal = () => {
    if (modalBusy) return
    setModalOpen(false)
    setModalOnConfirm(null)
    setModalTitle('')
    setModalMessage('')
    setModalMode('alert')
  }

  const openAlert = (title: string, message: string) => {
    setModalMode('alert')
    setModalTitle(title)
    setModalMessage(message)
    setModalOnConfirm(null)
    setModalOpen(true)
  }

  const openConfirm = (title: string, message: string, onConfirm: () => Promise<void> | void) => {
    setModalMode('confirm')
    setModalTitle(title)
    setModalMessage(message)
    setModalOnConfirm(() => onConfirm)
    setModalOpen(true)
  }

  const performDelete = async (vehicle: Vehicle) => {
    setDeleting(vehicle.id)
    try {
      const stockNumber = String(vehicle.stockNumber || '').trim()

      if (stockNumber) {
        const { error: costsError } = await supabase.from('edc_costs').delete().eq('stock_number', stockNumber)
        if (costsError) throw costsError

        const { error: disclosuresError } = await supabase.from('edc_disclosures').delete().eq('stock_number', stockNumber)
        if (disclosuresError) throw disclosuresError

        const { error: purchaseByStockError } = await supabase.from('edc_purchase').delete().eq('stock_number', stockNumber)
        if (purchaseByStockError) throw purchaseByStockError
      }

      const { error: purchaseByIdError } = await supabase.from('edc_purchase').delete().eq('id', vehicle.id)
      if (purchaseByIdError) throw purchaseByIdError

      const { error: vehicleError } = await supabase.from('edc_vehicles').delete().eq('id', vehicle.id)
      if (vehicleError) throw vehicleError

      setVehicles((prev) => prev.filter((v) => v.id !== vehicle.id))
      setFilteredVehicles((prev) => prev.filter((v) => v.id !== vehicle.id))
      setSelectedIds((prev) => {
        const next = new Set(prev)
        next.delete(vehicle.id)
        return next
      })
      if (drawerVehicle?.id === vehicle.id) closeDrawer()
    } catch (error) {
      console.error('Error deleting vehicle:', error)
      openAlert('Delete failed', 'Failed to delete vehicle')
    } finally {
      setDeleting(null)
    }
  }

  const handleDelete = (vehicle: Vehicle) => {
    openConfirm('Confirm delete', 'Are you sure you want to delete this vehicle and all related records?', async () => {
      setModalBusy(true)
      try {
        await performDelete(vehicle)
        closeModal()
      } finally {
        setModalBusy(false)
      }
    })
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

      {/* Right Drawer */}
      {drawerVehicle && (
        <div className="fixed inset-y-0 right-0 w-full sm:w-[440px] bg-white shadow-2xl z-50 flex flex-col">
          {/* Enhanced Header */}
          <div className="px-5 pt-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10"></div>
              <button onClick={closeDrawer} className="p-2 rounded hover:bg-gray-100" aria-label="Close">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>
            <div className="flex flex-col items-center gap-2 mt-1 mb-3">
              {(() => {
                const first = Array.isArray((drawerVehicle as any).images) ? (drawerVehicle as any).images[0] : undefined
                const src = toImageSrc(first)
                if (src) {
                  return (
                    <div className="w-20 h-20 rounded-full bg-gray-100 overflow-hidden">
                      <img src={src} alt="Vehicle" className="w-full h-full object-cover" />
                    </div>
                  )
                }
                return (
                  <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center text-gray-400">
                    <svg className="w-9 h-9" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                  </div>
                )
              })()}
              <div className="self-end mr-3 -mt-6">
                <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-blue-100 text-blue-700">{drawerVehicle.status || 'In Stock'}</span>
              </div>
              <h3 className="text-xl font-bold text-red-600 text-center leading-snug">
                {drawerVehicle.year} {drawerVehicle.make} {drawerVehicle.model}
              </h3>
              <div className="text-xs text-gray-500 text-center">
                <div>{drawerVehicle.vin || '—'}</div>
                <div className="flex items-center justify-center gap-2">
                  <span>{drawerVehicle.stockNumber || '—'}</span>
                  <span>Certified</span>
                  <a href={`/admin/inventory/${drawerVehicle.id}`} className="text-blue-600 hover:underline" onClick={(e)=>e.stopPropagation()}>✎</a>
                </div>
                <div className="text-sm font-semibold mt-1">{formatPrice(Number(drawerVehicle.price || 0))}</div>
              </div>
            </div>
          </div>

          <div className="p-5 overflow-y-auto">
            <h4 className="text-base font-semibold text-gray-900 mb-4 text-center">Profit Analysis</h4>
            {(() => {
              const purchasePrice = Number(drawerCosts.purchasePrice || 0)
              const acv = Number(drawerCosts.actualCashValue || 0)
              const additionalExpenses = Number(drawerCosts.additionalExpenses || 0)
              const totalInvested = purchasePrice + additionalExpenses - acv
              const selling = Number(drawerVehicle.price || 0)
              const taxRate = 0.13 // HST 13%
              const tax = selling * taxRate
              const allInPrice = selling + tax
              const profit = selling - totalInvested
              
              //// Pie chart calculations - show breakdown of total invested
              const circumference = 2 * Math.PI * 35
              const netPurchase = purchasePrice - acv
              // Include positive profit in the donut so a green segment appears when profitable.
              const positiveProfit = profit > 0 ? profit : 0
              const chartTotal = netPurchase + additionalExpenses + positiveProfit
              
              const purchasePercent = chartTotal > 0 ? (netPurchase / chartTotal) * 100 : 0
              const expensesPercent = chartTotal > 0 ? (additionalExpenses / chartTotal) * 100 : 0
              const profitPercent = chartTotal > 0 ? (positiveProfit / chartTotal) * 100 : 0
              
              const purchaseDash = (purchasePercent / 100) * circumference
              const expensesDash = (expensesPercent / 100) * circumference
              const profitDash = (profitPercent / 100) * circumference
              
              return (
                <div className="space-y-4">
                  <div className="flex items-center justify-center gap-4">
                    <svg viewBox="0 0 100 100" className="w-40 h-40 -rotate-90">
                      {/* Blue segment - Purchase (net of ACV) */}
                      <circle 
                        cx="50" cy="50" r="35" 
                        fill="transparent" 
                        stroke="#2563eb" 
                        strokeWidth="20" 
                        strokeDasharray={`${purchaseDash} ${circumference}`}
                        strokeDashoffset="0"
                      />
                      {/* Red segment - Expenses */}
                      <circle 
                        cx="50" cy="50" r="35" 
                        fill="transparent" 
                        stroke="#dc2626" 
                        strokeWidth="20" 
                        strokeDasharray={`${expensesDash} ${circumference}`}
                        strokeDashoffset={`-${purchaseDash}`}
                      />
                      {/* Green segment - Profit (only when positive) */}
                      {profit > 0 && (
                        <circle 
                          cx="50" cy="50" r="35" 
                          fill="transparent" 
                          stroke="#16a34a" 
                          strokeWidth="20" 
                          strokeDasharray={`${profitDash} ${circumference}`}
                          strokeDashoffset={`-${purchaseDash + expensesDash}`}
                        />
                      )}
                    </svg>
                  </div>
                  <div className="flex justify-center gap-4 text-xs">
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 rounded-full bg-blue-600"></div>
                      <span>Purchase</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 rounded-full bg-red-600"></div>
                      <span>Expenses</span>
                    </div>
                    {profit > 0 && (
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-3 rounded-full bg-green-600"></div>
                        <span>Profit</span>
                      </div>
                    )}
                  </div>
                  <div className="text-center text-sm text-gray-600">Selling: {formatPrice(selling)}</div>
                  <div className="space-y-2 text-[15px]">
                    <div className="flex justify-between text-gray-700"><span className="font-medium text-gray-600">Vehicle Purchase Price:</span><span>{formatPrice(purchasePrice)}</span></div>
                    <div className="flex justify-between text-gray-700"><span className="font-medium text-gray-600">Actual Cash Value:</span><span>{formatPrice(acv)}</span></div>
                    <div className="flex justify-between text-gray-700"><span className="font-medium text-gray-600">Additional Expenses:</span><span>{formatPrice(additionalExpenses)}</span></div>
                    <div className="flex justify-between text-gray-900"><span className="font-semibold">Total Invested:</span><span className="font-semibold">{formatPrice(totalInvested)}</span></div>
                    <div className="flex justify-between text-gray-700"><span className="font-medium text-gray-600">Vehicle Selling Price:</span><span>{formatPrice(selling)}</span></div>
                    <div className="flex justify-between text-gray-700"><span className="font-medium text-gray-600">Tax:</span><span>{formatPrice(tax)}</span></div>
                    <div className="flex justify-between text-gray-900"><span className="font-bold">All In Price:</span><span className="font-bold">{formatPrice(allInPrice)}</span></div>
                    <div className={`flex justify-between font-bold ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}><span>Profit:</span><span>{formatPrice(profit)}</span></div>
                  </div>
                </div>
              )
            })()}
          </div>
        </div>
      )}
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
        {/* Search / Filters / Page size */}
        <div className="bg-white rounded-xl shadow p-4 mb-6">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3 flex-1 min-w-[320px]">
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search inventory"
                  className="w-full border border-gray-300 rounded-lg pl-10 pr-4 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent"
                />
                <svg className="absolute left-3 top-2.5 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>

              <div className="relative">
                <button
                  type="button"
                  onClick={() => setStatusFilterOpen((v) => !v)}
                  className="inline-flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                  {selectedStatusLabel}
                  <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {statusFilterOpen && (
                  <div className="absolute z-20 mt-2 w-56 bg-white border border-gray-200 rounded-lg shadow-lg p-3">
                    <div className="text-xs font-semibold text-gray-500 mb-2">Filter by Status</div>
                    <div className="max-h-56 overflow-auto space-y-2">
                      {allStatusOptions.map((s) => (
                        <label key={s} className="flex items-center gap-2 text-sm text-gray-700">
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-gray-300 text-[#118df0] focus:ring-[#118df0]"
                            checked={statusFilter.has(s)}
                            onChange={(e) => toggleStatus(s, e.target.checked)}
                          />
                          <span>{s}</span>
                        </label>
                      ))}
                    </div>
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                      <button
                        type="button"
                        onClick={() => setStatusFilter(new Set(allStatusOptions))}
                        className="text-xs text-gray-600 hover:text-gray-900"
                      >
                        Select All
                      </button>
                      <button
                        type="button"
                        onClick={() => setStatusFilter(new Set())}
                        className="text-xs text-gray-600 hover:text-gray-900"
                      >
                        Clear
                      </button>
                      <button
                        type="button"
                        onClick={() => setStatusFilterOpen(false)}
                        className="text-xs text-[#118df0] hover:text-[#0d6ebd] font-medium"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <select
                value={itemsPerPage}
                onChange={(e) => {
                  setItemsPerPage(parseInt(e.target.value, 10) || 10)
                  setCurrentPage(1)
                }}
                className="border border-gray-300 rounded-lg px-2 py-2 text-sm text-gray-700 bg-white"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
              <div className="text-sm text-gray-600 font-medium">
                Total Inventory: {totalVehicles}
              </div>
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
            <div className="hidden lg:block bg-white rounded-xl shadow overflow-hidden">
              <table className="min-w-full w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-center text-sm font-bold text-gray-700 uppercase tracking-wider sticky left-0 bg-white z-10">
                      <div className="flex items-center justify-center gap-2">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-gray-300 text-[#118df0] focus:ring-[#118df0]"
                          checked={allSelected}
                          onChange={(e) => toggleSelectAll(e.target.checked)}
                          aria-label="Select all"
                        />
                        <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a2 2 0 012-2h6a2 2 0 012 2v13a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm10 0h4a2 2 0 012 2v11a2 2 0 01-2 2h-4V5z" />
                        </svg>
                      </div>
                    </th>
                    <th className="px-3 py-2 text-left text-sm font-bold text-gray-700 uppercase tracking-wider">Description</th>
                    <th className="px-3 py-2 text-left text-sm font-bold text-gray-700 uppercase tracking-wider">Trim</th>
                    <th className="px-3 py-2 text-left text-sm font-bold text-gray-700 uppercase tracking-wider leading-tight">
                      Vehicle<br />Type
                    </th>
                    <th className="px-3 py-2 text-left text-sm font-bold text-gray-700 uppercase tracking-wider">Drive</th>
                    <th className="px-3 py-2 text-left text-sm font-bold text-gray-700 uppercase tracking-wider leading-tight">
                      Trans-
                      <br />mission
                    </th>
                    <th className="px-3 py-2 text-left text-sm font-bold text-gray-700 uppercase tracking-wider">Cylinders</th>
                    <th className="px-3 py-2 text-left text-sm font-bold text-gray-700 uppercase tracking-wider">Colour</th>
                    <th className="px-3 py-2 text-left text-sm font-bold text-gray-700 uppercase tracking-wider">Odometer</th>
                    <th className="px-3 py-2 text-left text-sm font-bold text-gray-700 uppercase tracking-wider leading-tight">
                      Actual Cash<br />Value
                    </th>
                    <th className="px-3 py-2 text-left text-sm font-bold text-gray-700 uppercase tracking-wider">List Price</th>
                    <th className="px-3 py-2 text-left text-sm font-bold text-gray-700 uppercase tracking-wider leading-tight">
                      Sale<br />Price
                    </th>
                    <th className="px-3 py-2 text-left text-sm font-bold text-gray-700 uppercase tracking-wider">DII</th>
                    <th className="px-3 py-2 text-left text-sm font-bold text-gray-700 uppercase tracking-wider">Stock #</th>
                    <th className="px-3 py-2 text-left text-sm font-bold text-gray-700 uppercase tracking-wider">Key #</th>
                    <th className="px-3 py-2 text-left text-sm font-bold text-gray-700 uppercase tracking-wider leading-tight">
                      Cert/
                      <br />AS-IS
                    </th>
                    <th className="px-3 py-2 text-left text-sm font-bold text-gray-700 uppercase tracking-wider">Status</th>
                    <th className="px-3 py-2 text-left text-sm font-bold text-gray-700 uppercase tracking-wider">Other</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {paginatedVehicles.map((vehicle) => (
                  <tr key={vehicle.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setDrawerVehicle(vehicle)}>
                    <td className="px-3 py-2 whitespace-nowrap text-center sticky left-0 bg-white z-10">
                      <div className="flex items-center justify-center gap-2">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-gray-300 text-[#118df0] focus:ring-[#118df0]"
                          aria-label={`Select ${vehicle.year} ${vehicle.make} ${vehicle.model}`}
                          checked={selectedIds.has(vehicle.id)}
                          onChange={(e) => toggleSelect(vehicle.id, e.target.checked)}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <Link
                          href={`/admin/inventory/${vehicle.id}`}
                          className="p-1.5 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                          title="Edit vehicle"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </Link>

                        <button
                          type="button"
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                          title="Delete vehicle"
                          onClick={(e) => {
                            e.stopPropagation()
                            void handleDelete(vehicle)
                          }}
                          disabled={deleting === vehicle.id}
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
                    <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-900">
                      {vehicle.year} {vehicle.make} {vehicle.model}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-500">{vehicle.trim || '—'}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-500">{vehicle.bodyStyle || vehicle.inventoryType || '—'}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-500">{vehicle.drivetrain || '—'}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-500">{vehicle.transmission || '—'}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-500">{vehicle.cylinders || '—'}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-500">{vehicle.exteriorColor || '—'}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-500">
                      {typeof vehicle.odometer === 'number' ? vehicle.odometer.toLocaleString() : '—'} {vehicle.odometerUnit || ''}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-900">
                      {formatMoney((vehicle.purchaseData as any)?.actualCashValue ?? (vehicle.purchaseData as any)?.actual_cash_value ?? 0)}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-900">{formatMoney(vehicle.price)}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-900">
                      {formatMoney(vehicle.salePrice ?? (vehicle.costsData as any)?.salePrice ?? (vehicle.costsData as any)?.sale_price ?? 0)}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-500">{getDaysInInventory(vehicle)}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-500">{vehicle.stockNumber || '—'}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-500">{vehicle.keyNumber || '—'}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-500">
                      {vehicle.certified || vehicle.condition || '—'}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-gray-100 text-gray-800">
                        {vehicle.status || '—'}
                      </span>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-500">
                      {(vehicle as any).raw?.assignment || (vehicle as any).raw?.substatus || (vehicle as any).raw?.lot_location || '—'}
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
                        src={toImageSrc(vehicle.images[0])}
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
                    onClick={() => handleDelete(vehicle)}
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

      {modalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={closeModal}></div>
          <div className="relative w-[92vw] max-w-md rounded-2xl bg-white shadow-xl border border-gray-200">
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="text-base font-semibold text-gray-900">{modalTitle}</h3>
            </div>
            <div className="px-5 py-4">
              <p className="text-sm text-gray-700 whitespace-pre-line">{modalMessage}</p>
            </div>
            <div className="px-5 py-4 border-t border-gray-100 flex items-center justify-end gap-2">
              {modalMode === 'confirm' ? (
                <>
                  <button
                    type="button"
                    className="px-4 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50"
                    onClick={closeModal}
                    disabled={modalBusy}
                  >
                    No
                  </button>
                  <button
                    type="button"
                    className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50"
                    onClick={async () => {
                      if (!modalOnConfirm) return
                      await modalOnConfirm()
                    }}
                    disabled={modalBusy}
                  >
                    {modalBusy ? 'Deleting…' : 'Yes'}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-[#118df0] hover:bg-[#0a7dd4] disabled:opacity-50"
                  onClick={closeModal}
                  disabled={modalBusy}
                >
                  OK
                </button>
              )}
            </div>
          </div>
        </div>
      )}

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
