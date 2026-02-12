'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

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

function escapeHtml(s: string) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function plainTextToHtml(s: string) {
  const parts = String(s || '')
    .split(/\n+/g)
    .map((p) => p.trimEnd())
  const html = parts.map((p) => (p ? `<div>${escapeHtml(p)}</div>` : '<div><br/></div>')).join('')
  return html || '<div><br/></div>'
}

function ToolbarButton({
  active,
  onClick,
  title,
  children,
}: {
  active?: boolean
  onClick: () => void
  title: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => {
        e.preventDefault()
        onClick()
      }}
      className={
        active
          ? 'h-5 min-w-5 px-1 border border-[#118df0] bg-[#118df0] text-[10px] text-white'
          : 'h-5 min-w-5 px-1 border border-gray-200 bg-white text-[10px] text-gray-700'
      }
      tabIndex={-1}
    >
      {children}
    </button>
  )
}

function RichTextEditorBlock({
  title,
  subtitle,
  value,
  onChange,
  height = 160,
}: {
  title: string
  subtitle?: string
  value: string
  onChange: (html: string) => void
  height?: number
}) {
  const editorRef = useRef<HTMLDivElement | null>(null)
  const toolbarRef = useRef<HTMLDivElement | null>(null)

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

  const [active, setActive] = useState(false)
  const [colorPopover, setColorPopover] = useState<'text' | 'highlight' | null>(null)
  const [pendingColor, setPendingColor] = useState<string | null>(null)

  const palette = useMemo(
    () => [
      '#000000',
      '#434343',
      '#666666',
      '#999999',
      '#b7b7b7',
      '#cccccc',
      '#d9d9d9',
      '#efefef',
      '#f3f3f3',
      '#ffffff',
      '#980000',
      '#ff0000',
      '#ff9900',
      '#ffff00',
      '#00ff00',
      '#00ffff',
      '#4a86e8',
      '#0000ff',
      '#9900ff',
      '#ff00ff',
      '#e6b8af',
      '#f4cccc',
      '#fce5cd',
      '#fff2cc',
      '#d9ead3',
      '#d0e0e3',
      '#c9daf8',
      '#cfe2f3',
      '#d9d2e9',
      '#ead1dc',
      '#dd7e6b',
      '#ea9999',
      '#f9cb9c',
      '#ffe599',
      '#b6d7a8',
      '#a2c4c9',
      '#a4c2f4',
      '#9fc5e8',
      '#b4a7d6',
      '#c27ba0',
      '#cc4125',
      '#e06666',
      '#f6b26b',
      '#ffd966',
      '#93c47d',
      '#76a5af',
      '#6d9eeb',
      '#6fa8dc',
      '#8e7cc3',
      '#c27ba0',
      '#a61c00',
      '#cc0000',
      '#e69138',
      '#f1c232',
      '#6aa84f',
      '#45818e',
      '#3c78d8',
      '#3d85c6',
      '#674ea7',
      '#a64d79',
    ],
    []
  )

  const refreshToolbarState = () => {
    const el = editorRef.current
    if (!el) return
    const sel = typeof document !== 'undefined' ? document.getSelection() : null
    const anchor = sel?.anchorNode
    const focus = sel?.focusNode
    const inThisEditor = !!(
      anchor &&
      focus &&
      (el === anchor || el.contains(anchor)) &&
      (el === focus || el.contains(focus))
    )

    if (!inThisEditor) {
      setToolbarState({
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
      return
    }

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
    if (!colorPopover) return
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (!toolbarRef.current) return
      if (toolbarRef.current.contains(t)) return
      setColorPopover(null)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [colorPopover])

  useEffect(() => {
    const el = editorRef.current
    if (!el) return
    const active = typeof document !== 'undefined' ? document.activeElement : null
    if (active === el) return
    if (el.innerHTML !== (value || '')) {
      el.innerHTML = value || ''
    }
  }, [value])

  const runCmd = (cmd: string, val?: string) => {
    const el = editorRef.current
    if (!el) return
    el.focus()
    try {
      document.execCommand(cmd, false, val)
    } catch {}
    onChange(el.innerHTML)
    window.setTimeout(() => refreshToolbarState(), 0)
  }

  const setFontSize = (size: string) => {
    if (!size) return
    runCmd('fontSize', size)
  }

  const createLink = () => {
    const url = window.prompt('Enter URL')
    if (!url) return
    runCmd('createLink', url)
  }

  const onInput = () => {
    const el = editorRef.current
    if (!el) return
    onChange(el.innerHTML)
  }

  const openPopover = (type: 'text' | 'highlight') => {
    setColorPopover(type)
    setPendingColor(null)
  }

  const defaultColor = (type: 'text' | 'highlight') => {
    if (type === 'text') return '#000000'
    return 'transparent'
  }

  const applyColor = (type: 'text' | 'highlight', color: string) => {
    if (type === 'text') {
      runCmd('foreColor', color)
      return
    }
    runCmd('hiliteColor', color)
  }

  return (
    <div className="mt-5">
      <div className="text-[11px] font-semibold text-gray-600">{title}</div>
      {subtitle ? <div className="mt-1 text-[10px] text-gray-500">{subtitle}</div> : null}
      <div className="mt-2 border border-gray-300">
        <div
          ref={toolbarRef}
          className="min-h-7 px-2 py-1 flex items-center flex-wrap gap-1 border-b border-gray-200 bg-gray-50 relative"
        >
          <ToolbarButton title="Bold" active={toolbarState.bold} onClick={() => runCmd('bold')}>
            B
          </ToolbarButton>
          <ToolbarButton title="Italic" active={toolbarState.italic} onClick={() => runCmd('italic')}>
            I
          </ToolbarButton>
          <ToolbarButton title="Underline" active={toolbarState.underline} onClick={() => runCmd('underline')}>
            U
          </ToolbarButton>
          <ToolbarButton title="Strike" active={toolbarState.strike} onClick={() => runCmd('strikeThrough')}>
            S
          </ToolbarButton>

          <ToolbarButton title="Bulleted list" active={toolbarState.ul} onClick={() => runCmd('insertUnorderedList')}>
            •
          </ToolbarButton>
          <ToolbarButton title="Numbered list" active={toolbarState.ol} onClick={() => runCmd('insertOrderedList')}>
            1.
          </ToolbarButton>

          <ToolbarButton title="Align left" active={toolbarState.left} onClick={() => runCmd('justifyLeft')}>
            ≡
          </ToolbarButton>
          <ToolbarButton title="Align center" active={toolbarState.center} onClick={() => runCmd('justifyCenter')}>
            ≣
          </ToolbarButton>
          <ToolbarButton title="Align right" active={toolbarState.right} onClick={() => runCmd('justifyRight')}>
            ≡→
          </ToolbarButton>

          <ToolbarButton title="Undo" onClick={() => runCmd('undo')}>
            ⟲
          </ToolbarButton>
          <ToolbarButton title="Redo" onClick={() => runCmd('redo')}>
            ⟳
          </ToolbarButton>

          <select
            className="h-5 border border-gray-200 bg-white text-[10px] text-gray-700 px-1"
            defaultValue=""
            onChange={(e) => {
              setFontSize(e.target.value)
              e.currentTarget.value = ''
            }}
            title="Font size"
          >
            <option value="" />
            <option value="1">8</option>
            <option value="2">10</option>
            <option value="3">12</option>
            <option value="4">14</option>
            <option value="5">18</option>
            <option value="6">24</option>
            <option value="7">36</option>
          </select>

          <button
            type="button"
            className={
              colorPopover === 'text'
                ? 'h-5 min-w-5 px-1 border border-[#118df0] bg-[#118df0] text-[10px] text-white'
                : 'h-5 min-w-5 px-1 border border-gray-200 bg-white text-[10px] text-gray-700'
            }
            title="Text color"
            onMouseDown={(e) => {
              e.preventDefault()
              openPopover('text')
            }}
            tabIndex={-1}
          >
            A
          </button>

          <button
            type="button"
            className={
              colorPopover === 'highlight'
                ? 'h-5 min-w-5 px-1 border border-[#118df0] bg-[#118df0] text-[10px] text-white'
                : 'h-5 min-w-5 px-1 border border-gray-200 bg-white text-[10px] text-gray-700'
            }
            title="Background color"
            onMouseDown={(e) => {
              e.preventDefault()
              openPopover('highlight')
            }}
            tabIndex={-1}
          >
            ▇
          </button>

          <ToolbarButton title="Insert link" onClick={createLink}>
            🔗
          </ToolbarButton>
          <ToolbarButton title="Remove link" onClick={() => runCmd('unlink')}>
            ⛓
          </ToolbarButton>
          <ToolbarButton title="Clear formatting" onClick={() => runCmd('removeFormat')}>
            Tx
          </ToolbarButton>

          {colorPopover ? (
            <div className="absolute left-2 top-full mt-1 w-[420px] border border-gray-200 bg-white shadow">
              <div className="px-3 py-2 border-b border-gray-200">
                <div className="text-[11px] font-semibold text-gray-700">
                  {colorPopover === 'text' ? 'Text Color' : 'Background Color'}
                </div>
                <div className="mt-1 flex items-center justify-between">
                  <button
                    type="button"
                    className="text-[11px] text-gray-700"
                    onMouseDown={(e) => {
                      e.preventDefault()
                      setPendingColor('transparent')
                    }}
                  >
                    Transparent
                  </button>
                  <button
                    type="button"
                    className="text-[11px] text-gray-700"
                    onMouseDown={(e) => {
                      e.preventDefault()
                      setPendingColor(defaultColor(colorPopover))
                    }}
                  >
                    Reset to default
                  </button>
                </div>
              </div>

              <div className="p-3">
                <div className="grid grid-cols-10 gap-1">
                  {palette.map((c) => (
                    <button
                      key={c}
                      type="button"
                      className={
                        (pendingColor || '') === c
                          ? 'h-4 w-4 border border-[#118df0]'
                          : 'h-4 w-4 border border-gray-200'
                      }
                      style={{ background: c }}
                      onMouseDown={(e) => {
                        e.preventDefault()
                        setPendingColor(c)
                      }}
                      tabIndex={-1}
                      title={c}
                    />
                  ))}
                </div>

                <div className="mt-3 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    className="h-8 px-4 bg-gray-600 text-white text-xs font-semibold"
                    onMouseDown={(e) => {
                      e.preventDefault()
                      setColorPopover(null)
                    }}
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    className="h-8 px-4 bg-[#118df0] text-white text-xs font-semibold"
                    onMouseDown={(e) => {
                      e.preventDefault()
                      const color = pendingColor ?? defaultColor(colorPopover)
                      applyColor(colorPopover, color)
                      setColorPopover(null)
                    }}
                  >
                    Select
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </div>
        <div
          ref={editorRef}
          className="w-full p-3 text-xs text-gray-800 outline-none overflow-auto"
          style={{ height }}
          contentEditable
          suppressContentEditableWarning
          onInput={onInput}
          onFocus={() => {
            setActive(true)
            refreshToolbarState()
          }}
          onBlur={() => {
            setActive(false)
            setColorPopover(null)
          }}
          onKeyUp={() => refreshToolbarState()}
          onMouseUp={() => refreshToolbarState()}
        />
      </div>
    </div>
  )
}

export default function SettingsReportsPage() {
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveModalOpen, setSaveModalOpen] = useState(false)
  const [updateModalOpen, setUpdateModalOpen] = useState(false)

  const [scopedUserId, setScopedUserId] = useState<string | null>(null)

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

  const getWebhookUserId = async () => {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()
    if (userError) throw userError
    const dbUserId = await getLoggedInAdminDbUserId()
    return dbUserId ?? user?.id ?? null
  }

  useEffect(() => {
    const load = async () => {
      try {
        const id = await getWebhookUserId()
        setScopedUserId(id)
      } catch {
        setScopedUserId(null)
      }
    }
    void load()
  }, [])
  const [actionMode, setActionMode] = useState<'save' | 'update'>('save')
  const [reportRowId, setReportRowId] = useState<string | null>(null)

  const persistReportRowId = (id: string | null) => {
    try {
      if (id) localStorage.setItem('edc_report_id', id)
      else localStorage.removeItem('edc_report_id')
    } catch {
      // ignore
    }
  }

  const getReportRowId = () => {
    try {
      const v = localStorage.getItem('edc_report_id')
      return v && v.trim().length ? v.trim() : null
    } catch {
      return null
    }
  }

  const getDealershipId = () => {
    try {
      const v = localStorage.getItem('edc_dealership_id')
      return v && v.trim().length ? v.trim() : null
    } catch {
      return null
    }
  }

  const fetchDealershipIdFromDb = async () => {
    try {
      if (!scopedUserId) return null
      const { data, error } = await supabase
        .from('dealership')
        .select('id')
        .eq('user_id', scopedUserId)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle()
      if (error) return null
      const id = (data as any)?.id
      return typeof id === 'string' && id.trim().length ? id.trim() : null
    } catch {
      return null
    }
  }

  const [showDealDateOnBos, setShowDealDateOnBos] = useState(true)
  const [showSalespersonOnBos, setShowSalespersonOnBos] = useState(true)
  const [showAcceptedByOnBos, setShowAcceptedByOnBos] = useState(true)
  const [showOmvicDisclosure, setShowOmvicDisclosure] = useState(true)
  const [showVehicleCertification, setShowVehicleCertification] = useState(true)

  const [creditCardTermsHtml, setCreditCardTermsHtml] = useState('<div><br/></div>')
  const [disclosuresOnBosHtml, setDisclosuresOnBosHtml] = useState('<div><br/></div>')
  const [newCarBosHtml, setNewCarBosHtml] = useState('<div><br/></div>')
  const [usedCarBosHtml, setUsedCarBosHtml] = useState('<div><br/></div>')
  const [waiverLegalHtml, setWaiverLegalHtml] = useState('<div><br/></div>')
  const [retailLegalHtml, setRetailLegalHtml] = useState('<div><br/></div>')
  const [wholesaleLegalHtml, setWholesaleLegalHtml] = useState('<div><br/></div>')
  const [showRetailServiceInvoiceNote, setShowRetailServiceInvoiceNote] = useState(false)

  useEffect(() => {
    if (!scopedUserId) return

    const load = async () => {
      try {
        const storedId = getReportRowId()
        if (storedId) {
          setReportRowId(storedId)
        }

        const { data, error } = await supabase
          .from('report')
          .select(
            'id, show_deal_date, show_salesperson, show_accepted_by, show_omvic_disclosure, show_vehicle_certification, credit_card_terms_html, disclosures_html, new_car_additional_description_html, used_car_additional_description_html, waiver_of_legal_description_html, retail_legal_description_html, wholesale_legal_description_html, show_labor_detail'
          )
          .eq('user_id', scopedUserId)
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle()

        if (error || !data) return

        const id = (data as any)?.id ?? null
        if (id) {
          setReportRowId(id)
          persistReportRowId(id)
          setActionMode('update')
        }

        setShowDealDateOnBos(Boolean((data as any)?.show_deal_date))
        setShowSalespersonOnBos(Boolean((data as any)?.show_salesperson))
        setShowAcceptedByOnBos(Boolean((data as any)?.show_accepted_by))
        setShowOmvicDisclosure(Boolean((data as any)?.show_omvic_disclosure))
        setShowVehicleCertification(Boolean((data as any)?.show_vehicle_certification))
        setCreditCardTermsHtml((data as any)?.credit_card_terms_html ?? '<div><br/></div>')
        setDisclosuresOnBosHtml((data as any)?.disclosures_html ?? '<div><br/></div>')
        setNewCarBosHtml((data as any)?.new_car_additional_description_html ?? '<div><br/></div>')
        setUsedCarBosHtml((data as any)?.used_car_additional_description_html ?? '<div><br/></div>')
        setWaiverLegalHtml((data as any)?.waiver_of_legal_description_html ?? '<div><br/></div>')
        setRetailLegalHtml((data as any)?.retail_legal_description_html ?? '<div><br/></div>')
        setWholesaleLegalHtml((data as any)?.wholesale_legal_description_html ?? '<div><br/></div>')
        setShowRetailServiceInvoiceNote(Boolean((data as any)?.show_labor_detail))
      } catch {
        // ignore
      }
    }
    void load()
  }, [scopedUserId])

  const onSave = async () => {
    setSaveError(null)
    setSaveModalOpen(false)
    setUpdateModalOpen(false)
    setSaving(true)
    try {
      let dealership_id = getDealershipId()
      if (!dealership_id) {
        dealership_id = await fetchDealershipIdFromDb()
      }

      const user_id = await getWebhookUserId()
      const body = {
        user_id,
        dealership_id,
        bill_of_sale: {
          show_deal_date: showDealDateOnBos,
          show_salesperson: showSalespersonOnBos,
          show_accepted_by: showAcceptedByOnBos,
          show_omvic_disclosure: showOmvicDisclosure,
          show_vehicle_certification: showVehicleCertification,
          credit_card_terms_html: creditCardTermsHtml,
          disclosures_html: disclosuresOnBosHtml,
          new_car_additional_description_html: newCarBosHtml,
          used_car_additional_description_html: usedCarBosHtml,
          waiver_of_legal_description_html: waiverLegalHtml,
          retail_legal_description_html: retailLegalHtml,
          wholesale_legal_description_html: wholesaleLegalHtml,
        },
        service_invoice: {
          show_labor_detail: showRetailServiceInvoiceNote,
        },
      }

      const res = await fetch('https://primary-production-6722.up.railway.app/webhook/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const text = await res.text().catch(() => '')
      if (!res.ok) throw new Error(text || `Request failed (${res.status})`)
      if (String(text).trim() !== 'Done') throw new Error(text || 'Webhook did not return Done')
      setSaveModalOpen(true)
      setActionMode('update')
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const onUpdate = async () => {
    setSaveError(null)
    setSaveModalOpen(false)
    setUpdateModalOpen(false)
    setSaving(true)
    try {
      if (!scopedUserId) throw new Error('Missing user')
      const row = {
        user_id: scopedUserId,
        show_deal_date: showDealDateOnBos,
        show_salesperson: showSalespersonOnBos,
        show_accepted_by: showAcceptedByOnBos,
        show_omvic_disclosure: showOmvicDisclosure,
        show_vehicle_certification: showVehicleCertification,
        credit_card_terms_html: creditCardTermsHtml,
        disclosures_html: disclosuresOnBosHtml,
        new_car_additional_description_html: newCarBosHtml,
        used_car_additional_description_html: usedCarBosHtml,
        waiver_of_legal_description_html: waiverLegalHtml,
        retail_legal_description_html: retailLegalHtml,
        wholesale_legal_description_html: wholesaleLegalHtml,
        show_labor_detail: showRetailServiceInvoiceNote,
      } as any

      let idToUse = reportRowId || getReportRowId()
      if (!idToUse) {
        const { data } = await supabase
          .from('report')
          .select('id')
          .eq('user_id', scopedUserId)
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle()
        idToUse = (data as any)?.id ?? null
      }

      if (idToUse) {
        const { error } = await supabase.from('report').update(row).eq('id', idToUse).eq('user_id', scopedUserId)
        if (error) throw error
        setReportRowId(idToUse)
        persistReportRowId(idToUse)
      } else {
        const { data, error } = await supabase.from('report').insert(row).select('id').single()
        if (error) throw error
        const id = (data as any)?.id ?? null
        setReportRowId(id)
        persistReportRowId(id)
      }

      setUpdateModalOpen(true)
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Update failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="pb-6">
      {saveError ? <div className="text-xs text-red-600">{saveError}</div> : null}

      {saveModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/50" onMouseDown={() => setSaveModalOpen(false)} />
          <div className="relative w-[420px] bg-white rounded shadow-lg">
            <div className="h-12 px-4 border-b border-gray-200 flex items-center justify-between">
              <div className="text-sm font-semibold text-gray-800">Success</div>
              <button
                type="button"
                className="h-8 w-8 flex items-center justify-center"
                onClick={() => setSaveModalOpen(false)}
              >
                <span className="text-xl leading-none text-gray-500">×</span>
              </button>
            </div>
            <div className="p-4">
              <div className="text-sm text-gray-800">Successfully saved report settings.</div>
              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  className="h-8 px-4 bg-[#118df0] text-white text-xs font-semibold"
                  onClick={() => setSaveModalOpen(false)}
                >
                  OK
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {updateModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/50" onMouseDown={() => setUpdateModalOpen(false)} />
          <div className="relative w-[420px] bg-white rounded shadow-lg">
            <div className="h-12 px-4 border-b border-gray-200 flex items-center justify-between">
              <div className="text-sm font-semibold text-gray-800">Success</div>
              <button
                type="button"
                className="h-8 w-8 flex items-center justify-center"
                onClick={() => setUpdateModalOpen(false)}
              >
                <span className="text-xl leading-none text-gray-500">×</span>
              </button>
            </div>
            <div className="p-4">
              <div className="text-sm text-gray-800">Successfully updated report settings.</div>
              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  className="h-8 px-4 bg-[#118df0] text-white text-xs font-semibold"
                  onClick={() => setUpdateModalOpen(false)}
                >
                  OK
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="text-[11px] font-semibold text-gray-600">BILL OF SALE</div>
      <div className="mt-2 border-t border-gray-200" />

      <div className="mt-4 space-y-3">
        <div className="flex items-center justify-between gap-4">
          <div className="text-[11px] text-gray-700">Display deal date on bill of sale?</div>
          <Toggle checked={showDealDateOnBos} onChange={setShowDealDateOnBos} />
        </div>
        <div className="flex items-center justify-between gap-4">
          <div className="text-[11px] text-gray-700">Show salesperson on bill of sale?</div>
          <Toggle checked={showSalespersonOnBos} onChange={setShowSalespersonOnBos} />
        </div>
        <div className="flex items-center justify-between gap-4">
          <div className="text-[11px] text-gray-700">Show accepted by on bill of sale?</div>
          <Toggle checked={showAcceptedByOnBos} onChange={setShowAcceptedByOnBos} />
        </div>
        <div className="flex items-center justify-between gap-4">
          <div className="text-[11px] text-gray-700">Show OMVIC disclosure on bill of sale?</div>
          <Toggle checked={showOmvicDisclosure} onChange={setShowOmvicDisclosure} />
        </div>
        <div className="flex items-center justify-between gap-4">
          <div className="text-[11px] text-gray-700">Show vehicle certification on bill of sale?</div>
          <Toggle checked={showVehicleCertification} onChange={setShowVehicleCertification} />
        </div>
      </div>

      <div className="mt-4 border-t border-gray-200" />

      <RichTextEditorBlock
        title="Credit Card Terms"
        subtitle="If text is supplied it will be added to the bill of sale and contract terms."
        value={creditCardTermsHtml}
        onChange={setCreditCardTermsHtml}
        height={90}
      />

      <RichTextEditorBlock
        title="Disclosures Form, As-Is/Used Car Description"
        subtitle="This content will be displayed in the disclosures section."
        value={disclosuresOnBosHtml}
        onChange={setDisclosuresOnBosHtml}
        height={180}
      />

      <RichTextEditorBlock
        title="New Car Bill of Sale, Additional Description"
        subtitle="Optional additional description for new car bill of sale."
        value={newCarBosHtml}
        onChange={setNewCarBosHtml}
        height={150}
      />

      <RichTextEditorBlock
        title="Used Car Bill of Sale, Additional Description"
        subtitle="Optional additional description for used car bill of sale."
        value={usedCarBosHtml}
        onChange={setUsedCarBosHtml}
        height={150}
      />

      <RichTextEditorBlock
        title="Waiver of Legal Description"
        subtitle="This paragraph can be displayed in the legal description section."
        value={waiverLegalHtml}
        onChange={setWaiverLegalHtml}
        height={120}
      />

      <RichTextEditorBlock
        title="Retail Legal Description"
        subtitle="This paragraph can be displayed in the legal description section for retail deals."
        value={retailLegalHtml}
        onChange={setRetailLegalHtml}
        height={120}
      />

      <RichTextEditorBlock
        title="Wholesale Legal Description"
        subtitle="This paragraph can be displayed in the legal description section for wholesale deals."
        value={wholesaleLegalHtml}
        onChange={setWholesaleLegalHtml}
        height={120}
      />

      <div className="mt-6">
        <div className="text-[11px] font-semibold text-gray-600">SERVICE INVOICE</div>
        <div className="mt-2 border-t border-gray-200" />
        <div className="mt-3 flex items-center gap-3">
          <input
            id="showRetailServiceInvoiceNote"
            type="checkbox"
            checked={showRetailServiceInvoiceNote}
            onChange={(e) => setShowRetailServiceInvoiceNote(e.target.checked)}
            className="h-3.5 w-3.5"
          />
          <label htmlFor="showRetailServiceInvoiceNote" className="text-[11px] text-gray-700">
            Show labor detail on service invoice?
          </label>
        </div>
      </div>

      <div className="flex items-center justify-between pt-8">
        <button type="button" className="h-8 px-3 bg-gray-600 text-white text-xs font-semibold">
          <span className="inline-flex items-center gap-2">
            <span className="text-sm leading-none">×</span>
            Cancel
          </span>
        </button>
        <button
          type="button"
          onClick={() => void (actionMode === 'save' ? onSave() : onUpdate())}
          disabled={saving}
          className={
            saving
              ? 'h-8 px-4 bg-[#118df0]/70 text-white text-xs font-semibold cursor-not-allowed'
              : 'h-8 px-4 bg-[#118df0] text-white text-xs font-semibold'
          }
        >
          <span className="inline-flex items-center gap-2">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" />
              <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M17 21v-8H7v8" />
              <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M7 3v5h8" />
            </svg>
            {saving ? (actionMode === 'save' ? 'Saving…' : 'Updating…') : actionMode === 'save' ? 'Save' : 'Update'}
          </span>
        </button>
      </div>
    </div>
  )
}
