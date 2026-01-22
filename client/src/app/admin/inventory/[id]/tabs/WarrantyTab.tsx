'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'

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
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchWarrantyData()
  }, [vehicleId])

  const fetchWarrantyData = async () => {
    try {
      const { data, error } = await supabase
        .from('edc_vehicles')
        .select('warranty_data')
        .eq('id', vehicleId)
        .maybeSingle()

      if (data?.warranty_data) {
        setWarrantyData(data.warranty_data)
      }
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
      const { error } = await supabase
        .from('edc_vehicles')
        .update({ warranty_data: warrantyData })
        .eq('id', vehicleId)

      if (error) throw error
      alert('Warranty information saved successfully!')
    } catch (error) {
      console.error('Error saving warranty data:', error)
      alert('Error saving warranty information')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-white rounded-xl shadow p-6">
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
                <option value="">Select type...</option>
                <option value="manufacturer">Manufacturer Warranty</option>
                <option value="dealer">Dealer Warranty</option>
                <option value="third-party">Third-Party Warranty</option>
                <option value="powertrain">Powertrain Warranty</option>
                <option value="bumper-to-bumper">Bumper-to-Bumper</option>
                <option value="certified-preowned">Certified Pre-Owned</option>
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
