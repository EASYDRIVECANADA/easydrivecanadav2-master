'use client'

import { useState } from 'react'

export default function DealershipDetailsSettingsPage() {
  const [dealership] = useState('EASYDRIVE CANADA')

  return (
    <div className="space-y-6">
      <div>
        <div className="text-[11px] font-semibold text-gray-600">Company Logo</div>
        <div className="mt-3">
          <div className="h-12 w-28 flex items-center justify-start">
            <img src="/images/logo.png" alt="EDC" className="h-10 w-auto" />
          </div>
        </div>
      </div>

      <div>
        <div className="text-[11px] font-semibold text-gray-600">Company Details</div>
        <div className="mt-2 border-t border-gray-200" />
        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-[11px] text-gray-600 mb-1">Company Name</label>
            <input className="h-8 w-full border border-gray-300 px-2 text-xs" defaultValue={dealership} />
          </div>
          <div>
            <label className="block text-[11px] text-gray-600 mb-1">MVDA #</label>
            <input className="h-8 w-full border border-gray-300 px-2 text-xs" defaultValue="mvda #" />
          </div>
          <div>
            <label className="block text-[11px] text-gray-600 mb-1">Timezone</label>
            <select className="h-8 w-full border border-gray-300 px-2 text-xs bg-white" defaultValue="America/Toronto">
              <option value="America/Toronto">(UTC-05:00) Eastern Time (US & Canada)</option>
            </select>
          </div>
          <div>
            <label className="block text-[11px] text-gray-600 mb-1">Website</label>
            <div className="relative">
              <div className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500">
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M10 13a5 5 0 007.07 0l1.41-1.41a5 5 0 00-7.07-7.07L10 4" />
                  <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M14 11a5 5 0 01-7.07 0L5.52 9.59a5 5 0 017.07-7.07L14 4" />
                </svg>
              </div>
              <input className="h-8 w-full border border-gray-300 pl-7 pr-2 text-xs" defaultValue="www.easydrivecanada.com" />
            </div>
          </div>
        </div>
      </div>

      <div className="border border-gray-200">
        <div className="px-4 py-3">
          <div className="text-[11px] font-semibold text-gray-700">Primary Address</div>
          <div className="mt-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="lg:col-span-2">
              <label className="block text-[11px] text-gray-600 mb-1">Street Address</label>
              <div className="relative">
                <div className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500">
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M12 21s8-4.5 8-11a8 8 0 10-16 0c0 6.5 8 11 8 11z" />
                    <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M12 11a2 2 0 100-4 2 2 0 000 4z" />
                  </svg>
                </div>
                <input className="h-8 w-full border border-gray-300 pl-7 pr-2 text-xs" defaultValue="4956 Bank St" />
              </div>
            </div>
            <div className="lg:col-span-2">
              <label className="block text-[11px] text-gray-600 mb-1">Suite/Apt</label>
              <div className="relative">
                <div className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500">
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M3 10l9-7 9 7v10a2 2 0 01-2 2H5a2 2 0 01-2-2V10z" />
                    <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M9 22V12h6v10" />
                  </svg>
                </div>
                <input className="h-8 w-full border border-gray-300 pl-7 pr-2 text-xs" defaultValue="Unit A" />
              </div>
            </div>

            <div>
              <label className="block text-[11px] text-gray-600 mb-1">City</label>
              <div className="relative">
                <div className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500">
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M3 21h18" />
                    <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M5 21V7l7-4 7 4v14" />
                    <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M9 9h1m4 0h1M9 13h1m4 0h1M9 17h1m4 0h1" />
                  </svg>
                </div>
                <input className="h-8 w-full border border-gray-300 pl-7 pr-2 text-xs" defaultValue="Ottawa" />
              </div>
            </div>
            <div>
              <label className="block text-[11px] text-gray-600 mb-1">Province</label>
              <select className="h-8 w-full border border-gray-300 px-2 text-xs bg-white" defaultValue="ON">
                <option value="ON">ON</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] text-gray-600 mb-1">Postal Code</label>
              <div className="relative">
                <div className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500">
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M3 7h18" />
                    <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M5 7v14h14V7" />
                    <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M7 11h10" />
                  </svg>
                </div>
                <input className="h-8 w-full border border-gray-300 pl-7 pr-2 text-xs" defaultValue="K1X 1G6" />
              </div>
            </div>
            <div>
              <label className="block text-[11px] text-gray-600 mb-1">Country</label>
              <select className="h-8 w-full border border-gray-300 px-2 text-xs bg-white" defaultValue="CA">
                <option value="CA">CA</option>
              </select>
            </div>

            <div className="lg:col-span-2">
              <label className="block text-[11px] text-gray-600 mb-1">Phone</label>
              <input className="h-8 w-full border border-gray-300 px-2 text-xs" defaultValue="(613) 879-8355 ext.___" />
            </div>
            <div className="lg:col-span-2">
              <label className="block text-[11px] text-gray-600 mb-1">Fax</label>
              <input className="h-8 w-full border border-gray-300 px-2 text-xs" defaultValue="(___) ___-____" />
            </div>
            <div className="lg:col-span-2">
              <label className="block text-[11px] text-gray-600 mb-1">Email</label>
              <input className="h-8 w-full border border-gray-300 px-2 text-xs" defaultValue="info@easydrivecanada.com" />
            </div>
            <div className="lg:col-span-2">
              <label className="block text-[11px] text-gray-600 mb-1">Mobile</label>
              <input className="h-8 w-full border border-gray-300 px-2 text-xs" defaultValue="(647) 552-9459" />
            </div>
          </div>
        </div>
      </div>

      <div>
        <div className="text-[11px] font-semibold text-gray-600">Tax/Registration Numbers</div>
        <div className="mt-2 border-t border-gray-200" />
        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-[11px] text-gray-600 mb-1">Tax #</label>
            <input className="h-8 w-full border border-gray-300 px-2 text-xs" defaultValue="72858593RT0001" />
          </div>
          <div>
            <label className="block text-[11px] text-gray-600 mb-1">RIN</label>
            <input className="h-8 w-full border border-gray-300 px-2 text-xs" defaultValue="204146637" />
          </div>
        </div>
      </div>

      <div>
        <div className="text-[11px] font-semibold text-gray-600">License Fees</div>
        <div className="mt-2 border-t border-gray-200" />
        <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-[11px] text-gray-600 mb-1">License Transfer Fee</label>
            <div className="relative">
              <div className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-600 text-xs">$</div>
              <input className="h-8 w-full border border-gray-300 pl-6 pr-2 text-xs" defaultValue="91" />
            </div>
          </div>
          <div>
            <label className="block text-[11px] text-gray-600 mb-1">New Plate Fee</label>
            <div className="relative">
              <div className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-600 text-xs">$</div>
              <input className="h-8 w-full border border-gray-300 pl-6 pr-2 text-xs" defaultValue="91" />
            </div>
          </div>
          <div>
            <label className="block text-[11px] text-gray-600 mb-1">Renewal Fee</label>
            <div className="relative">
              <div className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-600 text-xs">$</div>
              <input className="h-8 w-full border border-gray-300 pl-6 pr-2 text-xs" defaultValue="59" />
            </div>
          </div>
        </div>
      </div>

      <div>
        <div className="text-[11px] font-semibold text-gray-600">Settings</div>
        <div className="mt-2 border-t border-gray-200" />
        <div className="mt-3">
          <div className="flex items-center gap-3">
            <div className="text-[11px] text-gray-600">Use sequential stock numbers?</div>
            <button type="button" className="h-4 w-8 rounded-full bg-[#118df0] relative">
              <div className="absolute right-0.5 top-0.5 h-3 w-3 rounded-full bg-white" />
            </button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-[11px] text-gray-600 mb-1">Next Sales Invoice #</label>
            <input className="h-8 w-full border border-gray-300 px-2 text-xs" defaultValue="271" />
          </div>
          <div>
            <label className="block text-[11px] text-gray-600 mb-1">Next Purchase Invoice #</label>
            <input className="h-8 w-full border border-gray-300 px-2 text-xs" defaultValue="122" />
          </div>
          <div>
            <label className="block text-[11px] text-gray-600 mb-1">Next Work Order #</label>
            <input className="h-8 w-full border border-gray-300 px-2 text-xs" defaultValue="0" />
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-[11px] text-gray-600 mb-1">Service Rate</label>
            <div className="relative">
              <div className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-600 text-xs">$</div>
              <input className="h-8 w-full border border-gray-300 pl-6 pr-2 text-xs" defaultValue="0" />
            </div>
          </div>
          <div>
            <label className="block text-[11px] text-gray-600 mb-1">Finance Interest Rate</label>
            <div className="relative">
              <div className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-600 text-xs">%</div>
              <input className="h-8 w-full border border-gray-300 pl-6 pr-2 text-xs" defaultValue="0" />
            </div>
          </div>
          <div>
            <label className="block text-[11px] text-gray-600 mb-1">Auto Close Deals In</label>
            <select className="h-8 w-full border border-gray-300 px-2 text-xs bg-white" defaultValue="Never">
              <option value="Never">Never</option>
            </select>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between pt-6">
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
