'use client'

import { useEffect, useState, useRef } from 'react'

import { supabase } from '@/lib/supabaseClient'

type VehicleRow = {
  id: string
  year?: number | null
  make?: string | null
  model?: string | null
  trim?: string | null
  stock_number?: string | null
  key_number?: string | null
  vin?: string | null
  status?: string | null
  exterior_color?: string | null
  interior_color?: string | null
  mileage?: number | null
  odometer?: number | null
  odometer_unit?: string | null
  created_at?: string | null
}

export default function VehiclesTab({ dealId, onSaved, initialData, prefillSelected, autoSaved }: { dealId?: string; onSaved?: () => void; initialData?: any; prefillSelected?: any; autoSaved?: boolean }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [results, setResults] = useState<VehicleRow[]>([])
  const [selected, setSelected] = useState<VehicleRow | null>(null)
  const [odoEditing, setOdoEditing] = useState(false)
  const [odoDraft, setOdoDraft] = useState('')

  // Track if prefill has been applied to prevent re-applying
  const prefillApplied = useRef(false)
  
  // Prefill selection from showroom (vehicleId in URL -> prefillSelected)
  useEffect(() => {
    if (!prefillSelected || prefillApplied.current) return
    prefillApplied.current = true
    
    const v = prefillSelected
    const row: VehicleRow = {
      id: String(v.id || ''),
      year: v.year ?? null,
      make: v.make ?? null,
      model: v.model ?? null,
      trim: v.trim ?? null,
      stock_number: v.stock_number ?? null,
      key_number: v.key_number ?? null,
      vin: v.vin ?? null,
      status: v.status ?? null,
      exterior_color: v.exterior_color ?? null,
      interior_color: v.interior_color ?? null,
      mileage: v.mileage ?? null,
      odometer: v.odometer ?? null,
      odometer_unit: v.odometer_unit ?? null,
      created_at: v.created_at ?? null,
    }
    setSelected(row)
    const label = [row.year ? String(row.year) : '', row.make ?? '', row.model ?? '', row.trim ?? '']
      .filter(Boolean)
      .join(' ')
    setQuery(label)
    setOdoDraft(row.odometer !== null && row.odometer !== undefined ? String(row.odometer) : '')
  }, [prefillSelected])
  const [tradeOpen, setTradeOpen] = useState(false)
  const [tradeStep, setTradeStep] = useState<1 | 2 | 3 | 4>(1)
  const [tradeDisclosuresDetail, setTradeDisclosuresDetail] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [tradeForm, setTradeForm] = useState({
    vin: '',
    year: '',
    make: '',
    model: '',
    odometer: '',
    odometerUnit: 'kms',
    trim: '',
    colour: '',
    disclosures: Array.from({ length: 14 }, () => false),
    disclosuresNotes: '',
    isCompany: false,
    ownerName: '',
    ownerCompany: '',
    ownerStreet: '',
    ownerSuite: '',
    ownerCity: '',
    ownerProvince: 'ON',
    ownerPostal: '',
    ownerCountry: 'CA',
    ownerPhone: '',
    ownerMobile: '',
    ownerEmail: '',
    isRin: false,
    ownerDl: '',
    ownerPlate: '',
    tradeValue: '0.00',
    actualCashValue: '0.00',
    lienAmount: '0.00',
    tradeEquity: '0.00',
  })

  const [addCertAsIs, setAddCertAsIs] = useState(false)
  const [addBrandType, setAddBrandType] = useState<'na' | 'none' | 'rebuilt' | 'salvage' | 'irreparable'>('na')
  const [tradeDisclosuresBrandType, setTradeDisclosuresBrandType] = useState<'na' | 'none' | 'rebuilt' | 'salvage' | 'irreparable'>('na')
  const [tradeDisclosuresSearch, setTradeDisclosuresSearch] = useState('')
  const [tradeDisclosuresEditor, setTradeDisclosuresEditor] = useState('')

  // Saved trades created from the modal; displayed on the page after webhook confirms 'Done'.
  const [savedTrades, setSavedTrades] = useState<any[]>(() => {
    if (Array.isArray(initialData) && initialData.length > 0) {
      return initialData.map((v: any) => ({
        vin: v.vin || '',
        year: v.year || '',
        make: v.make || '',
        model: v.model || '',
        odometer: v.odometer || '',
        odometerUnit: v.odometer_unit || 'kms',
        trim: v.trim || '',
        colour: v.colour || '',
        disclosures: Array.isArray(v.disclosures) ? v.disclosures : Array.from({ length: 14 }, () => false),
        disclosuresNotes: v.disclosures_notes || '',
        disclosuresEditor: v.disclosures_editor || '',
        disclosuresSearch: v.disclosures_search || '',
        disclosuresDetailOpen: v.disclosures_detail_open || false,
        brandType: v.brand_type || 'na',
        isCompany: v.is_company || false,
        ownerName: v.owner_name || '',
        ownerCompany: v.owner_company || '',
        ownerStreet: v.owner_street || '',
        ownerSuite: v.owner_suite || '',
        ownerCity: v.owner_city || '',
        ownerProvince: v.owner_province || 'ON',
        ownerPostal: v.owner_postal || '',
        ownerCountry: v.owner_country || 'CA',
        ownerPhone: v.owner_phone || '',
        ownerMobile: v.owner_mobile || '',
        ownerEmail: v.owner_email || '',
        isRin: v.is_rin || false,
        ownerDl: v.owner_dl || '',
        ownerPlate: v.owner_plate || '',
        tradeValue: v.trade_value ?? '0.00',
        actualCashValue: v.actual_cash_value ?? '0.00',
        lienAmount: v.lien_amount ?? '0.00',
        tradeEquity: v.trade_equity ?? '0.00',
        rin: v.rin || '',
        selectedVehicle: v.selected_id ? {
          id: v.selected_id,
          year: v.selected_year,
          make: v.selected_make,
          model: v.selected_model,
          trim: v.selected_trim,
          vin: v.selected_vin,
          exterior_color: v.selected_exterior_color,
          interior_color: v.selected_interior_color,
          odometer: v.selected_odometer,
          odometer_unit: v.selected_odometer_unit,
          status: v.selected_status,
          stock_number: v.selected_stock_number,
        } : null,
      }))
    }
    return []
  })
  const [openSavedDisclosureIdx, setOpenSavedDisclosureIdx] = useState<number | null>(null)
  const [showSavedModal, setShowSavedModal] = useState(false)
  const [showSaveErrorModal, setShowSaveErrorModal] = useState(false)
  const [saveErrorModalMessage, setSaveErrorModalMessage] = useState<string | null>(null)
  const [hasBeenSaved, setHasBeenSaved] = useState(() => Array.isArray(initialData) && initialData.length > 0)
  const [lastSaveWasUpdate, setLastSaveWasUpdate] = useState(false)
  const inlineEditorRef = useRef<HTMLDivElement | null>(null)
  const execInline = (cmd: string, value?: string) => {
    const el = inlineEditorRef.current
    if (!el) return
    el.focus()
    try {
      document.execCommand(cmd, false, value)
      const html = el.innerHTML
      setSavedTrades((prev) =>
        prev.map((it, i) => (i === (openSavedDisclosureIdx ?? -1) ? { ...it, disclosuresEditor: html } : it))
      )
    } catch {}
  }

  const makeSelectedVehicleSnapshot = () => {
    const v = selected
    if (!v) return null as any
    return {
      id: v.id ?? null,
      year: v.year ?? null,
      make: v.make ?? null,
      model: v.model ?? null,
      trim: v.trim ?? null,
      vin: v.vin ?? null,
      exteriorColor: v.exterior_color ?? null,
      interiorColor: v.interior_color ?? null,
      odometer: v.odometer ?? v.mileage ?? null,
      odometerUnit: v.odometer_unit ?? null,
      status: v.status ?? null,
      stockNumber: v.stock_number ?? null,
      createdAt: v.created_at ?? null,
    }
  }

  const deriveSelectedVehicleRowFromTrade = (trade: any): VehicleRow | null => {
    const sv = trade?.selectedVehicle ?? trade?.selected_vehicle ?? null
    const id = sv?.id ?? trade?.selected_id ?? null
    if (!id) return null

    const year = sv?.year ?? trade?.selected_year ?? null
    const make = sv?.make ?? trade?.selected_make ?? null
    const model = sv?.model ?? trade?.selected_model ?? null
    const trim = sv?.trim ?? trade?.selected_trim ?? null
    const vin = sv?.vin ?? trade?.selected_vin ?? null
    const exterior_color = sv?.exterior_color ?? sv?.exteriorColor ?? trade?.selected_exterior_color ?? null
    const interior_color = sv?.interior_color ?? sv?.interiorColor ?? trade?.selected_interior_color ?? null
    const odometer = sv?.odometer ?? trade?.selected_odometer ?? null
    const odometer_unit = sv?.odometer_unit ?? sv?.odometerUnit ?? trade?.selected_odometer_unit ?? null
    const status = sv?.status ?? trade?.selected_status ?? null
    const stock_number = sv?.stock_number ?? sv?.stockNumber ?? trade?.selected_stock_number ?? null
    const created_at = sv?.created_at ?? sv?.createdAt ?? trade?.created_at ?? null

    return {
      id: String(id),
      year: year ?? null,
      make: make ?? null,
      model: model ?? null,
      trim: trim ?? null,
      stock_number: stock_number ?? null,
      vin: vin ?? null,
      status: status ?? null,
      exterior_color: exterior_color ?? null,
      interior_color: interior_color ?? null,
      mileage: null,
      odometer: odometer ?? null,
      odometer_unit: odometer_unit ?? null,
      created_at: created_at ?? null,
    }
  }

  const makeSelectedLabel = (v: VehicleRow | null) => {
    if (!v) return ''
    return [v.year ? String(v.year) : '', v.make ?? '', v.model ?? '', v.trim ?? '']
      .filter(Boolean)
      .join(' ')
      .trim()
  }

  useEffect(() => {
    try {
      if (typeof window === 'undefined') return
      if (Array.isArray(initialData) && initialData.length > 0) return

      const draftKey = 'edc_deal_vehicles_deals_saved_draft'
      const dealKey = dealId ? `edc_deal_vehicles_deals_saved_${dealId}` : null

      const rawDeal = dealKey ? window.localStorage.getItem(dealKey) : null
      const rawDraft = window.localStorage.getItem(draftKey)

      const tryParse = (raw: string | null) => {
        if (!raw) return null
        try {
          return JSON.parse(raw)
        } catch {
          return null
        }
      }

      const applyPrefill = (parsed: any) => {
        if (Array.isArray(parsed)) {
          setSavedTrades(parsed)
          if (parsed.length > 0) setHasBeenSaved(true)
          const derived = deriveSelectedVehicleRowFromTrade(parsed?.[0])
          if (derived) {
            setSelected(derived)
            setQuery(makeSelectedLabel(derived))
            const mv = derived.odometer ?? derived.mileage
            setOdoDraft(mv !== null && mv !== undefined ? String(mv) : '')
          }
          return true
        }
        if (parsed && typeof parsed === 'object') {
          if (Array.isArray(parsed.savedTrades)) {
            setSavedTrades(parsed.savedTrades)
            if (parsed.savedTrades.length > 0) setHasBeenSaved(true)
          }
          if (parsed.selected && typeof parsed.selected === 'object') {
            setSelected(parsed.selected as VehicleRow)
            setQuery(makeSelectedLabel(parsed.selected as VehicleRow))
            const mv = (parsed.selected as any)?.odometer ?? (parsed.selected as any)?.mileage
            setOdoDraft(mv !== null && mv !== undefined ? String(mv) : '')
          } else {
            const derived = deriveSelectedVehicleRowFromTrade(parsed?.savedTrades?.[0])
            if (derived) {
              setSelected(derived)
              setQuery(makeSelectedLabel(derived))
              const mv = derived.odometer ?? derived.mileage
              setOdoDraft(mv !== null && mv !== undefined ? String(mv) : '')
            }
          }
          return Array.isArray(parsed.savedTrades) || !!parsed.selected
        }
        return false
      }

      const parsedDeal = tryParse(rawDeal)
      const parsedDraft = tryParse(rawDraft)

      if (applyPrefill(parsedDeal)) return

      if (applyPrefill(parsedDraft)) {
        if (dealKey) {
          try {
            window.localStorage.setItem(dealKey, JSON.stringify(parsedDraft))
          } catch {
            // ignore
          }
        }
      }
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dealId])

  useEffect(() => {
    try {
      if (selected) return
      const first = (Array.isArray(savedTrades) && savedTrades.length > 0 ? savedTrades[0] : null) ?? (Array.isArray(initialData) && initialData.length > 0 ? initialData[0] : null)
      if (!first) return
      const derived = deriveSelectedVehicleRowFromTrade(first)
      if (!derived) return
      setSelected(derived)
      setQuery(makeSelectedLabel(derived))
      const mv = derived.odometer ?? derived.mileage
      setOdoDraft(mv !== null && mv !== undefined ? String(mv) : '')
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialData, savedTrades, selected])

  const handleAddSave = async () => {
    try {
      setAddSaveError(null)
      
      // Validation
      const vin = (addForm.vin || '').trim()
      if (!vin) {
        setAddSaveError('VIN is required')
        return
      }
      if (!addForm.year || !addForm.make || !addForm.model) {
        setAddSaveError('Year, Make, and Model are required')
        return
      }
      
      setAddSaving(true)

      const payload = {
        dealId: dealId || null,
        inStockDate: addForm.inStockDate || null,
        stockNumber: addForm.stockNumber || null,
        vin: vin ? vin.toUpperCase() : null,
        odometer: addForm.odometer || null,
        odometerUnit: addForm.odometerUnit || null,
        certAsIs: addCertAsIs ? 'AS-IS' : 'CERT',
        year: addForm.year || null,
        make: addForm.make || null,
        model: addForm.model || null,
        trim: addForm.trim || null,
        exteriorColour: addForm.exteriorColour || null,
        fuelType: addForm.fuelType || null,
        brandType: addBrandType || null,
        notes: addForm.notes || null,
      }

      const res = await fetch('https://primary-production-6722.up.railway.app/webhook/Add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const raw = await res.text().catch(() => '')
      if (!res.ok) {
        const errorMsg = raw || `Server error (${res.status})`
        throw new Error(`Failed to save vehicle: ${errorMsg}`)
      }

      const ok = raw.trim().toLowerCase() === 'done'
      if (!ok) {
        throw new Error(`Webhook error: ${raw || 'Expected "Done" response but got something else'}`)
      }

      const yearNum = addForm.year ? Number(addForm.year) : null
      const odoNum = addForm.odometer ? Number(String(addForm.odometer).replace(/,/g, '')) : null
      const vehicleForPage: VehicleRow = {
        id: `add-${Date.now()}`,
        year: yearNum && !Number.isNaN(yearNum) ? yearNum : null,
        make: addForm.make || null,
        model: addForm.model || null,
        trim: addForm.trim || null,
        stock_number: addForm.stockNumber || null,
        vin: vin ? vin.toUpperCase() : null,
        status: 'In Stock',
        exterior_color: addForm.exteriorColour || null,
        odometer: odoNum && !Number.isNaN(odoNum) ? odoNum : null,
        odometer_unit: addForm.odometerUnit || null,
        created_at: new Date().toISOString(),
      }

      setSelected(vehicleForPage)
      const label = [vehicleForPage.year ? String(vehicleForPage.year) : '', vehicleForPage.make ?? '', vehicleForPage.model ?? '', vehicleForPage.trim ?? '']
        .filter(Boolean)
        .join(' ')
        .trim()
      setQuery(label)
      setOpen(false)
      setResults([])
      setError(null)

      const mv = vehicleForPage.odometer ?? null
      setOdoDraft(mv !== null && mv !== undefined ? String(mv) : '')
      setOdoEditing(false)

      resetAddModal()
      setAddOpen(false)
    } catch (e: any) {
      setAddSaveError(e?.message || 'Failed to save vehicle')
    } finally {
      setAddSaving(false)
    }
  }
  const disclosureQuestions: string[] = [
    'Has the trade-in previously been used as a daily rental, police, taxi, limo, or emergency vehicle?',
    'Does the trade-in have a lien registered against it?',
    'Has the trade-in sustained any structural damage?',
    'Has the trade-in sustained any accident damage that resulted in an insurance claim, estimate or police report?',
    'Has the vehicle previously been branded as irreparable, salvage, or rebuilt?',
    'Has the trade-in sustained any fire or water damage?',
    'Has the vehicle had previous paintwork?',
    'Has the trade-in ever been registered outside of your local jurisdiction (i.e. Province or State)?',
    'Is the odometer faulty, broken, or rolled back?',
    'Manufacturer equipment/badges altered or replaced?',
    'Was the vehicle ever stolen and/or reported as stolen?',
    'Has the manufacturers warranty been cancelled?',
    'Has the vehicle ever been declared a total loss by an insurance company?',
    'Has the vehicle had any body panel painted and or replaced?',
  ]

  const initialAddFormState = {
    inStockDate: '',
    stockNumber: '',
    vin: '',
    odometer: '',
    odometerUnit: 'kms',
    year: '',
    make: '',
    model: '',
    trim: '',
    exteriorColour: '',
    fuelType: '',
    notes: '',
  }
  
  const [addForm, setAddForm] = useState(initialAddFormState)

  const [addDecodeLoading, setAddDecodeLoading] = useState(false)
  const [addDecodeError, setAddDecodeError] = useState<string | null>(null)
  const [addSaving, setAddSaving] = useState(false)
  const [addSaveError, setAddSaveError] = useState<string | null>(null)

  // Helper function to reset Add Vehicle modal state
  const resetAddModal = () => {
    setAddForm(initialAddFormState)
    setAddCertAsIs(false)
    setAddBrandType('na')
    setAddDecodeError(null)
    setAddSaveError(null)
    // Scroll modal content to top
    setTimeout(() => {
      if (addModalContentRef.current) {
        addModalContentRef.current.scrollTop = 0
      }
    }, 0)
  }

  // Add Vehicle modal content ref for scrolling
  const addModalContentRef = useRef<HTMLDivElement | null>(null)

  const [tradeDecodeLoading, setTradeDecodeLoading] = useState(false)
  const [tradeDecodeError, setTradeDecodeError] = useState<string | null>(null)

  const [tradeSubmitting, setTradeSubmitting] = useState(false)
  const [tradeSubmitError, setTradeSubmitError] = useState<string | null>(null)
  const [savingTrades, setSavingTrades] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const getLoggedInAdminDbUserId = async (): Promise<string | null> => {
    try {
      if (typeof window === 'undefined') return null
      const raw = window.localStorage.getItem('edc_admin_session')
      if (!raw) return null
      const parsed = JSON.parse(raw) as { email?: string; user_id?: string }
      const sessionUserId = String(parsed?.user_id ?? '').trim()
      if (sessionUserId) return sessionUserId
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

  const getWebhookUserId = async () => {
    const dbUserId = await getLoggedInAdminDbUserId()
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()
      if (userError) return dbUserId ?? null
      return dbUserId ?? user?.id ?? null
    } catch {
      return dbUserId ?? null
    }
  }

  const handleAddDecode = async () => {
    try {
      setAddDecodeError(null)
      const vin = addForm.vin?.trim()
      if (!vin) {
        setAddDecodeError('Enter a VIN to decode')
        return
      }
      setAddDecodeLoading(true)

      const user_id = await getWebhookUserId().catch(() => null)

      const res = await fetch('/api/vincode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vin: vin.toUpperCase(), user_id: user_id || null }),
      })
      if (!res.ok) {
        const errorText = await res.text().catch(() => '')
        console.error('[Add Decode] Error response:', errorText)
        throw new Error(`Decode failed (${res.status})`)
      }
      const data = await res.json()
      console.log('[Add Decode] Webhook response:', data)
      
      // Handle different response formats
      let vehicleData = null
      if (Array.isArray(data) && data.length > 0) {
        vehicleData = data[0]
      } else if (data && typeof data === 'object') {
        // If it's an object, check if it has the vehicle fields directly
        if (data.Make || data.VIN || data.Model) {
          vehicleData = data
        } else if (data.data) {
          // Check if data is nested in a 'data' property
          vehicleData = Array.isArray(data.data) ? data.data[0] : data.data
        } else if (data.result) {
          // Check if data is nested in a 'result' property
          vehicleData = Array.isArray(data.result) ? data.result[0] : data.result
        }
      }
      
      if (!vehicleData) {
        console.error('[Add Decode] No vehicle data found in response:', data)
        throw new Error('No vehicle data returned from webhook')
      }

      console.log('[Add Decode] Mapping fields:', vehicleData)
      setAddForm((p) => ({
        ...p,
        vin: vehicleData.VIN || p.vin,
        make: vehicleData.Make ? String(vehicleData.Make) : p.make,
        model: vehicleData.Model ? String(vehicleData.Model) : p.model,
        year: vehicleData.Year != null ? String(vehicleData.Year) : p.year,
        trim: vehicleData.Trim ? String(vehicleData.Trim) : p.trim,
        fuelType: vehicleData['Fuel Type'] ? String(vehicleData['Fuel Type']) : p.fuelType,
        exteriorColour: vehicleData['Exterior Color'] || p.exteriorColour,
      }))
      console.log('[Add Decode] Form updated successfully')
    } catch (e: any) {
      setAddDecodeError(e?.message || 'Failed to decode VIN')
    } finally {
      setAddDecodeLoading(false)
    }
  }

  const handleTradeDecode = async () => {
    try {
      setTradeDecodeError(null)
      const vin = tradeForm.vin?.trim()
      if (!vin) {
        setTradeDecodeError('Enter a VIN to decode')
        return
      }
      setTradeDecodeLoading(true)

      const user_id = await getWebhookUserId().catch(() => null)

      const res = await fetch('/api/vincode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vin: vin.toUpperCase(), user_id: user_id || null }),
      })
      if (!res.ok) {
        const errorText = await res.text().catch(() => '')
        console.error('[Trade Decode] Error response:', errorText)
        throw new Error(`Decode failed (${res.status})`)
      }
      const data = await res.json()
      console.log('[Trade Decode] Webhook response:', data)
      
      // Handle different response formats
      let vehicleData = null
      if (Array.isArray(data) && data.length > 0) {
        vehicleData = data[0]
      } else if (data && typeof data === 'object') {
        // If it's an object, check if it has the vehicle fields directly
        if (data.Make || data.VIN || data.Model) {
          vehicleData = data
        } else if (data.data) {
          // Check if data is nested in a 'data' property
          vehicleData = Array.isArray(data.data) ? data.data[0] : data.data
        } else if (data.result) {
          // Check if data is nested in a 'result' property
          vehicleData = Array.isArray(data.result) ? data.result[0] : data.result
        }
      }
      
      if (!vehicleData) {
        console.error('[Trade Decode] No vehicle data found in response:', data)
        throw new Error('No vehicle data returned from webhook')
      }

      console.log('[Trade Decode] Mapping fields:', vehicleData)
      setTradeForm((p) => ({
        ...p,
        vin: vehicleData.VIN || p.vin,
        make: vehicleData.Make ? String(vehicleData.Make) : p.make,
        model: vehicleData.Model ? String(vehicleData.Model) : p.model,
        year: vehicleData.Year != null ? String(vehicleData.Year) : p.year,
        trim: vehicleData.Trim ? String(vehicleData.Trim) : p.trim,
        colour: vehicleData['Exterior Color'] || p.colour,
      }))
      console.log('[Trade Decode] Form updated successfully')
    } catch (e: any) {
      setTradeDecodeError(e?.message || 'Failed to decode VIN')
    } finally {
      setTradeDecodeLoading(false)
    }
  }

  const nextTradeStep = () => setTradeStep((s) => (s === 4 ? 4 : ((s + 1) as 2 | 3 | 4)))
  const prevTradeStep = () => setTradeStep((s) => (s === 1 ? 1 : ((s - 1) as 1 | 2 | 3)))

  const handleTradeSubmit = async () => {
    try {
      setTradeSubmitError(null)
      setTradeSubmitting(true)

      const payload = {
        dealId: dealId || null,
        vin: tradeForm.vin,
        year: tradeForm.year,
        make: tradeForm.make,
        model: tradeForm.model,
        odometer: tradeForm.odometer,
        odometerUnit: tradeForm.odometerUnit,
        trim: tradeForm.trim,
        colour: tradeForm.colour,
        disclosures: tradeForm.disclosures,
        disclosuresNumbers: Array.isArray(tradeForm.disclosures)
          ? tradeForm.disclosures.map((v, i) => (v ? i + 1 : null)).filter((n) => n !== null)
          : [],
        disclosuresNotes: tradeForm.disclosuresNotes,
        brandType: tradeDisclosuresBrandType || null,
        disclosuresEditor: tradeDisclosuresEditor || null,
        disclosuresSearch: tradeDisclosuresSearch || null,
        disclosuresDetailOpen: tradeDisclosuresDetail || false,
        isCompany: tradeForm.isCompany,
        ownerName: tradeForm.ownerName,
        ownerCompany: tradeForm.ownerCompany,
        ownerStreet: tradeForm.ownerStreet,
        ownerSuite: tradeForm.ownerSuite,
        ownerCity: tradeForm.ownerCity,
        ownerProvince: tradeForm.ownerProvince,
        ownerPostal: tradeForm.ownerPostal,
        ownerCountry: tradeForm.ownerCountry,
        ownerPhone: tradeForm.ownerPhone,
        ownerMobile: tradeForm.ownerMobile,
        ownerEmail: tradeForm.ownerEmail,
        isRin: tradeForm.isRin,
        // Always send both DL and RIN fields. The single input stores into ownerDl; map to both keys based on isRin.
        // Use nulls when not provided so the webhook receives explicit nulls, not missing fields.
        ownerDl: tradeForm.isRin ? null : (tradeForm.ownerDl ?? null),
        ownerRin: tradeForm.isRin ? (tradeForm.ownerDl ?? null) : null,
        ownerPlate: tradeForm.ownerPlate,
        tradeValue: tradeForm.tradeValue,
        actualCashValue: tradeForm.actualCashValue,
        lienAmount: tradeForm.lienAmount,
        tradeEquity: tradeForm.tradeEquity,
        // Snapshot of the selected inventory vehicle at the time this trade is created
        selectedVehicle: makeSelectedVehicleSnapshot(),
      }

      // Do not send to webhook here. Just reflect created trade on page.
      setSavedTrades((prev) => [...prev, payload])

      // Close the modal after creating card
      setTradeOpen(false)
      
      // Optionally reset the form
      setTradeForm({
        vin: '',
        year: '',
        make: '',
        model: '',
        odometer: '',
        odometerUnit: 'kms',
        trim: '',
        colour: '',
        disclosures: Array.from({ length: 14 }, () => false),
        disclosuresNotes: '',
        isCompany: false,
        ownerName: '',
        ownerCompany: '',
        ownerStreet: '',
        ownerSuite: '',
        ownerCity: '',
        ownerProvince: 'ON',
        ownerPostal: '',
        ownerCountry: 'CA',
        ownerPhone: '',
        ownerMobile: '',
        ownerEmail: '',
        isRin: false,
        ownerDl: '',
        ownerPlate: '',
        tradeValue: '0.00',
        actualCashValue: '0.00',
        lienAmount: '0.00',
        tradeEquity: '0.00',
      })
      setTradeStep(1)
    } catch (e: any) {
      console.error('[Trade Submit] Error:', e)
      setTradeSubmitError(e?.message || 'Failed to submit trade')
    } finally {
      setTradeSubmitting(false)
    }
  }

  const handleSaveAllTrades = async () => {
    if (savingTrades) return
    try {
      setSaveError(null)
      setLastSaveWasUpdate(hasBeenSaved)
      setSavingTrades(true)

      const user_id = await getWebhookUserId().catch(() => null)

      const toNull = (v: any) => {
        if (v == null) return null
        if (typeof v === 'string') {
          const trimmed = v.trim()
          return trimmed === '' ? null : trimmed
        }
        return v
      }

      const toNullArray = (v: any) => {
        if (!Array.isArray(v)) return null
        return v
      }

      const makeSelectedVehiclePayload = (svRaw: any) => {
        const sv = svRaw ?? null
        const pick = (...keys: string[]) => {
          for (const k of keys) {
            const v = (sv as any)?.[k]
            if (v !== undefined) return v
          }
          return null
        }
        return {
          id: pick('id'),
          year: pick('year'),
          make: pick('make'),
          model: pick('model'),
          trim: pick('trim'),
          vin: pick('vin'),
          exteriorColor: pick('exterior_color', 'exteriorColor'),
          interiorColor: pick('interior_color', 'interiorColor'),
          odometer: pick('odometer'),
          odometerUnit: pick('odometer_unit', 'odometerUnit'),
          status: pick('status'),
          stockNumber: pick('stock_number', 'stockNumber'),
          createdAt: pick('created_at', 'createdAt'),
          updatedAt: pick('updated_at', 'updatedAt'),
        }
      }

      const trades = (Array.isArray(savedTrades) ? savedTrades : []).map((t) => {
        const svSnap = t.selectedVehicle ?? makeSelectedVehicleSnapshot() ?? null
        const selectedVehicle = makeSelectedVehiclePayload(svSnap)

        const disclosures = toNullArray(t.disclosures)
        const disclosuresNumbers = Array.isArray(t.disclosures)
          ? t.disclosures
              .map((v: any, idx: number) => (v === true ? idx : null))
              .filter((n: number | null) => n != null)
          : null

        return {
          vin: toNull(t.vin),
          year: toNull(t.year),
          make: toNull(t.make),
          model: toNull(t.model),
          odometer: toNull(t.odometer),
          odometerUnit: toNull(t.odometerUnit) ?? 'kms',
          trim: toNull(t.trim),
          colour: toNull(t.colour),
          disclosures: disclosures,
          disclosuresNumbers: disclosuresNumbers,
          disclosuresNotes: toNull(t.disclosuresNotes),
          brandType: toNull(t.brandType),
          disclosuresEditor: toNull(t.disclosuresEditor),
          disclosuresSearch: toNull(t.disclosuresSearch),
          disclosuresDetailOpen: t.disclosuresDetailOpen ?? null,
          isCompany: t.isCompany ?? null,
          ownerName: toNull(t.ownerName),
          ownerCompany: toNull(t.ownerCompany),
          ownerStreet: toNull(t.ownerStreet),
          ownerSuite: toNull(t.ownerSuite),
          ownerCity: toNull(t.ownerCity),
          ownerProvince: toNull(t.ownerProvince),
          ownerPostal: toNull(t.ownerPostal),
          ownerCountry: toNull(t.ownerCountry),
          ownerPhone: toNull(t.ownerPhone),
          ownerMobile: toNull(t.ownerMobile),
          ownerEmail: toNull(t.ownerEmail),
          isRin: t.isRin ?? null,
          ownerDl: toNull(t.ownerDl),
          ownerPlate: toNull(t.ownerPlate),
          tradeValue: toNull(t.tradeValue),
          actualCashValue: toNull(t.actualCashValue),
          lienAmount: toNull(t.lienAmount),
          tradeEquity: toNull(t.tradeEquity),
          ownerRin: toNull(t.rin),
          selectedVehicle,
          selected_id: selectedVehicle.id,
          selected_year: selectedVehicle.year,
          selected_make: selectedVehicle.make,
          selected_model: selectedVehicle.model,
          selected_trim: selectedVehicle.trim,
          selected_vin: selectedVehicle.vin,
          selected_exterior_color: selectedVehicle.exteriorColor,
          selected_interior_color: selectedVehicle.interiorColor,
          selected_odometer: selectedVehicle.odometer,
          selected_odometer_unit: selectedVehicle.odometerUnit,
          selected_status: selectedVehicle.status,
          selected_stock_number: selectedVehicle.stockNumber,
          created_at: selectedVehicle.createdAt,
          updated_at: selectedVehicle.updatedAt,
        }
      })

      const webhookUrl = 'https://primary-production-6722.up.railway.app/webhook/vehicles-deals'
      const executionMode = process.env.NODE_ENV === 'development' ? 'development' : 'production'

      const mainSelectedVehicle = makeSelectedVehiclePayload(selected)

      const envelopes = trades.length > 0 ? trades.map((t) => {
        const { selectedVehicle, ...rest } = t as any
        return {
          headers: {},
          params: {},
          query: {},
          body: {
            user_id: user_id || null,
            id: dealId || null,
            dealId: dealId || null,
            ...rest,
            selectedVehicle: selectedVehicle ?? null,
          },
          webhookUrl,
          executionMode,
        }
      }) : [{
        headers: {},
        params: {},
        query: {},
        body: {
          user_id: user_id || null,
          id: dealId || null,
          dealId: dealId || null,
          vin: null,
          year: null,
          make: null,
          model: null,
          odometer: null,
          odometerUnit: null,
          trim: null,
          colour: null,
          disclosures: null,
          disclosuresNumbers: null,
          disclosuresNotes: null,
          brandType: null,
          disclosuresEditor: null,
          disclosuresSearch: null,
          disclosuresDetailOpen: null,
          isCompany: null,
          ownerName: null,
          ownerCompany: null,
          ownerStreet: null,
          ownerSuite: null,
          ownerCity: null,
          ownerProvince: null,
          ownerPostal: null,
          ownerCountry: null,
          ownerPhone: null,
          ownerMobile: null,
          ownerEmail: null,
          isRin: null,
          ownerDl: null,
          ownerPlate: null,
          tradeValue: null,
          actualCashValue: null,
          lienAmount: null,
          tradeEquity: null,
          ownerRin: null,
          selectedVehicle: mainSelectedVehicle,
          selected_id: mainSelectedVehicle.id,
          selected_year: mainSelectedVehicle.year,
          selected_make: mainSelectedVehicle.make,
          selected_model: mainSelectedVehicle.model,
          selected_trim: mainSelectedVehicle.trim,
          selected_vin: mainSelectedVehicle.vin,
          selected_exterior_color: mainSelectedVehicle.exteriorColor,
          selected_interior_color: mainSelectedVehicle.interiorColor,
          selected_odometer: mainSelectedVehicle.odometer,
          selected_odometer_unit: mainSelectedVehicle.odometerUnit,
          selected_status: mainSelectedVehicle.status,
          selected_stock_number: mainSelectedVehicle.stockNumber,
          created_at: mainSelectedVehicle.createdAt,
          updated_at: mainSelectedVehicle.updatedAt,
        },
        webhookUrl,
        executionMode,
      }]

      const res = await fetch('/api/vehicles-deals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(envelopes),
      })

      const text = await res.text().catch(() => '')
      let json: any = null
      try {
        json = text ? JSON.parse(text) : null
      } catch {
        json = null
      }

      if (!res.ok || (json && json.error)) {
        throw new Error((json && (json.error || json.message)) || text || `Save failed (${res.status})`)
      }

      setHasBeenSaved(true)

      try {
        if (typeof window !== 'undefined') {
          const draftKey = 'edc_deal_vehicles_deals_saved_draft'
          const dealKey = dealId ? `edc_deal_vehicles_deals_saved_${dealId}` : null
          const payloadToStore = {
            savedTrades,
            selected,
          }
          window.localStorage.setItem(draftKey, JSON.stringify(payloadToStore))
          if (dealKey) window.localStorage.setItem(dealKey, JSON.stringify(payloadToStore))
        }
      } catch {
        // ignore
      }
      console.log('[Save Trades] All trades saved: Done')
      setShowSavedModal(true)
      window.setTimeout(() => {
        setShowSavedModal(false)
        onSaved?.()
      }, 900)
      setOpenSavedDisclosureIdx(null)
    } catch (e: any) {
      console.error('[Save Trades] Error:', e)
      setSaveError(e?.message || 'Failed to save trades')
      setSaveErrorModalMessage(e?.message || 'Unsuccessful save')
      setShowSaveErrorModal(true)
    } finally {
      setSavingTrades(false)
    }
  }

  useEffect(() => {
    // Auto-calc Trade Equity = Actual Cash Value - Trade Value
    const toNum = (v: string) => {
      if (!v) return 0
      const n = parseFloat(String(v).replace(/,/g, ''))
      return isNaN(n) ? 0 : n
    }
    const acv = toNum(tradeForm.actualCashValue)
    const tv = toNum(tradeForm.tradeValue)
    const eq = acv - tv
    setTradeForm((p) => ({ ...p, tradeEquity: eq.toFixed(2) }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tradeForm.actualCashValue, tradeForm.tradeValue])

  const handleMoneyFocus = (key: 'tradeValue' | 'actualCashValue' | 'lienAmount') => {
    setTradeForm((p) => {
      const current = (p as unknown as Record<string, string>)[key] || ''
      const cleared = current === '0.00' || current === '0' ? '' : current
      return { ...(p as any), [key]: cleared }
    })
  }

  const handleMoneyBlur = (key: 'tradeValue' | 'actualCashValue' | 'lienAmount') => {
    setTradeForm((p) => {
      const raw = ((p as unknown as Record<string, string>)[key] || '').trim()
      const n = parseFloat(raw.replace(/,/g, ''))
      const formatted = !raw || isNaN(n) ? '0.00' : n.toFixed(2)
      return { ...(p as any), [key]: formatted }
    })
  }

  const loadVehicles = async (q: string) => {
    const term = q.trim()
    setLoading(true)
    setError(null)
    try {
      const selectCols = [
        'id',
        'year',
        'make',
        'model',
        'trim',
        'stock_number',
        'key_number',
        'vin',
        'status',
        'exterior_color',
        'interior_color',
        'mileage',
        'odometer',
        'odometer_unit',
        'created_at',
      ].join(',')

      let req = supabase.from('edc_vehicles').select(selectCols)
      if (term) {
        req = req.or(
          [`make.ilike.%${term}%`, `model.ilike.%${term}%`, `trim.ilike.%${term}%`, `stock_number.ilike.%${term}%`, `vin.ilike.%${term}%`].join(
            ','
          )
        )
      } else {
        req = req.order('created_at', { ascending: false })
      }

      const { data, error: supaErr } = await req.limit(10)
      if (supaErr) {
        setError(supaErr.message)
        setResults([])
        return
      }
      const rows = (Array.isArray(data) ? data : []) as unknown as VehicleRow[]
      setResults(rows)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const term = query.trim()
    if (!term) {
      return
    }
    const handle = window.setTimeout(async () => {
      await loadVehicles(term)
    }, 250)
    return () => window.clearTimeout(handle)
  }, [query])

  const selectVehicle = (v: VehicleRow) => {
    setSelected(v)
    const label = [v.year ? String(v.year) : '', v.make ?? '', v.model ?? '', v.trim ?? '']
      .filter(Boolean)
      .join(' ')
      .trim()
    setQuery(label)
    setOpen(false)

    const mv = v.odometer ?? v.mileage
    setOdoDraft(mv !== null && mv !== undefined ? String(mv) : '')
    setOdoEditing(false)
  }

  const clearSelected = () => {
    setSelected(null)
    setQuery('')
    setResults([])
    setError(null)
    setOpen(false)
    setOdoEditing(false)
    setOdoDraft('')
  }

  const mileageValue = selected?.odometer ?? selected?.mileage
  const mileageUnit = selected?.odometer_unit || 'kms'

  const applyOdo = () => {
    if (!selected) return
    const parsed = odoDraft.trim() === '' ? null : Number(odoDraft)
    const nextOdo = odoDraft.trim() === '' || Number.isNaN(parsed) ? selected.odometer ?? selected.mileage ?? null : parsed
    setSelected((p) => (p ? { ...p, odometer: nextOdo } : p))
    setOdoEditing(false)
  }

  return (
    <div className="w-full">
      {showSavedModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-[92vw] max-w-md rounded-lg bg-white shadow-xl border border-gray-100 p-5">
            <div className="text-base font-semibold text-gray-900">{lastSaveWasUpdate ? 'Vehicle updated' : 'Vehicle saved'}</div>
            <div className="mt-1 text-sm text-gray-600">Vehicle information has been {lastSaveWasUpdate ? 'updated' : 'saved'} successfully.</div>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setShowSavedModal(false)
                  onSaved?.()
                }}
                className="h-9 px-4 rounded bg-[#118df0] text-white text-sm font-semibold hover:bg-[#0d6ebd]"
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {showSaveErrorModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-[92vw] max-w-md rounded-lg bg-white shadow-xl border border-gray-100 p-5">
            <div className="text-base font-semibold text-gray-900">Unsuccessful save</div>
            <div className="mt-1 text-sm text-gray-600">{saveErrorModalMessage || 'Unsuccessful save'}</div>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setShowSaveErrorModal(false)
                }}
                className="h-9 px-4 rounded bg-[#118df0] text-white text-sm font-semibold hover:bg-[#0d6ebd]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
      <div className="w-full">
        <div className="relative">
          <input
            placeholder="search inventory"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setOpen(true)
            }}
            onFocus={() => {
              setOpen(true)
              if (!query.trim()) loadVehicles('')
            }}
            className="w-full h-10 border border-gray-200 rounded bg-white pl-10 pr-3 text-sm shadow-sm"
          />
          <svg
            className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-4.35-4.35m1.35-5.65a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>

          {open && (loading || results.length > 0 || !!error) ? (
            <div className="absolute left-0 right-0 top-[44px] z-20 rounded border border-gray-200 bg-white shadow-lg overflow-hidden">
              {loading ? <div className="px-3 py-2 text-xs text-gray-500">Searching...</div> : null}
              {error ? <div className="px-3 py-2 text-xs text-red-600">{error}</div> : null}
              {!loading && !error && results.length === 0 ? (
                <div className="px-3 py-2 text-xs text-gray-500">No vehicles found</div>
              ) : null}

              {!loading && !error
                ? results.map((r) => {
                    const title = [r.year ? String(r.year) : '', r.make ?? '', r.model ?? '', r.trim ?? '']
                      .filter(Boolean)
                      .join(' ')
                      .trim()
                    return (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => selectVehicle(r)}
                        className="w-full text-left px-3 py-2 hover:bg-gray-50"
                      >
                        <div className="text-sm text-gray-900">{title || 'Vehicle'}</div>
                      </button>
                    )
                  })
                : null}
            </div>
          ) : null}
        </div>

        <div className="mt-2 text-xs text-gray-600">
          Didn't find what you're looking for?
          <button
            type="button"
            className="ml-1 text-[#118df0] hover:underline"
            onClick={() => {
              setAddOpen(true)
              resetAddModal()
            }}
          >
            Add new
          </button>
        </div>

        {selected ? (
          <div className="mt-4 border border-gray-200 bg-white">
            <div className="relative px-4 py-3">
              <button
                type="button"
                onClick={clearSelected}
                aria-label="Remove vehicle"
                className="absolute right-3 top-3 text-[#118df0] hover:text-[#0d6ebd]"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>

              <div className="grid grid-cols-4 gap-10 text-sm text-gray-800 pr-8">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-gray-900" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3M5 11h14" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <div>{selected.year ?? ''}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-gray-900" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20 10 10 0 000-20z" />
                    </svg>
                    <div>{selected.status ?? 'In Stock'}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-gray-900" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h10M7 11h10M7 15h6" />
                    </svg>
                    <div>{selected.stock_number ?? ''}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-gray-900" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 1.343-3 3 0 1.657 1.343 3 3 3s3-1.343 3-3c0-1.657-1.343-3-3-3z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.4 15a7.97 7.97 0 00.1-2l2-1-2-4-2 1a8.06 8.06 0 00-1.7-1l.3-2h-4l.3 2a8.06 8.06 0 00-1.7 1l-2-1-2 4 2 1a7.97 7.97 0 00.1 2l-2 1 2 4 2-1a8.06 8.06 0 001.7 1l-.3 2h4l-.3-2a8.06 8.06 0 001.7-1l2 1 2-4-2-1z" />
                    </svg>
                    <div className="truncate">{selected.trim ?? ''}</div>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-gray-800" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 16l-1.5-4.5A2 2 0 015.4 9h13.2a2 2 0 011.9 2.5L19 16" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M7 16h10l1 4H6l1-4z" />
                    </svg>
                    <div>{selected.make ?? ''}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-gray-800" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5h6M9 19h6" />
                    </svg>
                    <div className="truncate">{selected.vin ?? ''}</div>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-gray-800" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5h6m-6 4h6m-6 4h6m-6 4h6" />
                    </svg>
                    <div>{selected.model ?? ''}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-gray-800" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v18m9-9H3" />
                    </svg>
                    <div>{selected.exterior_color ?? ''}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-gray-800" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    <div className="flex items-center gap-2">
                      {odoEditing ? (
                        <input
                          value={odoDraft}
                          onChange={(e) => setOdoDraft(e.target.value)}
                          onBlur={applyOdo}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              ;(e.target as HTMLInputElement).blur()
                            }
                            if (e.key === 'Escape') {
                              setOdoDraft(
                                mileageValue !== null && mileageValue !== undefined ? String(mileageValue) : ''
                              )
                              setOdoEditing(false)
                            }
                          }}
                          className="h-7 w-24 border border-gray-200 rounded px-2 text-sm outline-none"
                        />
                      ) : (
                        <div>
                          {mileageValue !== null && mileageValue !== undefined ? String(mileageValue) : ''} {mileageUnit}
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setOdoEditing(true)
                          setOdoDraft(mileageValue !== null && mileageValue !== undefined ? String(mileageValue) : '')
                        }}
                        className="text-[#118df0] hover:text-[#0d6ebd]"
                        aria-label="Edit odometer"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M11 4h2M4 20h16" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 3.5l4 4L8 20H4v-4L16.5 3.5z" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-gray-800" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 1.343-3 3 0 1.657 1.343 3 3 3s3-1.343 3-3c0-1.657-1.343-3-3-3z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.4 15a7.97 7.97 0 00.1-2l2-1-2-4-2 1a8.06 8.06 0 00-1.7-1l.3-2h-4l.3 2a8.06 8.06 0 00-1.7 1l-2-1-2 4 2 1a7.97 7.97 0 00.1 2l-2 1 2 4 2-1a8.06 8.06 0 001.7 1l-.3 2h4l-.3-2a8.06 8.06 0 001.7-1l2 1 2-4-2-1z" />
                    </svg>
                    <div className="truncate">{selected.trim ?? ''}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-4 border border-gray-200 bg-white">
            <div className="h-12 flex items-center justify-center text-gray-500">No Vehicle Selected</div>
          </div>
        )}

        <div className="mt-6 flex items-center gap-2">
          <div className="text-sm text-gray-700">Trades</div>
          <button
            type="button"
            className="h-8 w-8 rounded bg-[#118df0] text-white flex items-center justify-center hover:bg-[#0d6ebd]"
            aria-label="Add trade"
            onClick={() => {
              setTradeOpen(true)
              setTradeStep(1)
              setTradeDisclosuresDetail(false)
            }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>

        <div className="mt-3 border border-gray-200 bg-white">
          {savedTrades.length === 0 ? (
            <div className="h-12 flex items-center justify-center text-gray-500">No Trades</div>
          ) : (
            <div className="p-4 space-y-4">
              {savedTrades.map((t, idx) => (
                <div key={idx} className="border border-gray-200 rounded p-3 grid grid-cols-12 gap-3 items-center">
                  <div className="col-span-4 flex items-center gap-2">
                    <svg className="w-4 h-4 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M9 12h6M9 5h6M9 19h6"/></svg>
                    <input readOnly className="h-9 w-full border border-gray-200 rounded px-3 text-sm bg-gray-50" value={t.vin || ''} />
                  </div>
                  <input readOnly className="col-span-2 h-9 border border-gray-200 rounded px-3 text-sm bg-gray-50" value={t.year || ''} />
                  <input readOnly className="col-span-2 h-9 border border-gray-200 rounded px-3 text-sm bg-gray-50" value={t.make || ''} />
                  <input readOnly className="col-span-4 h-9 border border-gray-200 rounded px-3 text-sm bg-gray-50" value={t.model || ''} />

                  <input readOnly className="col-span-3 h-9 border border-gray-200 rounded px-3 text-sm bg-gray-50" value={t.trim || ''} />
                  <input readOnly className="col-span-3 h-9 border border-gray-200 rounded px-3 text-sm bg-gray-50" value={t.colour || ''} />
                  <div className="col-span-3 flex items-stretch border border-gray-200 rounded overflow-hidden">
                    <div className="w-10 flex items-center justify-center bg-gray-100 text-gray-700 border-r border-gray-200">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 2a10 10 0 100 20 10 10 0 000-20z"/></svg>
                    </div>
                    <input readOnly className="flex-1 h-9 px-3 text-sm bg-gray-50" value={t.odometer || ''} />
                    <input readOnly className="w-16 h-9 px-2 text-sm bg-gray-50 border-l border-gray-200" value={t.odometerUnit || ''} />
                  </div>

                  <div className="col-span-3">
                    <div className="text-[11px] text-gray-600">Trade Value</div>
                    <input readOnly className="h-9 w-full border border-gray-200 rounded px-3 text-sm bg-gray-50" value={t.tradeValue || ''} />
                  </div>
                  <div className="col-span-3">
                    <div className="text-[11px] text-gray-600">Actual Cash Value</div>
                    <input readOnly className="h-9 w-full border border-gray-200 rounded px-3 text-sm bg-gray-50" value={t.actualCashValue || ''} />
                  </div>
                  <div className="col-span-3">
                    <div className="text-[11px] text-gray-600">Lien Amount</div>
                    <input readOnly className="h-9 w-full border border-gray-200 rounded px-3 text-sm bg-gray-50" value={t.lienAmount || ''} />
                  </div>
                  <div className="col-span-3">
                    <div className="text-[11px] text-gray-600">Trade Equity</div>
                    <input readOnly className="h-9 w-full border border-gray-200 rounded px-3 text-sm bg-gray-50" value={t.tradeEquity || ''} />
                  </div>

                  <div className="col-span-6">
                    <div className="text-[11px] text-gray-600">Owner Name</div>
                    <input readOnly className="h-9 w-full border border-gray-200 rounded px-3 text-sm bg-gray-50" value={t.ownerName || ''} />
                  </div>
                  <div className="col-span-3">
                    <div className="text-[11px] text-gray-600">{t.isRin ? 'RIN #' : 'DL #'}</div>
                    <input readOnly className="h-9 w-full border border-gray-200 rounded px-3 text-sm bg-gray-50" value={(t.isRin ? (t.ownerRin ?? '') : (t.ownerDl ?? ''))} />
                  </div>
                  <div className="col-span-3">
                    <div className="text-[11px] text-gray-600">Plate #</div>
                    <input readOnly className="h-9 w-full border border-gray-200 rounded px-3 text-sm bg-gray-50" value={t.ownerPlate || ''} />
                  </div>

                  <div className="col-span-3">
                    <div className="text-[11px] text-gray-600">Phone</div>
                    <input readOnly className="h-9 w-full border border-gray-200 rounded px-3 text-sm bg-gray-50" value={t.ownerPhone || ''} />
                  </div>
                  <div className="col-span-3">
                    <div className="text-[11px] text-gray-600">Mobile</div>
                    <input readOnly className="h-9 w-full border border-gray-200 rounded px-3 text-sm bg-gray-50" value={t.ownerMobile || ''} />
                  </div>
                  <div className="col-span-6">
                    <div className="text-[11px] text-gray-600">Email</div>
                    <input readOnly className="h-9 w-full border border-gray-200 rounded px-3 text-sm bg-gray-50" value={t.ownerEmail || ''} />
                  </div>

                  <div className="col-span-6">
                    <div className="text-[11px] text-gray-600">Street Address</div>
                    <input readOnly className="h-9 w-full border border-gray-200 rounded px-3 text-sm bg-gray-50" value={t.ownerStreet || ''} />
                  </div>
                  <div className="col-span-3">
                    <div className="text-[11px] text-gray-600">Apt/Suite</div>
                    <input readOnly className="h-9 w-full border border-gray-200 rounded px-3 text-sm bg-gray-50" value={t.ownerSuite || ''} />
                  </div>
                  <div className="col-span-3">
                    <div className="text-[11px] text-gray-600">City</div>
                    <input readOnly className="h-9 w-full border border-gray-200 rounded px-3 text-sm bg-gray-50" value={t.ownerCity || ''} />
                  </div>
                  <div className="col-span-3">
                    <div className="text-[11px] text-gray-600">Province</div>
                    <input readOnly className="h-9 w-full border border-gray-200 rounded px-3 text-sm bg-gray-50" value={t.ownerProvince || ''} />
                  </div>
                  <div className="col-span-3">
                    <div className="text-[11px] text-gray-600">Postal Code</div>
                    <input readOnly className="h-9 w-full border border-gray-200 rounded px-3 text-sm bg-gray-50" value={t.ownerPostal || ''} />
                  </div>
                  <div className="col-span-3">
                    <div className="text-[11px] text-gray-600">Country</div>
                    <input readOnly className="h-9 w-full border border-gray-200 rounded px-3 text-sm bg-gray-50" value={t.ownerCountry || ''} />
                  </div>

                  <div className="col-span-12 text-[11px] text-[#118df0]">
                    <button
                      type="button"
                      className="text-[#118df0] hover:underline"
                      onClick={() => setOpenSavedDisclosureIdx(openSavedDisclosureIdx === idx ? null : idx)}
                    >
                      Disclosures &gt;
                    </button>
                  </div>

                  {openSavedDisclosureIdx === idx ? (
                    <div className="col-span-12 mt-2 border-t border-gray-200 pt-3">
                      <div className="text-[12px] text-[#1f4f7a] bg-[#e8f1fb] border border-[#cfe3f9] rounded px-3 py-2 mb-3">
                        This checklist can be used to identify common disclosures.
                      </div>
                      <div className="space-y-1">
                        {disclosureQuestions.map((q, i) => {
                          const val = Array.isArray(t.disclosures) ? !!t.disclosures[i] : false
                          return (
                            <div key={i} className="flex items-center justify-between py-1 text-sm">
                              <div className="pr-6">
                                {i + 1}. {q}
                              </div>
                              <span className={val ? 'h-6 w-12 rounded-full bg-[#118df0] text-white text-[10px] font-semibold flex items-center justify-center' : 'h-6 w-12 rounded-full border border-gray-300 bg-white text-gray-700 text-[10px] font-semibold flex items-center justify-center'}>
                                {val ? 'YES' : 'NO'}
                              </span>
                            </div>
                          )
                        })}
                      </div>

                      <div className="mt-3 text-xs text-red-600 leading-5">
                        Please read over the following list to confirm that the items listed are in working order. If they are NOT working please indicate the issue(s) in the box below:
                        <div className="mt-2 uppercase">
                          ENGINE, SUSPENSION, SUB FRAME (because of possible structural damage), TRANSMISSION, FUEL SYSTEM, POLLUTION CONTROL SYSTEM, POWER-TRAIN, COMPUTER, ELECTRICAL SYSTEM, AIR CONDITIONING, WINDSHIELD NOT CRACKED, ABS, AIRBAGS, DASH INDICATOR LIGHTS
                        </div>
                      </div>

                      <textarea
                        className="mt-3 w-full h-24 border border-gray-200 rounded p-3 text-sm"
                        value={t.disclosuresNotes || ''}
                        onChange={(e) => {
                          const val = e.target.value
                          setSavedTrades((prev) => prev.map((it, i) => (i === idx ? { ...it, disclosuresNotes: val } : it)))
                        }}
                        placeholder="Add notes about items not working..."
                      />

                      <div className="mt-4 text-sm text-gray-700">
                        <div className="font-semibold mb-2">Brand Type:</div>
                        <div className="flex items-center gap-4">
                          {([
                            { k: 'na', l: 'N/A' },
                            { k: 'none', l: 'None' },
                            { k: 'rebuilt', l: 'Rebuilt' },
                            { k: 'salvage', l: 'Salvage' },
                            { k: 'irreparable', l: 'Irreparable' },
                          ] as const).map((o) => (
                            <label key={o.k} className="flex items-center gap-1.5 text-sm">
                              <input
                                type="radio"
                                name={`saved-brand-type-${idx}`}
                                checked={(t.brandType || 'na') === o.k}
                                onChange={() => setSavedTrades((prev) => prev.map((it, i) => (i === idx ? { ...it, brandType: o.k } : it)))}
                              />
                              <span>{o.l}</span>
                            </label>
                          ))}
                        </div>
                      </div>

                      <div className="mt-4 grid grid-cols-12 gap-4">
                        <div className="col-span-5">
                          <div className="flex items-stretch border border-gray-200 rounded overflow-hidden">
                            <div className="w-10 flex items-center justify-center bg-gray-100 text-gray-700 border-r border-gray-200">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35" /><circle cx="10" cy="10" r="6" strokeWidth={2} /></svg>
                            </div>
                            <input
                              value={t.disclosuresSearch || ''}
                              onChange={(e) =>
                                setSavedTrades((prev) => prev.map((it, i) => (i === idx ? { ...it, disclosuresSearch: e.target.value } : it)))
                              }
                              className="flex-1 h-10 px-3 text-sm outline-none"
                              placeholder="Search"
                            />
                          </div>

                          <div className="mt-3 h-[220px] overflow-y-auto border border-gray-200 rounded bg-white">
                            <div className="p-3 text-xs text-gray-500">Templates preview (read-only)</div>
                            <div className="px-3 pb-3 text-sm text-gray-600">The vehicle was previously from another Province</div>
                            <div className="px-3 pb-3 text-sm text-gray-600">Customer Acknowledgment Clause</div>
                          </div>
                        </div>

                        <div className="col-span-7">
                          <div className="border border-gray-200 rounded overflow-hidden">
                            <div className="h-10 border-b border-gray-200 flex items-center gap-1 px-2 bg-white">
                              <button type="button" onClick={() => execInline('bold')} className="h-8 px-2 border border-gray-200 rounded text-xs">B</button>
                              <button type="button" onClick={() => execInline('italic')} className="h-8 px-2 border border-gray-200 rounded text-xs italic">I</button>
                              <button type="button" onClick={() => execInline('underline')} className="h-8 px-2 border border-gray-200 rounded text-xs underline">U</button>
                              <button type="button" onClick={() => execInline('strikeThrough')} className="h-8 px-2 border border-gray-200 rounded text-xs line-through">S</button>
                              <button type="button" onClick={() => execInline('insertUnorderedList')} className="h-8 px-2 border border-gray-200 rounded text-xs">•</button>
                              <button type="button" onClick={() => execInline('insertOrderedList')} className="h-8 px-2 border border-gray-200 rounded text-xs">1.</button>
                            </div>
                            <div
                              ref={inlineEditorRef}
                              contentEditable
                              suppressContentEditableWarning
                              className="w-full h-[220px] p-3 text-sm bg-[#f7fbff] overflow-auto"
                              onInput={(e) => {
                                const html = (e.currentTarget as HTMLDivElement).innerHTML
                                setSavedTrades((prev) => prev.map((it, i) => (i === idx ? { ...it, disclosuresEditor: html } : it)))
                              }}
                              dangerouslySetInnerHTML={{ __html: t.disclosuresEditor || '' }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-6 flex flex-col items-end gap-2">
          {saveError ? (
            <div className="px-4 py-2 bg-red-50 border border-red-200 rounded text-sm text-red-700 self-stretch text-right">{saveError}</div>
          ) : null}
          <button
            type="button"
            onClick={handleSaveAllTrades}
            disabled={savingTrades}
            className="h-10 px-6 rounded bg-[#118df0] text-white text-sm font-semibold hover:bg-[#0d6ebd] disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {savingTrades ? (hasBeenSaved ? 'Updating…' : 'Saving…') : hasBeenSaved ? 'Update' : 'Save'}
          </button>
        </div>
      </div>

      {addOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-[980px] max-w-[calc(100vw-48px)] max-h-[90vh] bg-white rounded shadow-xl flex flex-col">
            <div className="relative border-b border-gray-200 px-6 py-4 flex items-center gap-3">
              <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7h18M5 7v10a2 2 0 002 2h10a2 2 0 002-2V7" />
              </svg>
              <div className="font-semibold text-gray-800">Add Vehicle</div>
              <button
                type="button"
                aria-label="Close"
                onClick={() => {
                  resetAddModal()
                  setAddOpen(false)
                }}
                className="absolute right-4 top-4 text-gray-500 hover:text-gray-700"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div ref={addModalContentRef} className="px-6 py-5 flex-1 overflow-y-auto">
              {addSaveError ? (
                <div className="mb-3 rounded border border-red-200 bg-red-50 text-red-700 px-3 py-2 text-sm">
                  {addSaveError}
                </div>
              ) : null}
              <div className="mb-4 rounded border border-[#cce5ff] bg-[#e9f3ff] text-[#0c5460] p-3 text-sm">
                <div className="font-semibold mb-1">Stock this vehicle into inventory \"on-the-fly\"</div>
                <div>With this feature, enter (limited) vehicle details, so you can quickly print this deal! If you need to add further information - please do so by clicking on the vehicle from inventory!</div>
              </div>
              <div className="grid grid-cols-12 gap-4">
                <div className="col-span-4">
                  <div className="text-xs text-gray-700 mb-1">In Stock Date</div>
                  <input
                    type="date"
                    value={addForm.inStockDate}
                    onChange={(e) => setAddForm((p) => ({ ...p, inStockDate: e.target.value }))}
                    className="w-full h-9 border border-gray-200 rounded px-3 text-sm"
                  />
                </div>
                <div className="col-span-4">
                  <div className="text-xs text-gray-700 mb-1">Stock #</div>
                  <input
                    value={addForm.stockNumber}
                    onChange={(e) => setAddForm((p) => ({ ...p, stockNumber: e.target.value }))}
                    className="w-full h-9 border border-gray-200 rounded px-3 text-sm"
                  />
                </div>
              </div>

              <div className="mt-3 grid grid-cols-12 gap-4 items-end">
                <div className="col-span-4">
                  <div className="text-xs text-gray-700 mb-1">VIN</div>
                  <div className="flex gap-2">
                    <input
                      value={addForm.vin}
                      onChange={(e) => setAddForm((p) => ({ ...p, vin: e.target.value }))}
                      className="flex-1 h-9 border border-gray-200 rounded px-3 text-sm"
                    />
                    <button
                      type="button"
                      onClick={handleAddDecode}
                      disabled={addDecodeLoading}
                      className="h-9 px-4 rounded bg-[#118df0] text-white text-sm font-semibold hover:bg-[#0d6ebd] disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {addDecodeLoading ? 'Decoding...' : 'Decode'}
                    </button>
                  </div>
                  {addDecodeError ? <div className="mt-1 text-xs text-red-600">{addDecodeError}</div> : null}
                </div>
                <div className="col-span-4">
                  <div className="text-xs text-gray-700 mb-1">Odometer</div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-stretch border border-gray-200 rounded overflow-hidden flex-1">
                      <input
                        value={addForm.odometer}
                        onChange={(e) => setAddForm((p) => ({ ...p, odometer: e.target.value }))}
                        className="flex-1 h-9 px-3 text-sm outline-none"
                      />
                      <select
                        value={addForm.odometerUnit}
                        onChange={(e) => setAddForm((p) => ({ ...p, odometerUnit: e.target.value }))}
                        className="h-9 px-2 text-sm bg-white border-l border-gray-200"
                      >
                        <option value="kms">kms</option>
                        <option value="miles">miles</option>
                      </select>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-gray-700">CERT/AS-IS</span>
                      <button
                        type="button"
                        onClick={() => setAddCertAsIs(v => !v)}
                        className="h-6 w-[58px] px-2 rounded-full border relative border-[#118df0] text-[#118df0]"
                        title="Toggle CERT/AS-IS"
                      >
                        <span className="text-[10px] font-semibold leading-6 select-none">{addCertAsIs ? 'AS-IS' : 'CERT'}</span>
                        <span className={`absolute top-0.5 ${addCertAsIs ? 'right-0.5' : 'left-0.5'} h-5 w-5 rounded-full bg-[#118df0]`} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-12 gap-4">
                <div className="col-span-3">
                  <div className="text-xs text-gray-700 mb-1">Year</div>
                  <input
                    value={addForm.year}
                    onChange={(e) => setAddForm((p) => ({ ...p, year: e.target.value }))}
                    className="w-full h-9 border border-gray-200 rounded px-3 text-sm"
                  />
                </div>
                <div className="col-span-3">
                  <div className="text-xs text-gray-700 mb-1">Make</div>
                  <input
                    value={addForm.make}
                    onChange={(e) => setAddForm((p) => ({ ...p, make: e.target.value }))}
                    className="w-full h-9 border border-gray-200 rounded px-3 text-sm"
                  />
                </div>
                <div className="col-span-3">
                  <div className="text-xs text-gray-700 mb-1">Model</div>
                  <input
                    value={addForm.model}
                    onChange={(e) => setAddForm((p) => ({ ...p, model: e.target.value }))}
                    className="w-full h-9 border border-gray-200 rounded px-3 text-sm"
                  />
                </div>
                <div className="col-span-3">
                  <div className="text-xs text-gray-700 mb-1">Trim</div>
                  <input
                    value={addForm.trim}
                    onChange={(e) => setAddForm((p) => ({ ...p, trim: e.target.value }))}
                    className="w-full h-9 border border-gray-200 rounded px-3 text-sm"
                  />
                </div>
              </div>

              <div className="mt-3 grid grid-cols-12 gap-4">
                <div className="col-span-6">
                  <div className="text-xs text-gray-700 mb-1">Exterior Colour</div>
                  <input
                    value={addForm.exteriorColour}
                    onChange={(e) => setAddForm((p) => ({ ...p, exteriorColour: e.target.value }))}
                    className="w-full h-9 border border-gray-200 rounded px-3 text-sm"
                  />
                </div>
                <div className="col-span-6">
                  <div className="text-xs text-gray-700 mb-1">Fuel Type</div>
                  <select
                    value={addForm.fuelType}
                    onChange={(e) => setAddForm((p) => ({ ...p, fuelType: e.target.value }))}
                    className="w-full h-9 border border-gray-200 rounded px-3 text-sm bg-white"
                  >
                    <option value="" />
                    <option value="Gasoline">Gasoline</option>
                    <option value="Diesel">Diesel</option>
                    <option value="Hybrid">Hybrid</option>
                    <option value="Electric">Electric</option>
                  </select>
                </div>
              </div>

              <div className="mt-4">
                <div className="text-xs text-gray-700 mb-1">Notes</div>
                <textarea
                  value={addForm.notes}
                  onChange={(e) => setAddForm((p) => ({ ...p, notes: e.target.value }))}
                  className="w-full h-24 border border-gray-200 rounded p-3 text-sm"
                  placeholder="Ex. Has funny smell."
                />
              </div>
            </div>

            <div className="px-6 py-4 flex justify-end gap-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => {
                  resetAddModal()
                  setAddOpen(false)
                }}
                className="h-9 px-4 rounded bg-[#e74c3c] text-white text-sm font-semibold hover:bg-[#cf3e2e]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddSave}
                disabled={addSaving}
                className="h-9 px-4 rounded bg-[#118df0] text-white text-sm font-semibold hover:bg-[#0d6ebd] disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {addSaving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {tradeOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-[980px] max-w-[calc(100vw-48px)] max-h-[85vh] bg-white rounded shadow-xl flex flex-col">
            <div className="relative border-b border-gray-200 px-6 py-4">
              <button
                type="button"
                aria-label="Close"
                onClick={() => setTradeOpen(false)}
                className="absolute right-4 top-4 text-gray-500 hover:text-gray-700"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>

              <div className="grid grid-cols-4 gap-6">
                {(
                  [
                    { n: 1 as const, t: 'VEHICLE INFORMATION' },
                    { n: 2 as const, t: 'DISCLOSURES' },
                    { n: 3 as const, t: 'OWNER INFORMATION' },
                    { n: 4 as const, t: 'TRADE VALUE' },
                  ] as const
                ).map((s) => (
                  <button
                    key={s.n}
                    type="button"
                    onClick={() => setTradeStep(s.n)}
                    className="text-left"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={
                          s.n === tradeStep
                            ? 'h-7 w-7 rounded-full border border-green-500 text-green-600 flex items-center justify-center text-xs font-semibold bg-white'
                            : 'h-7 w-7 rounded-full border border-gray-300 flex items-center justify-center text-xs font-semibold bg-white text-gray-600'
                        }
                      >
                        {s.n}
                      </div>
                      <div className={s.n === tradeStep ? 'text-[11px] font-semibold text-gray-700' : 'text-[11px] font-semibold text-gray-400'}>
                        {s.t}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="px-8 py-6 flex-1 overflow-y-auto">
              {tradeStep === 1 ? (
                <>
                  <div className="text-sm font-semibold text-gray-800">Step 1 - Vehicle Information</div>

                  <div className="mt-4 grid grid-cols-12 gap-4">
                    <div className="col-span-6">
                      <div className="text-xs text-gray-700 mb-1">Vin</div>
                      <input
                        value={tradeForm.vin}
                        onChange={(e) => setTradeForm((p) => ({ ...p, vin: e.target.value }))}
                        className="w-full h-9 border border-gray-200 rounded px-3 text-sm"
                      />
                      {tradeDecodeError ? <div className="mt-1 text-xs text-red-600">{tradeDecodeError}</div> : null}
                    </div>
                    <div className="col-span-2 flex items-end">
                      <button 
                        type="button" 
                        onClick={handleTradeDecode}
                        disabled={tradeDecodeLoading}
                        className="h-9 px-4 rounded bg-[#118df0] text-white text-sm font-semibold hover:bg-[#0d6ebd] disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {tradeDecodeLoading ? 'Decoding...' : 'Decode'}
                      </button>
                    </div>

                    <div className="col-span-3">
                      <div className="text-xs text-gray-700 mb-1">Year</div>
                      <input
                        value={tradeForm.year}
                        onChange={(e) => setTradeForm((p) => ({ ...p, year: e.target.value }))}
                        className="w-full h-9 border border-gray-200 rounded px-3 text-sm"
                      />
                    </div>
                    <div className="col-span-3">
                      <div className="text-xs text-gray-700 mb-1">Make</div>
                      <input
                        value={tradeForm.make}
                        onChange={(e) => setTradeForm((p) => ({ ...p, make: e.target.value }))}
                        className="w-full h-9 border border-gray-200 rounded px-3 text-sm"
                      />
                    </div>
                    <div className="col-span-4">
                      <div className="text-xs text-gray-700 mb-1">Model</div>
                      <input
                        value={tradeForm.model}
                        onChange={(e) => setTradeForm((p) => ({ ...p, model: e.target.value }))}
                        className="w-full h-9 border border-gray-200 rounded px-3 text-sm"
                      />
                    </div>

                    <div className="col-span-4">
                      <div className="text-xs text-gray-700 mb-1">odometer</div>
                      <div className="flex items-stretch border border-gray-200 rounded overflow-hidden">
                        <div className="w-10 flex items-center justify-center bg-gray-100 text-gray-700 border-r border-gray-200">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 2a10 10 0 100 20 10 10 0 000-20z" />
                          </svg>
                        </div>
                        <input
                          value={tradeForm.odometer}
                          onChange={(e) => setTradeForm((p) => ({ ...p, odometer: e.target.value }))}
                          className="flex-1 h-9 px-3 text-sm outline-none"
                        />
                        <select
                          value={tradeForm.odometerUnit}
                          onChange={(e) => setTradeForm((p) => ({ ...p, odometerUnit: e.target.value }))}
                          className="h-9 px-2 text-sm bg-white border-l border-gray-200"
                        >
                          <option value="kms">kms</option>
                          <option value="miles">miles</option>
                        </select>
                      </div>
                    </div>

                    <div className="col-span-4">
                      <div className="text-xs text-gray-700 mb-1">Trim</div>
                      <input
                        value={tradeForm.trim}
                        onChange={(e) => setTradeForm((p) => ({ ...p, trim: e.target.value }))}
                        className="w-full h-9 border border-gray-200 rounded px-3 text-sm"
                      />
                    </div>

                    <div className="col-span-4">
                      <div className="text-xs text-gray-700 mb-1">colour</div>
                      <input
                        value={tradeForm.colour}
                        onChange={(e) => setTradeForm((p) => ({ ...p, colour: e.target.value }))}
                        className="w-full h-9 border border-gray-200 rounded px-3 text-sm"
                      />
                    </div>
                  </div>

                  <div className="mt-6 border-t border-gray-200" />
                </>
              ) : null}

              {tradeStep === 2 ? (
                <>
                  <div className="text-sm font-semibold text-gray-800">Step 2 - Disclosures</div>

                  <div className="mt-4 border border-gray-200 bg-[#e8f1fb] px-4 py-3 text-sm text-[#1f4f7a]">
                    <div className="flex items-start gap-2">
                      <div className="mt-0.5 text-[#1f4f7a]">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 2a10 10 0 100 20 10 10 0 000-20z" />
                        </svg>
                      </div>
                      <div>
                        This checklist can be used to identify common disclosures and to print a trade appraisal form. Click the{' '}
                        <span className="italic font-semibold">Update Disclosures</span> button below to automatically populate your disclosures for the
                        traded vehicle based on these items selected.
                      </div>
                    </div>
                  </div>

                  <div className="mt-4">
                    {[
                      'Has the trade-in previously been used as a daily rental, police, taxi, limo, or emergency vehicle?',
                      'Does the trade-in have a lien registered against it?',
                      'Has the trade-in sustained any structural damage?',
                      'Has the trade-in sustained any accident damage that resulted in an insurance claim, estimate or police report?',
                      'Has the vehicle previously been branded as irreparable, salvage, or rebuilt?',
                      'Has the trade-in sustained any fire or water damage?',
                      'Has the vehicle had previous paintwork?',
                      'Has the trade-in ever been registered outside of your local jurisdiction (i.e. Province or State)?',
                      'Is the odometer faulty, broken, or rolled back?',
                      'Manufacturer equipment/badges altered or replaced?',
                      'Was the vehicle ever stolen and/or reported as stolen?',
                      "Has the manufacturers warranty been cancelled?",
                      'Has the vehicle ever been declared a total loss by an insurance company?',
                      'Has the vehicle had any body panel painted and or replaced?',
                    ].map((q, idx) => (
                      <div key={idx} className="flex items-center justify-between py-1 text-sm">
                        <div className="pr-6">
                          {idx + 1}. {q}
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setTradeForm((p) => {
                              const next = [...p.disclosures]
                              next[idx] = !next[idx]
                              return { ...p, disclosures: next }
                            })
                          }
                          className={
                            tradeForm.disclosures[idx]
                              ? 'h-6 w-12 rounded-full bg-[#118df0] text-white text-[10px] font-semibold'
                              : 'h-6 w-12 rounded-full border border-gray-300 bg-white text-gray-700 text-[10px] font-semibold'
                          }
                        >
                          {tradeForm.disclosures[idx] ? 'YES' : 'NO'}
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="mt-3 text-xs text-red-600 leading-5">
                    Please read over the following list to confirm that the items listed are in working order. If they are NOT working please indicate the
                    issue(s) in the box below:
                    <div className="mt-2 uppercase">
                      ENGINE, SUSPENSION, SUB FRAME (because of possible structural damage), TRANSMISSION, FUEL SYSTEM,
                      POLLUTION CONTROL SYSTEM, POWER-TRAIN, COMPUTER, ELECTRICAL SYSTEM, AIR CONDITIONING, WINDSHIELD NOT CRACKED,
                      ABS, AIRBAGS, DASH INDICATOR LIGHTS
                    </div>
                    <div className="mt-2">
                      Note: If using the UCDA trade appraisal form, you can use some of the terms above to trigger the appropriate selection on that form
                    </div>
                  </div>

                  <textarea
                    value={tradeForm.disclosuresNotes}
                    onChange={(e) => setTradeForm((p) => ({ ...p, disclosuresNotes: e.target.value }))}
                    className="mt-3 w-full h-24 border border-gray-200 rounded p-3 text-sm"
                  />

                  <div className="mt-4 flex items-center justify-between">
                    <button
                      type="button"
                      className="text-sm text-[#118df0] hover:underline"
                      onClick={() => setTradeDisclosuresDetail((v) => !v)}
                    >
                      Disclosures &gt;
                    </button>
                    <button type="button" className="h-9 px-4 rounded bg-[#118df0] text-white text-sm font-semibold hover:bg-[#0d6ebd]">
                      Update Disclosures
                    </button>
                  </div>

                  {tradeDisclosuresDetail ? (
                    <>
                      <div className="mt-3 flex items-center gap-3 text-sm text-gray-700">
                        <div className="font-semibold">Brand Type:</div>
                        {(
                          [
                            { k: 'na' as const, l: 'N/A' },
                            { k: 'none' as const, l: 'None' },
                            { k: 'rebuilt' as const, l: 'Rebuilt' },
                            { k: 'salvage' as const, l: 'Salvage' },
                            { k: 'irreparable' as const, l: 'Irreparable' },
                          ] as const
                        ).map((o) => (
                          <label key={o.k} className="flex items-center gap-1.5">
                            <input
                              type="radio"
                              name="trade-brand-type"
                              checked={tradeDisclosuresBrandType === o.k}
                              onChange={() => setTradeDisclosuresBrandType(o.k)}
                            />
                            <span>{o.l}</span>
                          </label>
                        ))}
                      </div>

                      <div className="mt-3 grid grid-cols-12 gap-4">
                        <div className="col-span-5">
                          <div className="flex items-stretch border border-gray-200 rounded overflow-hidden">
                            <div className="w-10 flex items-center justify-center bg-gray-100 text-gray-700 border-r border-gray-200">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35" />
                                <circle cx="10" cy="10" r="6" strokeWidth={2} />
                              </svg>
                            </div>
                            <input
                              value={tradeDisclosuresSearch}
                              onChange={(e) => setTradeDisclosuresSearch(e.target.value)}
                              className="flex-1 h-10 px-3 text-sm outline-none"
                            />
                          </div>

                          <div className="mt-3 h-[320px] overflow-y-auto border border-gray-200 rounded">
                            <div className="p-3">
                              <div className="border border-gray-200 rounded p-3">
                                <div className="text-sm italic text-gray-700">The vehicle was previously from another Province</div>
                                <div className="mt-3">
                                  <button
                                    type="button"
                                    className="w-full h-10 rounded bg-[#118df0] text-white text-sm font-semibold hover:bg-[#0d6ebd]"
                                    onClick={() => setTradeDisclosuresEditor('The vehicle was previously from another Province')}
                                  >
                                    Add
                                  </button>
                                </div>
                              </div>

                              <div className="mt-4 border border-gray-200 rounded p-3">
                                <div className="text-sm font-semibold text-gray-800">Customer Acknowledgment Clause</div>
                                <div className="mt-2 text-sm text-gray-700 leading-5">
                                  The Buyer confirms that they have inspected the vehicle, provided the car fax report, reviewed the Bill of Sale,
                                  test-driven the vehicle with a salesperson, explained all questions, including the bill of sale, by the salesperson,
                                  and had all questions answered to their satisfaction.
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="col-span-7">
                          <div className="border border-gray-200 rounded overflow-hidden">
                            <div className="h-10 border-b border-gray-200 flex items-center gap-1 px-2 bg-white">
                              {['B', 'I', 'U', 'S', 'X', '16', 'A', '≡', 'T', '</>'].map((t) => (
                                <button
                                  key={t}
                                  type="button"
                                  className="h-8 px-2 border border-gray-200 rounded text-xs text-gray-700 hover:bg-gray-50"
                                >
                                  {t}
                                </button>
                              ))}
                            </div>
                            <textarea
                              value={tradeDisclosuresEditor}
                              onChange={(e) => setTradeDisclosuresEditor(e.target.value)}
                              className="w-full h-[344px] p-3 text-sm outline-none bg-[#f7fbff]"
                            />
                          </div>
                        </div>
                      </div>
                    </>
                  ) : null}
                </>
              ) : null}

              {tradeStep === 3 ? (
                <>
                  <div className="text-sm font-semibold text-gray-800">Step 3 - Owner Information</div>

                  <div className="mt-4">
                    <button type="button" className="h-10 w-10 rounded bg-[#118df0] text-white flex items-center justify-center">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v14m7-7H5" />
                      </svg>
                    </button>
                  </div>

                  <div className="mt-4 flex items-center gap-4">
                    <div className="text-sm text-gray-700">Is Company</div>
                    <button
                      type="button"
                      onClick={() => setTradeForm((p) => ({ ...p, isCompany: !p.isCompany }))}
                      className={
                        tradeForm.isCompany
                          ? 'h-6 w-11 rounded-full bg-[#118df0] relative'
                          : 'h-6 w-11 rounded-full bg-gray-200 relative'
                      }
                    >
                      <div
                        className={
                          tradeForm.isCompany
                            ? 'h-5 w-5 bg-white rounded-full absolute right-0.5 top-0.5'
                            : 'h-5 w-5 bg-white rounded-full absolute left-0.5 top-0.5'
                        }
                      />
                    </button>
                  </div>

                  <div className="mt-4 grid grid-cols-12 gap-4">
                    <div className="col-span-4">
                      <div className="flex items-stretch border border-gray-200 rounded overflow-hidden">
                        <div className="w-10 flex items-center justify-center bg-gray-100 text-gray-700 border-r border-gray-200">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                            <circle cx="12" cy="7" r="4" strokeWidth={2} />
                          </svg>
                        </div>
                        <input
                          value={tradeForm.ownerName}
                          onChange={(e) => setTradeForm((p) => ({ ...p, ownerName: e.target.value }))}
                          placeholder="Name of owner"
                          className="flex-1 h-10 px-3 text-sm outline-none"
                        />
                      </div>
                    </div>

                    {tradeForm.isCompany ? (
                      <div className="col-span-4">
                        <div className="flex items-stretch border border-gray-200 rounded overflow-hidden">
                          <div className="w-10 flex items-center justify-center bg-gray-100 text-gray-700 border-r border-gray-200">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7h18M5 7v10a2 2 0 002 2h10a2 2 0 002-2V7" />
                            </svg>
                          </div>
                          <input
                            value={tradeForm.ownerCompany}
                            onChange={(e) => setTradeForm((p) => ({ ...p, ownerCompany: e.target.value }))}
                            placeholder="Name of company"
                            className="flex-1 h-10 px-3 text-sm outline-none"
                          />
                        </div>
                      </div>
                    ) : null}

                    <div className="col-span-5">
                      <div className="flex items-stretch border border-gray-200 rounded overflow-hidden">
                        <div className="w-10 flex items-center justify-center bg-gray-100 text-gray-700 border-r border-gray-200">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c1.657 0 3-1.343 3-3S13.657 5 12 5 9 6.343 9 8s1.343 3 3 3z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.5 8c0 7-7.5 13-7.5 13S4.5 15 4.5 8a7.5 7.5 0 1115 0z" />
                          </svg>
                        </div>
                        <input
                          value={tradeForm.ownerStreet}
                          onChange={(e) => setTradeForm((p) => ({ ...p, ownerStreet: e.target.value }))}
                          placeholder="Enter a location"
                          className="flex-1 h-10 px-3 text-sm outline-none"
                        />
                      </div>
                    </div>

                    <div className="col-span-3">
                      <div className="flex items-stretch border border-gray-200 rounded overflow-hidden">
                        <div className="w-10 flex items-center justify-center bg-gray-100 text-gray-700 border-r border-gray-200">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c1.657 0 3-1.343 3-3S13.657 5 12 5 9 6.343 9 8s1.343 3 3 3z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.5 8c0 7-7.5 13-7.5 13S4.5 15 4.5 8a7.5 7.5 0 1115 0z" />
                          </svg>
                        </div>
                        <input
                          value={tradeForm.ownerSuite}
                          onChange={(e) => setTradeForm((p) => ({ ...p, ownerSuite: e.target.value }))}
                          placeholder="Apt/suite #"
                          className="flex-1 h-10 px-3 text-sm outline-none"
                        />
                      </div>
                    </div>

                    <div className="col-span-12">
                      <div className="flex items-stretch border border-gray-200 rounded overflow-hidden">
                        <div className="w-10 flex items-center justify-center bg-gray-100 text-gray-700 border-r border-gray-200">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c1.657 0 3-1.343 3-3S13.657 5 12 5 9 6.343 9 8s1.343 3 3 3z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.5 8c0 7-7.5 13-7.5 13S4.5 15 4.5 8a7.5 7.5 0 1115 0z" />
                          </svg>
                        </div>
                        <input
                          value={tradeForm.ownerCity}
                          onChange={(e) => setTradeForm((p) => ({ ...p, ownerCity: e.target.value }))}
                          placeholder="City"
                          className="flex-1 h-10 px-3 text-sm outline-none"
                        />
                      </div>
                    </div>

                    <div className="col-span-12">
                      <select
                        value={tradeForm.ownerProvince}
                        onChange={(e) => setTradeForm((p) => ({ ...p, ownerProvince: e.target.value }))}
                        className="w-full h-10 border border-gray-200 rounded px-3 text-sm bg-white"
                      >
                        <option value="ON">ON</option>
                        <option value="BC">BC</option>
                        <option value="AB">AB</option>
                        <option value="MB">MB</option>
                        <option value="QC">QC</option>
                      </select>
                    </div>

                    <div className="col-span-3">
                      <div className="flex items-stretch border border-gray-200 rounded overflow-hidden">
                        <div className="w-10 flex items-center justify-center bg-gray-100 text-gray-700 border-r border-gray-200">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c1.657 0 3-1.343 3-3S13.657 5 12 5 9 6.343 9 8s1.343 3 3 3z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.5 8c0 7-7.5 13-7.5 13S4.5 15 4.5 8a7.5 7.5 0 1115 0z" />
                          </svg>
                        </div>
                        <input
                          value={tradeForm.ownerPostal}
                          onChange={(e) => setTradeForm((p) => ({ ...p, ownerPostal: e.target.value }))}
                          placeholder="Postal code"
                          className="flex-1 h-10 px-3 text-sm outline-none"
                        />
                      </div>
                    </div>

                    <div className="col-span-9">
                      <select
                        value={tradeForm.ownerCountry}
                        onChange={(e) => setTradeForm((p) => ({ ...p, ownerCountry: e.target.value }))}
                        className="w-full h-10 border border-gray-200 rounded px-3 text-sm bg-white"
                      >
                        <option value="CA">CA</option>
                        <option value="US">US</option>
                      </select>
                    </div>

                    <div className="col-span-4">
                      <div className="flex items-stretch border border-gray-200 rounded overflow-hidden">
                        <div className="w-10 flex items-center justify-center bg-gray-100 text-gray-700 border-r border-gray-200">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h2.28a1 1 0 01.948.684l1.5 4.5a1 1 0 01-.272 1.06l-1.7 1.7a16 16 0 006.586 6.586l1.7-1.7a1 1 0 011.06-.272l4.5 1.5a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                          </svg>
                        </div>
                        <input
                          value={tradeForm.ownerPhone}
                          onChange={(e) => setTradeForm((p) => ({ ...p, ownerPhone: e.target.value }))}
                          placeholder="(  ) _ _ _ _"
                          className="flex-1 h-10 px-3 text-sm outline-none"
                        />
                      </div>
                    </div>
                    <div className="col-span-4">
                      <div className="flex items-stretch border border-gray-200 rounded overflow-hidden">
                        <div className="w-10 flex items-center justify-center bg-gray-100 text-gray-700 border-r border-gray-200">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4h10a2 2 0 012 2v12a2 2 0 01-2 2H7a2 2 0 01-2-2V6a2 2 0 012-2z" />
                          </svg>
                        </div>
                        <input
                          value={tradeForm.ownerMobile}
                          onChange={(e) => setTradeForm((p) => ({ ...p, ownerMobile: e.target.value }))}
                          placeholder="(  ) _ _ _ _"
                          className="flex-1 h-10 px-3 text-sm outline-none"
                        />
                      </div>
                    </div>
                    <div className="col-span-4">
                      <div className="flex items-stretch border border-gray-200 rounded overflow-hidden">
                        <div className="w-10 flex items-center justify-center bg-gray-100 text-gray-700 border-r border-gray-200">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l9 6 9-6" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 8v10a2 2 0 01-2 2H5a2 2 0 01-2-2V8" />
                          </svg>
                        </div>
                        <input
                          value={tradeForm.ownerEmail}
                          onChange={(e) => setTradeForm((p) => ({ ...p, ownerEmail: e.target.value }))}
                          placeholder="email"
                          className="flex-1 h-10 px-3 text-sm outline-none"
                        />
                      </div>
                    </div>

                    <div className="col-span-12 mt-1 flex items-center gap-4">
                      <div className="text-sm text-gray-700">Is RIN</div>
                      <button
                        type="button"
                        onClick={() => setTradeForm((p) => ({ ...p, isRin: !p.isRin }))}
                        className={
                          tradeForm.isRin
                            ? 'h-6 w-11 rounded-full bg-[#118df0] relative'
                            : 'h-6 w-11 rounded-full bg-gray-200 relative'
                        }
                      >
                        <div
                          className={
                            tradeForm.isRin
                              ? 'h-5 w-5 bg-white rounded-full absolute right-0.5 top-0.5'
                              : 'h-5 w-5 bg-white rounded-full absolute left-0.5 top-0.5'
                          }
                        />
                      </button>
                    </div>

                    <div className="col-span-6">
                      <div className="text-xs text-gray-700 mb-1">{tradeForm.isRin ? 'RIN' : 'Drivers License #'}</div>
                      <input
                        value={tradeForm.ownerDl}
                        onChange={(e) => setTradeForm((p) => ({ ...p, ownerDl: e.target.value }))}
                        className="w-full h-9 border border-gray-200 rounded px-3 text-sm"
                      />
                    </div>
                    <div className="col-span-6">
                      <div className="text-xs text-gray-700 mb-1">Plate #</div>
                      <input
                        value={tradeForm.ownerPlate}
                        onChange={(e) => setTradeForm((p) => ({ ...p, ownerPlate: e.target.value }))}
                        className="w-full h-9 border border-gray-200 rounded px-3 text-sm"
                      />
                    </div>
                  </div>
                </>
              ) : null}

              {tradeStep === 4 ? (
                <>
                  <div className="text-sm font-semibold text-gray-800">Step 4 - Trade Value</div>
                  {tradeSubmitError ? (
                    <div className="mt-3 px-4 py-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                      {tradeSubmitError}
                    </div>
                  ) : null}
                  <div className="mt-6 grid grid-cols-4 gap-6">
                    <div>
                      <div className="text-xs text-gray-700 mb-1 flex items-center gap-1">
                        <span>Trade Value</span>
                      </div>
                      <div className="flex items-stretch border border-gray-200 rounded overflow-hidden bg-white">
                        <div className="w-10 flex items-center justify-center bg-gray-100 text-gray-700 border-r border-gray-200">$</div>
                        <input
                          value={tradeForm.tradeValue}
                          onChange={(e) => setTradeForm((p) => ({ ...p, tradeValue: e.target.value }))}
                          onFocus={() => handleMoneyFocus('tradeValue')}
                          onBlur={() => handleMoneyBlur('tradeValue')}
                          className="flex-1 h-10 px-3 text-sm outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <div className="text-xs text-gray-700 mb-1 flex items-center gap-1">
                        <span>Actual Cash Value</span>
                        <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 2a10 10 0 100 20 10 10 0 000-20z" />
                        </svg>
                      </div>
                      <div className="flex items-stretch border border-gray-200 rounded overflow-hidden bg-white">
                        <div className="w-10 flex items-center justify-center bg-gray-100 text-gray-700 border-r border-gray-200">$</div>
                        <input
                          value={tradeForm.actualCashValue}
                          onChange={(e) => setTradeForm((p) => ({ ...p, actualCashValue: e.target.value }))}
                          onFocus={() => handleMoneyFocus('actualCashValue')}
                          onBlur={() => handleMoneyBlur('actualCashValue')}
                          className="flex-1 h-10 px-3 text-sm outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <div className="text-xs text-gray-700 mb-1 flex items-center gap-1">
                        <span>Lien Amount</span>
                      </div>
                      <div className="flex items-stretch border border-gray-200 rounded overflow-hidden bg-white">
                        <div className="w-10 flex items-center justify-center bg-gray-100 text-gray-700 border-r border-gray-200">$</div>
                        <input
                          value={tradeForm.lienAmount}
                          onChange={(e) => setTradeForm((p) => ({ ...p, lienAmount: e.target.value }))}
                          onFocus={() => handleMoneyFocus('lienAmount')}
                          onBlur={() => handleMoneyBlur('lienAmount')}
                          className="flex-1 h-10 px-3 text-sm outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <div className="text-xs text-gray-700 mb-1 flex items-center gap-1">
                        <span>Trade Equity</span>
                        <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 2a10 10 0 100 20 10 10 0 000-20z" />
                        </svg>
                      </div>
                      <div className="flex items-stretch border border-gray-200 rounded overflow-hidden bg-white">
                        <div className="w-10 flex items-center justify-center bg-gray-100 text-gray-700 border-r border-gray-200">$</div>
                        <input
                          value={tradeForm.tradeEquity}
                          readOnly
                          className="flex-1 h-10 px-3 text-sm outline-none bg-gray-50"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="mt-6 border-t border-gray-200" />
                </>
              ) : null}
            </div>

            <div className="px-8 pb-6 flex justify-end">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setTradeOpen(false)}
                  className="h-9 px-4 rounded bg-[#3b3b3b] text-white text-sm font-semibold hover:bg-black"
                >
                  Back
                </button>
                {tradeStep === 4 ? (
                  <button
                    type="button"
                    onClick={handleTradeSubmit}
                    disabled={tradeSubmitting}
                    className="h-9 px-4 rounded bg-green-600 text-white text-sm font-semibold hover:bg-green-700 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {tradeSubmitting ? 'Submitting...' : 'Finish'}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={nextTradeStep}
                    className="h-9 px-4 rounded bg-[#118df0] text-white text-sm font-semibold hover:bg-[#0d6ebd]"
                  >
                    Next
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
