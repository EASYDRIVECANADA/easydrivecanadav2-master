'use client'

import { useState, useEffect, forwardRef, useImperativeHandle, useRef, useMemo } from 'react'
import { supabase } from '@/lib/supabaseClient'

interface Disclosure {
  id: string
  title: string
  content: string
}

interface DisclosuresTabProps {
  vehicleId: string
  userId?: string | null
  onError?: (message: string) => void
  hideSaveButton?: boolean
}

export interface DisclosuresTabHandle {
  save: () => Promise<boolean>
}

type PresetDisclosureRow = {
  id: string
  user_id: string | null
  name: string | null
  disclosure: string | null
}

const toPlainText = (raw: string) => {
  const html = String(raw || '')
  if (!html.trim()) return ''

  if (typeof window !== 'undefined') {
    const el = window.document.createElement('div')
    el.innerHTML = html
    const decodedText = String(el.textContent || el.innerText || '')
    return decodedText.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
  }

  const decodedText = html
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")

  return decodedText.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}

const NOTES_DISCLOSURE_ID = '__custom_note__'

const DisclosuresTab = forwardRef<DisclosuresTabHandle, DisclosuresTabProps>(function DisclosuresTab({ vehicleId, userId, onError, hideSaveButton }, ref) {
  const [brandType, setBrandType] = useState<'N/A' | 'None' | 'Rebuilt' | 'Salvage' | 'Irreparable'>('N/A')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedDisclosures, setSelectedDisclosures] = useState<Disclosure[]>([])
  const [customNote, setCustomNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [presets, setPresets] = useState<Disclosure[]>([])
  const [loadingPresets, setLoadingPresets] = useState(false)
  const [presetsError, setPresetsError] = useState<string | null>(null)
  const [hasExistingDisclosure, setHasExistingDisclosure] = useState(false)
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
    if (typeof window === 'undefined') return
    try {
      const key = `edc_new_vehicle_disclosures_${String(vehicleId || 'draft')}`
      const raw = window.localStorage.getItem(key)
      if (!raw) return
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed === 'object') {
        if (parsed.brandType) setBrandType(parsed.brandType)
        if (Array.isArray(parsed.selectedDisclosures)) setSelectedDisclosures(parsed.selectedDisclosures)
        if (typeof parsed.customNote === 'string') setCustomNote(parsed.customNote)
      }
    } catch {
      // ignore
    }
  }, [vehicleId])

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const key = `edc_new_vehicle_disclosures_${String(vehicleId || 'draft')}`
      const snapshot = { brandType, selectedDisclosures, customNote }
      window.localStorage.setItem(key, JSON.stringify(snapshot))
    } catch {
      // ignore
    }
  }, [brandType, selectedDisclosures, customNote, vehicleId])

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

  useEffect(() => {
    const checkExisting = async () => {
      const idStr = String(vehicleId || '').trim()
      if (!idStr) return

      const { data } = await supabase
        .from('edc_disclosures')
        .select('*')
        .eq('vehicleId', idStr)
        .maybeSingle()

      if (data) {
        setHasExistingDisclosure(true)
        // Prefill existing data
        if (data.brandtype) setBrandType(data.brandtype as any)
        if (data.disclosures_body) setCustomNote(data.disclosures_body)
      }
    }

    void checkExisting()
  }, [vehicleId])

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      const uid = String(userId || '').trim()
      if (!uid) {
        setPresets([])
        setPresetsError(null)
        setLoadingPresets(false)
        return
      }

      setLoadingPresets(true)
      setPresetsError(null)
      try {
        const { data, error } = await supabase
          .from('presets_disclosures')
          .select('id, user_id, name, disclosure')
          .eq('user_id', uid)
          .order('name', { ascending: true })

        if (error) throw error

        const rows = (Array.isArray(data) ? data : []) as unknown as PresetDisclosureRow[]
        const mapped: Disclosure[] = rows.map((r) => ({
          id: String(r.id),
          title: String(r.name || '').trim(),
          content: toPlainText(String(r.disclosure || '')),
        }))

        if (!cancelled) setPresets(mapped)
      } catch (e: any) {
        if (!cancelled) {
          setPresets([])
          setPresetsError(e?.message || 'Failed to load disclosures')
        }
      } finally {
        if (!cancelled) setLoadingPresets(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [userId])

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

  const removeDisclosureTextFromNotes = (disclosureId: string) => {
    const el = editorRef.current
    if (!el) return
    try {
      const nodes = Array.from(el.querySelectorAll('[data-disclosure-id]'))
      for (const n of nodes) {
        if ((n as HTMLElement).getAttribute('data-disclosure-id') === disclosureId) {
          n.remove()
        }
      }
      setCustomNote(el.innerHTML)
    } catch {
      // ignore
    }
  }

  const appendToNotes = (text: string, disclosureId?: string) => {
    const t = String(text || '').trim()
    if (!t) return
    const parts = t.split(/\n+/g).map(s => s.trim()).filter(Boolean)
    const body = parts.map(p => `<div>${escapeHtml(p)}</div>`).join('') + '<div><br/></div>'
    const html = disclosureId ? `<div data-disclosure-id="${escapeHtml(disclosureId)}">${body}</div>` : body
    insertHtmlAtCursor(html)
  }

  const handleAddDisclosure = (disclosure: Disclosure) => {
    if (!selectedDisclosures.find(d => d.id === disclosure.id)) {
      setSelectedDisclosures([...selectedDisclosures, disclosure])
    }
    appendToNotes(getDisclosureText(disclosure), String(disclosure.id))
  }

  const handleRemoveDisclosure = (id: string) => {
    setSelectedDisclosures(selectedDisclosures.filter(d => d.id !== id))
    removeDisclosureTextFromNotes(id)
  }

  const handleSave = async (): Promise<boolean> => {
    setSaving(true)
    try {
      const payloadDisclosures: Disclosure[] = [
        ...selectedDisclosures,
        { id: NOTES_DISCLOSURE_ID, title: 'Notes', content: customNote || '' },
      ]

      const idStr = String(vehicleId || '').trim()
      if (!idStr) {
        onError?.('Missing vehicle ID. Please save Vehicle Details first to generate the vehicle and try again.')
        return false
      }

      // Prepare disclosure data for database
      const disclosuresTitle = payloadDisclosures.map(d => d.title).join(', ')
      const disclosuresBody = payloadDisclosures.map(d => d.content).join('\n\n')

      // Check if disclosure record exists by vehicleId
      const { data: existingData } = await supabase
        .from('edc_disclosures')
        .select('id')
        .eq('vehicleId', idStr)
        .maybeSingle()

      if (existingData?.id) {
        // Update existing disclosure
        const { error: updateError } = await supabase
          .from('edc_disclosures')
          .update({
            brandtype: brandType,
            disclosures_title: disclosuresTitle,
            disclosures_body: disclosuresBody,
            user_id: userId || null,
          })
          .eq('id', existingData.id)

        if (updateError) throw new Error(updateError.message || 'Failed to update disclosures')
      } else {
        // Insert new disclosure
        const { error: insertError } = await supabase
          .from('edc_disclosures')
          .insert({
            vehicleId: idStr,
            brandtype: brandType,
            disclosures_title: disclosuresTitle,
            disclosures_body: disclosuresBody,
            user_id: userId || null,
            created_at: new Date().toISOString(),
          })

        if (insertError) throw new Error(insertError.message || 'Failed to insert disclosures')
        setHasExistingDisclosure(true)
      }

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

  const filteredPresets = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return presets
    return presets.filter((d) => String(d.title || '').toLowerCase().includes(q))
  }, [presets, searchQuery])

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
            {loadingPresets ? (
              <div className="p-3 text-sm text-gray-500">Loading…</div>
            ) : presetsError ? (
              <div className="p-3 text-sm text-red-600">{presetsError}</div>
            ) : filteredPresets.length === 0 ? (
              <div className="p-3 text-sm text-gray-500">No disclosures found.</div>
            ) : (
              filteredPresets.map((preset) => (
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
              ))
            )}
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

      {/* Save/Update Button */}
      {!hideSaveButton && (
        <div className="mt-6">
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-[#118df0] text-white py-3 rounded-lg font-semibold hover:bg-[#0d6ebd] transition-colors disabled:opacity-50"
          >
            {saving ? (hasExistingDisclosure ? 'Updating...' : 'Saving...') : (hasExistingDisclosure ? 'Update Disclosures' : 'Save Disclosures')}
          </button>
        </div>
      )}
    </div>
  )
})

export default DisclosuresTab
