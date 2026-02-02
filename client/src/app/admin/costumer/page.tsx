'use client'

import { useEffect, useMemo, useState } from 'react'

import CreditAppTab from './CreditAppTab'
import CustomerInformationTab from './CustomerInformationTab'
import type { CreditForm, CustomerForm, CustomerRow } from './types'
import { supabase } from '@/lib/supabaseClient'

export default function AdminCostumerPage() {
  const [query, setQuery] = useState('')
  const [pageSize, setPageSize] = useState(5)
  const [checked, setChecked] = useState<Record<string, boolean>>({})
  const [checkedAll, setCheckedAll] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [activeTab, setActiveTab] = useState<'customer' | 'credit'>('customer')
  const [saving, setSaving] = useState(false)
  const [rows, setRows] = useState<CustomerRow[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)

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
    salesperson: 'Nawshad Syed',
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

  const [form, setForm] = useState<CustomerForm>(getDefaultForm)

  const [credit, setCredit] = useState<CreditForm>(getDefaultCredit)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      const { data, error } = await supabase
        .from('edc_customer')
        .select('id, first_name, last_name, phone, mobile, email, drivers_license, date_of_birth')
        .order('created_at', { ascending: false })
        .limit(100)
      if (error) {
        // Fail silently for now; keep empty list
        return
      }
      if (cancelled || !data) return
      const mapped: CustomerRow[] = data.map((r: any) => ({
        id: r.id,
        name: [r.first_name, r.last_name].filter(Boolean).join(' ').trim(),
        phone: r.phone || '',
        mobile: r.mobile || '',
        email: r.email || '',
        dl: r.drivers_license || '',
        dob: r.date_of_birth || '',
      }))
      setRows(mapped)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((r) => {
      return (
        r.name.toLowerCase().includes(q) ||
        r.phone.toLowerCase().includes(q) ||
        r.mobile.toLowerCase().includes(q) ||
        r.email.toLowerCase().includes(q) ||
        r.dl.toLowerCase().includes(q) ||
        r.dob.toLowerCase().includes(q)
      )
    })
  }, [query, rows])

  const pageRows = filtered.slice(0, pageSize)

  const toggleAll = (next: boolean) => {
    setCheckedAll(next)
    if (!next) {
      setChecked({})
      return
    }
    const nextChecked: Record<string, boolean> = {}
    for (const r of pageRows) nextChecked[r.id] = true
    setChecked(nextChecked)
  }

  const rangeLabel = useMemo(() => {
    const start = filtered.length === 0 ? 0 : 1
    const end = Math.min(filtered.length, pageSize)
    return `${start} to ${end}`
  }, [filtered.length, pageSize])

  const handleOpenCreate = () => {
    setActiveTab('customer')
    setEditingId(null)
    setForm(getDefaultForm())
    setCredit(getDefaultCredit())
    setShowCreate(true)
  }

  const handleEdit = async (id: string) => {
    setActiveTab('customer')
    setEditingId(id)
    setShowCreate(true)
    try {
      const { data, error } = await supabase.from('edc_customer').select('*').eq('id', id).single()
      if (error || !data) return

      const r: any = data

      setForm((prev) => ({
        ...prev,
        customerType: (r.customer_type || r.customerType || prev.customerType) as any,
        idType: (r.id_type || r.idType || prev.idType) as any,
        firstName: r.first_name ?? r.firstName ?? prev.firstName,
        middleName: r.middle_name ?? r.middleName ?? prev.middleName,
        lastName: r.last_name ?? r.lastName ?? prev.lastName,
        rin: r.rin ?? prev.rin,
        driversLicense: r.drivers_license ?? r.driversLicense ?? prev.driversLicense,
        dlExpiry: r.dl_expiry ?? r.dlExpiry ?? prev.dlExpiry,
        dateOfBirth: r.date_of_birth ?? r.dateOfBirth ?? prev.dateOfBirth,
        legalName: r.legal_name ?? r.legalName ?? prev.legalName,
        companyName: r.company_name ?? r.companyName ?? prev.companyName,
        mvda: r.mvda ?? prev.mvda,
        yearEnd: r.year_end ?? r.yearEnd ?? prev.yearEnd,
        taxNumber: r.tax_number ?? r.taxNumber ?? prev.taxNumber,
        contactFirstName: r.contact_first_name ?? r.contactFirstName ?? prev.contactFirstName,
        contactLastName: r.contact_last_name ?? r.contactLastName ?? prev.contactLastName,
        salespersonReg: r.salesperson_reg ?? r.salespersonReg ?? prev.salespersonReg,
        fax: r.fax ?? prev.fax,
        streetAddress: r.street_address ?? r.streetAddress ?? prev.streetAddress,
        suiteApt: r.suite_apt ?? r.suiteApt ?? prev.suiteApt,
        city: r.city ?? prev.city,
        province: r.province ?? prev.province,
        postalCode: r.postal_code ?? r.postalCode ?? prev.postalCode,
        country: r.country ?? prev.country,
        phone: r.phone ?? prev.phone,
        mobile: r.mobile ?? prev.mobile,
        email: r.email ?? prev.email,
        salesperson: r.salesperson ?? prev.salesperson,
        visibility: r.visibility ?? prev.visibility,
        notes: r.notes ?? prev.notes,
      }))

      const toArray = (raw: any) => {
        if (!raw) return null
        if (Array.isArray(raw)) return raw
        if (typeof raw === 'string') {
          const s = raw.trim()
          if (!s) return null
          try {
            const parsed = JSON.parse(s)
            if (Array.isArray(parsed)) return parsed
          } catch {
            return null
          }
        }
        return null
      }

      const emp = toArray(r.employments) as any[] | null
      const inc = toArray(r.incomes) as any[] | null

      setCredit((prev) => ({
        ...prev,
        salutation: r.salutation ?? prev.salutation,
        gender: r.gender ?? prev.gender,
        maritalStatus: r.marital_status ?? r.maritalStatus ?? prev.maritalStatus,
        residenceOwnership: r.residence_ownership ?? r.residenceOwnership ?? prev.residenceOwnership,
        marketValue: String(r.market_value ?? r.marketValue ?? prev.marketValue ?? '0'),
        mortgageAmount: String(r.mortgage_amount ?? r.mortgageAmount ?? prev.mortgageAmount ?? '0'),
        monthlyPayment: String(r.monthly_payment ?? r.monthlyPayment ?? prev.monthlyPayment ?? '0'),
        bank: r.bank ?? prev.bank,
        yearsAtPresentAddress: r.years_at_present_address ?? r.yearsAtPresentAddress ?? prev.yearsAtPresentAddress,
        employments: emp
          ? emp.map((e: any) => ({
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
        incomes: inc
          ? inc.map((i: any) => ({
              incomeType: i.income_type ?? i.incomeType ?? 'Employment',
              rateHr: String(i.rate_hr ?? i.rateHr ?? '0'),
              hrsWeek: String(i.hrs_week ?? i.hrsWeek ?? '0'),
              monthlyGross: String(i.monthly_gross ?? i.monthlyGross ?? '0'),
              annualGross: String(i.annual_gross ?? i.annualGross ?? '0'),
              incomeNotes: i.income_notes ?? i.incomeNotes ?? '',
            }))
          : prev.incomes,
        declaredBankruptcy: Boolean(r.declared_bankruptcy ?? r.declaredBankruptcy ?? prev.declaredBankruptcy),
        bankruptcyDuration: r.bankruptcy_duration ?? r.bankruptcyDuration ?? prev.bankruptcyDuration,
        hasCollections: Boolean(r.has_collections ?? r.hasCollections ?? prev.hasCollections),
        collectionNotes: r.collection_notes ?? r.collectionNotes ?? prev.collectionNotes,
        financialInstitution: r.financial_institution ?? r.financialInstitution ?? prev.financialInstitution,
        desiredMonthlyPayment: String(r.desired_monthly_payment ?? r.desiredMonthlyPayment ?? prev.desiredMonthlyPayment ?? '0'),
      }))
    } catch {
      // ignore
    }
  }

  const handleBackToList = () => {
    setShowCreate(false)
  }

  const handleSave = async () => {
    if (saving) return
    setSaving(true)
    try {
      const toNulls = (obj: Record<string, unknown>) => {
        const out: Record<string, unknown> = {}
        for (const [k, v] of Object.entries(obj)) {
          if (v === '') out[k] = null
          else out[k] = v
        }
        return out
      }

      const payload = toNulls(form as unknown as Record<string, unknown>)

      const res = await fetch('/api/proxy/info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      // Try to extract an ID from the webhook response first
      let createdId: string | null = null
      let rawText = ''
      try {
        const json = await res.clone().json()
        if (json && typeof json.id === 'string') createdId = json.id
      } catch {
        // ignore
      }
      if (!createdId) {
        rawText = await res.text().catch(() => '')
      }
      if (!res.ok) {
        throw new Error(rawText || `HTTP ${res.status}`)
      }
      if (!createdId && rawText.trim() !== 'Done') {
        // If text isn't the sentinel Done, treat it as an ID when it looks like one (uuid-ish)
        const maybeId = rawText.trim()
        if (maybeId && maybeId.length >= 8) createdId = maybeId
      }

      // If still no id, try to locate the record in Supabase using strongest identifiers
      if (!createdId) {
        const tryFind = async (): Promise<string | null> => {
          // 1) drivers_license match
          if (form.driversLicense) {
            const { data } = await supabase
              .from('edc_customer')
              .select('id')
              .eq('drivers_license', form.driversLicense)
              .order('created_at', { ascending: false })
              .limit(1)
            if (data && data[0]?.id) return data[0].id as string
          }
          // 2) email match
          if (form.email) {
            const { data } = await supabase
              .from('edc_customer')
              .select('id')
              .eq('email', form.email)
              .order('created_at', { ascending: false })
              .limit(1)
            if (data && data[0]?.id) return data[0].id as string
          }
          // 3) name + DOB
          if (form.firstName || form.lastName || form.dateOfBirth) {
            let query = supabase
              .from('edc_customer')
              .select('id')
              .order('created_at', { ascending: false })
              .limit(1)
            if (form.firstName) query = query.eq('first_name', form.firstName)
            if (form.lastName) query = query.eq('last_name', form.lastName)
            if (form.dateOfBirth) query = query.eq('date_of_birth', form.dateOfBirth)
            const { data } = await query
            if (data && data[0]?.id) return data[0].id as string
          }
          return null
        }
        createdId = await tryFind()
      }

      // Prepare and send the Credit App payload including the customerId if known
      const creditToNulls = toNulls(credit as unknown as Record<string, unknown>)
      const creditPayload = {
        customerId: createdId ?? null,
        ...creditToNulls,
        // Extra snake_case fields expected by webhook schema
        bankruptcy_duration: (credit as any).bankruptcyDuration ?? null,
        collection_notes: (credit as any).collectionNotes ?? null,
      }
      const resCredit = await fetch('/api/proxy/creditApp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(creditPayload),
      })
      const creditText = await resCredit.text().catch(() => '')
      if (!resCredit.ok || creditText.trim() !== 'Done') {
        throw new Error(creditText || `Credit HTTP ${resCredit.status}`)
      }

      alert('Customer information and credit app sent (Done).')
    } catch (err) {
      alert(`Failed to send: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="w-full">
      {showCreate ? (
        <div className="w-full px-4 sm:px-6 lg:px-8 py-6">
          <div className="bg-white rounded-xl shadow overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className={
                      activeTab === 'customer'
                        ? 'h-9 px-4 rounded-t-md bg-[#118df0] text-white text-sm font-semibold'
                        : 'h-9 px-4 rounded-t-md bg-gray-100 text-gray-700 text-sm font-semibold hover:bg-gray-200'
                    }
                    onClick={() => setActiveTab('customer')}
                  >
                    Customer Information
                  </button>
                  <button
                    type="button"
                    className={
                      activeTab === 'credit'
                        ? 'h-9 px-4 rounded-t-md bg-[#118df0] text-white text-sm font-semibold'
                        : 'h-9 px-4 rounded-t-md bg-gray-100 text-gray-700 text-sm font-semibold hover:bg-gray-200'
                    }
                    onClick={() => setActiveTab('credit')}
                  >
                    Credit App.
                  </button>
                </div>
              </div>

              <button
                type="button"
                className="w-10 h-10 rounded-lg hover:bg-gray-100 flex items-center justify-center"
                onClick={handleBackToList}
                aria-label="Close"
              >
                <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto bg-white">
              {activeTab === 'customer' ? (
                <CustomerInformationTab form={form} setForm={setForm} />
              ) : (
                <CreditAppTab credit={credit} setCredit={setCredit} />
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-end">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className={`h-10 px-6 rounded text-white text-sm font-semibold ${saving ? 'bg-[#73baf2] cursor-not-allowed' : 'bg-[#118df0] hover:bg-[#0d6ebd]'}`}
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="w-full px-4 sm:px-6 lg:px-8 py-6">
          <div className="bg-white rounded-xl shadow overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 flex items-center gap-3">
              <div className="flex-1">
                <div className="relative">
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder=""
                    className="w-full border border-gray-200 rounded-lg pl-10 pr-4 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent"
                  />
                  <svg
                    className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35m1.35-5.65a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
              </div>

              <button
                type="button"
                onClick={handleOpenCreate}
                className="w-10 h-10 rounded-lg bg-[#118df0] text-white flex items-center justify-center hover:bg-[#0d6ebd]"
                aria-label="Add new costumer"
                title="Add new costumer"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </button>

              <div className="w-20">
                <select
                  value={pageSize}
                  onChange={(e) => {
                    const v = Number(e.target.value)
                    setPageSize(Number.isFinite(v) ? v : 5)
                    setChecked({})
                    setCheckedAll(false)
                  }}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                >
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-white">
                  <tr className="border-b border-gray-200">
                    <th className="px-3 py-3 w-10"></th>
                    <th className="px-3 py-3 w-10">
                      <input
                        type="checkbox"
                        className="h-4 w-4"
                        checked={checkedAll && pageRows.length > 0}
                        onChange={(e) => toggleAll(e.target.checked)}
                        aria-label="Select all"
                      />
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Phone</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Mobile</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Email</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">DL</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">DOB</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100">
                  {pageRows.map((r) => (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className="px-3 py-3">
                        <button type="button" className="text-gray-400 hover:text-gray-600" aria-label="Edit" onClick={() => handleEdit(r.id)}>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"
                            />
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"
                            />
                          </svg>
                        </button>
                      </td>
                      <td className="px-3 py-3">
                        <input
                          type="checkbox"
                          className="h-4 w-4"
                          checked={!!checked[r.id]}
                          onChange={(e) => {
                            const next = e.target.checked
                            setChecked((prev) => ({ ...prev, [r.id]: next }))
                          }}
                          aria-label={`Select ${r.name}`}
                        />
                      </td>
                      <td className="px-6 py-3 text-sm text-[#118df0] whitespace-nowrap">{r.name}</td>
                      <td className="px-6 py-3 text-sm text-[#118df0] whitespace-nowrap">{r.phone}</td>
                      <td className="px-6 py-3 text-sm text-gray-700 whitespace-nowrap">{r.mobile}</td>
                      <td className="px-6 py-3 text-sm text-[#118df0] whitespace-nowrap">{r.email}</td>
                      <td className="px-6 py-3 text-sm text-gray-700 whitespace-nowrap">{r.dl}</td>
                      <td className="px-6 py-3 text-sm text-gray-700 whitespace-nowrap">{r.dob}</td>
                    </tr>
                  ))}

                  {pageRows.length === 0 ? (
                    <tr>
                      <td className="px-6 py-10 text-center text-sm text-gray-500" colSpan={8}>
                        No results.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>

            <div className="px-4 py-3 flex items-center gap-3">
              <button type="button" className="text-[#118df0]" aria-label="Previous">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div className="text-sm text-gray-600">{rangeLabel}</div>
              <button type="button" className="text-[#118df0]" aria-label="Next">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
