'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import CostsWorkspace from '../../components/CostsWorkspace'

// Supported tax rates
const TAX_RATES: Record<string, number> = {
  HST: 0.13,
  RST: 0.08,
  GST: 0.05,
  PST: 0.06,
  QST: 0.09975,
  Exempt: 0,
}

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
  vehiclePrice: number
  stockNumber?: string
  readOnly?: boolean
}

export default function CostsTab({ vehicleId, vehiclePrice, stockNumber, readOnly = false }: CostsTabProps) {
  const [costsData, setCostsData] = useState<CostsData>({
    listPrice: vehiclePrice || 0,
    salePrice: 0,
    msrp: 0,
    purchasePrice: 0,
    actualCashValue: 0,
    additionalExpenses: [],
  })
  const [userId, setUserId] = useState<string | null>(null)
  const [taxPresets, setTaxPresets] = useState<TaxPresetRow[]>([])
  const [loadingTaxPresets, setLoadingTaxPresets] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const resolve = async () => {
      try {
        if (typeof window === 'undefined') return
        const raw = window.localStorage.getItem('edc_admin_session')
        if (!raw) return
        const parsed = JSON.parse(raw) as { email?: string; user_id?: string }
        const uid = String(parsed?.user_id ?? '').trim()
        if (uid) { setUserId(uid); return }
        const email = String(parsed?.email ?? '').trim().toLowerCase()
        if (!email) return
        const { data } = await supabase
          .from('edc_account_verifications')
          .select('id')
          .eq('email', email)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        if ((data as any)?.id) setUserId(String((data as any).id))
      } catch {}
    }
    void resolve()
  }, [])

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
      } catch {
        setTaxPresets([])
      } finally {
        setLoadingTaxPresets(false)
      }
    }

    void load()
  }, [userId])

  useEffect(() => {
    if (!taxPresets.length) {
      setModalForm((prev) => ({ ...prev, taxType: 'Exempt' }))
      return
    }

    setModalForm((prev) => {
      const current = String(prev.taxType || '').trim()
      const hasCurrent = current && taxPresets.some((t) => String(t.name || '').trim() === current)
      if (hasCurrent) return prev
      const defaultRow = taxPresets.find((t) => Boolean(t.default_tax_rate) && String(t.name || '').trim())
      const firstRow = taxPresets.find((t) => String(t.name || '').trim())
      const nextName = String((defaultRow || firstRow)?.name || 'Exempt').trim()
      return { ...prev, taxType: nextName || 'Exempt' }
    })
  }, [taxPresets])

  const [showModal, setShowModal] = useState(false)
  const [showSearchTip, setShowSearchTip] = useState(true)
  const [showPresetTip, setShowPresetTip] = useState(true)
  const [editingCost, setEditingCost] = useState<CostItem | null>(null)
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
    taxType: 'Exempt',
  })

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

    return TAX_RATES[key] ?? 0
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (readOnly) return
    const { name, value } = e.target
    setCostsData((prev) => ({
      ...prev,
      [name]: parseFloat(value) || 0,
    }))
  }

  const fetchCostsAny = async () => {
    try {
      let rows: any[] | null = null

      try {
        const { data, error } = await supabase
          .from('edc_costs')
          .select('*')
          .eq('vehicleId', vehicleId)
          .order('created_at', { ascending: true })
        if (!error && Array.isArray(data) && data.length) rows = data as any[]
      } catch {}

      if (!rows) {
        try {
          const { data, error } = await supabase
            .from('edc_costs')
            .select('*')
            .eq('id', vehicleId)
            .order('created_at', { ascending: true })
          if (!error && Array.isArray(data) && data.length) rows = data as any[]
        } catch {}
      }

      if (!rows && stockNumber) {
        try {
          const { data, error } = await supabase
            .from('edc_costs')
            .select('*')
            .eq('stock_number', stockNumber)
            .order('created_at', { ascending: true })
          if (!error && Array.isArray(data)) rows = data as any[]
        } catch {}
      }

      if (!rows) return

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
          taxType: r.tax_type || 'Exempt',
          total,
        }
      })

      setCostsData((prev) => ({ ...prev, additionalExpenses: mapped }))
    } catch (err) {
      console.error('Error fetching edc_costs:', err)
    }
  }

  const fetchPurchaseSummary = async () => {
    try {
      let row: any = null

      try {
        const { data, error } = await supabase
          .from('edc_purchase')
          .select('purchase_price, actual_cash_value')
          .eq('vehicle_id', vehicleId)
          .order('updated_at', { ascending: false })
          .limit(1)
        if (!error && Array.isArray(data) && data.length) row = data[0]
      } catch {}

      if (!row && stockNumber) {
        try {
          const { data, error } = await supabase
            .from('edc_purchase')
            .select('purchase_price, actual_cash_value')
            .eq('stock_number', stockNumber)
            .order('updated_at', { ascending: false })
            .limit(1)
          if (!error && Array.isArray(data) && data.length) row = data[0]
        } catch {}
      }

      if (!row) return

      const purchasePrice = Number(row.purchase_price || 0)
      const actualCashValue = Number(row.actual_cash_value || 0)

      setCostsData((prev) => ({
        ...prev,
        purchasePrice: Number.isFinite(purchasePrice) ? purchasePrice : 0,
        actualCashValue: Number.isFinite(actualCashValue) ? actualCashValue : 0,
      }))
    } catch (err) {
      console.error('Error fetching purchase summary:', err)
    }
  }

  useEffect(() => {
    if (!vehicleId) return
    void fetchCostsAny()
    void fetchPurchaseSummary()
  }, [vehicleId, stockNumber])

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
      taxType: 'Exempt',
    })
    setShowModal(true)
  }

  const openEditModal = (item: CostItem) => {
    if (readOnly) return
    setEditingCost(item)
    setModalForm({
      ...item,
      taxType: item.taxType || 'Exempt',
      tax: item.tax ?? 0,
    })
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
      const rate = resolveTaxRate(next.taxType || 'Exempt')
      next.tax = subtotal * rate
      return next
    })
  }

  const handleModalSave = async () => {
    if (readOnly) return
    const price = modalForm.price || 0
    const qty = modalForm.qty || 1
    const discount = modalForm.discount || 0
    const rate = resolveTaxRate(modalForm.taxType || 'Exempt')
    const taxable = Math.max(0, price * qty - discount)
    const tax = modalForm.taxType && modalForm.taxType !== 'Exempt' ? taxable * rate : 0
    const subtotal = Math.max(0, (price * qty) - discount)
    const total = subtotal + tax

    if (editingCost) {
      setCostsData(prev => ({
        ...prev,
        additionalExpenses: prev.additionalExpenses.map(item =>
          item.id === editingCost.id
            ? { ...modalForm, id: item.id, price, qty, discount, tax, taxType: modalForm.taxType || 'Exempt', total } as CostItem
            : item
        )
      }))

      // Persist edit to Supabase (when possible), then refresh from Supabase
      try {
        const dbId = (editingCost as any).dbId ?? editingCost.id
        if (dbId) {
          const { error: updateError } = await supabase
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
              tax_type: modalForm.taxType || 'Exempt',
              total: total,
              stock_number: stockNumber || null,
              vehicleId: vehicleId,
            })
            .eq('id', dbId as any)
          
          if (updateError) {
            console.error('Error updating cost:', updateError)
            alert('Error updating cost: ' + updateError.message)
          } else {
            alert('Cost updated successfully!')
          }
        }
      } catch (err) {
        console.error('Error updating cost:', err)
        alert('Error updating cost: ' + (err instanceof Error ? err.message : String(err)))
      } finally {
        await fetchCostsAny()
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
        taxType: modalForm.taxType || 'Exempt',
        total,
      }
      setCostsData(prev => ({
        ...prev,
        additionalExpenses: [...prev.additionalExpenses, newItem]
      }))

      // Insert directly to edc_costs table
      try {
        const { error } = await supabase
          .from('edc_costs')
          .insert({
            created_at: modalForm.date || new Date().toISOString(),
            stock_number: stockNumber || null,
            name: modalForm.name || '',
            group_name: modalForm.groupName || '',
            description: modalForm.description || '',
            vendor: modalForm.vendor || '',
            invoice_reference: modalForm.invoiceRef || '',
            amount: price.toString(),
            quantity: qty.toString(),
            discount: discount.toString(),
            tax: tax.toString(),
            total: total.toString(),
            tax_type: modalForm.taxType || 'Exempt',
            user_id: userId || null,
            vehicleId: vehicleId,
          })
        
        if (error) {
          console.error('Error inserting cost to database:', error)
        } else {
          await fetchCostsAny()
        }
      } catch (err) {
        console.error('Failed to insert cost to database:', err)
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
        const { error } = await q
        if (error) {
          console.error('Failed to delete cost from Supabase:', error)
        }
      }
    } catch (err) {
      console.error('Error deleting cost:', err)
    } finally {
      await fetchCostsAny()
    }
  }

  const handleSave = async () => {
    if (readOnly) return
    setSaving(true)
    try {
      console.log('Updating price for vehicle:', vehicleId, 'to:', costsData.listPrice)
      
      const payload = {
        vehicleId,
        stockNumber: stockNumber || null,
        listPrice: costsData.listPrice || 0,
        salePrice: costsData.salePrice || 0,
        msrp: costsData.msrp || 0,
        purchasePrice: costsData.purchasePrice || 0,
        actualCashValue: costsData.actualCashValue || 0,
        additionalExpenses: Array.isArray(costsData.additionalExpenses) ? costsData.additionalExpenses : [],
      }

      const res = await fetch('/api/costs-save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const text = await res.text().catch(() => '')
      if (!res.ok) {
        console.error('Costs save webhook error:', res.status, text)
        return
      }
    } catch (error) {
      console.error('Error saving:', error)
    } finally {
      setSaving(false)
    }
  }

  // Calculate totals
  const totalTax = costsData.additionalExpenses.reduce((sum, item) => sum + Number(item.tax || 0), 0)
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
      saving={saving}
      onSave={handleSave}
      showModal={showModal}
      editingCost={editingCost}
      modalForm={modalForm}
      onModalChange={handleModalChange}
      onModalSave={handleModalSave}
      onCloseModal={() => setShowModal(false)}
      taxPresets={taxPresets}
      loadingTaxPresets={loadingTaxPresets}
      emptyTaxOption={{ value: 'Exempt', label: 'Exempt 0%' }}
      readOnly={readOnly}
    />
  )
}
