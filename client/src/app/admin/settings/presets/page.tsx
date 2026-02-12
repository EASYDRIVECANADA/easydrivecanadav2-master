'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import Link from 'next/link'

const PRESETS_WEBHOOK_URL = 'https://primary-production-6722.up.railway.app/webhook/presets'

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
  fieldType?: string
  disclosure?: string
  favourite?: string
  groupName?: string
  duration?: string
  distance?: string
  deductible?: string
  price?: string
}

type FeeRow = {
  id: string
  name: string | null
  description: string | null
  fee_amount: number | null
  fee_cost: number | null
  default_to_new_deals: boolean | null
  lien_fee: boolean | null
  default_tax_rate: string | null
  created_at: string
}

type AccessoryRow = {
  id: string
  name: string | null
  description: string | null
  amount: number | null
  cost: number | null
  type: string | null
  default_tax_rate: string | null
}

type TaxRow = {
  id: string
  name: string | null
  description: string | null
  rate: number | null
  default_tax_rate: boolean | null
  default_to_sales: string | null
  default_to_purchases_or_costs: string | null
}

type WarrantyRow = {
  id: string
  name: string | null
  description: string | null
  deductible: string | null
  duration: string | null
  distance: string | null
  price: string | null
  cost: string | null
  dealer_warranty: boolean | null
  default_tax_rate: string | null
}

type InsuranceRow = {
  id: string
  user_id: string | null
  name: string | null
  description: string | null
  deductible: string | null
  duration: string | null
  price: string | null
  cost: string | null
  type: string | null
  default_tax_rate: string | null
}

type LeadPropertyRow = {
  id: string
  user_id: string | null
  name: string | null
  description: string | null
  field_type: string | null
}

type DisclosureRow = {
  id: string
  user_id: string | null
  name: string | null
  disclosure: string | null
}

type InventoryCostRow = {
  id: string
  user_id: string | null
  name: string | null
  group_name: string | null
  vendor: string | null
  amount: string | null
  discount: string | null
  default_tax_rate: string | null
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
  const [isVerified, setIsVerified] = useState(false)
  const [activeCategory, setActiveCategory] = useState<PresetCategory>('Fees')
  const [search, setSearch] = useState('')
  const [pageSize, setPageSize] = useState(100)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveSuccessOpen, setSaveSuccessOpen] = useState(false)
  const [saveSuccessMessage, setSaveSuccessMessage] = useState('Successful save')
  const [taxPickerOpen, setTaxPickerOpen] = useState(false)
  const [selectedTaxRates, setSelectedTaxRates] = useState<string[]>([])
  const [editingFeeId, setEditingFeeId] = useState<string | null>(null)
  const [feeRows, setFeeRows] = useState<FeeRow[]>([])
  const [loadingFees, setLoadingFees] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [feeToDelete, setFeeToDelete] = useState<FeeRow | null>(null)

  const [feeTaxOptions, setFeeTaxOptions] = useState<TaxRow[]>([])
  const [loadingFeeTaxOptions, setLoadingFeeTaxOptions] = useState(false)

  const [editingAccessoryId, setEditingAccessoryId] = useState<string | null>(null)
  const [accessoryRows, setAccessoryRows] = useState<AccessoryRow[]>([])
  const [loadingAccessories, setLoadingAccessories] = useState(false)
  const [deleteAccessoryConfirmOpen, setDeleteAccessoryConfirmOpen] = useState(false)
  const [accessoryToDelete, setAccessoryToDelete] = useState<AccessoryRow | null>(null)

  const [editingTaxId, setEditingTaxId] = useState<string | null>(null)
  const [taxRows, setTaxRows] = useState<TaxRow[]>([])
  const [loadingTaxes, setLoadingTaxes] = useState(false)
  const [deleteTaxConfirmOpen, setDeleteTaxConfirmOpen] = useState(false)
  const [taxToDelete, setTaxToDelete] = useState<TaxRow | null>(null)

  const [editingWarrantyId, setEditingWarrantyId] = useState<string | null>(null)
  const [warrantyRows, setWarrantyRows] = useState<WarrantyRow[]>([])
  const [loadingWarranties, setLoadingWarranties] = useState(false)
  const [deleteWarrantyConfirmOpen, setDeleteWarrantyConfirmOpen] = useState(false)
  const [warrantyToDelete, setWarrantyToDelete] = useState<WarrantyRow | null>(null)

  const [editingInsuranceId, setEditingInsuranceId] = useState<string | null>(null)
  const [insuranceRows, setInsuranceRows] = useState<InsuranceRow[]>([])
  const [loadingInsurances, setLoadingInsurances] = useState(false)
  const [deleteInsuranceConfirmOpen, setDeleteInsuranceConfirmOpen] = useState(false)
  const [insuranceToDelete, setInsuranceToDelete] = useState<InsuranceRow | null>(null)

  const [editingLeadPropertyId, setEditingLeadPropertyId] = useState<string | null>(null)
  const [leadPropertyRows, setLeadPropertyRows] = useState<LeadPropertyRow[]>([])
  const [loadingLeadProperties, setLoadingLeadProperties] = useState(false)
  const [deleteLeadPropertyConfirmOpen, setDeleteLeadPropertyConfirmOpen] = useState(false)
  const [leadPropertyToDelete, setLeadPropertyToDelete] = useState<LeadPropertyRow | null>(null)

  const [editingDisclosureId, setEditingDisclosureId] = useState<string | null>(null)
  const [disclosureRows, setDisclosureRows] = useState<DisclosureRow[]>([])
  const [loadingDisclosures, setLoadingDisclosures] = useState(false)
  const [deleteDisclosureConfirmOpen, setDeleteDisclosureConfirmOpen] = useState(false)
  const [disclosureToDelete, setDisclosureToDelete] = useState<DisclosureRow | null>(null)

  const [editingInventoryCostId, setEditingInventoryCostId] = useState<string | null>(null)
  const [inventoryCostRows, setInventoryCostRows] = useState<InventoryCostRow[]>([])
  const [loadingInventoryCosts, setLoadingInventoryCosts] = useState(false)
  const [deleteInventoryCostConfirmOpen, setDeleteInventoryCostConfirmOpen] = useState(false)
  const [inventoryCostToDelete, setInventoryCostToDelete] = useState<InventoryCostRow | null>(null)

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
  const [defaultToSales, setDefaultToSales] = useState(false)
  const [defaultToPurchasesOrCosts, setDefaultToPurchasesOrCosts] = useState(false)
  const [fieldType, setFieldType] = useState('Single-line text')
  const [groupName, setGroupName] = useState('')
  const [vendor, setVendor] = useState('')
  const [discount, setDiscount] = useState('')
  const [defaultToNewDeals, setDefaultToNewDeals] = useState(false)
  const [lienFee, setLienFee] = useState(false)
  const [dealerWarranty, setDealerWarranty] = useState(false)
  const [disclosureBody, setDisclosureBody] = useState('')

  useEffect(() => {
    if (typeof window === 'undefined') return

    const read = () => {
      try {
        setIsVerified(window.localStorage.getItem('edc_account_verified') === 'true')
      } catch {
        setIsVerified(false)
      }
    }

    read()

    const onStorage = (e: StorageEvent) => {
      if (e.key === 'edc_account_verified') read()
    }
    const onAdminSessionChanged = () => {
      read()
    }

    window.addEventListener('storage', onStorage)
    window.addEventListener('edc_admin_session_changed', onAdminSessionChanged)
    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener('edc_admin_session_changed', onAdminSessionChanged)
    }
  }, [])

  const openModal = () => {
    setEditingFeeId(null)
    setEditingTaxId(null)
    setEditingAccessoryId(null)
    setEditingWarrantyId(null)
    setEditingInsuranceId(null)
    setEditingLeadPropertyId(null)
    setEditingDisclosureId(null)
    setEditingInventoryCostId(null)
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
    setDefaultToSales(false)
    setDefaultToPurchasesOrCosts(false)
    setFieldType('Single-line text')
    setGroupName('')
    setVendor('')
    setDiscount('')
    setDefaultToNewDeals(false)
    setLienFee(false)
    setDealerWarranty(false)
    setDisclosureBody('')
    setSaveError(null)
    setTaxPickerOpen(false)
    setSelectedTaxRates([])
    setIsModalOpen(true)
  }

  const closeModal = () => setIsModalOpen(false)

  const nullIfEmpty = (v: string) => {
    const s = (v || '').trim()
    return s.length ? s : null
  }

  const parseBoolish = (v: unknown) => {
    if (typeof v === 'boolean') return v
    const s = String(v ?? '').trim().toLowerCase()
    if (!s) return false
    return s === 'yes' || s === 'true' || s === '1'
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

  const fetchLeadProperties = async () => {
    setLoadingLeadProperties(true)
    try {
      const { data, error } = await supabase
        .from('presets_leadproperties')
        .select('id, user_id, name, description, field_type')
        .order('name', { ascending: true })

      if (error) throw error
      setLeadPropertyRows(((data as any) || []) as LeadPropertyRow[])
    } catch {
      setLeadPropertyRows([])
    } finally {
      setLoadingLeadProperties(false)
    }
  }

  const fetchDisclosures = async () => {
    setLoadingDisclosures(true)
    try {
      const { data, error } = await supabase
        .from('presets_disclosures')
        .select('id, user_id, name, disclosure')
        .order('name', { ascending: true })

      if (error) throw error
      setDisclosureRows(((data as any) || []) as DisclosureRow[])
    } catch {
      setDisclosureRows([])
    } finally {
      setLoadingDisclosures(false)
    }
  }

  const fetchInventoryCosts = async () => {
    setLoadingInventoryCosts(true)
    try {
      const { data, error } = await supabase
        .from('presets_inventorycosts')
        .select('id, user_id, name, group_name, vendor, amount, discount, default_tax_rate')
        .order('name', { ascending: true })

      if (error) throw error
      setInventoryCostRows(((data as any) || []) as InventoryCostRow[])
    } catch {
      setInventoryCostRows([])
    } finally {
      setLoadingInventoryCosts(false)
    }
  }

  const fetchInsurances = async () => {
    setLoadingInsurances(true)
    try {
      const { data, error } = await supabase
        .from('presets_insurance')
        .select('id, user_id, name, description, deductible, duration, price, cost, type, default_tax_rate')
        .order('name', { ascending: true })

      if (error) throw error
      setInsuranceRows(((data as any) || []) as InsuranceRow[])
    } catch {
      setInsuranceRows([])
    } finally {
      setLoadingInsurances(false)
    }
  }

  const confirmDeleteWarranty = async () => {
    const r = warrantyToDelete
    if (!r) {
      setDeleteWarrantyConfirmOpen(false)
      return
    }
    if (saving) return
    setSaveError(null)
    setSaving(true)
    try {
      const { error } = await supabase.from('presets_warranty').delete().eq('id', r.id)
      if (error) throw error

      setDeleteWarrantyConfirmOpen(false)
      setWarrantyToDelete(null)
      setSaveSuccessMessage('Warranty deleted')
      setSaveSuccessOpen(true)
      await fetchWarranties()
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Delete failed')
    } finally {
      setSaving(false)
    }
  }

  const formatMoney = (n: number | null) => {
    if (typeof n !== 'number' || Number.isNaN(n)) return ''
    return `$${n}`
  }

  const fetchFees = async () => {
    setLoadingFees(true)
    try {
      const { data, error } = await supabase
        .from('presets_fee')
        .select('id, name, description, fee_amount, fee_cost, default_to_new_deals, lien_fee, default_tax_rate, created_at')
        .order('created_at', { ascending: false })

      if (error) throw error
      setFeeRows(((data as any) || []) as FeeRow[])
    } catch {
      setFeeRows([])
    } finally {
      setLoadingFees(false)
    }
  }

  const fetchWarranties = async () => {
    setLoadingWarranties(true)
    try {
      const { data, error } = await supabase
        .from('presets_warranty')
        .select('id, name, description, deductible, duration, distance, price, cost, dealer_warranty, default_tax_rate')
        .order('name', { ascending: true })

      if (error) throw error
      setWarrantyRows(((data as any) || []) as WarrantyRow[])
    } catch {
      setWarrantyRows([])
    } finally {
      setLoadingWarranties(false)
    }
  }

  const fetchAccessories = async () => {
    setLoadingAccessories(true)
    try {
      const { data, error } = await supabase
        .from('presets_accesories')
        .select('id, name, description, amount, cost, type, default_tax_rate')
        .order('name', { ascending: true })

      if (error) throw error
      setAccessoryRows(((data as any) || []) as AccessoryRow[])
    } catch {
      setAccessoryRows([])
    } finally {
      setLoadingAccessories(false)
    }
  }

  const fetchFeeTaxOptions = async () => {
    setLoadingFeeTaxOptions(true)
    try {
      const { data, error } = await supabase
        .from('presets_tax')
        .select('id, name, description, rate, default_tax_rate, default_to_sales, default_to_purchases_or_costs')
        .order('name', { ascending: true })

      if (error) throw error
      setFeeTaxOptions(((data as any) || []) as TaxRow[])
    } catch {
      setFeeTaxOptions([])
    } finally {
      setLoadingFeeTaxOptions(false)
    }
  }

  const fetchTaxes = async () => {
    setLoadingTaxes(true)
    try {
      const { data, error } = await supabase
        .from('presets_tax')
        .select('id, name, description, rate, default_tax_rate, default_to_sales, default_to_purchases_or_costs')
        .order('name', { ascending: true })

      if (error) throw error
      setTaxRows(((data as any) || []) as TaxRow[])
    } catch {
      setTaxRows([])
    } finally {
      setLoadingTaxes(false)
    }
  }

  useEffect(() => {
    if (activeCategory === 'Fees') {
      void fetchFees()
    }
    if (activeCategory === 'Accessories') {
      void fetchAccessories()
    }
    if (activeCategory === 'Warranties') {
      void fetchWarranties()
    }
    if (activeCategory === 'Insurances') {
      void fetchInsurances()
    }
    if (activeCategory === 'Lead Properties') {
      void fetchLeadProperties()
    }
    if (activeCategory === 'Disclosures') {
      void fetchDisclosures()
    }
    if (activeCategory === 'Inventory Costs') {
      void fetchInventoryCosts()
    }
    if (activeCategory === 'Tax Rates') {
      void fetchTaxes()
    }
  }, [activeCategory])

  const handleSave = async () => {
    if (saving) return
    setSaveError(null)

    setSaving(true)
    try {
      const getWebhookUserId = async () => {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser()
        if (userError) throw userError
        const dbUserId = await getLoggedInAdminDbUserId()
        return dbUserId ?? user?.id ?? null
      }

      const callPresetsWebhook = async (payload: Record<string, unknown>) => {
        const res = await fetch(PRESETS_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })

        const text = await res.text().catch(() => '')
        if (!res.ok) throw new Error(text || `Request failed (${res.status})`)
        if (String(text).trim() !== 'Done') throw new Error(text || 'Webhook did not return Done')
      }

      if (activeCategory === 'Warranties') {
        const defaultTaxRateText = selectedTaxRates.length ? selectedTaxRates.join(', ') : null

        if (editingWarrantyId) {
          const updateRow: any = {
            name: nullIfEmpty(name),
            description: nullIfEmpty(description),
            deductible: nullIfEmpty(deductible),
            duration: nullIfEmpty(duration),
            distance: nullIfEmpty(distance),
            price: nullIfEmpty(price),
            cost: nullIfEmpty(cost),
            dealer_warranty: dealerWarranty,
            default_tax_rate: defaultTaxRateText,
          }

          const { error } = await supabase.from('presets_warranty').update(updateRow).eq('id', editingWarrantyId)
          if (error) throw error

          closeModal()
          setSaveSuccessMessage('Warranty updated')
          setSaveSuccessOpen(true)
          await fetchWarranties()
          return
        }

        const user_id = await getWebhookUserId()
        const payload = {
          category: activeCategory,
          action: 'create',
          id: null,
          user_id,
          name: nullIfEmpty(name),
          description: nullIfEmpty(description),
          deductible: nullIfEmpty(deductible),
          duration: nullIfEmpty(duration),
          distance: nullIfEmpty(distance),
          price: nullIfEmpty(price),
          cost: nullIfEmpty(cost),
          dealer_warranty: dealerWarranty,
          default_tax_rate: defaultTaxRateText,
        }

        await callPresetsWebhook(payload)

        closeModal()
        setSaveSuccessMessage('Warranty successfully added')
        setSaveSuccessOpen(true)
        await fetchWarranties()
        return
      }

      if (activeCategory === 'Tax Rates') {
        if (editingTaxId) {
          const updateRow: any = {
            name: nullIfEmpty(name),
            description: nullIfEmpty(description),
            rate: nullIfEmpty(rate),
            default_tax_rate: isDefaultTaxRate,
            default_to_sales: isDefaultTaxRate ? (defaultToSales ? 'Yes' : 'No') : null,
            default_to_purchases_or_costs: isDefaultTaxRate ? (defaultToPurchasesOrCosts ? 'Yes' : 'No') : null,
          }

          const { error } = await supabase.from('presets_tax').update(updateRow).eq('id', editingTaxId)
          if (error) throw error

          closeModal()
          setSaveSuccessMessage('Tax rate updated')
          setSaveSuccessOpen(true)
          await fetchTaxes()
          return
        }

        const user_id = await getWebhookUserId()

        const payload = {
          category: activeCategory,
          action: 'create',
          id: null,
          user_id,
          name: nullIfEmpty(name),
          description: nullIfEmpty(description),
          rate: nullIfEmpty(rate),
          default_tax_rate: isDefaultTaxRate,
          default_to_sales: isDefaultTaxRate ? defaultToSales : null,
          default_to_purchases_or_costs: isDefaultTaxRate ? defaultToPurchasesOrCosts : null,
        }

        await callPresetsWebhook(payload)

        closeModal()
        setSaveSuccessMessage('Tax rate saved')
        setSaveSuccessOpen(true)
        await fetchTaxes()
        return
      }

      if (activeCategory === 'Accessories') {
        const defaultTaxRateText = selectedTaxRates.length ? selectedTaxRates.join(', ') : null

        if (editingAccessoryId) {
          const updateRow: any = {
            name: nullIfEmpty(name),
            description: nullIfEmpty(description),
            amount: nullIfEmpty(amount),
            cost: nullIfEmpty(cost),
            type: nullIfEmpty(type),
            default_tax_rate: defaultTaxRateText,
          }

          const { error } = await supabase.from('presets_accesories').update(updateRow).eq('id', editingAccessoryId)
          if (error) throw error

          closeModal()
          setSaveSuccessMessage('Accessory updated')
          setSaveSuccessOpen(true)
          await fetchAccessories()
          return
        }

        const user_id = await getWebhookUserId()

        const payload = {
          category: activeCategory,
          action: 'create',
          id: null,
          user_id,
          name: nullIfEmpty(name),
          description: nullIfEmpty(description),
          amount: nullIfEmpty(amount),
          cost: nullIfEmpty(cost),
          type: nullIfEmpty(type),
          default_tax_rate: defaultTaxRateText,
        }

        await callPresetsWebhook(payload)

        closeModal()
        setSaveSuccessMessage('Accessory saved')
        setSaveSuccessOpen(true)
        await fetchAccessories()
        return
      }

      if (activeCategory === 'Lead Properties') {
        if (editingLeadPropertyId) {
          const updateRow: any = {
            name: nullIfEmpty(name),
            description: nullIfEmpty(description),
            field_type: nullIfEmpty(fieldType),
          }

          const { error } = await supabase.from('presets_leadproperties').update(updateRow).eq('id', editingLeadPropertyId)
          if (error) throw error

          closeModal()
          setSaveSuccessMessage('Lead property updated')
          setSaveSuccessOpen(true)
          await fetchLeadProperties()
          return
        }

        const user_id = await getWebhookUserId()
        const payload = {
          category: activeCategory,
          action: 'create',
          id: null,
          user_id,
          name: nullIfEmpty(name),
          description: nullIfEmpty(description),
          field_type: nullIfEmpty(fieldType),
        }

        await callPresetsWebhook(payload)

        closeModal()
        setSaveSuccessMessage('Successful save')
        setSaveSuccessOpen(true)
        await fetchLeadProperties()
        return
      }

      if (activeCategory === 'Disclosures') {
        if (editingDisclosureId) {
          const updateRow: any = {
            name: nullIfEmpty(name),
            disclosure: nullIfEmpty(disclosureBody),
          }

          const { error } = await supabase.from('presets_disclosures').update(updateRow).eq('id', editingDisclosureId)
          if (error) throw error

          closeModal()
          setSaveSuccessMessage('Disclosure updated')
          setSaveSuccessOpen(true)
          await fetchDisclosures()
          return
        }

        const user_id = await getWebhookUserId()
        const payload = {
          category: activeCategory,
          action: 'create',
          id: null,
          user_id,
          name: nullIfEmpty(name),
          disclosure: nullIfEmpty(disclosureBody),
        }

        await callPresetsWebhook(payload)

        closeModal()
        setSaveSuccessMessage('Successful save')
        setSaveSuccessOpen(true)
        await fetchDisclosures()
        return
      }

      if (activeCategory === 'Inventory Costs') {
        const defaultTaxRateText = selectedTaxRates.length ? selectedTaxRates.join(', ') : null

        if (editingInventoryCostId) {
          const updateRow: any = {
            name: nullIfEmpty(name),
            group_name: nullIfEmpty(groupName),
            vendor: nullIfEmpty(vendor),
            amount: nullIfEmpty(amount),
            discount: nullIfEmpty(discount),
            default_tax_rate: defaultTaxRateText,
          }

          const { error } = await supabase.from('presets_inventorycosts').update(updateRow).eq('id', editingInventoryCostId)
          if (error) throw error

          closeModal()
          setSaveSuccessMessage('Inventory cost updated')
          setSaveSuccessOpen(true)
          await fetchInventoryCosts()
          return
        }

        const user_id = await getWebhookUserId()
        const payload = {
          category: activeCategory,
          action: 'create',
          id: null,
          user_id,
          name: nullIfEmpty(name),
          group_name: nullIfEmpty(groupName),
          vendor: nullIfEmpty(vendor),
          amount: nullIfEmpty(amount),
          discount: nullIfEmpty(discount),
          default_tax_rate: defaultTaxRateText,
        }

        await callPresetsWebhook(payload)

        closeModal()
        setSaveSuccessMessage('Successful save')
        setSaveSuccessOpen(true)
        return
      }

      if (activeCategory === 'Insurances') {
        const defaultTaxRateText = selectedTaxRates.length ? selectedTaxRates.join(', ') : null

        if (editingInsuranceId) {
          const updateRow: any = {
            name: nullIfEmpty(name),
            description: nullIfEmpty(description),
            deductible: nullIfEmpty(deductible),
            duration: nullIfEmpty(duration),
            price: nullIfEmpty(price),
            cost: nullIfEmpty(cost),
            type: nullIfEmpty(type),
            default_tax_rate: defaultTaxRateText,
          }

          const { error } = await supabase.from('presets_insurance').update(updateRow).eq('id', editingInsuranceId)
          if (error) throw error

          closeModal()
          setSaveSuccessMessage('Insurance updated')
          setSaveSuccessOpen(true)
          await fetchInsurances()
          return
        }

        const user_id = await getWebhookUserId()
        const payload = {
          category: activeCategory,
          action: 'create',
          id: null,
          user_id,
          name: nullIfEmpty(name),
          description: nullIfEmpty(description),
          deductible: nullIfEmpty(deductible),
          duration: nullIfEmpty(duration),
          price: nullIfEmpty(price),
          cost: nullIfEmpty(cost),
          type: nullIfEmpty(type),
          default_tax_rate: defaultTaxRateText,
        }

        await callPresetsWebhook(payload)

        closeModal()
        setSaveSuccessMessage('Successful save')
        setSaveSuccessOpen(true)
        await fetchInsurances()
        return
      }

      if (activeCategory !== 'Fees') {
        closeModal()
        return
      }

      const defaultTaxRateText = selectedTaxRates.length ? selectedTaxRates.join(', ') : null

      if (editingFeeId) {
        const updateRow: any = {
          name: nullIfEmpty(name),
          description: nullIfEmpty(description),
          fee_amount: nullIfEmpty(amount),
          fee_cost: nullIfEmpty(cost),
          default_to_new_deals: defaultToNewDeals,
          lien_fee: lienFee,
          default_tax_rate: defaultTaxRateText,
        }

        const { error } = await supabase.from('presets_fee').update(updateRow).eq('id', editingFeeId)
        if (error) throw error

        closeModal()
        setSaveSuccessMessage('Successful update')
        setSaveSuccessOpen(true)
        await fetchFees()
        return
      }

      const user_id = await getWebhookUserId()

      const payload = {
        category: activeCategory,
        action: 'create',
        id: null,
        user_id,
        name: nullIfEmpty(name),
        description: nullIfEmpty(description),
        fee_amount: nullIfEmpty(amount),
        fee_cost: nullIfEmpty(cost),
        default_to_new_deals: defaultToNewDeals,
        lien_fee: lienFee,
        default_tax_rate: defaultTaxRateText,
      }

      await callPresetsWebhook(payload)

      closeModal()
      setSaveSuccessMessage('Successful save')
      setSaveSuccessOpen(true)
      await fetchFees()
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const openEditFee = (r: FeeRow) => {
    setEditingFeeId(r.id)
    setEditingTaxId(null)
    setEditingAccessoryId(null)
    setName(r.name || '')
    setDescription(r.description || '')
    setAmount(r.fee_amount == null ? '' : String(r.fee_amount))
    setCost(r.fee_cost == null ? '' : String(r.fee_cost))
    setDefaultToNewDeals(Boolean(r.default_to_new_deals))
    setLienFee(Boolean(r.lien_fee))
    const selected = (r.default_tax_rate || '')
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean)
    setSelectedTaxRates(selected)
    setSaveError(null)
    setTaxPickerOpen(false)
    setIsModalOpen(true)
  }

  const openEditTax = (r: TaxRow) => {
    setEditingFeeId(null)
    setEditingTaxId(r.id)
    setEditingAccessoryId(null)
    setName(r.name || '')
    setDescription(r.description || '')
    setRate(r.rate == null ? '' : String(r.rate))
    setIsDefaultTaxRate(Boolean(r.default_tax_rate))
    setDefaultToSales(parseBoolish(r.default_to_sales))
    setDefaultToPurchasesOrCosts(parseBoolish(r.default_to_purchases_or_costs))
    setSaveError(null)
    setTaxPickerOpen(false)
    setIsModalOpen(true)
  }

  const requestDeleteFee = (r: FeeRow) => {
    setFeeToDelete(r)
    setDeleteConfirmOpen(true)
  }

  const openEditAccessory = (r: AccessoryRow) => {
    setEditingFeeId(null)
    setEditingTaxId(null)
    setEditingAccessoryId(r.id)
    setName(r.name || '')
    setDescription(r.description || '')
    setAmount(r.amount == null ? '' : String(r.amount))
    setCost(r.cost == null ? '' : String(r.cost))
    setType(r.type || 'Car')
    const selected = (r.default_tax_rate || '')
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean)
    setSelectedTaxRates(selected)
    setSaveError(null)
    setTaxPickerOpen(false)
    setIsModalOpen(true)
  }

  const requestDeleteAccessory = (r: AccessoryRow) => {
    setAccessoryToDelete(r)
    setDeleteAccessoryConfirmOpen(true)
  }

  const requestDeleteTax = (r: TaxRow) => {
    setTaxToDelete(r)
    setDeleteTaxConfirmOpen(true)
  }

  const openEditWarranty = (r: WarrantyRow) => {
    setEditingFeeId(null)
    setEditingTaxId(null)
    setEditingAccessoryId(null)
    setEditingWarrantyId(r.id)
    setName(r.name || '')
    setDescription(r.description || '')
    setDeductible(r.deductible || '')
    setDuration(r.duration || '')
    setDistance(r.distance || '')
    setPrice(r.price || '')
    setCost(r.cost || '')
    setDealerWarranty(Boolean(r.dealer_warranty))
    const selected = (r.default_tax_rate || '')
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean)
    setSelectedTaxRates(selected)
    setSaveError(null)
    setTaxPickerOpen(false)
    setIsModalOpen(true)
  }

  const requestDeleteWarranty = (r: WarrantyRow) => {
    setWarrantyToDelete(r)
    setDeleteWarrantyConfirmOpen(true)
  }

  const openEditInsurance = (r: InsuranceRow) => {
    setEditingFeeId(null)
    setEditingTaxId(null)
    setEditingAccessoryId(null)
    setEditingWarrantyId(null)
    setEditingInsuranceId(r.id)
    setName(r.name || '')
    setDescription(r.description || '')
    setDeductible(r.deductible || '')
    setDuration(r.duration || '')
    setPrice(r.price || '')
    setCost(r.cost || '')
    setType(r.type || 'Life')
    const selected = (r.default_tax_rate || '')
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean)
    setSelectedTaxRates(selected)
    setSaveError(null)
    setTaxPickerOpen(false)
    setIsModalOpen(true)
  }

  const requestDeleteInsurance = (r: InsuranceRow) => {
    setInsuranceToDelete(r)
    setDeleteInsuranceConfirmOpen(true)
  }

  const openEditLeadProperty = (r: LeadPropertyRow) => {
    setEditingFeeId(null)
    setEditingTaxId(null)
    setEditingAccessoryId(null)
    setEditingWarrantyId(null)
    setEditingInsuranceId(null)
    setEditingLeadPropertyId(r.id)
    setEditingDisclosureId(null)
    setEditingInventoryCostId(null)
    setName(r.name || '')
    setDescription(r.description || '')
    setFieldType(r.field_type || 'Single-line text')
    setSaveError(null)
    setTaxPickerOpen(false)
    setIsModalOpen(true)
  }

  const requestDeleteLeadProperty = (r: LeadPropertyRow) => {
    setLeadPropertyToDelete(r)
    setDeleteLeadPropertyConfirmOpen(true)
  }

  const openEditDisclosure = (r: DisclosureRow) => {
    setEditingFeeId(null)
    setEditingTaxId(null)
    setEditingAccessoryId(null)
    setEditingWarrantyId(null)
    setEditingInsuranceId(null)
    setEditingLeadPropertyId(null)
    setEditingDisclosureId(r.id)
    setEditingInventoryCostId(null)
    setName(r.name || '')
    setDisclosureBody(r.disclosure || '')
    setSaveError(null)
    setTaxPickerOpen(false)
    setIsModalOpen(true)
  }

  const requestDeleteDisclosure = (r: DisclosureRow) => {
    setDisclosureToDelete(r)
    setDeleteDisclosureConfirmOpen(true)
  }

  const openEditInventoryCost = (r: InventoryCostRow) => {
    setEditingFeeId(null)
    setEditingTaxId(null)
    setEditingAccessoryId(null)
    setEditingWarrantyId(null)
    setEditingInsuranceId(null)
    setEditingLeadPropertyId(null)
    setEditingDisclosureId(null)
    setEditingInventoryCostId(r.id)
    setName(r.name || '')
    setGroupName(r.group_name || '')
    setVendor(r.vendor || '')
    setAmount(r.amount || '')
    setDiscount(r.discount || '')
    const selected = (r.default_tax_rate || '')
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean)
    setSelectedTaxRates(selected)
    setSaveError(null)
    setTaxPickerOpen(false)
    setIsModalOpen(true)
  }

  const requestDeleteInventoryCost = (r: InventoryCostRow) => {
    setInventoryCostToDelete(r)
    setDeleteInventoryCostConfirmOpen(true)
  }

  const confirmDeleteInsurance = async () => {
    const r = insuranceToDelete
    if (!r) {
      setDeleteInsuranceConfirmOpen(false)
      return
    }
    if (saving) return
    setSaveError(null)
    setSaving(true)
    try {
      const { error } = await supabase.from('presets_insurance').delete().eq('id', r.id)
      if (error) throw error

      setDeleteInsuranceConfirmOpen(false)
      setInsuranceToDelete(null)
      setSaveSuccessMessage('Insurance deleted')
      setSaveSuccessOpen(true)
      await fetchInsurances()
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Delete failed')
    } finally {
      setSaving(false)
    }
  }

  const confirmDeleteLeadProperty = async () => {
    const r = leadPropertyToDelete
    if (!r) {
      setDeleteLeadPropertyConfirmOpen(false)
      return
    }
    if (saving) return
    setSaveError(null)
    setSaving(true)
    try {
      const { error } = await supabase.from('presets_leadproperties').delete().eq('id', r.id)
      if (error) throw error

      setDeleteLeadPropertyConfirmOpen(false)
      setLeadPropertyToDelete(null)
      setSaveSuccessMessage('Lead property deleted')
      setSaveSuccessOpen(true)
      await fetchLeadProperties()
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Delete failed')
    } finally {
      setSaving(false)
    }
  }

  const confirmDeleteDisclosure = async () => {
    const r = disclosureToDelete
    if (!r) {
      setDeleteDisclosureConfirmOpen(false)
      return
    }
    if (saving) return
    setSaveError(null)
    setSaving(true)
    try {
      const { error } = await supabase.from('presets_disclosures').delete().eq('id', r.id)
      if (error) throw error

      setDeleteDisclosureConfirmOpen(false)
      setDisclosureToDelete(null)
      setSaveSuccessMessage('Disclosure deleted')
      setSaveSuccessOpen(true)
      await fetchDisclosures()
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Delete failed')
    } finally {
      setSaving(false)
    }
  }

  const confirmDeleteInventoryCost = async () => {
    const r = inventoryCostToDelete
    if (!r) {
      setDeleteInventoryCostConfirmOpen(false)
      return
    }
    if (saving) return
    setSaveError(null)
    setSaving(true)
    try {
      const { error } = await supabase.from('presets_inventorycosts').delete().eq('id', r.id)
      if (error) throw error

      setDeleteInventoryCostConfirmOpen(false)
      setInventoryCostToDelete(null)
      setSaveSuccessMessage('Inventory cost deleted')
      setSaveSuccessOpen(true)
      await fetchInventoryCosts()
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Delete failed')
    } finally {
      setSaving(false)
    }
  }

  const confirmDeleteFee = async () => {
    const r = feeToDelete
    if (!r) {
      setDeleteConfirmOpen(false)
      return
    }
    if (saving) return
    setSaveError(null)
    setSaving(true)
    try {
      const { error } = await supabase.from('presets_fee').delete().eq('id', r.id)
      if (error) throw error

      setDeleteConfirmOpen(false)
      setFeeToDelete(null)
      setSaveSuccessMessage('Successful delete')
      setSaveSuccessOpen(true)
      await fetchFees()
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Delete failed')
    } finally {
      setSaving(false)
    }
  }

  const confirmDeleteTax = async () => {
    const r = taxToDelete
    if (!r) {
      setDeleteTaxConfirmOpen(false)
      return
    }
    if (saving) return
    setSaveError(null)
    setSaving(true)
    try {
      const { error } = await supabase.from('presets_tax').delete().eq('id', r.id)
      if (error) throw error

      setDeleteTaxConfirmOpen(false)
      setTaxToDelete(null)
      setSaveSuccessMessage('Tax rate deleted')
      setSaveSuccessOpen(true)
      await fetchTaxes()
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Delete failed')
    } finally {
      setSaving(false)
    }
  }

  const confirmDeleteAccessory = async () => {
    const r = accessoryToDelete
    if (!r) {
      setDeleteAccessoryConfirmOpen(false)
      return
    }
    if (saving) return
    setSaveError(null)
    setSaving(true)
    try {
      const { error } = await supabase.from('presets_accesories').delete().eq('id', r.id)
      if (error) throw error

      setDeleteAccessoryConfirmOpen(false)
      setAccessoryToDelete(null)
      setSaveSuccessMessage('Accessory deleted')
      setSaveSuccessOpen(true)
      await fetchAccessories()
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Delete failed')
    } finally {
      setSaving(false)
    }
  }

  const currentRows = useMemo<PresetRow[]>(() => {
    if (activeCategory === 'Fees') {
      return feeRows.map((r) => ({
        id: r.id,
        name: r.name || '',
        description: r.description || '',
        amount: formatMoney(r.fee_amount),
      }))
    }
    if (activeCategory === 'Accessories') {
      return accessoryRows.map((r) => ({
        id: r.id,
        name: r.name || '',
        description: r.description || '',
        amount: formatMoney(r.amount),
      }))
    }
    if (activeCategory === 'Tax Rates') {
      return taxRows.map((r) => ({
        id: r.id,
        name: r.name || '',
        description: r.description || '',
        amount: r.rate == null ? '' : `${r.rate}%`,
      }))
    }
    if (activeCategory === 'Warranties') {
      return warrantyRows.map((r) => ({
        id: r.id,
        name: r.name || '',
        description: r.description || '',
        distance: r.distance || '',
        duration: r.duration || '',
        deductible: r.deductible || '',
        price: r.price || '',
      }))
    }
    if (activeCategory === 'Insurances') {
      return insuranceRows.map((r) => ({
        id: r.id,
        name: r.name || '',
        description: r.description || '',
        duration: r.duration || '',
        deductible: r.deductible || '',
        price: r.price || '',
      }))
    }
    if (activeCategory === 'Lead Properties') {
      return leadPropertyRows.map((r) => ({
        id: r.id,
        name: r.name || '',
        description: r.description || '',
        fieldType: r.field_type || '',
      }))
    }
    if (activeCategory === 'Disclosures') {
      return disclosureRows.map((r) => ({
        id: r.id,
        name: r.name || '',
        disclosure: r.disclosure || '',
        favourite: '',
      }))
    }
    if (activeCategory === 'Inventory Costs') {
      return inventoryCostRows.map((r) => ({
        id: r.id,
        name: r.name || '',
        groupName: r.group_name || '',
        price: r.amount || '',
      }))
    }
    return []
  }, [activeCategory, feeRows, accessoryRows, taxRows, warrantyRows, insuranceRows, leadPropertyRows, disclosureRows, inventoryCostRows])

  const amountHeader = useMemo(() => {
    if (activeCategory === 'Tax Rates') return 'Rate'
    if (activeCategory === 'Warranties') return 'Price'
    if (activeCategory === 'Insurances') return 'Price'
    return 'Amount'
  }, [activeCategory])

  const tableConfig = useMemo(() => {
    if (activeCategory === 'Lead Properties') {
      return {
        grid: 'grid-cols-[48px_1.3fr_2fr_160px]',
        headers: ['Label', 'Description', 'Field Type'],
      }
    }
    if (activeCategory === 'Disclosures') {
      return {
        grid: 'grid-cols-[48px_1.3fr_2fr_140px]',
        headers: ['Name', 'Disclosure', 'Favourite'],
      }
    }
    if (activeCategory === 'Inventory Costs') {
      return {
        grid: 'grid-cols-[48px_1.3fr_2fr_140px]',
        headers: ['Name', 'Group Name', 'Price'],
      }
    }
    if (activeCategory === 'Insurances') {
      return {
        grid: 'grid-cols-[48px_1.2fr_1.6fr_140px_140px_140px]',
        headers: ['Name', 'Description', 'Duration', 'Deductible', 'Price'],
      }
    }
    if (activeCategory === 'Warranties') {
      return {
        grid: 'grid-cols-[48px_1.1fr_1.4fr_140px_140px_140px_140px]',
        headers: ['Name', 'Description', 'Distance', 'Duration', 'Deductible', 'Price'],
      }
    }

    return {
      grid: 'grid-cols-[48px_1.3fr_2fr_140px]',
      headers: ['Name', 'Description', amountHeader],
    }
  }, [activeCategory, amountHeader])

  const filtered = useMemo(() => {
    const list = currentRows
    const q = search.trim().toLowerCase()
    if (!q) return list
    return list.filter((r) => {
      return (
        r.name.toLowerCase().includes(q) ||
        (r.description || '').toLowerCase().includes(q) ||
        (r.amount || '').toLowerCase().includes(q)
      )
    })
  }, [currentRows, search])

  const visible = useMemo(() => filtered.slice(0, pageSize), [filtered, pageSize])

  if (!isVerified) {
    return (
      <div className="min-h-screen bg-gray-100">
        <div className="w-full px-4 sm:px-6 lg:px-8 py-10">
          <div className="max-w-2xl bg-white border border-gray-200 rounded-2xl shadow-sm p-6">
            <div className="text-lg font-bold text-gray-900">Settings are disabled</div>
            <div className="mt-2 text-sm text-gray-700">
              Your account is not verified yet. Please validate your ID to access Settings.
            </div>
            <div className="mt-5 flex items-center gap-3">
              <Link href="/account/verification" className="px-4 py-2 rounded-lg bg-[#118df0] text-white text-sm font-semibold">
                Validate ID
              </Link>
              <Link href="/admin" className="px-4 py-2 rounded-lg bg-white border border-gray-200 text-sm font-semibold text-gray-800">
                Back to Dashboard
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      {saveSuccessOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/50" onMouseDown={() => setSaveSuccessOpen(false)} />
          <div className="relative w-[360px] bg-white shadow-lg">
            <div className="h-11 px-4 border-b border-gray-200 flex items-center justify-between">
              <div className="text-sm font-semibold text-gray-800">Success</div>
              <button type="button" className="h-8 w-8 flex items-center justify-center" onClick={() => setSaveSuccessOpen(false)}>
                <span className="text-xl leading-none text-gray-500">×</span>
              </button>
            </div>
            <div className="p-4 text-xs text-gray-700">{saveSuccessMessage}</div>
            <div className="h-12 px-4 border-t border-gray-200 flex items-center justify-end">
              <button type="button" className="h-8 px-4 bg-[#118df0] text-white text-xs font-semibold" onClick={() => setSaveSuccessOpen(false)}>
                OK
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {deleteLeadPropertyConfirmOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/50" onMouseDown={() => setDeleteLeadPropertyConfirmOpen(false)} />
          <div className="relative w-[420px] bg-white shadow-lg" onMouseDown={(e) => e.stopPropagation()}>
            <div className="h-11 px-4 border-b border-gray-200 flex items-center justify-between">
              <div className="text-sm font-semibold text-gray-800">Warning</div>
              <button
                type="button"
                className="h-8 w-8 flex items-center justify-center"
                onClick={() => setDeleteLeadPropertyConfirmOpen(false)}
              >
                <span className="text-xl leading-none text-gray-500">×</span>
              </button>
            </div>
            <div className="p-4 text-xs text-gray-700">
              Delete lead property {leadPropertyToDelete?.name || ''}? This cannot be undone.
            </div>
            <div className="h-12 px-4 border-t border-gray-200 flex items-center justify-end gap-2">
              <button
                type="button"
                className="h-8 px-4 bg-gray-600 text-white text-xs font-semibold"
                onClick={() => setDeleteLeadPropertyConfirmOpen(false)}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                type="button"
                className={
                  saving
                    ? 'h-8 px-4 bg-red-600/60 text-white text-xs font-semibold cursor-not-allowed'
                    : 'h-8 px-4 bg-red-600 text-white text-xs font-semibold'
                }
                onClick={() => void confirmDeleteLeadProperty()}
                disabled={saving}
              >
                {saving ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {deleteDisclosureConfirmOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/50" onMouseDown={() => setDeleteDisclosureConfirmOpen(false)} />
          <div className="relative w-[420px] bg-white shadow-lg" onMouseDown={(e) => e.stopPropagation()}>
            <div className="h-11 px-4 border-b border-gray-200 flex items-center justify-between">
              <div className="text-sm font-semibold text-gray-800">Warning</div>
              <button
                type="button"
                className="h-8 w-8 flex items-center justify-center"
                onClick={() => setDeleteDisclosureConfirmOpen(false)}
              >
                <span className="text-xl leading-none text-gray-500">×</span>
              </button>
            </div>
            <div className="p-4 text-xs text-gray-700">Delete disclosure {disclosureToDelete?.name || ''}? This cannot be undone.</div>
            <div className="h-12 px-4 border-t border-gray-200 flex items-center justify-end gap-2">
              <button
                type="button"
                className="h-8 px-4 bg-gray-600 text-white text-xs font-semibold"
                onClick={() => setDeleteDisclosureConfirmOpen(false)}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                type="button"
                className={
                  saving
                    ? 'h-8 px-4 bg-red-600/60 text-white text-xs font-semibold cursor-not-allowed'
                    : 'h-8 px-4 bg-red-600 text-white text-xs font-semibold'
                }
                onClick={() => void confirmDeleteDisclosure()}
                disabled={saving}
              >
                {saving ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {deleteInventoryCostConfirmOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/50" onMouseDown={() => setDeleteInventoryCostConfirmOpen(false)} />
          <div className="relative w-[420px] bg-white shadow-lg" onMouseDown={(e) => e.stopPropagation()}>
            <div className="h-11 px-4 border-b border-gray-200 flex items-center justify-between">
              <div className="text-sm font-semibold text-gray-800">Warning</div>
              <button
                type="button"
                className="h-8 w-8 flex items-center justify-center"
                onClick={() => setDeleteInventoryCostConfirmOpen(false)}
              >
                <span className="text-xl leading-none text-gray-500">×</span>
              </button>
            </div>
            <div className="p-4 text-xs text-gray-700">
              Delete inventory cost {inventoryCostToDelete?.name || ''}? This cannot be undone.
            </div>
            <div className="h-12 px-4 border-t border-gray-200 flex items-center justify-end gap-2">
              <button
                type="button"
                className="h-8 px-4 bg-gray-600 text-white text-xs font-semibold"
                onClick={() => setDeleteInventoryCostConfirmOpen(false)}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                type="button"
                className={
                  saving
                    ? 'h-8 px-4 bg-red-600/60 text-white text-xs font-semibold cursor-not-allowed'
                    : 'h-8 px-4 bg-red-600 text-white text-xs font-semibold'
                }
                onClick={() => void confirmDeleteInventoryCost()}
                disabled={saving}
              >
                {saving ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {deleteInsuranceConfirmOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/50" onMouseDown={() => setDeleteInsuranceConfirmOpen(false)} />
          <div className="relative w-[420px] bg-white shadow-lg" onMouseDown={(e) => e.stopPropagation()}>
            <div className="h-11 px-4 border-b border-gray-200 flex items-center justify-between">
              <div className="text-sm font-semibold text-gray-800">Warning</div>
              <button
                type="button"
                className="h-8 w-8 flex items-center justify-center"
                onClick={() => setDeleteInsuranceConfirmOpen(false)}
              >
                <span className="text-xl leading-none text-gray-500">×</span>
              </button>
            </div>
            <div className="p-4 text-xs text-gray-700">
              Delete insurance {insuranceToDelete?.name || ''}? This cannot be undone.
            </div>
            <div className="h-12 px-4 border-t border-gray-200 flex items-center justify-end gap-2">
              <button
                type="button"
                className="h-8 px-4 bg-gray-600 text-white text-xs font-semibold"
                onClick={() => setDeleteInsuranceConfirmOpen(false)}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                type="button"
                className={
                  saving
                    ? 'h-8 px-4 bg-red-600/60 text-white text-xs font-semibold cursor-not-allowed'
                    : 'h-8 px-4 bg-red-600 text-white text-xs font-semibold'
                }
                onClick={() => void confirmDeleteInsurance()}
                disabled={saving}
              >
                {saving ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {deleteWarrantyConfirmOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/50" onMouseDown={() => setDeleteWarrantyConfirmOpen(false)} />
          <div className="relative w-[420px] bg-white shadow-lg" onMouseDown={(e) => e.stopPropagation()}>
            <div className="h-11 px-4 border-b border-gray-200 flex items-center justify-between">
              <div className="text-sm font-semibold text-gray-800">Warning</div>
              <button
                type="button"
                className="h-8 w-8 flex items-center justify-center"
                onClick={() => setDeleteWarrantyConfirmOpen(false)}
              >
                <span className="text-xl leading-none text-gray-500">×</span>
              </button>
            </div>
            <div className="p-4 text-xs text-gray-700">
              Delete warranty {warrantyToDelete?.name || ''}? This cannot be undone.
            </div>
            <div className="h-12 px-4 border-t border-gray-200 flex items-center justify-end gap-2">
              <button
                type="button"
                className="h-8 px-4 bg-gray-600 text-white text-xs font-semibold"
                onClick={() => setDeleteWarrantyConfirmOpen(false)}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                type="button"
                className={
                  saving
                    ? 'h-8 px-4 bg-red-600/60 text-white text-xs font-semibold cursor-not-allowed'
                    : 'h-8 px-4 bg-red-600 text-white text-xs font-semibold'
                }
                onClick={() => void confirmDeleteWarranty()}
                disabled={saving}
              >
                {saving ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {deleteAccessoryConfirmOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/50" onMouseDown={() => setDeleteAccessoryConfirmOpen(false)} />
          <div className="relative w-[420px] bg-white shadow-lg" onMouseDown={(e) => e.stopPropagation()}>
            <div className="h-11 px-4 border-b border-gray-200 flex items-center justify-between">
              <div className="text-sm font-semibold text-gray-800">Warning</div>
              <button
                type="button"
                className="h-8 w-8 flex items-center justify-center"
                onClick={() => setDeleteAccessoryConfirmOpen(false)}
              >
                <span className="text-xl leading-none text-gray-500">×</span>
              </button>
            </div>
            <div className="p-4 text-xs text-gray-700">
              Delete accessory {accessoryToDelete?.name || ''}? This cannot be undone.
            </div>
            <div className="h-12 px-4 border-t border-gray-200 flex items-center justify-end gap-2">
              <button
                type="button"
                className="h-8 px-4 bg-gray-600 text-white text-xs font-semibold"
                onClick={() => setDeleteAccessoryConfirmOpen(false)}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                type="button"
                className={
                  saving
                    ? 'h-8 px-4 bg-red-600/60 text-white text-xs font-semibold cursor-not-allowed'
                    : 'h-8 px-4 bg-red-600 text-white text-xs font-semibold'
                }
                onClick={() => void confirmDeleteAccessory()}
                disabled={saving}
              >
                {saving ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {deleteTaxConfirmOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/50" onMouseDown={() => setDeleteTaxConfirmOpen(false)} />
          <div className="relative w-[420px] bg-white shadow-lg" onMouseDown={(e) => e.stopPropagation()}>
            <div className="h-11 px-4 border-b border-gray-200 flex items-center justify-between">
              <div className="text-sm font-semibold text-gray-800">Warning</div>
              <button
                type="button"
                className="h-8 w-8 flex items-center justify-center"
                onClick={() => setDeleteTaxConfirmOpen(false)}
              >
                <span className="text-xl leading-none text-gray-500">×</span>
              </button>
            </div>
            <div className="p-4 text-xs text-gray-700">Delete tax rate {taxToDelete?.name || ''}? This cannot be undone.</div>
            <div className="h-12 px-4 border-t border-gray-200 flex items-center justify-end gap-2">
              <button
                type="button"
                className="h-8 px-4 bg-gray-600 text-white text-xs font-semibold"
                onClick={() => setDeleteTaxConfirmOpen(false)}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                type="button"
                className={
                  saving
                    ? 'h-8 px-4 bg-red-600/60 text-white text-xs font-semibold cursor-not-allowed'
                    : 'h-8 px-4 bg-red-600 text-white text-xs font-semibold'
                }
                onClick={() => void confirmDeleteTax()}
                disabled={saving}
              >
                {saving ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {deleteConfirmOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/50" onMouseDown={() => setDeleteConfirmOpen(false)} />
          <div className="relative w-[420px] bg-white shadow-lg" onMouseDown={(e) => e.stopPropagation()}>
            <div className="h-11 px-4 border-b border-gray-200 flex items-center justify-between">
              <div className="text-sm font-semibold text-gray-800">Warning</div>
              <button
                type="button"
                className="h-8 w-8 flex items-center justify-center"
                onClick={() => setDeleteConfirmOpen(false)}
              >
                <span className="text-xl leading-none text-gray-500">×</span>
              </button>
            </div>
            <div className="p-4 text-xs text-gray-700">
              Delete fee {feeToDelete?.name || ''}? This cannot be undone.
            </div>
            <div className="h-12 px-4 border-t border-gray-200 flex items-center justify-end gap-2">
              <button
                type="button"
                className="h-8 px-4 bg-gray-600 text-white text-xs font-semibold"
                onClick={() => setDeleteConfirmOpen(false)}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                type="button"
                className={
                  saving
                    ? 'h-8 px-4 bg-red-600/60 text-white text-xs font-semibold cursor-not-allowed'
                    : 'h-8 px-4 bg-red-600 text-white text-xs font-semibold'
                }
                onClick={() => void confirmDeleteFee()}
                disabled={saving}
              >
                {saving ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

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
            <div className={`grid ${tableConfig.grid} gap-0 border-b border-gray-200 bg-white`}>
              <div className="h-8" />
              {tableConfig.headers.map((h) => (
                <div key={h} className="h-8 flex items-center text-[11px] font-semibold text-gray-700">
                  {h}
                </div>
              ))}
            </div>

            {activeCategory === 'Fees' && loadingFees ? (
              <div className="p-6 text-xs text-gray-500">Loading…</div>
            ) : activeCategory === 'Accessories' && loadingAccessories ? (
              <div className="p-6 text-xs text-gray-500">Loading…</div>
            ) : activeCategory === 'Warranties' && loadingWarranties ? (
              <div className="p-6 text-xs text-gray-500">Loading…</div>
            ) : activeCategory === 'Insurances' && loadingInsurances ? (
              <div className="p-6 text-xs text-gray-500">Loading…</div>
            ) : activeCategory === 'Lead Properties' && loadingLeadProperties ? (
              <div className="p-6 text-xs text-gray-500">Loading…</div>
            ) : activeCategory === 'Disclosures' && loadingDisclosures ? (
              <div className="p-6 text-xs text-gray-500">Loading…</div>
            ) : activeCategory === 'Inventory Costs' && loadingInventoryCosts ? (
              <div className="p-6 text-xs text-gray-500">Loading…</div>
            ) : activeCategory === 'Tax Rates' && loadingTaxes ? (
              <div className="p-6 text-xs text-gray-500">Loading…</div>
            ) : visible.length === 0 ? (
              <div className="p-6 text-xs text-gray-500">No presets found.</div>
            ) : (
              <div>
                {visible.map((r) => {
                  const fee = activeCategory === 'Fees' ? feeRows.find((x) => x.id === r.id) : null
                  const accessory = activeCategory === 'Accessories' ? accessoryRows.find((x) => x.id === r.id) : null
                  const tax = activeCategory === 'Tax Rates' ? taxRows.find((x) => x.id === r.id) : null
                  const warranty = activeCategory === 'Warranties' ? warrantyRows.find((x) => x.id === r.id) : null
                  const insurance = activeCategory === 'Insurances' ? insuranceRows.find((x) => x.id === r.id) : null
                  const leadProp = activeCategory === 'Lead Properties' ? leadPropertyRows.find((x) => x.id === r.id) : null
                  const disclosure = activeCategory === 'Disclosures' ? disclosureRows.find((x) => x.id === r.id) : null
                  const invCost = activeCategory === 'Inventory Costs' ? inventoryCostRows.find((x) => x.id === r.id) : null
                  return (
                  <div key={r.id} className={`grid ${tableConfig.grid} border-b border-gray-100`}>
                    <div className="h-10 flex items-center gap-2 px-2">
                      <button
                        type="button"
                        className="h-6 w-6 flex items-center justify-center text-gray-500 hover:text-gray-800"
                        title="Edit"
                        onClick={() => {
                          if (activeCategory === 'Fees' && fee) openEditFee(fee)
                          if (activeCategory === 'Accessories' && accessory) openEditAccessory(accessory)
                          if (activeCategory === 'Tax Rates' && tax) openEditTax(tax)
                          if (activeCategory === 'Warranties' && warranty) openEditWarranty(warranty)
                          if (activeCategory === 'Insurances' && insurance) openEditInsurance(insurance)
                          if (activeCategory === 'Lead Properties' && leadProp) openEditLeadProperty(leadProp)
                          if (activeCategory === 'Disclosures' && disclosure) openEditDisclosure(disclosure)
                          if (activeCategory === 'Inventory Costs' && invCost) openEditInventoryCost(invCost)
                        }}
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
                        onClick={() => {
                          if (activeCategory === 'Fees' && fee) requestDeleteFee(fee)
                          if (activeCategory === 'Accessories' && accessory) requestDeleteAccessory(accessory)
                          if (activeCategory === 'Tax Rates' && tax) requestDeleteTax(tax)
                          if (activeCategory === 'Warranties' && warranty) requestDeleteWarranty(warranty)
                          if (activeCategory === 'Insurances' && insurance) requestDeleteInsurance(insurance)
                          if (activeCategory === 'Lead Properties' && leadProp) requestDeleteLeadProperty(leadProp)
                          if (activeCategory === 'Disclosures' && disclosure) requestDeleteDisclosure(disclosure)
                          if (activeCategory === 'Inventory Costs' && invCost) requestDeleteInventoryCost(invCost)
                        }}
                      >
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                          <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M3 6h18" />
                          <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M8 6V4h8v2" />
                          <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M19 6l-1 14H6L5 6" />
                        </svg>
                      </button>
                    </div>
                    {activeCategory === 'Lead Properties' ? (
                      <>
                        <div className="h-10 flex items-center text-xs text-gray-800">{r.name}</div>
                        <div className="h-10 flex items-center text-xs text-gray-800">{r.description || ''}</div>
                        <div className="h-10 flex items-center text-xs text-gray-800">{r.fieldType || ''}</div>
                      </>
                    ) : activeCategory === 'Disclosures' ? (
                      <>
                        <div className="h-10 flex items-center text-xs text-gray-800">{r.name}</div>
                        <div className="h-10 flex items-center text-xs text-gray-800">{r.disclosure || ''}</div>
                        <div className="h-10 flex items-center text-xs text-gray-800">{r.favourite || ''}</div>
                      </>
                    ) : activeCategory === 'Inventory Costs' ? (
                      <>
                        <div className="h-10 flex items-center text-xs text-gray-800">{r.name}</div>
                        <div className="h-10 flex items-center text-xs text-gray-800">{r.groupName || ''}</div>
                        <div className="h-10 flex items-center text-xs text-gray-800">{r.price || ''}</div>
                      </>
                    ) : activeCategory === 'Insurances' ? (
                      <>
                        <div className="h-10 flex items-center text-xs text-gray-800">{r.name}</div>
                        <div className="h-10 flex items-center text-xs text-gray-800">{r.description || ''}</div>
                        <div className="h-10 flex items-center text-xs text-gray-800">{r.duration || ''}</div>
                        <div className="h-10 flex items-center text-xs text-gray-800">{r.deductible || ''}</div>
                        <div className="h-10 flex items-center text-xs text-gray-800">{r.price || ''}</div>
                      </>
                    ) : activeCategory === 'Warranties' ? (
                      <>
                        <div className="h-10 flex items-center text-xs text-gray-800">{r.name}</div>
                        <div className="h-10 flex items-center text-xs text-gray-800">{r.description || ''}</div>
                        <div className="h-10 flex items-center text-xs text-gray-800">{r.distance || ''}</div>
                        <div className="h-10 flex items-center text-xs text-gray-800">{r.duration || ''}</div>
                        <div className="h-10 flex items-center text-xs text-gray-800">{r.deductible || ''}</div>
                        <div className="h-10 flex items-center text-xs text-gray-800">{r.price || ''}</div>
                      </>
                    ) : (
                      <>
                        <div className="h-10 flex items-center text-xs text-gray-800">{r.name}</div>
                        <div className="h-10 flex items-center text-xs text-gray-800">{r.description || ''}</div>
                        <div className="h-10 flex items-center text-xs text-gray-800">{r.amount || ''}</div>
                      </>
                    )}
                  </div>
                )})}
              </div>
            )}
          </div>
        </div>
      </div>

      {isModalOpen ? (
        <ModalShell
          title={
            activeCategory === 'Fees'
              ? editingFeeId
                ? 'Edit Fee'
                : 'New Fee'
              : activeCategory === 'Accessories'
                ? editingAccessoryId
                  ? 'Edit Accessory'
                  : 'New Accessory'
                : activeCategory === 'Warranties'
                  ? editingWarrantyId
                    ? 'Edit Warranty'
                    : 'New Warranty'
                  : activeCategory === 'Insurances'
                    ? editingInsuranceId
                      ? 'Edit Insurance'
                      : 'New Insurance'
                    : activeCategory === 'Tax Rates'
                      ? editingTaxId
                        ? 'Edit Tax Rate'
                        : 'New Tax Rate'
                      : activeCategory === 'Lead Properties'
                        ? editingLeadPropertyId
                          ? 'Edit Lead Property'
                          : 'New Lead Property'
                        : activeCategory === 'Disclosures'
                          ? editingDisclosureId
                            ? 'Edit Disclosure'
                            : 'New Disclosure'
                          : 'New Inventory Cost Template'
          }
          onClose={closeModal}
        >
          {taxPickerOpen ? (
            <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true">
              <div className="absolute inset-0" onMouseDown={() => setTaxPickerOpen(false)} />
              <div className="relative w-[240px] border border-gray-200 bg-white shadow-lg" onMouseDown={(e) => e.stopPropagation()}>
                <div className="p-3 space-y-2">
                  {loadingFeeTaxOptions ? (
                    <div className="py-2 text-xs text-gray-500">Loading…</div>
                  ) : feeTaxOptions.length === 0 ? (
                    <div className="py-2 text-xs text-gray-500">No tax rates found.</div>
                  ) : (
                    feeTaxOptions.map((t) => {
                      const label = `${t.name || ''} ${t.rate == null ? '' : `${t.rate}%`}`.trim()
                      const checked = selectedTaxRates.includes(label)
                      return (
                        <label key={t.id} className="flex items-center gap-2 text-xs text-gray-700">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              const next = e.target.checked
                              setSelectedTaxRates((prev) => {
                                if (next) return prev.includes(label) ? prev : [...prev, label]
                                return prev.filter((x) => x !== label)
                              })
                            }}
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate">{label}</span>
                          </span>
                        </label>
                      )
                    })
                  )}
                </div>
                <div className="p-3 pt-0 flex items-center justify-end">
                  <button type="button" className="h-8 px-4 bg-[#118df0] text-white text-xs font-semibold" onClick={() => setTaxPickerOpen(false)}>
                    Close
                  </button>
                </div>
              </div>
            </div>
          ) : null}

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
                  <button
                    type="button"
                    className="text-[11px] text-[#118df0]"
                    onClick={() => {
                      setTaxPickerOpen(true)
                      void fetchFeeTaxOptions()
                    }}
                  >
                    {selectedTaxRates.length ? `${selectedTaxRates.length} selected` : 'Choose tax rate'} ▾
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
                    <option>Van</option>
                    <option>Mini Van</option>
                    <option>SUV</option>
                    <option>Truck</option>
                  </select>
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-[11px] text-gray-700">Default Tax Rates:</div>
                  <button
                    type="button"
                    className="text-[11px] text-[#118df0]"
                    onClick={() => {
                      setTaxPickerOpen(true)
                      void fetchFeeTaxOptions()
                    }}
                  >
                    {selectedTaxRates.length ? `${selectedTaxRates.length} selected` : 'Choose tax rate'} ▾
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
                  <button
                    type="button"
                    className="text-[11px] text-[#118df0]"
                    onClick={() => {
                      setTaxPickerOpen(true)
                      void fetchFeeTaxOptions()
                    }}
                  >
                    {selectedTaxRates.length ? `${selectedTaxRates.length} selected` : 'Choose tax rate'} ▾
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
                  <button
                    type="button"
                    className="text-[11px] text-[#118df0]"
                    onClick={() => {
                      setTaxPickerOpen(true)
                      void fetchFeeTaxOptions()
                    }}
                  >
                    {selectedTaxRates.length ? `${selectedTaxRates.length} selected` : 'Choose tax rate'} ▾
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
                    onChange={(e) => {
                      const next = e.target.checked
                      setIsDefaultTaxRate(next)
                      if (!next) {
                        setDefaultToSales(false)
                        setDefaultToPurchasesOrCosts(false)
                      }
                    }}
                  />
                  <label htmlFor="defaultTaxRate" className="text-[11px] text-gray-700">
                    Default Tax Rate?
                  </label>
                </div>

                {isDefaultTaxRate ? (
                  <>
                    <div className="flex items-center justify-between">
                      <div className="text-[11px] text-gray-700">Default to sales?</div>
                      <Toggle checked={defaultToSales} onChange={setDefaultToSales} />
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="text-[11px] text-gray-700">Default to purchases or costs?</div>
                      <Toggle checked={defaultToPurchasesOrCosts} onChange={setDefaultToPurchasesOrCosts} />
                    </div>
                  </>
                ) : null}
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
                  <button
                    type="button"
                    className="text-[11px] text-[#118df0]"
                    onClick={() => {
                      setTaxPickerOpen(true)
                      void fetchFeeTaxOptions()
                    }}
                  >
                    {selectedTaxRates.length ? `${selectedTaxRates.length} selected` : 'Choose tax rate'} ▾
                  </button>
                </div>
              </>
            ) : null}
          </div>

          {saveError ? <div className="mt-2 text-[11px] text-red-600">{saveError}</div> : null}

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
              disabled={saving}
              onClick={() => void handleSave()}
              className={
                activeCategory === 'Tax Rates' || activeCategory === 'Lead Properties' || activeCategory === 'Disclosures'
                  ? 'h-7 px-3 bg-green-600 text-white text-xs'
                  : 'h-7 px-3 bg-[#118df0] text-white text-xs'
              }
            >
              {saving
                ? 'Saving…'
                : editingFeeId ||
                    editingTaxId ||
                    editingAccessoryId ||
                    editingWarrantyId ||
                    editingInsuranceId
                  ? 'Update'
                  : 'Save'}
            </button>
          </div>
        </ModalShell>
      ) : null}
    </div>
  )
}
