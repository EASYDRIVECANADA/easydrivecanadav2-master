'use client'

import { useState } from 'react'
import UsersTab from './UsersTab'
import CustomersTab from './CustomersTab'
import VendorsTab from './VendorsTab'
import InventoryTab from './InventoryTab'

export default function DirectoryPage() {
  const [activeTab, setActiveTab] = useState<'users' | 'customers' | 'vendors' | 'inventory'>('users')

  return (
    <div className="min-h-screen bg-[#F5F7FB]">
      <div className="px-6 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-[#0B1F3A]">Directory Management</h1>
          <p className="text-sm text-slate-600 mt-1">Manage all system data from one place</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/60 overflow-hidden" style={{ boxShadow: '0 1px 3px rgba(0,0,0,.04)' }}>
          <div className="flex items-center gap-2 px-6 py-4 border-b border-slate-100">
            <button
              type="button"
              className={
                activeTab === 'users'
                  ? 'h-10 px-6 rounded-xl bg-[#0B1F3A] text-white text-sm font-semibold transition-all'
                  : 'h-10 px-6 rounded-xl bg-slate-50 text-slate-600 text-sm font-semibold hover:bg-slate-100 transition-all'
              }
              onClick={() => setActiveTab('users')}
            >
              Users
            </button>
            <button
              type="button"
              className={
                activeTab === 'customers'
                  ? 'h-10 px-6 rounded-xl bg-[#0B1F3A] text-white text-sm font-semibold transition-all'
                  : 'h-10 px-6 rounded-xl bg-slate-50 text-slate-600 text-sm font-semibold hover:bg-slate-100 transition-all'
              }
              onClick={() => setActiveTab('customers')}
            >
              Customers
            </button>
            <button
              type="button"
              className={
                activeTab === 'vendors'
                  ? 'h-10 px-6 rounded-xl bg-[#0B1F3A] text-white text-sm font-semibold transition-all'
                  : 'h-10 px-6 rounded-xl bg-slate-50 text-slate-600 text-sm font-semibold hover:bg-slate-100 transition-all'
              }
              onClick={() => setActiveTab('vendors')}
            >
              Vendors
            </button>
            <button
              type="button"
              className={
                activeTab === 'inventory'
                  ? 'h-10 px-6 rounded-xl bg-[#0B1F3A] text-white text-sm font-semibold transition-all'
                  : 'h-10 px-6 rounded-xl bg-slate-50 text-slate-600 text-sm font-semibold hover:bg-slate-100 transition-all'
              }
              onClick={() => setActiveTab('inventory')}
            >
              Inventory
            </button>
          </div>

          <div className="p-6">
            {activeTab === 'users' && <UsersTab />}
            {activeTab === 'customers' && <CustomersTab />}
            {activeTab === 'vendors' && <VendorsTab />}
            {activeTab === 'inventory' && <InventoryTab />}
          </div>
        </div>
      </div>
    </div>
  )
}

