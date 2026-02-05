'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'

export default function DeliveryTab({ dealMode = 'RTL', dealId }: { dealMode?: 'RTL' | 'WHL'; dealId?: string }) {
  const router = useRouter()
  const [deliveryDate, setDeliveryDate] = useState('')
  const [deliveryTime, setDeliveryTime] = useState('')
  const [exportedOutsideOntario, setExportedOutsideOntario] = useState(false)
  const [exportedPartyType, setExportedPartyType] = useState<'Dealer' | 'Non-Dealer'>('Non-Dealer')
  const [deliveryDetails, setDeliveryDetails] = useState('')
  const [otherNotes, setOtherNotes] = useState('')

  const [staffNames, setStaffNames] = useState<string[]>([])
  const [approvedBy, setApprovedBy] = useState('')
  const [salesperson, setSalesperson] = useState('')

  const [taskName, setTaskName] = useState('')
  const [taskDescription, setTaskDescription] = useState('')
  const [taskDueBy, setTaskDueBy] = useState('')
  const [tasks, setTasks] = useState<Array<{ name: string | null; description: string | null; dueBy: string | null }>>([])

  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [showSuccessModal, setShowSuccessModal] = useState(false)

  useEffect(() => {
    const loadNames = async () => {
      try {
        const { data, error } = await supabase
          .from('edc_account_verifications')
          .select('full_name')
          .not('full_name', 'is', null)
          .order('full_name', { ascending: true })

        if (error) throw error

        const names = (data || [])
          .map((r: any) => (typeof r?.full_name === 'string' ? r.full_name.trim() : ''))
          .filter((n: string) => !!n)

        setStaffNames(names)
        if (names.length > 0) {
          setApprovedBy((prev) => prev || names[0])
          setSalesperson((prev) => prev || names[0])
        }
      } catch (e) {
        console.error('Failed to load staff names:', e)
        setStaffNames([])
      }
    }

    void loadNames()
  }, [])

  const toNull = (v: any) => {
    if (v === undefined || v === null) return null
    if (typeof v === 'string') {
      const s = v.trim()
      return s.length ? s : null
    }
    return v
  }

  const handleClearTask = () => {
    setTaskName('')
    setTaskDescription('')
    setTaskDueBy('')
  }

  const handleAddTask = () => {
    setTasks((prev) => [
      ...prev,
      {
        name: toNull(taskName),
        description: toNull(taskDescription),
        dueBy: toNull(taskDueBy),
      },
    ])
    handleClearTask()
  }

  const resetDelivery = () => {
    setDeliveryDate('')
    setDeliveryTime('')
    setExportedOutsideOntario(false)
    setExportedPartyType('Non-Dealer')
    setDeliveryDetails('')
    setOtherNotes('')
    setApprovedBy(staffNames[0] || '')
    setSalesperson(staffNames[0] || '')
    handleClearTask()
    setTasks([])
    setSaveError(null)
  }

  const handleSave = async () => {
    try {
      setSaveError(null)
      setSaving(true)

      const payload = {
        dealId: toNull(dealId),
        dealMode: toNull(dealMode),
        deliveryDate: toNull(deliveryDate),
        deliveryTime: toNull(deliveryTime),
        exportedOutsideOntario,
        exportedPartyType: exportedOutsideOntario ? toNull(exportedPartyType) : null,
        deliveryDetails: toNull(deliveryDetails),
        otherNotes: toNull(otherNotes),
        approvedBy: toNull(approvedBy),
        salesperson: toNull(salesperson),
        newTaskDraft: {
          name: toNull(taskName),
          description: toNull(taskDescription),
          dueBy: toNull(taskDueBy),
        },
        tasks: Array.isArray(tasks) ? tasks : [],
      }

      const res = await fetch('/api/delivery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const raw = await res.text().catch(() => '')
      if (!res.ok) {
        throw new Error(raw || `Save failed (${res.status})`)
      }
      const ok = raw.trim().toLowerCase() === 'done'
      if (!ok) {
        throw new Error(raw || 'Webhook did not confirm save. Expected "Done"')
      }

      resetDelivery()
      setShowSuccessModal(true)
    } catch (e: any) {
      setSaveError(e?.message || 'Failed to save delivery')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="w-full">
      <div className="w-full space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <div className="text-xs text-gray-700 mb-2">Delivery Date</div>
              <div className="flex items-stretch border border-gray-200 rounded bg-white shadow-sm overflow-hidden">
                <div className="w-10 flex items-center justify-center bg-gray-100 text-gray-600 border-r border-gray-200">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3M5 11h14M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <input
                  type="date"
                  className="flex-1 h-10 px-3 text-sm bg-white outline-none"
                  value={deliveryDate}
                  onChange={(e) => setDeliveryDate(e.target.value)}
                />
              </div>
            </div>

            <div>
              <div className="text-xs text-gray-700 mb-2">Delivery Time</div>
              <div className="flex items-stretch border border-gray-200 rounded bg-white shadow-sm overflow-hidden">
                <div className="w-10 flex items-center justify-center bg-gray-100 text-gray-600 border-r border-gray-200">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="9" strokeWidth={2} />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 7v5l3 2" />
                  </svg>
                </div>
                <input
                  type="time"
                  className="flex-1 h-10 px-3 text-sm bg-white outline-none"
                  value={deliveryTime}
                  onChange={(e) => setDeliveryTime(e.target.value)}
                />
                <div className="w-10 flex items-center justify-center bg-gray-100 text-gray-600 border-l border-gray-200">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="9" strokeWidth={2} />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11v5" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8h.01" />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          <div>
            <label className="flex items-center gap-2 text-xs text-gray-700">
              Was the deal exported outside of Ontario?
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={exportedOutsideOntario}
                onChange={(e) => setExportedOutsideOntario(e.target.checked)}
              />
            </label>

            {exportedOutsideOntario ? (
              <div className="mt-2 ml-1 space-y-1">
                <label className="flex items-center gap-2 text-xs text-gray-700">
                  <input
                    type="radio"
                    name="exportedPartyType"
                    className="h-3.5 w-3.5"
                    checked={exportedPartyType === 'Dealer'}
                    onChange={() => setExportedPartyType('Dealer')}
                  />
                  Dealer
                </label>
                <label className="flex items-center gap-2 text-xs text-gray-700">
                  <input
                    type="radio"
                    name="exportedPartyType"
                    className="h-3.5 w-3.5"
                    checked={exportedPartyType === 'Non-Dealer'}
                    onChange={() => setExportedPartyType('Non-Dealer')}
                  />
                  Non-Dealer
                </label>
              </div>
            ) : null}
          </div>

          <div>
            <div className="text-xs text-gray-700 mb-2">Delivery Details</div>
            <textarea
              placeholder="Enter delivery details (if any)"
              className="w-full min-h-[110px] border border-gray-200 bg-white shadow-sm rounded px-3 py-2 text-sm"
              value={deliveryDetails}
              onChange={(e) => setDeliveryDetails(e.target.value)}
            />
          </div>

          <div>
            <div className="text-xs text-gray-700 mb-2">Other</div>
            <textarea
              placeholder="ex: paid in full"
              className="w-full min-h-[110px] border border-gray-200 bg-white shadow-sm rounded px-3 py-2 text-sm"
              value={otherNotes}
              onChange={(e) => setOtherNotes(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <div className="text-xs text-gray-700 mb-2">Approved By</div>
              <select
                className="w-full h-10 border border-gray-200 rounded bg-white shadow-sm px-3 text-sm"
                value={approvedBy}
                onChange={(e) => setApprovedBy(e.target.value)}
              >
                {staffNames.length > 0 ? (
                  staffNames.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))
                ) : (
                  <option value="">No names found</option>
                )}
              </select>
            </div>
            <div>
              <div className="text-xs text-gray-700 mb-2">Salesperson</div>
              <select
                className="w-full h-10 border border-gray-200 rounded bg-white shadow-sm px-3 text-sm"
                value={salesperson}
                onChange={(e) => setSalesperson(e.target.value)}
              >
                {staffNames.length > 0 ? (
                  staffNames.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))
                ) : (
                  <option value="">No names found</option>
                )}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="border border-gray-200 bg-white shadow-sm">
              <div className="h-9 px-3 bg-gray-700 text-white text-xs flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3M5 11h14" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                New Task
              </div>
              <div className="p-3 space-y-3">
                <div>
                  <div className="text-xs text-gray-700 mb-1">Name:</div>
                  <input
                    className="w-full h-9 border border-gray-200 rounded bg-white px-3 text-sm"
                    placeholder="title"
                    value={taskName}
                    onChange={(e) => setTaskName(e.target.value)}
                  />
                </div>
                <div>
                  <div className="text-xs text-gray-700 mb-1">Description:</div>
                  <textarea
                    className="w-full min-h-[80px] border border-gray-200 rounded bg-white px-3 py-2 text-sm"
                    value={taskDescription}
                    onChange={(e) => setTaskDescription(e.target.value)}
                  />
                </div>
                <div>
                  <div className="text-xs text-gray-700 mb-1">Due By:</div>
                  <input
                    type="date"
                    className="w-full h-9 border border-gray-200 rounded bg-white px-3 text-sm"
                    placeholder="mm/dd/yyyy"
                    value={taskDueBy}
                    onChange={(e) => setTaskDueBy(e.target.value)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={handleClearTask}
                    className="h-8 px-4 rounded bg-red-600 text-white text-xs font-semibold hover:bg-red-700"
                  >
                    Clear
                  </button>
                  <button
                    type="button"
                    onClick={handleAddTask}
                    className="h-8 px-4 rounded bg-[#118df0] text-white text-xs font-semibold hover:bg-[#0d6ebd]"
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>

            <div className="border border-gray-200 bg-white shadow-sm">
              <div className="h-9 px-3 bg-gray-700 text-white text-xs flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Tasks
                </div>
                <button type="button" className="text-white/80 hover:text-white" aria-label="Settings">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 12a1 1 0 102 0 1 1 0 00-2 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06A2 2 0 013.4 19.7l.06-.06A1.65 1.65 0 003.8 17.8 1.65 1.65 0 002.3 16.8H2a2 2 0 010-4h.09a1.65 1.65 0 001.51-1 1.65 1.65 0 00-.33-1.82l-.06-.06A2 2 0 016.04 3.1l.06.06a1.65 1.65 0 001.82.33H8a1.65 1.65 0 001-1.51V2a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06A2 2 0 0120.9 6.04l-.06.06a1.65 1.65 0 00-.33 1.82V8c0 .66.26 1.3.73 1.77.47.47 1.11.73 1.77.73H23a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
                  </svg>
                </button>
              </div>
              <div className="p-4">
                {tasks.length === 0 ? (
                  <div className="h-16 border border-gray-200 flex items-center justify-center text-gray-500">Nothing Todo!</div>
                ) : (
                  <div className="space-y-2">
                    {tasks.map((t, idx) => (
                      <div key={idx} className="border border-gray-200 rounded px-3 py-2 text-sm text-gray-700">
                        <div className="font-medium">{t.name || 'Untitled'}</div>
                        {t.description ? <div className="text-xs text-gray-500 mt-1">{t.description}</div> : null}
                        {t.dueBy ? <div className="text-xs text-gray-500 mt-1">Due: {t.dueBy}</div> : null}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
      </div>

      {saveError ? <div className="mt-4 text-sm text-red-600">{saveError}</div> : null}

      {showSuccessModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => {
              setShowSuccessModal(false)
              router.push('/admin/sales/deals')
            }}
          />
          <div className="relative w-full max-w-md rounded-xl bg-white shadow-xl border border-gray-200">
            <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
              <div className="text-sm font-semibold text-gray-900">Success</div>
              <button
                type="button"
                className="text-gray-500 hover:text-gray-700"
                onClick={() => {
                  setShowSuccessModal(false)
                  router.push('/admin/sales/deals')
                }}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <div className="px-5 py-5">
              <div className="text-sm text-gray-700">Deal created successfully.</div>
              <div className="mt-5 flex items-center justify-end gap-2">
                <button
                  type="button"
                  className="h-9 px-4 rounded bg-[#118df0] text-white text-sm font-semibold hover:bg-[#0d6ebd]"
                  onClick={() => {
                    setShowSuccessModal(false)
                    router.push('/admin/sales/deals')
                  }}
                >
                  OK
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="mt-6 flex items-center justify-end">
        <button
          type="button"
          disabled={saving}
          onClick={handleSave}
          className="h-10 px-6 rounded bg-[#118df0] text-white text-sm font-semibold hover:bg-[#0d6ebd] disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  )
}
