'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import * as XLSX from 'xlsx-js-style'

type UploadRow = {
  id: string
  source_row: number
  stock_number: string | null
  vin: string | null
  year: number | null
  make: string | null
  model: string | null
  trim: string | null
  mileage: number | null
  listed_price: number | null
  decoded?: Record<string, unknown>
  market_stats?: Record<string, unknown>
  validation_flags?: string[]
  risk_flags?: string[]
  reasons?: string[]
  score?: number | null
  recommendation?: string | null
  suggested_max_purchase_price?: number | null
  estimated_resale_value?: number | null
  projected_profit?: number | null
  projected_margin_percent?: number | null
  imported_vehicle_id?: string | null
}

type UploadRecord = {
  id: string
  filename: string
  region: string
  status: string
  summary?: Record<string, number>
  created_at: string
}

type MarketComp = {
  id?: string
  row_id?: string
  source?: string
  url?: string
  title?: string
  price?: number
  mileage?: number
  region?: string
  confidence?: string
}

const money = (value: unknown) => {
  const num = Number(value || 0)
  return Number.isFinite(num) && num !== 0 ? `$${num.toLocaleString('en-CA')}` : '-'
}

const km = (value: unknown) => {
  const num = Number(value || 0)
  return Number.isFinite(num) && num !== 0 ? `${num.toLocaleString('en-CA')} km` : '-'
}

const recommendationClass = (value: string) => {
  if (value === 'Priority Research') return 'bg-emerald-50 text-emerald-700 border-emerald-200'
  if (value === 'Worth Checking') return 'bg-green-50 text-green-700 border-green-200'
  if (value === 'Strong Buy') return 'bg-emerald-50 text-emerald-700 border-emerald-200'
  if (value === 'Good Buy') return 'bg-green-50 text-green-700 border-green-200'
  if (value === 'Maybe') return 'bg-sky-50 text-sky-700 border-sky-200'
  if (value === 'Low Priority') return 'bg-slate-50 text-slate-600 border-slate-200'
  if (value === 'Avoid / Risk') return 'bg-red-50 text-red-700 border-red-200'
  if (value === 'Missing Data') return 'bg-amber-50 text-amber-700 border-amber-200'
  if (value === 'Avoid') return 'bg-red-50 text-red-700 border-red-200'
  return 'bg-amber-50 text-amber-700 border-amber-200'
}

const shortlistFilters = ['all', 'Priority Research', 'Worth Checking', 'Maybe', 'Low Priority', 'Avoid / Risk', 'Missing Data']

const parseCompLines = (text: string, rowId: string) => {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [price, mileage, source, url, title] = line.split(',').map((part) => part.trim())
      return {
        rowId,
        price,
        mileage,
        source: source || 'manual',
        url: url || '',
        title: title || '',
        confidence: 'manual',
      }
    })
}

const recommendationNotes = (row: UploadRow) => {
  if (Array.isArray(row.reasons) && row.reasons.length) return row.reasons.join(' ')
  return 'No recommendation notes available yet.'
}

export default function GoodBuyAnalyzerPage() {
  const fileRef = useRef<HTMLInputElement | null>(null)
  const [email, setEmail] = useState('')
  const [region, setRegion] = useState('ON')
  const [uploads, setUploads] = useState<UploadRecord[]>([])
  const [upload, setUpload] = useState<UploadRecord | null>(null)
  const [rows, setRows] = useState<UploadRow[]>([])
  const [comps, setComps] = useState<MarketComp[]>([])
  const [skipped, setSkipped] = useState<Array<{ row: number; reason: string }>>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [activeRowId, setActiveRowId] = useState('')
  const [filter, setFilter] = useState('all')
  const [compText, setCompText] = useState('')
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem('edc_admin_session')
      const parsed = raw ? JSON.parse(raw) : null
      setEmail(String(parsed?.email || '').trim().toLowerCase())
    } catch {
      setEmail('')
    }
  }, [])

  const activeRow = useMemo(
    () => rows.find((row) => row.id === activeRowId) || rows[0] || null,
    [activeRowId, rows]
  )

  const filteredRows = useMemo(() => {
    if (filter === 'all') return rows
    return rows.filter((row) => String(row.recommendation || 'Needs Manual Review') === filter)
  }, [filter, rows])

  const summary = useMemo(() => {
    const priority = rows.filter((row) => String(row.recommendation || '') === 'Priority Research')
    const worthChecking = rows.filter((row) => String(row.recommendation || '') === 'Worth Checking')
    const highestProfit = rows.reduce((max, row) => Math.max(max, Number(row.projected_profit || 0)), 0)
    const avgScore = rows.length
      ? Math.round(rows.reduce((sum, row) => sum + Number(row.score || 0), 0) / rows.length)
      : 0
    return {
      total: rows.length,
      priority: priority.length,
      worthChecking: worthChecking.length,
      highestProfit,
      missing: rows.filter((row) => ['Missing Data', 'Needs Manual Review'].includes(String(row.recommendation || ''))).length,
      avoid: rows.filter((row) => ['Avoid', 'Avoid / Risk'].includes(String(row.recommendation || ''))).length,
      avgScore,
    }
  }, [rows])

  const loadUploads = useCallback(async (adminEmail = email) => {
    if (!adminEmail) return
    const qs = new URLSearchParams({ email: adminEmail })
    const res = await fetch(`/api/admin/good-buy/uploads?${qs.toString()}`, { cache: 'no-store' })
    const payload = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(String(payload?.error || 'Failed to load uploads'))
    setUploads(Array.isArray(payload.uploads) ? payload.uploads : [])
  }, [email])

  useEffect(() => {
    if (!email) return
    void loadUploads(email).catch((err) => setError(err instanceof Error ? err.message : 'Failed to load uploads'))
  }, [email, loadUploads])

  const loadUpload = async (id: string) => {
    const res = await fetch(`/api/admin/good-buy/uploads/${encodeURIComponent(id)}`, { cache: 'no-store' })
    const payload = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(String(payload?.error || 'Failed to load upload'))
    setUpload(payload.upload || null)
    setRows(Array.isArray(payload.rows) ? payload.rows : [])
    setComps(Array.isArray(payload.comps) ? payload.comps : [])
    setSelectedIds(new Set())
    setActiveRowId('')
    setSkipped([])
  }

  const uploadFile = async () => {
    const file = fileRef.current?.files?.[0]
    if (!file) return
    setBusy('upload')
    setError('')
    try {
      const form = new FormData()
      form.set('file', file)
      form.set('email', email)
      form.set('region', region)
      const res = await fetch('/api/admin/good-buy/uploads', {
        method: 'POST',
        headers: { 'x-admin-email': email },
        body: form,
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(String(payload?.error || 'Upload failed'))
      setUpload(payload.upload || null)
      setRows(Array.isArray(payload.rows) ? payload.rows : [])
      setSkipped(Array.isArray(payload.skipped) ? payload.skipped : [])
      setComps([])
      setSelectedIds(new Set())
      setActiveRowId('')
      await loadUploads()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setBusy('')
    }
  }

  const runAction = async (action: 'enrich' | 'score') => {
    if (!upload?.id) return
    setBusy(action)
    setError('')
    try {
      const res = await fetch(`/api/admin/good-buy/uploads/${upload.id}/${action}`, { method: 'POST' })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(String(payload?.error || `${action} failed`))
      await loadUpload(upload.id)
      await loadUploads()
    } catch (err) {
      setError(err instanceof Error ? err.message : `${action} failed`)
    } finally {
      setBusy('')
    }
  }

  const saveComps = async () => {
    if (!upload?.id || !activeRow?.id) return
    const manualComps = parseCompLines(compText, activeRow.id)
    if (manualComps.length === 0) return
    setBusy('comps')
    setError('')
    try {
      const res = await fetch(`/api/admin/good-buy/uploads/${upload.id}/market-comps`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manualComps }),
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(String(payload?.error || 'Failed to save comps'))
      setCompText('')
      await loadUpload(upload.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save comps')
    } finally {
      setBusy('')
    }
  }

  const importSelected = async () => {
    if (!upload?.id || selectedIds.size === 0) return
    setBusy('import')
    setError('')
    try {
      const res = await fetch(`/api/admin/good-buy/uploads/${upload.id}/import-selected`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rowIds: Array.from(selectedIds) }),
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(String(payload?.error || 'Import failed'))
      await loadUpload(upload.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed')
    } finally {
      setBusy('')
    }
  }

  const exportRows = () => {
    const aoa = [
      ['VIN', 'Year', 'Make', 'Model', 'Trim', 'Mileage', 'Listed Price', 'Market Avg', 'Market Low', 'Market High', 'Suggested Max', 'Resale Value', 'Profit', 'Score', 'Recommendation', 'Reasons'],
      ...rows.map((row) => [
        row.vin || '',
        row.year || '',
        row.make || '',
        row.model || '',
        row.trim || '',
        row.mileage || '',
        row.listed_price || '',
        row.market_stats?.averagePrice || '',
        row.market_stats?.lowestPrice || '',
        row.market_stats?.highestPrice || '',
        row.suggested_max_purchase_price || '',
        row.estimated_resale_value || '',
        row.projected_profit || '',
        row.score || '',
        row.recommendation || '',
        Array.isArray(row.reasons) ? row.reasons.join(' ') : '',
      ]),
    ]
    const ws = XLSX.utils.aoa_to_sheet(aoa)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Good Buy Analysis')
    XLSX.writeFile(wb, `good_buy_analysis_${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  const toggleSelected = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="px-6 lg:px-8 pt-8 pb-4 border-b border-slate-200 bg-white">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Fleet Shortlist Analyzer</h1>
            <p className="text-sm text-slate-500 mt-1">Shortlist fleet vehicles for research before adding comps or importing to inventory.</p>
          </div>
          <Link href="/admin/inventory" className="h-10 px-4 rounded-lg border border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 inline-flex items-center">
            Inventory
          </Link>
        </div>
      </div>

      <div className="px-6 lg:px-8 py-6 space-y-6">
        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        ) : null}

        <section className="bg-white rounded-2xl border border-slate-200 p-5">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_160px_180px] gap-3">
            <input ref={fileRef} type="file" accept=".xlsx,.csv" className="h-10 rounded-lg border border-slate-200 px-3 text-sm" />
            <input value={region} onChange={(e) => setRegion(e.target.value.toUpperCase())} className="h-10 rounded-lg border border-slate-200 px-3 text-sm" placeholder="Region" />
            <button onClick={uploadFile} disabled={busy === 'upload' || !email} className="h-10 rounded-lg bg-[#0B1F3A] text-white text-sm font-semibold hover:bg-[#1EA7FF] disabled:opacity-50">
              {busy === 'upload' ? 'Uploading...' : 'Upload sheet'}
            </button>
          </div>
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            {uploads.slice(0, 5).map((item) => (
              <button key={item.id} onClick={() => void loadUpload(item.id)} className={`px-3 py-1.5 rounded-full border text-xs font-semibold ${upload?.id === item.id ? 'bg-[#0B1F3A] text-white border-[#0B1F3A]' : 'bg-white text-slate-600 border-slate-200'}`}>
                {item.filename}
              </button>
            ))}
          </div>
          {skipped.length ? (
            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              {skipped.slice(0, 4).map((row) => `Row ${row.row}: ${row.reason}`).join(' | ')}
            </div>
          ) : null}
        </section>

        <section className="grid grid-cols-2 md:grid-cols-6 gap-3">
          {[
            ['Rows', summary.total],
            ['Priority', summary.priority],
            ['Worth checking', summary.worthChecking],
            ['Avg score', `${summary.avgScore}%`],
            ['Missing data', summary.missing],
            ['Avoid / risk', summary.avoid],
          ].map(([label, value]) => (
            <div key={String(label)} className="rounded-xl border border-slate-200 bg-white px-4 py-3">
              <div className="text-[11px] uppercase tracking-wide font-semibold text-slate-500">{label}</div>
              <div className="mt-1 text-xl font-bold text-slate-900">{value}</div>
            </div>
          ))}
        </section>

        <section className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-6">
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                {shortlistFilters.map((value) => (
                  <button key={value} onClick={() => setFilter(value)} className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${filter === value ? 'bg-[#0B1F3A] text-white border-[#0B1F3A]' : 'bg-white text-slate-600 border-slate-200'}`}>
                    {value === 'all' ? 'All' : value}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => void runAction('enrich')} disabled={!upload || busy === 'enrich'} className="h-9 px-3 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 disabled:opacity-50">VIN enrich</button>
                <button onClick={() => void runAction('score')} disabled={!upload || busy === 'score'} className="h-9 px-3 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 disabled:opacity-50">Score comps</button>
                <button onClick={exportRows} disabled={!rows.length} className="h-9 px-3 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 disabled:opacity-50">Export</button>
                <button onClick={importSelected} disabled={!selectedIds.size || busy === 'import'} className="h-9 px-3 rounded-lg bg-[#0B1F3A] text-white text-xs font-semibold disabled:opacity-50">Import selected</button>
              </div>
            </div>

            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    <th className="w-10 px-3 py-3"></th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Vehicle</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase">VIN</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Mileage</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Listed</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Market</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Profit</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Score</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Recommendation</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredRows.map((row) => {
                    const rec = String(row.recommendation || 'Needs Manual Review')
                    return (
                      <tr key={row.id} onClick={() => setActiveRowId(row.id)} className={`cursor-pointer hover:bg-slate-50 ${activeRow?.id === row.id ? 'bg-sky-50/50' : ''}`}>
                        <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                          <input type="checkbox" checked={selectedIds.has(row.id)} onChange={(e) => toggleSelected(row.id, e.target.checked)} />
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap">
                          <div className="font-semibold text-slate-900">{row.year} {row.make} {row.model}</div>
                          <div className="text-xs text-slate-500">{row.trim || '-'} {row.stock_number ? `| Stock ${row.stock_number}` : ''}</div>
                        </td>
                        <td className="px-3 py-3 font-mono text-xs text-slate-600 whitespace-nowrap">{row.vin || '-'}</td>
                        <td className="px-3 py-3 text-slate-600 whitespace-nowrap">{km(row.mileage)}</td>
                        <td className="px-3 py-3 text-slate-900 font-semibold whitespace-nowrap">{money(row.listed_price)}</td>
                        <td className="px-3 py-3 text-slate-600 whitespace-nowrap">{money(row.market_stats?.averagePrice)}</td>
                        <td className={`px-3 py-3 font-semibold whitespace-nowrap ${Number(row.projected_profit || 0) >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>{money(row.projected_profit)}</td>
                        <td className="px-3 py-3 whitespace-nowrap">{row.score ?? '-'}</td>
                        <td className="px-3 py-3 whitespace-nowrap"><span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold ${recommendationClass(rec)}`}>{rec}</span></td>
                        <td className="px-3 py-3 min-w-[22rem] max-w-[32rem] text-xs text-slate-600 leading-5">
                          <div className="line-clamp-2">{recommendationNotes(row)}</div>
                        </td>
                      </tr>
                    )
                  })}
                  {!filteredRows.length ? (
                    <tr>
                      <td colSpan={10} className="px-4 py-12 text-center text-sm text-slate-500">Upload a fleet sheet to begin analysis.</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>

          <aside className="bg-white rounded-2xl border border-slate-200 p-5 min-h-[32rem]">
            {activeRow ? (
              <div className="space-y-5">
                <div>
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Vehicle detail</div>
                  <h2 className="mt-1 text-lg font-bold text-slate-900">{activeRow.year} {activeRow.make} {activeRow.model}</h2>
                  <div className="text-xs text-slate-500">{activeRow.vin}</div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="rounded-lg bg-slate-50 p-3"><div className="text-xs text-slate-500">Suggested max</div><div className="font-bold">{money(activeRow.suggested_max_purchase_price)}</div></div>
                  <div className="rounded-lg bg-slate-50 p-3"><div className="text-xs text-slate-500">Resale value</div><div className="font-bold">{money(activeRow.estimated_resale_value)}</div></div>
                  <div className="rounded-lg bg-slate-50 p-3"><div className="text-xs text-slate-500">Market low/high</div><div className="font-bold">{money(activeRow.market_stats?.lowestPrice)} / {money(activeRow.market_stats?.highestPrice)}</div></div>
                  <div className="rounded-lg bg-slate-50 p-3"><div className="text-xs text-slate-500">Comps</div><div className="font-bold">{Number(activeRow.market_stats?.count || 0)}</div></div>
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Recommendation reason</div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700 leading-relaxed">
                    {recommendationNotes(activeRow)}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Manual comps</div>
                  <textarea
                    value={compText}
                    onChange={(e) => setCompText(e.target.value)}
                    className="w-full h-28 rounded-lg border border-slate-200 p-3 text-xs font-mono"
                    placeholder="price,mileage,source,url,title&#10;31500,48000,manual,https://example.com/listing,Similar listing"
                  />
                  <button onClick={saveComps} disabled={busy === 'comps' || !compText.trim()} className="mt-2 h-9 w-full rounded-lg bg-[#0B1F3A] text-white text-sm font-semibold disabled:opacity-50">
                    Save comps for selected row
                  </button>
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Saved comps</div>
                  <div className="space-y-2 max-h-36 overflow-auto">
                    {comps.filter((comp) => comp.row_id === activeRow.id).map((comp) => (
                      <div key={comp.id || `${comp.price}-${comp.url}`} className="rounded-lg border border-slate-200 px-3 py-2 text-xs">
                        <div className="font-semibold text-slate-900">{money(comp.price)} {comp.mileage ? `| ${km(comp.mileage)}` : ''}</div>
                        <div className="text-slate-500 truncate">{comp.source || 'manual'} {comp.url ? `| ${comp.url}` : ''}</div>
                      </div>
                    ))}
                    {!comps.some((comp) => comp.row_id === activeRow.id) ? <div className="text-sm text-slate-400">No comps saved for this row.</div> : null}
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-sm text-slate-500 text-center">Select a vehicle row to review scoring details and add market comps.</div>
            )}
          </aside>
        </section>
      </div>
    </div>
  )
}
