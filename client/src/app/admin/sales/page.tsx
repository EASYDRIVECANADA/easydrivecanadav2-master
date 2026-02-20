'use client'

import Link from 'next/link'

export default function SalesHomePage() {
  return (
    <div className="min-h-screen">
      <div className="edc-page-header">
        <h1 className="text-2xl font-bold text-slate-900">Sales</h1>
        <p className="text-sm text-slate-500 mt-0.5">Mock data only (UI design)</p>
      </div>

      <div className="px-6 py-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link href="/admin/sales/showroom" className="edc-card p-5 hover:shadow-premium transition-shadow">
            <div className="text-sm font-semibold text-slate-800">Customer Showroom</div>
            <div className="text-xs text-slate-500 mt-1">Vehicle list (mock)</div>
          </Link>
          <Link href="/admin/sales/deals" className="edc-card p-5 hover:shadow-premium transition-shadow">
            <div className="text-sm font-semibold text-slate-800">Deals</div>
            <div className="text-xs text-slate-500 mt-1">Deals table (mock)</div>
          </Link>
          <Link href="/admin/sales/deal-adjustor" className="edc-card p-5 hover:shadow-premium transition-shadow">
            <div className="text-sm font-semibold text-slate-800">Deal Adjustor</div>
            <div className="text-xs text-slate-500 mt-1">Adjustor table (mock)</div>
          </Link>
        </div>
      </div>
    </div>
  )
}
