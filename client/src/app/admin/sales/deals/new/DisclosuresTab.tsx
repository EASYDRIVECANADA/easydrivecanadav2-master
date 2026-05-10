'use client'

import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

export default function DisclosuresTab({
  dealId,
  dealMode,
  dealType,
  formMode,
  onSaved,
  initialData,
  autoSaved,
  submission,
}: {
  dealId?: string
  dealMode?: 'RTL' | 'WHL'
  dealType?: 'Cash' | 'Finance'
  formMode?: 'create' | 'edit'
  onSaved?: () => void
  initialData?: any
  autoSaved?: boolean
  submission?: any
}): JSX.Element {
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

  const getCurrentUserId = async () => {
    const dbUserId = await getLoggedInAdminDbUserId()
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()
      if (userError) return dbUserId ?? null
      return dbUserId ?? user?.id ?? null
    } catch {
      return dbUserId ?? null
    }
  }
  const editorRef = useRef<HTMLDivElement | null>(null)
  const colorRef = useRef<HTMLInputElement | null>(null)
  const [hasBeenSaved, setHasBeenSaved] = useState(() => Boolean(initialData?.id))
  const [disclosuresRowId, setDisclosuresRowId] = useState<string | null>(() => initialData?.id ?? null)

  const [html, setHtml] = useState(initialData?.disclosures_html ?? '')
  const [conditions, setConditions] = useState(initialData?.conditions ?? '')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [showSavedModal, setShowSavedModal] = useState(false)
  const [showSaveErrorModal, setShowSaveErrorModal] = useState(false)
  const [saveErrorModalMessage, setSaveErrorModalMessage] = useState<string>('Unsuccessful save')
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
    if (editorRef.current) {
      editorRef.current.innerHTML = initialData?.disclosures_html ?? ''
    }
    setHtml(initialData?.disclosures_html ?? '')
    setConditions(initialData?.conditions ?? '')
    setHasBeenSaved(Boolean(initialData?.id))
    setDisclosuresRowId(initialData?.id ?? null)
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

  const toNull = (v: any) => {
    if (v === undefined || v === null) return null
    const s = String(v).trim()
    return s.length ? s : null
  }

  const handleSave = async () => {
    try {
      setSaveError(null)
      setShowSaveErrorModal(false)
      setSaving(true)

      if (!dealId) throw new Error('Missing deal ID')

      const userId = await getCurrentUserId().catch(() => null)
      const rowData = {
        deal_id: String(dealId),
        user_id: userId || null,
        disclosures_html: toNull(html),
        conditions: toNull(conditions),
        updated_at: new Date().toISOString(),
      }

      let res: Response
      if (disclosuresRowId) {
        res = await fetch('/api/deals/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ table: 'edc_deals_disclosures', id: disclosuresRowId, data: rowData }),
        })
      } else {
        res = await fetch('/api/deals/insert', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            table: 'edc_deals_disclosures',
            data: {
              ...rowData,
              created_at: new Date().toISOString(),
            },
          }),
        })
      }

      const text = await res.text().catch(() => '')
      let json: any = null
      try {
        json = text ? JSON.parse(text) : null
      } catch {
        json = null
      }

      if (!res.ok || (json && json.error)) {
        throw new Error((json && (json.error || json.message)) || text || `Save failed (${res.status})`)
      }

      if (!disclosuresRowId) {
        const insertedId = json?.rows?.[0]?.id
        if (insertedId) setDisclosuresRowId(String(insertedId))
      }

      setHasBeenSaved(true)
      setShowSavedModal(true)
    } catch (e: any) {
      const msg = e?.message || 'Failed to save disclosures'
      setSaveError(msg)
      setSaveErrorModalMessage(msg)
      setShowSaveErrorModal(true)
    } finally {
      setSaving(false)
    }
  }

  // Build customer signatures panel from online purchase submission
  const od = submission?.order_data
  const subCarfax = od?.carfax ?? null
  const subBoSig = od?.signatures?.billOfSaleCustomer ?? null
  const subDgSig = od?.signatures?.dealerGuaranteeCustomer ?? null
  const hasSubSigs = !!(subCarfax || subBoSig || subDgSig)

  const renderSigCard = (label: string, color: string, sig: { typedName?: string; drawnDataUrl?: string; signedAt?: string } | null, initials?: string | null, fallbackAt?: string | null) => (
    <div key={label} className="flex-1 min-w-[180px] border border-gray-200 rounded-lg p-3 bg-white shadow-sm">
      <div className={`text-[10px] font-semibold uppercase tracking-wide mb-2 ${color}`}>{label}</div>
      {sig?.drawnDataUrl ? (
        <img src={sig.drawnDataUrl} alt={label} className="h-16 w-full object-contain border border-gray-100 rounded bg-gray-50" />
      ) : sig?.typedName ? (
        <div className="h-16 flex items-center justify-center text-2xl text-gray-700 border border-gray-100 rounded bg-gray-50 px-2 italic">{sig.typedName}</div>
      ) : initials ? (
        <div className="h-16 flex items-center justify-center text-2xl text-gray-700 border border-gray-100 rounded bg-gray-50 px-2 italic">{initials}</div>
      ) : null}
      {(sig?.typedName || initials) && (
        <div className="mt-1 text-[10px] text-gray-400 truncate">{sig?.typedName ?? initials}</div>
      )}
      {(sig?.signedAt || fallbackAt) && (
        <div className="text-[10px] text-gray-400">{new Date((sig?.signedAt ?? fallbackAt)!).toLocaleString('en-CA', { dateStyle: 'medium', timeStyle: 'short' })}</div>
      )}
    </div>
  )

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
                OK
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showSaveErrorModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-[92vw] max-w-md rounded-lg bg-white shadow-xl border border-gray-100 p-5">
            <div className="text-base font-semibold text-gray-900">Save Unsuccessful</div>
            <div className="mt-1 text-sm text-gray-600">{saveErrorModalMessage || 'Unsuccessful save'}</div>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setShowSaveErrorModal(false)}
                className="h-9 px-4 rounded bg-[#118df0] text-white text-sm font-semibold hover:bg-[#0d6ebd]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
      <div className="text-xs text-gray-700 mb-2">Disclosures</div>

      {hasSubSigs && (
        <div className="mb-6 p-4 border border-blue-100 rounded-xl bg-blue-50/40">
          <div className="text-xs font-semibold text-blue-700 mb-3 flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            Customer Signatures — Online Purchase
          </div>
          <div className="flex flex-wrap gap-3">
            {subCarfax && renderSigCard(
              'CARFAX Review', 'text-purple-600',
              subCarfax.typedInitials
                ? { typedName: subCarfax.typedInitials, signedAt: subCarfax.acknowledgedAt ?? undefined }
                : subCarfax.initialDataUrl
                ? { drawnDataUrl: subCarfax.initialDataUrl, signedAt: subCarfax.acknowledgedAt ?? undefined }
                : null,
              subCarfax.typedInitials,
              subCarfax.acknowledgedAt,
            )}
            {subBoSig && renderSigCard('Bill of Sale', 'text-green-600', subBoSig, null, null)}
            {subDgSig && renderSigCard('Dealer Guarantee', 'text-orange-600', subDgSig, null, null)}
          </div>
        </div>
      )}

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
          {saving ? (hasBeenSaved ? 'Updating…' : 'Saving…') : hasBeenSaved ? 'Update' : 'Save'}
        </button>
      </div>
    </div>
  )
}
