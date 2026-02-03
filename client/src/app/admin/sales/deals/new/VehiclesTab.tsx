'use client'

export default function VehiclesTab() {
  return (
    <div className="w-full">
      <div className="w-full">
        <div className="relative">
          <input
            placeholder="search inventory"
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

        <div className="mt-2 text-xs text-gray-600">
          Didn't find what you're looking for?
          <button type="button" className="ml-1 text-[#118df0] hover:underline">
            Add new
          </button>
        </div>

        <div className="mt-4 border border-gray-200 bg-white">
          <div className="h-12 flex items-center justify-center text-gray-500">No Vehicle Selected</div>
        </div>

        <div className="mt-6 flex items-center gap-2">
          <div className="text-sm text-gray-700">Trades</div>
          <button
            type="button"
            className="h-8 w-8 rounded bg-[#118df0] text-white flex items-center justify-center hover:bg-[#0d6ebd]"
            aria-label="Add trade"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>

        <div className="mt-3 border border-gray-200 bg-white">
          <div className="h-12 flex items-center justify-center text-gray-500">No Trades</div>
        </div>

        <div className="mt-6 flex items-center justify-end">
          <button
            type="button"
            className="h-10 px-6 rounded bg-[#118df0] text-white text-sm font-semibold hover:bg-[#0d6ebd]"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
