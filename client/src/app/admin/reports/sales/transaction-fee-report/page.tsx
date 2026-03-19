'use client'

import { useEffect, useMemo, useState } from 'react'

type Row = {
  id: string
  dealId: string
  date: string
  __date_iso: string
  transactionType: string
  saleType: string
  customerName: string
  province: string
  country: string
  vin: string
  exported: string
  exportedAs: string
  count: number
}

type DealerInfo = {
  company_name: string
  mvda_number: string
  full_name: string
  position: string
}

const getFirstDayOfMonth = () => {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
}

const getToday = () => new Date().toISOString().slice(0, 10)

const defaultApplied = { from: getFirstDayOfMonth(), to: getToday(), transactionType: '', province: '', country: '' }

export default function TransactionFeeReportPage() {
  const [from, setFrom] = useState(getFirstDayOfMonth)
  const [to, setTo] = useState(getToday)
  const [query, setQuery] = useState('')
  const [transactionType, setTransactionType] = useState('')
  const [exportFilter, setExportFilter] = useState('All')
  const [exportType, setExportType] = useState('All')
  const [provinceFilter, setProvinceFilter] = useState('')
  const [countryFilter, setCountryFilter] = useState('')

  const [rows, setRows] = useState<Row[]>([])
  const [dealerInfo, setDealerInfo] = useState<DealerInfo>({ company_name: '', mvda_number: '', full_name: '', position: 'Owner' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(10)

  const [applied, setApplied] = useState(defaultApplied)

  const fetchData = async (params: typeof defaultApplied) => {
    try {
      setLoading(true)
      setError(null)

      let userId = ''
      try {
        const raw = typeof window !== 'undefined' ? window.localStorage.getItem('edc_admin_session') : null
        if (raw) userId = String((JSON.parse(raw) as { user_id?: string })?.user_id ?? '').trim()
      } catch { userId = '' }

      const qs = new URLSearchParams()
      if (userId) qs.set('userId', userId)
      if (params.from) qs.set('from', params.from)
      if (params.to) qs.set('to', params.to)
      if (params.transactionType) qs.set('transactionType', params.transactionType)
      if (params.province) qs.set('province', params.province)
      if (params.country) qs.set('country', params.country)

      const res = await fetch(`/api/reports/sales/transaction-fee-report?${qs.toString()}`, { cache: 'no-store' })
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.ok) throw new Error(String(json?.error || `Failed to load report (${res.status})`))

      setRows(Array.isArray(json?.rows) ? json.rows : [])
      if (json?.dealerInfo) setDealerInfo(json.dealerInfo)
      setPage(1)
    } catch (e: any) {
      setError(e?.message || 'Failed to load report')
      setRows([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void fetchData(defaultApplied)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSearch = () => {
    const params = { from, to, transactionType, province: provinceFilter, country: countryFilter }
    setApplied(params)
    void fetchData(params)
  }

  const handleReset = () => {
    const params = { from: getFirstDayOfMonth(), to: getToday(), transactionType: '', province: '', country: '' }
    setFrom(params.from)
    setTo(params.to)
    setTransactionType('')
    setExportFilter('All')
    setExportType('All')
    setProvinceFilter('')
    setCountryFilter('')
    setQuery('')
    setApplied(params)
    void fetchData(params)
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((r) => {
      const haystack = `${r.customerName} ${r.dealId} ${r.transactionType} ${r.saleType} ${r.province} ${r.country} ${r.vin}`.toLowerCase()
      return haystack.includes(q)
    })
  }, [query, rows])

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage))
  const paginated = filtered.slice((page - 1) * perPage, page * perPage)

  return (
    <div className="min-h-screen">
      <div className="edc-page-header">
        <h1 className="text-2xl font-bold text-slate-900">OMVIC Transaction Fee Register (daily record)</h1>
      </div>

      <div className="px-6 py-6 space-y-4">
        {/* Filters */}
        <div className="edc-card p-4">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Filters</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Reporting Period Start</label>
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="edc-input" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Reporting Period End</label>
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="edc-input" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Transaction Type</label>
              <select value={transactionType} onChange={(e) => setTransactionType(e.target.value)} className="edc-input">
                <option value="">All</option>
                <option value="Retail">Retail</option>
                <option value="Wholesale">Wholesale</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Export</label>
              <select value={exportFilter} onChange={(e) => setExportFilter(e.target.value)} className="edc-input">
                <option value="All">All</option>
                <option value="Yes">Yes</option>
                <option value="No">No</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Export Type</label>
              <select value={exportType} onChange={(e) => setExportType(e.target.value)} className="edc-input">
                <option value="All">All</option>
                <option value="Non Dealer">Non Dealer</option>
                <option value="Dealer">Dealer</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Province/State</label>
              <input
                value={provinceFilter}
                onChange={(e) => setProvinceFilter(e.target.value.toUpperCase())}
                placeholder="e.g. ON"
                maxLength={3}
                className="edc-input"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Country</label>
              <input
                value={countryFilter}
                onChange={(e) => setCountryFilter(e.target.value.toUpperCase())}
                placeholder="e.g. CA"
                maxLength={2}
                className="edc-input"
              />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2">
            <button
              type="button"
              onClick={handleSearch}
              disabled={loading}
              className="edc-btn-primary text-sm disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? 'Loading…' : 'Search'}
            </button>
            <button type="button" onClick={handleReset} className="edc-btn-ghost text-sm">
              Reset
            </button>
          </div>
        </div>

        {/* Inline search */}
        <div className="relative max-w-md">
          <input
            value={query}
            onChange={(e) => { setQuery(e.target.value); setPage(1) }}
            placeholder="Search…"
            className="edc-input pl-10"
          />
          <svg className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35m1.35-5.65a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>

        {error && (
          <div className="edc-card p-4">
            <div className="text-sm text-danger-600">{error}</div>
          </div>
        )}

        {/* Table Card */}
        <div className="edc-card overflow-hidden">
          {/* Dealer Header */}
          <div className="px-6 py-4 border-b border-slate-100">
            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
              <div className="text-sm text-slate-600 space-y-0.5">
                <div className="font-semibold text-slate-800">Legal Name of the Dealership:</div>
                <div>Trade Name: {dealerInfo.company_name || '—'}</div>
                <div>Prepared By: {dealerInfo.full_name || '—'}</div>
                <div>Position: {dealerInfo.position || 'Owner'}</div>
              </div>
              <div className="text-sm text-slate-600 space-y-0.5 lg:text-right">
                <div className="font-semibold text-slate-800">
                  OMVIC Registration Number: {dealerInfo.mvda_number || '—'}
                </div>
                <div>
                  Reporting Period: {applied.from?.replaceAll('-', '/') || 'All'} – {applied.to?.replaceAll('-', '/') || 'All'}
                </div>
                <div>Report Total (QTY count considered): {filtered.length}</div>
              </div>
            </div>
          </div>

          {/* Sub-title */}
          <div className="px-6 py-3 text-center text-sm font-semibold text-slate-700 border-b border-slate-100">
            Vehicle Sales Register
          </div>

          {loading && (
            <div className="px-6 py-4 text-sm text-slate-500">Loading…</div>
          )}

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="edc-table min-w-max w-full">
              <thead>
                <tr>
                  <th className="whitespace-nowrap">Date (YYYY/MM/DD)</th>
                  <th className="whitespace-nowrap">Deal ID</th>
                  <th className="whitespace-nowrap">Transaction Type</th>
                  <th className="whitespace-nowrap">Sale Type</th>
                  <th className="whitespace-nowrap">Customer Name</th>
                  <th className="whitespace-nowrap">Province/State</th>
                  <th className="whitespace-nowrap">Country</th>
                  <th className="whitespace-nowrap">Exported</th>
                  <th className="whitespace-nowrap">Exported Dealer/Non Dealer</th>
                  <th className="whitespace-nowrap">VIN</th>
                  <th className="whitespace-nowrap text-right">Count</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((r) => (
                  <tr key={r.id}>
                    <td className="px-4 py-3 text-sm text-slate-600 whitespace-nowrap">{r.date || '—'}</td>
                    <td className="px-4 py-3 text-sm font-medium text-slate-800 whitespace-nowrap">{r.dealId}</td>
                    <td className="px-4 py-3 text-sm text-slate-600 whitespace-nowrap">{r.transactionType}</td>
                    <td className="px-4 py-3 text-sm text-slate-600 whitespace-nowrap">{r.saleType}</td>
                    <td className="px-4 py-3 text-sm text-slate-600 whitespace-nowrap">{r.customerName || '—'}</td>
                    <td className="px-4 py-3 text-sm text-slate-600 whitespace-nowrap">{r.province || '—'}</td>
                    <td className="px-4 py-3 text-sm text-slate-600 whitespace-nowrap">{r.country || '—'}</td>
                    <td className="px-4 py-3 text-sm text-slate-600 whitespace-nowrap">{r.exported}</td>
                    <td className="px-4 py-3 text-sm text-slate-600 whitespace-nowrap">{r.exportedAs || '—'}</td>
                    <td className="px-4 py-3 text-sm text-slate-600 whitespace-nowrap font-mono text-xs">{r.vin || '—'}</td>
                    <td className="px-4 py-3 text-sm text-slate-800 whitespace-nowrap text-right">{r.count}</td>
                  </tr>
                ))}
                {!loading && paginated.length === 0 && (
                  <tr>
                    <td colSpan={11} className="px-4 py-10 text-center text-sm text-slate-400">
                      No records found for this period
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Footer / Pagination */}
          <div className="px-6 py-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="text-sm text-slate-600">
              Total: <span className="font-semibold text-slate-800">{filtered.length}</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <span>Items per page:</span>
                <select
                  value={perPage}
                  onChange={(e) => { setPerPage(Number(e.target.value)); setPage(1) }}
                  className="edc-input w-auto text-sm"
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
              <div className="text-sm text-slate-600">{page} of {totalPages}</div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="h-8 w-8 flex items-center justify-center rounded-lg border border-slate-200/60 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="h-8 w-8 flex items-center justify-center rounded-lg border border-slate-200/60 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
