'use client'

export default function DeliveryTab() {
  return (
    <div className="w-full">
      <div className="w-full space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <div className="text-xs text-gray-700 mb-2">Delivery Date</div>
              <div className="flex items-stretch border border-gray-200 rounded bg-white shadow-sm overflow-hidden">
                <div className="w-10 flex items-center justify-center bg-gray-100 text-gray-600 border-r border-gray-200">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3M5 11h14M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <input type="date" className="flex-1 h-10 px-3 text-sm bg-white outline-none" />
              </div>
            </div>

            <div>
              <div className="text-xs text-gray-700 mb-2">Delivery Time</div>
              <div className="flex items-stretch border border-gray-200 rounded bg-white shadow-sm overflow-hidden">
                <div className="w-10 flex items-center justify-center bg-gray-100 text-gray-600 border-r border-gray-200">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="9" strokeWidth={2} />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 7v5l3 2" />
                  </svg>
                </div>
                <input type="time" className="flex-1 h-10 px-3 text-sm bg-white outline-none" />
                <div className="w-10 flex items-center justify-center bg-gray-100 text-gray-600 border-l border-gray-200">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="9" strokeWidth={2} />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11v5" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8h.01" />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          <label className="flex items-center gap-2 text-xs text-gray-700">
            Was the deal exported outside of Ontario?
            <input type="checkbox" className="h-4 w-4" />
          </label>

          <div>
            <div className="text-xs text-gray-700 mb-2">Delivery Details</div>
            <textarea
              placeholder="Enter delivery details (if any)"
              className="w-full min-h-[110px] border border-gray-200 bg-white shadow-sm rounded px-3 py-2 text-sm"
            />
          </div>

          <div>
            <div className="text-xs text-gray-700 mb-2">Other</div>
            <textarea
              placeholder="ex: paid in full"
              className="w-full min-h-[110px] border border-gray-200 bg-white shadow-sm rounded px-3 py-2 text-sm"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <div className="text-xs text-gray-700 mb-2">Approved By</div>
              <select className="w-full h-10 border border-gray-200 rounded bg-white shadow-sm px-3 text-sm" defaultValue="Syed Islam">
                <option value="Syed Islam">Syed Islam</option>
                <option value="Nawshad Syed">Nawshad Syed</option>
              </select>
            </div>
            <div>
              <div className="text-xs text-gray-700 mb-2">Salesperson</div>
              <select className="w-full h-10 border border-gray-200 rounded bg-white shadow-sm px-3 text-sm" defaultValue="Syed Islam">
                <option value="Syed Islam">Syed Islam</option>
                <option value="Nawshad Syed">Nawshad Syed</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="border border-gray-200 bg-white shadow-sm">
              <div className="h-9 px-3 bg-gray-700 text-white text-xs flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3M5 11h14" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                New Task
              </div>
              <div className="p-3 space-y-3">
                <div>
                  <div className="text-xs text-gray-700 mb-1">Name:</div>
                  <input className="w-full h-9 border border-gray-200 rounded bg-white px-3 text-sm" placeholder="title" />
                </div>
                <div>
                  <div className="text-xs text-gray-700 mb-1">Description:</div>
                  <textarea className="w-full min-h-[80px] border border-gray-200 rounded bg-white px-3 py-2 text-sm" />
                </div>
                <div>
                  <div className="text-xs text-gray-700 mb-1">Due By:</div>
                  <input type="date" className="w-full h-9 border border-gray-200 rounded bg-white px-3 text-sm" placeholder="mm/dd/yyyy" />
                </div>
                <div className="flex items-center justify-between">
                  <button type="button" className="h-8 px-4 rounded bg-red-600 text-white text-xs font-semibold hover:bg-red-700">
                    Clear
                  </button>
                  <button type="button" className="h-8 px-4 rounded bg-[#118df0] text-white text-xs font-semibold hover:bg-[#0d6ebd]">
                    Add
                  </button>
                </div>
              </div>
            </div>

            <div className="border border-gray-200 bg-white shadow-sm">
              <div className="h-9 px-3 bg-gray-700 text-white text-xs flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Tasks
                </div>
                <button type="button" className="text-white/80 hover:text-white" aria-label="Settings">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 12a1 1 0 102 0 1 1 0 00-2 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06A2 2 0 013.4 19.7l.06-.06A1.65 1.65 0 003.8 17.8 1.65 1.65 0 002.3 16.8H2a2 2 0 010-4h.09a1.65 1.65 0 001.51-1 1.65 1.65 0 00-.33-1.82l-.06-.06A2 2 0 016.04 3.1l.06.06a1.65 1.65 0 001.82.33H8a1.65 1.65 0 001-1.51V2a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06A2 2 0 0120.9 6.04l-.06.06a1.65 1.65 0 00-.33 1.82V8c0 .66.26 1.3.73 1.77.47.47 1.11.73 1.77.73H23a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
                  </svg>
                </button>
              </div>
              <div className="p-4">
                <div className="h-16 border border-gray-200 flex items-center justify-center text-gray-500">Nothing Todo!</div>
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
