'use client'

import { useMemo, useState } from 'react'

export default function SettingsBillingPage() {
  return (
    <BillingPage />
  )
}

type BillingSection = 'Products & Services' | 'Transactions' | 'Payment Methods'

function BillingPage() {
  const [section, setSection] = useState<BillingSection>('Products & Services')

  const products = useMemo(
    () => [{ planName: 'Small Dealer Package', amount: '$99.00', created: 'Jul 21, 2023' }],
    []
  )

  return (
    <div>
      <div className="text-[11px] text-gray-700">Account &amp; Billing</div>
      <div className="mt-2 border-t border-gray-200" />

      <div className="mt-3 grid grid-cols-[240px_1fr] gap-10">
        <div>
          <div className="border border-gray-200 bg-white">
            {(['Products & Services', 'Transactions', 'Payment Methods'] as BillingSection[]).map((s) => {
              const isActive = s === section
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSection(s)}
                  className={
                    isActive
                      ? 'w-full h-8 px-3 flex items-center text-xs bg-[#118df0] text-white'
                      : 'w-full h-8 px-3 flex items-center text-xs text-[#118df0] hover:bg-gray-50'
                  }
                >
                  {s}
                </button>
              )
            })}
          </div>
        </div>

        <div>
          <div className="text-[11px] font-semibold text-gray-700">{section}</div>

          {section === 'Products & Services' ? (
            <div className="mt-3 border border-gray-200 bg-white">
              <div className="grid grid-cols-[1.8fr_1fr_1fr] border-b border-gray-200">
                <div className="h-8 flex items-center justify-center text-[11px] font-semibold text-gray-700">
                  PLAN NAME
                </div>
                <div className="h-8 flex items-center justify-center text-[11px] font-semibold text-gray-700">
                  AMOUNT
                </div>
                <div className="h-8 flex items-center justify-center text-[11px] font-semibold text-gray-700">
                  CREATED
                </div>
              </div>
              {products.map((p) => (
                <div key={p.planName} className="grid grid-cols-[1.8fr_1fr_1fr] border-b border-gray-100">
                  <div className="h-10 flex items-center justify-center text-xs text-gray-800">{p.planName}</div>
                  <div className="h-10 flex items-center justify-center text-xs text-gray-800">{p.amount}</div>
                  <div className="h-10 flex items-center justify-center text-xs text-gray-800">{p.created}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-3 text-xs text-gray-500">No data.</div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between pt-8">
        <button type="button" className="h-8 px-3 bg-gray-600 text-white text-xs font-semibold">
          <span className="inline-flex items-center gap-2">
            <span className="text-sm leading-none">×</span>
            Cancel
          </span>
        </button>
        <button type="button" className="h-8 px-4 bg-[#118df0] text-white text-xs font-semibold">
          <span className="inline-flex items-center gap-2">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" />
              <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M17 21v-8H7v8" />
              <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M7 3v5h8" />
            </svg>
            Save
          </span>
        </button>
      </div>
    </div>
  )
}
