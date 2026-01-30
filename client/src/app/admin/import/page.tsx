'use client'

import { useState, useEffect, useRef } from 'react'
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
  const [result, setResult] = useState<ImportResult | null>(null)
  const [errors, setErrors] = useState<string[]>([])
  const [dragging, setDragging] = useState(false)
  const [vendorsRows, setVendorsRows] = useState<VendorInventoryRow[]>([])
  const [vendorsLoading, setVendorsLoading] = useState(false)
  const [vendorsError, setVendorsError] = useState<string | null>(null)
  const [vendorsSearch, setVendorsSearch] = useState('')
  const [vendorsMake, setVendorsMake] = useState('')
  const [vendorsModel, setVendorsModel] = useState('')
  const [vendorsYear, setVendorsYear] = useState('')
  const [vendorsLocation, setVendorsLocation] = useState('')
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

  useEffect(() => {
    let mounted = true

    const load = async () => {
      setVendorsLoading(true)
      setVendorsError(null)
      try {
        const { data, error } = await supabase
          .from('edc_vendors_inventory')
          .select(
            'id, d, location, unit_id, year, make, model, series, kilometers, ext_color, vin, price, equip, created_at, updated_at, image_url, image_generated'
          )
          .order('created_at', { ascending: false })
          .limit(200)

        if (error) throw error
        if (!mounted) return
        setVendorsRows((data || []) as VendorInventoryRow[])
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Failed to load vendors inventory'
        if (mounted) setVendorsError(message)
      } finally {
        if (mounted) setVendorsLoading(false)
      }
    }

    load()
    return () => {
      mounted = false
    }
  }, [])

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
        return
      }

      setProcessing(true)
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
        setVendorsLoading(true)
        setVendorsError(null)
        try {
          const { data: rows, error } = await supabase
            .from('edc_vendors_inventory')
            .select(
              'id, d, location, unit_id, year, make, model, series, kilometers, ext_color, vin, price, equip, created_at, updated_at, image_url, image_generated'
            )
            .order('created_at', { ascending: false })
            .limit(200)
          if (error) throw error
          setVendorsRows((rows || []) as VendorInventoryRow[])
        } catch (e) {
          const msg = e instanceof Error ? e.message : 'Failed to load vendors inventory'
          setVendorsError(msg)
        } finally {
          setVendorsLoading(false)
        }
        return
      }

      if (pollTimerRef.current) clearInterval(pollTimerRef.current)
      const startedAt = Date.now()
      pollTimerRef.current = setInterval(async () => {
        try {
          const { data: latestRows, error } = await supabase
            .from('edc_vendors_inventory')
            .select('created_at')
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
              const { data: rows, error: rowsError } = await supabase
                .from('edc_vendors_inventory')
                .select(
                  'id, d, location, unit_id, year, make, model, series, kilometers, ext_color, vin, price, equip, created_at, updated_at, image_url, image_generated'
                )
                .order('created_at', { ascending: false })
                .limit(200)
              if (rowsError) throw rowsError
              setVendorsRows((rows || []) as VendorInventoryRow[])
            } finally {
              setVendorsLoading(false)
              setProcessing(false)
              setProcessingText('Processing…')
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
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {processing ? (
        <div className="fixed inset-0 z-[200] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full border-4 border-gray-200 border-t-[#118df0] animate-spin" />
              <div>
                <div className="text-base font-semibold text-gray-900">Processing</div>
                <div className="mt-1 text-sm text-gray-600">{processingText}</div>
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
                  disabled={importing}
                  className="mt-4 w-full bg-[#118df0] text-white py-3 rounded-lg font-semibold hover:bg-[#0d6ebd] transition-colors disabled:opacity-50"
                >
                  {importing ? 'Importing vehicles…' : 'Import Vehicles'}
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
            <button
              type="button"
              onClick={async () => {
                setVendorsLoading(true)
                setVendorsError(null)
                try {
                  const { data, error } = await supabase
                    .from('edc_vendors_inventory')
                    .select(
                      'id, d, location, unit_id, year, make, model, series, kilometers, ext_color, vin, price, equip, created_at, updated_at, image_url, image_generated'
                    )
                    .order('created_at', { ascending: false })
                    .limit(200)
                  if (error) throw error
                  setVendorsRows((data || []) as VendorInventoryRow[])
                } catch (e) {
                  const message = e instanceof Error ? e.message : 'Failed to load vendors inventory'
                  setVendorsError(message)
                } finally {
                  setVendorsLoading(false)
                }
              }}
              className="text-sm font-medium text-[#118df0] hover:underline"
            >
              Refresh
            </button>
          </div>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-5 gap-3">
            <input
              value={vendorsSearch}
              onChange={(e) => setVendorsSearch(e.target.value)}
              placeholder="Search..."
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#118df0]/40"
            />

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

          <div className="mt-4 overflow-x-auto rounded-xl border border-gray-200 bg-white">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">D</th>
                  <th className="px-4 py-3 text-left font-semibold">Location</th>
                  <th className="px-4 py-3 text-left font-semibold">Unit ID</th>
                  <th className="px-4 py-3 text-left font-semibold">Year</th>
                  <th className="px-4 py-3 text-left font-semibold">Make</th>
                  <th className="px-4 py-3 text-left font-semibold">Model</th>
                  <th className="px-4 py-3 text-left font-semibold">Series</th>
                  <th className="px-4 py-3 text-left font-semibold">Kilometers</th>
                  <th className="px-4 py-3 text-left font-semibold">Ext Color</th>
                  <th className="px-4 py-3 text-left font-semibold">VIN</th>
                  <th className="px-4 py-3 text-left font-semibold">Price</th>
                  <th className="px-4 py-3 text-left font-semibold">Equip</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {vendorsLoading ? (
                  <tr>
                    <td className="px-4 py-4 text-gray-600" colSpan={12}>
                      Loading…
                    </td>
                  </tr>
                ) : filteredVendorsRows.length === 0 ? (
                  <tr>
                    <td className="px-4 py-4 text-gray-600" colSpan={12}>
                      No records found.
                    </td>
                  </tr>
                ) : (
                  filteredVendorsRows.map((row) => (
                    <tr key={row.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 whitespace-nowrap">{row.d ?? ''}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{row.location || ''}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{row.unit_id || ''}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{row.year ?? ''}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{row.make || ''}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{row.model || ''}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{row.series || ''}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{row.kilometers ?? ''}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{row.ext_color || ''}</td>
                      <td className="px-4 py-3 whitespace-nowrap font-mono text-xs">{row.vin}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {typeof row.price === 'number'
                          ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(row.price)
                          : ''}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">{row.equip || ''}</td>
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
