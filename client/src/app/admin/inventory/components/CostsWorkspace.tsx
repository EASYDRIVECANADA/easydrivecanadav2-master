'use client'

import {
  Calculator,
  CircleDollarSign,
  DollarSign,
  Edit3,
  Info,
  PackagePlus,
  Plus,
  Receipt,
  Search,
  Trash2,
  X,
} from 'lucide-react'

export type CostItem = {
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

export type CostsData = {
  listPrice: number
  salePrice: number
  msrp: number
  purchasePrice: number
  actualCashValue: number
  additionalExpenses: CostItem[]
}

export type TaxPresetRow = {
  id: string
  name: string | null
  rate: number | string | null
  default_tax_rate: boolean | null
}

type Totals = {
  additionalExpensesTotal: number
  totalInvested: number
  totalTax: number
  grandTotal: number
  potentialProfit: number
  chartExpensesTotal?: number
}

type EmptyTaxOption = {
  value: string
  label: string
}

type CostsWorkspaceProps = {
  costsData: CostsData
  totals: Totals
  searchQuery: string
  onSearchChange: (value: string) => void
  showTip: boolean
  onDismissTip: () => void
  onAddCost: () => void
  onEditCost: (item: CostItem) => void
  onRemoveCost: (item: CostItem) => void
  onPriceChange: (event: React.ChangeEvent<HTMLInputElement>) => void
  showSaveButton?: boolean
  saving?: boolean
  onSave?: () => void
  showModal: boolean
  editingCost: CostItem | null
  modalForm: Partial<CostItem>
  onModalChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void
  onModalSave: () => void
  onCloseModal: () => void
  taxPresets: TaxPresetRow[]
  loadingTaxPresets: boolean
  emptyTaxOption: EmptyTaxOption
  readOnly?: boolean
}

const currency = new Intl.NumberFormat('en-CA', {
  style: 'currency',
  currency: 'CAD',
  maximumFractionDigits: 0,
})

const preciseCurrency = new Intl.NumberFormat('en-CA', {
  style: 'currency',
  currency: 'CAD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

function formatCurrency(value: number, precise = false) {
  const next = Number.isFinite(value) ? value : 0
  return precise ? preciseCurrency.format(next) : currency.format(next)
}

function formatTaxRate(rateValue: number | string | null) {
  let rate = typeof rateValue === 'number' ? rateValue : parseFloat(String(rateValue || '0'))
  if (!Number.isFinite(rate)) rate = 0
  const percent = rate > 1 ? rate : rate * 100
  return percent.toFixed(2).replace(/\.?0+$/, '')
}

function MetricCard({
  label,
  value,
  tone = 'neutral',
}: {
  label: string
  value: string
  tone?: 'neutral' | 'blue' | 'green' | 'red'
}) {
  const toneClass =
    tone === 'blue'
      ? 'border-blue-200 bg-blue-50/70 text-blue-800'
      : tone === 'green'
        ? 'border-emerald-200 bg-emerald-50/70 text-emerald-800'
        : tone === 'red'
          ? 'border-red-200 bg-red-50/70 text-red-800'
          : 'border-slate-200 bg-white text-slate-900'

  return (
    <div className={`rounded-lg border px-4 py-3 shadow-sm ${toneClass}`}>
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 truncate text-xl font-bold">{value}</div>
    </div>
  )
}

function DonutChart({ costsData, totals }: { costsData: CostsData; totals: Totals }) {
  const purchase = Math.max(0, Number(costsData.purchasePrice || 0))
  const expenses = Math.max(0, Number(totals.chartExpensesTotal ?? totals.additionalExpensesTotal ?? 0))
  const profit = Math.max(0, Number(totals.potentialProfit || 0))
  const total = purchase + expenses + profit
  const circumference = 2 * Math.PI * 35

  const purchaseDash = total > 0 ? (purchase / total) * circumference : circumference / 3
  const expensesDash = total > 0 ? (expenses / total) * circumference : circumference / 3
  const profitDash = total > 0 ? (profit / total) * circumference : circumference / 3

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
      <div className="relative h-44 w-44 shrink-0">
        <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
          <circle cx="50" cy="50" r="35" fill="transparent" stroke="#e2e8f0" strokeWidth="18" />
          <circle
            cx="50"
            cy="50"
            r="35"
            fill="transparent"
            stroke="#2563eb"
            strokeWidth="18"
            strokeDasharray={`${purchaseDash} ${circumference}`}
            strokeDashoffset="0"
            strokeLinecap="round"
          />
          <circle
            cx="50"
            cy="50"
            r="35"
            fill="transparent"
            stroke="#ef4444"
            strokeWidth="18"
            strokeDasharray={`${expensesDash} ${circumference}`}
            strokeDashoffset={`${-purchaseDash}`}
            strokeLinecap="round"
          />
          <circle
            cx="50"
            cy="50"
            r="35"
            fill="transparent"
            stroke="#22c55e"
            strokeWidth="18"
            strokeDasharray={`${profitDash} ${circumference}`}
            strokeDashoffset={`${-(purchaseDash + expensesDash)}`}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Profit</div>
            <div className={`text-lg font-bold ${totals.potentialProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {formatCurrency(totals.potentialProfit)}
            </div>
          </div>
        </div>
      </div>

      <div className="grid w-full max-w-xs grid-cols-3 gap-2 sm:block sm:w-auto sm:space-y-2">
        <div className="flex items-center gap-2 text-xs text-slate-600">
          <span className="h-2.5 w-2.5 rounded-full bg-blue-600" />
          Purchase
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-600">
          <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
          Expenses
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-600">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
          Profit
        </div>
      </div>
    </div>
  )
}

function MoneyInput({
  label,
  name,
  value,
  onChange,
  readOnly = false,
}: {
  label: string
  name: 'listPrice' | 'salePrice' | 'msrp'
  value: number
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void
  readOnly?: boolean
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</span>
      <div className="flex h-10 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm focus-within:border-cyan-500/50 focus-within:ring-2 focus-within:ring-cyan-500/20">
        <span className="flex w-10 items-center justify-center border-r border-slate-200 bg-slate-50 text-sm font-semibold text-slate-500">
          $
        </span>
        <input
          type="number"
          name={name}
          value={value || ''}
          onChange={onChange}
          disabled={readOnly}
          readOnly={readOnly}
          className="min-w-0 flex-1 px-3 text-sm font-medium text-slate-900 outline-none placeholder:text-slate-400 disabled:bg-slate-50 disabled:text-slate-500"
        />
      </div>
    </label>
  )
}

export default function CostsWorkspace({
  costsData,
  totals,
  searchQuery,
  onSearchChange,
  showTip,
  onDismissTip,
  onAddCost,
  onEditCost,
  onRemoveCost,
  onPriceChange,
  showSaveButton = false,
  saving = false,
  onSave,
  showModal,
  editingCost,
  modalForm,
  onModalChange,
  onModalSave,
  onCloseModal,
  taxPresets,
  loadingTaxPresets,
  emptyTaxOption,
  readOnly = false,
}: CostsWorkspaceProps) {
  const normalizedQuery = searchQuery.trim().toLowerCase()
  const filteredExpenses = normalizedQuery
    ? costsData.additionalExpenses.filter((item) => {
        const haystack = [item.name, item.groupName, item.description, item.vendor, item.invoiceRef]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        return haystack.includes(normalizedQuery)
      })
    : costsData.additionalExpenses

  const hasCosts = costsData.additionalExpenses.length > 0
  const hasSearchResults = filteredExpenses.length > 0
  const profitTone = totals.potentialProfit >= 0 ? 'green' : 'red'
  const modalSubtotal = Math.max(
    0,
    Number(modalForm.price || 0) * Number(modalForm.qty || 1) - Number(modalForm.discount || 0)
  )
  const modalTotal = modalSubtotal + Number(modalForm.tax || 0)

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Purchase Price" value={formatCurrency(costsData.purchasePrice)} />
        <MetricCard label="Expenses" value={formatCurrency(totals.additionalExpensesTotal)} />
        <MetricCard label="Tax" value={formatCurrency(totals.totalTax)} />
        <MetricCard label="Total Invested" value={formatCurrency(totals.totalInvested)} tone="blue" />
        <MetricCard label="Potential Profit" value={formatCurrency(totals.potentialProfit)} tone={profitTone} />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <section className="edc-card overflow-hidden">
          <div className="border-b border-slate-200/70 p-4">
            {showTip ? (
              <div className="mb-4 flex items-start justify-between gap-3 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2.5 text-sm text-blue-800">
                <div className="flex items-start gap-2">
                  <Info className="mt-0.5 h-4 w-4 shrink-0" />
                  <p>
                    Search cost presets by name or group. Matching groups can help pull related recon, transport, or fee costs together.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onDismissTip}
                  className="rounded p-1 text-blue-700 hover:bg-blue-100 hover:text-blue-900"
                  aria-label="Dismiss cost tip"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : null}

            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base font-semibold text-slate-900">Cost Items</h2>
                  {readOnly ? (
                    <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-700">
                      View only
                    </span>
                  ) : null}
                </div>
                <p className="text-sm text-slate-500">{hasCosts ? `${costsData.additionalExpenses.length} item(s)` : 'No costs added yet'}</p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="relative min-w-0 sm:w-72">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search costs"
                    value={searchQuery}
                    onChange={(event) => onSearchChange(event.target.value)}
                    className="edc-input h-10 pl-9"
                  />
                </div>
                {!readOnly ? (
                  <button type="button" onClick={onAddCost} className="edc-btn-primary h-10 px-4">
                    <Plus className="h-4 w-4" />
                    Add Cost
                  </button>
                ) : null}
              </div>
            </div>
          </div>

          {hasSearchResults ? (
            <div className="overflow-x-auto">
              <table className="edc-table min-w-[760px]">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th className="text-right">Price</th>
                    <th className="text-right">Qty</th>
                    <th className="text-right">Discount</th>
                    <th className="text-right">Tax</th>
                    <th className="text-right">Total</th>
                    {!readOnly ? <th className="w-24 text-right">Actions</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {filteredExpenses.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <div className="font-semibold text-slate-900">{item.name || 'Untitled cost'}</div>
                        <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
                          {item.groupName ? <span>{item.groupName}</span> : null}
                          {item.vendor ? <span>{item.vendor}</span> : null}
                          {item.invoiceRef ? <span>{item.invoiceRef}</span> : null}
                        </div>
                        {item.description ? <div className="mt-1 max-w-md truncate text-xs text-slate-500">{item.description}</div> : null}
                      </td>
                      <td className="text-right font-medium">{formatCurrency(Number(item.price || 0), true)}</td>
                      <td className="text-right">{item.qty || 0}</td>
                      <td className="text-right">{formatCurrency(Number(item.discount || 0), true)}</td>
                      <td className="text-right">{formatCurrency(Number(item.tax || 0), true)}</td>
                      <td className="text-right font-semibold text-slate-900">{formatCurrency(Number(item.total || 0), true)}</td>
                      {!readOnly ? (
                        <td>
                          <div className="flex justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => onEditCost(item)}
                              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                              aria-label={`Edit ${item.name || 'cost'}`}
                              title="Edit"
                            >
                              <Edit3 className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onRemoveCost(item)}
                              className="rounded-lg p-2 text-red-500 hover:bg-red-50 hover:text-red-700"
                              aria-label={`Delete ${item.name || 'cost'}`}
                              title="Delete"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex min-h-[280px] items-center justify-center p-8">
              <div className="max-w-sm text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                  <PackagePlus className="h-6 w-6" />
                </div>
                <h3 className="mt-4 text-base font-semibold text-slate-900">{hasCosts ? 'No matching costs' : 'No costs yet'}</h3>
                <p className="mt-2 text-sm text-slate-500">
                  {hasCosts
                    ? 'Try a different name, group, vendor, or invoice reference.'
                    : 'Add reconditioning, transport, auction, inspection, and other inventory costs here.'}
                </p>
                {!hasCosts && !readOnly ? (
                  <button type="button" onClick={onAddCost} className="edc-btn-primary mt-5 h-10 px-4">
                    <Plus className="h-4 w-4" />
                    Add Cost
                  </button>
                ) : null}
              </div>
            </div>
          )}
        </section>

        <aside className="space-y-5">
          <section className="edc-card p-5">
            <div className="mb-5 flex items-center gap-2">
              <Calculator className="h-5 w-5 text-blue-700" />
              <h2 className="text-base font-semibold text-slate-900">Investment Summary</h2>
            </div>

            <DonutChart costsData={costsData} totals={totals} />

            <div className="mt-5 space-y-2">
              {[
                ['Vehicle Purchase Price', costsData.purchasePrice],
                ['Actual Cash Value', costsData.actualCashValue],
                ['Additional Expenses Total', totals.additionalExpensesTotal],
                ['Total Tax', totals.totalTax],
                ['Grand Total', totals.grandTotal],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between gap-4 border-b border-slate-100 py-2 text-sm last:border-0">
                  <span className="text-slate-500">{label}</span>
                  <span className="font-semibold text-slate-900">{formatCurrency(Number(value || 0))}</span>
                </div>
              ))}
              <div className="flex items-center justify-between gap-4 rounded-lg bg-blue-50 px-3 py-2 text-sm">
                <span className="font-semibold text-blue-800">Total Invested</span>
                <span className="font-bold text-blue-800">{formatCurrency(totals.totalInvested)}</span>
              </div>
            </div>
          </section>

          <section className="edc-card p-5">
            <div className="mb-4 flex items-center gap-2">
              <CircleDollarSign className="h-5 w-5 text-blue-700" />
              <h2 className="text-base font-semibold text-slate-900">Pricing</h2>
            </div>
            <div className="space-y-4">
              <MoneyInput label="List Price" name="listPrice" value={costsData.listPrice} onChange={onPriceChange} readOnly={readOnly} />
              <MoneyInput label="Sale Price" name="salePrice" value={costsData.salePrice} onChange={onPriceChange} readOnly={readOnly} />
              <MoneyInput label="MSRP" name="msrp" value={costsData.msrp} onChange={onPriceChange} readOnly={readOnly} />
            </div>

            {showSaveButton && !readOnly ? (
              <div className="mt-5 flex justify-end border-t border-slate-100 pt-5">
                <button type="button" onClick={onSave} disabled={saving} className="edc-btn-primary h-10 px-6">
                  {saving ? 'Saving...' : 'Update'}
                </button>
              </div>
            ) : null}
          </section>
        </aside>
      </div>

      {showModal && !readOnly ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="edc-modal flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">{editingCost ? 'Edit Cost' : 'New Cost'}</h2>
                <p className="text-sm text-slate-500">Track expenses that affect investment and profit.</p>
              </div>
              <button
                type="button"
                onClick={onCloseModal}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                aria-label="Close cost modal"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-slate-700">Date</span>
                  <input type="date" name="date" value={modalForm.date || ''} onChange={onModalChange} className="edc-input" />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-slate-700">Name</span>
                  <input
                    type="text"
                    name="name"
                    value={modalForm.name || ''}
                    onChange={onModalChange}
                    placeholder="e.g. Repair, transport, detailing"
                    className="edc-input"
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-slate-700">Group Name</span>
                  <select name="groupName" value={modalForm.groupName || ''} onChange={onModalChange} className="edc-select">
                    <option value="">Select a group...</option>
                    <option value="transport">Transport Fee</option>
                    <option value="repair">Repair & Maintenance</option>
                    <option value="inspection">Inspection</option>
                    <option value="detailing">Detailing</option>
                    <option value="auction">Auction Fees</option>
                    <option value="other">Other</option>
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-slate-700">Vendor</span>
                  <input type="text" name="vendor" value={modalForm.vendor || ''} onChange={onModalChange} placeholder="Vendor name" className="edc-input" />
                </label>
                <label className="block sm:col-span-2">
                  <span className="mb-1.5 block text-sm font-medium text-slate-700">Description</span>
                  <textarea
                    name="description"
                    value={modalForm.description || ''}
                    onChange={onModalChange}
                    placeholder="Optional detail for this cost"
                    rows={3}
                    className="edc-input resize-none"
                  />
                </label>
                <label className="block sm:col-span-2">
                  <span className="mb-1.5 block text-sm font-medium text-slate-700">Invoice Reference</span>
                  <input
                    type="text"
                    name="invoiceRef"
                    value={modalForm.invoiceRef || ''}
                    onChange={onModalChange}
                    placeholder="e.g. INV-2026-001"
                    className="edc-input"
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-slate-700">Amount</span>
                  <div className="relative">
                    <DollarSign className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      type="number"
                      name="price"
                      value={modalForm.price || ''}
                      onChange={onModalChange}
                      className="edc-input pl-9"
                    />
                  </div>
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-slate-700">Quantity</span>
                  <input type="number" name="qty" min="1" value={modalForm.qty || ''} onChange={onModalChange} className="edc-input" />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-slate-700">Discount</span>
                  <div className="relative">
                    <DollarSign className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      type="number"
                      name="discount"
                      value={modalForm.discount || ''}
                      onChange={onModalChange}
                      className="edc-input pl-9"
                    />
                  </div>
                </label>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_180px]">
                  <label className="block">
                    <span className="mb-1.5 block text-sm font-medium text-slate-700">Tax</span>
                    <div className="relative">
                      <DollarSign className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input type="number" name="tax" value={modalForm.tax || ''} readOnly className="edc-input bg-slate-50 pl-9" />
                    </div>
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-sm font-medium text-slate-700">Tax Type</span>
                    <select name="taxType" value={modalForm.taxType || emptyTaxOption.value} onChange={onModalChange} className="edc-select">
                      {loadingTaxPresets ? (
                        <option value="">Loading...</option>
                      ) : taxPresets.length ? (
                        taxPresets
                          .filter((preset) => String(preset.name || '').trim())
                          .map((preset) => {
                            const name = String(preset.name || '').trim()
                            return (
                              <option key={preset.id} value={name}>
                                {name} {formatTaxRate(preset.rate)}%
                              </option>
                            )
                          })
                      ) : (
                        <option value={emptyTaxOption.value}>{emptyTaxOption.label}</option>
                      )}
                    </select>
                  </label>
                </div>
              </div>
            </div>

            <div className="border-t border-slate-100 bg-slate-50 px-6 py-4">
              <div className="mb-4 flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-600">Cost Total</span>
                <span className="text-2xl font-bold text-slate-900">{formatCurrency(modalTotal, true)}</span>
              </div>
              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button type="button" onClick={onCloseModal} className="edc-btn-ghost h-10 px-5">
                  Cancel
                </button>
                <button type="button" onClick={onModalSave} className="edc-btn-primary h-10 px-5">
                  {editingCost ? 'Update Cost' : 'Add Cost'}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
