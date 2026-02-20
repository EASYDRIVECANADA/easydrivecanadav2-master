'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'

interface User {
  id: string
  email: string
  accessCode: string
  role: string
  isActive: boolean
  createdAt: string
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [formData, setFormData] = useState({
    email: '',
    accessCode: '',
    role: 'STAFF',
    isActive: true,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  useEffect(() => {
    const sessionStr = localStorage.getItem('edc_admin_session')
    if (!sessionStr) {
      router.push('/admin')
      return
    }

    try {
      const parsed = JSON.parse(sessionStr) as { email?: string; role?: string }
      if (parsed?.role !== 'ADMIN' && parsed?.role !== 'STAFF') {
        router.push('/admin')
        return
      }
    } catch {
      router.push('/admin')
      return
    }

    fetchUsers()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const fetchUsers = async () => {
    try {
      const { data, error: dbError } = await supabase
        .from('edc_admin_users')
        .select('id, email, access_code, role, is_active, created_at')
        .order('created_at', { ascending: false })

      if (dbError) throw dbError

      setUsers(
        (data || []).map((u) => ({
          id: u.id,
          email: u.email,
          accessCode: u.access_code || '',
          role: u.role,
          isActive: !!u.is_active,
          createdAt: u.created_at,
        }))
      )
    } catch (_error) {
      console.error('Error fetching users:', _error)
    } finally {
      setLoading(false)
    }
  }

  const handleAddUser = () => {
    setEditingUser(null)
    setFormData({ email: '', accessCode: '', role: 'STAFF', isActive: true })
    setError('')
    setShowModal(true)
  }

  const handleEditUser = (user: User) => {
    setEditingUser(user)
    setFormData({ email: user.email, accessCode: user.accessCode, role: user.role, isActive: user.isActive })
    setError('')
    setShowModal(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')

    try {
      const normalizedEmail = formData.email.trim().toLowerCase()
      const accessCode = formData.accessCode

      if (!normalizedEmail || !accessCode) {
        setError('Email and access code required')
        return
      }

      if (editingUser) {
        const { error: dbError } = await supabase
          .from('edc_admin_users')
          .update({
            email: normalizedEmail,
            access_code: accessCode,
            role: formData.role,
            is_active: formData.isActive,
          })
          .eq('id', editingUser.id)

        if (dbError) throw dbError
      } else {
        const { error: dbError } = await supabase.from('edc_admin_users').insert({
          email: normalizedEmail,
          access_code: accessCode,
          role: formData.role,
          is_active: formData.isActive,
        })

        if (dbError) throw dbError
      }

      setShowModal(false)
      fetchUsers()
    } catch {
      setError('Failed to connect to server')
    } finally {
      setSaving(false)
    }
  }

  const handleToggleActive = async (user: User) => {
    try {
      const { error: dbError } = await supabase
        .from('edc_admin_users')
        .update({ is_active: !user.isActive })
        .eq('id', user.id)

      if (dbError) throw dbError
      fetchUsers()
    } catch (_error) {
      console.error('Error toggling user status:', _error)
    }
  }

  const handleDelete = async (user: User) => {
    if (!confirm(`Delete user ${user.email}? This cannot be undone.`)) return

    try {
      const { error: dbError } = await supabase.from('edc_admin_users').delete().eq('id', user.id)
      if (dbError) throw dbError
      fetchUsers()
    } catch (_error) {
      console.error('Error deleting user:', _error)
    }
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-CA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  const pendingUsers = users.filter(u => !u.isActive && u.role === 'STAFF')
  const activeUsers = users.filter(u => u.isActive || u.role === 'ADMIN')

  return (
    <div className="min-h-screen">
      <div className="edc-page-header">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-slate-900">User Management</h1>
          <button
            onClick={handleAddUser}
            className="edc-btn-primary text-sm"
          >
            + Add User
          </button>
        </div>
      </div>

      <div className="px-6 py-6">
        {loading ? (
          <div className="edc-card p-8 text-center">
            <div className="animate-spin w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full mx-auto"></div>
            <p className="mt-4 text-slate-500">Loading users...</p>
          </div>
        ) : (
          <>
            {/* Pending Approvals */}
            {pendingUsers.length > 0 && (
              <div className="edc-card border-yellow-200 bg-yellow-50/50 p-6 mb-6">
                <h2 className="text-lg font-semibold text-yellow-900 mb-4 flex items-center">
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  Pending Approvals ({pendingUsers.length})
                </h2>
                <div className="space-y-3">
                  {pendingUsers.map((user) => (
                    <div key={user.id} className="bg-white rounded-lg p-4 flex items-center justify-between border border-slate-100">
                      <div>
                        <p className="font-medium text-slate-800">{user.email}</p>
                        <p className="text-sm text-slate-500">Role: {user.role}</p>
                        <p className="text-xs text-slate-400 mt-1">Requested: {formatDate(user.createdAt)}</p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleToggleActive(user)}
                          className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleDelete(user)}
                          className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700 transition-colors"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Active Users Table */}
            <div className="edc-card overflow-hidden overflow-x-auto">
            <table className="edc-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {activeUsers.map((user) => (
                  <tr key={user.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm text-slate-600">{user.email}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        user.role === 'ADMIN' ? 'bg-orange-100 text-orange-800' : 'bg-blue-100 text-blue-800'
                      }`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        user.isActive ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {user.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                      {formatDate(user.createdAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => handleEditUser(user)}
                        className="text-cyan-600 hover:underline mr-4"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleToggleActive(user)}
                        className="text-orange-600 hover:underline mr-4"
                      >
                        {user.isActive ? 'Deactivate' : 'Activate'}
                      </button>
                      <button
                        onClick={() => handleDelete(user)}
                        className="text-red-600 hover:underline"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {activeUsers.length === 0 && pendingUsers.length === 0 && (
              <div className="text-center py-12">
                <p className="text-slate-500">No users found. Add your first user to get started.</p>
              </div>
            )}
          </div>
          </>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="edc-overlay absolute inset-0" onMouseDown={() => setShowModal(false)} />
          <div className="edc-modal max-w-md w-full p-6 relative">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-slate-900">{editingUser ? 'Edit User' : 'Add New User'}</h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {error && (
              <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Email *</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="edc-input"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Access Code *</label>
                <input
                  type="password"
                  required
                  value={formData.accessCode}
                  onChange={(e) => setFormData({ ...formData, accessCode: e.target.value })}
                  className="edc-input"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Role *</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="edc-input"
                >
                  <option value="STAFF">Staff</option>
                  <option value="ADMIN">Admin</option>
                </select>
                <p className="mt-1 text-xs text-slate-500">
                  Staff can manage inventory. Admins can manage users and all settings.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <input
                  id="isActive"
                  type="checkbox"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="h-4 w-4"
                />
                <label htmlFor="isActive" className="text-sm text-slate-600">Active</label>
              </div>

              <div className="flex gap-4 pt-4">
                <button
                  type="submit"
                  disabled={saving}
                  className="edc-btn-primary flex-1 disabled:opacity-50"
                >
                  {saving ? 'Saving...' : editingUser ? 'Update User' : 'Add User'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="edc-btn-ghost"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
