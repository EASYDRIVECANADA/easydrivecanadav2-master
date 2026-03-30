'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
import {
  CarFront,
  ClipboardList,
  BadgeDollarSign,
  Receipt,
  ShieldCheck,
  ArrowLeft,
} from 'lucide-react'
import DisclosuresTab from './tabs/DisclosuresTab'
import PurchaseTab from './tabs/PurchaseTab'
import CostsTab from './tabs/CostsTab'
import WarrantyTab from './tabs/WarrantyTab'

type TabType = 'details' | 'disclosures' | 'purchase' | 'costs' | 'warranty'

const normalizeStockNumber = (raw: string) => {
  const trimmed = String(raw || '').trim()
  if (!trimmed) return ''
  const match = trimmed.match(/(\d+)\s*$/)
  if (!match?.[1]) return trimmed.toUpperCase()
  return String(Number(match[1]))
}

export default function NewVehiclePage() {
  const [activeTab, setActiveTab] = useState<TabType>('details')

  // Generate a stable vehicleId once at page load — shared across ALL tabs
  const [createdVehicleId] = useState<string>(() => {
    try {
      const stored = localStorage.getItem('edc_new_vehicle_id')
      if (stored) return stored
      // Fresh session — clear any stale wizard from a previous vehicle
      const id = crypto.randomUUID()
      localStorage.setItem('edc_new_vehicle_id', id)
      localStorage.removeItem('edc_new_vehicle_wizard')
      return id
    } catch {
      return crypto.randomUUID()
    }
  })

  const [vehicleSavedToDb, setVehicleSavedToDb] = useState(false)
  const [dbVehicleId, setDbVehicleId] = useState<string>('')
  const [allowNextTabs, setAllowNextTabs] = useState(false)
  const [disclosuresSaved, setDisclosuresSaved] = useState(false)
  const [purchaseSaved, setPurchaseSaved] = useState(false)
  const [costsSaved, setCostsSaved] = useState(false)
  const [webhookUserId, setWebhookUserId] = useState<string | null>(null)
  const [userRole, setUserRole] = useState<string | null>(null)
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)
  const [gatingError, setGatingError] = useState('')
  const [assignmentUsers, setAssignmentUsers] = useState<Array<{ id: string; first_name: string | null; last_name: string | null; email: string | null }>>([])
  const stockAutofillRanRef = useRef(false)
  const [vinConfirmOpen, setVinConfirmOpen] = useState(false)
  const [vinConfirmDontShow, setVinConfirmDontShow] = useState(false)
  const [vinConfirmBalance, setVinConfirmBalance] = useState<number | null>(null)
  const [vinInsufficientOpen, setVinInsufficientOpen] = useState(false)
  const [vinInsufficientMessage, setVinInsufficientMessage] = useState('')
  const vinConfirmActionRef = useRef<null | (() => Promise<void>)>(null)
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
    fuelType: '',
    transmission: '',
    bodyStyle: '',
    vehicleType: '',
    exteriorColor: '',
    interiorColor: '',
    drivetrain: '',
    doors: '',
    city: '',
    province: 'ON',
    description: '',
    adDescription: '',
    features: '',
    status: 'In Stock',
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
    engine: '',
    cylinders: '',
    other: '',
    notes: '',
    certified: false,
    verified: false,
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const [sendingVin, setSendingVin] = useState(false)
  const [vinPrefilled, setVinPrefilled] = useState(false)
  const [lastVinSent, setLastVinSent] = useState<string>('')
  const purchaseTabRef = useRef<any>(null)
  const [nextCostsSaving, setNextCostsSaving] = useState(false)
  const disclosuresTabRef = useRef<any>(null)
  const [nextPurchaseSaving, setNextPurchaseSaving] = useState(false)
  const costsTabRef = useRef<any>(null)
  const [nextWarrantySaving, setNextWarrantySaving] = useState(false)
  const [saveModalOpen, setSaveModalOpen] = useState(false)
  const [saveModalTitle, setSaveModalTitle] = useState('')
  const [saveModalMessage, setSaveModalMessage] = useState('')
  const [pendingNextTab, setPendingNextTab] = useState<TabType | null>(null)
  const [stockNumberTaken, setStockNumberTaken] = useState(false)
  const [stockChecking, setStockChecking] = useState(false)
  const stockCheckTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [vinDuplicate, setVinDuplicate] = useState(false)
  const [vinChecking, setVinChecking] = useState(false)
  const vinCheckTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const adEditorRef = useRef<HTMLDivElement | null>(null)
  const lastAdHtmlRef = useRef<string>('')
  const [adToolbar, setAdToolbar] = useState({
    bold: false,
    italic: false,
    underline: false,
    strike: false,
    superscript: false,
    subscript: false,
    ordered: false,
    unordered: false,
    foreColor: '#000000',
  })

  const refreshAdToolbar = () => {
    try {
      setAdToolbar(prev => ({
        ...prev,
        bold: document.queryCommandState('bold'),
        italic: document.queryCommandState('italic'),
        underline: document.queryCommandState('underline'),
        strike: document.queryCommandState('strikeThrough'),
        superscript: document.queryCommandState('superscript'),
        subscript: document.queryCommandState('subscript'),
        ordered: document.queryCommandState('insertOrderedList'),
        unordered: document.queryCommandState('insertUnorderedList'),
        foreColor: (document.queryCommandValue('foreColor') as string) || prev.foreColor,
      }))
    } catch {}
  }

  const preventToolbarMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
  }

  const exec = (command: string, value?: string) => {
    const el = adEditorRef.current
    if (!el) return
    el.focus()
    try {
      document.execCommand(command, false, value)
      const html = el.innerHTML
      lastAdHtmlRef.current = html
      setFormData((prev) => ({ ...prev, adDescription: html }))
      refreshAdToolbar()
    } catch {}
  }

  const handleAdInput = () => {
    const el = adEditorRef.current
    if (!el) return
    const html = el.innerHTML
    lastAdHtmlRef.current = html
    setFormData((prev) => ({ ...prev, adDescription: html }))
    refreshAdToolbar()
  }

  // Build a display name from first/last or email local-part
  const displayUserName = (r: { first_name?: string | null; last_name?: string | null; email?: string | null }) => {
    const f = String(r.first_name || '').trim()
    const l = String(r.last_name || '').trim()
    const name = [f, l].filter(Boolean).join(' ').trim()
    if (name) return name
    const e = String(r.email || '').trim()
    if (!e) return ''
    const local = (e.split('@')[0] || e)
      .replace(/[_\-.]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    return local.replace(/\b\w/g, (m) => m.toUpperCase())
  }

  useEffect(() => {
    try {
      const raw = localStorage.getItem('edc_new_vehicle_wizard')
      if (!raw) return
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed === 'object') {
        // Only restore DB-state flags if the wizard belongs to the same vehicle session
        const sameSession = parsed.createdVehicleId === createdVehicleId
        if (sameSession && parsed.vehicleSavedToDb === true) setVehicleSavedToDb(true)
        if (sameSession && typeof parsed.dbVehicleId === 'string' && parsed.dbVehicleId) setDbVehicleId(parsed.dbVehicleId)
        if (sameSession && typeof parsed.disclosuresSaved === 'boolean') setDisclosuresSaved(parsed.disclosuresSaved)
        if (sameSession && typeof parsed.purchaseSaved === 'boolean') setPurchaseSaved(parsed.purchaseSaved)
        if (sameSession && typeof parsed.costsSaved === 'boolean') setCostsSaved(parsed.costsSaved)
        if (sameSession && parsed.formData && typeof parsed.formData === 'object') setFormData((prev) => ({ ...prev, ...parsed.formData }))
        if (sameSession && typeof parsed.activeTab === 'string') setActiveTab(parsed.activeTab)
      }
    } catch {}
  }, [])

  useEffect(() => {
    try {
      const current = String((formData as any)?.stockNumber ?? '').trim()
      if (current) return
      const next = String(localStorage.getItem('edc_prefill_next_stock_number') ?? '').trim()
      if (!next) return
      localStorage.removeItem('edc_prefill_next_stock_number')
      setFormData((prev: any) => {
        const prevStock = String(prev?.stockNumber ?? '').trim()
        if (prevStock) return prev
        return { ...prev, stockNumber: next }
      })
    } catch {
      // ignore
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const el = adEditorRef.current
    if (!el) return
    const adHtml = String((formData as any)?.adDescription || '')
    if (lastAdHtmlRef.current === adHtml) return
    if (el.innerHTML !== adHtml) {
      el.innerHTML = adHtml
    }
    lastAdHtmlRef.current = adHtml
  }, [formData?.adDescription])

  useEffect(() => {
    try {
      const snapshot = {
        activeTab,
        createdVehicleId,
        vehicleSavedToDb,
        dbVehicleId,
        disclosuresSaved,
        purchaseSaved,
        costsSaved,
        formData,
      }
      localStorage.setItem('edc_new_vehicle_wizard', JSON.stringify(snapshot))
    } catch {}
  }, [activeTab, createdVehicleId, vehicleSavedToDb, dbVehicleId, disclosuresSaved, purchaseSaved, costsSaved, formData])

  useEffect(() => {
    const sessionStr = localStorage.getItem('edc_admin_session')
    if (!sessionStr) {
      router.push('/admin')
      return
    }
    localStorage.removeItem('edc_new_vehicle_costs_draft')
  }, [router])

  const getLoggedInAdminDbUserId = async (): Promise<string | null> => {
    try {
      if (typeof window === 'undefined') return null
      const raw = window.localStorage.getItem('edc_admin_session')
      if (!raw) return null
      const parsed = JSON.parse(raw) as { email?: string; user_id?: string; role?: string }
      const sessionUserId = String(parsed?.user_id ?? '').trim()
      if (sessionUserId) return sessionUserId

      const sessionEmail = String(parsed?.email ?? '').trim()
      const sessionRole = String(parsed?.role ?? '').trim().toLowerCase()
      if (sessionEmail && sessionRole && (sessionRole === 'admin' || sessionRole === 'staff')) {
        // edc_admin_users credential session: allow flow without user scoping
        return null
      }

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
      return (data as any)?.id ? String((data as any).id) : null
    } catch {
      return null
    }
  }

  const getWebhookUserId = async (): Promise<string | null> => {
    try {
      const dbUserId = await getLoggedInAdminDbUserId()
      return dbUserId
    } catch {
      return null
    }
  }

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      const id = await getWebhookUserId()
      if (!cancelled) setWebhookUserId(id)
      if (id) {
        try {
          const { data } = await supabase
            .from('users')
            .select('role')
            .eq('user_id', id)
            .limit(1)
            .maybeSingle()
          if (!cancelled && (data as any)?.role) setUserRole(String((data as any).role))
        } catch {}
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.removeItem('edc_new_vehicle_costs_draft')
    } catch {
      // ignore
    }
  }, [])

  // Load assignable users for the current account to populate Assignment select
  useEffect(() => {
    let cancelled = false
    const loadUsers = async () => {
      try {
        const dbId = await getLoggedInAdminDbUserId()
        if (!dbId) {
          if (!cancelled) setAssignmentUsers([])
          return
        }
        const { data } = await supabase
          .from('users')
          .select('id, first_name, last_name, email')
          .eq('user_id', dbId)
          .order('first_name', { ascending: true })
        if (!cancelled) setAssignmentUsers(Array.isArray(data) ? (data as any) : [])
      } catch {
        if (!cancelled) setAssignmentUsers([])
      }
    }
    loadUsers()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    let alive = true

    const loadNextStockNumber = async () => {
      try {
        const current = String((formData as any)?.stockNumber ?? '').trim()
        if (current) return
        if (stockAutofillRanRef.current) return

        const userId = webhookUserId ?? (await getWebhookUserId())
        if (!userId) return

        const extractNumericSuffix = (raw: string) => {
          const m = String(raw || '').trim().match(/(\d+)\s*$/)
          if (!m?.[1]) return null
          const n = Number(m[1])
          return Number.isFinite(n) ? n : null
        }

        let rows: any[] = []
        const { data, error } = await supabase
          .from('edc_vehicles')
          .select('stock_number, created_at')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(300)

        if (!error) {
          rows = Array.isArray(data) ? data : []
        }

        if (!rows.length) {
          const res = await fetch('/api/vehicles', { cache: 'no-store' })
          if (res.ok) {
            const json = await res.json().catch(() => null)
            const all = Array.isArray(json?.vehicles) ? json.vehicles : []
            rows = all.filter((v: any) => String(v?.user_id ?? '').trim() === String(userId).trim())
          }
        }

        let max = 0
        let found = false

        for (const r of rows) {
          const raw = String((r as any)?.stock_number ?? '').trim()
          if (!raw) continue
          const n = extractNumericSuffix(raw)
          if (n === null) continue
          found = true
          if (n > max) max = n
        }

        if (!alive) return
        if (!found) {
          stockAutofillRanRef.current = true
          setFormData((prev: any) => {
            const prevStock = String(prev?.stockNumber ?? '').trim()
            if (prevStock) return prev
            return { ...prev, stockNumber: '1000' }
          })
          return
        }

        stockAutofillRanRef.current = true
        setFormData((prev: any) => {
          const prevStock = String(prev?.stockNumber ?? '').trim()
          if (prevStock) return prev
          return { ...prev, stockNumber: String(max + 1) }
        })
      } catch {
        // ignore
      }
    }

    void loadNextStockNumber()
    return () => {
      alive = false
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData?.stockNumber, webhookUserId])

  const enableAllTabs = true

  useEffect(() => {
    if (!createdVehicleId) {
      setDisclosuresSaved(false)
      setPurchaseSaved(false)
      setCostsSaved(false)
    }
  }, [createdVehicleId])

  useEffect(() => {
    if (!formData?.vin || formData.vin !== lastVinSent) {
      setVinPrefilled(false)
    }
  }, [formData?.vin, lastVinSent])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    if (name === 'stockNumber') {
      setFormData({ ...formData, stockNumber: value })
      setStockNumberTaken(false)
      if (stockCheckTimerRef.current) clearTimeout(stockCheckTimerRef.current)
      const trimmed = value.trim()
      if (!trimmed) return
      setStockChecking(true)
      stockCheckTimerRef.current = setTimeout(async () => {
        try {
          const normalizedInput = normalizeStockNumber(trimmed)
          const { data } = await supabase
            .from('edc_vehicles')
            .select('stock_number')
            .limit(500)
          const taken = Array.isArray(data)
            && data.some((row: any) => normalizeStockNumber(String(row?.stock_number ?? '')) === normalizedInput)
          setStockNumberTaken(taken)
        } catch {
          setStockNumberTaken(false)
        } finally {
          setStockChecking(false)
        }
      }, 500)
      return
    }
    if (name === 'vin') {
      setFormData({ ...formData, vin: value })
      setVinDuplicate(false)
      if (vinCheckTimerRef.current) clearTimeout(vinCheckTimerRef.current)
      const trimmed = value.trim()
      if (trimmed.length < 5) {
        setVinDuplicate(false)
        return
      }
      setVinChecking(true)
      vinCheckTimerRef.current = setTimeout(async () => {
        try {
          const { count } = await supabase
            .from('edc_vehicles')
            .select('id', { count: 'exact', head: true })
            .eq('vin', trimmed)
          setVinDuplicate((count ?? 0) > 0)
        } catch {
          setVinDuplicate(false)
        } finally {
          setVinChecking(false)
        }
      }, 600)
      return
    }
    setFormData({ ...formData, [name]: value })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting) return

    // Stock# duplicate check before submitting
    const stockToCheck = String((formData as any)?.stockNumber || '').trim()
    if (stockToCheck) {
      const normalizedStock = normalizeStockNumber(stockToCheck)
      const { data: stockData } = await supabase
        .from('edc_vehicles')
        .select('stock_number')
        .limit(500)
      const stockTaken = Array.isArray(stockData)
        && stockData.some((row: any) => normalizeStockNumber(String(row?.stock_number ?? '')) === normalizedStock)
      if (stockTaken) {
        setError('Stock # is already taken, please use another number.')
        return
      }
    }

    // VIN duplicate check before submitting
    const vinToCheck = String((formData as any)?.vin || '').trim()
    if (vinToCheck.length >= 5) {
      const { count: vinCount } = await supabase
        .from('edc_vehicles')
        .select('id', { count: 'exact', head: true })
        .eq('vin', vinToCheck)
      if ((vinCount ?? 0) > 0) {
        setError('VIN code is already taken. Use another VIN code to proceed.')
        return
      }
    }

    setSubmitting(true)
    setError('')

    try {
      const toNumberOrNull = (v: any) => {
        const n = Number(v)
        return Number.isFinite(n) ? n : null
      }
      const toIntOrNull = (v: any) => {
        const n = parseInt(String(v))
        return Number.isFinite(n) ? n : null
      }
      const featuresArr =
        typeof (formData as any).features === 'string'
          ? String((formData as any).features)
              .split(',')
              .map((f) => f.trim())
              .filter(Boolean)
          : Array.isArray((formData as any).features)
            ? (formData as any).features
            : []

      const payload: Record<string, any> = {
        // Optional scoping for backend
        user_id: webhookUserId ?? undefined,
        user_role: userRole ?? undefined,

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
        ad_description: (formData as any).adDescription || null,
        features: featuresArr,
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
        distance_disclaimer: Boolean((formData as any).distanceDisclaimer),
        feed_to_autotrader: Boolean((formData as any).feedToAutotrader),
        feed_to_carpages: Boolean((formData as any).feedToCarpages),
        feed_to_cargurus: Boolean((formData as any).feedToCargurus),
        certified: Boolean((formData as any).certified),
        verified: Boolean((formData as any).verified),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      // If vehicle was already saved to DB, update; otherwise insert
      if (vehicleSavedToDb) {
        // Update existing vehicle
        const { error: updateError } = await supabase
          .from('edc_vehicles')
          .update({
            make: payload.make,
            model: payload.model,
            year: payload.year,
            trim: payload.trim,
            stock_number: payload.stock_number,
            key_number: payload.key_number,
            key_description: payload.key_description,
            series: payload.series,
            equipment: payload.equipment,
            vin: payload.vin,
            price: payload.price,
            mileage: payload.mileage,
            status: payload.status,
            inventory_type: payload.inventory_type,
            fuel_type: payload.fuel_type,
            transmission: payload.transmission,
            body_style: payload.body_style,
            drivetrain: payload.drivetrain,
            city: payload.city,
            province: payload.province,
            exterior_color: payload.exterior_color,
            interior_color: payload.interior_color,
            description: payload.description,
            ad_description: payload.ad_description,
            features: payload.features,
            condition: payload.condition,
            status_colour: payload.status_colour,
            retail_wholesale: payload.retail_wholesale,
            substatus: payload.substatus,
            assignment: payload.assignment,
            lot_location: payload.lot_location,
            keywords: payload.keywords,
            feedwords: payload.feedwords,
            odometer: payload.odometer,
            odometer_unit: payload.odometer_unit,
            in_stock_date: payload.in_stock_date,
            vehicle_type: payload.vehicle_type,
            engine: payload.engine,
            cylinders: payload.cylinders,
            doors: payload.doors,
            other: payload.other,
            notes: payload.notes,
            distance_disclaimer: payload.distance_disclaimer,
            feed_to_autotrader: payload.feed_to_autotrader,
            feed_to_carpages: payload.feed_to_carpages,
            feed_to_cargurus: payload.feed_to_cargurus,
            certified: payload.certified,
            verified: payload.verified,
            updated_at: payload.updated_at,
          })
          .eq('id', dbVehicleId)

        if (updateError) {
          const msg = updateError.message || 'Failed to update vehicle'
          setError(msg)
          setSaveModalTitle('Update Failed')
          setSaveModalMessage(msg)
          setSaveModalOpen(true)
          return
        }

        setSaveModalTitle('Updated')
        setSaveModalMessage('Vehicle updated successfully.')
        setSaveModalOpen(true)
        return
      }

      // Insert new vehicle
      const { data: insertedData, error: insertError } = await supabase
        .from('edc_vehicles')
        .insert({
          user_id: webhookUserId || null,
          vehicleId: createdVehicleId,
          make: payload.make,
          model: payload.model,
          year: payload.year,
          trim: payload.trim,
          stock_number: payload.stock_number,
          key_number: payload.key_number,
          key_description: payload.key_description,
          series: payload.series,
          equipment: payload.equipment,
          vin: payload.vin,
          price: payload.price,
          mileage: payload.mileage,
          status: payload.status,
          inventory_type: payload.inventory_type,
          fuel_type: payload.fuel_type,
          transmission: payload.transmission,
          body_style: payload.body_style,
          drivetrain: payload.drivetrain,
          city: payload.city,
          province: payload.province,
          exterior_color: payload.exterior_color,
          interior_color: payload.interior_color,
          description: payload.description,
          ad_description: payload.ad_description,
          features: payload.features,
          condition: payload.condition,
          status_colour: payload.status_colour,
          retail_wholesale: payload.retail_wholesale,
          substatus: payload.substatus,
          assignment: payload.assignment,
          lot_location: payload.lot_location,
          keywords: payload.keywords,
          feedwords: payload.feedwords,
          odometer: payload.odometer,
          odometer_unit: payload.odometer_unit,
          in_stock_date: payload.in_stock_date,
          vehicle_type: payload.vehicle_type,
          engine: payload.engine,
          cylinders: payload.cylinders,
          doors: payload.doors,
          other: payload.other,
          notes: payload.notes,
          distance_disclaimer: payload.distance_disclaimer,
          feed_to_autotrader: payload.feed_to_autotrader,
          feed_to_carpages: payload.feed_to_carpages,
          feed_to_cargurus: payload.feed_to_cargurus,
          certified: payload.certified,
          verified: payload.verified,
          created_at: payload.created_at,
          updated_at: payload.updated_at,
        })
        .select('id')
        .single()

      if (insertError) {
        const isDuplicate = insertError.message?.toLowerCase().includes('duplicate') || 
                           insertError.message?.toLowerCase().includes('unique')
        if (!isDuplicate) {
          const msg = insertError.message || 'Failed to create vehicle'
          setError(msg)
          setSaveModalTitle('Save Failed')
          setSaveModalMessage(msg)
          setSaveModalOpen(true)
          return
        }
        // If duplicate, try to find existing vehicle
        const stock = String(formData.stockNumber || '').trim()
        const vin = String(formData.vin || '').trim()
        let existingId = ''
        if (stock) {
          const { data } = await supabase
            .from('edc_vehicles')
            .select('id')
            .eq('stock_number', stock)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()
          existingId = (data as any)?.id ? String((data as any).id).trim() : ''
        }
        if (!existingId && vin) {
          const { data } = await supabase
            .from('edc_vehicles')
            .select('id')
            .eq('vin', vin)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()
          existingId = (data as any)?.id ? String((data as any).id).trim() : ''
        }
        if (!existingId) {
          const msg = 'Duplicate vehicle detected but could not locate existing record'
          setSaveModalTitle('Save Failed')
          setSaveModalMessage(msg)
          setSaveModalOpen(true)
          return
        }
        setVehicleSavedToDb(true)
        setDbVehicleId(existingId)
        setSaveModalTitle('Saved')
        setSaveModalMessage('Vehicle already exists. Loaded existing vehicle.')
        setSaveModalOpen(true)
        setAllowNextTabs(true)
        try {
          const snapshot = {
            activeTab: 'details',
            createdVehicleId,
            vehicleSavedToDb: true,
            dbVehicleId: existingId,
            disclosuresSaved: false,
            purchaseSaved: false,
            costsSaved: false,
            formData,
          }
          localStorage.setItem('edc_new_vehicle_wizard', JSON.stringify(snapshot))
        } catch {}
        return
      }

      const rid = insertedData?.id ? String(insertedData.id).trim() : ''
      if (!rid) {
        const msg = 'Vehicle created but ID not returned'
        setSaveModalTitle('Save Failed')
        setSaveModalMessage(msg)
        setSaveModalOpen(true)
        return
      }

      setVehicleSavedToDb(true)
      setDbVehicleId(rid)
      // Clear stored ID so next "Add New Vehicle" generates a fresh one
      try { localStorage.removeItem('edc_new_vehicle_id') } catch {}
      setSaveModalTitle('Vehicle Saved')
      setSaveModalMessage('Vehicle saved successfully.')
      setSaveModalOpen(true)
      setAllowNextTabs(true)
      try {
        const snapshot = {
          activeTab: 'details',
          createdVehicleId,
          vehicleSavedToDb: true,
          dbVehicleId: rid,
          disclosuresSaved: false,
          purchaseSaved: false,
          costsSaved: false,
          formData,
        }
        localStorage.setItem('edc_new_vehicle_wizard', JSON.stringify(snapshot))
      } catch {}
    } catch (err: any) {
      console.error('Error creating vehicle via webhook:', err)
      const msg = String(err?.message || 'Unexpected error')
      setError(msg)
      setSaveModalTitle('Save Failed')
      setSaveModalMessage(msg)
      setSaveModalOpen(true)
    } finally {
      setSubmitting(false)
    }
  }

  // Removed tab locking - allow free navigation even if saves fail

  const handleSendVin = async () => {
    if (!formData?.vin || String(formData.vin).trim().length < 5) {
      alert('Please enter a valid VIN before sending.')
      return
    }
    try {
      const user_id = webhookUserId ?? (await getWebhookUserId())

      let email = ''
      try {
        if (typeof window !== 'undefined') {
          const raw = window.localStorage.getItem('edc_admin_session')
          if (raw) {
            const parsed = JSON.parse(raw) as { email?: string }
            email = String(parsed?.email || '').trim().toLowerCase()
          }
        }
      } catch {
        email = ''
      }

      if (!email) throw new Error('Missing email')

      const cost = 0.5
      const shouldSkipConfirm = (() => {
        try {
          return typeof window !== 'undefined' && window.localStorage.getItem('edc_skip_vincode_confirm') === '1'
        } catch {
          return false
        }
      })()

      const balRes = await fetch('/api/users/balance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const balJson = await balRes.json().catch(() => null)
      const balance = Number((balJson as any)?.balance ?? 0)
      if (!Number.isFinite(balance) || balance < cost) {
        setVinInsufficientMessage(`Insufficient Load Balance. You need $0.50 to decode this VIN, but your balance is $${Number.isFinite(balance) ? balance.toFixed(2) : '0.00'}.`)
        setVinInsufficientOpen(true)
        return
      }

      const runDecode = async () => {
        setSendingVin(true)
        try {
          const res = await fetch('/api/vincode', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              user_id,
              email,
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
          setVinPrefilled(true)
          setLastVinSent(String(formData.vin).trim())
        } finally {
          setSendingVin(false)
        }
      }

      if (shouldSkipConfirm) {
        await runDecode()
        return
      }

      setVinConfirmBalance(balance)
      setVinConfirmDontShow(false)
      vinConfirmActionRef.current = async () => {
        await runDecode()
      }
      setVinConfirmOpen(true)
    } catch (e: any) {
      setError(e?.message || 'Failed to send VIN')
    } finally {
      setSendingVin(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {vinConfirmOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-navy-900/60 backdrop-blur-sm" onMouseDown={() => setVinConfirmOpen(false)} />
          <div className="edc-modal w-full max-w-md relative z-10" onMouseDown={(e) => e.stopPropagation()}>
            <div className="h-11 px-4 border-b border-slate-200/60 flex items-center justify-between">
              <div className="text-sm font-semibold text-slate-800">Vincode Decode</div>
              <button type="button" className="h-8 w-8 flex items-center justify-center" onClick={() => setVinConfirmOpen(false)}>
                <span className="text-xl leading-none text-slate-400">×</span>
              </button>
            </div>
            <div className="p-4 text-sm text-slate-700">
              <div>This action will decode the VIN using Load Balance.</div>
              <div className="mt-2 font-semibold text-slate-900">Cost: $0.50</div>
              {vinConfirmBalance != null ? (
                <div className="mt-1 text-xs text-slate-500">Your balance: ${vinConfirmBalance.toFixed(2)}</div>
              ) : null}
              <div className="mt-4 flex items-center gap-2">
                <input
                  id="vincodeDontShowNewInv"
                  type="checkbox"
                  checked={vinConfirmDontShow}
                  onChange={(e) => setVinConfirmDontShow(e.target.checked)}
                  className="h-4 w-4"
                />
                <label htmlFor="vincodeDontShowNewInv" className="text-xs text-slate-600">
                  Don’t show again
                </label>
              </div>
            </div>
            <div className="h-12 px-4 border-t border-slate-200/60 flex items-center justify-end gap-2">
              <button type="button" className="h-9 px-4 rounded-lg bg-slate-100 text-slate-700 text-sm font-semibold" onClick={() => setVinConfirmOpen(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="h-9 px-4 rounded-lg bg-[#118df0] text-white text-sm font-semibold disabled:opacity-60"
                disabled={sendingVin}
                onClick={async () => {
                  const fn = vinConfirmActionRef.current
                  setVinConfirmOpen(false)
                  if (!fn) return
                  try {
                    if (vinConfirmDontShow) {
                      try {
                        if (typeof window !== 'undefined') window.localStorage.setItem('edc_skip_vincode_confirm', '1')
                      } catch {}
                    }
                    await fn()
                  } catch (err: any) {
                    setError(err?.message || 'Failed to decode VIN')
                  }
                }}
              >
                {sendingVin ? 'Processing…' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {vinInsufficientOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-navy-900/60 backdrop-blur-sm" onMouseDown={() => setVinInsufficientOpen(false)} />
          <div className="edc-modal w-full max-w-md relative z-10" onMouseDown={(e) => e.stopPropagation()}>
            <div className="h-11 px-4 border-b border-slate-200/60 flex items-center justify-between">
              <div className="text-sm font-semibold text-slate-800">Insufficient Balance</div>
              <button type="button" className="h-8 w-8 flex items-center justify-center" onClick={() => setVinInsufficientOpen(false)}>
                <span className="text-xl leading-none text-slate-400">×</span>
              </button>
            </div>
            <div className="p-4 text-sm text-slate-700">{vinInsufficientMessage || 'Insufficient Load Balance.'}</div>
            <div className="h-12 px-4 border-t border-slate-200/60 flex items-center justify-end gap-2">
              <button type="button" className="edc-btn-primary h-9 px-4 text-sm" onClick={() => setVinInsufficientOpen(false)}>
                OK
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {saveModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">{saveModalTitle}</h3>
            </div>
            <div className="px-6 py-4 text-sm text-gray-700 whitespace-pre-line">
              {saveModalMessage}
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setSaveModalOpen(false)
                  if (pendingNextTab) {
                    setActiveTab(pendingNextTab)
                    setPendingNextTab(null)
                  }
                }}
                className="px-4 py-2 bg-[#118df0] text-white rounded-md hover:bg-[#0d6ebd]"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-6">
            <h1 className="text-3xl font-bold text-gray-900">Add New Vehicle</h1>
            <p className="mt-2 text-gray-600">Create a new inventory listing</p>
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
              className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'details'
                  ? 'border-black text-black'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <CarFront className={`w-4 h-4 ${activeTab === 'details' ? 'text-black' : 'text-gray-500'}`} />
              Vehicle Details
            </button>
            <button
              type="button"
              onClick={() => enableAllTabs && setActiveTab('disclosures')}
              disabled={!enableAllTabs}
              className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'disclosures'
                  ? 'border-black text-black'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } ${!enableAllTabs ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <ClipboardList className={`w-4 h-4 ${activeTab === 'disclosures' ? 'text-black' : 'text-gray-500'}`} />
              Disclosures
            </button>
            <button
              type="button"
              onClick={() => enableAllTabs && setActiveTab('purchase')}
              disabled={!enableAllTabs}
              className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'purchase'
                  ? 'border-black text-black'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } ${!enableAllTabs ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <BadgeDollarSign className={`w-4 h-4 ${activeTab === 'purchase' ? 'text-black' : 'text-gray-500'}`} />
              Purchase
            </button>
            <button
              type="button"
              onClick={() => enableAllTabs && setActiveTab('costs')}
              disabled={!enableAllTabs}
              className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'costs'
                  ? 'border-black text-black'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } ${!enableAllTabs ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <Receipt className={`w-4 h-4 ${activeTab === 'costs' ? 'text-black' : 'text-gray-500'}`} />
              Costs
            </button>
            <button
              type="button"
              onClick={() => enableAllTabs && setActiveTab('warranty')}
              disabled={!enableAllTabs}
              className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'warranty'
                  ? 'border-black text-black'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } ${!enableAllTabs ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <ShieldCheck className={`w-4 h-4 ${activeTab === 'warranty' ? 'text-black' : 'text-gray-500'}`} />
              Warranty
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow p-8">
          {gatingError ? (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
              {gatingError}
            </div>
          ) : null}
          {null}

          {/* Vehicle Details Tab - Dealerpull Style */}
          {activeTab === 'details' && (
            <div className="space-y-6">
              {/* Top Row: Toggles */}
              <div className="flex justify-end items-center gap-6 mb-4">
                <label className="flex items-center gap-2 text-sm">
                  <span>CERTIFIED/AS-IS</span>
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, certified: !prev.certified }))}
                    className={`relative w-12 h-6 rounded-full transition-colors ${formData.certified ? 'bg-[#118df0]' : 'bg-gray-300'}`}
                  >
                    <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${formData.certified ? 'right-1' : 'left-1'}`}></span>
                  </button>
                  <span className="text-xs px-2 py-0.5 rounded bg-green-100 text-green-700">CERT</span>
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <span>Verified?</span>
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, verified: !prev.verified }))}
                    className={`relative w-12 h-6 rounded-full transition-colors ${formData.verified ? 'bg-[#118df0]' : 'bg-gray-300'}`}
                  >
                    <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${formData.verified ? 'right-1' : 'left-1'}`}></span>
                  </button>
                  <span className="text-xs px-2 py-0.5 rounded bg-yellow-100 text-yellow-700">YB</span>
                </label>
              </div>

              {/* Row 1: Condition, Status, Status Colour, Retail/Wholesale */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Condition</label>
                  <select name="condition" value={formData.condition} onChange={handleChange} className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-1 focus:ring-[#118df0] focus:border-[#118df0]">
                    <option value="New">New</option>
                    <option value="Used">Used</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Status</label>
                  <select name="status" value={formData.status} onChange={handleChange} className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-1 focus:ring-[#118df0] focus:border-[#118df0]">
                    <option value="In Stock">In Stock</option>
                    <option value="Pending">Pending</option>
                    <option value="Sold">Sold</option>
                    <option value="On Order">On Order</option>
                    <option value="In Transit">In Transit</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Status Colour</label>
                  <select name="statusColour" value={formData.statusColour} onChange={handleChange} className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-1 focus:ring-[#118df0] focus:border-[#118df0]">
                    <option value="">Colour</option>
                    <option value="Green">Green</option>
                    <option value="Black">Black</option>
                    <option value="Grey">Grey</option>
                    <option value="Blue">Blue</option>
                    <option value="Yellow">Yellow</option>
                    <option value="Orange">Orange</option>
                    <option value="Red">Red</option>
                    <option value="Purple">Purple</option>
                    <option value="Pink">Pink</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Retail/Wholesale</label>
                  <select name="retailWholesale" value={formData.retailWholesale} onChange={handleChange} className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-1 focus:ring-[#118df0] focus:border-[#118df0]">
                    <option value="">Classification</option>
                    <option value="Wholesale">Wholesale</option>
                    <option value="Retail">Retail</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              {/* Row 2: Substatuses, Assignment */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm text-gray-600 mb-1">Substatuses</label>
                  <input type="text" name="substatus" value={formData.substatus} onChange={handleChange} placeholder="Substatus" className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-1 focus:ring-[#118df0] focus:border-[#118df0]" />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1 flex items-center gap-1">Assignment <span className="text-blue-500 cursor-help" title="Assign to a user">ⓘ</span></label>
                  <select name="assignment" value={formData.assignment} onChange={handleChange} className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-1 focus:ring-[#118df0] focus:border-[#118df0]">
                    <option value="">None</option>
                    {assignmentUsers.map((u) => {
                      const name = displayUserName(u)
                      return name ? (
                        <option key={u.id} value={name}>{name}</option>
                      ) : null
                    })}
                  </select>
                </div>
              </div>

              {/* Row 3: Stock #, In Stock Date */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Stock #</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">#</span>
                    <input
                      type="text"
                      name="stockNumber"
                      value={formData.stockNumber}
                      onChange={handleChange}
                      placeholder="1012"
                      className={`w-full border rounded pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-1 ${
                        stockNumberTaken
                          ? 'border-red-500 bg-red-50 text-red-700 focus:ring-red-400 focus:border-red-500'
                          : 'border-gray-300 bg-white text-gray-700 focus:ring-[#118df0] focus:border-[#118df0]'
                      }`}
                    />
                  </div>
                  {stockNumberTaken && (
                    <p className="mt-1 text-xs text-red-600 font-medium">Stock # is already taken, please use another number.</p>
                  )}
                  {stockChecking && (
                    <p className="mt-1 text-xs text-gray-400">Checking availability…</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">In Stock Date</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">📅</span>
                    <input type="date" name="inStockDate" value={formData.inStockDate} onChange={handleChange} className="w-full border border-gray-300 rounded pl-10 pr-3 py-2 text-sm focus:ring-1 focus:ring-[#118df0] focus:border-[#118df0]" />
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
                      <input
                        type="text"
                        name="vin"
                        value={formData.vin}
                        onChange={handleChange}
                        placeholder="VIN"
                        className={`w-full border rounded-l pl-8 pr-3 py-2 text-sm focus:ring-1 ${
                          vinDuplicate
                            ? 'border-red-500 bg-red-50 text-red-700 focus:ring-red-400 focus:border-red-500'
                            : 'border-gray-300 bg-white text-gray-700 focus:ring-[#118df0] focus:border-[#118df0]'
                        }`}
                      />
                      {vinChecking && (
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">checking…</span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={handleSendVin}
                      disabled={sendingVin}
                      className="px-4 py-2 bg-[#118df0] text-white text-sm font-medium rounded-r hover:bg-[#0d6ebd] disabled:opacity-50"
                    >
                      {sendingVin ? '...' : 'Decode'}
                    </button>
                  </div>
                  {vinDuplicate && (
                    <p className="mt-1 text-xs text-red-600 font-medium">VIN code is already taken. Use another VIN code to proceed.</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Odometer</label>
                  <div className="flex">
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">⊕</span>
                      <input type="number" name="odometer" value={formData.odometer} onChange={handleChange} placeholder="odometer" className="w-full border border-gray-300 rounded-l pl-8 pr-3 py-2 text-sm focus:ring-1 focus:ring-[#118df0] focus:border-[#118df0]" />
                    </div>
                    <select name="odometerUnit" value={formData.odometerUnit} onChange={handleChange} className="border border-l-0 border-gray-300 rounded-r px-3 py-2 text-sm bg-white focus:ring-1 focus:ring-[#118df0] focus:border-[#118df0]">
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
                  checked={formData.distanceDisclaimer}
                  onChange={(e) => setFormData(prev => ({ ...prev, distanceDisclaimer: e.target.checked }))}
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
                    <input type="number" name="year" value={formData.year} onChange={handleChange} placeholder="year" className="w-full border border-gray-300 rounded pl-10 pr-3 py-2 text-sm focus:ring-1 focus:ring-[#118df0] focus:border-[#118df0]" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Make</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🚗</span>
                    <input type="text" name="make" value={formData.make} onChange={handleChange} placeholder="make" className="w-full border border-gray-300 rounded pl-10 pr-3 py-2 text-sm focus:ring-1 focus:ring-[#118df0] focus:border-[#118df0]" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Model</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">⚙</span>
                    <input type="text" name="model" value={formData.model} onChange={handleChange} placeholder="model" className="w-full border border-gray-300 rounded pl-10 pr-3 py-2 text-sm focus:ring-1 focus:ring-[#118df0] focus:border-[#118df0]" />
                  </div>
                  {!formData.model && <p className="text-xs text-red-500 mt-1">Please enter a model</p>}
                </div>
              </div>

              {/* Row 6: Trim, Vehicle Type, Body Type */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Trim</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">✂</span>
                    <input type="text" name="trim" value={formData.trim} onChange={handleChange} placeholder="trim" className="w-full border border-gray-300 rounded pl-10 pr-3 py-2 text-sm focus:ring-1 focus:ring-[#118df0] focus:border-[#118df0]" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Vehicle Type</label>
                  <select name="vehicleType" value={formData.vehicleType} onChange={handleChange} className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-1 focus:ring-[#118df0] focus:border-[#118df0]">
                    <option value="">Vehicle Type</option>
                    <option value="Car">Car</option>
                    <option value="Van">Van</option>
                    <option value="MiniVan">MiniVan</option>
                    <option value="SUV">SUV</option>
                    <option value="Truck">Truck</option>
                    <option value="Heavy Truck">Heavy Truck</option>
                    <option value="Transport Trailer">Transport Trailer</option>
                    <option value="Boat">Boat</option>
                    <option value="RV">RV</option>
                    <option value="ATV">ATV</option>
                    <option value="Motorcycle">Motorcycle</option>
                    <option value="Snowmobile">Snowmobile</option>
                    <option value="Farm Equipment">Farm Equipment</option>
                    <option value="Heavy Equipment">Heavy Equipment</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Body Type</label>
                  <select name="bodyStyle" value={formData.bodyStyle} onChange={handleChange} className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-1 focus:ring-[#118df0] focus:border-[#118df0]">
                    <option value="">Body Style</option>
                    <option value="4 Door Hatchback">4 Door Hatchback</option>
                    <option value="2 Door Hatchback">2 Door Hatchback</option>
                    <option value="2 Door SUV">2 Door SUV</option>
                    <option value="4 Door SUV">4 Door SUV</option>
                    <option value="Cargo Minivan">Cargo Minivan</option>
                    <option value="Cargo Van">Cargo Van</option>
                    <option value="Convertible">Convertible</option>
                    <option value="Convertible SUV">Convertible SUV</option>
                    <option value="Crew Cab Pickup">Crew Cab Pickup</option>
                    <option value="Ext Cab Pickup">Ext Cab Pickup</option>
                    <option value="Passenger Minivan">Passenger Minivan</option>
                    <option value="Passenger Van">Passenger Van</option>
                    <option value="Regular Cab Pickup">Regular Cab Pickup</option>
                    <option value="Coupe">Coupe</option>
                    <option value="Sedan">Sedan</option>
                    <option value="Wagon">Wagon</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              {/* Engine Section */}
              <div className="border-t border-gray-200 pt-4">
                <h3 className="text-sm font-semibold text-gray-800 mb-4">Engine</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Engine</label>
                    <input type="text" name="engine" value={formData.engine} onChange={handleChange} placeholder="engine" className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-1 focus:ring-[#118df0] focus:border-[#118df0]" />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Cylinders</label>
                    <input type="text" name="cylinders" value={formData.cylinders} onChange={handleChange} placeholder="cylinders" className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-1 focus:ring-[#118df0] focus:border-[#118df0]" />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Fuel Type</label>
                    <select name="fuelType" value={formData.fuelType} onChange={handleChange} className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-1 focus:ring-[#118df0] focus:border-[#118df0]">
                      <option value="">Fuel Type</option>
                      <option value="Gasoline">Gasoline</option>
                      <option value="Diesel">Diesel</option>
                      <option value="Hybrid">Hybrid</option>
                      <option value="Electric">Electric</option>
                      <option value="Natural Gas">Natural Gas</option>
                      <option value="Flex Fuel">Flex Fuel</option>
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
                    <select name="transmission" value={formData.transmission} onChange={handleChange} className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-1 focus:ring-[#118df0] focus:border-[#118df0]">
                      <option value="">Transmission Type</option>
                      <option value="Manual-5">Manual-5</option>
                      <option value="Manual-6">Manual-6</option>
                      <option value="Tiptronic">Tiptronic</option>
                      <option value="Automatic">Automatic</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Drive Type</label>
                    <select name="drivetrain" value={formData.drivetrain} onChange={handleChange} className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-1 focus:ring-[#118df0] focus:border-[#118df0]">
                      <option value="">Drive Type</option>
                      <option value="FWD">FWD</option>
                      <option value="RWD">RWD</option>
                      <option value="AWD">AWD</option>
                      <option value="4X4">4X4</option>
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
                    <input type="text" name="doors" value={formData.doors} onChange={handleChange} placeholder="door qty" className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-1 focus:ring-[#118df0] focus:border-[#118df0]" />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Exterior Colour</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🎨</span>
                      <input type="text" name="exteriorColor" value={formData.exteriorColor} onChange={handleChange} placeholder="exterior colour" className="w-full border border-gray-300 rounded pl-10 pr-3 py-2 text-sm focus:ring-1 focus:ring-[#118df0] focus:border-[#118df0]" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Interior Colour</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🎨</span>
                      <input type="text" name="interiorColor" value={formData.interiorColor} onChange={handleChange} placeholder="interior colour" className="w-full border border-gray-300 rounded pl-10 pr-3 py-2 text-sm focus:ring-1 focus:ring-[#118df0] focus:border-[#118df0]" />
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Key #</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔑</span>
                      <input type="text" name="keyNumber" value={formData.keyNumber} onChange={handleChange} placeholder="key #" className="w-full border border-gray-300 rounded pl-10 pr-3 py-2 text-sm focus:ring-1 focus:ring-[#118df0] focus:border-[#118df0]" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Key Description</label>
                    <textarea name="keyDescription" value={formData.keyDescription} onChange={handleChange} placeholder="description" rows={3} className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-1 focus:ring-[#118df0] focus:border-[#118df0]"></textarea>
                  </div>
                </div>
              </div>

              {/* Lot Location, Other, Notes */}
              <div className="border-t border-gray-200 pt-4 space-y-4">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Lot Location</label>
                  <textarea name="lotLocation" value={formData.lotLocation} onChange={handleChange} placeholder="Ex: At auction" rows={3} className="w-full max-w-md border border-gray-300 rounded px-3 py-2 text-sm focus:ring-1 focus:ring-[#118df0] focus:border-[#118df0]"></textarea>
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Other</label>
                  <input type="text" name="other" value={formData.other} onChange={handleChange} placeholder="Ex: paid" className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-1 focus:ring-[#118df0] focus:border-[#118df0]" />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Notes</label>
                  <textarea name="notes" value={formData.notes} onChange={handleChange} placeholder="Ex: Has funny smell." rows={4} className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-1 focus:ring-[#118df0] focus:border-[#118df0]"></textarea>
                </div>
              </div>

              {/* Inventory Export Feeds */}
              <div className="border-t border-gray-200 pt-4">
                <h3 className="text-sm font-semibold text-gray-800 mb-2">Inventory Export Feeds</h3>
                <p className="text-xs text-gray-500 mb-4">The integration feeds you have enabled will be shown below. To begin sending this inventory unit to a feed just toggle the feed you want to send it to below. The inventory will be added to the feed during the next update process which occurs every evening at 10:00pm EST.</p>
                <div className="space-y-2">
                  <div className="flex items-center gap-4">
                    <span className="text-sm w-32">Feed to AutoTrader?</span>
                    <button type="button" onClick={() => setFormData(prev => ({ ...prev, feedToAutotrader: !prev.feedToAutotrader }))} className={`relative w-12 h-6 rounded-full transition-colors ${formData.feedToAutotrader ? 'bg-[#118df0]' : 'bg-gray-300'}`}>
                      <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${formData.feedToAutotrader ? 'right-1' : 'left-1'}`}></span>
                    </button>
                    <span className="text-sm text-gray-500">0</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm w-32">Feed to Carpages?</span>
                    <button type="button" onClick={() => setFormData(prev => ({ ...prev, feedToCarpages: !prev.feedToCarpages }))} className={`relative w-12 h-6 rounded-full transition-colors ${formData.feedToCarpages ? 'bg-[#118df0]' : 'bg-gray-300'}`}>
                      <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${formData.feedToCarpages ? 'right-1' : 'left-1'}`}></span>
                    </button>
                    <span className="text-sm text-gray-500">0</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm w-32">Feed to Cargurus?</span>
                    <button type="button" onClick={() => setFormData(prev => ({ ...prev, feedToCargurus: !prev.feedToCargurus }))} className={`relative w-12 h-6 rounded-full transition-colors ${formData.feedToCargurus ? 'bg-[#118df0]' : 'bg-gray-300'}`}>
                      <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${formData.feedToCargurus ? 'right-1' : 'left-1'}`}></span>
                    </button>
                    <span className="text-sm text-gray-500">0</span>
                  </div>
                </div>

                {/* Tips */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  <div className="bg-blue-50 border border-blue-200 rounded p-3">
                    <p className="text-xs text-blue-800"><strong>ⓘ Tip:</strong> Add your keywords below instead of the trim field above to give your ads a bit more information. These will get appended to your trim when we feed to 3rd party listings.</p>
                  </div>
                  <div className="bg-blue-50 border border-blue-200 rounded p-3">
                    <p className="text-xs text-blue-800"><strong>ⓘ Tip:</strong> Add your feedwords below to send additional information to your website provider.</p>
                  </div>
                </div>

                {/* Keywords and Feedwords */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Keywords</label>
                    <input type="text" name="keywords" value={formData.keywords} onChange={handleChange} className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-1 focus:ring-[#118df0] focus:border-[#118df0]" />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Feedwords</label>
                    <input type="text" name="feedwords" value={formData.feedwords} onChange={handleChange} placeholder="Add feedword" className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-1 focus:ring-[#118df0] focus:border-[#118df0]" />
                  </div>
                </div>
              </div>

              {/* Advertisement Description */}
              <div className="border-t border-gray-200 pt-4">
                <h3 className="text-sm font-semibold text-gray-800 mb-2">Advertisement Description</h3>
                <div className="border border-gray-300 rounded">
                  <div className="flex flex-wrap items-center gap-1 p-2 border-b border-gray-300 bg-gray-50">
                    <button type="button" onMouseDown={preventToolbarMouseDown} onClick={() => exec('bold')} className={`px-2 py-1 border border-gray-300 rounded text-sm font-bold ${adToolbar.bold ? 'bg-[#118df0] text-white' : 'bg-white'}`}>B</button>
                    <button type="button" onMouseDown={preventToolbarMouseDown} onClick={() => exec('italic')} className={`px-2 py-1 border border-gray-300 rounded text-sm italic ${adToolbar.italic ? 'bg-[#118df0] text-white' : 'bg-white'}`}>I</button>
                    <button type="button" onMouseDown={preventToolbarMouseDown} onClick={() => exec('underline')} className={`px-2 py-1 border border-gray-300 rounded text-sm underline ${adToolbar.underline ? 'bg-[#118df0] text-white' : 'bg-white'}`}>U</button>
                    <button type="button" onClick={() => exec('justifyLeft')} className="px-2 py-1 border border-gray-300 bg-white rounded text-sm">≡</button>
                    <span className="w-px h-6 bg-gray-300 mx-1"></span>
                    <button type="button" onMouseDown={preventToolbarMouseDown} onClick={() => exec('strikeThrough')} className={`px-2 py-1 border border-gray-300 rounded text-sm line-through ${adToolbar.strike ? 'bg-[#118df0] text-white' : 'bg-white'}`}>S</button>
                    <button type="button" onMouseDown={preventToolbarMouseDown} onClick={() => exec('superscript')} className={`px-2 py-1 border border-gray-300 rounded text-sm ${adToolbar.superscript ? 'bg-[#118df0] text-white' : 'bg-white'}`}>X²</button>
                    <button type="button" onMouseDown={preventToolbarMouseDown} onClick={() => exec('subscript')} className={`px-2 py-1 border border-gray-300 rounded text-sm ${adToolbar.subscript ? 'bg-[#118df0] text-white' : 'bg-white'}`}>X₂</button>
                    <span className="w-px h-6 bg-gray-300 mx-1"></span>
                    <select
                      className="border border-gray-300 bg-white rounded px-2 py-1 text-sm"
                      onChange={(e) => {
                        const v = e.target.value
                        if (!v) return
                        exec('fontSize', v)
                        e.currentTarget.selectedIndex = 0
                      }}
                      defaultValue=""
                    >
                      <option value="">16</option>
                      <option value="2">12</option>
                      <option value="3">14</option>
                      <option value="4">16</option>
                      <option value="5">18</option>
                      <option value="6">24</option>
                    </select>
                    <input
                      type="color"
                      value={adToolbar.foreColor}
                      onChange={(e) => {
                        setAdToolbar(prev => ({ ...prev, foreColor: e.target.value }))
                        exec('foreColor', e.target.value)
                      }}
                      className="w-8 h-8 p-0 border border-gray-300 rounded"
                    />
                    <button type="button" onMouseDown={preventToolbarMouseDown} onClick={() => exec('insertUnorderedList')} className={`px-2 py-1 border border-gray-300 rounded text-sm ${adToolbar.unordered ? 'bg-[#118df0] text-white' : 'bg-white'}`}>•</button>
                    <button type="button" onMouseDown={preventToolbarMouseDown} onClick={() => exec('insertOrderedList')} className={`px-2 py-1 border border-gray-300 rounded text-sm ${adToolbar.ordered ? 'bg-[#118df0] text-white' : 'bg-white'}`}>1.</button>
                    <button type="button" disabled className="px-2 py-1 border border-gray-300 bg-white rounded text-sm opacity-50">Tx</button>
                    <button type="button" disabled className="px-2 py-1 border border-gray-300 bg-white rounded text-sm opacity-50">&lt;/&gt;</button>
                  </div>
                  <div
                    ref={adEditorRef}
                    contentEditable
                    suppressContentEditableWarning
                    onInput={handleAdInput}
                    onMouseUp={refreshAdToolbar}
                    onKeyUp={refreshAdToolbar}
                    onFocus={refreshAdToolbar}
                    className="w-full p-4 focus:outline-none text-sm min-h-[200px]"
                  />
                </div>
              </div>

              {/* History Section */}
              <div className="border-t border-gray-200 pt-4">
                <h3 className="text-sm font-semibold text-gray-800 mb-2">History</h3>
                <div className="border border-gray-300 rounded p-4 min-h-[100px] bg-gray-50">
                  <p className="text-sm text-gray-400">No history available</p>
                </div>
              </div>

              {/* Save/Update Button */}
              <div className="flex justify-end pt-4">
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-8 py-2 bg-[#118df0] text-white font-medium rounded hover:bg-[#0d6ebd] disabled:opacity-50 transition-colors"
                >
                  {submitting ? (vehicleSavedToDb ? 'Updating...' : 'Saving...') : (vehicleSavedToDb ? 'Update' : 'Save')}
                </button>
              </div>
            </div>
          )}

          {/* Other Tabs */}
          {activeTab === 'disclosures' && (
            <div>
              <DisclosuresTab
                ref={disclosuresTabRef}
                vehicleId={createdVehicleId}
                userId={webhookUserId}
                onError={(msg) => setError(msg)}
                hideSaveButton
              />
              <div className="mt-6">
                <button
                  type="button"
                  onClick={async () => {
                    if (nextPurchaseSaving) return
                    try {
                      setError('')
                      setNextPurchaseSaving(true)
                      const ok = await disclosuresTabRef.current?.save?.()
                      if (ok) {
                        setDisclosuresSaved(true)
                        setPendingNextTab(null)
                        setSaveModalTitle('Saved')
                        setSaveModalMessage('Disclosures saved successfully.')
                        setSaveModalOpen(true)
                      } else {
                        const msg = error || 'Save failed. Please check your disclosures.'
                        setPendingNextTab(null)
                        setSaveModalTitle('Save Failed')
                        setSaveModalMessage(msg)
                        setSaveModalOpen(true)
                      }
                    } finally {
                      setNextPurchaseSaving(false)
                    }
                  }}
                  disabled={nextPurchaseSaving}
                  className="w-full bg-[#118df0] text-white py-3 rounded-lg font-semibold hover:bg-[#0d6ebd] transition-colors disabled:opacity-50"
                >
                  {nextPurchaseSaving ? (disclosuresSaved ? 'Updating...' : 'Saving...') : (disclosuresSaved ? 'Edit Disclosures' : 'Save Disclosures')}
                </button>
              </div>
            </div>
          )}
          {activeTab === 'purchase' && (
            <div>
              <PurchaseTab
                ref={purchaseTabRef}
                vehicleId={createdVehicleId}
                userId={webhookUserId}
                stockNumber={formData.stockNumber}
                onError={(msg) => setError(msg)}
                hideSaveButton
              />
              <div className="mt-6">
                <button
                  type="button"
                  onClick={async () => {
                    if (nextCostsSaving) return
                    try {
                      setError('')
                      setNextCostsSaving(true)
                      const ok = await purchaseTabRef.current?.save?.()
                      if (ok) {
                        const data = purchaseTabRef.current?.getData?.() || {}
                        const purchasePrice = Number((data as any)?.purchasePrice || 0)
                        if (!Number.isNaN(purchasePrice) && purchasePrice > 0) {
                          setFormData(prev => ({ ...prev, price: String(purchasePrice) }))
                        }
                        setPurchaseSaved(true)
                        setPendingNextTab(null)
                        setSaveModalTitle('Saved')
                        setSaveModalMessage('Purchase info saved successfully.')
                        setSaveModalOpen(true)
                      } else {
                        const msg = error || 'Save failed. Please check your purchase info.'
                        setPendingNextTab(null)
                        setSaveModalTitle('Save Failed')
                        setSaveModalMessage(msg)
                        setSaveModalOpen(true)
                      }
                    } finally {
                      setNextCostsSaving(false)
                    }
                  }}
                  disabled={nextCostsSaving}
                  className="w-full bg-[#118df0] text-white py-3 rounded-lg font-semibold hover:bg-[#0d6ebd] transition-colors disabled:opacity-50"
                >
                  {nextCostsSaving ? (purchaseSaved ? 'Updating...' : 'Saving...') : (purchaseSaved ? 'Edit Purchase Info' : 'Save Purchase Info')}
                </button>
              </div>
            </div>
          )}
          {activeTab === 'costs' && (
            <div>
              <CostsTab
                ref={costsTabRef}
                vehicleId={createdVehicleId}
                userId={webhookUserId}
                vehiclePrice={parseFloat(String(formData.price || 0)) || 0}
                stockNumber={formData.stockNumber || ''}
                onError={(msg) => setError(msg)}
              />
              <div className="mt-6">
                <button
                  type="button"
                  onClick={async () => {
                    if (nextWarrantySaving) return
                    try {
                      setError('')
                      setNextWarrantySaving(true)
                      const ok = await costsTabRef.current?.save?.()
                      if (ok) {
                        setCostsSaved(true)
                        setPendingNextTab(null)
                        setSaveModalTitle('Saved')
                        setSaveModalMessage('Costs saved successfully.')
                        setSaveModalOpen(true)
                      } else {
                        const msg = error || 'Save failed. Please check your costs.'
                        setPendingNextTab(null)
                        setSaveModalTitle('Save Failed')
                        setSaveModalMessage(msg)
                        setSaveModalOpen(true)
                      }
                    } finally {
                      setNextWarrantySaving(false)
                    }
                  }}
                  disabled={nextWarrantySaving}
                  className="w-full bg-[#118df0] text-white py-3 rounded-lg font-semibold hover:bg-[#0d6ebd] transition-colors disabled:opacity-50"
                >
                  {nextWarrantySaving ? (costsSaved ? 'Updating...' : 'Saving...') : (costsSaved ? 'Edit Costs' : 'Save Costs')}
                </button>
              </div>
            </div>
          )}
          {activeTab === 'warranty' && (
            <div>
              <WarrantyTab vehicleId={createdVehicleId} />
            </div>
          )}
        </form>
      </div>
    </div>
  )
}
