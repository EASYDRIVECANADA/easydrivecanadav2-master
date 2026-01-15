'use client'

import { useMemo, useState } from 'react'

type ShowroomVehicle = {
  id: string
  vehicle: string
  drive: string
  transmission: string
  cyl: string
  colour: string
  odometerKm: number
  price: number
  status: 'In Stock' | 'Deal Pending' | 'Sold'
}

export default function CustomerShowroomPage() {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<'ALL' | ShowroomVehicle['status']>('ALL')
  const [selected, setSelected] = useState<ShowroomVehicle | null>(null)

  const rows = useMemo<ShowroomVehicle[]>(
    () => [
      {
        id: 'veh_2009_dodge_journey',
        vehicle: '2009 Dodge Journey SXT FWD',
        drive: 'FWD',
        transmission: 'Automatic',
        cyl: '6',
        colour: 'Silver',
        odometerKm: 223447,
        price: 4995,
        status: 'In Stock',
      },
      {
        id: 'veh_2016_nissan_leaf',
        vehicle: '2016 Nissan LEAF S',
        drive: 'FWD',
        transmission: 'Automatic',
        cyl: '0',
        colour: 'Red',
        odometerKm: 195610,
        price: 7495,
        status: 'In Stock',
      },
      {
        id: 'veh_2014_tucson',
        vehicle: '2014 Hyundai Tucson GL FWD',
        drive: 'FWD',
        transmission: 'Automatic',
        cyl: '4',
        colour: 'White',
        odometerKm: 135956,
        price: 9495,
        status: 'In Stock',
      },
      {
        id: 'veh_2013_f150',
        vehicle: '2013 Ford F-150 STX SUPER CAB 145 | EXTENDED CAB 2WD',
        drive: 'RWD',
        transmission: 'Automatic',
        cyl: '6',
        colour: 'White',
        odometerKm: 226694,
        price: 9495,
        status: 'Deal Pending',
      },
      {
        id: 'veh_2017_jetta',
        vehicle: '2017 Volkswagen Jetta 1.4 TSI WOLFSBURG EDITION - MANUAL',
        drive: 'FWD',
        transmission: 'Manual-5',
        cyl: '4',
        colour: 'White',
        odometerKm: 189001,
        price: 9995,
        status: 'In Stock',
      },
    ],
    []
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return rows.filter((r) => {
      if (status !== 'ALL' && r.status !== status) return false
      if (!q) return true
      return (
        r.vehicle.toLowerCase().includes(q) ||
        r.colour.toLowerCase().includes(q) ||
        r.drive.toLowerCase().includes(q) ||
        r.transmission.toLowerCase().includes(q) ||
        r.status.toLowerCase().includes(q)
      )
    })
  }, [query, rows, status])

  return (
    <div className="w-full">
      <div className="bg-white shadow">
        <div className="w-full px-4 sm:px-6 lg:px-8 py-4">
          <h1 className="text-2xl font-bold text-gray-900">Customer Showroom</h1>
          <p className="text-sm text-gray-500">Mock data only (UI design)</p>
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
                  placeholder="Search vehicle, drive, colour, status..."
                  className="w-full border border-gray-200 rounded-lg px-10 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent"
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

            <div className="w-full lg:w-64">
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent"
              >
                <option value="ALL">All Status</option>
                <option value="In Stock">In Stock</option>
                <option value="Deal Pending">Deal Pending</option>
                <option value="Sold">Sold</option>
              </select>
            </div>

            <div className="text-sm text-gray-500 whitespace-nowrap">Showing {filtered.length} of {rows.length}</div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow mt-4 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left text-xs font-semibold text-gray-600 uppercase tracking-wider px-3 py-3 w-12"></th>
                  <th className="text-left text-xs font-semibold text-gray-600 uppercase tracking-wider px-6 py-3">Vehicle</th>
                  <th className="text-left text-xs font-semibold text-gray-600 uppercase tracking-wider px-6 py-3">Drive</th>
                  <th className="text-left text-xs font-semibold text-gray-600 uppercase tracking-wider px-6 py-3">Trans.</th>
                  <th className="text-left text-xs font-semibold text-gray-600 uppercase tracking-wider px-6 py-3">Cyl.</th>
                  <th className="text-left text-xs font-semibold text-gray-600 uppercase tracking-wider px-6 py-3">Colour</th>
                  <th className="text-right text-xs font-semibold text-gray-600 uppercase tracking-wider px-6 py-3">Odometer</th>
                  <th className="text-right text-xs font-semibold text-gray-600 uppercase tracking-wider px-6 py-3">Price</th>
                  <th className="text-right text-xs font-semibold text-gray-600 uppercase tracking-wider px-6 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-3 py-3">
                      <button
                        type="button"
                        onClick={() => setSelected(r)}
                        className="w-9 h-9 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
                        title="Open deal sheet"
                        aria-label="Open deal sheet"
                      >
                        <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13l-1.2 6H18M7 13l-1.6-8M9 21a1 1 0 100-2 1 1 0 000 2zm10 0a1 1 0 100-2 1 1 0 000 2z"
                          />
                        </svg>
                      </button>
                    </td>
                    <td className="px-6 py-3 text-sm font-medium text-[#118df0] whitespace-nowrap">{r.vehicle}</td>
                    <td className="px-6 py-3 text-sm text-gray-700 whitespace-nowrap">{r.drive}</td>
                    <td className="px-6 py-3 text-sm text-gray-700 whitespace-nowrap">{r.transmission}</td>
                    <td className="px-6 py-3 text-sm text-gray-700 whitespace-nowrap">{r.cyl}</td>
                    <td className="px-6 py-3 text-sm text-gray-700 whitespace-nowrap">{r.colour}</td>
                    <td className="px-6 py-3 text-sm text-gray-700 whitespace-nowrap text-right">{r.odometerKm.toLocaleString()} km</td>
                    <td className="px-6 py-3 text-sm text-gray-900 whitespace-nowrap text-right">${r.price.toLocaleString()}</td>
                    <td className="px-6 py-3 text-sm whitespace-nowrap text-right">
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                          r.status === 'In Stock'
                            ? 'bg-green-100 text-green-700'
                            : r.status === 'Deal Pending'
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {r.status}
                      </span>
                    </td>
                  </tr>
                ))}

                {filtered.length === 0 ? (
                  <tr>
                    <td className="px-6 py-10 text-center text-sm text-gray-500" colSpan={9}>
                      No results.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        {selected ? (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            role="dialog"
            aria-modal="true"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) setSelected(null)
            }}
          >
            <div className="w-full max-w-5xl bg-white rounded-2xl shadow-xl overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <button
                  type="button"
                  className="text-sm font-semibold text-[#118df0] hover:underline"
                  onClick={() => setSelected(null)}
                >
                  ← Showroom
                </button>
                <button
                  type="button"
                  className="w-10 h-10 rounded-xl hover:bg-gray-100 flex items-center justify-center"
                  onClick={() => setSelected(null)}
                  aria-label="Close"
                >
                  <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2">
                <div className="bg-gray-100 p-6 flex flex-col">
                  <div className="flex-1 rounded-xl bg-white border border-gray-200 flex items-center justify-center relative overflow-hidden">
                    <div className="text-center">
                      <svg className="w-20 h-20 text-gray-300 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4-4a3 5 0 013 0l4 4M14 14l1-1a3 5 0 013 0l2 2" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
                      </svg>
                      <div className="text-gray-400 text-sm font-semibold">NO IMAGE AVAILABLE</div>
                    </div>

                    <button type="button" className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/80 hover:bg-white flex items-center justify-center">
                      <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                    <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/80 hover:bg-white flex items-center justify-center">
                      <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>

                  <div className="mt-4">
                    <div className="text-lg font-semibold text-gray-900">{selected.vehicle} {selected.colour}</div>
                    <div className="text-sm text-gray-600">
                      {selected.odometerKm.toLocaleString()} kms <span className="text-gray-400">•</span> {selected.drive}{' '}
                      <span className="text-gray-400">•</span> {selected.transmission}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">VIN: 3D4GG57V19T529050</div>
                    <div className="text-xs text-gray-500">Stock# 1002</div>
                  </div>
                </div>

                <div className="p-6">
                  <div className="bg-gray-50 rounded-xl border border-gray-200 overflow-hidden">
                    <div className="divide-y divide-gray-200">
                      <Row label="Vehicle Price" value={`$${selected.price.toLocaleString()}.00`} bold />
                      <Row label="Other Fees" value="$22.00" />
                      <Row label="Licensing" value="$91.00" />
                      <Row label="Total Price" value={`$${(selected.price + 113).toLocaleString()}.00`} />
                      <Row label="Trade Value" value="$0.00" />
                      <Row label="True Trade Value" value="$0.00" />
                      <Row label="Lien Payout" value="$0.00" />
                      <Row label="Sub Total" value={`$${(selected.price + 113).toLocaleString()}.00`} />
                      <Row label="HST" value="$652.21" />
                      <Row label="Total Tax(s)" value="$652.21" />
                      <Row label="Grand Total" value="$5,760.21" bold />
                      <Row label="Deposit" value="$0.00" />
                      <Row label="Payable on Delivery" value="$5,760.21" bold highlight />
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-end gap-2">
                    <button type="button" className="h-10 px-4 rounded-lg bg-green-600 text-white text-sm font-semibold hover:bg-green-700">
                      BUY NOW
                    </button>
                    <button type="button" className="h-10 w-10 rounded-lg bg-[#118df0] text-white flex items-center justify-center" aria-label="More">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6h10M10 12h10M10 18h10M4 6h.01M4 12h.01M4 18h.01" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}

function Row({ label, value, bold, highlight }: { label: string; value: string; bold?: boolean; highlight?: boolean }) {
  return (
    <div className={`flex items-center justify-between px-5 py-3 ${highlight ? 'bg-white' : ''}`}>
      <div className={`${bold ? 'font-semibold text-gray-900' : 'text-gray-700'} text-sm`}>{label}</div>
      <div className={`${bold ? 'font-semibold text-gray-900' : 'text-gray-700'} text-sm`}>{value}</div>
    </div>
  )
}
