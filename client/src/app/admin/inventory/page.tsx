'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
import * as XLSX from 'xlsx-js-style'

const VEHICLE_LIMITS: Record<string, number> = {
  'private': 1,
  'private seller': 1,
  'small dealership': 49,
  'medium dealership': 99,
  'large dealership': 199,
  'premier': Infinity,
}

const ROLE_DISPLAY: Record<string, string> = {
  'private': 'Private Seller',
  'private seller': 'Private Seller',
  'small dealership': 'Small Dealer',
  'medium dealership': 'Medium Dealer',
  'large dealership': 'Large Dealer',
  'premier': 'Premier',
}

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
  category?: string
  vehicleType?: string
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
  // Premier-only category tabs (based on vehicles.categories)
  const [categoryTab, setCategoryTab] = useState<'' | 'premier' | 'fleet'>('')
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
  const [bucketImageCache] = useState(() => new Map<string, string[]>())
  const [accountRole, setAccountRole] = useState<string>('')
  const [canAddVehicle, setCanAddVehicle] = useState(true)
  const [addGateLoading, setAddGateLoading] = useState(false)
  const [addGateReason, setAddGateReason] = useState('')
  const [importing, setImporting] = useState(false)
  const importInputRef = useRef<HTMLInputElement | null>(null)
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

  const vehicleLimit = useMemo(() => {
    const r = String(accountRole || '').trim().toLowerCase()
    if (r === 'admin' || r === 'premier') return Infinity
    return VEHICLE_LIMITS[r] ?? 1
  }, [accountRole])

  const currentVehicleCount = useMemo(() => vehicles.length, [vehicles])

  const usageRatio = useMemo(() => {
    if (vehicleLimit === Infinity) return 0
    if (vehicleLimit === 0) return 1
    return currentVehicleCount / vehicleLimit
  }, [currentVehicleCount, vehicleLimit])

  const usageColor = useMemo(() => {
    if (usageRatio >= 1) return 'text-red-600'
    if (usageRatio >= 0.7) return 'text-orange-500'
    return 'text-green-600'
  }, [usageRatio])

  const usageBgColor = useMemo(() => {
    if (usageRatio >= 1) return 'bg-red-50 border-red-200'
    if (usageRatio >= 0.7) return 'bg-orange-50 border-orange-200'
    return 'bg-green-50 border-green-200'
  }, [usageRatio])

  const planDisplayName = useMemo(() => {
    const r = String(accountRole || '').trim().toLowerCase()
    return ROLE_DISPLAY[r] || 'Private Seller'
  }, [accountRole])
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
      const parsed = JSON.parse(raw) as { email?: string; user_id?: string; role?: string }
      const sessionUserId = String(parsed?.user_id ?? '').trim()
      const sessionEmail = String(parsed?.email ?? '').trim().toLowerCase()

      // If the logged-in user is an admin (users.role === 'admin'), do NOT scope inventory
      try {
        const { data: roleById } = sessionUserId
          ? await supabase.from('users').select('role').eq('user_id', sessionUserId).maybeSingle()
          : ({ data: null } as any)
        const { data: roleByEmail } = !roleById?.role && sessionEmail
          ? await supabase.from('users').select('role').eq('email', sessionEmail).maybeSingle()
          : ({ data: null } as any)
        const r = String((roleById as any)?.role ?? (roleByEmail as any)?.role ?? '').trim().toLowerCase()
        if (r === 'admin') return null
      } catch {
        // ignore
      }

      if (sessionUserId) return sessionUserId

      if (!sessionEmail) return null

      const { data, error } = await supabase
        .from('edc_account_verifications')
        .select('id')
        .eq('email', sessionEmail)
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
        .limit(1)
      if (error) {
        console.error('Failed to fetch purchase values:', error)
        return
      }
      const row = Array.isArray(data) ? data[0] : data
      if (!row) return
      const price = Number(row.purchase_price || 0)
      const acv = Number(row.actual_cash_value || 0)
      setDrawerCosts((prev: any) => ({
        ...prev,
        purchasePrice: isNaN(price) ? 0 : price,
        actualCashValue: isNaN(acv) ? 0 : acv,
      }))
    } catch (err) {
      console.error('Error fetching purchase values:', err)
    }
  }

  const fetchDrawerCosts = async (vehicleId?: string, stockNumber?: string) => {
    const toNumber = (val: any) => {
      const cleaned = String(val ?? '0').replace(/[^0-9.-]/g, '')
      const num = Number(cleaned)
      return Number.isFinite(num) ? num : 0
    }

    const runQuery = async (filters: Record<string, any>) => {
      const { data, error } = await supabase
        .from('edc_costs')
        .select('*')
        .match(filters)
        .order('created_at', { ascending: true })
      if (error || !Array.isArray(data)) return null
      return data
    }

    try {
      let rows: any[] | null = null
      if (vehicleId) {
        rows = await runQuery({ vehicle_id: vehicleId })
        // Some schemas store vehicleId directly in edc_costs.id
        if (!rows) {
          rows = await runQuery({ id: vehicleId })
        }
      }
      if (!rows && stockNumber) {
        rows = await runQuery({ stock_number: stockNumber })
      }
      if (!rows) {
        // fallback: try vehicle costs_data
        try {
          const { data } = await supabase
            .from('edc_vehicles')
            .select('costs_data')
            .eq('id', vehicleId || '')
            .maybeSingle()
          if (data?.costs_data) {
            const incoming = typeof data.costs_data === 'string' ? JSON.parse(data.costs_data) : data.costs_data
            const add = toNumber(incoming?.additionalExpenses ?? incoming?.additionalExpensesTotal)
            setDrawerCosts((prev: any) => ({ ...prev, additionalExpenses: add, taxTotal: 0 }))
          }
        } catch {}
        return
      }

      const additionalTotal = rows.reduce((sum, r: any) => {
        const price = toNumber((r as any).amount ?? (r as any).price)
        const qty = toNumber((r as any).quantity ?? (r as any).qty ?? 1)
        const discount = toNumber((r as any).discount)
        const tax = toNumber((r as any).tax)
        const totalField = toNumber((r as any).total)
        const computed = Math.max(0, price * qty - discount + tax)
        const total = totalField || computed
        return sum + total
      }, 0)

      const taxTotal = rows.reduce((sum, r: any) => sum + toNumber((r as any).tax), 0)
      setDrawerCosts((prev: any) => ({ ...prev, additionalExpenses: additionalTotal, taxTotal }))
    } catch (err) {
      console.error('Error fetching edc_costs for drawer:', err)
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
    fetchDrawerCosts(drawerVehicle?.id, stock)

    const ch1 = supabase
      .channel(`drawer-costs-${stock}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'edc_costs', filter: `stock_number=eq.${stock}` }, () => {
        fetchDrawerCosts(drawerVehicle?.id, stock)
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
      await checkCanAddVehicle(uid)
      await fetchVehicles(uid)
    }
    void boot()
  }, [])

  const checkCanAddVehicle = async (userId: string | null) => {
    try {
      setAddGateLoading(true)
      setAddGateReason('')
      setCanAddVehicle(true)

      // If user is an admin, skip restrictions
      try {
        const sessionStr = typeof window !== 'undefined' ? window.localStorage.getItem('edc_admin_session') : null
        const parsed = sessionStr ? (JSON.parse(sessionStr) as any) : null
        const sessionEmail = String(parsed?.email || '').trim().toLowerCase()
        const sessionUserId = String(parsed?.user_id || '').trim()

        const { data: roleByIdArr } = sessionUserId
          ? await supabase.from('users').select('role').eq('user_id', sessionUserId).not('role', 'is', null).limit(1)
          : ({ data: null } as any)
        const roleById = Array.isArray(roleByIdArr) ? roleByIdArr[0] : roleByIdArr
        const { data: roleByEmailArr } = !roleById?.role && sessionEmail
          ? await supabase.from('users').select('role').eq('email', sessionEmail).not('role', 'is', null).limit(1)
          : ({ data: null } as any)
        const roleByEmail = Array.isArray(roleByEmailArr) ? roleByEmailArr[0] : roleByEmailArr

        const r = String((roleById as any)?.role ?? (roleByEmail as any)?.role ?? '').trim().toLowerCase()
        if (r === 'admin') return
      } catch {
        // ignore
      }

      if (!userId) return

      const sessionStr = typeof window !== 'undefined' ? window.localStorage.getItem('edc_admin_session') : null
      const sessionEmail = sessionStr ? String((JSON.parse(sessionStr) as any)?.email || '').trim().toLowerCase() : ''

      const { data: uByIdArr } = await supabase.from('users').select('role').eq('user_id', userId).not('role', 'is', null).limit(1)
      const uById = Array.isArray(uByIdArr) ? uByIdArr[0] : uByIdArr
      const { data: uByEmailArr } = !uById?.role && sessionEmail
        ? await supabase.from('users').select('role').eq('email', sessionEmail).not('role', 'is', null).limit(1)
        : ({ data: null } as any)
      const uByEmail = Array.isArray(uByEmailArr) ? uByEmailArr[0] : uByEmailArr

      const rawRole = String((uById as any)?.role ?? (uByEmail as any)?.role ?? '').trim().toLowerCase()
      setAccountRole(rawRole)

      const limit = VEHICLE_LIMITS[rawRole] ?? 1 // default to private seller limit

      const { count } = await supabase
        .from('edc_vehicles')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)

      if ((count || 0) >= limit) {
        setCanAddVehicle(false)
        setAddGateReason(`Vehicle limit reached for your current plan. Maximum ${limit} vehicles allowed. Upgrade to add more vehicles.`)
      }
    } catch {
      setCanAddVehicle(true)
      setAddGateReason('')
    } finally {
      setAddGateLoading(false)
    }
  }

  const handleOpenAddModal = () => {
    if (!canAddVehicle) {
      openAlert(
        'Vehicle limit reached',
        addGateReason || 'Vehicle limit reached for your current subscription plan. Upgrade to add more vehicles.'
      )
      return
    }
    try {
      const extractNumericSuffix = (raw: string) => {
        const m = String(raw || '').trim().match(/(\d+)\s*$/)
        if (!m?.[1]) return null
        const n = Number(m[1])
        return Number.isFinite(n) ? n : null
      }

      let max = 0
      let found = false
      for (const v of vehicles) {
        const n = extractNumericSuffix(String((v as any)?.stockNumber ?? ''))
        if (n === null) continue
        found = true
        if (n > max) max = n
      }
      if (found) {
        localStorage.setItem('edc_prefill_next_stock_number', String(max + 1))
      } else {
        localStorage.removeItem('edc_prefill_next_stock_number')
      }
    } catch {
      // ignore
    }
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
    if (!canAddVehicle) {
      openAlert(
        'Upgrade required',
        'Your account is set to private, which allows only one inventory upload. Please upgrade to a dealership account to upload more vehicles.'
      )
      return
    }
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
          key_number: payload.keyNumber || null,
        })
        .select('id')
        .single()

      if (dbError || !data?.id) {
        setAddError('Failed to create vehicle')
        return
      }

      await checkCanAddVehicle(scopedUserId)

      // Go to edit page
      router.push(`/admin/inventory/${data.id}`)
    } catch (error) {
      console.error('Error creating vehicle:', error)
    } finally {
      setAddSubmitting(false)
    }
  }

  const fetchVehicles = async (userId: string | null) => {
    setLoading(true)
    try {
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

      const vehiclesRaw = Array.isArray(data) ? data : []

      const stockNumbers = vehiclesRaw
        .map((v: any) => String(v?.stock_number ?? '').trim())
        .filter(Boolean)

      const acvByStock = new Map<string, number>()
      if (stockNumbers.length > 0) {
        const { data: purchaseRows, error: purchaseErr } = await supabase
          .from('edc_purchase')
          .select('stock_number, actual_cash_value, updated_at, created_at')
          .in('stock_number', stockNumbers)

        if (!purchaseErr && Array.isArray(purchaseRows)) {
          const bestByStock = new Map<string, { acv: number; ts: number }>()
          for (const r of purchaseRows as any[]) {
            const stock = String(r?.stock_number ?? '').trim()
            if (!stock) continue
            const acv = Number(r?.actual_cash_value ?? 0)
            const dateRaw = String(r?.updated_at ?? r?.created_at ?? '')
            const ts = dateRaw ? Date.parse(dateRaw) : 0
            const prev = bestByStock.get(stock)
            if (!prev || ts >= prev.ts) {
              bestByStock.set(stock, { acv: Number.isFinite(acv) ? acv : 0, ts })
            }
          }
          bestByStock.forEach((info, stock) => {
            acvByStock.set(stock, info.acv)
          })
        }
      }

      const mapped = await Promise.all(vehiclesRaw.map(async (v: any) => {
        const safe = (x: any) => (x === null || x === undefined ? '' : String(x))
        const stockNumber = safe(v.stock_number)

        const purchaseDataParsed = parsePurchaseData((v as any).purchase_data)
        const acvFromPurchaseTable = acvByStock.get(stockNumber)
        const purchaseData = {
          ...(purchaseDataParsed && typeof purchaseDataParsed === 'object' ? purchaseDataParsed : {}),
          ...(typeof acvFromPurchaseTable === 'number'
            ? { actual_cash_value: acvFromPurchaseTable, actualCashValue: acvFromPurchaseTable }
            : {}),
        }

        return {
          id: v.id,
          make: safe(v.make),
          model: safe(v.model),
          year: Number(v.year) || new Date().getFullYear(),
          trim: safe(v.trim) || undefined,
          stockNumber,
          price: Number(v.price) || 0,
          salePrice: (v as any).sale_price,
          mileage: Number(v.mileage) || 0,
          status: normalizeStatus(v.status),
          inventoryType: safe(v.inventory_type),
          category: (() => {
            // Prefer explicit categories/category columns; fallback to inventory_type
            const c1 = safe((v as any).categories)
            const c2 = safe((v as any).category)
            const source = (c1 || c2 || '').trim().toLowerCase()
            let cat = source
            if (cat === 'premiere') cat = 'premier'
            if (cat === 'premier' || cat === 'fleet') return cat
            const inv = safe((v as any).inventory_type).trim().toLowerCase()
            if (inv === 'premiere') return 'premier'
            if (inv === 'premier' || inv === 'fleet') return inv
            return source || undefined
          })(),
          vehicleType: (() => {
            const vt = String((v as any).vehicle_type ?? (v as any).vehicletype ?? (v as any).type ?? '').trim()
            return vt || undefined
          })(),
          images: await loadBucketImages(String(v.id)),
          photos: Array.isArray((v as any).photos) ? (v as any).photos : undefined,
          keyNumber: safe((v as any).key_number) || undefined,
          vin: safe((v as any).vin) || undefined,
          createdAt: safe((v as any).created_at),
          updatedAt: safe((v as any).updated_at) || undefined,
          series: safe((v as any).series) || undefined,
          equipment: safe((v as any).equipment) || undefined,
          fuelType: safe((v as any).fuel_type) || undefined,
          transmission: safe((v as any).transmission) || undefined,
          bodyStyle: safe((v as any).body_style) || undefined,
          drivetrain: safe((v as any).drivetrain) || undefined,
          city: safe((v as any).city) || undefined,
          province: safe((v as any).province) || undefined,
          exteriorColor: safe((v as any).exterior_color) || undefined,
          interiorColor: safe((v as any).interior_color) || undefined,
          description: safe((v as any).description) || undefined,
          features: Array.isArray((v as any).features) ? (v as any).features : undefined,
          costsData: parseCostsData((v as any).costs_data),
          purchaseData,
          cylinders: safe((v as any).cylinders) || undefined,
          odometer:
            typeof (v as any).odometer === 'number'
              ? (v as any).odometer
              : Number((v as any).odometer) || undefined,
          odometerUnit: safe((v as any).odometer_unit) || undefined,
          condition: safe((v as any).condition) || undefined,
          certified: safe((v as any).certified) || undefined,
          raw: v,
        } as Vehicle
      }))

      const toNum = (s: any) => {
        const n = Number(String(s ?? '').replace(/[^0-9.]/g, ''))
        return Number.isFinite(n) ? n : 0
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

    // If user is Premier and a category tab is selected, filter by vehicles.categories
    const roleLower = String(accountRole || '').trim().toLowerCase()
    if (roleLower === 'premier' && categoryTab) {
      const want = categoryTab.toLowerCase()
      filtered = filtered.filter(v => (v.category || '').toLowerCase() === want)
    }

    if (statusFilter.size > 0 && statusFilter.size < STATUS_OPTIONS.length) {
      const known = new Set<string>(STATUS_OPTIONS.filter((s) => s !== 'Other') as unknown as string[])
      filtered = filtered.filter((vehicle) => {
        const normalized = normalizeStatus(vehicle.status)
        // If status matches selected options
        if (statusFilter.has(normalized)) return true
        // Treat empty or unknown statuses as 'Other' when 'Other' is selected
        if (statusFilter.has('Other') && (!normalized || !known.has(normalized))) return true
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
  }, [searchQuery, inventoryTypeFilter, vehicles, statusFilter, accountRole, categoryTab])

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

  const handleExportSelected = () => {
    const selected = vehicles.filter((v) => selectedIds.has(v.id))
    if (selected.length === 0) return

    const header = [
      'description',
      'trim',
      'vehicle type',
      'drive',
      'transmission',
      'cylinders',
      'colour',
      'odometer',
      'actual cash value',
      'List price',
      'salePrice',
      'dii',
      'stock #',
      'key #',
      'cert/as-is',
      'status',
      'other',
    ]

    const aoa: any[][] = [header]
    selected.forEach((v) => {
      const acv = (v.purchaseData as any)?.actualCashValue ?? (v.purchaseData as any)?.actual_cash_value ?? 0
      const odo = typeof v.odometer === 'number' ? v.odometer : ''
      const desc = `${v.year} ${v.make} ${v.model}`.replace(/\s+/g, ' ').trim()
      aoa.push([
        desc,
        v.trim ?? '',
        v.vehicleType ?? '',
        v.drivetrain ?? '',
        v.transmission ?? '',
        v.cylinders ?? '',
        v.exteriorColor ?? '',
        odo,
        acv,
        v.price,
        (v as any).salePrice ?? (v as any).sale_price ?? (v as any).raw?.sale_price ?? (v as any).raw?.salePrice ?? '',
        (v as any).raw?.dii ?? '',
        v.stockNumber,
        v.keyNumber ?? '',
        (v as any).certified ?? '',
        v.status,
        (v as any).raw?.other ?? (v as any).raw?.notes ?? '',
      ])
    })

    const ws = XLSX.utils.aoa_to_sheet(aoa)

    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1:A1')
    for (let C = range.s.c; C <= range.e.c; C++) {
      const addr = XLSX.utils.encode_cell({ r: 0, c: C })
      const cell = ws[addr]
      if (cell) {
        ;(cell as any).s = {
          font: { bold: true, sz: 14, color: { rgb: 'FF000000' } },
          alignment: { vertical: 'center', horizontal: 'center', wrapText: true },
        }
      }
    }

    const colWidths = header.map((_, colIdx) => {
      let maxLen = 0
      for (let r = 0; r < aoa.length; r++) {
        const val = aoa[r]?.[colIdx]
        const str = val === null || val === undefined ? '' : String(val)
        maxLen = Math.max(maxLen, str.length)
      }
      return { wch: Math.min(Math.max(maxLen + 2, 10), 60) }
    })
    ws['!cols'] = colWidths

    ws['!freeze'] = { xSplit: 0, ySplit: 1 }

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Inventory')

    const fileName = `inventory_export_${new Date().toISOString().slice(0, 10)}.xlsx`
    XLSX.writeFile(wb, fileName)
  }

  const handleDeleteSelected = () => {
    if (selectedIds.size === 0) return
    const selected = vehicles.filter((v) => selectedIds.has(v.id))
    if (selected.length === 0) return

    openConfirm(
      'Confirm delete',
      `Delete ${selected.length} selected vehicle(s) and all related records?`,
      async () => {
        setModalBusy(true)
        try {
          for (const v of selected) {
            await performDelete(v)
          }
          closeModal()
        } finally {
          setModalBusy(false)
        }
      }
    )
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
      // Delete related DB records
      const { error: costsError } = await supabase
        .from('edc_costs')
        .delete()
        .eq('vehicleId', vehicle.id)
      if (costsError) console.error('Error deleting costs:', costsError)

      const { error: disclosuresError } = await supabase
        .from('edc_disclosures')
        .delete()
        .eq('vehicleId', vehicle.id)
      if (disclosuresError) console.error('Error deleting disclosures:', disclosuresError)

      const { error: purchaseError } = await supabase
        .from('edc_purchase')
        .delete()
        .eq('VehicleId', vehicle.id)
      if (purchaseError) console.error('Error deleting purchase:', purchaseError)

      const { error: warrantyError } = await supabase
        .from('edc_warranty')
        .delete()
        .eq('id', vehicle.id)
      if (warrantyError) console.error('Error deleting warranty:', warrantyError)

      // Delete vehicle-photos storage files
      try {
        const { data: photoFiles } = await supabase.storage
          .from('vehicle-photos')
          .list(String(vehicle.id))
        if (Array.isArray(photoFiles) && photoFiles.length > 0) {
          const photoPaths = photoFiles.map((f) => `${vehicle.id}/${f.name}`)
          await supabase.storage.from('vehicle-photos').remove(photoPaths)
        }
      } catch (e) {
        console.error('Error deleting vehicle photos from storage:', e)
      }

      // Delete Carfax storage files (folder named by vehicleId column value)
      const carfaxFolderId = String(vehicle.raw?.vehicleId || vehicle.raw?.vehicle_id || vehicle.id)
      try {
        const { data: carfaxFiles } = await supabase.storage
          .from('Carfax')
          .list(carfaxFolderId)
        if (Array.isArray(carfaxFiles) && carfaxFiles.length > 0) {
          const carfaxPaths = carfaxFiles.map((f) => `${carfaxFolderId}/${f.name}`)
          await supabase.storage.from('Carfax').remove(carfaxPaths)
        }
      } catch (e) {
        console.error('Error deleting Carfax files from storage:', e)
      }

      // Delete the vehicle itself
      const { error: vehicleError } = await supabase
        .from('edc_vehicles')
        .delete()
        .eq('id', vehicle.id)

      if (vehicleError) throw vehicleError

      // Update UI state
      setVehicles((prev) => prev.filter((v) => v.id !== vehicle.id))
      setFilteredVehicles((prev) => prev.filter((v) => v.id !== vehicle.id))
      setSelectedIds((prev) => {
        const next = new Set(prev)
        next.delete(vehicle.id)
        return next
      })
      if (drawerVehicle?.id === vehicle.id) closeDrawer()

      alert('Vehicle deleted successfully!')
    } catch (error) {
      console.error('Error deleting vehicle:', error)
      openAlert('Delete failed', 'Failed to delete vehicle: ' + (error instanceof Error ? error.message : String(error)))
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

  const handleResetToAvailable = (vehicle: Vehicle) => {
    openConfirm(
      'Reset vehicle status',
      `This will set "${vehicle.year} ${vehicle.make} ${vehicle.model}" back to In Stock and cancel any pending purchase submissions for it. Continue?`,
      async () => {
        setModalBusy(true)
        try {
          // Reset vehicle status
          await supabase
            .from('edc_vehicles')
            .update({ status: 'In Stock' })
            .eq('id', vehicle.id)

          // Cancel any pending/approved submissions for this vehicle
          await supabase
            .from('edc_purchase_submissions')
            .update({ status: 'cancelled' })
            .eq('vehicle_id', vehicle.id)
            .in('status', ['pending', 'approved'])

          // Refresh list
          setVehicles((prev) =>
            prev.map((v) => v.id === vehicle.id ? { ...v, status: 'In Stock' } : v)
          )
          closeModal()
        } finally {
          setModalBusy(false)
        }
      }
    )
  }

  const handleImportClick = () => {
    if (importing) return
    importInputRef.current?.click()
  }

  const handleImportSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    // allow selecting same file again
    e.target.value = ''
    if (!file) return

    setImporting(true)
    try {
      let email = ''
      try {
        const raw = typeof window !== 'undefined' ? window.localStorage.getItem('edc_admin_session') : null
        const parsed = raw ? (JSON.parse(raw) as any) : null
        email = String(parsed?.email || '').trim().toLowerCase()
      } catch {
        email = ''
      }

      const form = new FormData()
      form.set('file', file)
      if (email) form.set('email', email)

      const res = await fetch('/api/import', {
        method: 'POST',
        body: form,
      })
      const json = await res.json().catch(() => null)

      if (!res.ok) {
        const msg = String(json?.error || 'Import failed')
        const details = String(json?.details || '')
        throw new Error(details ? `${msg}: ${details}` : msg)
      }

      openAlert('Import successful', 'Done')
    } catch (err: any) {
      openAlert('Import failed', String(err?.message || 'Failed to upload file'))
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="px-6 lg:px-8 pt-8 pb-4 border-b border-slate-100">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Inventory</h1>
            <p className="text-sm text-slate-400 mt-0.5">{filteredVehicles.length} of {vehicles.length} vehicles</p>
          </div>
          <div className="flex items-center gap-2">
            <input
              ref={importInputRef}
              type="file"
              className="hidden"
              onChange={handleImportSelected}
            />
            <button
              type="button"
              onClick={handleImportClick}
              disabled={importing}
              className={`h-10 px-5 rounded-full border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors inline-flex items-center gap-1.5 ${importing ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
              {importing ? 'Importing…' : 'Import file'}
            </button>
            <button
              type="button"
              onClick={handleOpenAddModal}
              disabled={!canAddVehicle || addGateLoading}
              title={!canAddVehicle ? (addGateReason || 'Upgrade your account to add more vehicles.') : undefined}
              className={`h-10 px-5 rounded-full bg-[#0B1F3A] text-white text-sm font-semibold hover:bg-[#1EA7FF] transition-colors inline-flex items-center gap-1.5 ${!canAddVehicle || addGateLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              Add vehicle
            </button>
          </div>
        </div>
      </div>

      {/* Right Drawer */}
      {drawerVehicle && (
        <div className="fixed inset-y-0 right-0 w-full sm:w-[440px] bg-white shadow-premium z-50 flex flex-col border-l border-slate-200/60">
          {/* Enhanced Header */}
          <div className="px-5 pt-4 border-b border-slate-200/60">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10"></div>
              <button onClick={closeDrawer} className="p-2 rounded-lg hover:bg-slate-100 transition-colors" aria-label="Close">
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
                <span className="edc-badge-cyan text-[10px]">{drawerVehicle.status || 'In Stock'}</span>
              </div>
              <h3 className="text-xl font-bold text-slate-900 text-center leading-snug">
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
            <h4 className="text-base font-semibold text-slate-900 mb-4 text-center">Profit Analysis</h4>
            {(() => {
              const purchasePrice = Number(drawerCosts.purchasePrice || 0)
              const additionalExpenses = Number(drawerCosts.additionalExpenses || 0)
              const acvDisplay = additionalExpenses // show ACV as total costs per request
              const totalInvested = purchasePrice + additionalExpenses
              const selling = Number(drawerVehicle.price || 0)
              const taxTotal = Number(drawerCosts.taxTotal || 0)
              const tax = taxTotal
              const allInPrice = selling + tax
              const profit = selling - totalInvested
              
              //// Pie chart calculations - show breakdown of total invested
              const circumference = 2 * Math.PI * 35
              const netPurchase = purchasePrice
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
                      <motion.circle
                        cx="50"
                        cy="50"
                        r="35"
                        fill="transparent"
                        stroke="#2563eb"
                        strokeWidth="20"
                        animate={{
                          strokeDasharray: `${purchaseDash} ${circumference}`,
                          strokeDashoffset: 0,
                        }}
                        transition={{ duration: 0.6, ease: 'easeInOut' }}
                      />
                      <motion.circle
                        cx="50"
                        cy="50"
                        r="35"
                        fill="transparent"
                        stroke="#dc2626"
                        strokeWidth="20"
                        animate={{
                          strokeDasharray: `${expensesDash} ${circumference}`,
                          strokeDashoffset: -purchaseDash,
                        }}
                        transition={{ duration: 0.6, ease: 'easeInOut' }}
                      />
                      {profit > 0 && (
                        <motion.circle
                          cx="50"
                          cy="50"
                          r="35"
                          fill="transparent"
                          stroke="#16a34a"
                          strokeWidth="20"
                          animate={{
                            strokeDasharray: `${profitDash} ${circumference}`,
                            strokeDashoffset: -(purchaseDash + expensesDash),
                          }}
                          transition={{ duration: 0.6, ease: 'easeInOut' }}
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
                    <div className="flex justify-between text-gray-700"><span className="font-medium text-gray-600">Actual Cash Value:</span><span>{formatPrice(acvDisplay)}</span></div>
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

      <div className="px-6 py-6">
        {/* Tab bar + search row */}
        <div className="flex items-center justify-between gap-4 mb-5 flex-wrap">
          {/* Category tabs */}
          <div className="flex items-center gap-2">
            {(() => {
              const allCount = vehicles.length
              const premierCount = vehicles.filter(v => (v.category || '').toLowerCase().includes('premier')).length
              const fleetCount = vehicles.filter(v => (v.category || '').toLowerCase().includes('fleet')).length
              const TabBtn = ({ label, val, count }: { label: string; val: '' | 'premier' | 'fleet'; count?: number }) => (
                <button
                  type="button"
                  onClick={() => setCategoryTab(val)}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-all ${
                    categoryTab === val
                      ? 'bg-[#0B1F3A] text-white border-[#0B1F3A]'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {label}
                </button>
              )
              return (
                <>
                  <TabBtn label="All" val="" count={allCount} />
                  <TabBtn label="Premier" val="premier" count={premierCount} />
                  <TabBtn label="Fleet" val="fleet" count={fleetCount} />
                </>
              )
            })()}
          </div>

          {/* Right: search + status dropdown */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search inventory..."
                className="h-9 pl-9 pr-4 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#1EA7FF]/30 w-56"
              />
              <svg className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>

            <div className="relative">
              <button
                type="button"
                onClick={() => setStatusFilterOpen((v) => !v)}
                className="h-9 px-3 text-sm border border-slate-200 rounded-lg bg-white text-slate-600 hover:bg-slate-50 transition-colors inline-flex items-center gap-1.5"
              >
                {selectedStatusLabel}
                <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {statusFilterOpen && (
                <div className="absolute right-0 z-20 mt-1 w-52 bg-white border border-slate-200 rounded-xl shadow-lg p-3">
                  <div className="text-xs font-semibold text-slate-500 mb-2">Filter by Status</div>
                  <div className="max-h-56 overflow-auto space-y-2">
                    {allStatusOptions.map((s) => (
                      <label key={s} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-slate-300 text-[#1EA7FF] focus:ring-[#1EA7FF]"
                          checked={statusFilter.has(s)}
                          onChange={(e) => toggleStatus(s, e.target.checked)}
                        />
                        {s}
                      </label>
                    ))}
                  </div>
                  <div className="flex justify-between mt-3 pt-3 border-t border-slate-100 text-xs">
                    <button type="button" onClick={() => setStatusFilter(new Set(allStatusOptions))} className="text-slate-500 hover:text-slate-800">All</button>
                    <button type="button" onClick={() => setStatusFilter(new Set())} className="text-slate-500 hover:text-slate-800">Clear</button>
                    <button type="button" onClick={() => setStatusFilterOpen(false)} className="text-[#1EA7FF] font-medium">Done</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {selectedIds.size > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200/60 p-3 mb-5" style={{ boxShadow: '0 1px 3px rgba(0,0,0,.04)' }}>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="text-sm font-semibold text-slate-700">
                {selectedIds.size} selected
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleDeleteSelected}
                  className="edc-btn-danger text-sm"
                >
                  Delete
                </button>
                <button
                  type="button"
                  onClick={handleExportSelected}
                  className="edc-btn-primary text-sm"
                >
                  Export
                </button>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="bg-white rounded-2xl border border-slate-200/60 p-12 text-center" style={{ boxShadow: '0 1px 3px rgba(0,0,0,.04)' }}>
            <div className="animate-spin rounded-full h-10 w-10 border-2 border-[#1EA7FF] border-t-transparent mx-auto" />
            <p className="text-sm text-slate-500 mt-3">Loading vehicles...</p>
          </div>
        ) : vehicles.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200/60 p-16 text-center" style={{ boxShadow: '0 1px 3px rgba(0,0,0,.04)' }}>
            <div className="w-16 h-16 rounded-2xl bg-[#1EA7FF]/10 flex items-center justify-center mx-auto mb-5">
              <svg className="w-8 h-8 text-[#1EA7FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-[#0B1F3A] mb-1">No Vehicles</h3>
            <p className="text-sm text-slate-500 mb-5">Start by adding your first vehicle or importing a CSV file.</p>
            <div className="flex justify-center gap-3">
              <button
                type="button"
                onClick={handleOpenAddModal}
                disabled={!canAddVehicle || addGateLoading}
                title={!canAddVehicle ? (addGateReason || 'Upgrade your account to add more vehicles.') : undefined}
                className={`edc-btn-primary text-sm ${!canAddVehicle || addGateLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                Add Vehicle
              </button>
              <Link
                href="/admin/import"
                className="edc-btn-ghost text-sm"
              >
                Import CSV
              </Link>
            </div>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden lg:block bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="w-10 px-4 py-3">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-gray-300 text-[#1EA7FF] focus:ring-[#1EA7FF]"
                        checked={allSelected}
                        onChange={(e) => toggleSelectAll(e.target.checked)}
                        aria-label="Select all"
                      />
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide">Description</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide">Trim</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide">Listing</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide">Odometer</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide">Sale Price</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide">Stock #</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide">Status</th>
                    <th className="w-16 px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedVehicles.map((vehicle) => {
                    const listingBadge = (() => {
                      const raw = String(vehicle.category || vehicle.inventoryType || '').toLowerCase()
                      if (raw.includes('private')) return { label: 'Private Seller', cls: 'bg-amber-50 text-amber-700 border-amber-200' }
                      if (raw.includes('premier')) return { label: 'EDC Premier', cls: 'bg-blue-50 text-blue-700 border-blue-200' }
                      if (raw.includes('fleet')) return { label: 'Fleet Select', cls: 'bg-slate-100 text-slate-600 border-slate-200' }
                      if (raw.includes('dealer')) return { label: 'Dealer Select', cls: 'bg-purple-50 text-purple-700 border-purple-200' }
                      return { label: raw || '—', cls: 'bg-slate-100 text-slate-600 border-slate-200' }
                    })()
                    const statusBadge = (() => {
                      const s = String(vehicle.status || '').toLowerCase()
                      if (s === 'in stock' || s === 'active') return { label: vehicle.status, cls: 'bg-green-50 text-green-700 border-green-200' }
                      if (s === 'deal pending' || s === 'pending') return { label: vehicle.status, cls: 'bg-orange-50 text-orange-700 border-orange-200' }
                      if (s === 'sold') return { label: vehicle.status, cls: 'bg-slate-100 text-slate-500 border-slate-200' }
                      if (s === 'coming soon') return { label: vehicle.status, cls: 'bg-sky-50 text-sky-700 border-sky-200' }
                      return { label: vehicle.status || '—', cls: 'bg-slate-100 text-slate-500 border-slate-200' }
                    })()
                    return (
                    <tr key={vehicle.id} className="hover:bg-slate-50/60 transition-colors cursor-pointer" onClick={() => setDrawerVehicle(vehicle)}>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-gray-300 text-[#1EA7FF] focus:ring-[#1EA7FF]"
                          aria-label={`Select ${vehicle.year} ${vehicle.make} ${vehicle.model}`}
                          checked={selectedIds.has(vehicle.id)}
                          onChange={(e) => toggleSelect(vehicle.id, e.target.checked)}
                        />
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-900 whitespace-nowrap">
                        {vehicle.year} {vehicle.make} {vehicle.model}
                      </td>
                      <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{vehicle.trim || <span className="text-slate-300">—</span>}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${listingBadge.cls}`}>
                          {listingBadge.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap tabular-nums">
                        {typeof vehicle.odometer === 'number'
                          ? vehicle.odometer.toLocaleString()
                          : vehicle.mileage
                          ? vehicle.mileage.toLocaleString()
                          : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-slate-900 font-medium whitespace-nowrap tabular-nums">
                        {formatPrice(Number(vehicle.salePrice || vehicle.price || 0))}
                      </td>
                      <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{vehicle.stockNumber || <span className="text-slate-300">—</span>}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusBadge.cls}`}>
                          {statusBadge.label}
                        </span>
                      </td>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1 justify-end">
                          {String(vehicle.status || '').toLowerCase() === 'reserved' && (
                            <button
                              type="button"
                              onClick={() => handleResetToAvailable(vehicle)}
                              className="p-1.5 text-amber-500 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition-colors"
                              title="Reset to Available"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                              </svg>
                            </button>
                          )}
                          <Link
                            href={`/admin/inventory/${vehicle.id}`}
                            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                            title="Edit"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </Link>
                          <button
                            type="button"
                            onClick={() => handleDelete(vehicle)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                    )
                  })}
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
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="bg-white rounded-2xl border border-slate-200/60 px-4 py-3 flex items-center justify-between mt-5" style={{ boxShadow: '0 1px 3px rgba(0,0,0,.04)' }}>
              <div className="text-sm text-slate-600">
                Page {currentPage} of {totalPages}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  className="px-3 py-1 border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  First
                </button>
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1 border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
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
                      className={`px-3 py-1 border rounded-lg text-sm font-medium transition-colors ${
                        currentPage === pageNum
                          ? 'bg-navy-900 text-white border-navy-900'
                          : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
                <button
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1 border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                </button>
                <button
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1 border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
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
        <div className="fixed inset-0 z-[9999] flex items-center justify-center">
          <button
            type="button"
            aria-label="Close"
            className="edc-overlay z-[9998]"
            onClick={closeModal}
          />
          <div className="edc-modal relative z-[9999] w-[92vw] max-w-md pointer-events-auto">
            <div className="px-5 py-4 border-b border-slate-100">
              <h3 className="text-base font-semibold text-slate-900">{modalTitle}</h3>
            </div>
            <div className="px-5 py-4">
              <p className="text-sm text-slate-600 whitespace-pre-line">{modalMessage}</p>
            </div>
            <div className="px-5 py-4 border-t border-slate-100 flex items-center justify-end gap-2">
              {modalMode === 'confirm' ? (
                <>
                  <button
                    type="button"
                    className="edc-btn-ghost text-sm"
                    onClick={closeModal}
                    disabled={modalBusy}
                  >
                    No
                  </button>
                  <button
                    type="button"
                    className="edc-btn-danger text-sm"
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
                  className="edc-btn-primary text-sm"
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
            className="edc-overlay absolute inset-0"
            onClick={() => (addSubmitting ? null : setShowAddModal(false))}
          ></div>
          <div className="edc-modal relative w-full max-w-4xl mx-4 overflow-hidden max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Add New Vehicle</h2>
                <p className="text-sm text-slate-500">Create a vehicle and then add photos</p>
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
                  <div className="p-3 bg-danger-500/10 border border-danger-500/20 rounded-xl text-danger-600 text-sm">{addError}</div>
                )}

                <div>
                  <h3 className="text-base font-semibold text-slate-900 mb-4 border-b border-slate-100 pb-2">Basic Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-[13px] font-medium text-slate-600 mb-1">Make *</label>
                      <input
                        type="text"
                        name="make"
                        required
                        value={addFormData.make}
                        onChange={handleAddChange}
                        placeholder="e.g., Toyota"
                        className="edc-input"
                      />
                    </div>
                    <div>
                      <label className="block text-[13px] font-medium text-slate-600 mb-1">Model *</label>
                      <input
                        type="text"
                        name="model"
                        required
                        value={addFormData.model}
                        onChange={handleAddChange}
                        placeholder="e.g., Camry"
                        className="edc-input"
                      />
                    </div>
                    <div>
                      <label className="block text-[13px] font-medium text-slate-600 mb-1">Year *</label>
                      <input
                        type="number"
                        name="year"
                        required
                        value={addFormData.year}
                        onChange={handleAddChange}
                        min="1990"
                        max={new Date().getFullYear() + 1}
                        className="edc-input"
                      />
                    </div>
                    <div>
                      <label className="block text-[13px] font-medium text-slate-600 mb-1">Price ($) *</label>
                      <input
                        type="number"
                        name="price"
                        required
                        value={addFormData.price}
                        onChange={handleAddChange}
                        placeholder="e.g., 25000"
                        className="edc-input"
                      />
                    </div>
                    <div>
                      <label className="block text-[13px] font-medium text-slate-600 mb-1">Mileage (km) *</label>
                      <input
                        type="number"
                        name="mileage"
                        required
                        value={addFormData.mileage}
                        onChange={handleAddChange}
                        placeholder="e.g., 50000"
                        className="edc-input"
                      />
                    </div>
                    <div>
                      <label className="block text-[13px] font-medium text-slate-600 mb-1">Status</label>
                      <select
                        name="status"
                        value={addFormData.status}
                        onChange={handleAddChange}
                        className="edc-input"
                      >
                        <option value="ACTIVE">Active</option>
                        <option value="PENDING">Pending</option>
                        <option value="SOLD">Sold</option>
                        <option value="DRAFT">Draft</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[13px] font-medium text-slate-600 mb-1">Inventory Type</label>
                      <select
                        name="inventoryType"
                        value={addFormData.inventoryType}
                        onChange={handleAddChange}
                        className="edc-input"
                      >
                        <option value="FLEET">Fleet Cars</option>
                        <option value="PREMIERE">Premiere Cars</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-base font-semibold text-slate-900 mb-4 border-b border-slate-100 pb-2">Identification & Location</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-[13px] font-medium text-slate-600 mb-1">Stock Number (Unit ID)</label>
                      <input
                        type="text"
                        name="stockNumber"
                        value={addFormData.stockNumber}
                        onChange={handleAddChange}
                        placeholder="e.g., 8FDJTG"
                        className="edc-input"
                      />
                    </div>
                    <div>
                      <label className="block text-[13px] font-medium text-slate-600 mb-1">VIN *</label>
                      <input
                        type="text"
                        name="vin"
                        required
                        value={addFormData.vin}
                        onChange={handleAddChange}
                        placeholder="Vehicle Identification Number"
                        className="edc-input"
                      />
                    </div>
                    <div>
                      <label className="block text-[13px] font-medium text-slate-600 mb-1">Series</label>
                      <input
                        type="text"
                        name="series"
                        value={addFormData.series}
                        onChange={handleAddChange}
                        placeholder="e.g., 40K4, 45KF"
                        className="edc-input"
                      />
                    </div>
                    <div>
                      <label className="block text-[13px] font-medium text-slate-600 mb-1">City *</label>
                      <input
                        type="text"
                        name="city"
                        required
                        value={addFormData.city}
                        onChange={handleAddChange}
                        placeholder="e.g., Toronto"
                        className="edc-input"
                      />
                    </div>
                    <div>
                      <label className="block text-[13px] font-medium text-slate-600 mb-1">Province *</label>
                      <select
                        name="province"
                        required
                        value={addFormData.province}
                        onChange={handleAddChange}
                        className="edc-input"
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
                      <label className="block text-[13px] font-medium text-slate-600 mb-1">Key #</label>
                      <input
                        type="text"
                        name="keyNumber"
                        value={addFormData.keyNumber}
                        onChange={handleAddChange}
                        placeholder="e.g., 12"
                        className="edc-input"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-base font-semibold text-slate-900 mb-4 border-b border-slate-100 pb-2">Specifications</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-[13px] font-medium text-slate-600 mb-1">Fuel Type</label>
                      <select
                        name="fuelType"
                        value={addFormData.fuelType}
                        onChange={handleAddChange}
                        className="edc-input"
                      >
                        <option value="Gasoline">Gasoline</option>
                        <option value="Diesel">Diesel</option>
                        <option value="Hybrid">Hybrid</option>
                        <option value="Electric">Electric</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[13px] font-medium text-slate-600 mb-1">Transmission</label>
                      <select
                        name="transmission"
                        value={addFormData.transmission}
                        onChange={handleAddChange}
                        className="edc-input"
                      >
                        <option value="Automatic">Automatic</option>
                        <option value="Manual">Manual</option>
                        <option value="CVT">CVT</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[13px] font-medium text-slate-600 mb-1">Drivetrain</label>
                      <select
                        name="drivetrain"
                        value={addFormData.drivetrain}
                        onChange={handleAddChange}
                        className="edc-input"
                      >
                        <option value="FWD">FWD</option>
                        <option value="RWD">RWD</option>
                        <option value="AWD">AWD</option>
                        <option value="4WD">4WD</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[13px] font-medium text-slate-600 mb-1">Body Style *</label>
                      <input
                        type="text"
                        name="bodyStyle"
                        required
                        value={addFormData.bodyStyle}
                        onChange={handleAddChange}
                        placeholder="e.g., Sedan"
                        className="edc-input"
                      />
                    </div>
                    <div>
                      <label className="block text-[13px] font-medium text-slate-600 mb-1">Trim</label>
                      <input
                        type="text"
                        name="trim"
                        value={addFormData.trim}
                        onChange={handleAddChange}
                        placeholder="e.g., SE, XLE"
                        className="edc-input"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-base font-semibold text-slate-900 mb-4 border-b border-slate-100 pb-2">Colors</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[13px] font-medium text-slate-600 mb-1">Exterior Color *</label>
                      <input
                        type="text"
                        name="exteriorColor"
                        required
                        value={addFormData.exteriorColor}
                        onChange={handleAddChange}
                        placeholder="e.g., Silver"
                        className="edc-input"
                      />
                    </div>
                    <div>
                      <label className="block text-[13px] font-medium text-slate-600 mb-1">Interior Color</label>
                      <input
                        type="text"
                        name="interiorColor"
                        value={addFormData.interiorColor}
                        onChange={handleAddChange}
                        placeholder="e.g., Black"
                        className="edc-input"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-base font-semibold text-slate-900 mb-4 border-b border-slate-100 pb-2">Description & Features</h3>
                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <label className="block text-[13px] font-medium text-slate-600 mb-1">Equipment</label>
                      <textarea
                        name="equipment"
                        rows={2}
                        value={addFormData.equipment}
                        onChange={handleAddChange}
                        placeholder="e.g., A3 40 KOMFORT AWD SEDAN"
                        className="edc-input"
                      ></textarea>
                      <p className="mt-1 text-xs text-gray-500">Full equipment description from EDC inventory</p>
                    </div>
                    <div>
                      <label className="block text-[13px] font-medium text-slate-600 mb-1">Description</label>
                      <textarea
                        name="description"
                        value={addFormData.description}
                        onChange={handleAddChange}
                        rows={4}
                        className="edc-input"
                      />
                    </div>
                    <div>
                      <label className="block text-[13px] font-medium text-slate-600 mb-1">Features (comma-separated)</label>
                      <textarea
                        name="features"
                        value={addFormData.features}
                        onChange={handleAddChange}
                        rows={3}
                        placeholder="Bluetooth, Backup Camera, Sunroof"
                        className="edc-input"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    disabled={addSubmitting}
                    className="edc-btn-ghost text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={addSubmitting}
                    className="edc-btn-primary text-sm"
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
