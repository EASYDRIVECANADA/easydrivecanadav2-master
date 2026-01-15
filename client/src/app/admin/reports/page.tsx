'use client'

import Link from 'next/link'

export default function ReportsHomePage() {
  return (
    <div className="w-full">
      <div className="bg-white shadow">
        <div className="w-full px-4 sm:px-6 lg:px-8 py-4">
          <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
          <p className="text-sm text-gray-500">Mock data only (UI design)</p>
        </div>
      </div>

      <div className="w-full px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white rounded-xl shadow p-5">
            <div className="text-sm font-semibold text-gray-900">Sales Reports</div>
            <div className="text-xs text-gray-500 mt-1">Mock reports</div>
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Link href="/admin/reports/sales/sales-report" className="border border-gray-200 rounded-lg px-4 py-3 hover:bg-gray-50">
                <div className="text-sm font-semibold text-gray-900">Sales Report</div>
                <div className="text-xs text-gray-500">Summary table</div>
              </Link>
              <Link href="/admin/reports/sales/transaction-fee-report" className="border border-gray-200 rounded-lg px-4 py-3 hover:bg-gray-50">
                <div className="text-sm font-semibold text-gray-900">Transaction Fee Report</div>
                <div className="text-xs text-gray-500">Fees breakdown</div>
              </Link>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow p-5">
            <div className="text-sm font-semibold text-gray-900">Inventory Reports</div>
            <div className="text-xs text-gray-500 mt-1">Mock reports</div>
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Link href="/admin/reports/inventory/purchase-summary" className="border border-gray-200 rounded-lg px-4 py-3 hover:bg-gray-50">
                <div className="text-sm font-semibold text-gray-900">Purchase Summary</div>
                <div className="text-xs text-gray-500">Purchases list</div>
              </Link>
              <Link href="/admin/reports/inventory/keylist" className="border border-gray-200 rounded-lg px-4 py-3 hover:bg-gray-50">
                <div className="text-sm font-semibold text-gray-900">Keylist</div>
                <div className="text-xs text-gray-500">Keys tracking</div>
              </Link>
              <Link href="/admin/reports/inventory/garage-register" className="border border-gray-200 rounded-lg px-4 py-3 hover:bg-gray-50">
                <div className="text-sm font-semibold text-gray-900">Garage Register</div>
                <div className="text-xs text-gray-500">In/out log</div>
              </Link>
              <Link href="/admin/reports/inventory/inventory-value" className="border border-gray-200 rounded-lg px-4 py-3 hover:bg-gray-50">
                <div className="text-sm font-semibold text-gray-900">Inventory Value</div>
                <div className="text-xs text-gray-500">Totals</div>
              </Link>
              <Link href="/admin/reports/inventory/inventory-costs" className="border border-gray-200 rounded-lg px-4 py-3 hover:bg-gray-50">
                <div className="text-sm font-semibold text-gray-900">Inventory Costs</div>
                <div className="text-xs text-gray-500">Costs breakdown</div>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
