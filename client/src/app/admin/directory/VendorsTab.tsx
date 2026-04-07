'use client'

import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabaseClient'

type VendorRow = {
  id: string
  vendor_name: string | null
  company_name: string | null
  phone: string | null
  mobile: string | null
  email: string | null
  city: string | null
  province: string | null
  created_at: string | null
  user_id: string | null
}

type UserOption = {
  user_id: string
  name: string
}

type VendorForm = {
  companyName: string
  firstName: string
  lastName: string
  salespersonRegistration: string
  companyMvda: string
  taxNumber: string
  rin: string
  streetAddress: string
  suiteApt: string
  city: string
  province: string
  postalCode: string
  country: string
  phone: string
  fax: string
  mobile: string
  email: string
}

const defaultForm: VendorForm = {
  companyName: '',
  firstName: '',
  lastName: '',
  salespersonRegistration: '',
  companyMvda: '',
  taxNumber: '',
  rin: '',
  streetAddress: '',
  suiteApt: '',
  city: '',
  province: 'ON',
  postalCode: '',
  country: 'CA',
  phone: '',
  fax: '',
  mobile: '',
  email: '',
}

function VInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-500">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="edc-input mt-1"
      />
    </div>
  )
}

function VSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-500">{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="edc-input mt-1">
        {options.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
      </select>
    </div>
  )
}

export default function VendorsTab() {
  const [rows, setRows] = useState<VendorRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [pageSize, setPageSize] = useState(10)
  const [page, setPage] = useState(1)
  const [userFilter, setUserFilter] = useState<string>('')
  const [userOptions, setUserOptions] = useState<UserOption[]>([])

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<VendorForm>(defaultForm)
  const [saving, setSaving] = useState(false)
  const [loadingVendor, setLoadingVendor] = useState(false)

  useEffect(() => { fetchVendors(); fetchUsers() }, [])

  const fetchVendors = async () => {
    setLoading(true)
    setError(null)
    try {
      const { data, error: dbError } = await supabase
        .from('edc_vendors')
        .select('id, vendor_name, company_name, phone, mobile, email, city, province, created_at, user_id')
        .order('created_at', { ascending: false })
        .limit(1000)
      if (dbError) throw dbError
      setRows(Array.isArray(data) ? data : [])
    } catch (e: any) {
      setError(e?.message || 'Failed to load vendors')
      setRows([])
    } finally {
      setLoading(false)
    }
  }

  const fetchUsers = async () => {
    try {
      const { data } = await supabase
        .from('users')
        .select('user_id, first_name, last_name')
        .order('first_name', { ascending: true })
      if (Array.isArray(data)) {
        setUserOptions(
          data
            .filter((u) => u.user_id)
            .map((u) => ({
              user_id: u.user_id,
              name: [u.first_name, u.last_name].filter(Boolean).join(' ') || u.user_id,
            }))
        )
      }
    } catch { /* ignore */ }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return rows.filter((r) => {
      if (userFilter && r.user_id !== userFilter) return false
      if (!q) return true
      return [r.vendor_name, r.company_name, r.email, r.phone, r.mobile, r.city]
        .filter(Boolean).join(' ').toLowerCase().includes(q)
    })
  }, [rows, query, userFilter])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const paged = filtered.slice((safePage - 1) * pageSize, safePage * pageSize)

  const setField = <K extends keyof VendorForm>(key: K, value: VendorForm[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  const getLoggedInAdminDbUserId = async (): Promise<string | null> => {
    try {
      if (typeof window === 'undefined') return null
      const raw = window.localStorage.getItem('edc_admin_session')
      if (!raw) return null
      const parsed = JSON.parse(raw) as { email?: string; user_id?: string }
      const sessionUserId = String(parsed?.user_id ?? '').trim()
      if (sessionUserId) return sessionUserId
      const email = String(parsed?.email ?? '').trim().toLowerCase()
      if (!email) return null
      const { data } = await supabase
        .from('edc_account_verifications')
        .select('id')
        .eq('email', email)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      return (data as any)?.id ?? null
    } catch { return null }
  }

  const handleEdit = async (id: string) => {
    setEditingId(id)
    setForm(defaultForm)
    setLoadingVendor(true)
    try {
      const { data, error } = await supabase
        .from('edc_vendors')
        .select('id, company_name, vendor_name, contact_first_name, contact_last_name, street_address, suite_apt, city, province, postal_code, country, phone, fax, mobile, email, salesperson_registration, company_mvda, tax_number, rin')
        .eq('id', id)
        .maybeSingle()
      if (error) throw error
      if (data) {
        const r: any = data
        setForm({
          companyName: String(r.company_name ?? ''),
          firstName: String(r.contact_first_name ?? ''),
          lastName: String(r.contact_last_name ?? ''),
          salespersonRegistration: String(r.salesperson_registration ?? ''),
          companyMvda: String(r.company_mvda ?? ''),
          taxNumber: String(r.tax_number ?? ''),
          rin: String(r.rin ?? ''),
          streetAddress: String(r.street_address ?? ''),
          suiteApt: String(r.suite_apt ?? ''),
          city: String(r.city ?? ''),
          province: String(r.province ?? 'ON'),
          postalCode: String(r.postal_code ?? ''),
          country: String(r.country ?? 'CA'),
          phone: String(r.phone ?? ''),
          fax: String(r.fax ?? ''),
          mobile: String(r.mobile ?? ''),
          email: String(r.email ?? ''),
        })
      }
    } catch (e: any) {
      alert(e?.message || 'Failed to load vendor')
      setEditingId(null)
    } finally {
      setLoadingVendor(false)
    }
  }

  const handleSave = async () => {
    if (!editingId || saving) return
    setSaving(true)
    try {
      const userId = await getLoggedInAdminDbUserId()
      const fullName = `${form.firstName} ${form.lastName}`.replace(/\s+/g, ' ').trim()
      const vendorName = fullName || form.companyName.trim()
      const payload = {
        companyName: form.companyName.trim() || null,
        contactFirstName: form.firstName.trim() || null,
        contactLastName: form.lastName.trim() || null,
        salespersonRegistration: form.salespersonRegistration.trim() || null,
        companyMvda: form.companyMvda.trim() || null,
        taxNumber: form.taxNumber.trim() || null,
        rin: form.rin.trim() || null,
        streetAddress: form.streetAddress.trim() || null,
        suiteApt: form.suiteApt.trim() || null,
        city: form.city.trim() || null,
        province: form.province.trim() || null,
        postalCode: form.postalCode.trim() || null,
        country: form.country.trim() || null,
        phone: form.phone.trim() || null,
        fax: form.fax.trim() || null,
        mobile: form.mobile.trim() || null,
        email: form.email.trim() || null,
        vendorName,
        category: 'edit',
        user_id: userId,
        vendor_id: editingId,
      }
      const res = await fetch('/api/addvendor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(text || `HTTP ${res.status}`)
      }
      await fetchVendors()
      setEditingId(null)
    } catch (e: any) {
      alert(e?.message || 'Failed to save vendor')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this vendor?')) return
    try {
      const { error: delError } = await supabase.from('edc_vendors').delete().eq('id', id)
      if (delError) throw delError
      await fetchVendors()
    } catch (e: any) {
      alert(e?.message || 'Failed to delete')
    }
  }

  // --- Edit view ---
  if (editingId) {
    return (
      <div>
        <div className="flex items-center gap-3 mb-6">
          <button
            type="button"
            onClick={() => setEditingId(null)}
            className="text-slate-400 hover:text-slate-600 transition-colors"
            title="Back to list"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h2 className="text-xl font-semibold text-slate-900">Edit Vendor</h2>
        </div>

        {loadingVendor ? (
          <div className="text-sm text-slate-500">Loading…</div>
        ) : (
          <div className="grid grid-cols-1 gap-6 pb-20">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <VInput label="company name" value={form.companyName} onChange={(v) => setField('companyName', v)} />
              <VInput label="first name" value={form.firstName} onChange={(v) => setField('firstName', v)} />
              <VInput label="last name" value={form.lastName} onChange={(v) => setField('lastName', v)} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <VInput label="Salesperson Registration #" value={form.salespersonRegistration} onChange={(v) => setField('salespersonRegistration', v)} />
              <VInput label="Company MVDA #" value={form.companyMvda} onChange={(v) => setField('companyMvda', v)} />
              <VInput label="tax number" value={form.taxNumber} onChange={(v) => setField('taxNumber', v)} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <VInput label="RIN" value={form.rin} onChange={(v) => setField('rin', v)} />
            </div>

            <div>
              <div className="text-sm font-semibold text-slate-800">Street Address</div>
              <div className="mt-2 grid grid-cols-1 lg:grid-cols-2 gap-4">
                <VInput label="Enter a location" value={form.streetAddress} onChange={(v) => setField('streetAddress', v)} />
                <VInput label="apt/suite #" value={form.suiteApt} onChange={(v) => setField('suiteApt', v)} />
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
              <VInput label="city" value={form.city} onChange={(v) => setField('city', v)} />
              <VSelect label="Province" value={form.province} onChange={(v) => setField('province', v)} options={['ON', 'QC', 'BC', 'AB', 'MB', 'SK', 'NS', 'NB', 'NL', 'PE', 'NT', 'NU', 'YT']} />
              <VInput label="Postal Code" value={form.postalCode} onChange={(v) => setField('postalCode', v)} />
              <VSelect label="Country" value={form.country} onChange={(v) => setField('country', v)} options={['CA', 'US']} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
              <VInput label="Phone" value={form.phone} onChange={(v) => setField('phone', v)} />
              <VInput label="Fax" value={form.fax} onChange={(v) => setField('fax', v)} />
              <VInput label="mobile" value={form.mobile} onChange={(v) => setField('mobile', v)} />
              <VInput label="Email" value={form.email} onChange={(v) => setField('email', v)} />
            </div>
          </div>
        )}

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
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
            disabled={saving || loadingVendor}
            className="h-10 px-6 rounded-lg bg-[#0B1F3A] text-white text-sm font-semibold hover:bg-[#1EA7FF] transition-colors disabled:opacity-60"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    )
  }

  // --- List view ---
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search vendors..."
            autoComplete="off"
            className="h-10 w-64 max-w-full pl-4 pr-4 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1EA7FF]/30 focus:border-[#1EA7FF]/40 transition-all"
          />
          <select
            value={userFilter}
            onChange={(e) => { setUserFilter(e.target.value); setPage(1) }}
            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-[#1EA7FF]/30 transition-all"
          >
            <option value="">All Users</option>
            {userOptions.map((u) => (
              <option key={u.user_id} value={u.user_id}>{u.name}</option>
            ))}
          </select>
        </div>
        <select
          value={pageSize}
          onChange={(e) => setPageSize(Number(e.target.value) || 10)}
          className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-[#1EA7FF]/30 transition-all"
        >
          <option value={10}>10 per page</option>
          <option value={20}>20 per page</option>
          <option value={50}>50 per page</option>
          <option value={100}>100 per page</option>
        </select>
      </div>

      {error && <div className="text-sm text-red-600 bg-red-50 px-4 py-3 rounded-xl">{error}</div>}

      <div className="overflow-hidden rounded-xl border border-slate-200/60">
        <table className="w-full table-auto text-sm">
          <thead className="bg-slate-50/80 text-slate-600">
            <tr>
              <th className="w-10 px-3 py-3 text-left font-semibold"></th>
              <th className="w-40 px-3 py-3 text-left font-semibold">NAME</th>
              <th className="w-40 px-3 py-3 text-left font-semibold">COMPANY</th>
              <th className="w-52 px-3 py-3 text-left font-semibold">EMAIL</th>
              <th className="w-32 px-3 py-3 text-left font-semibold">PHONE</th>
              <th className="w-32 px-3 py-3 text-left font-semibold">MOBILE</th>
              <th className="w-28 px-3 py-3 text-left font-semibold">CITY</th>
              <th className="w-24 px-3 py-3 text-left font-semibold">PROVINCE</th>
              <th className="w-20 px-3 py-3 text-center font-semibold">ACTIONS</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td className="px-4 py-4 text-slate-400 text-center" colSpan={9}>Loading...</td></tr>
            ) : paged.length === 0 ? (
              <tr><td className="px-4 py-4 text-slate-400 text-center" colSpan={9}>No vendors found.</td></tr>
            ) : (
              paged.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => handleEdit(r.id)}
                      className="text-slate-400 hover:text-[#1EA7FF] transition-colors"
                      title="Edit"
                    >
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 3.5a2.121 2.121 0 113 3L7 19l-4 1 1-4 12.5-12.5z" />
                      </svg>
                    </button>
                  </td>
                  <td className="px-3 py-2 text-slate-900">{r.vendor_name || '-'}</td>
                  <td className="px-3 py-2 text-slate-900">{r.company_name || '-'}</td>
                  <td className="px-3 py-2 text-slate-900">{r.email || '-'}</td>
                  <td className="px-3 py-2 text-slate-600">{r.phone || '-'}</td>
                  <td className="px-3 py-2 text-slate-600">{r.mobile || '-'}</td>
                  <td className="px-3 py-2 text-slate-600">{r.city || '-'}</td>
                  <td className="px-3 py-2 text-slate-600">{r.province || '-'}</td>
                  <td className="px-3 py-2 text-center">
                    <button
                      type="button"
                      onClick={() => handleDelete(r.id)}
                      className="text-red-400 hover:text-red-600 transition-colors"
                      title="Delete"
                    >
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M10 11v6m4-6v6" />
                      </svg>
                    </button>
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
          <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={safePage <= 1} className="rounded-lg border border-slate-200/60 px-3 py-1 hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">Previous</button>
          <span className="px-2">Page {safePage} of {totalPages}</span>
          <button type="button" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={safePage >= totalPages} className="rounded-lg border border-slate-200/60 px-3 py-1 hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">Next</button>
        </div>
      </div>
    </div>
  )
}
