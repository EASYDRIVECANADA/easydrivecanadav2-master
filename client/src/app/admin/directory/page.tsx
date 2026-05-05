'use client'

import { useRef, useState } from 'react'
import UsersTab, { type UsersTabHandle } from './UsersTab'
import CustomersTab from './CustomersTab'
import VendorsTab from './VendorsTab'
import InventoryTab from './InventoryTab'

export default function DirectoryPage() {
  const [activeTab, setActiveTab] = useState<'users' | 'customers' | 'vendors' | 'inventory'>('users')
  const usersTabRef = useRef<UsersTabHandle>(null)

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="px-6 lg:px-8 pt-8 pb-4 border-b border-slate-100 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Directory</h1>
          <p className="text-sm text-slate-400 mt-0.5">Manage all team members and contacts</p>
        </div>
        {activeTab === 'users' && (
          <button
            type="button"
            onClick={() => usersTabRef.current?.openAdd()}
            className="h-10 px-5 rounded-full bg-[#0B1F3A] text-white text-sm font-semibold hover:bg-[#1EA7FF] transition-colors inline-flex items-center gap-1.5"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add employee
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="px-6 lg:px-8 pt-5 flex items-center gap-2">
        {(['users', 'customers', 'vendors', 'inventory'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-all capitalize ${
              activeTab === tab
                ? 'bg-[#0B1F3A] text-white border-[#0B1F3A]'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="px-6 lg:px-8 py-6">
        {activeTab === 'users' && <UsersTab ref={usersTabRef} />}
        {activeTab === 'customers' && <CustomersTab />}
        {activeTab === 'vendors' && <VendorsTab />}
        {activeTab === 'inventory' && <InventoryTab />}
      </div>
    </div>
  )
}

