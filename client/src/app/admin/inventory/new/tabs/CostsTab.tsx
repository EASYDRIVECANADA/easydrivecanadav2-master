'use client'

import { useState, useEffect, forwardRef, useImperativeHandle } from 'react'
import { supabase } from '@/lib/supabaseClient'
import CostsWorkspace from '../../components/CostsWorkspace'

type TaxPresetRow = {
  id: string
  name: string | null
  rate: number | string | null
  default_tax_rate: boolean | null
}

interface CostItem {
  id: string
  date: string
  name: string
  groupName: string
  description: string
  vendor: string
  invoiceRef: string
  price: number
  qty: number
  discount: number
  tax: number
  taxType: string
  total: number
  dbId?: string | number
}

interface CostsData {
  listPrice: number
  salePrice: number
  msrp: number
  purchasePrice: number
  actualCashValue: number
  additionalExpenses: CostItem[]
}

interface CostsTabProps {
  vehicleId: string
  userId?: string | null
  vehiclePrice: number
  stockNumber?: string
  onError?: (message: string) => void
  readOnly?: boolean
}

export interface CostsTabHandle {
  save: () => Promise<boolean>
}

const CostsTab = forwardRef<CostsTabHandle, CostsTabProps>(function CostsTab({ vehicleId, userId, vehiclePrice, stockNumber, onError, readOnly = false }, ref) {
  const [costsData, setCostsData] = useState<CostsData>({
    listPrice: vehiclePrice || 0,
    salePrice: 0,
    msrp: 0,
    purchasePrice: 0,
    actualCashValue: 0,
    additionalExpenses: [],
  })
  const [searchQuery, setSearchQuery] = useState('')
  const [saving, setSaving] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [showSearchTip, setShowSearchTip] = useState(true)
  const [showPresetTip, setShowPresetTip] = useState(true)
  const [editingCost, setEditingCost] = useState<CostItem | null>(null)
  const [taxPresets, setTaxPresets] = useState<TaxPresetRow[]>([])
  const [loadingTaxPresets, setLoadingTaxPresets] = useState(false)
  const [modalForm, setModalForm] = useState<Partial<CostItem>>({
    date: new Date().toISOString().split('T')[0],
    name: '',
    groupName: '',
    description: '',
    vendor: '',
    invoiceRef: '',
    price: 0,
    qty: 1,
    discount: 0,
    tax: 0,
    taxType: '',
  })

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!vehicleId) return
    try {
      const key = `edc_new_vehicle_costs_${String(vehicleId)}`
      const raw = window.localStorage.getItem(key)
      if (!raw) return
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed === 'object') {
        setCostsData((prev) => ({
          ...prev,
          ...parsed,
          additionalExpenses: Array.isArray((parsed as any).additionalExpenses)
            ? (parsed as any).additionalExpenses
            : prev.additionalExpenses,
        }))
      }
    } catch {
      // ignore
    }
  }, [vehicleId])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!vehicleId) return
    try {
      const key = `edc_new_vehicle_costs_${String(vehicleId)}`
      window.localStorage.setItem(key, JSON.stringify(costsData))
    } catch {
      // ignore
    }
  }, [costsData, vehicleId])

  useEffect(() => {
    const load = async () => {
      setLoadingTaxPresets(true)
      try {
        if (!userId) {
          setTaxPresets([])
          return
        }

        const { data, error } = await supabase
          .from('presets_tax')
          .select('id, name, rate, default_tax_rate')
          .eq('user_id', userId)
          .order('name', { ascending: true })

        if (error) throw error
        const rows = Array.isArray(data) ? (data as TaxPresetRow[]) : []
        setTaxPresets(rows)
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        onError?.(msg)
        setTaxPresets([])
      } finally {
        setLoadingTaxPresets(false)
      }
    }

    void load()
  }, [userId, onError])

  useEffect(() => {
    if (!taxPresets.length) {
      setModalForm((prev) => ({ ...prev, taxType: '' }))
      return
    }
    setModalForm((prev) => {
      const current = String(prev.taxType || '').trim()
      const hasCurrent = current && taxPresets.some((t) => String(t.name || '').trim() === current)
      if (hasCurrent) return prev

      const defaultRow = taxPresets.find((t) => Boolean(t.default_tax_rate) && String(t.name || '').trim())
      const firstRow = taxPresets.find((t) => String(t.name || '').trim())
      const nextName = String((defaultRow || firstRow)?.name || '').trim()
      if (!nextName) return prev
      return { ...prev, taxType: nextName }
    })
  }, [taxPresets])

  const resolveTaxRate = (taxType: string | undefined) => {
    const key = String(taxType || '').trim()
    if (!key) return 0

    const preset = taxPresets.find((t) => String(t.name || '').trim() === key)
    if (preset) {
      let n = typeof preset.rate === 'number' ? preset.rate : parseFloat(String(preset.rate || '0'))
      if (!Number.isFinite(n)) n = 0
      if (n > 1) n = n / 100
      return n
    }

    return 0
  }

  // Load purchase price from edc_purchase by stock_number
  const fetchPurchasePriceByStock = async () => {
    try {
      if (!stockNumber) return
      const { data, error } = await supabase
        .from('edc_purchase')
        .select('purchase_price')
        .eq('stock_number', stockNumber)
        .order('updated_at', { ascending: false })
        .limit(1)
        .single()
      if (error) {
        console.error('Failed to fetch purchase price:', error)
        return
      }
      const price = Number(data?.purchase_price || 0)
      setCostsData(prev => ({ ...prev, purchasePrice: isNaN(price) ? 0 : price }))
    } catch (err) {
      console.error('Error fetching purchase price:', err)
    }
  }

  useEffect(() => {
    fetchPurchasePriceByStock()
  }, [stockNumber])

  useEffect(() => {
    fetchCostsData()
    fetchCostsByStock()
  }, [vehicleId])

  // Realtime: refresh purchase price when edc_purchase changes for this stock number
  useEffect(() => {
    if (!stockNumber) return
    const channel = supabase
      .channel(`realtime-purchase-${stockNumber}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'edc_purchase', filter: `stock_number=eq.${stockNumber}` }, () => {
        fetchPurchasePriceByStock()
      })
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [stockNumber])

  /// Polling fallback: periodically refresh when realtime is not firing
  useEffect(() => {
    if (!stockNumber) return
    const id = setInterval(() => {
      fetchPurchasePriceByStock()
    }, 2000)
    return () => clearInterval(id)
  }, [stockNumber])

  // Realtime: watch edc_vehicles updates for this vehicle (costs_data or price changes)
  useEffect(() => {
    if (!vehicleId) return
    const channel = supabase
      .channel(`realtime-vehicle-${vehicleId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'edc_vehicles', filter: `id=eq.${vehicleId}` }, (payload) => {
        const row: any = payload?.new || {}
        try {
          const nextCosts = row.costs_data ? (typeof row.costs_data === 'string' ? JSON.parse(row.costs_data) : row.costs_data) : null
          setCostsData(prev => ({
            ...prev,
            ...(nextCosts || {}),
            listPrice: typeof row.price === 'number' ? row.price : prev.listPrice,
            salePrice: row.saleprice === null || row.saleprice === undefined ? prev.salePrice : (Number(row.saleprice) || 0),
          }))
        } catch {
          // ignore parse errors
        }
      })
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [vehicleId])

  const fetchCostsData = async () => {
    try {
      const { data, error } = await supabase
        .from('edc_vehicles')
        .select('costs_data, price, saleprice')
        .eq('id', vehicleId)
        .maybeSingle()

      if (data) {
        if (data.costs_data) {
          const incoming = typeof data.costs_data === 'string'
            ? JSON.parse(data.costs_data)
            : data.costs_data
          setCostsData(prev => ({
            ...prev,
            ...incoming,
            additionalExpenses: Array.isArray(incoming?.additionalExpenses) && incoming.additionalExpenses.length
              ? incoming.additionalExpenses
              : prev.additionalExpenses,
          }))
        }
        if (data.price) {
          setCostsData(prev => ({ ...prev, listPrice: data.price }))
        }
        if ((data as any).saleprice !== null && (data as any).saleprice !== undefined) {
          const sp = Number((data as any).saleprice || 0)
          setCostsData(prev => ({ ...prev, salePrice: Number.isFinite(sp) ? sp : 0 }))
        }
      }
    } catch (error) {
      console.error('Error fetching costs data:', error)
    }
  }

  const fetchCostsByStock = async () => {
    if (!vehicleId) return
    try {
      let rows: any[] = []

      // 1) Primary: vehicleId column
      const { data: byVehicleId, error: errVehicleId } = await supabase
        .from('edc_costs')
        .select('*')
        .eq('vehicleId', vehicleId)
        .order('created_at', { ascending: true })

      if (!errVehicleId && Array.isArray(byVehicleId) && byVehicleId.length) {
        rows = byVehicleId as any[]
      }

      // 2) Fallback: legacy id column match
      if (!rows.length) {
        const { data: byId, error: errId } = await supabase
          .from('edc_costs')
          .select('*')
          .eq('id', vehicleId)
          .order('created_at', { ascending: true })

        if (!errId && Array.isArray(byId) && byId.length) {
          rows = byId as any[]
        }
      }

      if (Array.isArray(rows)) {
        const mapped = rows.map((r: any): CostItem => {
          const price = parseFloat(r.amount ?? '0') || 0
          const qty = parseFloat(r.quantity ?? '1') || 1
          const discount = parseFloat(r.discount ?? '0') || 0
          const tax = parseFloat(r.tax ?? '0') || 0
          const total = Math.max(0, price * qty - discount) + tax
          return {
            id: String(r.id ?? Date.now()),
            dbId: r.id,
            date: (r.created_at ? String(r.created_at).split('T')[0] : new Date().toISOString().split('T')[0]),
            name: r.name || '',
            groupName: r.group_name || '',
            description: r.description || '',
            vendor: r.vendor || '',
            invoiceRef: r.invoice_reference || '',
            price,
            qty,
            discount,
            tax,
            taxType: r.tax_type || '',
            total,
          }
        })

        setCostsData((prev) => {
          if (mapped.length === 0 && prev.additionalExpenses.length > 0) return prev
          return { ...prev, additionalExpenses: mapped }
        })
      }
    } catch (err) {
      console.error('Error fetching edc_costs by stock number:', err)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (readOnly) return
    const { name, value } = e.target
    setCostsData(prev => ({
      ...prev,
      [name]: parseFloat(value) || 0
    }))
  }

  const getDefaultTaxType = () => {
    const defaultRow = taxPresets.find((t) => Boolean(t.default_tax_rate) && String(t.name || '').trim())
    const firstRow = taxPresets.find((t) => String(t.name || '').trim())
    return String((defaultRow || firstRow)?.name || '').trim()
  }

  const openAddModal = () => {
    if (readOnly) return
    setEditingCost(null)
    setModalForm({
      date: new Date().toISOString().split('T')[0],
      name: '',
      groupName: '',
      description: '',
      vendor: '',
      invoiceRef: '',
      price: 0,
      qty: 1,
      discount: 0,
      tax: 0,
      taxType: getDefaultTaxType(),
    })
    setShowModal(true)
  }

  const openEditModal = (item: CostItem) => {
    if (readOnly) return
    setEditingCost(item)
    setModalForm(item)
    setShowModal(true)
  }

  const handleModalChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    if (readOnly) return
    const { name, value } = e.target
    setModalForm(prev => {
      const next: Partial<CostItem> = { ...prev }
      if (name === 'price' || name === 'qty' || name === 'discount') {
        ;(next as any)[name] = parseFloat(value) || 0
      } else if (name === 'taxType') {
        next.taxType = value
      } else {
        ;(next as any)[name] = value
      }

      const price = Number(next.price || 0)
      const qty = Number(next.qty || 1)
      const discount = Number(next.discount || 0)
      const subtotal = Math.max(0, price * qty - discount)
      const rate = resolveTaxRate(next.taxType)
      next.tax = subtotal * rate
      next.total = subtotal + (next.tax || 0)
      return next
    })
  }

  const handleModalSave = async () => {
    if (readOnly) return
    const price = modalForm.price || 0
    const qty = modalForm.qty || 1
    const discount = modalForm.discount || 0
    const rate = resolveTaxRate(modalForm.taxType)
    const subtotal = Math.max(0, (price * qty) - discount)
    const tax = subtotal * rate
    const total = subtotal + tax

    if (editingCost) {
      setCostsData(prev => ({
        ...prev,
        additionalExpenses: prev.additionalExpenses.map(item =>
          item.id === editingCost.id
            ? { ...modalForm, id: item.id, price, qty, discount, tax, taxType: modalForm.taxType || '', total } as CostItem
            : item
        )
      }))

      // Persist edit to Supabase (when possible), then refresh from Supabase
      try {
        if (editingCost?.id) {
          const dbId = (editingCost as any).dbId ?? editingCost.id
          const q = supabase
            .from('edc_costs')
            .update({
              name: modalForm.name || '',
              group_name: modalForm.groupName || '',
              description: modalForm.description || '',
              vendor: modalForm.vendor || '',
              invoice_reference: modalForm.invoiceRef || '',
              amount: price,
              quantity: qty,
              discount: discount,
              tax: tax,
              tax_type: modalForm.taxType || '',
              total: total,
            })
            .eq('id', dbId as any)
          if (stockNumber) q.eq('stock_number', stockNumber)
          const { error } = await q
          if (error) {
            console.error('Failed to update cost in Supabase:', error)
          }
        }
      } catch (err) {
        console.error('Error updating cost:', err)
      } finally {
        await fetchCostsByStock()
      }
    } else {
      const newItem: CostItem = {
        id: Date.now().toString(),
        date: modalForm.date || new Date().toISOString().split('T')[0],
        name: modalForm.name || '',
        groupName: modalForm.groupName || '',
        description: modalForm.description || '',
        vendor: modalForm.vendor || '',
        invoiceRef: modalForm.invoiceRef || '',
        price,
        qty,
        discount,
        tax,
        taxType: modalForm.taxType || '',
        total,
      }

      const nextAdditionalExpenses = [...(costsData.additionalExpenses || []), newItem]
      setCostsData(prev => ({
        ...prev,
        additionalExpenses: nextAdditionalExpenses,
      }))

      // Insert cost directly to edc_costs table
      try {
        if (!vehicleId || !String(vehicleId).trim()) {
          const msg = 'Missing vehicle ID. Please save Vehicle Details first.'
          onError?.(msg)
        } else {
          const { error: insertError } = await supabase
            .from('edc_costs')
            .insert({
              vehicleId: String(vehicleId),
              stock_number: stockNumber || null,
              name: newItem.name,
              group_name: newItem.groupName,
              description: newItem.description,
              vendor: newItem.vendor,
              invoice_reference: newItem.invoiceRef,
              amount: newItem.price,
              quantity: newItem.qty,
              discount: newItem.discount,
              tax: newItem.tax,
              tax_type: newItem.taxType,
              total: newItem.total,
              user_id: userId || null,
              created_at: new Date().toISOString(),
            })

          if (insertError) {
            throw new Error(insertError.message || 'Failed to insert cost')
          }
          await fetchCostsByStock()
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        onError?.(msg)
      }
    }
    setShowModal(false)
  }

  const removeCostItem = async (item: CostItem) => {
    if (readOnly) return
    // Optimistic UI update
    setCostsData(prev => ({
      ...prev,
      additionalExpenses: prev.additionalExpenses.filter(x => x.id !== item.id)
    }))

    // Attempt delete from Supabase when we have a real DB id and stock number
    try {
      if (item?.id) {
        const dbId = (item as any).dbId ?? item.id
        const q = supabase
          .from('edc_costs')
          .delete()
          .eq('id', dbId as any)
        if (stockNumber) q.eq('stock_number', stockNumber)
        const { error } = await q
        if (error) {
          console.error('Failed to delete cost from Supabase:', error)
        }
      }
    } catch (err) {
      console.error('Error deleting cost:', err)
    } finally {
      await fetchCostsByStock()
    }
  }

  const handleSave = async (): Promise<boolean> => {
    if (readOnly) return true
    setSaving(true)
    try {
      if (!vehicleId) return false
      if (!stockNumber || !String(stockNumber).trim()) {
        const msg = 'Missing stock number. Please set Stock # in Vehicle Details first.'
        onError?.(msg)
        return false
      }

      const fullPayload: Record<string, any> = {
        user_id: userId ?? null,
        vehicleId: String(vehicleId),
        stockNumber: String(stockNumber).trim(),
        listPrice: costsData.listPrice,
        salePrice: costsData.salePrice,
        msrp: costsData.msrp,
        purchasePrice: costsData.purchasePrice,
        actualCashValue: costsData.actualCashValue,
        additionalExpenses: Array.isArray(costsData.additionalExpenses) ? costsData.additionalExpenses : [],
      }

      const payload = Object.fromEntries(
        Object.entries(fullPayload).map(([k, v]) => {
          if (v === undefined) return [k, null]
          if (typeof v === 'string') {
            const trimmed = v.trim()
            return [k, trimmed === '' ? null : trimmed]
          }
          return [k, v]
        })
      )

      const res = await fetch('/api/costs-save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const text = await res.text().catch(() => '')
      if (!res.ok) throw new Error(text || `Webhook responded with ${res.status}`)

      return true
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      onError?.(msg)
      return false
    } finally {
      setSaving(false)
    }
  }

  useImperativeHandle(ref, () => ({
    save: handleSave,
  }))

  // Calculate totals
  const totalTax = costsData.additionalExpenses.reduce((sum, item) => sum + item.tax, 0)
  const additionalExpensesSubtotal = costsData.additionalExpenses.reduce(
    (sum, item) => sum + Math.max(0, Number(item.price || 0) * Number(item.qty || 1) - Number(item.discount || 0)),
    0
  )
  const additionalExpensesTotal = additionalExpensesSubtotal + totalTax
  const totalInvested = costsData.purchasePrice + additionalExpensesTotal
  const grandTotal = totalInvested
  const potentialProfit = costsData.listPrice - grandTotal

  return (
    <CostsWorkspace
      costsData={costsData}
      totals={{
        additionalExpensesTotal,
        totalInvested,
        totalTax,
        grandTotal,
        potentialProfit,
        chartExpensesTotal: additionalExpensesTotal,
      }}
      searchQuery={searchQuery}
      onSearchChange={setSearchQuery}
      showTip={showSearchTip || showPresetTip}
      onDismissTip={() => {
        setShowSearchTip(false)
        setShowPresetTip(false)
      }}
      onAddCost={openAddModal}
      onEditCost={openEditModal}
      onRemoveCost={removeCostItem}
      onPriceChange={handleChange}
      showSaveButton={!readOnly}
      showModal={showModal}
      editingCost={editingCost}
      modalForm={modalForm}
      onModalChange={handleModalChange}
      onModalSave={handleModalSave}
      onCloseModal={() => setShowModal(false)}
      taxPresets={taxPresets}
      loadingTaxPresets={loadingTaxPresets}
      emptyTaxOption={{ value: '', label: 'No tax presets' }}
      readOnly={readOnly}
    />
  )
})

export default CostsTab
