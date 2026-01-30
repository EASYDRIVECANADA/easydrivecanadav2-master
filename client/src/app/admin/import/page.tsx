'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'

type ImportRowResult = {
  row: number
  vin: string
  success: boolean
  error?: string
  imageGenerated?: boolean
}

type ImportResult = {
  summary: { total: number; successful: number; failed: number }
  rows: ImportRowResult[]
  message?: string
}

type VendorInventoryRow = {
  id: string
  d: number | null
  location: string | null
  unit_id: string | null
  type: string | null
  year: number | null
  make: string | null
  model: string | null
  series: string | null
  kilometers: number | null
  ext_color: string | null
  vin: string
  price: number | null
  equip: string | null
  created_at: string
  updated_at: string
  image_url: string | null
  image_generated: boolean
}

export default function AdminImportPage() {
  const [file, setFile] = useState<File | null>(null)
  const [inventoryType, setInventoryType] = useState<'FLEET' | 'PREMIERE'>('FLEET')
  const [importing, setImporting] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [processingText, setProcessingText] = useState('Processing…')
  const [processingFileName, setProcessingFileName] = useState('')
  const [result, setResult] = useState<ImportResult | null>(null)
  const [errors, setErrors] = useState<string[]>([])
  const [dragging, setDragging] = useState(false)
  const [vendorsRows, setVendorsRows] = useState<VendorInventoryRow[]>([])
  const [vendorsLoading, setVendorsLoading] = useState(false)
  const [vendorsError, setVendorsError] = useState<string | null>(null)
  const [vendorsSearch, setVendorsSearch] = useState('')
  const [vendorsType, setVendorsType] = useState<'FLEET' | 'PREMIERE'>('FLEET')
  const [vendorsMake, setVendorsMake] = useState('')
  const [vendorsModel, setVendorsModel] = useState('')
  const [vendorsYear, setVendorsYear] = useState('')
  const [vendorsLocation, setVendorsLocation] = useState('')
  const [vendorsPage, setVendorsPage] = useState(1)
  const [vendorsPageSize, setVendorsPageSize] = useState(10)
  const [selectedVendorIds, setSelectedVendorIds] = useState<Record<string, boolean>>({})
  const selectAllRef = useRef<HTMLInputElement>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmTitle, setConfirmTitle] = useState('')
  const [confirmMessage, setConfirmMessage] = useState('')
  const confirmActionRef = useRef<null | (() => Promise<void>)>(null)
  const [confirmLoading, setConfirmLoading] = useState(false)
  const [editingVendor, setEditingVendor] = useState<VendorInventoryRow | null>(null)
  const [editingD, setEditingD] = useState('')
  const [editingLocation, setEditingLocation] = useState('')
  const [editingUnitId, setEditingUnitId] = useState('')
  const [editingYear, setEditingYear] = useState('')
  const [editingMake, setEditingMake] = useState('')
  const [editingModel, setEditingModel] = useState('')
  const [editingSeries, setEditingSeries] = useState('')
  const [editingKilometers, setEditingKilometers] = useState('')
  const [editingExtColor, setEditingExtColor] = useState('')
  const [editingVin, setEditingVin] = useState('')
  const [editingPrice, setEditingPrice] = useState('')
  const [editingEquip, setEditingEquip] = useState('')
  const [savingVendor, setSavingVendor] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'

  useEffect(() => {
    const sessionStr = localStorage.getItem('edc_admin_session')
    if (!sessionStr) {
      router.push('/admin')
      return
    }
  }, [router])

  useEffect(() => {
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current)
    }
  }, [])

  const fetchVendorsRows = useCallback(async (type: 'FLEET' | 'PREMIERE') => {
    setVendorsLoading(true)
    setVendorsError(null)
    try {
      const { data, error } = await supabase
        .from('edc_vendors_inventory')
        .select(
          'id, d, location, unit_id, type, year, make, model, series, kilometers, ext_color, vin, price, equip, created_at, updated_at, image_url, image_generated'
        )
        .eq('type', type)
        .order('created_at', { ascending: false })
        .limit(200)

      if (error) throw error
      setVendorsRows((data || []) as VendorInventoryRow[])
      setSelectedVendorIds({})
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to load vendors inventory'
      setVendorsError(message)
    } finally {
      setVendorsLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchVendorsRows(vendorsType)
    setVendorsPage(1)
  }, [vendorsType, fetchVendorsRows])

  const makeOptions = Array.from(new Set(vendorsRows.map((r) => String(r.make || '').trim()).filter(Boolean))).sort(
    (a, b) => a.localeCompare(b)
  )
  const modelOptions = Array.from(new Set(vendorsRows.map((r) => String(r.model || '').trim()).filter(Boolean))).sort(
    (a, b) => a.localeCompare(b)
  )
  const yearOptions = Array.from(
    new Set(
      vendorsRows
        .map((r) => (typeof r.year === 'number' ? String(r.year) : ''))
        .map((v) => v.trim())
        .filter(Boolean)
    )
  ).sort((a, b) => Number(b) - Number(a))
  const locationOptions = Array.from(
    new Set(vendorsRows.map((r) => String(r.location || '').trim()).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b))

  const filteredVendorsRows = vendorsRows.filter((row) => {
    if (vendorsMake && String(row.make || '').toLowerCase() !== vendorsMake.toLowerCase()) return false
    if (vendorsModel && String(row.model || '').toLowerCase() !== vendorsModel.toLowerCase()) return false
    if (vendorsYear && String(row.year ?? '') !== vendorsYear) return false
    if (vendorsLocation && String(row.location || '').toLowerCase() !== vendorsLocation.toLowerCase()) return false

    const q = vendorsSearch.trim().toLowerCase()
    if (!q) return true

    const haystack = [
      row.d != null ? String(row.d) : '',
      row.location || '',
      row.unit_id || '',
      row.year != null ? String(row.year) : '',
      row.make || '',
      row.model || '',
      row.series || '',
      row.kilometers != null ? String(row.kilometers) : '',
      row.ext_color || '',
      row.vin || '',
      row.price != null ? String(row.price) : '',
      row.equip || '',
    ]
      .join(' ')
      .toLowerCase()

    return haystack.includes(q)
  })

  useEffect(() => {
    setVendorsPage(1)
  }, [vendorsSearch, vendorsType, vendorsMake, vendorsModel, vendorsYear, vendorsLocation])

  useEffect(() => {
    setVendorsPage(1)
  }, [vendorsPageSize])

  const totalVendorsPages = Math.max(1, Math.ceil(filteredVendorsRows.length / vendorsPageSize))
  const currentVendorsPage = Math.min(vendorsPage, totalVendorsPages)
  const pagedVendorsRows = filteredVendorsRows.slice(
    (currentVendorsPage - 1) * vendorsPageSize,
    currentVendorsPage * vendorsPageSize
  )

  const pageRowIds = pagedVendorsRows.map((r) => r.id)
  const selectedCount = Object.values(selectedVendorIds).filter(Boolean).length
  const pageSelectedCount = pageRowIds.filter((id) => selectedVendorIds[id]).length
  const allOnPageSelected = pageRowIds.length > 0 && pageSelectedCount === pageRowIds.length
  const someOnPageSelected = pageSelectedCount > 0 && pageSelectedCount < pageRowIds.length

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someOnPageSelected
    }
  }, [someOnPageSelected, pageSelectedCount, pageRowIds.length])

  const toggleSelectAllOnPage = () => {
    setSelectedVendorIds((prev) => {
      const next = { ...prev }
      if (allOnPageSelected) {
        pageRowIds.forEach((id) => {
          delete next[id]
        })
      } else {
        pageRowIds.forEach((id) => {
          next[id] = true
        })
      }
      return next
    })
  }

  const toggleSelectRow = (id: string) => {
    setSelectedVendorIds((prev) => {
      const next = { ...prev }
      if (next[id]) delete next[id]
      else next[id] = true
      return next
    })
  }

  const bulkDeleteSelected = async () => {
    const ids = Object.keys(selectedVendorIds).filter((k) => selectedVendorIds[k])
    if (ids.length === 0) return

    setConfirmTitle('Delete selected rows?')
    setConfirmMessage(`Delete ${ids.length} selected row(s)? This action cannot be undone.`)
    confirmActionRef.current = async () => {
      setVendorsLoading(true)
      setVendorsError(null)
      try {
        const { error } = await supabase.from('edc_vendors_inventory').delete().in('id', ids)
        if (error) throw error
        setVendorsRows((prev) => prev.filter((r) => !ids.includes(r.id)))
        setSelectedVendorIds({})
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Failed to delete selected rows'
        setVendorsError(msg)
      } finally {
        setVendorsLoading(false)
      }
    }
    setConfirmOpen(true)
  }

  const openEditVendor = (row: VendorInventoryRow) => {
    setVendorsError(null)
    setEditingVendor(row)
    setEditingD(row.d != null ? String(row.d) : '')
    setEditingLocation(row.location || '')
    setEditingUnitId(row.unit_id || '')
    setEditingYear(row.year != null ? String(row.year) : '')
    setEditingMake(row.make || '')
    setEditingModel(row.model || '')
    setEditingSeries(row.series || '')
    setEditingKilometers(row.kilometers != null ? String(row.kilometers) : '')
    setEditingExtColor(row.ext_color || '')
    setEditingVin(row.vin || '')
    setEditingPrice(row.price != null ? String(row.price) : '')
    setEditingEquip(row.equip || '')
  }

  const closeEditVendor = () => {
    if (savingVendor) return
    setEditingVendor(null)
  }

  const saveEditVendor = async () => {
    if (!editingVendor) return
    setSavingVendor(true)
    setVendorsError(null)

    const parseIntOrNull = (v: string) => {
      const n = Number.parseInt(String(v).trim(), 10)
      return Number.isFinite(n) ? n : null
    }
    const parseFloatOrNull = (v: string) => {
      const n = Number.parseFloat(String(v).trim())
      return Number.isFinite(n) ? n : null
    }

    const payload = {
      d: editingD.trim() ? parseIntOrNull(editingD) : null,
      location: editingLocation.trim() || null,
      unit_id: editingUnitId.trim() || null,
      year: editingYear.trim() ? parseIntOrNull(editingYear) : null,
      make: editingMake.trim() || null,
      model: editingModel.trim() || null,
      series: editingSeries.trim() || null,
      kilometers: editingKilometers.trim() ? parseIntOrNull(editingKilometers) : null,
      ext_color: editingExtColor.trim() || null,
      vin: editingVin.trim(),
      price: editingPrice.trim() ? parseFloatOrNull(editingPrice) : null,
      equip: editingEquip.trim() || null,
      updated_at: new Date().toISOString(),
    }

    if (!payload.vin) {
      setVendorsError('VIN is required')
      setSavingVendor(false)
      return
    }

    try {
      const { error } = await supabase.from('edc_vendors_inventory').update(payload).eq('id', editingVendor.id)
      if (error) throw error

      setVendorsRows((prev) =>
        prev.map((r) =>
          r.id === editingVendor.id
            ? {
                ...r,
                ...payload,
                price: payload.price as any,
                d: payload.d as any,
                year: payload.year as any,
                kilometers: payload.kilometers as any,
              }
            : r
        )
      )

      setEditingVendor(null)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to update row'
      setVendorsError(msg)
    } finally {
      setSavingVendor(false)
    }
  }

  const deleteVendor = async (row: VendorInventoryRow) => {
    setConfirmTitle('Delete row?')
    setConfirmMessage(`Delete this row? This action cannot be undone.\n\nVIN: ${row.vin}`)
    confirmActionRef.current = async () => {
      setVendorsLoading(true)
      setVendorsError(null)
      try {
        const { error } = await supabase.from('edc_vendors_inventory').delete().eq('id', row.id)
        if (error) throw error
        setVendorsRows((prev) => prev.filter((r) => r.id !== row.id))
        setSelectedVendorIds((prev) => {
          const next = { ...prev }
          delete next[row.id]
          return next
        })
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Failed to delete row'
        setVendorsError(msg)
      } finally {
        setVendorsLoading(false)
      }
    }
    setConfirmOpen(true)
  }

  const failedRows = result ? result.rows.filter((row) => !row.success) : []

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0])
      setResult(null)
      setErrors([])
    }
  }

  const acceptDroppedFile = (next: File) => {
    const name = String(next.name || '')
    const lower = name.toLowerCase()
    const ok = lower.endsWith('.csv') || lower.endsWith('.xlsx')
    if (!ok) {
      setErrors(['Please upload a .csv or .xlsx file'])
      return
    }
    setFile(next)
    setResult(null)
    setErrors([])
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragging(false)
    const next = e.dataTransfer.files?.[0]
    if (!next) return
    acceptDroppedFile(next)
  }

  const handleImport = async () => {
    if (!file) return

    const baselineLatest = vendorsRows.length > 0 ? vendorsRows[0].created_at : null

    setImporting(true)
    setProcessing(true)
    setProcessingFileName(file.name)
    setProcessingText('Uploading…')
    setResult(null)
    setErrors([])

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('inventoryType', inventoryType)

      const res = await fetch('/api/vendors-webhook', {
        method: 'POST',
        body: formData,
      })

      const raw = await res.text()
      let data: unknown = null
      try {
        data = raw ? JSON.parse(raw) : null
      } catch {
        data = null
      }

      if (!res.ok) {
        const message =
          (typeof data === 'object' && data && 'error' in data && typeof (data as any).error === 'string'
            ? (data as any).error
            : raw) || 'Upload failed'
        setErrors([message])
        setProcessing(false)
        setProcessingText('Processing…')
        return
      }

      setProcessingText('Processing…')

      const message =
        (typeof data === 'object' && data && 'message' in data && typeof (data as any).message === 'string'
          ? (data as any).message
          : 'File uploaded successfully')

      setResult({
        summary: {
          total:
            typeof data === 'object' && data && 'summary' in data && (data as any).summary && typeof (data as any).summary.total === 'number'
              ? (data as any).summary.total
              : 1,
          successful:
            typeof data === 'object' && data && 'summary' in data && (data as any).summary && typeof (data as any).summary.successful === 'number'
              ? (data as any).summary.successful
              : 1,
          failed:
            typeof data === 'object' && data && 'summary' in data && (data as any).summary && typeof (data as any).summary.failed === 'number'
              ? (data as any).summary.failed
              : 0,
        },
        rows:
          typeof data === 'object' && data && 'rows' in data && Array.isArray((data as any).rows)
            ? (data as any).rows
            : [],
        message,
      })

      setFile(null)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }

      const maybeCompleted =
        typeof data === 'object' &&
        data &&
        ((('status' in data && typeof (data as any).status === 'string' && (data as any).status.toLowerCase() === 'completed') as boolean) ||
          (('completed' in data && typeof (data as any).completed === 'boolean' && (data as any).completed) as boolean))

      if (maybeCompleted) {
        setProcessing(false)
        await fetchVendorsRows(vendorsType)
        return
      }

      if (pollTimerRef.current) clearInterval(pollTimerRef.current)
      const startedAt = Date.now()
      pollTimerRef.current = setInterval(async () => {
        try {
          const { data: latestRows, error } = await supabase
            .from('edc_vendors_inventory')
            .select('created_at')
            .eq('type', vendorsType)
            .order('created_at', { ascending: false })
            .limit(1)
          if (error) throw error

          const latest = latestRows && latestRows[0] ? String((latestRows[0] as any).created_at || '') : ''
          const changed = !!latest && (!baselineLatest || latest !== baselineLatest)

          if (changed) {
            if (pollTimerRef.current) {
              clearInterval(pollTimerRef.current)
              pollTimerRef.current = null
            }

            setVendorsLoading(true)
            setVendorsError(null)
            try {
              await fetchVendorsRows(vendorsType)
              setProcessing(false)
              if (pollTimerRef.current) {
                clearInterval(pollTimerRef.current)
                pollTimerRef.current = null
              }
            } catch (e) {
              const message = e instanceof Error ? e.message : 'Failed to load vendors inventory'
              setVendorsError(message)
            } finally {
              setVendorsLoading(false)
            }
            return
          }

          const elapsedMs = Date.now() - startedAt
          if (elapsedMs > 10 * 60 * 1000) {
            if (pollTimerRef.current) {
              clearInterval(pollTimerRef.current)
              pollTimerRef.current = null
            }
            setProcessing(false)
            setErrors(['Still processing. Please wait a bit more then press Refresh.'])
          } else {
            const seconds = Math.floor(elapsedMs / 1000)
            setProcessingText(`Processing… (${seconds}s)`)
          }
        } catch {
          const elapsedMs = Date.now() - startedAt
          if (elapsedMs > 10 * 60 * 1000) {
            if (pollTimerRef.current) {
              clearInterval(pollTimerRef.current)
              pollTimerRef.current = null
            }
            setProcessing(false)
            setErrors(['Still processing. Please wait a bit more then press Refresh.'])
          }
        }
      }, 2000)
    } catch {
      setErrors(['Failed to connect to server'])
      setProcessing(false)
      setProcessingText('Processing…')
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {processing ? (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30" />
          <div className="relative w-full max-w-2xl rounded-2xl bg-white px-8 py-7 shadow-xl">
            <div className="flex items-center gap-5">
              <div className="relative h-14 w-14 shrink-0">
                <div className="absolute inset-0 rounded-full border-[6px] border-gray-200" />
                <div className="absolute inset-0 rounded-full border-[6px] border-transparent border-t-[#118df0] animate-spin" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-base font-semibold text-gray-900">Processing your file</div>
                <div className="mt-1 text-sm text-gray-600">Please keep this tab open while we finish the import.</div>

                {processingFileName ? (
                  <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-xs text-gray-700">
                    <div className="font-semibold text-gray-900">File</div>
                    <div className="mt-0.5 font-mono break-all">{processingFileName}</div>
                  </div>
                ) : null}
                <div className="mt-5 text-xs text-gray-500">
                  Once completed, the Vendors Inventory table will refresh automatically.
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {editingVendor ? (
        <div className="fixed inset-0 z-[210] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={closeEditVendor} />
          <div className="relative w-full max-w-3xl rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <div>
                <div className="text-base font-semibold text-gray-900">Edit Row</div>
                <div className="mt-1 text-xs font-semibold text-gray-600">
                  {String(editingVendor.type || '').toUpperCase() === 'PREMIERE' ? 'Premiere Cars' : 'Fleet Cars'}
                </div>
              </div>
              <button
                type="button"
                onClick={closeEditVendor}
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                disabled={savingVendor}
              >
                Close
              </button>
            </div>

            <div className="px-6 py-5">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700">D</label>
                  <input
                    value={editingD}
                    onChange={(e) => setEditingD(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700">Location</label>
                  <input
                    value={editingLocation}
                    onChange={(e) => setEditingLocation(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700">Unit ID</label>
                  <input
                    value={editingUnitId}
                    onChange={(e) => setEditingUnitId(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700">Year</label>
                  <input
                    value={editingYear}
                    onChange={(e) => setEditingYear(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700">Make</label>
                  <input
                    value={editingMake}
                    onChange={(e) => setEditingMake(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700">Model</label>
                  <input
                    value={editingModel}
                    onChange={(e) => setEditingModel(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700">Series</label>
                  <input
                    value={editingSeries}
                    onChange={(e) => setEditingSeries(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700">Kilometers</label>
                  <input
                    value={editingKilometers}
                    onChange={(e) => setEditingKilometers(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700">Ext Color</label>
                  <input
                    value={editingExtColor}
                    onChange={(e) => setEditingExtColor(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-gray-700">VIN</label>
                  <input
                    value={editingVin}
                    onChange={(e) => setEditingVin(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700">Price</label>
                  <input
                    value={editingPrice}
                    onChange={(e) => setEditingPrice(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                  />
                </div>

                <div className="md:col-span-3">
                  <label className="block text-xs font-semibold text-gray-700">Equip</label>
                  <input
                    value={editingEquip}
                    onChange={(e) => setEditingEquip(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                  />
                </div>
              </div>

              {vendorsError ? <div className="mt-4 text-sm text-red-600">{vendorsError}</div> : null}

              <div className="mt-6 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={closeEditVendor}
                  className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                  disabled={savingVendor}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={saveEditVendor}
                  disabled={savingVendor}
                  className="rounded-lg bg-[#118df0] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0d6ebd] disabled:opacity-50"
                >
                  {savingVendor ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {confirmOpen ? (
        <div className="fixed inset-0 z-[220] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => {
              if (confirmLoading) return
              setConfirmOpen(false)
              confirmActionRef.current = null
            }}
          />
          <div className="relative w-full max-w-md rounded-2xl bg-white shadow-xl">
            <div className="border-b border-gray-200 px-6 py-4">
              <div className="text-base font-semibold text-gray-900">{confirmTitle}</div>
            </div>
            <div className="px-6 py-5">
              <div className="whitespace-pre-line text-sm text-gray-700">{confirmMessage}</div>
              <div className="mt-6 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setConfirmOpen(false)
                    confirmActionRef.current = null
                  }}
                  disabled={confirmLoading}
                  className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (!confirmActionRef.current) {
                      setConfirmOpen(false)
                      return
                    }
                    setConfirmLoading(true)
                    try {
                      await confirmActionRef.current()
                      setConfirmOpen(false)
                      confirmActionRef.current = null
                    } finally {
                      setConfirmLoading(false)
                    }
                  }}
                  disabled={confirmLoading}
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {confirmLoading ? 'Deleting…' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
      {/* Header */}
      <div className="bg-white shadow">
        <div className="w-full px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center">
            <h1 className="text-2xl font-bold text-gray-900">CSV Import</h1>
          </div>
        </div>
      </div>

      <div className="w-full px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Instructions */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow p-6 mb-6">
              <h2 className="text-lg font-semibold mb-4">Import Instructions</h2>
              <ol className="list-decimal list-inside space-y-2 text-gray-600">
                <li>Download the template below or use your EDC Inventory export (CSV or Excel).</li>
                <li>EDC format: Columns should include Unit ID, Year, Make, Model, Series, Kilometers, Ext Color, VIN, Price, Equip.</li>
                <li>Fill one vehicle per row. Keep column headings exactly as provided.</li>
                <li>Save as .csv or .xlsx file.</li>
                <li>Upload the file—the importer validates VINs and imports vehicles.</li>
                <li>Review the summary, fix any failed rows, then check your inventory.</li>
                <li>Use the AI generation feature in the inventory page to generate photos for imported vehicles.</li>
              </ol>
              <div className="mt-4">
                <a
                  href={`${API_URL}/api/vehicles/template/csv`}
                  className="inline-flex items-center text-[#118df0] font-medium hover:underline"
                >
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download CSV Template
                </a>
              </div>
            </div>
          </div>

          {/* Upload Form */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl shadow p-6">
              <h2 className="text-lg font-semibold mb-4">Upload CSV or Excel File</h2>

              {/* Inventory Type Selector */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">Inventory Type</label>
                <div className="flex gap-4">
                  <label
                    className={`flex-1 cursor-pointer border-2 rounded-lg p-4 text-center transition-all ${
                      inventoryType === 'FLEET'
                        ? 'border-[#118df0] bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="inventoryType"
                      value="FLEET"
                      checked={inventoryType === 'FLEET'}
                      onChange={() => setInventoryType('FLEET')}
                      className="sr-only"
                    />
                    <div className="flex flex-col items-center">
                      <span className="text-2xl mb-1">🚗</span>
                      <span className="font-semibold text-gray-900">Fleet Cars</span>
                      <span className="text-xs text-gray-500 mt-1">Budget-friendly vehicles</span>
                    </div>
                  </label>

                  <label
                    className={`flex-1 cursor-pointer border-2 rounded-lg p-4 text-center transition-all ${
                      inventoryType === 'PREMIERE'
                        ? 'border-amber-500 bg-amber-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="inventoryType"
                      value="PREMIERE"
                      checked={inventoryType === 'PREMIERE'}
                      onChange={() => setInventoryType('PREMIERE')}
                      className="sr-only"
                    />
                    <div className="flex flex-col items-center">
                      <span className="text-2xl mb-1">✨</span>
                      <span className="font-semibold text-gray-900">Premiere Cars</span>
                      <span className="text-xs text-gray-500 mt-1">Premium & luxury vehicles</span>
                    </div>
                  </label>
                </div>
              </div>

              <div
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                  dragging ? 'border-[#118df0] bg-blue-50' : 'border-gray-300'
                }`}
                onDragOver={(e) => {
                  e.preventDefault()
                  setDragging(true)
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx"
                  onChange={handleFileChange}
                  className="hidden"
                  id="csv-upload"
                />
                <label htmlFor="csv-upload" className="cursor-pointer">
                  <svg className="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                    />
                  </svg>
                  {file ? (
                    <p className="text-gray-900 font-medium">{file.name}</p>
                  ) : (
                    <p className="text-gray-600">Click to select a CSV or Excel (.xlsx) file or drag and drop</p>
                  )}
                </label>
              </div>

              {file && (
                <button
                  onClick={handleImport}
                  disabled={importing || processing}
                  className="mt-4 w-full bg-[#118df0] text-white py-3 rounded-lg font-semibold hover:bg-[#0d6ebd] transition-colors disabled:opacity-50"
                >
                  Import Vehicles
                </button>
              )}

              <p className="mt-2 text-xs text-gray-500">
                Import is fast. Generate AI photos afterward from the inventory page.
              </p>

              {errors.length > 0 && (
                <div className="mt-4 p-4 rounded-lg bg-red-50 border border-red-100">
                  <p className="text-sm font-semibold text-red-700">Upload failed</p>
                  <ul className="mt-2 text-sm text-red-600 list-disc list-inside">
                    {errors.map((error, index) => (
                      <li key={`${error}-${index}`}>{error}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Result */}
              {result && (
                <div className="mt-4 p-4 rounded-lg border border-gray-200 bg-gray-50">
                  <p className="text-sm font-semibold text-gray-700">{result.message || 'Import completed'}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
                    <div className="bg-white rounded-lg p-3 shadow-sm">
                      <p className="text-xs text-gray-500">Total rows</p>
                      <p className="text-2xl font-bold text-gray-900">{result.summary.total}</p>
                    </div>
                    <div className="bg-white rounded-lg p-3 shadow-sm">
                      <p className="text-xs text-gray-500">Imported</p>
                      <p className="text-2xl font-bold text-green-600">{result.summary.successful}</p>
                    </div>
                    <div className="bg-white rounded-lg p-3 shadow-sm">
                      <p className="text-xs text-gray-500">Failed</p>
                      <p className="text-2xl font-bold text-red-600">{result.summary.failed}</p>
                    </div>
                  </div>

                  <div className="mt-4 text-sm text-gray-700">
                    <p>✨ Generate AI photos for imported vehicles from the inventory page using the bulk AI generation feature.</p>
                  </div>

                  {failedRows.length > 0 && (
                    <div className="mt-4">
                      <p className="text-sm font-semibold text-red-700">Rows with issues ({failedRows.length})</p>
                      <ul className="mt-2 text-sm text-red-600 space-y-1 max-h-48 overflow-y-auto">
                        {failedRows.slice(0, 12).map((row) => (
                          <li key={`${row.row}-${row.vin}`}>
                            Row {row.row} ({row.vin || 'VIN missing'}): {row.error || 'Unknown error'}
                          </li>
                        ))}
                      </ul>
                      {failedRows.length > 12 && (
                        <p className="text-xs text-gray-500 mt-1">Showing the first 12 errors. Check the server response for a full log.</p>
                      )}
                    </div>
                  )}

                  {result.summary.successful > 0 && (
                    <Link
                      href="/admin/inventory"
                      className="inline-block mt-4 text-[#118df0] font-medium hover:underline"
                    >
                      Go to Inventory →
                    </Link>
                  )}
                </div>
              )}

            </div>
          </div>
        </div>
      </div>

      <div className="w-full px-4 sm:px-6 lg:px-8 pb-10">
        <div className="bg-white rounded-xl shadow p-6">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-lg font-semibold text-gray-900">Vendors Inventory</h3>
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-2">
                <select
                  value={vendorsPageSize}
                  onChange={(e) => setVendorsPageSize(Number(e.target.value) || 10)}
                  className="h-9 rounded-lg border border-gray-200 bg-white px-2 text-sm font-semibold text-gray-700 outline-none focus:ring-2 focus:ring-[#118df0]/40"
                  title="Rows per page"
                  aria-label="Rows per page"
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value={500}>500</option>
                  <option value={1000}>1000</option>
                </select>
                <button
                  type="button"
                  onClick={() => setVendorsPage(1)}
                  disabled={vendorsLoading || currentVendorsPage <= 1}
                  className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  First
                </button>
                <button
                  type="button"
                  onClick={() => setVendorsPage((p) => Math.max(1, p - 1))}
                  disabled={vendorsLoading || currentVendorsPage <= 1}
                  className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Prev
                </button>
                <div className="text-xs text-gray-600">
                  Page {currentVendorsPage} of {totalVendorsPages}
                </div>
                <button
                  type="button"
                  onClick={() => setVendorsPage((p) => Math.min(totalVendorsPages, p + 1))}
                  disabled={vendorsLoading || currentVendorsPage >= totalVendorsPages}
                  className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Next
                </button>
              </div>

              <button
                type="button"
                onClick={() => void bulkDeleteSelected()}
                disabled={vendorsLoading || selectedCount === 0}
                className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"
              >
                Delete Selected ({selectedCount})
              </button>

              <button
                type="button"
                onClick={async () => {
                  await fetchVendorsRows(vendorsType)
                }}
                className="text-sm font-medium text-[#118df0] hover:underline"
              >
                Refresh
              </button>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-6 gap-3">
            <input
              value={vendorsSearch}
              onChange={(e) => setVendorsSearch(e.target.value)}
              placeholder="Search..."
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#118df0]/40"
            />

            <select
              value={vendorsType}
              onChange={(e) => setVendorsType(e.target.value === 'PREMIERE' ? 'PREMIERE' : 'FLEET')}
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#118df0]/40"
              aria-label="Inventory Type"
              title="Inventory Type"
            >
              <option value="FLEET">Fleet</option>
              <option value="PREMIERE">Premiere</option>
            </select>

            <select
              value={vendorsMake}
              onChange={(e) => setVendorsMake(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#118df0]/40"
            >
              <option value="">All Makes</option>
              {makeOptions.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>

            <select
              value={vendorsModel}
              onChange={(e) => setVendorsModel(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#118df0]/40"
            >
              <option value="">All Models</option>
              {modelOptions.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>

            <select
              value={vendorsYear}
              onChange={(e) => setVendorsYear(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#118df0]/40"
            >
              <option value="">All Years</option>
              {yearOptions.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>

            <select
              value={vendorsLocation}
              onChange={(e) => setVendorsLocation(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#118df0]/40"
            >
              <option value="">All Locations</option>
              {locationOptions.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </div>

          {vendorsError ? <div className="mt-3 text-sm text-red-600">{vendorsError}</div> : null}

          <div className="mt-4 overflow-hidden rounded-xl border border-gray-200 bg-white">
            <table className="w-full table-fixed text-sm">
              <thead className="bg-gray-50 text-gray-700">
                <tr>
                  <th className="w-10 px-3 py-3 text-left font-semibold">
                    <input
                      ref={selectAllRef}
                      type="checkbox"
                      checked={allOnPageSelected}
                      onChange={toggleSelectAllOnPage}
                      className="h-4 w-4 rounded border-gray-300"
                      aria-label="Select all rows on this page"
                      title="Select all"
                    />
                  </th>
                  <th className="w-10 px-2 py-3 text-left font-semibold">D</th>
                  <th className="w-32 px-2 py-3 text-left font-semibold">Location</th>
                  <th className="w-20 px-2 py-3 text-left font-semibold">Unit ID</th>
                  <th className="w-14 px-2 py-3 text-left font-semibold">Year</th>
                  <th className="w-20 px-2 py-3 text-left font-semibold">Make</th>
                  <th className="w-20 px-2 py-3 text-left font-semibold">Model</th>
                  <th className="w-16 px-2 py-3 text-left font-semibold">Series</th>
                  <th className="w-20 px-2 py-3 text-left font-semibold">KM</th>
                  <th className="w-20 px-2 py-3 text-left font-semibold">Color</th>
                  <th className="w-44 px-2 py-3 text-left font-semibold">VIN</th>
                  <th className="w-24 px-2 py-3 text-left font-semibold">Price</th>
                  <th className="px-2 py-3 text-left font-semibold">Equip</th>
                  <th className="w-36 px-2 py-3 text-left font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {vendorsLoading ? (
                  <tr>
                    <td className="px-4 py-4 text-gray-600" colSpan={14}>
                      Loading…
                    </td>
                  </tr>
                ) : pagedVendorsRows.length === 0 ? (
                  <tr>
                    <td className="px-4 py-4 text-gray-600" colSpan={14}>
                      No records found.
                    </td>
                  </tr>
                ) : (
                  pagedVendorsRows.map((row) => (
                    <tr key={row.id} className="hover:bg-gray-50">
                      <td className="px-3 py-3">
                        <input
                          type="checkbox"
                          checked={!!selectedVendorIds[row.id]}
                          onChange={() => toggleSelectRow(row.id)}
                          className="h-4 w-4 rounded border-gray-300"
                          aria-label={`Select row ${row.vin}`}
                          title="Select"
                        />
                      </td>
                      <td className="px-2 py-3">{row.d ?? ''}</td>
                      <td className="px-2 py-3 whitespace-normal break-words" title={row.location || ''}>
                        {row.location || ''}
                      </td>
                      <td className="px-2 py-3 whitespace-normal break-words" title={row.unit_id || ''}>
                        {row.unit_id || ''}
                      </td>
                      <td className="px-2 py-3">{row.year ?? ''}</td>
                      <td className="px-2 py-3 whitespace-normal break-words" title={row.make || ''}>
                        {row.make || ''}
                      </td>
                      <td className="px-2 py-3 whitespace-normal break-words" title={row.model || ''}>
                        {row.model || ''}
                      </td>
                      <td className="px-2 py-3 whitespace-normal break-words" title={row.series || ''}>
                        {row.series || ''}
                      </td>
                      <td className="px-2 py-3">{row.kilometers ?? ''}</td>
                      <td className="px-2 py-3 whitespace-normal break-words" title={row.ext_color || ''}>
                        {row.ext_color || ''}
                      </td>
                      <td className="px-2 py-3 font-mono text-xs break-all" title={row.vin}>
                        {row.vin}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {typeof row.price === 'number'
                          ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(row.price)
                          : ''}
                      </td>
                      <td className="px-2 py-3 text-xs leading-snug break-words">{row.equip || ''}</td>
                      <td className="px-2 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            disabled
                            title="AI Generated"
                            aria-label="AI Generated"
                            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-gray-200 bg-gray-50 text-gray-700 disabled:opacity-60"
                          >
                            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 2l1.5 4.5L18 8l-4.5 1.5L12 14l-1.5-4.5L6 8l4.5-1.5L12 2z" />
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 14l.75 2.25L8 17l-2.25.75L5 20l-.75-2.25L2 17l2.25-.75L5 14z" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditVendor(row)}
                            title="Edit"
                            aria-label="Edit"
                            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-gray-200 text-gray-700 hover:bg-gray-50"
                          >
                            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 20h9" />
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M16.5 3.5a2.121 2.121 0 113 3L7 19l-4 1 1-4 12.5-12.5z"
                              />
                            </svg>
                          </button>
                          <button
                            type="button"
                            onClick={() => void deleteVendor(row)}
                            title="Delete"
                            aria-label="Delete"
                            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                          >
                            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M3 6h18" />
                              <path strokeLinecap="round" strokeLinejoin="round" d="M8 6V4h8v2" />
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 6l-1 14H6L5 6" />
                              <path strokeLinecap="round" strokeLinejoin="round" d="M10 11v6" />
                              <path strokeLinecap="round" strokeLinejoin="round" d="M14 11v6" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
