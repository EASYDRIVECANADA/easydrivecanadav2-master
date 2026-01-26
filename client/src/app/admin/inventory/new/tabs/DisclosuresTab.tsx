'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'

interface Disclosure {
  id: string
  title: string
  content: string
}

interface DisclosuresTabProps {
  vehicleId: string
}

const PRESET_DISCLOSURES = [
  { id: '1', title: 'The vehicle was previously from another Province', content: '' },
  { id: '2', title: 'Customer Acknowledgement Clause', content: 'The Buyer confirms that they have inspected the vehicle, provided the car fax report, reviewed the Bill of Sale, test-driven the vehicle with a salesperson, explained all questions, including the bill of sale, by the salesperson, and had all questions answered to their satisfaction. The Buyer agrees to proceed with the purchase and accepts the vehicle in its current condition.' },
  { id: '3', title: 'As-Is Condition', content: 'This vehicle is sold as-is, where-is, with all faults and defects.' },
  { id: '4', title: 'Odometer Disclosure', content: 'The odometer reading is believed to be accurate to the best of our knowledge.' },
  { id: '5', title: 'Previous Damage Disclosure', content: 'This vehicle has been in a previous accident and has been repaired.' },
]

export default function DisclosuresTab({ vehicleId }: DisclosuresTabProps) {
  const [brandType, setBrandType] = useState<'N/A' | 'None' | 'Rebuilt' | 'Salvage' | 'Irreparable'>('N/A')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedDisclosures, setSelectedDisclosures] = useState<Disclosure[]>([])
  const [customNote, setCustomNote] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchDisclosures()
  }, [vehicleId])

  const fetchDisclosures = async () => {
    try {
      const { data, error } = await supabase
        .from('edc_vehicles')
        .select('disclosures, brand_type')
        .eq('id', vehicleId)
        .maybeSingle()

      if (data) {
        if (data.brand_type) setBrandType(data.brand_type)
        if (data.disclosures && Array.isArray(data.disclosures)) {
          setSelectedDisclosures(data.disclosures)
        }
      }
    } catch (error) {
      console.error('Error fetching disclosures:', error)
    }
  }

  const handleAddDisclosure = (disclosure: Disclosure) => {
    if (!selectedDisclosures.find(d => d.id === disclosure.id)) {
      setSelectedDisclosures([...selectedDisclosures, disclosure])
    }
  }

  const handleRemoveDisclosure = (id: string) => {
    setSelectedDisclosures(selectedDisclosures.filter(d => d.id !== id))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const { error } = await supabase
        .from('edc_vehicles')
        .update({
          brand_type: brandType,
          disclosures: selectedDisclosures,
        })
        .eq('id', vehicleId)

      if (error) throw error
      alert('Disclosures saved successfully!')
    } catch (error) {
      console.error('Error saving disclosures:', error)
      alert('Error saving disclosures')
    } finally {
      setSaving(false)
    }
  }

  const filteredPresets = PRESET_DISCLOSURES.filter(d =>
    d.title.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="bg-white rounded-xl shadow p-6">
      {/* Info Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <p className="text-sm text-blue-800">
          The disclosure builder tool enables you to quickly add common disclosures to your vehicle. 
          You can search for a disclosure using the search box. Simply drag-n-drop it into the notes box 
          and the disclosure will automatically be applied. You can create additional custom disclosures 
          from the settings → presets tab.
        </p>
      </div>

      {/* Brand Type */}
      <div className="mb-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Disclosures</h3>
        <div className="flex items-center gap-2 mb-4">
          <span className="text-sm text-gray-600">Brand Type:</span>
          <div className="flex gap-4">
            {(['N/A', 'None', 'Rebuilt', 'Salvage', 'Irreparable'] as const).map((type) => (
              <label key={type} className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="brandType"
                  value={type}
                  checked={brandType === type}
                  onChange={() => setBrandType(type)}
                  className="w-4 h-4 text-[#118df0] focus:ring-[#118df0]"
                />
                <span className="text-sm text-gray-700">{type}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Search & Presets */}
        <div>
          <div className="mb-4">
            <input
              type="text"
              placeholder="Search disclosures..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent"
            />
          </div>

          <div className="border border-gray-200 rounded-lg max-h-80 overflow-y-auto">
            {filteredPresets.map((preset) => (
              <div key={preset.id} className="p-3 border-b border-gray-100 last:border-b-0 hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-700">{preset.title}</span>
                  <button
                    onClick={() => handleAddDisclosure(preset)}
                    className="bg-[#118df0] text-white text-xs px-3 py-1 rounded hover:bg-[#0d6ebd] transition-colors"
                  >
                    Add
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Selected Disclosures */}
          <div className="mt-4">
            <h4 className="text-sm font-medium text-gray-700 mb-2">Selected Disclosures</h4>
            {selectedDisclosures.length === 0 ? (
              <p className="text-sm text-gray-500">No disclosures selected</p>
            ) : (
              <div className="space-y-2">
                {selectedDisclosures.map((disclosure) => (
                  <div key={disclosure.id} className="flex items-center justify-between bg-gray-50 p-2 rounded-lg">
                    <span className="text-sm text-gray-700">{disclosure.title}</span>
                    <button
                      onClick={() => handleRemoveDisclosure(disclosure.id)}
                      className="text-red-500 hover:text-red-700 text-xs"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Notes Editor */}
        <div>
          <div className="border border-gray-200 rounded-lg">
            <div className="flex items-center gap-1 p-2 border-b border-gray-200 bg-gray-50">
              <button className="p-1.5 hover:bg-gray-200 rounded" title="Bold">
                <span className="font-bold text-sm">B</span>
              </button>
              <button className="p-1.5 hover:bg-gray-200 rounded" title="Italic">
                <span className="italic text-sm">I</span>
              </button>
              <button className="p-1.5 hover:bg-gray-200 rounded" title="Underline">
                <span className="underline text-sm">U</span>
              </button>
              <span className="w-px h-5 bg-gray-300 mx-1"></span>
              <button className="p-1.5 hover:bg-gray-200 rounded" title="Strikethrough">
                <span className="line-through text-sm">S</span>
              </button>
            </div>
            <textarea
              value={customNote}
              onChange={(e) => setCustomNote(e.target.value)}
              placeholder="Add custom notes or drag disclosures here..."
              rows={10}
              className="w-full p-4 focus:outline-none resize-none"
            />
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="mt-6">
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-[#118df0] text-white py-3 rounded-lg font-semibold hover:bg-[#0d6ebd] transition-colors disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Disclosures'}
        </button>
      </div>
    </div>
  )
}
