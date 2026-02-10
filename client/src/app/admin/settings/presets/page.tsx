'use client'

import { useMemo, useState } from 'react'

type PresetCategory =
  | 'Fees'
  | 'Accessories'
  | 'Warranties'
  | 'Insurances'
  | 'Tax Rates'
  | 'Lead Properties'
  | 'Disclosures'
  | 'Inventory Costs'

type PresetRow = {
  id: string
  name: string
  description?: string
  amount?: string
}

const categories: PresetCategory[] = [
  'Fees',
  'Accessories',
  'Warranties',
  'Insurances',
  'Tax Rates',
  'Lead Properties',
  'Disclosures',
  'Inventory Costs',
]

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={
        checked
          ? 'h-4 w-9 rounded-full bg-[#118df0] relative border border-[#118df0]'
          : 'h-4 w-9 rounded-full bg-white relative border border-gray-300'
      }
      aria-pressed={checked}
    >
      <span
        className={
          checked
            ? 'absolute right-0.5 top-0.5 h-3 w-3 rounded-full bg-white'
            : 'absolute left-0.5 top-0.5 h-3 w-3 rounded-full bg-gray-400'
        }
      />
    </button>
  )
}

function MoneyField({
  value,
  onChange,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  placeholder: string
}) {
  return (
    <div className="relative">
      <div className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-600 text-xs">$</div>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-7 w-full border border-gray-300 pl-6 pr-2 text-xs"
      />
    </div>
  )
}

function PercentField({
  value,
  onChange,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  placeholder: string
}) {
  return (
    <div className="relative">
      <div className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-600 text-xs">%</div>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-7 w-full border border-gray-300 pl-6 pr-2 text-xs"
      />
    </div>
  )
}

function ModalShell({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: React.ReactNode
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-16"
      role="dialog"
      aria-modal="true"
      onMouseDown={onClose}
    >
      <div className="absolute inset-0 bg-black/50" />
      <div
        className="relative w-[460px] bg-white rounded shadow-lg"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="h-12 px-4 border-b border-gray-200 flex items-center justify-between">
          <div className="text-sm font-semibold text-gray-800">{title}</div>
          <button type="button" className="h-8 w-8 flex items-center justify-center" onClick={onClose}>
            <span className="text-xl leading-none text-gray-500">×</span>
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  )
}

export default function SettingsPresetsPage() {
  const [activeCategory, setActiveCategory] = useState<PresetCategory>('Fees')
  const [search, setSearch] = useState('')
  const [pageSize, setPageSize] = useState(5)
  const [isModalOpen, setIsModalOpen] = useState(false)

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [cost, setCost] = useState('')
  const [type, setType] = useState('Car')
  const [deductible, setDeductible] = useState('')
  const [duration, setDuration] = useState('')
  const [distance, setDistance] = useState('')
  const [price, setPrice] = useState('')
  const [rate, setRate] = useState('')
  const [isDefaultTaxRate, setIsDefaultTaxRate] = useState(false)
  const [fieldType, setFieldType] = useState('Single-line text')
  const [groupName, setGroupName] = useState('')
  const [vendor, setVendor] = useState('')
  const [discount, setDiscount] = useState('')
  const [defaultToNewDeals, setDefaultToNewDeals] = useState(false)
  const [lienFee, setLienFee] = useState(false)
  const [dealerWarranty, setDealerWarranty] = useState(false)
  const [disclosureBody, setDisclosureBody] = useState('')

  const openModal = () => {
    setName('')
    setDescription('')
    setAmount('')
    setCost('')
    setType(activeCategory === 'Insurances' ? 'Life' : 'Car')
    setDeductible('')
    setDuration('')
    setDistance('')
    setPrice('')
    setRate('')
    setIsDefaultTaxRate(false)
    setFieldType('Single-line text')
    setGroupName('')
    setVendor('')
    setDiscount('')
    setDefaultToNewDeals(false)
    setLienFee(false)
    setDealerWarranty(false)
    setDisclosureBody('')
    setIsModalOpen(true)
  }

  const closeModal = () => setIsModalOpen(false)

  const rows = useMemo<Record<PresetCategory, PresetRow[]>>(
    () => ({
      Fees: [{ id: 'omvic', name: 'OMVIC FEE', description: '', amount: '$22.00' }],
      Accessories: [],
      Warranties: [],
      Insurances: [],
      'Tax Rates': [],
      'Lead Properties': [],
      Disclosures: [],
      'Inventory Costs': [],
    }),
    []
  )

  const filtered = useMemo(() => {
    const list = rows[activeCategory] || []
    const q = search.trim().toLowerCase()
    if (!q) return list
    return list.filter((r) => {
      return (
        r.name.toLowerCase().includes(q) ||
        (r.description || '').toLowerCase().includes(q) ||
        (r.amount || '').toLowerCase().includes(q)
      )
    })
  }, [activeCategory, rows, search])

  const visible = useMemo(() => filtered.slice(0, pageSize), [filtered, pageSize])

  return (
    <div>
      <div className="grid grid-cols-[240px_1fr] gap-6">
        <div>
          <div className="text-[11px] text-gray-500 mb-1">{activeCategory}</div>
          <select
            className="h-7 w-full border border-gray-300 px-2 text-xs bg-white"
            value={activeCategory}
            onChange={(e) => setActiveCategory(e.target.value as PresetCategory)}
          >
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <div className="mt-3 border border-gray-200 bg-white">
            {categories.map((c) => {
              const isActive = c === activeCategory
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => setActiveCategory(c)}
                  className={
                    isActive
                      ? 'w-full h-8 px-3 flex items-center text-xs bg-[#118df0] text-white'
                      : 'w-full h-8 px-3 flex items-center text-xs text-[#118df0] hover:bg-gray-50'
                  }
                >
                  <span className="inline-flex items-center gap-2">
                    <span className="h-3.5 w-3.5 inline-flex items-center justify-center">
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M4 6h16" />
                        <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M4 12h16" />
                        <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M4 18h16" />
                      </svg>
                    </span>
                    {c}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between gap-4 py-2">
            <button
              type="button"
              className="h-7 w-7 flex items-center justify-center text-[#118df0]"
              title="Add"
              onClick={openModal}
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M12 5v14" />
                <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M5 12h14" />
              </svg>
            </button>

            <div className="flex-1 flex items-center gap-2">
              <div className="relative w-full max-w-[420px]">
                <div className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500">
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35" />
                    <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M11 19a8 8 0 110-16 8 8 0 010 16z" />
                  </svg>
                </div>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="search"
                  className="h-7 w-full border border-gray-300 pl-7 pr-2 text-xs"
                />
              </div>
            </div>

            <select
              className="h-7 border border-gray-300 px-2 text-xs bg-white"
              value={pageSize}
              onChange={(e) => setPageSize(parseInt(e.target.value, 10))}
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={20}>20</option>
            </select>
          </div>

          <div className="mt-2 border border-gray-200">
            <div className="grid grid-cols-[48px_1.3fr_2fr_140px] gap-0 border-b border-gray-200 bg-white">
              <div className="h-8" />
              <div className="h-8 flex items-center text-[11px] font-semibold text-gray-700">Name</div>
              <div className="h-8 flex items-center text-[11px] font-semibold text-gray-700">Description</div>
              <div className="h-8 flex items-center text-[11px] font-semibold text-gray-700">Amount</div>
            </div>

            {visible.length === 0 ? (
              <div className="p-6 text-xs text-gray-500">No presets found.</div>
            ) : (
              <div>
                {visible.map((r) => (
                  <div key={r.id} className="grid grid-cols-[48px_1.3fr_2fr_140px] border-b border-gray-100">
                    <div className="h-10 flex items-center gap-2 px-2">
                      <button
                        type="button"
                        className="h-6 w-6 flex items-center justify-center text-gray-500 hover:text-gray-800"
                        title="Edit"
                      >
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                          <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M12 20h9" />
                          <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4 12.5-12.5z" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        className="h-6 w-6 flex items-center justify-center text-red-600 hover:text-red-700"
                        title="Delete"
                      >
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                          <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M3 6h18" />
                          <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M8 6V4h8v2" />
                          <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M19 6l-1 14H6L5 6" />
                        </svg>
                      </button>
                    </div>
                    <div className="h-10 flex items-center text-xs text-gray-800">{r.name}</div>
                    <div className="h-10 flex items-center text-xs text-gray-800">{r.description || ''}</div>
                    <div className="h-10 flex items-center text-xs text-gray-800">{r.amount || ''}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between pt-8">
        <button type="button" className="h-8 px-3 bg-gray-600 text-white text-xs font-semibold">
          <span className="inline-flex items-center gap-2">
            <span className="text-sm leading-none">×</span>
            Cancel
          </span>
        </button>
        <button type="button" className="h-8 px-4 bg-[#118df0] text-white text-xs font-semibold">
          <span className="inline-flex items-center gap-2">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" />
              <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M17 21v-8H7v8" />
              <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M7 3v5h8" />
            </svg>
            Save
          </span>
        </button>
      </div>

      {isModalOpen ? (
        <ModalShell
          title={
            activeCategory === 'Fees'
              ? 'New Fee'
              : activeCategory === 'Accessories'
                ? 'New Accessory'
                : activeCategory === 'Warranties'
                  ? 'New Warranty'
                  : activeCategory === 'Insurances'
                    ? 'New Insurance'
                    : activeCategory === 'Tax Rates'
                      ? 'New Tax Rate'
                      : activeCategory === 'Lead Properties'
                        ? 'New Lead Property'
                        : activeCategory === 'Disclosures'
                          ? 'New Disclosure'
                          : 'New Inventory Cost Template'
          }
          onClose={closeModal}
        >
          <div className="space-y-3">
            <div>
              <div className="text-[11px] text-gray-700 mb-1">
                {activeCategory === 'Lead Properties' ? 'Label' : 'Name'}
              </div>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={activeCategory === 'Fees' ? 'fee name' : 'name'}
                className="h-7 w-full border border-gray-300 px-2 text-xs"
              />
            </div>

            {activeCategory !== 'Disclosures' ? (
              <div>
                <div className="text-[11px] text-gray-700 mb-1">Description</div>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="description"
                  className="w-full border border-gray-300 p-2 text-xs resize-none"
                  style={{ height: 80 }}
                />
              </div>
            ) : null}

            {activeCategory === 'Fees' ? (
              <>
                <div>
                  <div className="text-[11px] text-gray-700 mb-1">Fee Amount</div>
                  <MoneyField value={amount} onChange={setAmount} placeholder="0" />
                </div>
                <div>
                  <div className="text-[11px] text-gray-700 mb-1">Fee Cost</div>
                  <MoneyField value={cost} onChange={setCost} placeholder="0" />
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-[11px] text-gray-700">Default Tax Rates:</div>
                  <button type="button" className="text-[11px] text-[#118df0]">
                    Choose tax rate ▾
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-[11px] text-gray-700">Default to new deals?</div>
                  <Toggle checked={defaultToNewDeals} onChange={setDefaultToNewDeals} />
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-[11px] text-gray-700">Lien Fee?</div>
                  <Toggle checked={lienFee} onChange={setLienFee} />
                </div>
              </>
            ) : null}

            {activeCategory === 'Accessories' ? (
              <>
                <div>
                  <div className="text-[11px] text-gray-700 mb-1">Amount</div>
                  <MoneyField value={amount} onChange={setAmount} placeholder="amount" />
                </div>
                <div>
                  <div className="text-[11px] text-gray-700 mb-1">Cost</div>
                  <MoneyField value={cost} onChange={setCost} placeholder="cost" />
                </div>
                <div>
                  <div className="text-[11px] text-gray-700 mb-1">Type</div>
                  <select
                    className="h-7 w-full border border-gray-300 px-2 text-xs bg-white"
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                  >
                    <option>Car</option>
                    <option>Truck</option>
                    <option>Other</option>
                  </select>
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-[11px] text-gray-700">Default Tax Rates:</div>
                  <button type="button" className="text-[11px] text-[#118df0]">
                    Choose tax rate ▾
                  </button>
                </div>
              </>
            ) : null}

            {activeCategory === 'Warranties' ? (
              <>
                <div>
                  <div className="text-[11px] text-gray-700 mb-1">Deductible</div>
                  <MoneyField value={deductible} onChange={setDeductible} placeholder="0" />
                </div>
                <div>
                  <div className="text-[11px] text-gray-700 mb-1">Duration</div>
                  <div className="relative">
                    <div className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-600">
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M3 12h18" />
                        <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M12 3v18" />
                      </svg>
                    </div>
                    <input
                      value={duration}
                      onChange={(e) => setDuration(e.target.value)}
                      placeholder="duration"
                      className="h-7 w-full border border-gray-300 pl-7 pr-2 text-xs"
                    />
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-gray-700 mb-1">Distance</div>
                  <div className="relative">
                    <div className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-600">
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M4 20h16" />
                        <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M6 20V8" />
                        <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M18 20V4" />
                      </svg>
                    </div>
                    <input
                      value={distance}
                      onChange={(e) => setDistance(e.target.value)}
                      placeholder="distance"
                      className="h-7 w-full border border-gray-300 pl-7 pr-2 text-xs"
                    />
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-gray-700 mb-1">Price</div>
                  <MoneyField value={price} onChange={setPrice} placeholder="0" />
                </div>
                <div>
                  <div className="text-[11px] text-gray-700 mb-1">Cost</div>
                  <MoneyField value={cost} onChange={setCost} placeholder="0" />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    id="dealerWarranty"
                    type="checkbox"
                    className="h-3.5 w-3.5"
                    checked={dealerWarranty}
                    onChange={(e) => setDealerWarranty(e.target.checked)}
                  />
                  <label htmlFor="dealerWarranty" className="text-[11px] text-gray-700">
                    Dealer Warranty
                  </label>
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-[11px] text-gray-700">Default Tax Rates:</div>
                  <button type="button" className="text-[11px] text-[#118df0]">
                    Choose tax rate ▾
                  </button>
                </div>
              </>
            ) : null}

            {activeCategory === 'Insurances' ? (
              <>
                <div>
                  <div className="text-[11px] text-gray-700 mb-1">Deductible</div>
                  <MoneyField value={deductible} onChange={setDeductible} placeholder="deductible" />
                </div>
                <div>
                  <div className="text-[11px] text-gray-700 mb-1">Duration</div>
                  <input
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    placeholder="duration"
                    className="h-7 w-full border border-gray-300 px-2 text-xs"
                  />
                </div>
                <div>
                  <div className="text-[11px] text-gray-700 mb-1">Price</div>
                  <MoneyField value={price} onChange={setPrice} placeholder="price" />
                </div>
                <div>
                  <div className="text-[11px] text-gray-700 mb-1">Cost</div>
                  <MoneyField value={cost} onChange={setCost} placeholder="cost" />
                </div>
                <div>
                  <div className="text-[11px] text-gray-700 mb-1">Type</div>
                  <select
                    className="h-7 w-full border border-gray-300 px-2 text-xs bg-white"
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                  >
                    <option>Life</option>
                    <option>Accident</option>
                    <option>Other</option>
                  </select>
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-[11px] text-gray-700">Default Tax Rates:</div>
                  <button type="button" className="text-[11px] text-[#118df0]">
                    Choose tax rate ▾
                  </button>
                </div>
              </>
            ) : null}

            {activeCategory === 'Tax Rates' ? (
              <>
                <div>
                  <div className="text-[11px] text-gray-700 mb-1">Rate</div>
                  <PercentField value={rate} onChange={setRate} placeholder="0" />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    id="defaultTaxRate"
                    type="checkbox"
                    className="h-3.5 w-3.5"
                    checked={isDefaultTaxRate}
                    onChange={(e) => setIsDefaultTaxRate(e.target.checked)}
                  />
                  <label htmlFor="defaultTaxRate" className="text-[11px] text-gray-700">
                    Default Tax Rate?
                  </label>
                </div>
              </>
            ) : null}

            {activeCategory === 'Lead Properties' ? (
              <>
                <div>
                  <div className="text-[11px] text-gray-700 mb-1">Field Type</div>
                  <select
                    className="h-7 w-full border border-gray-300 px-2 text-xs bg-white"
                    value={fieldType}
                    onChange={(e) => setFieldType(e.target.value)}
                  >
                    <option>Single-line text</option>
                    <option>Multi-line text</option>
                    <option>Dropdown select</option>
                    <option>Checkbox</option>
                  </select>
                </div>
              </>
            ) : null}

            {activeCategory === 'Disclosures' ? (
              <>
                <div>
                  <div className="text-[11px] text-gray-700 mb-1">Disclosure</div>
                  <div className="border border-gray-300">
                    <div className="h-7 px-2 flex items-center gap-1 border-b border-gray-200 bg-gray-50">
                      {['B', 'I', 'U', 'S', '×', '✓', '16', 'A'].map((t) => (
                        <button
                          key={t}
                          type="button"
                          className="h-5 min-w-5 px-1 border border-gray-200 bg-white text-[10px] text-gray-700"
                          tabIndex={-1}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                    <textarea
                      value={disclosureBody}
                      onChange={(e) => setDisclosureBody(e.target.value)}
                      className="w-full p-3 text-xs text-gray-800 outline-none resize-none"
                      style={{ height: 120 }}
                    />
                  </div>
                </div>
              </>
            ) : null}

            {activeCategory === 'Inventory Costs' ? (
              <>
                <div>
                  <div className="text-[11px] text-gray-700 mb-1">Group Name</div>
                  <div className="relative">
                    <div className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500">
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35" />
                        <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M11 19a8 8 0 110-16 8 8 0 010 16z" />
                      </svg>
                    </div>
                    <input
                      value={groupName}
                      onChange={(e) => setGroupName(e.target.value)}
                      placeholder="ex.transport fee"
                      className="h-7 w-full border border-gray-300 pl-7 pr-2 text-xs"
                    />
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-gray-700 mb-1">Vendor</div>
                  <div className="relative">
                    <div className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500">
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35" />
                        <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M11 19a8 8 0 110-16 8 8 0 010 16z" />
                      </svg>
                    </div>
                    <input
                      value={vendor}
                      onChange={(e) => setVendor(e.target.value)}
                      placeholder="vendor search"
                      className="h-7 w-full border border-gray-300 pl-7 pr-2 text-xs"
                    />
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-gray-700 mb-1">Amount</div>
                  <input
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0"
                    className="h-7 w-full border border-gray-300 px-2 text-xs"
                  />
                </div>
                <div>
                  <div className="text-[11px] text-gray-700 mb-1">Discount</div>
                  <input
                    value={discount}
                    onChange={(e) => setDiscount(e.target.value)}
                    placeholder="0"
                    className="h-7 w-full border border-gray-300 px-2 text-xs"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-[11px] text-gray-700">Default Tax Rates:</div>
                  <button type="button" className="text-[11px] text-[#118df0]">
                    Choose tax rate ▾
                  </button>
                </div>
              </>
            ) : null}
          </div>

          <div className="mt-6 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={closeModal}
              className={
                activeCategory === 'Lead Properties' || activeCategory === 'Disclosures'
                  ? 'h-7 px-3 bg-red-600 text-white text-xs'
                  : activeCategory === 'Tax Rates'
                    ? 'h-7 px-3 bg-red-600 text-white text-xs'
                    : 'h-7 px-3 bg-red-600 text-white text-xs'
              }
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={closeModal}
              className={
                activeCategory === 'Tax Rates' || activeCategory === 'Lead Properties' || activeCategory === 'Disclosures'
                  ? 'h-7 px-3 bg-green-600 text-white text-xs'
                  : 'h-7 px-3 bg-[#118df0] text-white text-xs'
              }
            >
              Save
            </button>
          </div>
        </ModalShell>
      ) : null}
    </div>
  )
}
