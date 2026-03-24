'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

type Props = {
  formData: any
  handleChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void
  setFormData: React.Dispatch<React.SetStateAction<any>>
}

export default function VehicleDetailsForm({ formData, handleChange, setFormData }: Props) {
  const [sendingVin, setSendingVin] = useState(false)
  const [vinPrefilled, setVinPrefilled] = useState(false)
  const [lastVinSent, setLastVinSent] = useState<string>('')
  const [vinDuplicate, setVinDuplicate] = useState(false)
  const [vinChecking, setVinChecking] = useState(false)
  const [vinConfirmOpen, setVinConfirmOpen] = useState(false)
  const [vinConfirmDontShow, setVinConfirmDontShow] = useState(false)
  const [vinConfirmBalance, setVinConfirmBalance] = useState<number | null>(null)
  const [vinInsufficientOpen, setVinInsufficientOpen] = useState(false)
  const [vinInsufficientMessage, setVinInsufficientMessage] = useState('')
  const vinConfirmActionRef = useRef<null | (() => Promise<void>)>(null)
  const stockAutofillRanRef = useRef(false)
  const adEditorRef = useRef<HTMLDivElement | null>(null)
  const lastAdHtmlRef = useRef<string>('')
  const [adToolbar, setAdToolbar] = useState({
    bold: false,
    italic: false,
    underline: false,
    strike: false,
    superscript: false,
    subscript: false,
    ordered: false,
    unordered: false,
    foreColor: '#000000',
  })

  const adHtml = useMemo(() => String((formData as any)?.adDescription || ''), [formData])

  useEffect(() => {
    if (!formData?.vin || formData.vin !== lastVinSent) {
      setVinPrefilled(false)
    }
  }, [formData?.vin, lastVinSent])

  useEffect(() => {
    const vin = String(formData?.vin || '').trim()
    if (vin.length < 5) {
      setVinDuplicate(false)
      return
    }
    setVinChecking(true)
    const timer = setTimeout(async () => {
      try {
        const { count } = await supabase
          .from('edc_vehicles')
          .select('id', { count: 'exact', head: true })
          .eq('vin', vin)
        setVinDuplicate((count ?? 0) > 0)
      } catch {
        setVinDuplicate(false)
      } finally {
        setVinChecking(false)
      }
    }, 600)
    return () => clearTimeout(timer)
  }, [formData?.vin])

  useEffect(() => {
    let alive = true

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
        return (data as any)?.id ? String((data as any).id) : null
      } catch {
        return null
      }
    }

    const loadNextStockNumber = async () => {
      try {
        const current = String((formData as any)?.stockNumber ?? '').trim()
        if (current) return
        if (stockAutofillRanRef.current) return

        const userId = await getLoggedInAdminDbUserId()
        if (!userId) return
        stockAutofillRanRef.current = true

        const { data, error } = await supabase
          .from('edc_vehicles')
          .select('stock_number, created_at')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(200)

        if (error) return
        const rows = Array.isArray(data) ? data : []
        let max = 0
        let found = false

        for (const r of rows) {
          const raw = String((r as any)?.stock_number ?? '').trim()
          if (!raw) continue
          const match = raw.match(/(\d+)\s*$/)
          if (!match?.[1]) continue
          const n = Number(match[1])
          if (!Number.isFinite(n)) continue
          found = true
          if (n > max) max = n
        }

        if (!alive) return
        if (!found) return

        setFormData((prev: any) => {
          const prevStock = String(prev?.stockNumber ?? '').trim()
          if (prevStock) return prev
          return { ...prev, stockNumber: String(max + 1) }
        })
      } catch {
        // ignore
      }
    }

    void loadNextStockNumber()
    return () => {
      alive = false
    }
  }, [formData?.stockNumber, setFormData])

  useEffect(() => {
    const el = adEditorRef.current
    if (!el) return
    if (lastAdHtmlRef.current === adHtml) return
    if (el.innerHTML !== adHtml) {
      el.innerHTML = adHtml
    }
    lastAdHtmlRef.current = adHtml
  }, [adHtml])

  const refreshAdToolbar = () => {
    try {
      setAdToolbar(prev => ({
        ...prev,
        bold: document.queryCommandState('bold'),
        italic: document.queryCommandState('italic'),
        underline: document.queryCommandState('underline'),
        strike: document.queryCommandState('strikeThrough'),
        superscript: document.queryCommandState('superscript'),
        subscript: document.queryCommandState('subscript'),
        ordered: document.queryCommandState('insertOrderedList'),
        unordered: document.queryCommandState('insertUnorderedList'),
        foreColor: (document.queryCommandValue('foreColor') as string) || prev.foreColor,
      }))
    } catch {}
  }

  const preventToolbarMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
  }

  const exec = (command: string, value?: string) => {
    const el = adEditorRef.current
    if (!el) return
    el.focus()
    try {
      document.execCommand(command, false, value)
      const html = el.innerHTML
      lastAdHtmlRef.current = html
      setFormData((prev: any) => ({ ...prev, adDescription: html }))
      refreshAdToolbar()
    } catch {}
  }

  const handleAdInput = () => {
    const el = adEditorRef.current
    if (!el) return
    const html = el.innerHTML
    lastAdHtmlRef.current = html
    setFormData((prev: any) => ({ ...prev, adDescription: html }))
    refreshAdToolbar()
  }

  const handleSendVin = async () => {
    if (!formData?.vin || String(formData.vin).trim().length < 5) {
      alert('Please enter a valid VIN before sending.')
      return
    }
    try {
      let email = ''
      try {
        if (typeof window !== 'undefined') {
          const raw = window.localStorage.getItem('edc_admin_session')
          if (raw) {
            const parsed = JSON.parse(raw) as { email?: string }
            email = String(parsed?.email || '').trim().toLowerCase()
          }
        }
      } catch {
        email = ''
      }

      if (!email) throw new Error('Missing email')

      const cost = 0.5
      const shouldSkipConfirm = (() => {
        try {
          return typeof window !== 'undefined' && window.localStorage.getItem('edc_skip_vincode_confirm') === '1'
        } catch {
          return false
        }
      })()

      setSendingVin(true)
      const balRes = await fetch('/api/users/balance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const balJson = await balRes.json().catch(() => null)
      const balance = Number((balJson as any)?.balance ?? 0)
      if (!Number.isFinite(balance) || balance < cost) {
        setVinInsufficientMessage(`Insufficient Load Balance. You need $0.50 to decode this VIN, but your balance is $${Number.isFinite(balance) ? balance.toFixed(2) : '0.00'}.`)
        setVinInsufficientOpen(true)
        return
      }

      const runDecode = async () => {
        const res = await fetch('/api/vincode', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email,
            vin: String(formData.vin).trim(),
          }),
        })
        if (!res.ok) {
          const text = await res.text().catch(() => '')
          throw new Error(text || `Webhook responded with ${res.status}`)
        }
        const json = await res.json().catch(() => null)
        console.log('[vin+][details-form] webhook response:', json)
        const arr = Array.isArray(json) ? json : []
        const first = arr[0] || {}
        const decode = Array.isArray((first as any).decode) ? (first as any).decode : []
        const byLabel = (label: string) => decode.find((d: any) => d?.label === label)?.value
        const flatGet = (key: string) => {
          const entries = Object.entries(first || {}).map(([k, v]) => [String(k).trim().toLowerCase(), v] as const)
          const want = key.trim().toLowerCase()
          const hit = entries.find(([k]) => k === want)
          return hit ? hit[1] : undefined
        }
        const mapBodyToBodyStyle = (val: string | undefined) => {
          if (!val) return ''
          const s = val.toLowerCase()
          if (s.includes('pickup')) return 'Truck'
          if (s.includes('suv')) return 'SUV'
          if (s.includes('truck')) return 'Truck'
          if (s.includes('coupe')) return 'Coupe'
          if (s.includes('hatch')) return 'Hatchback'
          if (s.includes('wagon')) return 'Wagon'
          if (s.includes('van')) return 'Van'
          if (s.includes('convertible')) return 'Convertible'
          if (s.includes('sedan')) return 'Sedan'
          return ''
        }
        const mapDrive = (val: string | undefined) => {
          if (!val) return ''
          const s = val.toLowerCase()
          if (s.includes('4')) return '4WD'
          if (s.includes('awd')) return 'AWD'
          if (s.includes('fwd')) return 'FWD'
          if (s.includes('rwd')) return 'RWD'
          return ''
        }
        setFormData((prev: any) => ({
          ...prev,
          vin: String(formData.vin).trim(),
          make: String(byLabel('Make') ?? flatGet('make') ?? prev.make ?? ''),
          model: String(byLabel('Model') ?? flatGet('model') ?? prev.model ?? ''),
          year: String(byLabel('Model Year') ?? byLabel('Year') ?? flatGet('year') ?? prev.year ?? ''),
          trim: String(byLabel('Trim') ?? flatGet('trim') ?? prev.trim ?? ''),
          bodyStyle: mapBodyToBodyStyle(String(byLabel('Body') ?? flatGet('body') ?? flatGet('bodystyle') ?? '')) || prev.bodyStyle || '',
          drivetrain: mapDrive(String(byLabel('Drive') ?? byLabel('Drive Type') ?? flatGet('drivetrain') ?? flatGet('drive') ?? '')) || prev.drivetrain || '',
          fuelType: String(byLabel('Fuel Type') ?? flatGet('fuel type') ?? flatGet('fueltype') ?? prev.fuelType ?? ''),
        }))
        setVinPrefilled(true)
        setLastVinSent(String(formData.vin).trim())
      }

      if (shouldSkipConfirm) {
        await runDecode()
        return
      }

      setVinConfirmBalance(balance)
      setVinConfirmDontShow(false)
      vinConfirmActionRef.current = async () => {
        await runDecode()
      }
      setVinConfirmOpen(true)
    } catch (err) {
      console.error('Error sending VIN webhook:', err)
      alert('Failed to send VIN. Please try again.')
    } finally {
      setSendingVin(false)
    }
  }
  return (
    <div>
      {vinConfirmOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-navy-900/60 backdrop-blur-sm" onMouseDown={() => setVinConfirmOpen(false)} />
          <div className="edc-modal w-full max-w-md relative z-10" onMouseDown={(e) => e.stopPropagation()}>
            <div className="h-11 px-4 border-b border-slate-200/60 flex items-center justify-between">
              <div className="text-sm font-semibold text-slate-800">Vincode Decode</div>
              <button type="button" className="h-8 w-8 flex items-center justify-center" onClick={() => setVinConfirmOpen(false)}>
                <span className="text-xl leading-none text-slate-400">×</span>
              </button>
            </div>
            <div className="p-4 text-sm text-slate-700">
              <div>This action will decode the VIN using Load Balance.</div>
              <div className="mt-2 font-semibold text-slate-900">Cost: $0.50</div>
              {vinConfirmBalance != null ? (
                <div className="mt-1 text-xs text-slate-500">Your balance: ${vinConfirmBalance.toFixed(2)}</div>
              ) : null}
              <div className="mt-4 flex items-center gap-2">
                <input
                  id="vincodeDontShow"
                  type="checkbox"
                  checked={vinConfirmDontShow}
                  onChange={(e) => setVinConfirmDontShow(e.target.checked)}
                  className="h-4 w-4"
                />
                <label htmlFor="vincodeDontShow" className="text-xs text-slate-600">
                  Don’t show again
                </label>
              </div>
            </div>
            <div className="h-12 px-4 border-t border-slate-200/60 flex items-center justify-end gap-2">
              <button type="button" className="h-9 px-4 rounded-lg bg-slate-100 text-slate-700 text-sm font-semibold" onClick={() => setVinConfirmOpen(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="h-9 px-4 rounded-lg bg-[#118df0] text-white text-sm font-semibold disabled:opacity-60"
                disabled={sendingVin}
                onClick={async () => {
                  const fn = vinConfirmActionRef.current
                  setVinConfirmOpen(false)
                  if (!fn) return
                  try {
                    if (vinConfirmDontShow) {
                      try {
                        if (typeof window !== 'undefined') window.localStorage.setItem('edc_skip_vincode_confirm', '1')
                      } catch {}
                    }
                    await fn()
                  } catch (e: any) {
                    alert(e?.message || 'Failed to decode VIN')
                  }
                }}
              >
                {sendingVin ? 'Processing…' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {vinInsufficientOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-navy-900/60 backdrop-blur-sm" onMouseDown={() => setVinInsufficientOpen(false)} />
          <div className="edc-modal w-full max-w-md relative z-10" onMouseDown={(e) => e.stopPropagation()}>
            <div className="h-11 px-4 border-b border-slate-200/60 flex items-center justify-between">
              <div className="text-sm font-semibold text-slate-800">Insufficient Balance</div>
              <button type="button" className="h-8 w-8 flex items-center justify-center" onClick={() => setVinInsufficientOpen(false)}>
                <span className="text-xl leading-none text-slate-400">×</span>
              </button>
            </div>
            <div className="p-4 text-sm text-slate-700">{vinInsufficientMessage || 'Insufficient Load Balance.'}</div>
            <div className="h-12 px-4 border-t border-slate-200/60 flex items-center justify-end gap-2">
              <button type="button" className="edc-btn-primary h-9 px-4 text-sm" onClick={() => setVinInsufficientOpen(false)}>
                OK
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <h2 className="text-lg font-semibold mb-4 border-b pb-2">Basic Information</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Make *</label>
          <input type="text" name="make" required value={formData.make} onChange={handleChange} placeholder="e.g., Toyota" className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Model *</label>
          <input type="text" name="model" required value={formData.model} onChange={handleChange} placeholder="e.g., Camry" className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Year *</label>
          <input type="number" name="year" required value={formData.year} onChange={handleChange} min={1990} max={new Date().getFullYear() + 1} className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Price ($) *</label>
          <input type="number" name="price" required value={formData.price} onChange={handleChange} placeholder="e.g., 25000" className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Mileage (km) *</label>
          <input type="number" name="mileage" required value={formData.mileage} onChange={handleChange} placeholder="e.g., 50000" className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
          <select name="status" value={formData.status} onChange={handleChange} className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent">
            <option value="In Stock">In Stock</option>
            <option value="In Stock (No Feed)">In Stock (No Feed)</option>
            <option value="Coming Soon">Coming Soon</option>
            <option value="In Trade">In Trade</option>
            <option value="Deal Pending">Deal Pending</option>
            <option value="Sold">Sold</option>
            <option value="Void">Void</option>
            <option value="Other">Other</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Inventory Type</label>
          <select name="inventoryType" value={formData.inventoryType} onChange={handleChange} className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent">
            <option value="FLEET">Fleet Cars</option>
            <option value="PREMIERE">Premiere Cars</option>
          </select>
        </div>
      </div>

      <div className="mt-8">
        <h2 className="text-lg font-semibold mb-4 border-b pb-2">Identification & Location</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Stock Number (Unit ID)</label>
            <input type="text" name="stockNumber" value={formData.stockNumber} onChange={handleChange} placeholder="e.g., 8FDJTG" className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">In Stock Date</label>
            <input type="date" name="inStockDate" value={formData.inStockDate} onChange={handleChange} className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">VIN *</label>
            <div className="relative">
              <input
                type="text"
                name="vin"
                required
                value={formData.vin}
                onChange={handleChange}
                placeholder="Vehicle Identification Number"
                className={`w-full border rounded-lg pl-4 pr-10 py-2 focus:ring-2 focus:border-transparent transition-colors ${
                  vinDuplicate
                    ? 'border-red-500 bg-red-50 focus:ring-red-300'
                    : 'border-gray-300 focus:ring-[#118df0]'
                }`}
              />
              {vinChecking && (
                <span className="absolute inset-y-0 right-10 flex items-center pr-2 text-xs text-gray-400">checking…</span>
              )}
              {(!vinPrefilled || String(formData.vin).trim() !== lastVinSent) && (
                <button
                  type="button"
                  title="Add VIN"
                  className={`absolute inset-y-0 right-0 flex items-center px-3 text-white rounded-r-lg ${
                    sendingVin ? 'bg-gray-400 cursor-not-allowed' : 'bg-[#118df0] hover:bg-[#0d6ebd]'
                  }`}
                  onClick={handleSendVin}
                  disabled={sendingVin}
                >
                  {sendingVin ? '...' : '+'}
                </button>
              )}
            </div>
            {vinDuplicate && (
              <p className="mt-1 text-xs font-medium text-red-600">
                VIN code is already taken. Use another VIN code to proceed.
              </p>
            )}
          </div>
          <div className="md:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Odometer</label>
              <input type="number" name="odometer" value={formData.odometer} onChange={handleChange} placeholder="odometer" className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
              <select name="odometerUnit" value={formData.odometerUnit} onChange={handleChange} className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent">
                <option value="kms">kms</option>
                <option value="miles">miles</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Series</label>
            <input type="text" name="series" value={formData.series} onChange={handleChange} placeholder="e.g., 40K4, 45KF" className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">City *</label>
            <input type="text" name="city" required value={formData.city} onChange={handleChange} placeholder="e.g., Toronto" className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Province *</label>
            <select name="province" required value={formData.province} onChange={handleChange} className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent">
              <option value="ON">Ontario</option>
              <option value="QC">Quebec</option>
              <option value="BC">British Columbia</option>
              <option value="AB">Alberta</option>
              <option value="MB">Manitoba</option>
              <option value="SK">Saskatchewan</option>
              <option value="NS">Nova Scotia</option>
              <option value="NB">New Brunswick</option>
              <option value="NL">Newfoundland</option>
              <option value="PE">PEI</option>
            </select>
          </div>
        </div>
      </div>

      <div className="mt-8">
        <h2 className="text-lg font-semibold mb-4 border-b pb-2">Specifications</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fuel Type</label>
            <select name="fuelType" value={formData.fuelType} onChange={handleChange} className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent">
              <option value="Gasoline">Gasoline</option>
              <option value="Diesel">Diesel</option>
              <option value="Hybrid">Hybrid</option>
              <option value="Electric">Electric</option>
              <option value="Plug-in Hybrid">Plug-in Hybrid</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Transmission</label>
            <select name="transmission" value={formData.transmission} onChange={handleChange} className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent">
              <option value="Automatic">Automatic</option>
              <option value="Manual">Manual</option>
              <option value="CVT">CVT</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Drivetrain</label>
            <select name="drivetrain" value={formData.drivetrain} onChange={handleChange} className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent">
              <option value="FWD">FWD</option>
              <option value="RWD">RWD</option>
              <option value="AWD">AWD</option>
              <option value="4WD">4WD</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Body Style *</label>
            <select name="bodyStyle" required value={formData.bodyStyle} onChange={handleChange} className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent">
              <option value="">Select...</option>
              <option value="Sedan">Sedan</option>
              <option value="SUV">SUV</option>
              <option value="Truck">Truck</option>
              <option value="Coupe">Coupe</option>
              <option value="Hatchback">Hatchback</option>
              <option value="Wagon">Wagon</option>
              <option value="Van">Van</option>
              <option value="Convertible">Convertible</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Vehicle Type</label>
            <input type="text" name="vehicleType" value={formData.vehicleType || ''} onChange={handleChange} placeholder="Vehicle Type" className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Trim</label>
            <input type="text" name="trim" value={formData.trim} onChange={handleChange} placeholder="e.g., SE, XLE, Limited" className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent" />
          </div>
        </div>
      </div>

      <div className="mt-8">
        <h2 className="text-lg font-semibold mb-4 border-b pb-2">Engine</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Engine</label>
            <input type="text" name="engine" value={(formData as any).engine || ''} onChange={handleChange} className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cylinders</label>
            <input type="text" name="cylinders" value={(formData as any).cylinders || ''} onChange={handleChange} className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fuel Type</label>
            <select name="fuelType" value={formData.fuelType} onChange={handleChange} className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent">
              <option value="Gasoline">Gasoline</option>
              <option value="Diesel">Diesel</option>
              <option value="Hybrid">Hybrid</option>
              <option value="Electric">Electric</option>
              <option value="Plug-in Hybrid">Plug-in Hybrid</option>
            </select>
          </div>
        </div>
      </div>

      <div className="mt-8">
        <h2 className="text-lg font-semibold mb-4 border-b pb-2">Transmission</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Transmission Type</label>
            <select name="transmission" value={formData.transmission} onChange={handleChange} className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent">
              <option value="Automatic">Automatic</option>
              <option value="Manual">Manual</option>
              <option value="CVT">CVT</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Drive Type</label>
            <select name="drivetrain" value={formData.drivetrain} onChange={handleChange} className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent">
              <option value="FWD">FWD</option>
              <option value="RWD">RWD</option>
              <option value="AWD">AWD</option>
              <option value="4WD">4WD</option>
            </select>
          </div>
        </div>
      </div>

      <div className="mt-8">
        <h2 className="text-lg font-semibold mb-4 border-b pb-2">Other</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Doors</label>
            <input type="number" name="doors" value={formData.doors || ''} onChange={handleChange} className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Exterior Colour</label>
            <input type="text" name="exteriorColor" value={formData.exteriorColor} onChange={handleChange} className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Interior Colour</label>
            <input type="text" name="interiorColor" value={formData.interiorColor} onChange={handleChange} className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Key #</label>
            <input type="text" name="keyNumber" value={formData.keyNumber} onChange={handleChange} className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Key Description</label>
            <input type="text" name="keyDescription" value={formData.keyDescription} onChange={handleChange} className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Lot Location</label>
            <textarea name="lotLocation" rows={2} value={formData.lotLocation || ''} onChange={handleChange} className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent" placeholder="Ex: At auction"></textarea>
          </div>
          <div className="md:col-span-3">
            <label className="block text-sm font-medium text-gray-700 mb-1">Other</label>
            <input type="text" name="other" value={(formData as any).other || ''} onChange={handleChange} placeholder="Ex: paid" className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent" />
          </div>
          <div className="md:col-span-3">
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea name="notes" rows={3} value={(formData as any).notes || ''} onChange={handleChange} placeholder="Ex: Has funny smell." className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent"></textarea>
          </div>
        </div>
      </div>

      <div className="mt-8">
        <h2 className="text-lg font-semibold mb-4 border-b pb-2">Inventory Export Feeds</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-center justify-between border rounded px-3 py-2">
            <span>Feed to AutoTrader?</span>
            <input type="checkbox" checked={!!(formData as any).feedToAutotrader} onChange={(e)=>setFormData((prev: any)=>({...prev, feedToAutotrader: e.target.checked}))} />
          </div>
          <div className="flex items-center justify-between border rounded px-3 py-2">
            <span>Feed to Carpages?</span>
            <input type="checkbox" checked={!!(formData as any).feedToCarpages} onChange={(e)=>setFormData((prev: any)=>({...prev, feedToCarpages: e.target.checked}))} />
          </div>
          <div className="flex items-center justify-between border rounded px-3 py-2">
            <span>Feed to Cargurus?</span>
            <input type="checkbox" checked={!!(formData as any).feedToCargurus} onChange={(e)=>setFormData((prev: any)=>({...prev, feedToCargurus: e.target.checked}))} />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Keywords</label>
            <input type="text" name="keywords" value={(formData as any).keywords || ''} onChange={handleChange} placeholder="Add keywords" className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Feedwords</label>
            <input type="text" name="feedwords" value={(formData as any).feedwords || ''} onChange={handleChange} placeholder="Add feedword" className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent" />
          </div>
        </div>
      </div>

      <div className="mt-8">
        <h2 className="text-lg font-semibold mb-4 border-b pb-2">Advertisement Description</h2>
        <div className="border border-gray-300 rounded-lg overflow-hidden">
          <div className="flex flex-wrap items-center gap-1 p-2 border-b border-gray-300 bg-gray-50">
            <button type="button" onMouseDown={preventToolbarMouseDown} onClick={() => exec('bold')} className={`px-2 py-1 border border-gray-300 rounded text-sm font-bold ${adToolbar.bold ? 'bg-[#118df0] text-white' : 'bg-white'}`}>B</button>
            <button type="button" onMouseDown={preventToolbarMouseDown} onClick={() => exec('italic')} className={`px-2 py-1 border border-gray-300 rounded text-sm italic ${adToolbar.italic ? 'bg-[#118df0] text-white' : 'bg-white'}`}>I</button>
            <button type="button" onMouseDown={preventToolbarMouseDown} onClick={() => exec('underline')} className={`px-2 py-1 border border-gray-300 rounded text-sm underline ${adToolbar.underline ? 'bg-[#118df0] text-white' : 'bg-white'}`}>U</button>
            <button type="button" onClick={() => exec('justifyLeft')} className="px-2 py-1 border border-gray-300 bg-white rounded text-sm">≡</button>
            <span className="w-px h-6 bg-gray-300 mx-1"></span>
            <button type="button" onMouseDown={preventToolbarMouseDown} onClick={() => exec('strikeThrough')} className={`px-2 py-1 border border-gray-300 rounded text-sm line-through ${adToolbar.strike ? 'bg-[#118df0] text-white' : 'bg-white'}`}>S</button>
            <button type="button" onMouseDown={preventToolbarMouseDown} onClick={() => exec('superscript')} className={`px-2 py-1 border border-gray-300 rounded text-sm ${adToolbar.superscript ? 'bg-[#118df0] text-white' : 'bg-white'}`}>X²</button>
            <button type="button" onMouseDown={preventToolbarMouseDown} onClick={() => exec('subscript')} className={`px-2 py-1 border border-gray-300 rounded text-sm ${adToolbar.subscript ? 'bg-[#118df0] text-white' : 'bg-white'}`}>X₂</button>
            <span className="w-px h-6 bg-gray-300 mx-1"></span>
            <select
              className="border border-gray-300 bg-white rounded px-2 py-1 text-sm"
              onChange={(e) => {
                const v = e.target.value
                if (!v) return
                exec('fontSize', v)
                e.currentTarget.selectedIndex = 0
              }}
              defaultValue=""
            >
              <option value="">16</option>
              <option value="2">12</option>
              <option value="3">14</option>
              <option value="4">16</option>
              <option value="5">18</option>
              <option value="6">24</option>
            </select>
            <input
              type="color"
              value={adToolbar.foreColor}
              onChange={(e) => {
                setAdToolbar(prev => ({ ...prev, foreColor: e.target.value }))
                exec('foreColor', e.target.value)
              }}
              className="w-8 h-8 p-0 border border-gray-300 rounded"
            />
            <button type="button" onMouseDown={preventToolbarMouseDown} onClick={() => exec('insertUnorderedList')} className={`px-2 py-1 border border-gray-300 rounded text-sm ${adToolbar.unordered ? 'bg-[#118df0] text-white' : 'bg-white'}`}>•</button>
            <button type="button" onMouseDown={preventToolbarMouseDown} onClick={() => exec('insertOrderedList')} className={`px-2 py-1 border border-gray-300 rounded text-sm ${adToolbar.ordered ? 'bg-[#118df0] text-white' : 'bg-white'}`}>1.</button>
          </div>
          <div
            ref={adEditorRef}
            contentEditable
            suppressContentEditableWarning
            onInput={handleAdInput}
            onMouseUp={refreshAdToolbar}
            onKeyUp={refreshAdToolbar}
            onFocus={refreshAdToolbar}
            className="w-full p-4 focus:outline-none text-sm min-h-[200px]"
          />
        </div>
      </div>
    </div>
  )
}
