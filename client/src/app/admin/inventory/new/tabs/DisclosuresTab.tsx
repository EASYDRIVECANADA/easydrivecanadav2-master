'use client'

import { useState, useEffect, forwardRef, useImperativeHandle, useRef } from 'react'

interface Disclosure {
  id: string
  title: string
  content: string
}

interface DisclosuresTabProps {
  vehicleId: string
  userId?: string | null
  vehicleData?: any
  onError?: (message: string) => void
  hideSaveButton?: boolean
}

export interface DisclosuresTabHandle {
  save: () => Promise<boolean>
}

const PRESET_DISCLOSURES = [
  { id: '1', title: 'The vehicle was previously from another Province', content: '' },
  { id: '2', title: 'Customer Acknowledgement Clause', content: 'The Buyer confirms that they have inspected the vehicle, provided the car fax report, reviewed the Bill of Sale, test-driven the vehicle with a salesperson, explained all questions, including the bill of sale, by the salesperson, and had all questions answered to their satisfaction. The Buyer agrees to proceed with the purchase and accepts the vehicle in its current condition.' },
  { id: '3', title: 'As-Is Condition', content: 'This vehicle is sold as-is, where-is, with all faults and defects.' },
  { id: '4', title: 'Odometer Disclosure', content: 'The odometer reading is believed to be accurate to the best of our knowledge.' },
  { id: '5', title: 'Previous Damage Disclosure', content: 'This vehicle has been in a previous accident and has been repaired.' },
]

const NOTES_DISCLOSURE_ID = '__custom_note__'

const DisclosuresTab = forwardRef<DisclosuresTabHandle, DisclosuresTabProps>(function DisclosuresTab({ vehicleId, userId, vehicleData, onError, hideSaveButton }, ref) {
  const [brandType, setBrandType] = useState<'N/A' | 'None' | 'Rebuilt' | 'Salvage' | 'Irreparable'>('N/A')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedDisclosures, setSelectedDisclosures] = useState<Disclosure[]>([])
  const [customNote, setCustomNote] = useState('')
  const [saving, setSaving] = useState(false)
  const editorRef = useRef<HTMLDivElement | null>(null)
  const [toolbarState, setToolbarState] = useState({
    bold: false,
    italic: false,
    underline: false,
    strike: false,
    ul: false,
    ol: false,
    left: false,
    center: false,
    right: false,
  })

  useImperativeHandle(ref, () => ({
    save: handleSave,
  }))

  useEffect(() => {
    const el = editorRef.current
    if (!el) return
    const active = typeof document !== 'undefined' ? document.activeElement : null
    if (active === el) return
    if (el.innerHTML !== (customNote || '')) {
      el.innerHTML = customNote || ''
    }
  }, [customNote])

  const refreshToolbarState = () => {
    try {
      setToolbarState({
        bold: document.queryCommandState('bold'),
        italic: document.queryCommandState('italic'),
        underline: document.queryCommandState('underline'),
        strike: document.queryCommandState('strikeThrough'),
        ul: document.queryCommandState('insertUnorderedList'),
        ol: document.queryCommandState('insertOrderedList'),
        left: document.queryCommandState('justifyLeft'),
        center: document.queryCommandState('justifyCenter'),
        right: document.queryCommandState('justifyRight'),
      })
    } catch {}
  }

  useEffect(() => {
    const onSel = () => refreshToolbarState()
    document.addEventListener('selectionchange', onSel)
    return () => document.removeEventListener('selectionchange', onSel)
  }, [])

  const escapeHtml = (s: string) =>
    String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')

  const insertHtmlAtCursor = (html: string) => {
    const el = editorRef.current
    if (!el) return
    el.focus()
    try {
      document.execCommand('insertHTML', false, html)
    } catch {
      el.innerHTML = `${el.innerHTML || ''}${html}`
    }
    setCustomNote(el.innerHTML)
  }

  const runCmd = (cmd: string, value?: string) => {
    const el = editorRef.current
    if (!el) return
    el.focus()
    try {
      document.execCommand(cmd, false, value)
    } catch {}
    setCustomNote(el.innerHTML)
    refreshToolbarState()
  }

  const getDisclosureText = (d: Disclosure) => {
    const title = String(d.title || '').trim()
    const content = String(d.content || '').trim()
    if (content) return `${title}\n${content}`.trim()
    return title
  }

  const appendToNotes = (text: string) => {
    const t = String(text || '').trim()
    if (!t) return
    const parts = t.split(/\n+/g).map(s => s.trim()).filter(Boolean)
    const html = parts.map(p => `<div>${escapeHtml(p)}</div>`).join('') + '<div><br/></div>'
    insertHtmlAtCursor(html)
  }

  const handleAddDisclosure = (disclosure: Disclosure) => {
    if (!selectedDisclosures.find(d => d.id === disclosure.id)) {
      setSelectedDisclosures([...selectedDisclosures, disclosure])
    }
    appendToNotes(getDisclosureText(disclosure))
  }

  const handleRemoveDisclosure = (id: string) => {
    setSelectedDisclosures(selectedDisclosures.filter(d => d.id !== id))
  }

  const handleSave = async (): Promise<boolean> => {
    setSaving(true)
    try {
      if (!vehicleId) return false
      const payloadDisclosures: Disclosure[] = [
        ...selectedDisclosures,
        { id: NOTES_DISCLOSURE_ID, title: 'Notes', content: customNote || '' },
      ]

      const stockNumberRaw = vehicleData && typeof vehicleData === 'object' ? (vehicleData as any).stockNumber : undefined
      const stockNumber = typeof stockNumberRaw === 'string' ? (stockNumberRaw.trim() || null) : stockNumberRaw ?? null

      const webhookBody = {
        user_id: userId ?? null,
        vehicleId,
        stockNumber,
        brandType,
        disclosures: payloadDisclosures,
      }

      const res = await fetch('/api/disclosures', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(webhookBody),
      })

      const text = await res.text().catch(() => '')
      if (!res.ok) throw new Error(text || `Webhook responded with ${res.status}`)
      if (!String(text).toLowerCase().includes('done')) throw new Error(text || 'Webhook did not return done')

      alert('Disclosures saved successfully!')
      return true
    } catch (error) {
      const msg = typeof (error as any)?.message === 'string' ? String((error as any).message) : ''
      onError?.(msg || 'Error saving disclosures')
      console.error('Error saving disclosures:', error)
      return false
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
              <div
                key={preset.id}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.effectAllowed = 'copy'
                  e.dataTransfer.setData('text/plain', getDisclosureText(preset))
                  e.dataTransfer.setData('application/json', JSON.stringify(preset))
                }}
                className="p-3 border-b border-gray-100 last:border-b-0 hover:bg-gray-50"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-700">{preset.title}</span>
                  <button
                    type="button"
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
                      type="button"
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
          <div className="border border-gray-300 rounded-lg">
            <div className="flex flex-wrap items-center gap-1 p-2 border-b border-gray-300 bg-gray-50">
              <button type="button" onClick={() => runCmd('bold')} className={`px-2 py-1 border border-gray-300 rounded text-sm font-bold ${toolbarState.bold ? 'bg-[#118df0] text-white' : 'bg-white'}`}>B</button>
              <button type="button" onClick={() => runCmd('italic')} className={`px-2 py-1 border border-gray-300 rounded text-sm italic ${toolbarState.italic ? 'bg-[#118df0] text-white' : 'bg-white'}`}>I</button>
              <button type="button" onClick={() => runCmd('underline')} className={`px-2 py-1 border border-gray-300 rounded text-sm underline ${toolbarState.underline ? 'bg-[#118df0] text-white' : 'bg-white'}`}>U</button>
              <button type="button" onClick={() => runCmd('strikeThrough')} className={`px-2 py-1 border border-gray-300 rounded text-sm line-through ${toolbarState.strike ? 'bg-[#118df0] text-white' : 'bg-white'}`}>S</button>
              <span className="w-px h-6 bg-gray-300 mx-1"></span>
              <button type="button" onClick={() => runCmd('insertUnorderedList')} className={`px-2 py-1 border border-gray-300 rounded text-sm ${toolbarState.ul ? 'bg-[#118df0] text-white' : 'bg-white'}`}>•</button>
              <button type="button" onClick={() => runCmd('insertOrderedList')} className={`px-2 py-1 border border-gray-300 rounded text-sm ${toolbarState.ol ? 'bg-[#118df0] text-white' : 'bg-white'}`}>1.</button>
              <span className="w-px h-6 bg-gray-300 mx-1"></span>
              <button type="button" onClick={() => runCmd('justifyLeft')} className={`px-2 py-1 border border-gray-300 rounded text-sm ${toolbarState.left ? 'bg-[#118df0] text-white' : 'bg-white'}`}>≡</button>
              <button type="button" onClick={() => runCmd('justifyCenter')} className={`px-2 py-1 border border-gray-300 rounded text-sm ${toolbarState.center ? 'bg-[#118df0] text-white' : 'bg-white'}`}>≣</button>
              <button type="button" onClick={() => runCmd('justifyRight')} className={`px-2 py-1 border border-gray-300 rounded text-sm ${toolbarState.right ? 'bg-[#118df0] text-white' : 'bg-white'}`}>≡</button>
              <span className="w-px h-6 bg-gray-300 mx-1"></span>
              <select
                value=""
                onChange={(e) => {
                  const v = e.target.value
                  if (v) runCmd('fontSize', v)
                  e.target.value = ''
                }}
                className="border border-gray-300 bg-white rounded px-2 py-1 text-sm"
              >
                <option value="">Size</option>
                <option value="1">10</option>
                <option value="2">13</option>
                <option value="3">16</option>
                <option value="4">18</option>
                <option value="5">24</option>
                <option value="6">32</option>
                <option value="7">48</option>
              </select>
              <input
                type="color"
                onChange={(e) => runCmd('foreColor', e.target.value)}
                className="w-8 h-8 p-0 border border-gray-300 bg-white rounded"
              />
              <button type="button" onClick={() => runCmd('removeFormat')} className="px-2 py-1 border border-gray-300 bg-white rounded text-sm">Tx</button>
              <button
                type="button"
                onClick={() => {
                  const html = `<pre>${escapeHtml(editorRef.current?.innerHTML ? editorRef.current?.innerText || '' : '')}</pre>`
                  insertHtmlAtCursor(html)
                }}
                className="px-2 py-1 border border-gray-300 bg-white rounded text-sm"
              >
                &lt;/&gt;
              </button>
            </div>
            <div
              ref={editorRef}
              contentEditable
              suppressContentEditableWarning
              onInput={() => {
                setCustomNote(editorRef.current?.innerHTML || '')
                refreshToolbarState()
              }}
              onMouseUp={refreshToolbarState}
              onKeyUp={refreshToolbarState}
              onDragOver={(e) => {
                e.preventDefault()
                e.dataTransfer.dropEffect = 'copy'
              }}
              onDrop={(e) => {
                e.preventDefault()
                const json = e.dataTransfer.getData('application/json')
                if (json) {
                  try {
                    const d = JSON.parse(json)
                    if (d?.id) {
                      handleAddDisclosure(d)
                      return
                    }
                  } catch {}
                }
                const text = e.dataTransfer.getData('text/plain')
                if (text) appendToNotes(text)
              }}
              className="w-full min-h-[420px] p-4 focus:outline-none bg-white overflow-auto"
            ></div>
          </div>
        </div>
      </div>

      {/* Save Button */}
      {!hideSaveButton && (
        <div className="mt-6">
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-[#118df0] text-white py-3 rounded-lg font-semibold hover:bg-[#0d6ebd] transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Disclosures'}
          </button>
        </div>
      )}
    </div>
  )
})

export default DisclosuresTab
