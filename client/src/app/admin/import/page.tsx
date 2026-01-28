'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type ImportRowResult = {
  row: number
  vin: string
  success: boolean
  error?: string
  imageGenerated?: boolean
}
//dfsafsa
type ImportResult = {
  summary: { total: number; successful: number; failed: number }
  rows: ImportRowResult[]
  message?: string
}

export default function AdminImportPage() {
  const [file, setFile] = useState<File | null>(null)
  const [inventoryType, setInventoryType] = useState<'FLEET' | 'PREMIERE'>('FLEET')
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [errors, setErrors] = useState<string[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'

  useEffect(() => {
    const sessionStr = localStorage.getItem('edc_admin_session')
    if (!sessionStr) {
      router.push('/admin')
      return
    }
  }, [router])

  const failedRows = result ? result.rows.filter((row) => !row.success) : []

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0])
      setResult(null)
      setErrors([])
    }
  }

  const handleImport = async () => {
    if (!file) return

    setImporting(true)
    setResult(null)
    setErrors([])

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('inventoryType', inventoryType)

      const res = await fetch(`${API_URL}/api/vehicles/import/csv`, {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()

      if (res.ok) {
        setResult({
          summary: data.summary || {
            total: data.imported || 0,
            successful: data.imported || 0,
            failed: data.failed || 0,
          },
          rows: data.results || [],
          message: data.message,
        })
        setFile(null)
        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }
      } else {
        setErrors([data.error || 'Import failed'])
      }
    } catch {
      setErrors(['Failed to connect to server'])
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-100">
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

              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
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
    </div>
  )
}
