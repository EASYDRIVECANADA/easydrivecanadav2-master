'use client'

import { useEffect, useMemo, useState } from 'react'

import { buildAuditTrailCsv, type AuditEventRow } from '@/lib/auditEvents'
import { getCurrentAuditActor } from '@/lib/auditClient'

const MODULES = ['Leads', 'Customers', 'Users', 'E-Signature', 'Inventory', 'Sales', 'Settings']
const ACTIONS = ['Created', 'Updated', 'Deleted', 'Status Updated', 'Note Added', 'Viewed', 'Downloaded', 'Sent', 'Signed']

const formatDateTime = (value?: string) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('en-CA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export default function AuditTrailReportPage() {
  const [rows, setRows] = useState<AuditEventRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [moduleFilter, setModuleFilter] = useState('')
  const [actionFilter, setActionFilter] = useState('')
  const [actorFilter, setActorFilter] = useState('')
  const [query, setQuery] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const params = useMemo(() => {
    const qs = new URLSearchParams()
    if (moduleFilter) qs.set('module', moduleFilter)
    if (actionFilter) qs.set('action', actionFilter)
    if (actorFilter) qs.set('actor', actorFilter)
    if (query) qs.set('q', query)
    if (startDate) qs.set('startDate', startDate)
    if (endDate) qs.set('endDate', endDate)
    qs.set('limit', '300')
    return qs.toString()
  }, [actionFilter, actorFilter, endDate, moduleFilter, query, startDate])

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      setLoading(true)
      setError('')
      try {
        const actor = getCurrentAuditActor()
        const res = await fetch(`/api/audit/events?${params}`, {
          cache: 'no-store',
          headers: actor.actor_email ? { 'x-edc-admin-email': actor.actor_email } : {},
        })
        const json = await res.json().catch(() => null)
        if (!res.ok) throw new Error(String(json?.error || `Unable to load audit events (${res.status})`))
        if (!cancelled) setRows(Array.isArray(json) ? json : [])
      } catch (err: unknown) {
        if (!cancelled) {
          setRows([])
          setError(err instanceof Error ? err.message : 'Unable to load audit trail')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [params])

  const clearFilters = () => {
    setModuleFilter('')
    setActionFilter('')
    setActorFilter('')
    setQuery('')
    setStartDate('')
    setEndDate('')
  }

  const downloadCsv = () => {
    const csv = buildAuditTrailCsv(rows)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `system-audit-trail-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="min-h-screen">
      <div className="edc-page-header flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Audit Trail</h1>
          <p className="mt-0.5 text-sm text-slate-500">System activity recorded from admin workflows</p>
        </div>
        <button
          type="button"
          onClick={downloadCsv}
          disabled={rows.length === 0}
          className="h-10 rounded-lg bg-navy-900 px-4 text-sm font-semibold text-white transition-colors hover:bg-navy-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Download CSV
        </button>
      </div>

      <div className="px-6 py-6">
        <div className="mb-4 grid grid-cols-1 gap-3 rounded-lg border border-slate-200/70 bg-white p-4 shadow-sm lg:grid-cols-6">
          <select
            value={moduleFilter}
            onChange={(e) => setModuleFilter(e.target.value)}
            className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700"
            aria-label="Module"
          >
            <option value="">All modules</option>
            {MODULES.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700"
            aria-label="Action"
          >
            <option value="">All actions</option>
            {ACTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          <input
            value={actorFilter}
            onChange={(e) => setActorFilter(e.target.value)}
            placeholder="Actor email"
            className="h-10 rounded-lg border border-slate-200 px-3 text-sm text-slate-700"
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search"
            className="h-10 rounded-lg border border-slate-200 px-3 text-sm text-slate-700"
          />
          <div className="grid grid-cols-2 gap-2 lg:col-span-2">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="h-10 rounded-lg border border-slate-200 px-3 text-sm text-slate-700"
              aria-label="Start date"
            />
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="h-10 rounded-lg border border-slate-200 px-3 text-sm text-slate-700"
              aria-label="End date"
            />
          </div>
          <button
            type="button"
            onClick={clearFilters}
            className="h-10 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 lg:col-start-6"
          >
            Clear
          </button>
        </div>

        <div className="overflow-hidden rounded-lg border border-slate-200/70 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-200/70 px-4 py-3">
            <div className="text-sm font-semibold text-slate-800">Events</div>
            <div className="text-xs text-slate-500">{loading ? 'Loading...' : `${rows.length} shown`}</div>
          </div>

          {error ? (
            <div className="px-4 py-8 text-sm text-red-600">{error}</div>
          ) : loading ? (
            <div className="px-4 py-8 text-sm text-slate-500">Loading audit trail...</div>
          ) : rows.length === 0 ? (
            <div className="px-4 py-8 text-sm text-slate-500">No audit events found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Time</th>
                    <th className="px-4 py-3">Module</th>
                    <th className="px-4 py-3">Action</th>
                    <th className="px-4 py-3">Summary</th>
                    <th className="px-4 py-3">Actor</th>
                    <th className="px-4 py-3">Record</th>
                    <th className="px-4 py-3">IP</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((row) => (
                    <tr key={row.id || `${row.created_at}-${row.module}-${row.record_id}`} className="align-top">
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600">{formatDateTime(row.created_at)}</td>
                      <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-800">{row.module || '-'}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-700">{row.action || '-'}</td>
                      <td className="min-w-[320px] px-4 py-3 text-slate-700">{row.summary || '-'}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                        <div>{row.actor_name || '-'}</div>
                        <div className="text-xs text-slate-400">{row.actor_email || ''}</div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                        <div>{row.record_type || '-'}</div>
                        <div className="max-w-[180px] truncate font-mono text-xs text-slate-400">{row.record_id || ''}</div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-slate-500">{row.ip_address || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
