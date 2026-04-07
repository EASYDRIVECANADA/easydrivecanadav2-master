'use client'

import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabaseClient'
import CustomerInformationTab from '../costumer/CustomerInformationTab'
import CreditAppTab from '../costumer/CreditAppTab'
import HistoryTab from '../costumer/HistoryTab'
import type { CustomerForm, CreditForm } from '../costumer/types'

type CustomerRow = {
  id: string
  first_name: string | null
  last_name: string | null
  email: string | null
  phone: string | null
  mobile: string | null
  drivers_license: string | null
  rin: string | null
  date_of_birth: string | null
  customer_type: string | null
  created_at: string | null
  user_id: string | null
}

type UserOption = {
  user_id: string
  name: string
}

const getDefaultForm = (): CustomerForm => ({
  customerType: 'IND',
  idType: 'RIN',
  firstName: '',
  middleName: '',
  lastName: '',
  rin: '',
  driversLicense: '',
  dlExpiry: '',
  dateOfBirth: '',
  legalName: '',
  companyName: '',
  mvda: '',
  yearEnd: '',
  taxNumber: '',
  contactFirstName: '',
  contactLastName: '',
  salespersonReg: '',
  fax: '',
  streetAddress: '',
  suiteApt: '',
  city: '',
  province: 'ON',
  postalCode: '',
  country: 'CA',
  phone: '',
  mobile: '',
  email: '',
  salesperson: '',
  visibility: 'Private',
  notes: '',
})

const getDefaultCredit = (): CreditForm => ({
  salutation: '',
  gender: '',
  maritalStatus: '',
  residenceOwnership: 'Own',
  marketValue: '0',
  mortgageAmount: '0',
  monthlyPayment: '0',
  bank: '',
  yearsAtPresentAddress: '',
  employments: [
    {
      employmentType: 'Full Time',
      position: '',
      occupation: '',
      employerName: '',
      employerPhone: '',
      yearsEmployed: '',
      streetAddress: '',
      suiteApt: '',
      city: '',
      province: 'ON',
      postalCode: '',
      country: 'CA',
    },
  ],
  incomes: [
    {
      incomeType: 'Employment',
      rateHr: '0',
      hrsWeek: '0',
      monthlyGross: '0',
      annualGross: '0',
      incomeNotes: '',
    },
  ],
  declaredBankruptcy: false,
  hasCollections: false,
  financialInstitution: '',
  desiredMonthlyPayment: '0',
})

export default function CustomersTab() {
  const [rows, setRows] = useState<CustomerRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [pageSize, setPageSize] = useState(10)
  const [page, setPage] = useState(1)
  const [userFilter, setUserFilter] = useState<string>('')
  const [userOptions, setUserOptions] = useState<UserOption[]>([])

  // Edit view state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'customer' | 'credit' | 'history'>('customer')
  const [form, setForm] = useState<CustomerForm>(getDefaultForm)
  const [credit, setCredit] = useState<CreditForm>(getDefaultCredit)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchCustomers()
    fetchUsers()
  }, [])

  const fetchCustomers = async () => {
    setLoading(true)
    setError(null)
    try {
      const { data, error: dbError } = await supabase
        .from('edc_customer')
        .select('id, first_name, last_name, email, phone, mobile, drivers_license, rin, date_of_birth, customer_type, created_at, user_id')
        .order('created_at', { ascending: false })
        .limit(1000)

      if (dbError) throw dbError
      setRows(Array.isArray(data) ? data : [])
    } catch (e: any) {
      setError(e?.message || 'Failed to load customers')
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
      const searchText = [
        r.first_name, r.last_name, r.email, r.phone, r.mobile, r.drivers_license, r.rin,
      ].filter(Boolean).join(' ').toLowerCase()
      return searchText.includes(q)
    })
  }, [rows, query, userFilter])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const paged = filtered.slice((safePage - 1) * pageSize, safePage * pageSize)

  const toArray = (raw: any) => {
    if (!raw) return null
    if (Array.isArray(raw)) return raw
    if (typeof raw === 'string') {
      const s = raw.trim()
      if (!s) return null
      try { const p = JSON.parse(s); if (Array.isArray(p)) return p } catch { return null }
    }
    return null
  }

  const handleEdit = async (id: string) => {
    setEditingId(id)
    setActiveTab('customer')
    setForm(getDefaultForm())
    setCredit(getDefaultCredit())
    try {
      const { data } = await supabase.from('edc_customer').select('*').eq('id', id).single()
      if (data) {
        const r: any = data
        setForm((prev) => ({
          ...prev,
          customerType: (r.customer_type || prev.customerType) as any,
          idType: (r.id_type || prev.idType) as any,
          firstName: r.first_name ?? prev.firstName,
          middleName: r.middle_name ?? prev.middleName,
          lastName: r.last_name ?? prev.lastName,
          rin: r.rin ?? prev.rin,
          driversLicense: r.drivers_license ?? prev.driversLicense,
          dlExpiry: r.dl_expiry ?? prev.dlExpiry,
          dateOfBirth: r.date_of_birth ?? prev.dateOfBirth,
          legalName: r.legal_name ?? prev.legalName,
          companyName: r.company_name ?? prev.companyName,
          mvda: r.mvda ?? prev.mvda,
          yearEnd: r.year_end ?? prev.yearEnd,
          taxNumber: r.tax_number ?? prev.taxNumber,
          contactFirstName: r.contact_first_name ?? prev.contactFirstName,
          contactLastName: r.contact_last_name ?? prev.contactLastName,
          salespersonReg: r.salesperson_reg ?? prev.salespersonReg,
          fax: r.fax ?? prev.fax,
          streetAddress: r.street_address ?? prev.streetAddress,
          suiteApt: r.suite_apt ?? prev.suiteApt,
          city: r.city ?? prev.city,
          province: r.province ?? prev.province,
          postalCode: r.postal_code ?? prev.postalCode,
          country: r.country ?? prev.country,
          phone: r.phone ?? prev.phone,
          mobile: r.mobile ?? prev.mobile,
          email: r.email ?? prev.email,
          salesperson: r.salesperson ?? prev.salesperson,
          visibility: r.visibility ?? prev.visibility,
          notes: r.notes ?? prev.notes,
        }))
      }

      const { data: creditData } = await supabase
        .from('edc_creditapp')
        .select('*')
        .eq('customer_id', id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (creditData) {
        const c: any = creditData
        const creditEmp = toArray(c.employments) as any[] | null
        const creditInc = toArray(c.incomes) as any[] | null
        setCredit((prev) => ({
          ...prev,
          salutation: c.salutation ?? prev.salutation,
          gender: c.gender ?? prev.gender,
          maritalStatus: c.marital_status ?? prev.maritalStatus,
          residenceOwnership: c.residence_ownership ?? prev.residenceOwnership,
          marketValue: String(c.market_value ?? prev.marketValue ?? '0'),
          mortgageAmount: String(c.mortgage_amount ?? prev.mortgageAmount ?? '0'),
          monthlyPayment: String(c.monthly_payment ?? prev.monthlyPayment ?? '0'),
          bank: c.bank ?? prev.bank,
          yearsAtPresentAddress: c.years_at_present_address ?? prev.yearsAtPresentAddress,
          employments: creditEmp
            ? creditEmp.map((e: any) => ({
                employmentType: e.employment_type ?? e.employmentType ?? 'Full Time',
                position: e.position ?? '',
                occupation: e.occupation ?? '',
                employerName: e.employer_name ?? e.employerName ?? '',
                employerPhone: e.employer_phone ?? e.employerPhone ?? '',
                yearsEmployed: e.years_employed ?? e.yearsEmployed ?? '',
                streetAddress: e.street_address ?? e.streetAddress ?? '',
                suiteApt: e.suite_apt ?? e.suiteApt ?? '',
                city: e.city ?? '',
                province: e.province ?? 'ON',
                postalCode: e.postal_code ?? e.postalCode ?? '',
                country: e.country ?? 'CA',
              }))
            : prev.employments,
          incomes: creditInc
            ? creditInc.map((i: any) => ({
                incomeType: i.income_type ?? i.incomeType ?? 'Employment',
                rateHr: String(i.rate_hr ?? i.rateHr ?? '0'),
                hrsWeek: String(i.hrs_week ?? i.hrsWeek ?? '0'),
                monthlyGross: String(i.monthly_gross ?? i.monthlyGross ?? '0'),
                annualGross: String(i.annual_gross ?? i.annualGross ?? '0'),
                incomeNotes: i.income_notes ?? i.incomeNotes ?? '',
              }))
            : prev.incomes,
          declaredBankruptcy: Boolean(c.declared_bankruptcy ?? prev.declaredBankruptcy),
          bankruptcyDuration: c.bankruptcy_duration ?? prev.bankruptcyDuration,
          hasCollections: Boolean(c.has_collections ?? prev.hasCollections),
          collectionNotes: c.collection_notes ?? prev.collectionNotes,
          financialInstitution: c.financial_institution ?? prev.financialInstitution,
          desiredMonthlyPayment: String(c.desired_monthly_payment ?? prev.desiredMonthlyPayment ?? '0'),
        }))
      }
    } catch (e) {
      console.error('Failed to load customer data:', e)
    }
  }

  const handleSave = async () => {
    if (!editingId || saving) return
    setSaving(true)
    try {
      if (activeTab === 'customer') {
        const toNulls = (obj: Record<string, unknown>) => {
          const out: Record<string, unknown> = {}
          for (const [k, v] of Object.entries(obj)) { out[k] = v === '' ? null : v }
          return out
        }
        const payload = { ...toNulls(form as unknown as Record<string, unknown>), customerId: editingId, operation: 'edit' }
        await fetch('/api/proxy/info', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        await fetchCustomers()
      } else if (activeTab === 'credit') {
        const toNulls = (obj: Record<string, unknown>) => {
          const out: Record<string, unknown> = {}
          for (const [k, v] of Object.entries(obj)) { out[k] = v === '' ? null : v }
          return out
        }
        const creditPayload = {
          ...toNulls(credit as unknown as Record<string, unknown>),
          customerId: editingId,
          operation: 'edit',
        }
        await fetch('/api/proxy/creditApp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(creditPayload),
        })
      }
      setEditingId(null)
    } catch (e: any) {
      alert(e?.message || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this customer?')) return
    try {
      await supabase.from('edc_creditapp').delete().match({ customer_id: id })
      const { error: delError } = await supabase.from('edc_customer').delete().eq('id', id)
      if (delError) throw delError
      await fetchCustomers()
    } catch (e: any) {
      alert(e?.message || 'Failed to delete')
    }
  }

  // --- Edit view ---
  if (editingId) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200/60 overflow-hidden" style={{ boxShadow: '0 1px 3px rgba(0,0,0,.04)' }}>
        <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setEditingId(null)}
              className="text-slate-400 hover:text-slate-600 transition-colors mr-2"
              title="Back to list"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              type="button"
              className={activeTab === 'customer' ? 'h-9 px-4 rounded-t-lg bg-[#0B1F3A] text-white text-sm font-semibold' : 'h-9 px-4 rounded-t-lg bg-slate-100 text-slate-600 text-sm font-semibold hover:bg-slate-200 transition-colors'}
              onClick={() => setActiveTab('customer')}
            >
              Customer Information
            </button>
            <button
              type="button"
              className={activeTab === 'credit' ? 'h-9 px-4 rounded-t-lg bg-[#0B1F3A] text-white text-sm font-semibold' : 'h-9 px-4 rounded-t-lg bg-slate-100 text-slate-600 text-sm font-semibold hover:bg-slate-200 transition-colors'}
              onClick={() => setActiveTab('credit')}
            >
              Credit App.
            </button>
            <button
              type="button"
              className={activeTab === 'history' ? 'h-9 px-4 rounded-t-lg bg-[#0B1F3A] text-white text-sm font-semibold' : 'h-9 px-4 rounded-t-lg bg-slate-100 text-slate-600 text-sm font-semibold hover:bg-slate-200 transition-colors'}
              onClick={() => setActiveTab('history')}
            >
              History
            </button>
          </div>
        </div>

        <div className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 260px)' }}>
          {activeTab === 'customer' && (
            <CustomerInformationTab form={form} setForm={setForm} hideVisibility />
          )}
          {activeTab === 'credit' && (
            <CreditAppTab credit={credit} setCredit={setCredit} isCreate={false} />
          )}
          {activeTab === 'history' && (
            <HistoryTab customerId={editingId} />
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
          {activeTab !== 'history' && (
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="h-10 px-6 rounded-lg bg-[#0B1F3A] text-white text-sm font-semibold hover:bg-[#1EA7FF] transition-colors disabled:opacity-60"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          )}
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
            placeholder="Search customers..."
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
              <th className="w-40 px-3 py-3 text-left font-semibold">NAME</th>
              <th className="w-52 px-3 py-3 text-left font-semibold">EMAIL</th>
              <th className="w-32 px-3 py-3 text-left font-semibold">PHONE</th>
              <th className="w-32 px-3 py-3 text-left font-semibold">MOBILE</th>
              <th className="w-28 px-3 py-3 text-left font-semibold">DL</th>
              <th className="w-24 px-3 py-3 text-left font-semibold">RIN</th>
              <th className="w-24 px-3 py-3 text-left font-semibold">TYPE</th>
              <th className="w-28 px-3 py-3 text-left font-semibold">DOB</th>
              <th className="w-28 px-3 py-3 text-center font-semibold">ACTIONS</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td className="px-4 py-4 text-slate-400 text-center" colSpan={9}>Loading...</td></tr>
            ) : paged.length === 0 ? (
              <tr><td className="px-4 py-4 text-slate-400 text-center" colSpan={9}>No customers found.</td></tr>
            ) : (
              paged.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="px-3 py-2 text-slate-900">{[r.first_name, r.last_name].filter(Boolean).join(' ') || '-'}</td>
                  <td className="px-3 py-2 text-slate-900">{r.email || '-'}</td>
                  <td className="px-3 py-2 text-slate-600">{r.phone || '-'}</td>
                  <td className="px-3 py-2 text-slate-600">{r.mobile || '-'}</td>
                  <td className="px-3 py-2 text-slate-600 text-xs">{r.drivers_license || '-'}</td>
                  <td className="px-3 py-2 text-slate-600 text-xs">{r.rin || '-'}</td>
                  <td className="px-3 py-2">
                    <span className="inline-flex px-2 py-1 rounded-lg text-xs font-semibold bg-blue-100 text-blue-700">
                      {r.customer_type || '-'}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-slate-500 text-xs">
                    {r.date_of_birth ? new Date(r.date_of_birth).toLocaleDateString() : '-'}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <div className="flex items-center justify-center gap-3">
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
          <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={safePage <= 1} className="rounded-lg border border-slate-200/60 px-3 py-1 hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">Previous</button>
          <span className="px-2">Page {safePage} of {totalPages}</span>
          <button type="button" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={safePage >= totalPages} className="rounded-lg border border-slate-200/60 px-3 py-1 hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">Next</button>
        </div>
      </div>
    </div>
  )
}
