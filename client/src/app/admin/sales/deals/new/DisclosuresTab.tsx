'use client'

import { useEffect, useRef, useState } from 'react'

export default function DisclosuresTab({ dealId, onSaved, initialData, autoSaved }: { dealId?: string; onSaved?: () => void; initialData?: any; autoSaved?: boolean }): JSX.Element {
  const editorRef = useRef<HTMLDivElement | null>(null)
  const colorRef = useRef<HTMLInputElement | null>(null)
  const [html, setHtml] = useState(initialData?.disclosures_html ?? '')
  const [conditions, setConditions] = useState(initialData?.conditions ?? '')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [showSavedModal, setShowSavedModal] = useState(false)
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
    if (initialData?.disclosures_html && editorRef.current) {
      editorRef.current.innerHTML = initialData.disclosures_html
    }
  }, [initialData])

  useEffect(() => {
    const onSel = () => refreshToolbarState()
    document.addEventListener('selectionchange', onSel)
    return () => document.removeEventListener('selectionchange', onSel)
  }, [])

  const runCmd = (cmd: string, value?: string) => {
    const el = editorRef.current
    if (!el) return
    el.focus()
    try {
      document.execCommand(cmd, false, value)
    } catch {}
    setHtml(el.innerHTML)
    setTimeout(() => refreshToolbarState(), 0)
  }

  const cycleAlign = () => {
    try {
      if (document.queryCommandState('justifyLeft')) {
        runCmd('justifyCenter')
        return
      }
      if (document.queryCommandState('justifyCenter')) {
        runCmd('justifyRight')
        return
      }
    } catch {}
    runCmd('justifyLeft')
  }

  const handleSave = async () => {
    try {
      setSaveError(null)
      setSaving(true)

      if (initialData?.id) {
        // Editing mode — update existing disclosures row in Supabase
        const updateData: Record<string, any> = {
          disclosures_html: html || null,
          conditions: conditions || null,
        }
        const res = await fetch('/api/deals/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ table: 'edc_deals_disclosures', id: initialData.id, data: updateData }),
        })
        const json = await res.json()
        if (!res.ok || json.error) throw new Error(json.error || `Update failed (${res.status})`)
      } else {
        // New deal — insert directly into Supabase
        const insertData: Record<string, any> = {
          id: dealId || null,
          disclosures_html: html || null,
          conditions: conditions || null,
        }
        const res = await fetch('/api/deals/insert', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ table: 'edc_deals_disclosures', data: insertData }),
        })
        const json = await res.json()
        if (!res.ok || json.error) throw new Error(json.error || `Save failed (${res.status})`)

        if (!autoSaved) {
          setHtml('')
          setConditions('')
          if (editorRef.current) editorRef.current.innerHTML = ''
        }
      }

      setShowSavedModal(true)
      window.setTimeout(() => {
        setShowSavedModal(false)
        onSaved?.()
      }, 900)
    } catch (e: any) {
      setSaveError(e?.message || 'Failed to save disclosures')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="w-full">
      {showSavedModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-[92vw] max-w-md rounded-lg bg-white shadow-xl border border-gray-100 p-5">
            <div className="text-base font-semibold text-gray-900">Disclosures saved</div>
            <div className="mt-1 text-sm text-gray-600">Disclosures information has been saved successfully.</div>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setShowSavedModal(false)
                  onSaved?.()
                }}
                className="h-9 px-4 rounded bg-[#118df0] text-white text-sm font-semibold hover:bg-[#0d6ebd]"
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      ) : null}
      <div className="text-xs text-gray-700 mb-2">Disclosures</div>

      <div className="border border-gray-200 bg-white shadow-sm">
        <div className="bg-gray-50 px-3 py-2 flex items-center gap-2 text-xs text-gray-600 border-b border-gray-200">
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => runCmd('bold')}
            className={`px-2 py-1 border ${toolbarState.bold ? 'bg-[#118df0] text-white border-[#118df0]' : 'bg-white border-gray-200 text-gray-700'}`}
          >
            B
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => runCmd('italic')}
            className={`px-2 py-1 border italic ${toolbarState.italic ? 'bg-[#118df0] text-white border-[#118df0]' : 'bg-white border-gray-200 text-gray-700'}`}
          >
            I
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => runCmd('underline')}
            className={`px-2 py-1 border underline ${toolbarState.underline ? 'bg-[#118df0] text-white border-[#118df0]' : 'bg-white border-gray-200 text-gray-700'}`}
          >
            U
          </button>
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => runCmd('removeFormat')} className="px-2 py-1 border border-gray-200 bg-white text-gray-700">
            Tx
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => runCmd('strikeThrough')}
            className={`px-2 py-1 border ${toolbarState.strike ? 'bg-[#118df0] text-white border-[#118df0]' : 'bg-white border-gray-200 text-gray-700'}`}
          >
            S
          </button>
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => runCmd('removeFormat')} className="px-2 py-1 border border-gray-200 bg-white text-gray-700">
            x
          </button>
          <select
            className="h-7 text-xs border border-gray-200 bg-white px-2"
            value=""
            onMouseDown={(e) => e.preventDefault()}
            onChange={(e) => {
              const v = e.target.value
              if (v) runCmd('fontSize', v)
              e.target.value = ''
            }}
          >
            <option value="">16</option>
            <option value="2">12</option>
            <option value="3">14</option>
            <option value="4">16</option>
            <option value="5">18</option>
            <option value="6">24</option>
          </select>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => colorRef.current?.click()}
            className="px-2 py-1 border border-gray-200 bg-white text-gray-700"
          >
            A
          </button>
          <input
            ref={colorRef}
            type="color"
            className="hidden"
            onChange={(e) => runCmd('foreColor', e.target.value)}
          />
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={cycleAlign}
            className={`px-2 py-1 border ${toolbarState.left || toolbarState.center || toolbarState.right ? 'bg-[#118df0] text-white border-[#118df0]' : 'bg-white border-gray-200 text-gray-700'}`}
          >
            ≡
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => runCmd('insertUnorderedList')}
            className={`px-2 py-1 border ${toolbarState.ul ? 'bg-[#118df0] text-white border-[#118df0]' : 'bg-white border-gray-200 text-gray-700'}`}
          >
            Tˇ
          </button>
          <div className="flex-1" />
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => runCmd('insertOrderedList')}
            className={`px-2 py-1 border ${toolbarState.ol ? 'bg-[#118df0] text-white border-[#118df0]' : 'bg-white border-gray-200 text-gray-700'}`}
          >
            ▾
          </button>
        </div>

        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onInput={() => {
            setHtml(editorRef.current?.innerHTML || '')
            refreshToolbarState()
          }}
          onMouseUp={refreshToolbarState}
          onKeyUp={refreshToolbarState}
          className="min-h-[240px] p-3 text-sm outline-none"
        />
      </div>

      <div className="mt-6">
        <div className="text-xs text-gray-700 mb-2">Conditions</div>
        <textarea
          value={conditions}
          onChange={(e) => setConditions(e.target.value)}
          className="w-full min-h-[120px] border border-gray-200 bg-white shadow-sm rounded px-3 py-2 text-sm"
        />
      </div>

      {saveError ? (
        <div className="mt-6 rounded border border-red-200 bg-red-50 text-red-700 px-3 py-2 text-sm">
          {saveError}
        </div>
      ) : null}

      <div className="mt-6 flex items-center justify-end">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="h-10 px-6 rounded bg-[#118df0] text-white text-sm font-semibold hover:bg-[#0d6ebd] disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  )
}
