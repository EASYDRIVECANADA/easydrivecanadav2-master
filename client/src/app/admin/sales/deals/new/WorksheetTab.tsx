'use client'

export default function WorksheetTab() {
  return (
    <div className="w-full">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="border border-gray-200 bg-white">
          <div className="h-10 px-3 border-b border-gray-200 flex items-center justify-between">
            <div className="text-sm font-semibold text-gray-700">Deal Breakdown</div>
            <button type="button" className="text-gray-400 hover:text-gray-600" aria-label="Info">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="9" strokeWidth={2} />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11v5" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8h.01" />
              </svg>
            </button>
          </div>

          <div className="p-4 space-y-4">
            <div>
              <div className="text-xs text-gray-700 mb-1">Purchase Price</div>
              <div className="flex items-stretch border border-gray-200 rounded bg-white shadow-sm overflow-hidden w-60">
                <div className="w-10 flex items-center justify-center bg-gray-100 text-gray-600 border-r border-gray-200">$
                </div>
                <input className="flex-1 h-10 px-3 text-sm outline-none" defaultValue="0" />
              </div>
            </div>

            <div>
              <div className="text-xs text-gray-700 mb-1">Discount</div>
              <div className="flex items-stretch border border-gray-200 rounded bg-white shadow-sm overflow-hidden w-60">
                <div className="w-10 flex items-center justify-center bg-gray-100 text-gray-600 border-r border-gray-200">$
                </div>
                <input className="flex-1 h-10 px-3 text-sm outline-none" defaultValue="0" />
              </div>
            </div>

            <div>
              <div className="text-xs text-gray-700 mb-1">Subtotal</div>
              <div className="w-60 h-10 px-3 flex items-center text-sm bg-gray-100 border border-gray-200 rounded">22</div>
            </div>

            <div>
              <div className="text-xs text-gray-700 mb-1">Select Tax Rate</div>
              <div className="text-xs text-[#118df0]">HST</div>
            </div>

            <div className="flex items-center gap-3">
              <div>
                <div className="text-xs text-gray-700 mb-1">Tax Rate</div>
                <div className="w-60 h-10 px-3 flex items-center text-sm bg-gray-100 border border-gray-200 rounded">0</div>
              </div>
              <label className="flex items-center gap-2 text-xs text-gray-700 mt-5">
                <input type="checkbox" className="h-4 w-4" />
                Tax Override
              </label>
            </div>

            <div>
              <div className="text-xs text-gray-700 mb-1">Total Tax</div>
              <div className="flex items-stretch border border-gray-200 rounded bg-white shadow-sm overflow-hidden w-60">
                <div className="w-10 flex items-center justify-center bg-gray-100 text-gray-600 border-r border-gray-200">$
                </div>
                <input className="flex-1 h-10 px-3 text-sm outline-none bg-gray-100" defaultValue="2.86" readOnly />
                <div className="w-10 flex items-center justify-center bg-gray-100 text-gray-600 border-l border-gray-200">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="9" strokeWidth={2} />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11v5" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8h.01" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div>
                <div className="text-xs text-gray-700 mb-1">License Fee</div>
                <div className="flex items-stretch border border-gray-200 rounded bg-white shadow-sm overflow-hidden w-60">
                  <div className="w-10 flex items-center justify-center bg-gray-100 text-gray-600 border-r border-gray-200">$
                  </div>
                  <input className="flex-1 h-10 px-3 text-sm outline-none" defaultValue="91" />
                </div>
              </div>
              <div className="flex items-center gap-6 mt-5">
                <label className="flex items-center gap-2 text-xs text-gray-700">
                  <input type="checkbox" className="h-4 w-4" />
                  New Plates
                </label>
                <label className="flex items-center gap-2 text-xs text-gray-700">
                  <input type="checkbox" className="h-4 w-4" />
                  Renewal Only
                </label>
              </div>
            </div>

            <div>
              <div className="text-xs text-gray-700 mb-1">Total Balance Due</div>
              <div className="flex items-stretch border border-gray-200 rounded bg-white shadow-sm overflow-hidden w-60">
                <div className="w-10 flex items-center justify-center bg-gray-100 text-gray-600 border-r border-gray-200">$
                </div>
                <input className="flex-1 h-10 px-3 text-sm outline-none bg-gray-100" defaultValue="115.86" readOnly />
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="border border-gray-200 bg-white">
            <div className="h-10 px-3 border-b border-gray-200 flex items-center justify-between">
              <div className="text-sm font-semibold text-gray-700">Fees</div>
              <div className="h-6 px-2 rounded bg-green-600 text-white text-xs font-semibold flex items-center">total: $22.00</div>
            </div>
            <div className="p-3">
              <div className="relative">
                <input
                  placeholder="search fees"
                  className="w-full h-10 border border-gray-200 rounded bg-white pl-10 pr-3 text-sm shadow-sm"
                />
                <svg
                  className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-4.35-4.35m1.35-5.65a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </div>

              <div className="mt-3 border border-gray-200">
                <div className="grid grid-cols-[40px_1fr_1fr_140px_80px] text-[10px] font-semibold text-gray-600 bg-gray-50 border-b border-gray-200">
                  <div className="p-2" />
                  <div className="p-2">FEE NAME</div>
                  <div className="p-2">FEE DESC.</div>
                  <div className="p-2">FEE AMOUNT</div>
                  <div className="p-2 text-center">MORE</div>
                </div>
                <div className="grid grid-cols-[40px_1fr_1fr_140px_80px] text-xs">
                  <div className="p-2 flex items-center gap-2">
                    <button type="button" className="text-gray-500 hover:text-gray-700" aria-label="Edit">✎</button>
                    <button type="button" className="text-red-600 hover:text-red-700" aria-label="Delete">🗑</button>
                  </div>
                  <div className="p-2 flex items-center">OMVIC FEE</div>
                  <div className="p-2" />
                  <div className="p-2">$22.00</div>
                  <div className="p-2 text-center">...</div>
                </div>
              </div>
            </div>
          </div>

          <div className="border border-gray-200 bg-white">
            <div className="h-10 px-3 border-b border-gray-200 flex items-center justify-between">
              <div className="text-sm font-semibold text-gray-700">Payments</div>
              <div className="h-6 px-2 rounded bg-green-600 text-white text-xs font-semibold flex items-center">total: $0.00</div>
            </div>

            <div className="p-3">
              <div className="flex items-center gap-2">
                <button type="button" className="h-7 px-3 rounded bg-[#118df0] text-white text-xs font-semibold hover:bg-[#0d6ebd]">
                  + Deposit
                </button>
                <button type="button" className="h-7 px-3 rounded bg-[#118df0] text-white text-xs font-semibold hover:bg-[#0d6ebd]">
                  + Due Payment
                </button>
                <button type="button" className="h-7 px-3 rounded bg-[#118df0] text-white text-xs font-semibold hover:bg-[#0d6ebd]">
                  + Security Deposit
                </button>
              </div>

              <div className="mt-3 border border-gray-200">
                <div className="grid grid-cols-[140px_140px_1fr] text-[10px] font-semibold text-gray-600 bg-gray-50 border-b border-gray-200">
                  <div className="p-2">AMOUNT</div>
                  <div className="p-2">TYPE</div>
                  <div className="p-2">DESCRIPTION</div>
                </div>
                <div className="h-12 flex items-center justify-center text-xs text-gray-500">No Payments</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 flex items-center justify-end">
        <button type="button" className="h-10 px-6 rounded bg-[#118df0] text-white text-sm font-semibold hover:bg-[#0d6ebd]">
          Save
        </button>
      </div>
    </div>
  )
}
