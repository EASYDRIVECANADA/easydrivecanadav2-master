'use client'

import { useMemo, useState } from 'react'

type Row = {
  [key: string]: string | number
}

export default function SalesReportPage() {
  const [from, setFrom] = useState('2026-01-01')
  const [to, setTo] = useState('2026-01-31')
  const [query, setQuery] = useState('')
  const [perPage, setPerPage] = useState('500')

  const columns = useMemo(
    () => [
      { key: 'deal_date', label: 'Deal Date' },
      { key: 'close_date', label: 'Close Date' },
      { key: 'legal_dealername', label: 'Legal Dealername' },
      { key: 'first_name', label: 'First Name' },
      { key: 'last_name', label: 'Last Name' },
      { key: 'address', label: 'Address' },
      { key: 'lender_or_bank', label: 'Lender or Bank' },
      { key: 'year', label: 'Year' },
      { key: 'make', label: 'Make' },
      { key: 'model', label: 'Model' },
      { key: 'new_used', label: 'New/Used' },
      { key: 'disclosures', label: 'Disclosures' },
      { key: 'cert_as_is', label: 'Cert/As-Is' },
      { key: 'dii', label: 'DII' },
      { key: 'customer_source', label: 'Customer Source' },
      { key: 'purchase_price', label: 'Purchase Price' },
      { key: 'vehicle_purchase_price', label: 'Vehicle Purchase Price' },
      { key: 'costs', label: 'Costs' },
      { key: 'tax_on_costs', label: 'Tax on Costs' },
      { key: 'all_in', label: 'All In' },
      { key: 'discount', label: 'Discount' },
      { key: 'trade_equity', label: 'Trade Equity' },
      { key: 'vehicle_profit', label: 'Vehicle Profit' },
      { key: 'sales_person', label: 'Sales Person' },
      { key: 'approved_by', label: 'Approved By' },
      { key: 'deal_type', label: 'Deal Type' },
      { key: 'deal_state', label: 'Deal State' },
      { key: 'bank_commission', label: 'Bank Commission' },
      { key: 'warr_retail', label: 'Warr. Retail' },
      { key: 'warr_cost', label: 'Warr. Cost' },
      { key: 'warr_profit', label: 'Warr. Profit' },
      { key: 'warr_tot_tax', label: 'Warr. Tot Tax' },
      { key: 'ins_retail', label: 'Ins. Retail' },
      { key: 'ins_cost', label: 'Ins. Cost' },
      { key: 'ins_profit', label: 'Ins. Profit' },
      { key: 'ins_tot_tax', label: 'Ins. Tot Tax' },
      { key: 'acc_retail', label: 'Acc. Retail' },
      { key: 'acc_cost', label: 'Acc. Cost' },
      { key: 'acc_profit', label: 'Acc. Profit' },
      { key: 'acc_tot_tax', label: 'Acc. Tot Tax' },
      { key: 'fees_retail', label: 'Fees Retail' },
      { key: 'fees_cost', label: 'Fees Cost' },
      { key: 'fees_profit', label: 'Fees Profit' },
      { key: 'fees_tot_tax', label: 'Fees. Tot Tax' },
      { key: 'subtotal', label: 'Subtotal' },
      { key: 'total_profit', label: 'Total Profit' },
      { key: 'total_tax_after_market', label: 'Total Tax (After Market)' },
      { key: 'licensing_fee', label: 'Licensing Fee' },
      { key: 'hst_13', label: 'HST - 13%' },
      { key: 'total_tax', label: 'Total Tax' },
    ],
    []
  )

  const rows = useMemo<Row[]>(
    () => [
      {
        deal_date: '01/14/2026',
        close_date: 'N/A',
        legal_dealername: 'EASYDRIVE CANADA',
        first_name: 'Ben',
        last_name: 'Lefebvre',
        address: 'Toronto, ON',
        lender_or_bank: 'N/A',
        year: '2017',
        make: 'Volkswagen',
        model: 'Jetta',
        new_used: 'Used',
        disclosures: '',
        cert_as_is: 'As-Is',
        dii: '',
        customer_source: 'Walk-in',
        purchase_price: '5800',
        vehicle_purchase_price: '9995',
        costs: '22',
        tax_on_costs: '0',
        all_in: '10017',
        discount: '0',
        trade_equity: '0',
        vehicle_profit: '1200',
        sales_person: 'Syed Islam',
        approved_by: 'Admin',
        deal_type: 'Cash',
        deal_state: 'Open',
        bank_commission: '0',
        warr_retail: '0',
        warr_cost: '0',
        warr_profit: '0',
        warr_tot_tax: '0',
        ins_retail: '0',
        ins_cost: '0',
        ins_profit: '0',
        ins_tot_tax: '0',
        acc_retail: '0',
        acc_cost: '0',
        acc_profit: '0',
        acc_tot_tax: '0',
        fees_retail: '22',
        fees_cost: '22',
        fees_profit: '0',
        fees_tot_tax: '0',
        subtotal: '10017',
        total_profit: '1200',
        total_tax_after_market: '0',
        licensing_fee: '91',
        hst_13: '652.21',
        total_tax: '652.21',
      },
      {
        deal_date: '01/10/2026',
        close_date: 'N/A',
        legal_dealername: 'EASYDRIVE CANADA',
        first_name: 'Esmeil',
        last_name: 'Ahmed',
        address: 'Mississauga, ON',
        lender_or_bank: 'N/A',
        year: '2017',
        make: 'Kia',
        model: 'Sorento',
        new_used: 'Used',
        disclosures: '',
        cert_as_is: 'As-Is',
        dii: '',
        customer_source: 'Online',
        purchase_price: '7200',
        vehicle_purchase_price: '10995',
        costs: '22',
        tax_on_costs: '0',
        all_in: '11017',
        discount: '0',
        trade_equity: '0',
        vehicle_profit: '950',
        sales_person: 'Syed Islam',
        approved_by: 'Admin',
        deal_type: 'Cash',
        deal_state: 'Open',
        bank_commission: '0',
        warr_retail: '0',
        warr_cost: '0',
        warr_profit: '0',
        warr_tot_tax: '0',
        ins_retail: '0',
        ins_cost: '0',
        ins_profit: '0',
        ins_tot_tax: '0',
        acc_retail: '0',
        acc_cost: '0',
        acc_profit: '0',
        acc_tot_tax: '0',
        fees_retail: '22',
        fees_cost: '22',
        fees_profit: '0',
        fees_tot_tax: '0',
        subtotal: '11017',
        total_profit: '950',
        total_tax_after_market: '0',
        licensing_fee: '91',
        hst_13: '652.21',
        total_tax: '652.21',
      },
    ],
    []
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return rows.filter((r) => {
      if (!q) return true
      const haystack = Object.values(r)
        .map((v) => String(v).toLowerCase())
        .join(' ')
      return haystack.includes(q)
    })
  }, [query, rows])

  return (
    <div className="w-full">
      <div className="bg-white shadow">
        <div className="w-full px-4 sm:px-6 lg:px-8 py-4 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Default Report ({from.replaceAll('-', '/')} - {to.replaceAll('-', '/')})</h1>
            <p className="text-sm text-gray-500">Mock data only (UI design)</p>
          </div>

          <div className="flex items-center gap-3">
            <select
              value={perPage}
              onChange={(e) => setPerPage(e.target.value)}
              className="h-10 border border-gray-200 rounded-lg px-3 text-sm"
            >
              <option value="50">50</option>
              <option value="100">100</option>
              <option value="250">250</option>
              <option value="500">500</option>
            </select>
            <button type="button" className="h-10 px-4 rounded-lg bg-[#118df0] text-white text-sm font-semibold hover:bg-[#0d6ebd]">
              Export
            </button>
          </div>
        </div>
      </div>

      <div className="w-full px-4 sm:px-6 lg:px-8 py-6">
        <div className="bg-white rounded-xl shadow p-4">
          <div className="flex flex-col lg:flex-row lg:items-center gap-3">
            <div className="flex-1">
              <div className="relative">
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="search"
                  className="w-full border border-gray-200 rounded-lg pl-10 pr-3 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent"
                />
                <svg
                  className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35m1.35-5.65a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>

            <button type="button" className="h-10 px-4 rounded-lg bg-white border border-gray-200 text-sm hover:bg-gray-50">
              Advanced
            </button>
          </div>

          <div className="mt-2 text-xs text-gray-500">Total Sales: <span className="font-semibold">{filtered.length}</span></div>
        </div>

        <div className="bg-white rounded-xl shadow mt-4 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-max w-full">
              <thead className="bg-gray-50 sticky top-0 z-10">
                <tr>
                  {columns.map((c) => (
                    <th
                      key={c.key}
                      className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap"
                    >
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((r, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    {columns.map((c) => (
                      <td key={c.key} className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                        {r[c.key] ?? ''}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
