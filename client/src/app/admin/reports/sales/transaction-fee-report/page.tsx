'use client'

import { useMemo, useState } from 'react'

type Row = {
  id: string
  dealId: string
  customer: string
  feeName: string
  cost: number
  price: number
  date: string
}

export default function TransactionFeeReportPage() {
  const [from, setFrom] = useState('2026-01-01')
  const [to, setTo] = useState('2026-01-31')
  const [query, setQuery] = useState('')
  const [transactionType, setTransactionType] = useState('Retail')
  const [exportFilter, setExportFilter] = useState('All')
  const [exportType, setExportType] = useState('All')
  const [provinceState, setProvinceState] = useState('ON')
  const [country, setCountry] = useState('CA')

  const rows = useMemo<Row[]>(
    () => [
      { id: 'tfr_1', dealId: '402476', customer: 'Ben Lefebvre', feeName: 'OMVIC FEE', cost: 22, price: 22, date: 'Jan 14, 2026' },
      { id: 'tfr_2', dealId: '401691', customer: 'Esmeil Ali Ahmed', feeName: 'OMVIC FEE', cost: 22, price: 22, date: 'Jan 10, 2026' },
      { id: 'tfr_3', dealId: '401233', customer: 'Sarif Bhuiyan', feeName: 'OMVIC FEE', cost: 22, price: 22, date: 'Jan 6, 2026' },
    ],
    []
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return rows.filter((r) => {
      if (!q) return true
      return r.customer.toLowerCase().includes(q) || r.dealId.toLowerCase().includes(q) || r.feeName.toLowerCase().includes(q)
    })
  }, [query, rows])

  const total = filtered.reduce((sum, r) => sum + r.price, 0)

  return (
    <div className="min-h-screen">
      <div className="edc-page-header">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">OMVIC Transaction Fee Register</h1>
            <p className="text-sm text-slate-500 mt-0.5">Mock data only (UI design)</p>
          </div>
          <div className="text-sm text-slate-500">Total Fees: <span className="font-semibold text-slate-700">${total.toFixed(2)}</span></div>
        </div>
      </div>

      <div className="px-6 py-6">
        <div className="edc-card p-4">
          <div className="text-sm font-semibold text-slate-800">Filters</div>
          <div className="mt-3 grid grid-cols-1 lg:grid-cols-12 gap-3">
            <div className="lg:col-span-3">
              <label className="block text-xs font-semibold text-slate-500 mb-1">Reporting Period From</label>
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="edc-input" />
            </div>
            <div className="lg:col-span-3">
              <label className="block text-xs font-semibold text-slate-500 mb-1">Reporting Period To</label>
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="edc-input" />
            </div>
            <div className="lg:col-span-2">
              <label className="block text-xs font-semibold text-slate-500 mb-1">Transaction Type</label>
              <select value={transactionType} onChange={(e) => setTransactionType(e.target.value)} className="edc-input">
                <option value="Retail">Retail</option>
                <option value="Wholesale">Wholesale</option>
              </select>
            </div>
            <div className="lg:col-span-2">
              <label className="block text-xs font-semibold text-slate-500 mb-1">Export</label>
              <select value={exportFilter} onChange={(e) => setExportFilter(e.target.value)} className="edc-input">
                <option value="All">All</option>
                <option value="Yes">Yes</option>
                <option value="No">No</option>
              </select>
            </div>
            <div className="lg:col-span-2">
              <label className="block text-xs font-semibold text-slate-500 mb-1">Export Type</label>
              <select value={exportType} onChange={(e) => setExportType(e.target.value)} className="edc-input">
                <option value="All">All</option>
                <option value="Non Dealer">Non Dealer</option>
                <option value="Dealer">Dealer</option>
              </select>
            </div>

            <div className="lg:col-span-2">
              <label className="block text-xs font-semibold text-slate-500 mb-1">Province/State</label>
              <select value={provinceState} onChange={(e) => setProvinceState(e.target.value)} className="edc-input">
                <option value="ON">ON</option>
                <option value="BC">BC</option>
                <option value="AB">AB</option>
                <option value="MB">MB</option>
                <option value="QC">QC</option>
              </select>
            </div>
            <div className="lg:col-span-2">
              <label className="block text-xs font-semibold text-slate-500 mb-1">Country</label>
              <select value={country} onChange={(e) => setCountry(e.target.value)} className="edc-input">
                <option value="CA">CA</option>
                <option value="US">US</option>
              </select>
            </div>

            <div className="lg:col-span-8">
              <label className="block text-xs font-semibold text-slate-500 mb-1">Search</label>
              <input value={query} onChange={(e) => setQuery(e.target.value)} className="edc-input" placeholder="Search..." />
            </div>
            <div className="lg:col-span-4 flex items-end justify-end gap-2">
              <button type="button" className="edc-btn-primary text-sm">Search</button>
              <button
                type="button"
                onClick={() => {
                  setQuery('')
                  setTransactionType('Retail')
                  setExportFilter('All')
                  setExportType('All')
                  setProvinceState('ON')
                  setCountry('CA')
                }}
                className="edc-btn-ghost text-sm"
              >
                Reset
              </button>
            </div>
          </div>
        </div>

        <div className="edc-card mt-4 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
              <div className="text-sm text-slate-600">
                <div className="font-semibold text-slate-800">Legal Name of the Dealership:</div>
                <div>Trade Name: EASYDRIVE CANADA</div>
                <div>Prepared By: Jose Tanzo</div>
                <div>Position: Executive Assistant</div>
              </div>
              <div className="text-sm text-slate-600">
                <div className="font-semibold text-slate-800">OMVIC Registration Number:</div>
                <div>Reporting Period: {from} - {to}</div>
                <div>Report Total (QTY count considered): {filtered.length}</div>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="edc-table">
              <thead>
                <tr>
                  <th>Date (YYYY/MM/DD)</th>
                  <th>Deal ID</th>
                  <th>Transaction Type</th>
                  <th>Sale Type</th>
                  <th>Customer Name</th>
                  <th>Province/State</th>
                  <th>Country</th>
                  <th>Exported</th>
                  <th>Exported As? Non Dealer</th>
                  <th>VIN</th>
                  <th className="text-right">Count</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id}>
                    <td className="px-6 py-3 text-sm text-slate-600 whitespace-nowrap">{r.date.replaceAll(' ', '/')}</td>
                    <td className="px-6 py-3 text-sm font-medium text-slate-800 whitespace-nowrap">{r.dealId}</td>
                    <td className="px-6 py-3 text-sm text-slate-600 whitespace-nowrap">{transactionType}</td>
                    <td className="px-6 py-3 text-sm text-slate-600 whitespace-nowrap">Cash</td>
                    <td className="px-6 py-3 text-sm text-slate-600 whitespace-nowrap">{r.customer}</td>
                    <td className="px-6 py-3 text-sm text-slate-600 whitespace-nowrap">{provinceState}</td>
                    <td className="px-6 py-3 text-sm text-slate-600 whitespace-nowrap">{country}</td>
                    <td className="px-6 py-3 text-sm text-slate-600 whitespace-nowrap">No</td>
                    <td className="px-6 py-3 text-sm text-slate-600 whitespace-nowrap">&nbsp;</td>
                    <td className="px-6 py-3 text-sm text-slate-600 whitespace-nowrap">5N1AP2M49MC606768</td>
                    <td className="px-6 py-3 text-sm text-slate-800 whitespace-nowrap text-right">1</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-end text-sm text-slate-600">
            Total: <span className="font-semibold ml-2">{filtered.length}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
