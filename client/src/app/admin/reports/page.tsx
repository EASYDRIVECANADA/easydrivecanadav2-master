'use client'

import Link from 'next/link'
import { usePermissions } from '@/lib/permissions'

export default function ReportsHomePage() {
  const permissions = usePermissions()
  const showSalesReports = permissions.can('sales_reports_access')
  const showInventoryReports = permissions.can('inventory_reports_access')
  const showInventoryCosts = permissions.can('costs')

  return (
    <div className="min-h-screen">
      <div className="edc-page-header">
        <h1 className="text-2xl font-bold text-slate-900">Reports</h1>
        <p className="text-sm text-slate-500 mt-0.5">Live dealership and inventory reporting</p>
      </div>

      <div className="px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {showSalesReports ? (
          <div className="edc-card p-5">
            <div className="text-sm font-semibold text-slate-800">Sales Reports</div>
            <div className="text-xs text-slate-500 mt-1">Closed deals and transaction fee records</div>
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
          ) : null}

          {showInventoryReports ? (
          <div className="edc-card p-5">
            <div className="text-sm font-semibold text-slate-800">Inventory Reports</div>
            <div className="text-xs text-slate-500 mt-1">Purchases, costs, values, keys, and garage records</div>
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
              {showInventoryCosts ? <Link href="/admin/reports/inventory/inventory-costs" className="border border-slate-200/60 rounded-xl px-4 py-3 hover:bg-slate-50 transition-colors">
                <div className="text-sm font-semibold text-slate-800">Inventory Costs</div>
                <div className="text-xs text-slate-500">Costs breakdown</div>
              </Link> : null}
            </div>
          </div>
          ) : null}
          {!showSalesReports && !showInventoryReports && !permissions.loading ? (
            <div className="edc-card p-5 lg:col-span-2">
              <div className="text-sm font-semibold text-slate-800">No report access</div>
              <div className="text-xs text-slate-500 mt-1">Ask an administrator to enable report permissions for your account.</div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
