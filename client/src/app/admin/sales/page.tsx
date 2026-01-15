'use client'

import Link from 'next/link'

export default function SalesHomePage() {
  return (
    <div className="w-full">
      <div className="bg-white shadow">
        <div className="w-full px-4 sm:px-6 lg:px-8 py-4">
          <h1 className="text-2xl font-bold text-gray-900">Sales</h1>
          <p className="text-sm text-gray-500">Mock data only (UI design)</p>
        </div>
      </div>

      <div className="w-full px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link href="/admin/sales/showroom" className="bg-white rounded-xl shadow p-5 hover:shadow-lg transition-shadow">
            <div className="text-sm font-semibold text-gray-900">Customer Showroom</div>
            <div className="text-xs text-gray-500 mt-1">Vehicle list (mock)</div>
          </Link>
          <Link href="/admin/sales/deals" className="bg-white rounded-xl shadow p-5 hover:shadow-lg transition-shadow">
            <div className="text-sm font-semibold text-gray-900">Deals</div>
            <div className="text-xs text-gray-500 mt-1">Deals table (mock)</div>
          </Link>
          <Link href="/admin/sales/deal-adjustor" className="bg-white rounded-xl shadow p-5 hover:shadow-lg transition-shadow">
            <div className="text-sm font-semibold text-gray-900">Deal Adjustor</div>
            <div className="text-xs text-gray-500 mt-1">Adjustor table (mock)</div>
          </Link>
        </div>
      </div>
    </div>
  )
}
