'use client'

import Link from 'next/link'

export default function ReportsHomePage() {
  return (
    <div className="min-h-screen">
      <div className="edc-page-header">
        <h1 className="text-2xl font-bold text-slate-900">Reports</h1>
        <p className="text-sm text-slate-500 mt-0.5">Mock data only (UI design)</p>
      </div>

      <div className="px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="edc-card p-5">
            <div className="text-sm font-semibold text-slate-800">Sales Reports</div>
            <div className="text-xs text-slate-500 mt-1">Mock reports</div>
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Link href="/admin/reports/sales/sales-report" className="border border-slate-200/60 rounded-xl px-4 py-3 hover:bg-slate-50 transition-colors">
                <div className="text-sm font-semibold text-slate-800">Sales Report</div>
                <div className="text-xs text-slate-500">Summary table</div>
              </Link>
              <Link href="/admin/reports/sales/transaction-fee-report" className="border border-slate-200/60 rounded-xl px-4 py-3 hover:bg-slate-50 transition-colors">
                <div className="text-sm font-semibold text-slate-800">Transaction Fee Report</div>
                <div className="text-xs text-slate-500">Fees breakdown</div>
              </Link>
            </div>
          </div>

          <div className="edc-card p-5">
            <div className="text-sm font-semibold text-slate-800">Inventory Reports</div>
            <div className="text-xs text-slate-500 mt-1">Mock reports</div>
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Link href="/admin/reports/inventory/purchase-summary" className="border border-slate-200/60 rounded-xl px-4 py-3 hover:bg-slate-50 transition-colors">
                <div className="text-sm font-semibold text-slate-800">Purchase Summary</div>
                <div className="text-xs text-slate-500">Purchases list</div>
              </Link>
              <Link href="/admin/reports/inventory/keylist" className="border border-slate-200/60 rounded-xl px-4 py-3 hover:bg-slate-50 transition-colors">
                <div className="text-sm font-semibold text-slate-800">Keylist</div>
                <div className="text-xs text-slate-500">Keys tracking</div>
              </Link>
              <Link href="/admin/reports/inventory/garage-register" className="border border-slate-200/60 rounded-xl px-4 py-3 hover:bg-slate-50 transition-colors">
                <div className="text-sm font-semibold text-slate-800">Garage Register</div>
                <div className="text-xs text-slate-500">In/out log</div>
              </Link>
              <Link href="/admin/reports/inventory/inventory-value" className="border border-slate-200/60 rounded-xl px-4 py-3 hover:bg-slate-50 transition-colors">
                <div className="text-sm font-semibold text-slate-800">Inventory Value</div>
                <div className="text-xs text-slate-500">Totals</div>
              </Link>
              <Link href="/admin/reports/inventory/inventory-costs" className="border border-slate-200/60 rounded-xl px-4 py-3 hover:bg-slate-50 transition-colors">
                <div className="text-sm font-semibold text-slate-800">Inventory Costs</div>
                <div className="text-xs text-slate-500">Costs breakdown</div>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
