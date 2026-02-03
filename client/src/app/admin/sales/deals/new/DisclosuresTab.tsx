'use client'

export default function DisclosuresTab() {
  return (
    <div className="w-full">
      <div className="text-xs text-gray-700 mb-2">Disclosures</div>

      <div className="border border-gray-200 bg-white shadow-sm">
        <div className="bg-gray-50 px-3 py-2 flex items-center gap-2 text-xs text-gray-600 border-b border-gray-200">
          <button type="button" className="px-2 py-1 border border-gray-200 bg-white">
            B
          </button>
          <button type="button" className="px-2 py-1 border border-gray-200 bg-white italic">
            I
          </button>
          <button type="button" className="px-2 py-1 border border-gray-200 bg-white underline">
            U
          </button>
          <button type="button" className="px-2 py-1 border border-gray-200 bg-white">
            Tx
          </button>
          <button type="button" className="px-2 py-1 border border-gray-200 bg-white">
            S
          </button>
          <button type="button" className="px-2 py-1 border border-gray-200 bg-white">
            x
          </button>
          <select className="h-7 text-xs border border-gray-200 bg-white px-2" defaultValue="16">
            <option value="12">12</option>
            <option value="14">14</option>
            <option value="16">16</option>
          </select>
          <button type="button" className="px-2 py-1 border border-gray-200 bg-white">
            A
          </button>
          <button type="button" className="px-2 py-1 border border-gray-200 bg-white">
            ≡
          </button>
          <button type="button" className="px-2 py-1 border border-gray-200 bg-white">
            Tˇ
          </button>
          <div className="flex-1" />
          <button type="button" className="px-2 py-1 border border-gray-200 bg-white">
            ▾
          </button>
        </div>

        <div className="min-h-[240px]" />
      </div>

      <div className="mt-6">
        <div className="text-xs text-gray-700 mb-2">Conditions</div>
        <textarea className="w-full min-h-[120px] border border-gray-200 bg-white shadow-sm rounded px-3 py-2 text-sm" />
      </div>

      <div className="mt-6 flex items-center justify-end">
        <button type="button" className="h-10 px-6 rounded bg-[#118df0] text-white text-sm font-semibold hover:bg-[#0d6ebd]">
          Save
        </button>
      </div>
    </div>
  )
}
