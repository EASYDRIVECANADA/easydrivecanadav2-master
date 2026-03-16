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
    // Step 1: decode HTML entities into text
    const el = window.document.createElement('div')
    el.innerHTML = html
    const decodedText = String(el.textContent || el.innerText || '')
    // Step 2: remove any tag-like remnants that came from encoded HTML
    return decodedText.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
  }

  // SSR fallback
  const decodedText = html
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")

  return decodedText.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}

const NOTES_DISCLOSURE_ID = '__custom_note__'

const DisclosuresTab = forwardRef<DisclosuresTabHandle, DisclosuresTabProps>(function DisclosuresTab({ vehicleId, hideSaveButton }, ref) {
  const [brandType, setBrandType] = useState<'N/A' | 'None' | 'Rebuilt' | 'Salvage' | 'Irreparable'>('N/A')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedDisclosures, setSelectedDisclosures] = useState<Disclosure[]>([])
  const [customNote, setCustomNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [resultModalOpen, setResultModalOpen] = useState(false)
  const [resultModalTitle, setResultModalTitle] = useState('')
  const [resultModalMessage, setResultModalMessage] = useState('')
  const [currentStockNumber, setCurrentStockNumber] = useState<string>('')
  const [presets, setPresets] = useState<Disclosure[]>([])
  const [loadingPresets, setLoadingPresets] = useState(false)
  const [presetsError, setPresetsError] = useState<string | null>(null)
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
    fetchDisclosures()
  }, [vehicleId])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoadingPresets(true)
      setPresetsError(null)
      try {
        const uid = await getLoggedInAdminDbUserId()
        if (!uid) {
          if (!cancelled) setPresets([])
          return
        }

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
  }, [])

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

  const normalizeDisclosures = (raw: any): Disclosure[] | null => {
    if (!raw) return null
    if (Array.isArray(raw)) return raw as Disclosure[]
    if (typeof raw === 'string') {
      try {
        const parsed = JSON.parse(raw)
        return normalizeDisclosures(parsed)
      } catch {
        return null
      }
    }
    if (typeof raw === 'object') {
      if (Array.isArray((raw as any).disclosures)) return (raw as any).disclosures as Disclosure[]
      if (Array.isArray((raw as any).items)) return (raw as any).items as Disclosure[]
    }
    return null
  }

  const fetchDisclosures = async () => {
    try {
      const { data, error } = await supabase
        .from('edc_vehicles')
        .select('stock_number')
        .eq('id', vehicleId)
        .maybeSingle()

      if (error) {
        console.error('Error fetching disclosures:', error)
      }

      if (!data) return

      const stockNumberRaw = (data as any).stock_number
      const stockNumber = stockNumberRaw === null || stockNumberRaw === undefined ? '' : String(stockNumberRaw).trim()
      setCurrentStockNumber(stockNumber)

      let row: any = null

      // 1) Try schemas where edc_disclosures.id === edc_vehicles.id
      try {
        const { data: byId, error: errId } = await supabase
          .from('edc_disclosures')
          .select('*')
          .eq('id', vehicleId)
          .order('created_at', { ascending: false })
          .limit(1)

        if (!errId) {
          row = Array.isArray(byId) ? byId[0] : null
        }
      } catch {}

      // 2) Fall back to explicit vehicle_id column
      if (!row) {
        try {
          const { data: byVehicle, error: errVehicle } = await supabase
            .from('edc_disclosures')
            .select('*')
            .eq('vehicle_id', vehicleId)
            .order('created_at', { ascending: false })
            .limit(1)

          if (!errVehicle) {
            row = Array.isArray(byVehicle) ? byVehicle[0] : null
          }
        } catch {}
      }

      if (!row && stockNumber) {
        try {
          const { data: byStock, error: errStock } = await supabase
            .from('edc_disclosures')
            .select('*')
            .eq('stock_number', stockNumber)
            .order('created_at', { ascending: false })
            .limit(1)

          if (!errStock) {
            row = Array.isArray(byStock) ? byStock[0] : null
          }
        } catch {}
      }

      if (row) {
        const brandRaw = (row as any).brandtype ?? (row as any).brand_type ?? (row as any).brand ?? null
        if (brandRaw) {
          const allowed = ['N/A', 'None', 'Rebuilt', 'Salvage', 'Irreparable'] as const
          const found = allowed.find((x) => String(brandRaw).toLowerCase() === x.toLowerCase())
          if (found) setBrandType(found)
        }

        const title = String(
          (row as any).disclosures_tittle ?? (row as any).disclosure_tittle ?? (row as any).disclosures_title ?? (row as any).disclosure_title ?? (row as any).title ?? ''
        ).trim()

        const body = String(
          (row as any).disclosures_body ?? (row as any).disclosure_body ?? (row as any).disclosures ?? (row as any).body ?? (row as any).notes ?? ''
        ).trim()

        const combined = body ? (title ? `${title}\n${body}` : body) : title
        if (combined) {
          const plain = toPlainText(combined)
          setCustomNote(
            plain
              ? `<div>${plain
                  .replace(/&/g, '&amp;')
                  .replace(/</g, '&lt;')
                  .replace(/>/g, '&gt;')
                  .replace(/\n/g, '<br/>')}</div>`
              : ''
          )
          setSelectedDisclosures([])
          return
        }
      }
    } catch (error) {
      console.error('Error fetching disclosures:', error)
    }
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
    const safeDisclosure: Disclosure = {
      id: String((disclosure as any)?.id || ''),
      title: String((disclosure as any)?.title || ''),
      content: String((disclosure as any)?.content || ''),
    }
    if (!safeDisclosure.id) return
    if (!selectedDisclosures.find(d => d.id === safeDisclosure.id)) {
      setSelectedDisclosures([...selectedDisclosures, safeDisclosure])
    }
    appendToNotes(getDisclosureText(safeDisclosure), safeDisclosure.id)
  }

  const handleRemoveDisclosure = (id: string) => {
    setSelectedDisclosures(selectedDisclosures.filter(d => d.id !== id))
    removeDisclosureTextFromNotes(id)
  }

  const handleSave = async (): Promise<boolean> => {
    setSaving(true)
    try {
      const sn = String(currentStockNumber || '').trim()
      if (!sn) {
        return false
      }

      const body = String(customNote || '').trim()

      const payload = {
        vehicleId: String(vehicleId),
        stock_number: sn,
        brandtype: brandType,
        disclosures_body: body || null,
      }

      const res = await fetch('/api/updatedisclosures', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const text = await res.text().catch(() => '')
      if (!res.ok) throw new Error(text || `Webhook responded with ${res.status}`)
      if (!String(text).toLowerCase().includes('done')) throw new Error('Webhook did not return Done')
      setResultModalTitle('Saved')
      setResultModalMessage('Disclosures saved successfully.')
      setResultModalOpen(true)
      return true
    } catch (error) {
      console.error('Error saving disclosures:', error)
      const msg = error instanceof Error ? error.message : 'Error saving disclosures'
      setResultModalTitle('Save Failed')
      setResultModalMessage(msg)
      setResultModalOpen(true)
      return false
    } finally {
      setSaving(false)
    }
  }

  const filteredPresets = useMemo(() => {
    const q = String(searchQuery || '').trim().toLowerCase()
    if (!q) return presets
    return presets.filter((d) => String(d?.title || '').toLowerCase().includes(q))
  }, [presets, searchQuery])

  return (
    <div className="bg-white rounded-xl shadow p-6">
      {resultModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">{resultModalTitle}</h3>
              <button
                onClick={() => setResultModalOpen(false)}
                className="p-1 text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </div>
            <div className="px-6 py-5 text-sm text-gray-700 whitespace-pre-line">
              {resultModalMessage}
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end">
              <button
                type="button"
                onClick={() => setResultModalOpen(false)}
                className="px-4 py-2 bg-[#118df0] text-white rounded-md hover:bg-[#0d6ebd]"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
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
                      handleAddDisclosure({
                        id: String(d.id),
                        title: String(d.title || ''),
                        content: String(d.content || ''),
                      })
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
            {saving ? 'Saving...' : 'Update'}
          </button>
        </div>
      )}
    </div>
  )
})

export default DisclosuresTab
