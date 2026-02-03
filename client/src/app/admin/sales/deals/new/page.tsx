'use client'

import { useState } from 'react'

import CustomersTabNew from './CustomersTabNew'
import DeliveryTab from './DeliveryTab'
import DisclosuresTab from './DisclosuresTab'
import VehiclesTab from './VehiclesTab'
import WorksheetTab from './WorksheetTab'

type DealTab = 'customers' | 'vehicles' | 'worksheet' | 'disclosures' | 'delivery'

export default function SalesNewDealPage() {
  const [activeTab, setActiveTab] = useState<DealTab>('customers')
  const [isRetail, setIsRetail] = useState(true)
  const [dealDate, setDealDate] = useState('2026-02-03')
  const [dealType, setDealType] = useState<'Cash' | 'Finance' | 'Lease'>('Cash')

  return (
    <div className="w-full min-h-[calc(100vh-64px)] bg-gradient-to-b from-[#f6f7f9] to-[#e9eaee]">
      <div className="w-full px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-sm font-semibold text-gray-900">Retail/Wholesale</div>
            <div className="mt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsRetail((v) => !v)}
                aria-label="Toggle Retail/Wholesale"
                className="h-6 w-[58px] px-2 rounded-full border border-[#118df0] bg-white flex items-center justify-between"
              >
                {isRetail ? (
                  <>
                    <div className="text-[10px] font-semibold text-[#118df0] leading-none">RTL</div>
                    <div className="h-3 w-3 rounded-full bg-[#118df0]" />
                  </>
                ) : (
                  <>
                    <div className="h-3 w-3 rounded-full bg-[#118df0]" />
                    <div className="text-[10px] font-semibold text-[#118df0] leading-none">WHL</div>
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div>
              <div className="text-xs font-semibold text-gray-600 mb-1">Deal Date</div>
              <input
                type="date"
                value={dealDate}
                onChange={(e) => setDealDate(e.target.value)}
                className="w-full border border-gray-200 rounded px-3 py-2 text-sm bg-white"
              />
            </div>
            <div>
              <div className="text-xs font-semibold text-gray-600 mb-1">Deal Type</div>
              <select
                value={dealType}
                onChange={(e) => setDealType(e.target.value as 'Cash' | 'Finance' | 'Lease')}
                className="w-full border border-gray-200 rounded px-3 py-2 text-sm bg-white"
              >
                <option value="Cash">Cash</option>
                <option value="Finance">Finance</option>
                <option value="Lease">Lease</option>
              </select>
            </div>
            <div className="flex items-end justify-end gap-2">
              <div className="text-xs font-semibold text-gray-600 mr-2">Reports</div>
              <button type="button" className="h-9 px-3 rounded bg-[#118df0] text-white text-sm font-semibold hover:bg-[#0d6ebd]">Email</button>
              <button type="button" className="h-9 px-3 rounded bg-[#118df0] text-white text-sm font-semibold hover:bg-[#0d6ebd]">Print</button>
            </div>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3">
          {(
            [
              { key: 'customers', label: 'Customers' },
              { key: 'vehicles', label: 'Vehicles' },
              { key: 'worksheet', label: 'Worksheet' },
              { key: 'disclosures', label: 'Disclosures' },
              { key: 'delivery', label: 'Delivery' },
            ] as const
          ).map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setActiveTab(t.key)}
              className={
                activeTab === t.key
                  ? 'h-10 px-4 rounded bg-[#118df0] text-white text-sm font-semibold'
                  : 'h-10 px-4 rounded bg-white/70 text-gray-700 text-sm font-semibold hover:bg-white'
              }
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="mt-4">
          {activeTab === 'customers' && (
            <CustomersTabNew
              hideAddButton={!isRetail}
              dealDate={dealDate}
              dealType={dealType}
              dealMode={isRetail ? 'RTL' : 'WHL'}
            />
          )}
          {activeTab === 'vehicles' && <VehiclesTab />}
          {activeTab === 'worksheet' && <WorksheetTab />}
          {activeTab === 'disclosures' && <DisclosuresTab />}
          {activeTab === 'delivery' && <DeliveryTab />}
        </div>
      </div>
    </div>
  )
}
