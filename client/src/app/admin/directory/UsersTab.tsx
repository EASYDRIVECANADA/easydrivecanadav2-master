'use client'

import { useEffect, useState, useMemo, forwardRef, useImperativeHandle } from 'react'
import { supabase } from '@/lib/supabaseClient'

type UserRow = {
  id: string
  user_id: string | null
  email: string | null
  role: string | null
  name: string | null
  phone: string | null
  status: string | null
  title: string | null
  created_at: string | null
}

export type UsersTabHandle = { openAdd: () => void }

const UsersTab = forwardRef<UsersTabHandle>(function UsersTab(_, ref) {
  const [rows, setRows] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [pageSize, setPageSize] = useState(10)
  const [page, setPage] = useState(1)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editModalTab, setEditModalTab] = useState<'details' | 'permissions' | 'password'>('details')
  const [showPassword, setShowPassword] = useState(false)
  const [editForm, setEditForm] = useState({ 
    email: '', 
    role: '', 
    first_name: '', 
    last_name: '',
    title: '',
    phone: '',
    mobile: '',
    registration: '',
    facebook: '',
    twitter: '',
    password: '',
    profile: '',
    balance: '',
    assign_credits: '',
    assign_unlimited_until: '',
    status: '',
    subscription_end: '',
    account: '',
    access_all_deals: false,
    access_all_leads_customers: false,
    administrator: false,
    approver: false,
    vendors: false,
    delete_vendors: false,
    costs: false,
    customers: false,
    delete_customers: false,
    sales: false,
    delete_sales: false,
    inventory: false,
    delete_inventory: false,
    settings: false,
    sales_reports_access: false,
    inventory_reports_access: false
  })
  const [saving, setSaving] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)

  // Add employee modal
  const [showAddModal, setShowAddModal] = useState(false)
  const [addForm, setAddForm] = useState({ first_name: '', last_name: '', email: '', phone: '', role: 'Private', title: '', password: '' })
  const [addSaving, setAddSaving] = useState(false)
  const [addError, setAddError] = useState('')

  useImperativeHandle(ref, () => ({ openAdd: () => { setAddForm({ first_name: '', last_name: '', email: '', phone: '', role: 'Private', title: '', password: '' }); setAddError(''); setShowAddModal(true) } }))

  useEffect(() => {
    fetchUsers()
  }, [])

  const fetchUsers = async () => {
    setLoading(true)
    setError(null)
    try {
      const { data, error: dbError } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1000)

      if (dbError) throw dbError
      const mapped = Array.isArray(data) ? data.map((r: any) => ({
        ...r,
        name: [r.first_name, r.last_name].filter(Boolean).join(' ') || null,
        phone: r.phone || null,
        status: r.status || null,
        title: r.title || null,
      })) : []
      setRows(mapped)
    } catch (e: any) {
      setError(e?.message || 'Failed to load users')
      setRows([])
    } finally {
      setLoading(false)
    }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((r) => {
      const searchText = [r.email, r.role, r.name, r.user_id].filter(Boolean).join(' ').toLowerCase()
      return searchText.includes(q)
    })
  }, [rows, query])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const paged = filtered.slice((safePage - 1) * pageSize, safePage * pageSize)

  const handleEdit = async (row: UserRow) => {
    setEditingId(row.id)
    setEditModalTab('details')
    try {
      const { data } = await supabase.from('users').select('*').eq('id', row.id).single()
      if (data) {
        setCurrentPassword(data.password || '')
        setEditForm({
          email: data.email || '',
          role: data.role || '',
          first_name: data.first_name || '',
          last_name: data.last_name || '',
          title: data.title || '',
          phone: data.phone || '',
          mobile: data.mobile || '',
          registration: data.registration || '',
          facebook: data.facebook || '',
          twitter: data.twitter || '',
          password: '',
          profile: data.profile || '',
          balance: data.balance || '',
          assign_credits: data.assign_credits || '',
          assign_unlimited_until: data.assign_unlimited_until || '',
          status: data.status || '',
          subscription_end: data.subscription_end || '',
          account: data.account || '',
          access_all_deals: data.access_all_deals || false,
          access_all_leads_customers: data.access_all_leads_customers || false,
          administrator: data.administrator || false,
          approver: data.approver || false,
          vendors: data.vendors || false,
          delete_vendors: data.delete_vendors || false,
          costs: data.costs || false,
          customers: data.customers || false,
          delete_customers: data.delete_customers || false,
          sales: data.sales || false,
          delete_sales: data.delete_sales || false,
          inventory: data.inventory || false,
          delete_inventory: data.delete_inventory || false,
          settings: data.settings || false,
          sales_reports_access: data.sales_reports_access || false,
          inventory_reports_access: data.inventory_reports_access || false
        })
      }
    } catch (e) {
      console.error('Failed to load user data:', e)
    }
  }

  const handleSave = async () => {
    if (!editingId) return
    setSaving(true)
    try {
      const updateData: any = {
        email: editForm.email || null,
        role: editForm.role || null,
        first_name: editForm.first_name || null,
        last_name: editForm.last_name || null,
        title: editForm.title || null,
        phone: editForm.phone || null,
        mobile: editForm.mobile || null,
        registration: editForm.registration || null,
        facebook: editForm.facebook || null,
        twitter: editForm.twitter || null,
        profile: editForm.profile || null,
        balance: editForm.balance || null,
        assign_credits: editForm.assign_credits || null,
        assign_unlimited_until: editForm.assign_unlimited_until || null,
        status: editForm.status || null,
        subscription_end: editForm.subscription_end || null,
        account: editForm.account || null,
        access_all_deals: editForm.access_all_deals,
        access_all_leads_customers: editForm.access_all_leads_customers,
        administrator: editForm.administrator,
        approver: editForm.approver,
        vendors: editForm.vendors,
        delete_vendors: editForm.delete_vendors,
        costs: editForm.costs,
        customers: editForm.customers,
        delete_customers: editForm.delete_customers,
        sales: editForm.sales,
        delete_sales: editForm.delete_sales,
        inventory: editForm.inventory,
        delete_inventory: editForm.delete_inventory,
        settings: editForm.settings,
        sales_reports_access: editForm.sales_reports_access,
        inventory_reports_access: editForm.inventory_reports_access
      }

      if (editForm.password) {
        updateData.password = editForm.password
      }

      const { error: updateError } = await supabase
        .from('users')
        .update(updateData)
        .eq('id', editingId)

      if (updateError) throw updateError
      await fetchUsers()
      setEditingId(null)
    } catch (e: any) {
      alert(e?.message || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this user?')) return
    try {
      const { error: delError } = await supabase.from('users').delete().eq('id', id)
      if (delError) throw delError
      await fetchUsers()
    } catch (e: any) {
      alert(e?.message || 'Failed to delete')
    }
  }

  const handleAddSave = async () => {
    if (!addForm.email.trim()) { setAddError('Email is required'); return }
    setAddSaving(true)
    setAddError('')
    try {
      const { error: insertError } = await supabase.from('users').insert({
        email: addForm.email.trim().toLowerCase(),
        first_name: addForm.first_name.trim() || null,
        last_name: addForm.last_name.trim() || null,
        phone: addForm.phone.trim() || null,
        role: addForm.role || 'Private',
        title: addForm.title.trim() || null,
        password: addForm.password.trim() || null,
        status: 'Active',
        created_at: new Date().toISOString(),
      })
      if (insertError) throw insertError
      await fetchUsers()
      setShowAddModal(false)
    } catch (e: any) {
      setAddError(e?.message || 'Failed to create employee')
    } finally {
      setAddSaving(false)
    }
  }

  const getInitials = (name: string | null, email: string | null) => {
    if (name) {
      const parts = name.trim().split(' ')
      return (parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')
    }
    return (email?.[0] ?? '?').toUpperCase()
  }

  return (
    <div className="space-y-4">
      {/* Search bar */}
      <div className="flex items-center gap-3">
        <div className="relative">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search..."
            autoComplete="off"
            className="h-9 w-64 pl-9 pr-4 rounded-lg border border-slate-200 bg-white text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1EA7FF]/30 transition-all"
          />
          <svg className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </div>

      {error && <div className="text-sm text-red-600 bg-red-50 px-4 py-3 rounded-xl">{error}</div>}

      <div className="rounded-2xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>
              <th className="px-5 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide">Name</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide">Role</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide">Phone</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide">Joined</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide">Status</th>
              <th className="w-10 px-5 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td className="px-5 py-8 text-center text-slate-400" colSpan={6}>
                  <div className="inline-flex items-center gap-2">
                    <div className="animate-spin h-4 w-4 border-2 border-[#1EA7FF] border-t-transparent rounded-full" />
                    Loading...
                  </div>
                </td>
              </tr>
            ) : paged.length === 0 ? (
              <tr>
                <td className="px-5 py-8 text-center text-slate-400" colSpan={6}>No users found.</td>
              </tr>
            ) : (
              paged.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50/60 transition-colors">
                  {/* NAME col: avatar + name + email */}
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-full bg-[#0B1F3A] text-white text-sm font-bold flex-shrink-0 flex items-center justify-center uppercase"
                      >
                        {getInitials(r.name, r.email)}
                      </div>
                      <div>
                        <div className="font-medium text-slate-900">{r.name || '—'}</div>
                        <div className="text-xs text-slate-400">{r.email || '—'}</div>
                      </div>
                    </div>
                  </td>
                  {/* ROLE */}
                  <td className="px-5 py-3">
                    {r.role ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border border-slate-200 text-slate-700 bg-white capitalize">
                        {r.role.charAt(0).toUpperCase() + r.role.slice(1)}
                      </span>
                    ) : <span className="text-slate-300">—</span>}
                  </td>
                  {/* PHONE */}
                  <td className="px-5 py-3 text-slate-500">{r.phone || <span className="text-slate-300">—</span>}</td>
                  {/* JOINED */}
                  <td className="px-5 py-3 text-slate-500 tabular-nums">
                    {r.created_at
                      ? new Date(r.created_at).toISOString().slice(0, 10)
                      : <span className="text-slate-300">—</span>}
                  </td>
                  {/* STATUS */}
                  <td className="px-5 py-3">
                    {(() => {
                      const s = (r.status || 'active').toLowerCase()
                      const isActive = s === 'active'
                      return (
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                          isActive
                            ? 'bg-green-50 text-green-700 border-green-200'
                            : 'bg-red-50 text-red-600 border-red-200'
                        }`}>
                          {isActive ? 'Active' : 'Inactive'}
                        </span>
                      )
                    })()}
                  </td>
                  {/* ACTIONS */}
                  <td className="px-5 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => handleEdit(r)}
                        className="p-1.5 text-slate-400 hover:text-[#1EA7FF] hover:bg-blue-50 rounded-lg transition-colors"
                        title="Edit"
                      >
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4 12.5-12.5z" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(r.id)}
                        className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-xs text-slate-500">
        <div>
          {filtered.length > 0 ? `Showing ${(safePage - 1) * pageSize + 1} to ${Math.min(safePage * pageSize, filtered.length)} of ${filtered.length}` : ''}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={safePage <= 1}
            className="rounded-lg border border-slate-200/60 px-3 py-1 hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          <span className="px-2">Page {safePage} of {totalPages}</span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={safePage >= totalPages}
            className="rounded-lg border border-slate-200/60 px-3 py-1 hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      </div>

      {editingId && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setEditingId(null)} />
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg relative">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <svg className="h-5 w-5 text-slate-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <div className="text-lg font-semibold text-slate-800">Edit User</div>
              </div>
              <button
                type="button"
                onClick={() => setEditingId(null)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="flex border-b border-slate-200">
              <button
                type="button"
                className={`px-6 py-3 text-sm font-medium transition-colors ${
                  editModalTab === 'details'
                    ? 'text-[#0B1F3A] border-b-2 border-[#0B1F3A] bg-slate-50'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
                onClick={() => setEditModalTab('details')}
              >
                Details
              </button>
              <button
                type="button"
                className={`px-6 py-3 text-sm font-medium transition-colors ${
                  editModalTab === 'permissions'
                    ? 'text-[#0B1F3A] border-b-2 border-[#0B1F3A] bg-slate-50'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
                onClick={() => setEditModalTab('permissions')}
              >
                Permissions
              </button>
              <button
                type="button"
                className={`px-6 py-3 text-sm font-medium transition-colors ${
                  editModalTab === 'password'
                    ? 'text-[#0B1F3A] border-b-2 border-[#0B1F3A] bg-slate-50'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
                onClick={() => setEditModalTab('password')}
              >
                Password
              </button>
            </div>
            <div className="px-6 py-4 max-h-[60vh] overflow-y-auto">
              {editModalTab === 'details' && (
                <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">First Name</label>
                  <input
                    type="text"
                    value={editForm.first_name}
                    onChange={(e) => setEditForm({ ...editForm, first_name: e.target.value })}
                    className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1EA7FF]/30"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Last Name</label>
                  <input
                    type="text"
                    value={editForm.last_name}
                    onChange={(e) => setEditForm({ ...editForm, last_name: e.target.value })}
                    className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1EA7FF]/30"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                <input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1EA7FF]/30"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
                  <input
                    type="text"
                    value={editForm.phone}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1EA7FF]/30"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Mobile</label>
                  <input
                    type="text"
                    value={editForm.mobile}
                    onChange={(e) => setEditForm({ ...editForm, mobile: e.target.value })}
                    className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1EA7FF]/30"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Title</label>
                  <input
                    type="text"
                    value={editForm.title}
                    onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                    className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1EA7FF]/30"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Registration</label>
                  <input
                    type="text"
                    value={editForm.registration}
                    onChange={(e) => setEditForm({ ...editForm, registration: e.target.value })}
                    className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1EA7FF]/30"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Role</label>
                  <select
                    value={editForm.role}
                    onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                    className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1EA7FF]/30"
                  >
                    <option value="">Select Role</option>
                    <option value="admin">Admin</option>
                    <option value="private">Private</option>
                    <option value="small dealership">Small Dealership</option>
                    <option value="medium dealership">Medium Dealership</option>
                    <option value="large dealership">Large Dealership</option>
                    <option value="premier">Premier</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                  <input
                    type="text"
                    value={editForm.status}
                    onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                    className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1EA7FF]/30"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Profile</label>
                  <input
                    type="text"
                    value={editForm.profile}
                    onChange={(e) => setEditForm({ ...editForm, profile: e.target.value })}
                    className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1EA7FF]/30"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Account</label>
                  <input
                    type="text"
                    value={editForm.account}
                    onChange={(e) => setEditForm({ ...editForm, account: e.target.value })}
                    className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1EA7FF]/30"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Balance</label>
                  <input
                    type="text"
                    value={editForm.balance}
                    onChange={(e) => setEditForm({ ...editForm, balance: e.target.value })}
                    className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1EA7FF]/30"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Assign Credits</label>
                  <input
                    type="text"
                    value={editForm.assign_credits}
                    onChange={(e) => setEditForm({ ...editForm, assign_credits: e.target.value })}
                    className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1EA7FF]/30"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Subscription End</label>
                  <input
                    type="date"
                    value={editForm.subscription_end}
                    onChange={(e) => setEditForm({ ...editForm, subscription_end: e.target.value })}
                    className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1EA7FF]/30"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Assign Unlimited Until</label>
                  <input
                    type="date"
                    value={editForm.assign_unlimited_until}
                    onChange={(e) => setEditForm({ ...editForm, assign_unlimited_until: e.target.value })}
                    className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1EA7FF]/30"
                  />
                </div>
              </div>
                </div>
              )}

              {editModalTab === 'permissions' && (
                <div className="space-y-4">
                  <div className="mb-4 p-3 bg-blue-50 rounded-lg flex items-start gap-2">
                    <svg className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
                    </svg>
                    <p className="text-xs text-slate-700">
                      Any changes to a users permissions will not take effect until <strong>after</strong> user has logged out. For this reason it is recommended that you do not set permissions to any sensitive information until you are sure what the user will have access to.
                    </p>
                  </div>
                  
                  <div className="mb-3">
                    <h3 className="text-sm font-semibold text-slate-800 mb-3">System Access</h3>
                  </div>
                  
                  <div className="space-y-2">
                    {[
                      { key: 'access_all_deals', label: 'Access all Deals' },
                      { key: 'access_all_leads_customers', label: 'Access all Leads/Customers' },
                      { key: 'administrator', label: 'Administrator' },
                      { key: 'approver', label: 'Approver' },
                      { key: 'vendors', label: 'Vendors' },
                      { key: 'delete_vendors', label: 'Delete Vendors' },
                      { key: 'costs', label: 'Costs' },
                      { key: 'customers', label: 'Customers' },
                      { key: 'delete_customers', label: 'Delete Customers' },
                      { key: 'sales', label: 'Sales' },
                      { key: 'delete_sales', label: 'Delete Sales' },
                      { key: 'inventory', label: 'Inventory' },
                      { key: 'delete_inventory', label: 'Delete Inventory' },
                      { key: 'settings', label: 'Settings' },
                      { key: 'sales_reports_access', label: 'Sales Reports Access' },
                      { key: 'inventory_reports_access', label: 'Inventory Reports Access' },
                    ].map((p) => {
                      const v = Boolean((editForm as any)[p.key])
                      return (
                        <div key={p.key} className="flex items-center justify-between py-2">
                          <span className="text-sm text-slate-700">{p.label}</span>
                          <button
                            type="button"
                            className="h-5 w-16 rounded-full border border-slate-300 bg-white px-2 text-[9px] font-semibold text-slate-600 flex items-center justify-between"
                            onClick={() => setEditForm((prev) => ({ ...prev, [p.key]: !v }))}
                            aria-pressed={v}
                          >
                            {v ? (
                              <>
                                <span className="h-2.5 w-2.5 rounded-full bg-slate-800 transition-all duration-150" />
                                <span>YES</span>
                              </>
                            ) : (
                              <>
                                <span>NO</span>
                                <span className="h-2.5 w-2.5 rounded-full bg-slate-800 transition-all duration-150" />
                              </>
                            )}
                          </button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {editModalTab === 'password' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Current Password</label>
                    <div className="relative">
                      <input
                        type={showCurrentPassword ? 'text' : 'password'}
                        value={/^[a-f0-9]{32,}$/i.test(currentPassword) ? '' : currentPassword}
                        placeholder={/^[a-f0-9]{32,}$/i.test(currentPassword) ? 'Password is encrypted — set a new one below' : ''}
                        readOnly
                        autoComplete="off"
                        className="w-full h-10 px-3 pr-10 rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-500 focus:outline-none cursor-default"
                      />
                      {!/^[a-f0-9]{32,}$/i.test(currentPassword) && currentPassword && (
                        <button
                          type="button"
                          onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                        >
                          {showCurrentPassword ? (
                            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                            </svg>
                          ) : (
                            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">New Password</label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={editForm.password}
                        onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                        placeholder="Leave blank to keep current password"
                        autoComplete="new-password"
                        className="w-full h-10 px-3 pr-10 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1EA7FF]/30"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                      >
                        {showPassword ? (
                          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                          </svg>
                        ) : (
                          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        )}
                      </button>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">Leave blank if you don't want to change the password</p>
                  </div>
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setEditingId(null)}
                disabled={saving}
                className="h-10 px-6 rounded-lg bg-red-500 text-white text-sm font-semibold hover:bg-red-600 transition-colors disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="h-10 px-6 rounded-lg bg-[#0B1F3A] text-white text-sm font-semibold hover:bg-[#1EA7FF] transition-colors disabled:opacity-60"
              >
                {saving ? 'Saving...' : 'Next'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Employee Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-bold text-slate-900">Add Employee</h2>
              <button type="button" onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">First Name</label>
                  <input value={addForm.first_name} onChange={e => setAddForm(f => ({ ...f, first_name: e.target.value }))} autoComplete="given-name" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1EA7FF]" placeholder="Jane" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Last Name</label>
                  <input value={addForm.last_name} onChange={e => setAddForm(f => ({ ...f, last_name: e.target.value }))} autoComplete="family-name" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1EA7FF]" placeholder="Doe" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Email <span className="text-red-500">*</span></label>
                <input value={addForm.email} onChange={e => setAddForm(f => ({ ...f, email: e.target.value }))} type="email" autoComplete="off" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1EA7FF]" placeholder="jane@example.com" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Phone</label>
                  <input value={addForm.phone} onChange={e => setAddForm(f => ({ ...f, phone: e.target.value }))} autoComplete="off" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1EA7FF]" placeholder="6135550100" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Role</label>
                  <select value={addForm.role} onChange={e => setAddForm(f => ({ ...f, role: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1EA7FF]">
                    <option value="Private">Private</option>
                    <option value="Premier">Premier</option>
                    <option value="Staff">Staff</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Title</label>
                <input value={addForm.title} onChange={e => setAddForm(f => ({ ...f, title: e.target.value }))} autoComplete="organization-title" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1EA7FF]" placeholder="Sales Manager" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Password</label>
                <input value={addForm.password} onChange={e => setAddForm(f => ({ ...f, password: e.target.value }))} type="password" autoComplete="new-password" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1EA7FF]" placeholder="••••••••" />
              </div>
              {addError && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{addError}</p>}
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button type="button" onClick={() => setShowAddModal(false)} className="h-9 px-4 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">
                Cancel
              </button>
              <button type="button" onClick={handleAddSave} disabled={addSaving} className="h-9 px-5 rounded-lg bg-[#0B1F3A] text-white text-sm font-semibold hover:bg-[#1EA7FF] disabled:opacity-50 transition-colors">
                {addSaving ? 'Saving...' : 'Add Employee'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
})

export default UsersTab
