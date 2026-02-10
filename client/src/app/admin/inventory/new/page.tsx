'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
import DisclosuresTab from './tabs/DisclosuresTab'
import PurchaseTab from './tabs/PurchaseTab'
import CostsTab from './tabs/CostsTab'
import WarrantyTab from './tabs/WarrantyTab'

type TabType = 'details' | 'disclosures' | 'purchase' | 'costs' | 'warranty'

export default function NewVehiclePage() {
  const [activeTab, setActiveTab] = useState<TabType>('details')
  const [createdVehicleId, setCreatedVehicleId] = useState<string>('')
  const [disclosuresSaved, setDisclosuresSaved] = useState(false)
  const [purchaseSaved, setPurchaseSaved] = useState(false)
  const [costsSaved, setCostsSaved] = useState(false)
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

  useEffect(() => {
    try {
      const raw = localStorage.getItem('edc_new_vehicle_wizard')
      if (!raw) return
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed === 'object') {
        if (typeof parsed.createdVehicleId === 'string') setCreatedVehicleId(parsed.createdVehicleId)
        if (typeof parsed.disclosuresSaved === 'boolean') setDisclosuresSaved(parsed.disclosuresSaved)
        if (typeof parsed.purchaseSaved === 'boolean') setPurchaseSaved(parsed.purchaseSaved)
        if (typeof parsed.costsSaved === 'boolean') setCostsSaved(parsed.costsSaved)
        if (parsed.formData && typeof parsed.formData === 'object') setFormData((prev) => ({ ...prev, ...parsed.formData }))
        if (typeof parsed.activeTab === 'string') setActiveTab(parsed.activeTab)
      }
    } catch {}
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
        disclosuresSaved,
        purchaseSaved,
        costsSaved,
        formData,
      }
      localStorage.setItem('edc_new_vehicle_wizard', JSON.stringify(snapshot))
    } catch {}
  }, [activeTab, createdVehicleId, disclosuresSaved, purchaseSaved, costsSaved, formData])

  useEffect(() => {
    const sessionStr = localStorage.getItem('edc_admin_session')
    if (!sessionStr) {
      router.push('/admin')
      return
    }
  }, [router])

  useEffect(() => {
    if (!createdVehicleId && activeTab !== 'details') {
      setActiveTab('details')
    }
  }, [createdVehicleId, activeTab])

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
    setFormData({ ...formData, [name]: value })
  }

  // Removed tab locking - allow free navigation even if saves fail

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
      const formatDbError = (err: any) => {
        if (!err) return ''
        const parts: string[] = []
        if (typeof err.message === 'string' && err.message.trim()) parts.push(err.message.trim())
        if (typeof err.details === 'string' && err.details.trim()) parts.push(err.details.trim())
        if (typeof err.hint === 'string' && err.hint.trim()) parts.push(err.hint.trim())
        if (typeof err.code === 'string' && err.code.trim()) parts.push(`code: ${err.code.trim()}`)
        return parts.filter(Boolean).join(' | ')
      }

      const payload = {
        ...formData,
        price: parseFloat(formData.price.toString()),
        mileage: parseInt(formData.mileage.toString()),
        year: parseInt(formData.year.toString()),
        features: formData.features.split(',').map((f) => f.trim()).filter(Boolean),
      }

      // Webhook for Add (must return "done" before continuing)
      try {
        const webhookBody = Object.fromEntries(
          Object.entries(formData).map(([k, v]) => {
            if (typeof v === 'string') {
              const trimmed = v.trim()
              return [k, trimmed === '' ? null : trimmed]
            }
            return [k, v]
          })
        )

        ;(webhookBody as any).ad_description = String((formData as any).adDescription ?? '').trim() === ''
          ? null
          : String((formData as any).adDescription)
        delete (webhookBody as any).adDescription

        ;(webhookBody as any).price = String(formData.price ?? '').trim() === '' ? null : Number(formData.price)
        ;(webhookBody as any).mileage = String(formData.mileage ?? '').trim() === '' ? null : Number(formData.mileage)
        ;(webhookBody as any).odometer = String((formData as any).odometer ?? '').trim() === '' ? null : Number((formData as any).odometer)
        ;(webhookBody as any).year = String(formData.year ?? '').trim() === '' ? null : Number(formData.year)
        ;(webhookBody as any).features = String(formData.features ?? '').trim() === ''
          ? null
          : String(formData.features)
            .split(',')
            .map((f) => f.trim())
            .filter(Boolean)

        const webhookRes = await fetch('/api/inventory-add', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(webhookBody),
        })

        const webhookText = await webhookRes.text().catch(() => '')
        if (!webhookRes.ok) {
          throw new Error(webhookText || `Webhook responded with ${webhookRes.status}`)
        }
        if (!String(webhookText).toLowerCase().includes('done')) {
          throw new Error(webhookText || 'Webhook did not return done')
        }
      } catch (err: any) {
        const msg = typeof err?.message === 'string' && err.message.trim() ? err.message.trim() : ''
        setError(msg ? `Webhook failed: ${msg}` : 'Webhook failed')
        return
      }

      const vinForLookup = String(formData.vin || '').trim().toUpperCase()
      if (!vinForLookup) {
        setError('Webhook succeeded but VIN is empty; unable to find created vehicle in Supabase.')
        return
      }

      const { data: created, error: lookupError } = await supabase
        .from('edc_vehicles')
        .select('id')
        .eq('vin', vinForLookup)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (lookupError || !created?.id) {
        const detail = formatDbError(lookupError)
        setError(detail ? `Webhook returned done, but could not find the created vehicle: ${detail}` : 'Webhook returned done, but could not find the created vehicle in Supabase.')
        return
      }

      setCreatedVehicleId(created.id)
      setActiveTab('disclosures')
    } catch (err: any) {
      const msg = typeof err?.message === 'string' && err.message.trim() ? err.message.trim() : ''
      setError(msg ? `Unable to create vehicle: ${msg}` : 'Unable to create vehicle. Please try again.')
    } finally {
      setSubmitting(false)
    }
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
              onClick={() => createdVehicleId && setActiveTab('disclosures')}
              disabled={!createdVehicleId}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'disclosures'
                  ? 'border-[#118df0] text-[#118df0]'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } ${!createdVehicleId ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              📋 Disclosures
            </button>
            <button
              type="button"
              onClick={() => createdVehicleId && setActiveTab('purchase')}
              disabled={!createdVehicleId}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'purchase'
                  ? 'border-[#118df0] text-[#118df0]'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } ${!createdVehicleId ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              💰 Purchase
            </button>
            <button
              type="button"
              onClick={() => createdVehicleId && setActiveTab('costs')}
              disabled={!createdVehicleId}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'costs'
                  ? 'border-[#118df0] text-[#118df0]'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } ${!createdVehicleId ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              💵 Costs
            </button>
            <button
              type="button"
              onClick={() => createdVehicleId && setActiveTab('warranty')}
              disabled={!createdVehicleId}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'warranty'
                  ? 'border-[#118df0] text-[#118df0]'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } ${!createdVehicleId ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              🛡️ Warranty
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
                    <option value="Used">Used</option>
                    <option value="New">New</option>
                    <option value="Certified">Certified</option>
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
                    <option value="Yellow">Yellow</option>
                    <option value="Red">Red</option>
                    <option value="Blue">Blue</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Retail/Wholesale</label>
                  <select name="retailWholesale" value={formData.retailWholesale} onChange={handleChange} className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-1 focus:ring-[#118df0] focus:border-[#118df0]">
                    <option value="">Classification</option>
                    <option value="Retail">Retail</option>
                    <option value="Wholesale">Wholesale</option>
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
                    <option value="Sales">Sales</option>
                    <option value="Service">Service</option>
                    <option value="Manager">Manager</option>
                  </select>
                </div>
              </div>

              {/* Row 3: Stock #, In Stock Date */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Stock #</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">#</span>
                    <input type="text" name="stockNumber" value={formData.stockNumber} onChange={handleChange} placeholder="1012" className="w-full border border-gray-300 rounded pl-8 pr-3 py-2 text-sm focus:ring-1 focus:ring-[#118df0] focus:border-[#118df0]" />
                  </div>
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
                      <input type="text" name="vin" value={formData.vin} onChange={handleChange} placeholder="VIN" className="w-full border border-gray-300 rounded-l pl-8 pr-3 py-2 text-sm focus:ring-1 focus:ring-[#118df0] focus:border-[#118df0]" />
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
                    <option value="Truck">Truck</option>
                    <option value="SUV">SUV</option>
                    <option value="Van">Van</option>
                    <option value="Motorcycle">Motorcycle</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Body Type</label>
                  <select name="bodyStyle" value={formData.bodyStyle} onChange={handleChange} className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-1 focus:ring-[#118df0] focus:border-[#118df0]">
                    <option value="">Body Style</option>
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
                      <option value="Plug-in Hybrid">Plug-in Hybrid</option>
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
                      <option value="Automatic">Automatic</option>
                      <option value="Manual">Manual</option>
                      <option value="CVT">CVT</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Drive Type</label>
                    <select name="drivetrain" value={formData.drivetrain} onChange={handleChange} className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-1 focus:ring-[#118df0] focus:border-[#118df0]">
                      <option value="">Drive Type</option>
                      <option value="FWD">FWD</option>
                      <option value="RWD">RWD</option>
                      <option value="AWD">AWD</option>
                      <option value="4WD">4WD</option>
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

              {/* Save Button */}
              <div className="flex justify-end pt-4">
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-8 py-2 bg-[#118df0] text-white font-medium rounded hover:bg-[#0d6ebd] disabled:opacity-50 transition-colors"
                >
                  {submitting ? 'Saving...' : 'Save'}
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
                vehicleData={formData}
                onError={(msg) => setError(msg)}
                hideSaveButton
              />
              <div className="mt-6">
                <button
                  onClick={async () => {
                    if (nextPurchaseSaving) return
                    try {
                      setError('')
                      setNextPurchaseSaving(true)
                      const ok = await disclosuresTabRef.current?.save?.()
                      if (ok) {
                        setDisclosuresSaved(true)
                        setActiveTab('purchase')
                      }
                    } finally {
                      setNextPurchaseSaving(false)
                    }
                  }}
                  disabled={nextPurchaseSaving}
                  className="w-full bg-[#118df0] text-white py-3 rounded-lg font-semibold hover:bg-[#0d6ebd] transition-colors disabled:opacity-50"
                >
                  {nextPurchaseSaving ? 'Saving...' : 'Save Disclosures'}
                </button>
              </div>
            </div>
          )}
          {activeTab === 'purchase' && (
            <div>
              <PurchaseTab
                ref={purchaseTabRef}
                vehicleId={createdVehicleId}
                stockNumber={formData.stockNumber}
                onError={(msg) => setError(msg)}
                hideSaveButton
              />
              <div className="mt-6">
                <button
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
                        setActiveTab('costs')
                      }
                    } finally {
                      setNextCostsSaving(false)
                    }
                  }}
                  disabled={nextCostsSaving}
                  className="w-full bg-[#118df0] text-white py-3 rounded-lg font-semibold hover:bg-[#0d6ebd] transition-colors disabled:opacity-50"
                >
                  {nextCostsSaving ? 'Saving...' : 'Save Purchase Info'}
                </button>
              </div>
            </div>
          )}
          {activeTab === 'costs' && (
            <div>
              <CostsTab
                ref={costsTabRef}
                vehicleId={createdVehicleId}
                vehiclePrice={parseFloat(String(formData.price || 0)) || 0}
                stockNumber={formData.stockNumber || ''}
                onError={(msg) => setError(msg)}
              />
              <div className="mt-6">
                <button
                  onClick={async () => {
                    if (nextWarrantySaving) return
                    try {
                      setError('')
                      setNextWarrantySaving(true)
                      const ok = await costsTabRef.current?.save?.()
                      if (ok) {
                        setCostsSaved(true)
                        setActiveTab('warranty')
                      }
                    } finally {
                      setNextWarrantySaving(false)
                    }
                  }}
                  disabled={nextWarrantySaving}
                  className="w-full bg-[#118df0] text-white py-3 rounded-lg font-semibold hover:bg-[#0d6ebd] transition-colors disabled:opacity-50"
                >
                  {nextWarrantySaving ? 'Saving...' : 'Save Costs'}
                </button>
              </div>
            </div>
          )}
          {activeTab === 'warranty' && (
            <div>
              <WarrantyTab vehicleId={createdVehicleId} />
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
        </form>
      </div>
    </div>
  )
}
