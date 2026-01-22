'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'

// Supported tax rates
const TAX_RATES: Record<string, number> = {
  HST: 0.13,
  RST: 0.08,
  GST: 0.05,
  PST: 0.06,
  QST: 0.09975,
  Exempt: 0,
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
}

export default function CostsTab({ vehicleId, vehiclePrice, stockNumber }: CostsTabProps) {
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
    taxType: 'HST',
  })

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
  }, [vehicleId, stockNumber])

  // Realtime: refresh costs when edc_costs changes for this stock number
  useEffect(() => {
    if (!stockNumber) return
    const channel = supabase
      .channel(`realtime-costs-${stockNumber}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'edc_costs', filter: `stock_number=eq.${stockNumber}` }, () => {
        fetchCostsByStock()
      })
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [stockNumber])

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
      fetchCostsByStock()
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
        .select('costs_data, price')
        .eq('id', vehicleId)
        .maybeSingle()

      if (data) {
        if (data.costs_data) {
          setCostsData(prev => ({ ...prev, ...data.costs_data }))
        }
        if (data.price) {
          setCostsData(prev => ({ ...prev, listPrice: data.price }))
        }
      }
    } catch (error) {
      console.error('Error fetching costs data:', error)
    }
  }

  const fetchCostsByStock = async () => {
    if (!stockNumber) return
    try {
      const { data, error } = await supabase
        .from('edc_costs')
        .select('*')
        .eq('stock_number', stockNumber)
        .order('created_at', { ascending: true })

      if (!error && Array.isArray(data)) {
        const mapped = data.map((r: any): CostItem => {
          const price = parseFloat(r.amount ?? '0') || 0
          const qty = parseFloat(r.quantity ?? '1') || 1
          const discount = parseFloat(r.discount ?? '0') || 0
          const tax = parseFloat(r.tax ?? '0') || 0
          const total = parseFloat(r.total ?? String(Math.max(0, price * qty - discount + tax))) || (price * qty - discount + tax)
          return {
            id: String(r.id ?? Date.now()),
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
            taxType: r.tax_type || 'HST',
            total,
          }
        })
        setCostsData(prev => ({ ...prev, additionalExpenses: mapped }))
      }
    } catch (err) {
      console.error('Error fetching edc_costs by stock number:', err)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setCostsData(prev => ({
      ...prev,
      [name]: parseFloat(value) || 0
    }))
  }

  const openAddModal = () => {
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
      taxType: 'HST',
    })
    setShowModal(true)
  }

  const openEditModal = (item: CostItem) => {
    setEditingCost(item)
    setModalForm(item)
    setShowModal(true)
  }

  const handleModalChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
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
      const rate = TAX_RATES[next.taxType || 'Exempt'] ?? 0
      next.tax = subtotal * rate
      return next
    })
  }

  const handleModalSave = async () => {
    const price = modalForm.price || 0
    const qty = modalForm.qty || 1
    const discount = modalForm.discount || 0
    const rate = TAX_RATES[modalForm.taxType || 'Exempt'] ?? 0
    const tax = Math.max(0, (price * qty) - discount) * rate
    const total = (price * qty) - discount + tax

    if (editingCost) {
      setCostsData(prev => ({
        ...prev,
        additionalExpenses: prev.additionalExpenses.map(item =>
          item.id === editingCost.id
            ? { ...modalForm, id: item.id, price, qty, discount, tax, taxType: modalForm.taxType || 'HST', total } as CostItem
            : item
        )
      }))

      // Persist edit to Supabase (when possible), then refresh from Supabase
      try {
        if (stockNumber && editingCost.id) {
          const numericId = Number(editingCost.id)
          if (!Number.isNaN(numericId)) {
            const { error } = await supabase
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
                tax_type: modalForm.taxType || 'HST',
                total: total,
              })
              .eq('id', numericId)
              .eq('stock_number', stockNumber)
            if (error) {
              console.error('Failed to update cost in Supabase:', error)
            }
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
        taxType: modalForm.taxType || 'HST',
        total,
      }
      setCostsData(prev => ({
        ...prev,
        additionalExpenses: [...prev.additionalExpenses, newItem]
      }))

      // Post to external webhook and wait for response, then refresh from Supabase if successful
      try {
        const res = await fetch('https://primary-production-6722.up.railway.app/webhook/Cost', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            stockNumber: stockNumber || null,
            vehicleId,
            cost: newItem,
          }),
        })
        if (res.ok) {
          // Optionally inspect response body if needed
          await fetchCostsByStock()
        } else {
          console.error('Webhook responded with non-OK status:', res.status)
        }
      } catch (err) {
        console.error('Failed to send cost to webhook:', err)
      }
    }
    setShowModal(false)
  }

  const updateCostItem = (id: string, field: keyof CostItem, value: string | number) => {
    setCostsData(prev => ({
      ...prev,
      additionalExpenses: prev.additionalExpenses.map(item => {
        if (item.id === id) {
          const updated = { ...item, [field]: value }
          const price = Number(updated.price || 0)
          const qty = Number(updated.qty || 1)
          const discount = Number(updated.discount || 0)
          const rate = TAX_RATES[updated.taxType || 'Exempt'] ?? 0
          const tax = Math.max(0, (price * qty) - discount) * rate
          updated.tax = tax
          updated.total = (price * qty) - discount + tax
          return updated
        }
        return item
      })
    }))
  }

  const removeCostItem = async (item: CostItem) => {
    // Optimistic UI update
    setCostsData(prev => ({
      ...prev,
      additionalExpenses: prev.additionalExpenses.filter(x => x.id !== item.id)
    }))

    // Attempt delete from Supabase when we have a real DB id and stock number
    try {
      if (stockNumber && item.id) {
        const numericId = Number(item.id)
        if (!Number.isNaN(numericId)) {
          const { error } = await supabase
            .from('edc_costs')
            .delete()
            .eq('id', numericId)
            .eq('stock_number', stockNumber)
          if (error) {
            console.error('Failed to delete cost from Supabase:', error)
          }
        }
      }
    } catch (err) {
      console.error('Error deleting cost:', err)
    } finally {
      await fetchCostsByStock()
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const { error } = await supabase
        .from('edc_vehicles')
        .update({ costs_data: costsData })
        .eq('id', vehicleId)

      if (error) throw error
      alert('Costs saved successfully!')
    } catch (error) {
      console.error('Error saving costs:', error)
      alert('Error saving costs')
    } finally {
      setSaving(false)
    }
  }

  // Calculate totals
  const additionalExpensesTotal = costsData.additionalExpenses.reduce((sum, item) => sum + item.total, 0)
  const totalInvested = costsData.purchasePrice + additionalExpensesTotal
  const totalTax = costsData.additionalExpenses.reduce((sum, item) => sum + item.tax, 0)
  const grandTotal = totalInvested + totalTax
  const potentialProfit = costsData.listPrice - grandTotal

  return (
    <div className="bg-white rounded-xl shadow p-6">
      {/* Search Tip */}
      {showSearchTip && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 flex items-center justify-between">
          <p className="text-sm text-blue-800">
            💡 TIP: Use the search box below to search for cost presets. Search by a group name to pull in all costs associated with that group.
          </p>
          <button onClick={() => setShowSearchTip(false)} className="text-blue-600 hover:text-blue-800">×</button>
        </div>
      )}

      {/* Search */}
      <div className="mb-6">
        <input
          type="text"
          placeholder="🔍 search costs"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent"
        />
      </div>

      {/* Cost Preset Tip */}
      {showPresetTip && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-6 flex items-center justify-between">
          <p className="text-sm text-blue-800">
            💡 TIP: If you see a cost in red below, it means it was not found as a cost preset. You can upload the cost as a preset by clicking the ⬆️ icon.
          </p>
          <button onClick={() => setShowPresetTip(false)} className="text-blue-600 hover:text-blue-800">×</button>
        </div>
      )}

      {/* Costs Table */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-4">
          <input type="checkbox" className="w-4 h-4 rounded border-gray-300" />
          <span className="text-sm text-gray-500">Select all</span>
        </div>

        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-2 text-sm font-medium text-gray-500">NAME</th>
              <th className="text-left py-2 text-sm font-medium text-gray-500">PRICE</th>
              <th className="text-left py-2 text-sm font-medium text-gray-500">QTY</th>
              <th className="text-left py-2 text-sm font-medium text-gray-500">DISCOUNT</th>
              <th className="text-left py-2 text-sm font-medium text-gray-500">TAX</th>
              <th className="text-left py-2 text-sm font-medium text-gray-500">TOTAL</th>
              <th className="py-2"></th>
            </tr>
          </thead>
          <tbody>
            {costsData.additionalExpenses.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-gray-500">
                  No Costs
                </td>
              </tr>
            ) : (
              costsData.additionalExpenses.map((item) => (
                <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-2 px-2">
                    <div className="text-sm font-medium text-gray-900">{item.name || '—'}</div>
                    {item.description && (
                      <div className="text-xs text-gray-500 truncate max-w-[200px]">{item.description}</div>
                    )}
                  </td>
                  <td className="py-2 px-2 text-sm">${item.price.toFixed(2)}</td>
                  <td className="py-2 px-2 text-sm">{item.qty}</td>
                  <td className="py-2 px-2 text-sm">${item.discount.toFixed(2)}</td>
                  <td className="py-2 px-2 text-sm">${item.tax.toFixed(2)}</td>
                  <td className="py-2 px-2 text-sm font-medium">${item.total.toFixed(2)}</td>
                  <td className="py-2 px-2">
                    <div className="flex items-center gap-3">
                      <button
                        title="Edit"
                        onClick={(e) => { e.stopPropagation(); openEditModal(item); }}
                        className="text-gray-600 hover:text-gray-800"
                      >
                        ✎
                      </button>
                      <button
                        title="Delete"
                        onClick={(e) => { e.stopPropagation(); removeCostItem(item); }}
                        className="text-red-500 hover:text-red-700"
                      >
                        ×
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        <button
          onClick={openAddModal}
          className="mt-4 flex items-center gap-2 text-[#118df0] hover:text-[#0d6ebd] font-medium"
        >
          <span className="w-6 h-6 bg-[#118df0] text-white rounded flex items-center justify-center text-lg">+</span>
          Add Cost
        </button>
      </div>

      {/* Summary Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Donut Chart */}
        <div className="flex items-center justify-center">
          <div className="relative w-48 h-48">
            {(() => {
              const total = costsData.purchasePrice + additionalExpensesTotal + Math.max(0, potentialProfit)
              const purchasePercent = total > 0 ? (costsData.purchasePrice / total) * 100 : 33
              const expensesPercent = total > 0 ? (additionalExpensesTotal / total) * 100 : 33
              const profitPercent = total > 0 ? (Math.max(0, potentialProfit) / total) * 100 : 34
              const circumference = 2 * Math.PI * 35
              const purchaseDash = (purchasePercent / 100) * circumference
              const expensesDash = (expensesPercent / 100) * circumference
              const profitDash = (profitPercent / 100) * circumference
              
              return (
                <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
                  {/* Purchase (Blue) */}
                  <circle
                    cx="50"
                    cy="50"
                    r="35"
                    fill="transparent"
                    stroke="#3b82f6"
                    strokeWidth="20"
                    strokeDasharray={`${purchaseDash} ${circumference}`}
                    strokeDashoffset="0"
                  />
                  {/* Expenses (Red) */}
                  <circle
                    cx="50"
                    cy="50"
                    r="35"
                    fill="transparent"
                    stroke="#ef4444"
                    strokeWidth="20"
                    strokeDasharray={`${expensesDash} ${circumference}`}
                    strokeDashoffset={`${-purchaseDash}`}
                  />
                  {/* Profit (Green) */}
                  <circle
                    cx="50"
                    cy="50"
                    r="35"
                    fill="transparent"
                    stroke="#22c55e"
                    strokeWidth="20"
                    strokeDasharray={`${profitDash} ${circumference}`}
                    strokeDashoffset={`${-(purchaseDash + expensesDash)}`}
                  />
                </svg>
              )
            })()}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className="text-xs text-gray-500">Profit</div>
                <div className={`text-lg font-bold ${potentialProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  ${potentialProfit.toLocaleString()}
                </div>
              </div>
            </div>
          </div>
          <div className="ml-4 space-y-2">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 bg-red-500 rounded"></span>
              <span className="text-xs text-gray-600">Expenses</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 bg-blue-500 rounded"></span>
              <span className="text-xs text-gray-600">Purchase</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 bg-green-500 rounded"></span>
              <span className="text-xs text-gray-600">Profit</span>
            </div>
          </div>
        </div>

        {/* Summary Numbers */}
        <div className="space-y-3">
          <div className="flex justify-between items-center py-2 border-b border-gray-100">
            <span className="text-sm text-gray-600">💰 Vehicle Purchase Price:</span>
            <span className="font-semibold">${costsData.purchasePrice.toLocaleString()}</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-gray-100">
            <span className="text-sm text-gray-600">Actual Cash Value:</span>
            <span className="font-semibold">${costsData.actualCashValue.toLocaleString()}</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-gray-100">
            <span className="text-sm text-gray-600">Additional Expenses Total:</span>
            <span className="font-semibold">${additionalExpensesTotal.toLocaleString()}</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-gray-100 bg-blue-50 px-2 rounded">
            <span className="text-sm font-medium text-blue-800">💰 Total Invested:</span>
            <span className="font-bold text-blue-800">${totalInvested.toLocaleString()}</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-gray-100">
            <span className="text-sm text-gray-600">💰 Total Tax:</span>
            <span className="font-semibold">${totalTax.toLocaleString()}</span>
          </div>
          <div className="flex justify-between items-center py-2 bg-gray-100 px-2 rounded">
            <span className="text-sm font-medium text-gray-800">Grand Total:</span>
            <span className="font-bold text-gray-800">${grandTotal.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Price Inputs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6 pt-6 border-t border-gray-200">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">List Price</label>
          <div className="flex items-center">
            <span className="bg-gray-100 border border-r-0 border-gray-300 px-3 py-2 rounded-l-lg text-gray-500">$</span>
            <input
              type="number"
              name="listPrice"
              value={costsData.listPrice}
              onChange={handleChange}
              className="flex-1 border border-gray-300 rounded-r-lg px-3 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent"
            />
          </div>
          {costsData.listPrice > 0 && potentialProfit > 0 && (
            <p className="text-xs text-green-600 mt-1">Sweet bring on the money!</p>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Sale Price</label>
          <div className="flex items-center">
            <span className="bg-gray-100 border border-r-0 border-gray-300 px-3 py-2 rounded-l-lg text-gray-500">$</span>
            <input
              type="number"
              name="salePrice"
              value={costsData.salePrice}
              onChange={handleChange}
              className="flex-1 border border-gray-300 rounded-r-lg px-3 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">MSRP</label>
          <div className="flex items-center">
            <span className="bg-gray-100 border border-r-0 border-gray-300 px-3 py-2 rounded-l-lg text-gray-500">$</span>
            <input
              type="number"
              name="msrp"
              value={costsData.msrp}
              onChange={handleChange}
              className="flex-1 border border-gray-300 rounded-r-lg px-3 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="mt-6 flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-[#118df0] text-white px-8 py-3 rounded-lg font-semibold hover:bg-[#0d6ebd] transition-colors disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>

      {/* Add/Edit Cost Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div 
            className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
              <h2 className="text-xl font-semibold text-gray-900">
                {editingCost ? 'Edit Cost' : 'New Cost'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <div className="px-6 py-5 overflow-y-auto max-h-[calc(90vh-180px)]">
              <div className="space-y-5">
                {/* Date */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Date</label>
                  <input
                    type="date"
                    name="date"
                    value={modalForm.date || ''}
                    onChange={handleModalChange}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-gray-900 focus:bg-white focus:ring-2 focus:ring-[#118df0] focus:border-transparent transition-all"
                  />
                </div>

                {/* Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Name</label>
                  <div className="relative">
                    <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input
                      type="text"
                      name="name"
                      value={modalForm.name || ''}
                      onChange={handleModalChange}
                      placeholder="e.g. Gas, Repair, Transport"
                      className="w-full bg-gray-50 border border-gray-200 rounded-lg pl-10 pr-4 py-2.5 text-gray-900 placeholder-gray-400 focus:bg-white focus:ring-2 focus:ring-[#118df0] focus:border-transparent transition-all"
                    />
                  </div>
                </div>

                {/* Group Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Group Name</label>
                  <select
                    name="groupName"
                    value={modalForm.groupName || ''}
                    onChange={handleModalChange}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-gray-900 focus:bg-white focus:ring-2 focus:ring-[#118df0] focus:border-transparent transition-all appearance-none cursor-pointer"
                  >
                    <option value="">Select a group...</option>
                    <option value="transport">Transport Fee</option>
                    <option value="repair">Repair & Maintenance</option>
                    <option value="inspection">Inspection</option>
                    <option value="detailing">Detailing</option>
                    <option value="auction">Auction Fees</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
                  <textarea
                    name="description"
                    value={modalForm.description || ''}
                    onChange={handleModalChange}
                    placeholder="e.g. Transportation delivery fee from auction"
                    rows={3}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-gray-900 placeholder-gray-400 focus:bg-white focus:ring-2 focus:ring-[#118df0] focus:border-transparent transition-all resize-none"
                  />
                </div>

                {/* Vendor */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Vendor</label>
                  <div className="relative">
                    <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input
                      type="text"
                      name="vendor"
                      value={modalForm.vendor || ''}
                      onChange={handleModalChange}
                      placeholder="Search vendor..."
                      className="w-full bg-gray-50 border border-gray-200 rounded-lg pl-10 pr-4 py-2.5 text-gray-900 placeholder-gray-400 focus:bg-white focus:ring-2 focus:ring-[#118df0] focus:border-transparent transition-all"
                    />
                  </div>
                </div>

                {/* Invoice Ref */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Invoice Reference</label>
                  <input
                    type="text"
                    name="invoiceRef"
                    value={modalForm.invoiceRef || ''}
                    onChange={handleModalChange}
                    placeholder="e.g. INV-2026-001"
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-gray-900 placeholder-gray-400 focus:bg-white focus:ring-2 focus:ring-[#118df0] focus:border-transparent transition-all"
                  />
                </div>

                {/* Amount & Qty Row */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Amount ($)</label>
                    <input
                      type="number"
                      name="price"
                      value={modalForm.price || 0}
                      onChange={handleModalChange}
                      className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-gray-900 focus:bg-white focus:ring-2 focus:ring-[#118df0] focus:border-transparent transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Quantity</label>
                    <input
                      type="number"
                      name="qty"
                      value={modalForm.qty || 1}
                      onChange={handleModalChange}
                      min="1"
                      className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-gray-900 focus:bg-white focus:ring-2 focus:ring-[#118df0] focus:border-transparent transition-all"
                    />
                  </div>
                </div>

                {/* Discount */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Discount ($)</label>
                  <input
                    type="number"
                    name="discount"
                    value={modalForm.discount || 0}
                    onChange={handleModalChange}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-gray-900 focus:bg-white focus:ring-2 focus:ring-[#118df0] focus:border-transparent transition-all"
                  />
                </div>

                {/* Tax */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Tax</label>
                  <div className="flex gap-3">
                    <input
                      type="number"
                      name="tax"
                      value={modalForm.tax || 0}
                      readOnly
                      className="flex-1 bg-gray-100 border border-gray-200 rounded-lg px-4 py-2.5 text-gray-900 focus:bg-white focus:ring-2 focus:ring-[#118df0] focus:border-transparent transition-all"
                    />
                    <select
                      name="taxType"
                      value={modalForm.taxType || 'HST'}
                      onChange={handleModalChange}
                      className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-gray-900 focus:bg-white focus:ring-2 focus:ring-[#118df0] focus:border-transparent transition-all cursor-pointer"
                    >
                      <option value="HST">HST 13%</option>
                      <option value="RST">RST 8%</option>
                      <option value="GST">GST 5%</option>
                      <option value="PST">PST 6%</option>
                      <option value="QST">QST 9.975%</option>
                      <option value="Exempt">Exempt 0%</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-gray-100 bg-gray-50">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-medium text-gray-600">Total:</span>
                <span className="text-2xl font-bold text-gray-900">
                  ${(((modalForm.price || 0) * (modalForm.qty || 1)) - (modalForm.discount || 0) + (modalForm.tax || 0)).toFixed(2)}
                </span>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-5 py-2.5 bg-white border border-gray-200 rounded-lg font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleModalSave}
                  className="flex-1 px-5 py-2.5 bg-[#118df0] text-white rounded-lg font-medium hover:bg-[#0d6ebd] shadow-lg shadow-blue-500/25 transition-all"
                >
                  {editingCost ? 'Update Cost' : 'Add Cost'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
