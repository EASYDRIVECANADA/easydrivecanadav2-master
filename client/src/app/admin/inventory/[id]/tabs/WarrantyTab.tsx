'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'

type WarrantyPresetRow = {
  id: string
  name: string | null
}

interface WarrantyData {
  hasWarranty: boolean
  warrantyType?: string
  warrantyProvider?: string
  warrantyStartDate?: string
  warrantyEndDate?: string
  warrantyMileageLimit?: number
  warrantyDescription?: string
  warrantyTerms?: string
  warrantyContact?: string
  warrantyPhone?: string
  warrantyEmail?: string
  warrantyClaimProcess?: string
  extendedWarranty?: boolean
  extendedWarrantyProvider?: string
  extendedWarrantyEndDate?: string
  extendedWarrantyMileageLimit?: number
  extendedWarrantyCost?: number
}

interface WarrantyTabProps {
  vehicleId: string
}

export default function WarrantyTab({ vehicleId }: WarrantyTabProps) {
  const [warrantyData, setWarrantyData] = useState<WarrantyData>({
    hasWarranty: false,
    extendedWarranty: false,
  })
  const [warrantyRowExists, setWarrantyRowExists] = useState(false)
  const [saving, setSaving] = useState(false)
  const [resultModalOpen, setResultModalOpen] = useState(false)
  const [resultModalTitle, setResultModalTitle] = useState('')
  const [resultModalMessage, setResultModalMessage] = useState('')
  const [warrantyPresets, setWarrantyPresets] = useState<WarrantyPresetRow[]>([])
  const [loadingWarrantyPresets, setLoadingWarrantyPresets] = useState(false)

  const formatAnyError = (err: any) => {
    if (!err) return ''
    if (err instanceof Error) return err.message
    const msg = typeof err?.message === 'string' ? err.message : ''
    const details = typeof err?.details === 'string' ? err.details : ''
    const hint = typeof err?.hint === 'string' ? err.hint : ''
    const code = typeof err?.code === 'string' ? err.code : ''
    const parts = [msg, details, hint, code ? `code: ${code}` : ''].filter(Boolean)
    if (parts.length) return parts.join(' | ')
    try {
      return JSON.stringify(err)
    } catch {
      return String(err)
    }
  }

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

  useEffect(() => {
    fetchWarrantyData()
  }, [vehicleId])

  useEffect(() => {
    const load = async () => {
      setLoadingWarrantyPresets(true)
      try {
        const scopedUserId = await getLoggedInAdminDbUserId()
        if (!scopedUserId) {
          setWarrantyPresets([])
          return
        }

        const { data, error } = await supabase
          .from('presets_warranty')
          .select('id, name')
          .eq('user_id', scopedUserId)
          .order('name', { ascending: true })

        if (error) throw error
        const rows = Array.isArray(data) ? (data as WarrantyPresetRow[]) : []
        setWarrantyPresets(rows)
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        console.error('Error loading warranty presets:', msg)
        setWarrantyPresets([])
      } finally {
        setLoadingWarrantyPresets(false)
      }
    }

    void load()
  }, [])

  useEffect(() => {
    if (!warrantyPresets.length) return
    setWarrantyData((prev) => {
      const current = String(prev.warrantyType || '').trim()
      const hasCurrent = current && warrantyPresets.some((w) => String(w.name || '').trim() === current)
      if (hasCurrent) return prev
      const first = warrantyPresets.find((w) => String(w.name || '').trim())
      const nextName = String(first?.name || '').trim()
      if (!nextName) return prev
      return { ...prev, warrantyType: nextName }
    })
  }, [warrantyPresets])

  const fetchWarrantyData = async () => {
    try {
      const { data, error } = await supabase
        .from('edc_warranty')
        .select('*')
        .eq('vehicle_id', vehicleId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (error) return
      if (!data) return

      setWarrantyRowExists(true)

      setWarrantyData((prev) => ({
        ...prev,
        hasWarranty: Boolean((data as any).has_warranty ?? prev.hasWarranty),
        warrantyType: (data as any).warranty_type ?? prev.warrantyType,
        warrantyProvider: (data as any).warranty_provider ?? prev.warrantyProvider,
        warrantyStartDate: (data as any).warranty_start_date ?? prev.warrantyStartDate,
        warrantyEndDate: (data as any).warranty_end_date ?? prev.warrantyEndDate,
        warrantyMileageLimit: (data as any).warranty_mileage_limit ?? prev.warrantyMileageLimit,
        warrantyDescription: (data as any).warranty_description ?? prev.warrantyDescription,
        warrantyTerms: (data as any).warranty_terms ?? prev.warrantyTerms,
        warrantyContact: (data as any).warranty_contact ?? prev.warrantyContact,
        warrantyPhone: (data as any).warranty_phone ?? prev.warrantyPhone,
        warrantyEmail: (data as any).warranty_email ?? prev.warrantyEmail,
        warrantyClaimProcess: (data as any).warranty_claim_process ?? prev.warrantyClaimProcess,
        extendedWarranty: Boolean((data as any).extended_warranty ?? prev.extendedWarranty),
        extendedWarrantyProvider: (data as any).extended_warranty_provider ?? prev.extendedWarrantyProvider,
        extendedWarrantyEndDate: (data as any).extended_warranty_end_date ?? prev.extendedWarrantyEndDate,
        extendedWarrantyMileageLimit: (data as any).extended_warranty_mileage_limit ?? prev.extendedWarrantyMileageLimit,
        extendedWarrantyCost: (data as any).extended_warranty_cost ?? prev.extendedWarrantyCost,
      }))
    } catch (error) {
      console.error('Error fetching warranty data:', error)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target
    const checked = (e.target as HTMLInputElement).checked
    setWarrantyData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const user_id = await getLoggedInAdminDbUserId()
      const fullWarranty: Record<string, any> = {
        hasWarranty: warrantyData.hasWarranty ?? false,
        warrantyType: warrantyData.warrantyType ?? null,
        warrantyProvider: warrantyData.warrantyProvider ?? null,
        warrantyStartDate: warrantyData.warrantyStartDate ?? null,
        warrantyEndDate: warrantyData.warrantyEndDate ?? null,
        warrantyMileageLimit: warrantyData.warrantyMileageLimit ?? null,
        warrantyDescription: warrantyData.warrantyDescription ?? null,
        warrantyTerms: warrantyData.warrantyTerms ?? null,
        warrantyContact: warrantyData.warrantyContact ?? null,
        warrantyPhone: warrantyData.warrantyPhone ?? null,
        warrantyEmail: warrantyData.warrantyEmail ?? null,
        warrantyClaimProcess: warrantyData.warrantyClaimProcess ?? null,
        extendedWarranty: warrantyData.extendedWarranty ?? false,
        extendedWarrantyProvider: warrantyData.extendedWarrantyProvider ?? null,
        extendedWarrantyEndDate: warrantyData.extendedWarrantyEndDate ?? null,
        extendedWarrantyMileageLimit: warrantyData.extendedWarrantyMileageLimit ?? null,
        extendedWarrantyCost: warrantyData.extendedWarrantyCost ?? null,
      }

      const res = await fetch('/api/warranty', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user_id ?? null,
          vehicleId: String(vehicleId),
          action: warrantyRowExists ? 'edit' : 'create',
          warranty_data: fullWarranty,
        }),
      })

      const text = await res.text().catch(() => '')
      if (!res.ok) throw new Error(text || `Webhook responded with ${res.status}`)

      const webhookMessage = text || 'done'

      setResultModalTitle('Warranty Saved')
      setResultModalMessage(webhookMessage)
      setResultModalOpen(true)

      if (webhookMessage.toLowerCase().includes('done')) {
        setWarrantyRowExists(true)
      }
    } catch (error) {
      console.error('Error saving warranty data:', error)
      const msg = formatAnyError(error)
      setResultModalTitle('Save Failed')
      setResultModalMessage(msg || 'Error saving warranty information')
      setResultModalOpen(true)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-white rounded-xl shadow p-6">
      {resultModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">{resultModalTitle}</h3>
              <button
                onClick={() => setResultModalOpen(false)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="px-6 py-5">
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{resultModalMessage}</p>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 bg-gray-50">
              <button
                onClick={() => setResultModalOpen(false)}
                className="w-full bg-[#118df0] text-white py-2.5 rounded-lg font-semibold hover:bg-[#0d6ebd] transition-colors"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
      <h2 className="text-lg font-semibold text-gray-900 mb-6">Warranty Information</h2>

      {/* Has Warranty Toggle */}
      <div className="flex items-center gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            name="hasWarranty"
            checked={warrantyData.hasWarranty}
            onChange={handleChange}
            className="w-5 h-5 text-[#118df0] focus:ring-[#118df0] rounded"
          />
          <span className="text-sm font-medium text-gray-700">This vehicle has a warranty</span>
        </label>
      </div>

      {warrantyData.hasWarranty && (
        <>
          {/* Basic Warranty Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Warranty Type</label>
              <select
                name="warrantyType"
                value={warrantyData.warrantyType || ''}
                onChange={handleChange}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent"
              >
                {loadingWarrantyPresets ? (
                  <option value="">Loading...</option>
                ) : warrantyPresets.length ? (
                  warrantyPresets
                    .filter((w) => String(w.name || '').trim())
                    .map((w) => {
                      const name = String(w.name || '').trim()
                      return (
                        <option key={w.id} value={name}>
                          {name}
                        </option>
                      )
                    })
                ) : (
                  <option value="">No warranty presets</option>
                )}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Warranty Provider</label>
              <input
                type="text"
                name="warrantyProvider"
                value={warrantyData.warrantyProvider || ''}
                onChange={handleChange}
                placeholder="e.g., Toyota, Honda, etc."
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
              <input
                type="date"
                name="warrantyStartDate"
                value={warrantyData.warrantyStartDate || ''}
                onChange={handleChange}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
              <input
                type="date"
                name="warrantyEndDate"
                value={warrantyData.warrantyEndDate || ''}
                onChange={handleChange}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Mileage Limit (km)</label>
              <input
                type="number"
                name="warrantyMileageLimit"
                value={warrantyData.warrantyMileageLimit || ''}
                onChange={handleChange}
                placeholder="e.g., 100000"
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent"
              />
            </div>
          </div>

          {/* Warranty Description */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-1">Warranty Description</label>
            <textarea
              name="warrantyDescription"
              value={warrantyData.warrantyDescription || ''}
              onChange={handleChange}
              rows={3}
              placeholder="Describe what the warranty covers..."
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent"
            />
          </div>

          {/* Terms & Conditions */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-1">Terms & Conditions</label>
            <textarea
              name="warrantyTerms"
              value={warrantyData.warrantyTerms || ''}
              onChange={handleChange}
              rows={3}
              placeholder="Enter warranty terms and conditions..."
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent"
            />
          </div>

          {/* Contact Information */}
          <div className="border-t border-gray-200 pt-6 mb-6">
            <h3 className="text-md font-semibold text-gray-900 mb-4">Warranty Contact Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Contact Name</label>
                <input
                  type="text"
                  name="warrantyContact"
                  value={warrantyData.warrantyContact || ''}
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input
                  type="tel"
                  name="warrantyPhone"
                  value={warrantyData.warrantyPhone || ''}
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  name="warrantyEmail"
                  value={warrantyData.warrantyEmail || ''}
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent"
                />
              </div>
            </div>
          </div>

          {/* Claim Process */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-1">Claim Process</label>
            <textarea
              name="warrantyClaimProcess"
              value={warrantyData.warrantyClaimProcess || ''}
              onChange={handleChange}
              rows={3}
              placeholder="Describe the warranty claim process..."
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent"
            />
          </div>

          {/* Extended Warranty Section */}
          <div className="border-t border-gray-200 pt-6">
            <div className="flex items-center gap-4 mb-4 p-4 bg-blue-50 rounded-lg">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  name="extendedWarranty"
                  checked={warrantyData.extendedWarranty || false}
                  onChange={handleChange}
                  className="w-5 h-5 text-[#118df0] focus:ring-[#118df0] rounded"
                />
                <span className="text-sm font-medium text-gray-700">Extended Warranty Available</span>
              </label>
            </div>

            {warrantyData.extendedWarranty && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Extended Warranty Provider</label>
                  <input
                    type="text"
                    name="extendedWarrantyProvider"
                    value={warrantyData.extendedWarrantyProvider || ''}
                    onChange={handleChange}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Extended Warranty End Date</label>
                  <input
                    type="date"
                    name="extendedWarrantyEndDate"
                    value={warrantyData.extendedWarrantyEndDate || ''}
                    onChange={handleChange}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Extended Mileage Limit (km)</label>
                  <input
                    type="number"
                    name="extendedWarrantyMileageLimit"
                    value={warrantyData.extendedWarrantyMileageLimit || ''}
                    onChange={handleChange}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Extended Warranty Cost ($)</label>
                  <input
                    type="number"
                    name="extendedWarrantyCost"
                    value={warrantyData.extendedWarrantyCost || ''}
                    onChange={handleChange}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent"
                  />
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {!warrantyData.hasWarranty && (
        <div className="text-center py-8 text-gray-500">
          <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          <p>No warranty information for this vehicle.</p>
          <p className="text-sm mt-2">Check the box above to add warranty details.</p>
        </div>
      )}

      {/* Save Button */}
      <div className="mt-6">
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-[#118df0] text-white py-3 rounded-lg font-semibold hover:bg-[#0d6ebd] transition-colors disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Warranty Information'}
        </button>
      </div>
    </div>
  )
}
