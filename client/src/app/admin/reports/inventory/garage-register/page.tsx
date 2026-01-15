'use client'

import { useMemo, useState } from 'react'

type Row = {
  id: string
  purchasedFromName: string
  purchasedFromAddress: string
  plateNo: string
  odometerReading: string
  make: string
  model: string
  stockNumber: string
  serialNo: string
  colour: string
  dateInStock: string
  inConsignment: string
  dateOut: string
  soldToName: string
  soldToAddress: string
}

export default function GarageRegisterPage() {
  const [status, setStatus] = useState('In Stock, Sold, Deal Pending In Trade, In Stock (No Deal)')
  const [filterType, setFilterType] = useState('Purchased Between')
  const [perPage, setPerPage] = useState('150')
  const [query, setQuery] = useState('')

  const rows = useMemo<Row[]>(
    () => [
      {
        id: 'gr_1',
        purchasedFromName: 'Owais Ahmed',
        purchasedFromAddress: '99 Margrove Ave Ottawa ON K1T 3Y1',
        plateNo: 'CWS854',
        odometerReading: '229,192 kms',
        make: 'Subaru',
        model: 'Forester',
        stockNumber: '1011',
        serialNo: 'JF2SHCDC3AH774666',
        colour: 'Red',
        dateInStock: 'Jan 5, 2026',
        inConsignment: '',
        dateOut: 'Jan 5, 2026',
        soldToName: 'Sarif Uddin Bhuiyan',
        soldToAddress: '43 Queen Mary St Ottawa ON K1V 1H4',
      },
      {
        id: 'gr_2',
        purchasedFromName: 'Adesa Ottawa',
        purchasedFromAddress: '1771 Burton Rd Ottawa ON K0A 1H0',
        plateNo: '205128',
        odometerReading: '205,128 kms',
        make: 'Tesla',
        model: 'Model 3',
        stockNumber: '1010',
        serialNo: '5YJ3E1EBXJF080845',
        colour: 'White',
        dateInStock: 'Jan 4, 2026',
        inConsignment: '',
        dateOut: '',
        soldToName: '',
        soldToAddress: '',
      },
      {
        id: 'gr_3',
        purchasedFromName: 'OPENLANE Canada',
        purchasedFromAddress: '370 King St W, Toronto ON M5V 1J9',
        plateNo: '177741',
        odometerReading: '177,741 kms',
        make: 'Volkswagen',
        model: 'Jetta',
        stockNumber: '1008',
        serialNo: '3VWB67AJ8HM378317',
        colour: 'Blue',
        dateInStock: 'Dec 10, 2025',
        inConsignment: 'In for sale working on consignment',
        dateOut: '',
        soldToName: '',
        soldToAddress: '',
      },
    ],
    []
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return rows.filter((r) => {
      if (!q) return true
      const haystack = `${r.purchasedFromName} ${r.purchasedFromAddress} ${r.plateNo} ${r.odometerReading} ${r.make} ${r.model} ${r.stockNumber} ${r.serialNo} ${r.soldToName}`.toLowerCase()
      return haystack.includes(q)
    })
  }, [query, rows])

  return (
    <div className="w-full">
      <div className="bg-white shadow">
        <div className="w-full px-4 sm:px-6 lg:px-8 py-4">
          <h1 className="text-2xl font-bold text-gray-900">Garage Register</h1>
          <p className="text-sm text-gray-500">Mock data only (UI design)</p>
        </div>
      </div>

      <div className="w-full px-4 sm:px-6 lg:px-8 py-6">
        <div className="bg-white rounded-xl shadow p-4">
          <div className="flex flex-col xl:flex-row xl:items-center gap-3">
            <div className="flex-1">
              <label className="block text-xs font-semibold text-gray-600 mb-1">Filter by Status</label>
              <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2">
                <option value="In Stock, Sold, Deal Pending In Trade, In Stock (No Deal)">In Stock, Sold, Deal Pending In Trade, In Stock (No Deal)</option>
                <option value="In Stock">In Stock</option>
                <option value="Sold">Sold</option>
              </select>
            </div>

            <div className="xl:w-[420px]">
              <label className="block text-xs font-semibold text-gray-600 mb-1">Filter Type</label>
              <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2">
                <option value="Purchased Between">Purchased Between</option>
                <option value="Sold Between">Sold Between</option>
              </select>
            </div>

            <div className="flex items-center gap-2 xl:justify-end">
              <button type="button" className="h-10 px-4 rounded-lg bg-[#118df0] text-white text-sm font-semibold hover:bg-[#0d6ebd]">Export</button>
              <button type="button" className="h-10 px-4 rounded-lg bg-white border border-gray-200 text-sm hover:bg-gray-50">Print</button>
            </div>

            <div className="xl:w-[120px] xl:ml-auto">
              <label className="block text-xs font-semibold text-gray-600 mb-1">&nbsp;</label>
              <select value={perPage} onChange={(e) => setPerPage(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2">
                <option value="50">50</option>
                <option value="100">100</option>
                <option value="150">150</option>
                <option value="500">500</option>
              </select>
            </div>
          </div>

          <div className="mt-3 flex flex-col lg:flex-row lg:items-center gap-3">
            <div className="flex-1 relative">
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="search" className="w-full border border-gray-200 rounded-lg pl-10 pr-3 py-2" />
              <svg className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35m1.35-5.65a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <button type="button" className="h-10 px-4 rounded-lg bg-white border border-gray-200 text-sm hover:bg-gray-50">Advanced</button>
          </div>

          <div className="mt-2 text-xs text-gray-500">Total Entries: <span className="font-semibold">{filtered.length}</span></div>
        </div>

        <div className="bg-white rounded-xl shadow mt-4 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-max w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th colSpan={2} className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-r border-gray-100">Purchased From - Registered Owner</th>
                  <th colSpan={9} className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-r border-gray-100">Used Motor Vehicle</th>
                  <th colSpan={3} className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Sold to - Name of new Owner</th>
                </tr>
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Name</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-r border-gray-100">Address</th>

                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Plate No.</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Odometer Reading</th>

                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Make</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Model</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Stock #</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Serial No.</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Colour</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Date into Stock</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-r border-gray-100">In for a re-sale wrecking or consignment</th>

                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Date out</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Name</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Address</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">{r.purchasedFromName}</td>
                    <td className="px-4 py-3 text-sm text-gray-700 min-w-[280px] border-r border-gray-100">{r.purchasedFromAddress}</td>

                    <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">{r.plateNo}</td>
                    <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">{r.odometerReading}</td>

                    <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">{r.make}</td>
                    <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">{r.model}</td>
                    <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">{r.stockNumber}</td>
                    <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">{r.serialNo}</td>
                    <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">{r.colour}</td>
                    <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">{r.dateInStock}</td>
                    <td className="px-4 py-3 text-sm text-gray-700 min-w-[260px] border-r border-gray-100">{r.inConsignment}</td>

                    <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">{r.dateOut}</td>
                    <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">{r.soldToName}</td>
                    <td className="px-4 py-3 text-sm text-gray-700 min-w-[280px]">{r.soldToAddress}</td>
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
